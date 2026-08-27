import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  createAdminSession,
  passwordMatches,
} from "@/lib/api/admin-session";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { verifyTurnstile } from "@/lib/api/turnstile";
import { withBasePath } from "@/lib/site-paths";

function loginRedirect(request: NextRequest, failed = false): NextResponse {
  const url = new URL(withBasePath("/admin/login"), request.url);
  if (failed) url.searchParams.set("error", "1");
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return new NextResponse("Not found", { status: 404 });

  const form = await request.formData();
  try {
    await enforceRateLimit(request, "admin-login", 8, 15 * 60);
    await verifyTurnstile(
      request,
      typeof form.get("cf-turnstile-response") === "string"
        ? String(form.get("cf-turnstile-response"))
        : null,
      "admin_login"
    );
  } catch {
    const url = new URL(withBasePath("/admin/login"), request.url);
    url.searchParams.set("error", "security");
    return NextResponse.redirect(url, 303);
  }
  const password = form.get("password");
  if (typeof password !== "string" || !passwordMatches(password, expected)) {
    return loginRedirect(request, true);
  }

  const response = NextResponse.redirect(new URL(withBasePath("/admin"), request.url), 303);
  response.cookies.set(ADMIN_COOKIE, await createAdminSession(expected), {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: withBasePath("/"),
    maxAge: ADMIN_SESSION_SECONDS,
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
