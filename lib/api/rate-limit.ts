import { createHash } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import { getStateStore } from "@/lib/storage/client";
import { keys } from "@/lib/storage/keys";

interface Counter {
  count: number;
}

function requestIdentity(request: Request): string {
  const raw =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    "local";
  return createHash("sha256").update(raw.trim()).digest("hex").slice(0, 20);
}

export async function enforceRateLimit(
  request: Request,
  action: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const store = getStateStore();
  const key = keys.rateLimit(action, requestIdentity(request), bucket);
  const current = await store.get<Counter>(key);
  if ((current?.count ?? 0) >= limit) {
    throw new ApiError(
      "invalid_input",
      "Too many attempts. Please wait a few minutes and try again.",
      429
    );
  }
  await store.set(key, { count: (current?.count ?? 0) + 1 }, { ex: windowSeconds + 5 });
}
