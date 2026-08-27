export const HOLD_COOKIE = "kibbud-hold";

interface HoldCookieValue {
  kibbudId: string;
  kibbudIds?: string[];
  token: string;
}

export function encodeHoldCookie(value: HoldCookieValue): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeHoldCookie(raw: string | undefined): HoldCookieValue | null {
  // This cookie is only a pointer. Every server action verifies its unguessable
  // hold token against D1 before granting access or changing inventory.
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
    if (
      (value as HoldCookieValue).kibbudIds != null &&
      (!Array.isArray((value as HoldCookieValue).kibbudIds) ||
        !(value as HoldCookieValue).kibbudIds!.every((item) => typeof item === "string"))
    ) return null;
    return value as HoldCookieValue;
  } catch {
    return null;
  }
}

export function holdCookieFromRequest(request: Request): HoldCookieValue | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === HOLD_COOKIE) return decodeHoldCookie(rest.join("="));
  }
  return null;
}
