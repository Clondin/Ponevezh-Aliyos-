import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/api/admin-session";

export async function POST(request: Request): Promise<NextResponse> {
  const response = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
