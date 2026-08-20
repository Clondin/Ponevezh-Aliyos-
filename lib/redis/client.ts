import { Redis } from "@upstash/redis";
import { MemoryRedisStore } from "@/lib/redis/memory";
import type { RedisStore } from "@/lib/redis/types";

let injectedStore: RedisStore | undefined;

const processStores = globalThis as typeof globalThis & {
  __ponevezRedisStore?: RedisStore;
};

export function getRedisStore(): RedisStore {
  if (injectedStore) return injectedStore;
  if (processStores.__ponevezRedisStore) return processStores.__ponevezRedisStore;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_IN_MEMORY_REDIS !== "true"
    ) {
      throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
    }
    console.warn("Using temporary in-memory state because Upstash Redis is not configured");
    processStores.__ponevezRedisStore = new MemoryRedisStore();
    return processStores.__ponevezRedisStore;
  }
  processStores.__ponevezRedisStore = new Redis({ url, token }) as unknown as RedisStore;
  return processStores.__ponevezRedisStore;
}

/** Test-only injection point; production callers use the Upstash singleton. */
export function setRedisStoreForTests(next: RedisStore | undefined): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Redis test injection is disabled in production");
  }
  injectedStore = next;
}
