import { ApiError } from "@/lib/api/errors";

interface SiteverifyResponse {
  success?: boolean;
  action?: string;
  "error-codes"?: string[];
}

export function turnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
}

export async function verifyTurnstile(
  request: Request,
  token: string | null | undefined,
  expectedAction: string
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return;
  if (!turnstileSiteKey()) {
    throw new Error("NEXT_PUBLIC_TURNSTILE_SITE_KEY is required with TURNSTILE_SECRET_KEY");
  }
  if (!token) {
    throw new ApiError("invalid_input", "Please complete the security check.", 400);
  }

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  const remoteIp = request.headers.get("cf-connecting-ip")?.trim();
  if (remoteIp) form.set("remoteip", remoteIp);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  const result = (await response.json().catch(() => null)) as SiteverifyResponse | null;
  if (!response.ok || !result?.success || (result.action && result.action !== expectedAction)) {
    throw new ApiError(
      "invalid_input",
      "The security check expired or could not be verified. Please try again.",
      400
    );
  }
}
