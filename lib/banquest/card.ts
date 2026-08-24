import { randomUUID } from "node:crypto";
import type { Kibbud } from "@/contracts/types";
import type { CardPaymentPayload } from "@/lib/api/validation";
import {
  banquestEnvironment,
  banquestRequest,
  BanquestApiError,
  BanquestConfigurationError,
} from "@/lib/banquest/client";
import { sendOrderNotifications } from "@/lib/notifications/email";
import { getRepository } from "@/lib/storage/repository";
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
  item: Kibbud,
  payload: CardPaymentPayload,
  holdToken: string,
  trustedAmount: number
): Promise<{ paymentId: string; status: "sold" | "pending" }> {
  const repository = getRepository();
  const existing = await repository.checkoutForHold(holdToken);
  if (existing?.status === "sold" || existing?.status === "pending") {
    return { paymentId: existing.paymentId, status: existing.status };
  }

  const paymentId = `bq_${randomUUID()}`;
  const amount = amountForEnvironment(trustedAmount);
  const record: CheckoutRecord = {
    paymentId,
    kibbudId: item.id,
    holdToken,
    donorName: payload.donorName,
    email: payload.email,
    misheberachNames: payload.misheberachNames,
    amount,
    preferredMethod: "card",
    status: "created",
    createdAt: new Date().toISOString(),
  };
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
          description: `Sponsor ${item.name}`,
          invoice_number: item.id,
          order_number: paymentId,
        },
        custom_fields: {
          custom1: paymentId,
          custom2: item.id,
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
    }
    throw error;
  }

  if (response.status === "Approved" || response.status === "Partially Approved") {
    const order = await repository.markCheckoutSold(paymentId, "card");
    await sendOrderNotifications(order).catch((error) => console.error(error));
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
}
