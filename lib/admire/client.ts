import { currentKibbud, currentMinyan, currentOccasion } from "@/lib/calendar/current";
import type { BanquestWebhookEvent } from "@/lib/banquest/webhook";
import { getRepository } from "@/lib/storage/repository";
import type { CheckoutRecord } from "@/lib/storage/types";

const ADMIRE_BASE_URL = "https://services.admirepro.app/api/Webhooks";

type FetchLike = typeof fetch;

let testFetch: FetchLike | undefined;

export class AdmireApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export type AdmireSyncResult = "synced" | "already_synced" | "not_configured";

interface AdmireImportResponse {
  externalRecordID?: string | null;
  transactionID?: string | null;
  warnings?: Array<{ propertyName?: string | null; error?: string | null }> | null;
}

function apiKey(): string | undefined {
  return process.env.ADMIRE_DONATION_FEED_API_KEY?.trim() || undefined;
}

export function admireSyncConfigured(): boolean {
  return Boolean(apiKey());
}

function paymentItemIds(checkout: CheckoutRecord): string[] {
  return checkout.kibbudIds?.length ? checkout.kibbudIds : [checkout.kibbudId];
}

function donorNames(donorName: string): { firstName?: string; lastName: string } {
  const normalized = donorName.trim().replace(/\s+/g, " ");
  const parts = normalized.split(" ");
  if (parts.length < 2) return { lastName: normalized.slice(0, 50) };
  return {
    firstName: parts.slice(0, -1).join(" ").slice(0, 100),
    lastName: parts.at(-1)!.slice(0, 50),
  };
}

function paymentNote(checkout: CheckoutRecord): string {
  const labels = paymentItemIds(checkout).map((id) => {
    const item = currentKibbud(id);
    if (!item) return id;
    const minyan = currentMinyan(item.minyan);
    const occasion = currentOccasion(item.occasion);
    return [item.name, occasion?.shortName, minyan?.name].filter(Boolean).join(" · ");
  });
  return `High Holidays sponsorship: ${labels.join("; ")}`.slice(0, 250);
}

function admireCardType(value: string | undefined): string {
  switch (value?.trim().toLowerCase()) {
    case "visa":
      return "Visa";
    case "mastercard":
    case "master card":
    case "mc":
      return "Mastercard";
    case "amex":
    case "american express":
      return "Amex";
    case "discover":
      return "Discover";
    case "diners club":
    case "dinersclub":
      return "DinersClub";
    default:
      return "Unknown";
  }
}

function errorMessage(value: unknown): string {
  if (!value || typeof value !== "object") return "Admire rejected the donation import.";
  const record = value as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  return "Admire rejected the donation import.";
}

async function admireRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = apiKey();
  if (!key) throw new AdmireApiError(0, "ADMIRE_DONATION_FEED_API_KEY is required");
  const response = await (testFetch ?? fetch)(`${ADMIRE_BASE_URL}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": key,
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new AdmireApiError(response.status, errorMessage(body));
  return body as T;
}

export async function testAdmireAuthentication(): Promise<void> {
  await admireRequest<unknown>("/testAuth");
}

/**
 * Sends an already-billed Banquest payment into Admire's Automatic Donation Feed.
 * The local completion marker prevents a direct webhook replay from importing it twice.
 */
export async function syncBanquestCheckoutToAdmire(
  checkout: CheckoutRecord,
  event: BanquestWebhookEvent
): Promise<AdmireSyncResult> {
  if (!admireSyncConfigured()) return "not_configured";

  const repository = getRepository();
  const claim = await repository.beginAdmireSync(checkout.paymentId);
  if (claim === "done") return "already_synced";
  if (claim === "busy") {
    throw new Error("Admire donation sync is already in progress.");
  }

  const names = donorNames(checkout.donorName);
  try {
    const result = await admireRequest<AdmireImportResponse>("/externalDonation", {
      method: "POST",
      body: JSON.stringify({
        ...names,
        cellPhone: checkout.phone || null,
        email: checkout.email,
        date: new Date().toISOString(),
        payment: {
          amount: checkout.amount,
          paymentMethod: { name: "Credit Card", id: null },
          creditCard: {
            cardType: admireCardType(event.cardType),
            lastFourDigits: event.cardLastFour || null,
            token: null,
            tokenGateway: "Banquest",
          },
          authCode: null,
          refNumber: checkout.gatewayReference || event.referenceNumber || null,
          processorBatchID: null,
          note: paymentNote(checkout),
        },
        pledge: {},
        externalRecordID: checkout.paymentId,
      }),
    });
    await repository.finishAdmireSync(checkout.paymentId, result.transactionID ?? undefined);
    return "synced";
  } catch (error) {
    await repository.failAdmireSync(checkout.paymentId);
    throw error;
  }
}

/** Test-only transport injection. Production always uses the platform fetch. */
export function setAdmireFetchForTests(next: FetchLike | undefined): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Admire test injection is disabled in production");
  }
  testFetch = next;
}
