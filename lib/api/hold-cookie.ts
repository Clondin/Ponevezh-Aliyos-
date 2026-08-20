export const HOLD_COOKIE = "kibbud-hold";

interface HoldCookieValue {
  kibbudId: string;
  token: string;
}

export function encodeHoldCookie(value: HoldCookieValue): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeHoldCookie(raw: string | undefined): HoldCookieValue | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    if (
      !value ||
      typeof value !== "object" ||
      typeof (value as HoldCookieValue).kibbudId !== "string" ||
      typeof (value as HoldCookieValue).token !== "string"
    ) {
      return null;
    }
    return value as HoldCookieValue;
  } catch {
    return null;
  }
}

