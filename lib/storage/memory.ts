import type { AtomicWrite, SetOptions, StateStore } from "@/lib/storage/types";

type Entry = { value: unknown; expiresAt?: number };

/** Minimal state-store semantics for deterministic transition tests. */
export class MemoryStateStore implements StateStore {
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
      expiresAt: options.ex == null ? undefined : Date.now() + options.ex * 1000,
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

  async atomic(write: AtomicWrite): Promise<boolean> {
    for (const condition of write.conditions ?? []) {
      const entry = this.entry(condition.key);
      if (condition.exists === true && !entry) return false;
      if (condition.exists === false && entry) return false;
      if (
        Object.prototype.hasOwnProperty.call(condition, "equals") &&
        (!entry || JSON.stringify(entry.value) !== JSON.stringify(condition.equals))
      ) {
        return false;
      }
    }
    for (const operation of write.sets ?? []) {
      if (operation.nx && this.entry(operation.key)) return false;
    }

    const now = Date.now();
    for (const operation of write.sets ?? []) {
      this.values.set(operation.key, {
        value: structuredClone(operation.value),
        expiresAt: operation.ex == null ? undefined : now + operation.ex * 1000,
      });
    }
    for (const key of write.deletes ?? []) {
      this.values.delete(key);
      this.sets.delete(key);
    }
    for (const operation of write.setAdds ?? []) {
      const set = this.sets.get(operation.key) ?? new Set<unknown>();
      for (const member of operation.members) set.add(structuredClone(member));
      this.sets.set(operation.key, set);
    }
    for (const operation of write.setRemoves ?? []) {
      const set = this.sets.get(operation.key);
      if (!set) continue;
      for (const member of operation.members) set.delete(member);
    }
    return true;
  }

  async increment(key: string, seconds: number): Promise<number> {
    const current = this.entry(key);
    const next = typeof current?.value === "number" ? current.value + 1 : 1;
    this.values.set(key, {
      value: next,
      expiresAt: Date.now() + seconds * 1000,
    });
    return next;
  }

  async purgeExpired(limit = 500): Promise<number> {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.values) {
      if (removed >= limit) break;
      if (entry.expiresAt != null && entry.expiresAt <= now) {
        this.values.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}
