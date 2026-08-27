import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, revokeAdminSession } from "@/lib/api/admin-session";
import { withBasePath } from "@/lib/site-paths";

export async function POST(request: NextRequest): Promise<NextResponse> {
  await revokeAdminSession(request.cookies.get(ADMIN_COOKIE)?.value);
  const response = NextResponse.redirect(new URL(withBasePath("/admin/login"), request.url), 303);
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: withBasePath("/"),
    maxAge: 0,
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
