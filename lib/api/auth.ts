import { cookies } from "next/headers";
import { ApiError } from "@/lib/api/errors";
import { authorizationCredential } from "@/lib/api/admin-credentials";

const ADMIN_COOKIE = "admin-token";

export async function requireAdmin(request: Request): Promise<void> {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) throw new Error("ADMIN_TOKEN is required");
  const authorization = authorizationCredential(request.headers.get("authorization"));
  const header = request.headers.get("x-admin-token");
  if (authorization === expected || header === expected) return;
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (cookie !== expected) {
    throw new ApiError("not_found", "Route not found.", 404);
  }
}
