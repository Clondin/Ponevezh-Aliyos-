const SANDBOX_BASE_URL = "https://api.sandbox.banquestgateway.com/api/v2";
const PRODUCTION_BASE_URL = "https://api.banquestgateway.com/api/v2";

type FetchLike = typeof fetch;

let testFetch: FetchLike | undefined;

export class BanquestConfigurationError extends Error {}

export class BanquestApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new BanquestConfigurationError(`${name} is required`);
  return value;
}

export function banquestEnvironment(): "sandbox" | "production" {
  const value = process.env.BANQUEST_ENV?.trim().toLowerCase() || "sandbox";
  if (value !== "sandbox" && value !== "production") {
    throw new BanquestConfigurationError(
      "BANQUEST_ENV must be either sandbox or production"
    );
  }
  return value;
}

export function banquestBaseUrl(): string {
  return banquestEnvironment() === "production"
    ? PRODUCTION_BASE_URL
    : SANDBOX_BASE_URL;
}

function messageFrom(value: unknown): string {
  if (!value || typeof value !== "object") return "Banquest rejected the request.";
  const record = value as Record<string, unknown>;
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }
  if (Array.isArray(record.messages)) {
    const messages = record.messages.filter(
      (item): item is string => typeof item === "string" && Boolean(item.trim())
    );
    if (messages.length) return messages.join(" ");
  }
  return "Banquest rejected the request.";
}

export async function banquestRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const sourceKey = required("BANQUEST_SOURCE_KEY");
  const pin = required("BANQUEST_PIN");
  const authorization = Buffer.from(`${sourceKey}:${pin}`, "utf8").toString("base64");
  const response = await (testFetch ?? fetch)(`${banquestBaseUrl()}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Basic ${authorization}`,
      "content-type": "application/json",
      "user-agent": "Ponevez-Kibbudim/0.1",
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new BanquestApiError(response.status, messageFrom(body));
  }
  return body as T;
}

/** Test-only transport injection. Production always uses the platform fetch. */
export function setBanquestFetchForTests(next: FetchLike | undefined): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Banquest test injection is disabled in production");
  }
  testFetch = next;
}
