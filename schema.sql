-- 현장ON D1 schema (one site per deployment)

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  login_id     TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name         TEXT NOT NULL,
  org          TEXT NOT NULL DEFAULT '',
  title        TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL CHECK (role IN ('admin','user')),
  pw_hash      TEXT NOT NULL,
  pw_salt      TEXT NOT NULL,
  must_change  INTEGER NOT NULL DEFAULT 1,
  active       INTEGER NOT NULL DEFAULT 1,
  sig_blob     TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS login_fail (
  login_id     TEXT PRIMARY KEY COLLATE NOCASE,
  count        INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0
);

-- Every record type (workers, equipment, violations, alcohol, vuln, settings)
-- is stored as a JSON document. Deletes are soft so other devices can sync them.
CREATE TABLE IF NOT EXISTS docs (
  store        TEXT NOT NULL,
  id           TEXT NOT NULL,
  data         TEXT NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  created_by   TEXT,
  updated_by   TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (store, id)
);
CREATE INDEX IF NOT EXISTS docs_updated ON docs(updated_at);

-- Photos and signatures, split out of documents (D1 rows are limited to 2 MB)
CREATE TABLE IF NOT EXISTS blobs (
  id           TEXT PRIMARY KEY,
  mime         TEXT NOT NULL,
  data         BLOB NOT NULL,
  created_by   TEXT,
  created_at   INTEGER NOT NULL
);
