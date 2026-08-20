CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS app_kv_expires_at_idx
  ON app_kv (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS app_set_members (
  set_key TEXT NOT NULL,
  member TEXT NOT NULL,
  PRIMARY KEY (set_key, member)
);

CREATE INDEX IF NOT EXISTS app_set_members_set_key_idx
  ON app_set_members (set_key);
