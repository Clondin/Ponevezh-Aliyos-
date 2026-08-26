import type { Kibbud } from "@/contracts/types";
import { ApiError, invalidInput } from "@/lib/api/errors";
import {
  currentKibbud,
  currentOccasion,
  currentPrice,
} from "@/lib/calendar/current";
import { waveOpensAt } from "@/lib/calendar/sales";

export interface SponsorPayload {
  kibbudId: string;
  donorName: string;
  email: string;
  phone?: string;
  misheberachNames: string[];
  dedicationType?: "honor" | "memory";
  dedicationName?: string;
  dedicationMessage?: string;
  honoreeEmail?: string;
  publicRecognition?: boolean;
  recognitionName?: string;
  assignmentAccepted: true;
}

export interface CardPaymentPayload extends SponsorPayload {
  payment: {
    nonce: string;
    expiryMonth: number;
    expiryYear: number;
    avsZip?: string;
  };
}

export interface CartPaymentPayload extends Omit<CardPaymentPayload, "kibbudId"> {
  kibbudIds: string[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_LABELS: Record<string, string> = {
  kibbudId: "Kibbud",
  donorName: "Name",
  email: "Email",
  phone: "Phone",
  "misheberachNames entry": "Mi Shebeirach name",
  dedicationName: "Dedication name",
  dedicationMessage: "Dedication message",
  honoreeEmail: "Notification email",
  recognitionName: "Display name",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    invalidInput("Please refresh and try again.");
  }
  if (!isRecord(value)) invalidInput("Please refresh and try again.");
  return value;
}

function cleanString(value: unknown, field: string, max: number): string {
  const label = FIELD_LABELS[field] ?? "This field";
  if (typeof value !== "string") invalidInput(`${label} is required.`);
  const cleaned = value.trim();
  if (!cleaned) invalidInput(`${label} is required.`);
  if (cleaned.length > max) invalidInput(`${label} is too long.`);
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
    "dedicationType",
    "dedicationName",
    "dedicationMessage",
    "honoreeEmail",
    "publicRecognition",
    "recognitionName",
    "assignmentAccepted",
    ...(allowPhone ? ["phone"] : []),
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    invalidInput("Request contains an unsupported field.");
  }
  const kibbudId = cleanString(body.kibbudId, "kibbudId", 160);
  const donorName = cleanString(body.donorName, "donorName", 160);
  const email = cleanString(body.email, "email", 254).toLowerCase();
  if (!EMAIL.test(email)) invalidInput("Enter a valid email address.");
  if (!Array.isArray(body.misheberachNames) || body.misheberachNames.length > 20) {
    invalidInput("Add no more than 20 Mi Shebeirach names.");
  }
  const misheberachNames = body.misheberachNames
    .map((value) => cleanString(value, "misheberachNames entry", 160))
    .filter(Boolean);
  const totalNamesLength = misheberachNames.reduce((sum, value) => sum + value.length, 0);
  if (totalNamesLength > 450) {
    invalidInput("The Mi Shebeirach names are too long. Please shorten them.");
  }
  const phone =
    allowPhone && body.phone != null && body.phone !== ""
      ? cleanString(body.phone, "phone", 40)
      : undefined;
  const dedicationType =
    body.dedicationType === "honor" || body.dedicationType === "memory"
      ? body.dedicationType
      : undefined;
  if (body.dedicationType != null && body.dedicationType !== "" && !dedicationType) {
    invalidInput("Choose In honor of or In memory of.");
  }
  const dedicationName =
    dedicationType && body.dedicationName != null
      ? cleanString(body.dedicationName, "dedicationName", 160)
      : undefined;
  if (dedicationType && !dedicationName) {
    invalidInput("Add a name for the dedication.");
  }
  const dedicationMessage =
    body.dedicationMessage == null || body.dedicationMessage === ""
      ? undefined
      : cleanString(body.dedicationMessage, "dedicationMessage", 500);
  const honoreeEmail =
    body.honoreeEmail == null || body.honoreeEmail === ""
      ? undefined
      : cleanString(body.honoreeEmail, "honoreeEmail", 254).toLowerCase();
  if (honoreeEmail && !EMAIL.test(honoreeEmail)) {
    invalidInput("Enter a valid notification email.");
  }
  if (body.publicRecognition != null && typeof body.publicRecognition !== "boolean") {
    invalidInput("publicRecognition must be true or false.");
  }
  const publicRecognition = body.publicRecognition === true;
  const recognitionName = publicRecognition
    ? cleanString(body.recognitionName ?? donorName, "recognitionName", 160)
    : undefined;
  if (body.assignmentAccepted !== true) {
    invalidInput("You must acknowledge the aliyah assignment terms.");
  }
  return {
    kibbudId,
    donorName,
    email,
    phone,
    misheberachNames,
    dedicationType,
    dedicationName,
    dedicationMessage,
    honoreeEmail,
    publicRecognition,
    recognitionName,
    assignmentAccepted: true,
  };
}

export function cardPaymentPayload(body: Record<string, unknown>): CardPaymentPayload {
  const allowed = new Set([
    "kibbudId",
    "donorName",
    "email",
    "misheberachNames",
    "dedicationType",
    "dedicationName",
    "dedicationMessage",
    "honoreeEmail",
    "publicRecognition",
    "recognitionName",
    "assignmentAccepted",
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
      dedicationType: body.dedicationType,
      dedicationName: body.dedicationName,
      dedicationMessage: body.dedicationMessage,
      honoreeEmail: body.honoreeEmail,
      publicRecognition: body.publicRecognition,
      recognitionName: body.recognitionName,
      assignmentAccepted: body.assignmentAccepted,
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

export function cartPaymentPayload(body: Record<string, unknown>): CartPaymentPayload {
  const allowed = new Set([
    "kibbudIds", "donorName", "email", "misheberachNames", "payment",
    "dedicationType", "dedicationName", "dedicationMessage", "honoreeEmail",
    "publicRecognition", "recognitionName", "assignmentAccepted",
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key)) || !Array.isArray(body.kibbudIds)) {
    invalidInput("Request contains an unsupported or missing kibbudIds field.");
  }
  if (body.kibbudIds.length < 2 || body.kibbudIds.length > 10) {
    invalidInput("A combined sponsorship must contain between 2 and 10 kibbudim.");
  }
  const kibbudIds = body.kibbudIds.map((value) => cleanString(value, "kibbudIds entry", 160));
  if (new Set(kibbudIds).size !== kibbudIds.length) invalidInput("kibbudIds contains a duplicate.");
  const parsed = cardPaymentPayload({
    kibbudId: kibbudIds[0],
    donorName: body.donorName,
    email: body.email,
    misheberachNames: body.misheberachNames,
    payment: body.payment,
    dedicationType: body.dedicationType,
    dedicationName: body.dedicationName,
    dedicationMessage: body.dedicationMessage,
    honoreeEmail: body.honoreeEmail,
    publicRecognition: body.publicRecognition,
    recognitionName: body.recognitionName,
    assignmentAccepted: body.assignmentAccepted,
  });
  const { kibbudId: _ignored, ...rest } = parsed;
  return { ...rest, kibbudIds };
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

export function assertSaleOpen(item: Kibbud, now = Date.now()): void {
  const occasion = currentOccasion(item.occasion);
  if (!occasion) throw new ApiError("not_found", "Occasion not found.", 404);
  const opensAt = waveOpensAt(occasion.wave);
  if (now < Date.parse(opensAt)) {
    throw new ApiError(
      "cutoff_passed",
      `This sponsorship wave opens ${new Date(opensAt).toLocaleString("en-US", {
        timeZone: "America/New_York",
        dateStyle: "long",
        timeStyle: "short",
      })} Eastern Time.`,
      425
    );
  }
  assertBeforeCutoff(item, now);
}

export function trustedAmount(item: Kibbud): number {
  return currentPrice(item);
}
