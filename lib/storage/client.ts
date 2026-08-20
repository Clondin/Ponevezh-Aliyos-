import { getCloudflareContext } from "@opennextjs/cloudflare";
import { D1StateStore } from "@/lib/storage/d1";
import { MemoryStateStore } from "@/lib/storage/memory";
import type { StateStore } from "@/lib/storage/types";

let injectedStore: StateStore | undefined;
let developmentStore: StateStore | undefined;

export function getStateStore(): StateStore {
  if (injectedStore) return injectedStore;
  try {
    const database = getCloudflareContext().env.DB;
    if (!database) throw new Error("The Cloudflare D1 binding named DB is missing");
    return new D1StateStore(database);
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    developmentStore ??= new MemoryStateStore();
    console.warn("Using temporary in-memory state because the local D1 binding is unavailable");
    return developmentStore;
  }
}

/** Test-only injection point; deployed callers always use Cloudflare D1. */
export function setStateStoreForTests(next: StateStore | undefined): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("State-store test injection is disabled in production");
  }
  injectedStore = next;
}
