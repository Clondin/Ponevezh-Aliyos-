import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminSessionMatches } from "@/lib/api/admin-session";

function contentSecurityPolicy(nonce: string): string {
  const scriptEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${scriptEval} https://challenges.cloudflare.com https://static.cloudflareinsights.com https://tokenization.banquestgateway.com https://tokenization.sandbox.banquestgateway.com`,
    "connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com https://tokenization.banquestgateway.com https://tokenization.sandbox.banquestgateway.com",
    "frame-src https://challenges.cloudflare.com https://tokenization.banquestgateway.com https://tokenization.sandbox.banquestgateway.com",
    "upgrade-insecure-requests",
  ].join("; ");
}

function secured(response: NextResponse, policy: string): NextResponse {
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const nonce = btoa(crypto.randomUUID());
  const policy = contentSecurityPolicy(nonce);
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.toLowerCase();
  const hostname = request.nextUrl.hostname.toLowerCase();
  if (forwardedProtocol === "http" || hostname === "www.ponevez.com") {
    const canonical = request.nextUrl.clone();
    canonical.protocol = "https:";
    if (hostname === "www.ponevez.com") canonical.hostname = "ponevez.com";
    return secured(NextResponse.redirect(canonical, 308), policy);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return secured(
      NextResponse.next({ request: { headers: requestHeaders } }),
      policy
    );
  }
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return secured(new NextResponse("Not found", {
      status: 404,
      headers: { "cache-control": "no-store" },
    }), policy);
  }

  if (request.nextUrl.pathname === "/admin/login") {
    return secured(
      NextResponse.next({ request: { headers: requestHeaders } }),
      policy
    );
  }
  const session = request.cookies.get(ADMIN_COOKIE)?.value;
  if (await adminSessionMatches(session, expected)) {
    return secured(
      NextResponse.next({ request: { headers: requestHeaders } }),
      policy
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = "";
  return secured(NextResponse.redirect(loginUrl, 307), policy);
}

export const config = {
  matcher: ["/:path*"],
};
