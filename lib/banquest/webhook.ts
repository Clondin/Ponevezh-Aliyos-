import { createHmac, timingSafeEqual } from "node:crypto";

type PaymentMethod = "card" | "ach" | "unknown";

export interface BanquestWebhookEvent {
  id: string;
  event: string;
  type: string;
  subType?: string;
  paymentId?: string;
  method: PaymentMethod;
  status?: string;
  amount?: number;
  transactionId?: string;
  referenceNumber?: string;
  cardType?: string;
  cardLastFour?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function identifierValue(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return stringValue(value);
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function transactionFrom(data: Record<string, unknown>): Record<string, unknown> {
  return isRecord(data.transaction) ? data.transaction : data;
}

export function parseBanquestWebhook(rawBody: string): BanquestWebhookEvent {
  let value: unknown;
  try {
    value = JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error("Webhook body is not valid JSON");
  }
  if (!isRecord(value) || !isRecord(value.data)) {
    throw new Error("Webhook body is missing event data");
  }
  const id = stringValue(value.id);
  const event = stringValue(value.event);
  const type = stringValue(value.type);
  if (!id || !event || !type) throw new Error("Webhook body is missing event fields");

  const transaction = transactionFrom(value.data);
  const details = isRecord(transaction.transaction_details)
    ? transaction.transaction_details
    : undefined;
  const customFields = isRecord(transaction.custom_fields)
    ? transaction.custom_fields
    : undefined;
  const statusDetails = isRecord(transaction.status_details)
    ? transaction.status_details
    : undefined;
  const amountDetails = isRecord(transaction.amount_details)
    ? transaction.amount_details
    : undefined;
  const method: PaymentMethod = isRecord(transaction.check_details)
    ? "ach"
    : isRecord(transaction.card_details) || typeof value.data.card_type === "string"
      ? "card"
      : "unknown";
  const cardDetails = isRecord(transaction.card_details)
    ? transaction.card_details
    : undefined;

  return {
    id,
    event,
    type,
    subType: stringValue(value.subType),
    paymentId: stringValue(customFields?.custom1) ?? stringValue(details?.key),
    method,
    status: stringValue(statusDetails?.status) ??
      (type === "status" ? stringValue(value.subType) : undefined),
    amount: numberValue(amountDetails?.amount),
    transactionId: identifierValue(transaction.id),
    referenceNumber: identifierValue(value.data.reference_number),
    cardType: stringValue(cardDetails?.card_type) ?? stringValue(value.data.card_type),
    cardLastFour:
      stringValue(cardDetails?.last4) ??
      stringValue(cardDetails?.last_four) ??
      stringValue(value.data.last_four),
  };
}

export function verifyBanquestSignature(
  rawBody: string,
  providedSignature: string | null,
  signatureKey = process.env.BANQUEST_WEBHOOK_SIGNATURE
): boolean {
  if (!providedSignature || !signatureKey) return false;
  const expected = createHmac("sha256", signatureKey).update(rawBody).digest("hex");
  const provided = providedSignature.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(provided)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
}
