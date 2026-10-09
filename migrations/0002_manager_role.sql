-- Add the 'manager' (관리자) role. SQLite cannot alter a CHECK constraint,
-- so users is rebuilt. sessions references users, so it is parked in a
-- plain copy first and restored afterwards (nobody gets logged out).
CREATE TABLE sessions_keep AS SELECT * FROM sessions;
DROP TABLE sessions;
CREATE TABLE users_new (
  id           TEXT PRIMARY KEY,
  login_id     TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name         TEXT NOT NULL,
  org          TEXT NOT NULL DEFAULT '',
  title        TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL CHECK (role IN ('admin','manager','user')),
  pw_hash      TEXT NOT NULL,
  pw_salt      TEXT NOT NULL,
  must_change  INTEGER NOT NULL DEFAULT 1,
  active       INTEGER NOT NULL DEFAULT 1,
  sig_blob     TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
INSERT INTO users_new (id,login_id,name,org,title,role,pw_hash,pw_salt,must_change,active,sig_blob,created_at,updated_at)
  SELECT id,login_id,name,org,title,role,pw_hash,pw_salt,must_change,active,sig_blob,created_at,updated_at FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
INSERT INTO sessions (token_hash,user_id,expires_at,created_at) SELECT token_hash,user_id,expires_at,created_at FROM sessions_keep;
DROP TABLE sessions_keep;
