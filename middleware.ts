import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminSessionMatches } from "@/lib/api/admin-session";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }

  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();
  const session = request.cookies.get(ADMIN_COOKIE)?.value;
  if (await adminSessionMatches(session, expected)) return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl, 307);
}

export const config = {
  matcher: ["/admin/:path*"],
};
