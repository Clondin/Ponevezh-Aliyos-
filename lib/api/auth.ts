import { cookies } from "next/headers";
import { ApiError } from "@/lib/api/errors";
import { authorizationCredential } from "@/lib/api/admin-credentials";
import { ADMIN_COOKIE, adminSessionMatches, constantTimeEqual } from "@/lib/api/admin-session";

export async function requireAdmin(request: Request): Promise<void> {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) throw new Error("ADMIN_TOKEN is required");
  const apiToken = process.env.ADMIN_API_TOKEN?.trim();
  if (!apiToken && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_API_TOKEN is required in production");
  }
  const expectedApiToken = apiToken || expected;
  const authorization = authorizationCredential(request.headers.get("authorization"));
  const header = request.headers.get("x-admin-token");
  if (
    (authorization && constantTimeEqual(authorization, expectedApiToken)) ||
    (header && constantTimeEqual(header, expectedApiToken))
  ) {
    return;
  }
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!(await adminSessionMatches(cookie, expected))) {
    throw new ApiError("not_found", "Route not found.", 404);
  }
}
