import type { Kibbud } from "@/contracts/types";
import { ApiError, invalidInput } from "@/lib/api/errors";
import {
  currentKibbud,
  currentOccasion,
  currentPrice,
} from "@/lib/calendar/current";

export interface SponsorPayload {
  kibbudId: string;
  donorName: string;
  email: string;
  phone?: string;
  misheberachNames: string[];
}

export interface CardPaymentPayload extends SponsorPayload {
  payment: {
    nonce: string;
    expiryMonth: number;
    expiryYear: number;
    avsZip?: string;
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    invalidInput("Request body must be valid JSON.");
  }
  if (!isRecord(value)) invalidInput("Request body must be a JSON object.");
  return value;
}

function cleanString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") invalidInput(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    invalidInput(`${field} must be between 1 and ${max} characters.`);
  }
  return cleaned;
}

export function readKibbudId(body: Record<string, unknown>): string {
  const allowed = new Set(["kibbudId"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    invalidInput("Request contains an unsupported field.");
  }
  return cleanString(body.kibbudId, "kibbudId", 160);
}

export function sponsorPayload(
  body: Record<string, unknown>,
  allowPhone: boolean
): SponsorPayload {
  const allowed = new Set([
    "kibbudId",
    "donorName",
    "email",
    "misheberachNames",
    ...(allowPhone ? ["phone"] : []),
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    invalidInput("Request contains an unsupported field.");
  }
  const kibbudId = cleanString(body.kibbudId, "kibbudId", 160);
  const donorName = cleanString(body.donorName, "donorName", 160);
  const email = cleanString(body.email, "email", 254).toLowerCase();
  if (!EMAIL.test(email)) invalidInput("email must be a valid email address.");
  if (!Array.isArray(body.misheberachNames) || body.misheberachNames.length > 20) {
    invalidInput("misheberachNames must be an array of at most 20 strings.");
  }
  const misheberachNames = body.misheberachNames
    .map((value) => cleanString(value, "misheberachNames entry", 160))
    .filter(Boolean);
  const totalNamesLength = misheberachNames.reduce((sum, value) => sum + value.length, 0);
  if (totalNamesLength > 450) {
    invalidInput("misheberachNames are too long for payment metadata.");
  }
  const phone =
    allowPhone && body.phone != null && body.phone !== ""
      ? cleanString(body.phone, "phone", 40)
      : undefined;
  return { kibbudId, donorName, email, phone, misheberachNames };
}

export function cardPaymentPayload(body: Record<string, unknown>): CardPaymentPayload {
  const allowed = new Set([
    "kibbudId",
    "donorName",
    "email",
    "misheberachNames",
    "payment",
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key)) || !isRecord(body.payment)) {
    invalidInput("Request contains an unsupported or missing payment field.");
  }
  const sponsor = sponsorPayload(
    {
      kibbudId: body.kibbudId,
      donorName: body.donorName,
      email: body.email,
      misheberachNames: body.misheberachNames,
    },
    false
  );
  const payment = body.payment;
  const paymentAllowed = new Set(["nonce", "expiryMonth", "expiryYear", "avsZip"]);
  if (Object.keys(payment).some((key) => !paymentAllowed.has(key))) {
    invalidInput("Payment contains an unsupported field.");
  }
  const nonce = cleanString(payment.nonce, "payment.nonce", 255);
  if (!/^[A-Za-z0-9_-]+$/.test(nonce)) invalidInput("payment.nonce is invalid.");
  if (
    !Number.isInteger(payment.expiryMonth) ||
    Number(payment.expiryMonth) < 1 ||
    Number(payment.expiryMonth) > 12
  ) {
    invalidInput("payment.expiryMonth is invalid.");
  }
  if (
    !Number.isInteger(payment.expiryYear) ||
    Number(payment.expiryYear) < new Date().getUTCFullYear() ||
    Number(payment.expiryYear) > 9999
  ) {
    invalidInput("payment.expiryYear is invalid.");
  }
  const avsZip =
    payment.avsZip == null || payment.avsZip === ""
      ? undefined
      : cleanString(payment.avsZip, "payment.avsZip", 50);
  return {
    ...sponsor,
    payment: {
      nonce,
      expiryMonth: Number(payment.expiryMonth),
      expiryYear: Number(payment.expiryYear),
      avsZip,
    },
  };
}

export function requireKibbud(kibbudId: string): Kibbud {
  const item = currentKibbud(kibbudId);
  if (!item) throw new ApiError("not_found", "Kibbud not found.", 404);
  return item;
}

export function assertBeforeCutoff(item: Kibbud, now = Date.now()): void {
  const occasion = currentOccasion(item.occasion);
  if (!occasion) throw new ApiError("not_found", "Occasion not found.", 404);
  if (now >= Date.parse(occasion.cutoffISO)) {
    throw new ApiError("cutoff_passed", "Sponsorship for this occasion has closed.", 410);
  }
}

export function trustedAmount(item: Kibbud): number {
  return currentPrice(item);
}
