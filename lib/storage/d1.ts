import type { SetOptions, StateStore } from "@/lib/storage/types";

const MAX_KEYS_PER_QUERY = 90;

function groups<T>(values: T[], size = MAX_KEYS_PER_QUERY): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function decode<T>(value: string): T {
  return JSON.parse(value) as T;
}

function encode(value: unknown): string {
  return JSON.stringify(value);
}

function placeholders(length: number): string {
  return Array.from({ length }, () => "?").join(", ");
}

function changed(result: D1Result): number {
  return Number(result.meta.changes ?? 0);
}

/** Cloudflare D1 implementation of the small state-store contract used by the app. */
export class D1StateStore implements StateStore {
  constructor(private readonly database: D1Database) {}

  async get<T>(key: string): Promise<T | null> {
    const row = await this.database
      .prepare(
        "SELECT value FROM app_kv WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)"
      )
      .bind(key, Date.now())
      .first<{ value: string }>();
    return row ? decode<T>(row.value) : null;
  }

  async mget<T extends unknown[]>(...keys: string[]): Promise<T> {
    if (!keys.length) return [] as unknown as T;
    const found = new Map<string, unknown>();
    for (const chunk of groups(keys)) {
      const result = await this.database
        .prepare(
          `SELECT key, value FROM app_kv WHERE key IN (${placeholders(
            chunk.length
          )}) AND (expires_at IS NULL OR expires_at > ?)`
        )
        .bind(...chunk, Date.now())
        .all<{ key: string; value: string }>();
      for (const row of result.results) found.set(row.key, decode(row.value));
    }
    return keys.map((key) => found.get(key) ?? null) as T;
  }

  async set<T>(
    key: string,
    value: T,
    options: SetOptions = {}
  ): Promise<"OK" | T | null> {
    const encoded = encode(value);
    const now = Date.now();
    const expiresAt = options.ex == null ? null : now + options.ex * 1000;

    if (options.nx) {
      const result = await this.database
        .prepare(
          `INSERT INTO app_kv (key, value, expires_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             expires_at = excluded.expires_at
           WHERE app_kv.expires_at IS NOT NULL AND app_kv.expires_at <= ?`
        )
        .bind(key, encoded, expiresAt, now)
        .run();
      return changed(result) > 0 ? "OK" : null;
    }

    if (options.xx) {
      const result = await this.database
        .prepare(
          `UPDATE app_kv SET value = ?, expires_at = ?
           WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)`
        )
        .bind(encoded, expiresAt, key, now)
        .run();
      return changed(result) > 0 ? "OK" : null;
    }

    await this.database
      .prepare(
        `INSERT INTO app_kv (key, value, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           expires_at = excluded.expires_at`
      )
      .bind(key, encoded, expiresAt)
      .run();
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const chunk of groups(keys)) {
      const parameters = placeholders(chunk.length);
      const results = await this.database.batch([
        this.database
          .prepare(`DELETE FROM app_kv WHERE key IN (${parameters})`)
          .bind(...chunk),
        this.database
          .prepare(`DELETE FROM app_set_members WHERE set_key IN (${parameters})`)
          .bind(...chunk),
      ]);
      removed += results.reduce((total, result) => total + changed(result), 0);
    }
    return removed;
  }

  async sadd<T>(key: string, ...members: T[]): Promise<number> {
    if (!members.length) return 0;
    const results = await this.database.batch(
      members.map((member) =>
        this.database
          .prepare(
            "INSERT INTO app_set_members (set_key, member) VALUES (?, ?) ON CONFLICT DO NOTHING"
          )
          .bind(key, encode(member))
      )
    );
    return results.reduce((total, result) => total + changed(result), 0);
  }

  async srem<T>(key: string, ...members: T[]): Promise<number> {
    if (!members.length) return 0;
    const results = await this.database.batch(
      members.map((member) =>
        this.database
          .prepare("DELETE FROM app_set_members WHERE set_key = ? AND member = ?")
          .bind(key, encode(member))
      )
    );
    return results.reduce((total, result) => total + changed(result), 0);
  }

  async smembers<T extends unknown[] = string[]>(key: string): Promise<T> {
    const result = await this.database
      .prepare("SELECT member FROM app_set_members WHERE set_key = ? ORDER BY member")
      .bind(key)
      .all<{ member: string }>();
    return result.results.map((row) => decode(row.member)) as T;
  }
}
