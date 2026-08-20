import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizationCredential } from "@/lib/api/admin-credentials";

export function middleware(request: NextRequest): NextResponse {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }

  const provided = authorizationCredential(request.headers.get("authorization"));
  if (provided === expected) return NextResponse.next();

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "cache-control": "no-store",
      "www-authenticate": 'Basic realm="Ponevez Office", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};
