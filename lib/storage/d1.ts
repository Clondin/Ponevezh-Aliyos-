import type { AtomicWrite, SetOptions, StateStore } from "@/lib/storage/types";

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
    const chunks = groups(keys);
    const results = await this.database.batch(
      chunks.map((chunk) =>
        this.database.prepare(
          `SELECT key, value FROM app_kv WHERE key IN (${placeholders(
            chunk.length
          )}) AND (expires_at IS NULL OR expires_at > ?)`
        )
        .bind(...chunk, Date.now())
      )
    );
    for (const result of results) {
      for (const row of result.results as Array<{ key: string; value: string }>) {
        found.set(row.key, decode(row.value));
      }
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

  async atomic(write: AtomicWrite): Promise<boolean> {
    const guardKey = `atomic:${crypto.randomUUID()}`;
    const now = Date.now();
    const conditions: string[] = [];
    const conditionValues: unknown[] = [];

    for (const condition of write.conditions ?? []) {
      const active = "(expires_at IS NULL OR expires_at > ?)";
      const hasEquals = Object.prototype.hasOwnProperty.call(condition, "equals");
      if (condition.exists === false) {
        conditions.push(`NOT EXISTS (SELECT 1 FROM app_kv WHERE key = ? AND ${active})`);
        conditionValues.push(condition.key, now);
      } else if (hasEquals) {
        conditions.push(
          `EXISTS (SELECT 1 FROM app_kv WHERE key = ? AND ${active} AND value = ?)`
        );
        conditionValues.push(condition.key, now, encode(condition.equals));
      } else {
        conditions.push(`EXISTS (SELECT 1 FROM app_kv WHERE key = ? AND ${active})`);
        conditionValues.push(condition.key, now);
      }
    }

    const guardSql = conditions.length
      ? `INSERT INTO app_kv (key, value, expires_at)
         SELECT ?, ?, ? WHERE ${conditions.join(" AND ")}`
      : "INSERT INTO app_kv (key, value, expires_at) VALUES (?, ?, ?)";
    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(guardSql)
        .bind(guardKey, encode("guard"), now + 60_000, ...conditionValues),
    ];
    const guardExists = "EXISTS (SELECT 1 FROM app_kv WHERE key = ?)";

    for (const operation of write.sets ?? []) {
      const expiresAt = operation.ex == null ? null : now + operation.ex * 1000;
      if (operation.nx) {
        statements.push(
          this.database
            .prepare(
              `DELETE FROM app_kv
               WHERE key = ? AND expires_at IS NOT NULL AND expires_at <= ?
                 AND ${guardExists}`
            )
            .bind(operation.key, now, guardKey),
          this.database
            .prepare(
              `INSERT INTO app_kv (key, value, expires_at)
               SELECT ?, ?, ? WHERE ${guardExists}`
            )
            .bind(operation.key, encode(operation.value), expiresAt, guardKey)
        );
      } else {
        statements.push(
          this.database
            .prepare(
              `INSERT INTO app_kv (key, value, expires_at)
               SELECT ?, ?, ? WHERE ${guardExists}
               ON CONFLICT(key) DO UPDATE SET
                 value = excluded.value,
                 expires_at = excluded.expires_at`
            )
            .bind(operation.key, encode(operation.value), expiresAt, guardKey)
        );
      }
    }

    for (const key of write.deletes ?? []) {
      statements.push(
        this.database
          .prepare(`DELETE FROM app_kv WHERE key = ? AND ${guardExists}`)
          .bind(key, guardKey),
        this.database
          .prepare(`DELETE FROM app_set_members WHERE set_key = ? AND ${guardExists}`)
          .bind(key, guardKey)
      );
    }
    for (const operation of write.setAdds ?? []) {
      for (const member of operation.members) {
        statements.push(
          this.database
            .prepare(
              `INSERT INTO app_set_members (set_key, member)
               SELECT ?, ? WHERE ${guardExists}
               ON CONFLICT DO NOTHING`
            )
            .bind(operation.key, encode(member), guardKey)
        );
      }
    }
    for (const operation of write.setRemoves ?? []) {
      for (const member of operation.members) {
        statements.push(
          this.database
            .prepare(
              `DELETE FROM app_set_members
               WHERE set_key = ? AND member = ? AND ${guardExists}`
            )
            .bind(operation.key, encode(member), guardKey)
        );
      }
    }
    statements.push(
      this.database.prepare("DELETE FROM app_kv WHERE key = ?").bind(guardKey)
    );

    try {
      const results = await this.database.batch(statements);
      return changed(results[0]) > 0;
    } catch (error) {
      if (error instanceof Error && /unique|constraint/i.test(error.message)) return false;
      throw error;
    }
  }

  async increment(key: string, seconds: number): Promise<number> {
    const now = Date.now();
    const expiresAt = now + seconds * 1000;
    const row = await this.database
      .prepare(
        `INSERT INTO app_kv (key, value, expires_at) VALUES (?, '1', ?)
         ON CONFLICT(key) DO UPDATE SET
           value = CASE
             WHEN app_kv.expires_at IS NOT NULL AND app_kv.expires_at > ?
               THEN CAST(CAST(app_kv.value AS INTEGER) + 1 AS TEXT)
             ELSE '1'
           END,
           expires_at = CASE
             WHEN app_kv.expires_at IS NOT NULL AND app_kv.expires_at > ?
               THEN app_kv.expires_at
             ELSE excluded.expires_at
           END
         RETURNING value`
      )
      .bind(key, expiresAt, now, now)
      .first<{ value: string }>();
    return Number(row?.value ?? 1);
  }

  async purgeExpired(limit = 500): Promise<number> {
    const result = await this.database
      .prepare(
        `DELETE FROM app_kv WHERE key IN (
           SELECT key FROM app_kv
           WHERE expires_at IS NOT NULL AND expires_at <= ?
           LIMIT ?
         )`
      )
      .bind(Date.now(), Math.max(1, Math.min(limit, 5000)))
      .run();
    return changed(result);
  }
}
