import { randomUUID } from "node:crypto";
import type { Kibbud } from "@/contracts/types";
import type { CardPaymentPayload, CartPaymentPayload } from "@/lib/api/validation";
import { queueAndSyncCheckoutToAdmire } from "@/lib/admire/client";
import {
  banquestEnvironment,
  banquestRequest,
  BanquestApiError,
  BanquestConfigurationError,
} from "@/lib/banquest/client";
import { reverseBanquestTransaction } from "@/lib/banquest/reversal";
import { getRepository } from "@/lib/storage/repository";
import { AlreadyTakenError, CheckoutInProgressError } from "@/lib/storage/repository";
import type { CheckoutRecord } from "@/lib/storage/types";

interface CardChargeResponse {
  status?: string;
  status_code?: string;
  error_message?: string;
  reference_number?: number;
  transaction?: {
    id?: number;
  };
}

export class BanquestDeclinedError extends Error {}

function amountForEnvironment(trustedAmount: number): number {
  if (banquestEnvironment() !== "sandbox") return trustedAmount;
  const override = process.env.BANQUEST_SANDBOX_AMOUNT_USD?.trim();
  if (!override) return trustedAmount;
  const amount = Number(override);
  if (!Number.isFinite(amount) || amount < 0.01 || amount >= 100) {
    throw new BanquestConfigurationError(
      "BANQUEST_SANDBOX_AMOUNT_USD must be at least 0.01 and under 100"
    );
  }
  return Math.round(amount * 100) / 100;
}

export async function chargeBanquestCard(
  itemOrItems: Kibbud | Kibbud[],
  payload: CardPaymentPayload | CartPaymentPayload,
  holdToken: string,
  trustedAmount: number | Record<string, number>
): Promise<{ paymentId: string; status: "sold" | "pending" }> {
  const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
  const item = items[0];
  if (!item) throw new BanquestConfigurationError("At least one kibbud is required");
  const trustedAmounts = typeof trustedAmount === "number"
    ? { [item.id]: trustedAmount }
    : trustedAmount;
  const trustedTotal = Object.values(trustedAmounts).reduce((sum, value) => sum + value, 0);
  const repository = getRepository();
  const existing = await repository.checkoutForHold(holdToken);
  if (existing) {
    if (existing.status === "sold") return { paymentId: existing.paymentId, status: "sold" };
    if (
      existing.status === "created" ||
      existing.status === "processing" ||
      existing.status === "pending" ||
      existing.status === "needs_review"
    ) {
      return { paymentId: existing.paymentId, status: "pending" };
    }
  }

  const claimed = await repository.beginCheckoutAttempt(holdToken);
  if (!claimed) {
    const inFlight = await repository.checkoutForHold(holdToken);
    if (inFlight) {
      return {
        paymentId: inFlight.paymentId,
        status: inFlight.status === "sold" ? "sold" : "pending",
      };
    }
    throw new CheckoutInProgressError("A payment is already being submitted for this hold.");
  }

  const paymentId = `bq_${randomUUID()}`;
  const amount = amountForEnvironment(trustedTotal);
  const createdAt = new Date().toISOString();
  const record: CheckoutRecord = {
    paymentId,
    kibbudId: item.id,
    kibbudIds: items.length > 1 ? items.map((candidate) => candidate.id) : undefined,
    amounts: items.length > 1 ? trustedAmounts : undefined,
    holdToken,
    donorName: payload.donorName,
    email: payload.email,
    phone: payload.phone,
    misheberachNames: payload.misheberachNames,
    dedicationType: payload.dedicationType,
    dedicationName: payload.dedicationName,
    dedicationMessage: payload.dedicationMessage,
    honoreeEmail: payload.honoreeEmail,
    publicRecognition: payload.publicRecognition,
    recognitionName: payload.recognitionName,
    assignmentAcceptedAt: createdAt,
    amount,
    preferredMethod: "card",
    status: "created",
    createdAt,
  };
  try {
    await repository.saveCheckout(record);

    let response: CardChargeResponse;
    try {
      response = await banquestRequest<CardChargeResponse>("/transactions/charge", {
      method: "POST",
      body: JSON.stringify({
        source: `nonce-${payload.payment.nonce}`,
        amount,
        name: payload.donorName,
        expiry_month: payload.payment.expiryMonth,
        expiry_year: payload.payment.expiryYear,
        avs_zip: payload.payment.avsZip,
        capture: true,
        ignore_duplicates: banquestEnvironment() === "sandbox",
        transaction_flags: {
          allow_partial_approval: false,
        },
        transaction_details: {
          description: items.length === 1 ? `Sponsor ${item.name}` : `Sponsor ${items.length} Ponevez kibbudim`,
          invoice_number: items.length === 1 ? item.id : `PONEVEZ-${paymentId.slice(-12)}`,
          order_number: paymentId,
        },
        custom_fields: {
          custom1: paymentId,
          custom2: items.length === 1 ? item.id : `${items.length} kibbudim`,
        },
        customer: {
          identifier: payload.donorName,
          email: payload.email,
          send_receipt: false,
        },
      }),
      });
    } catch (error) {
      if (error instanceof BanquestApiError && error.status < 500) {
        await repository.releaseCheckout(paymentId);
        throw error;
      }
      // A timeout or gateway error is ambiguous: the charge may have reached
      // Banquest. Keep the item reserved and let webhook/reconciliation settle it.
      await repository.markCheckoutPending(paymentId);
      return { paymentId, status: "pending" };
    }

    await repository.updateCheckoutGateway(paymentId, {
      gatewayTransactionId: response.transaction?.id?.toString(),
      gatewayReference: response.reference_number?.toString(),
    });

    if (response.status === "Approved") {
      try {
        await repository.markCheckoutGroupSold(paymentId, "card");
      } catch (error) {
        if (!(error instanceof AlreadyTakenError)) throw error;
        const reference = response.reference_number?.toString();
        if (reference) {
          try {
            await reverseBanquestTransaction(reference);
            await repository.reverseCheckout(
              paymentId,
              "Automatically reversed because inventory settlement failed"
            );
          } catch (reversalError) {
            await repository.markCheckoutNeedsReview(
              paymentId,
              `Captured payment could not be settled or reversed: ${
                reversalError instanceof Error ? reversalError.message : "unknown reversal error"
              }`
            );
          }
        } else {
          await repository.markCheckoutNeedsReview(
            paymentId,
            "Captured payment could not be settled and Banquest returned no reversal reference."
          );
        }
        throw error;
      }
      await queueAndSyncCheckoutToAdmire(paymentId).catch((error) => console.error(error));
      return { paymentId, status: "sold" };
    }
    if (response.status === "Submitted") {
      await repository.markCheckoutPending(paymentId);
      return { paymentId, status: "pending" };
    }
    if (response.status === "Partially Approved") {
      const reference = response.reference_number?.toString();
      if (reference) {
        try {
          await reverseBanquestTransaction(reference);
          await repository.reverseCheckout(paymentId, "Automatically reversed partial approval");
        } catch (error) {
          await repository.markCheckoutNeedsReview(
            paymentId,
            `Partial approval requires manual reversal: ${
              error instanceof Error ? error.message : "unknown reversal error"
            }`
          );
        }
      } else {
        await repository.markCheckoutNeedsReview(
          paymentId,
          "Partial approval returned without a Banquest reference."
        );
      }
      return { paymentId, status: "pending" };
    }

    await repository.releaseCheckout(paymentId);
    throw new BanquestDeclinedError(
      "The card was not approved. Please try another card."
    );
  } finally {
    await repository.finishCheckoutAttempt(holdToken);
  }
}
