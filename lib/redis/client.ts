import { Redis } from "@upstash/redis";
import type { RedisStore } from "@/lib/redis/types";

let store: RedisStore | undefined;

export function getRedisStore(): RedisStore {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
  }
  store = new Redis({ url, token }) as unknown as RedisStore;
  return store;
}

/** Test-only injection point; production callers use the Upstash singleton. */
export function setRedisStoreForTests(next: RedisStore | undefined): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Redis test injection is disabled in production");
  }
  store = next;
}

