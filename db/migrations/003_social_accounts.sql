-- ═══════════════════════════════════════════════════════════
-- V8 Exclusive — Social accounts (Sprint 1 / V8-T-04)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS social_accounts (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT        NOT NULL CHECK (provider IN ('google', 'facebook', 'apple')),
  provider_id TEXT        NOT NULL,
  avatar_url  TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_id)
);

CREATE INDEX IF NOT EXISTS social_accounts_user_idx ON social_accounts (user_id);
