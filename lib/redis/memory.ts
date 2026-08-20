import type { RedisStore, SetOptions } from "@/lib/redis/types";

type Entry = { value: unknown; expiresAt?: number };

/** Minimal Redis semantics for deterministic transition tests. */
export class MemoryRedisStore implements RedisStore {
  private readonly values = new Map<string, Entry>();
  private readonly sets = new Map<string, Set<unknown>>();

  private entry(key: string): Entry | undefined {
    const current = this.values.get(key);
    if (current?.expiresAt != null && current.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return current;
  }

  async get<T>(key: string): Promise<T | null> {
    return (this.entry(key)?.value as T | undefined) ?? null;
  }

  async mget<T extends unknown[]>(...keys: string[]): Promise<T> {
    const result = keys.map((key) => this.entry(key)?.value ?? null);
    return result as T;
  }

  async set<T>(
    key: string,
    value: T,
    options: SetOptions = {}
  ): Promise<"OK" | T | null> {
    const existing = this.entry(key);
    if (options.nx && existing) return null;
    if (options.xx && !existing) return null;
    this.values.set(key, {
      value: structuredClone(value),
      expiresAt: options.ex ? Date.now() + options.ex * 1000 : undefined,
    });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.values.delete(key)) removed += 1;
      if (this.sets.delete(key)) removed += 1;
    }
    return removed;
  }

  async sadd<T>(key: string, ...members: T[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<unknown>();
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added += 1;
      }
    }
    this.sets.set(key, set);
    return added;
  }

  async srem<T>(key: string, ...members: T[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) removed += 1;
    }
    return removed;
  }

  async smembers<T extends unknown[] = string[]>(key: string): Promise<T> {
    return Array.from(this.sets.get(key) ?? []) as T;
  }
}

