import { randomUUID } from "node:crypto";
import type { Kibbud } from "@/contracts/types";
import type { CardPaymentPayload, CartPaymentPayload } from "@/lib/api/validation";
import {
  banquestEnvironment,
  banquestRequest,
  BanquestApiError,
  BanquestConfigurationError,
} from "@/lib/banquest/client";
import { sendOrderNotifications } from "@/lib/notifications/email";
import { getRepository } from "@/lib/storage/repository";
import { CheckoutInProgressError } from "@/lib/storage/repository";
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
    if (existing.status === "created" || existing.status === "pending") {
      if (existing.status === "created") await repository.markCheckoutPending(existing.paymentId);
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
  const record: CheckoutRecord = {
    paymentId,
    kibbudId: item.id,
    kibbudIds: items.length > 1 ? items.map((candidate) => candidate.id) : undefined,
    amounts: items.length > 1 ? trustedAmounts : undefined,
    holdToken,
    donorName: payload.donorName,
    email: payload.email,
    misheberachNames: payload.misheberachNames,
    dedicationType: payload.dedicationType,
    dedicationName: payload.dedicationName,
    dedicationMessage: payload.dedicationMessage,
    honoreeEmail: payload.honoreeEmail,
    publicRecognition: payload.publicRecognition,
    recognitionName: payload.recognitionName,
    amount,
    preferredMethod: "card",
    status: "created",
    createdAt: new Date().toISOString(),
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
      } else {
        // A timeout or gateway error is ambiguous: the charge may have reached
        // Banquest. Keep the item reserved and let webhook/reconciliation settle it.
        await repository.markCheckoutPending(paymentId);
      }
      throw error;
    }

    await repository.updateCheckoutGateway(paymentId, {
      gatewayTransactionId: response.transaction?.id?.toString(),
      gatewayReference: response.reference_number?.toString(),
    });

    if (response.status === "Approved" || response.status === "Partially Approved") {
      const orders = await repository.markCheckoutGroupSold(paymentId, "card");
      await Promise.all(
        orders.map((order) => sendOrderNotifications(order).catch((error) => console.error(error)))
      );
      return { paymentId, status: "sold" };
    }
    if (response.status === "Submitted") {
      await repository.markCheckoutPending(paymentId);
      return { paymentId, status: "pending" };
    }

    await repository.releaseCheckout(paymentId);
    throw new BanquestDeclinedError(
      response.error_message || "The card was not approved. Please try another card."
    );
  } finally {
    await repository.finishCheckoutAttempt(holdToken);
  }
}
