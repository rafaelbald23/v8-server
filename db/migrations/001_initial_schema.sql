-- ═══════════════════════════════════════════════════════════
-- V8 Exclusive — Schema inicial (Sprint 1)
-- Idempotente: seguro rodar múltiplas vezes
-- ═══════════════════════════════════════════════════════════

-- ── Extensões ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Usuários (Tomador / Investidor / Admin) ───────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'tomador'
                              CHECK (role IN ('tomador', 'investidor', 'admin')),
  ativo         BOOLEAN     NOT NULL DEFAULT false,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Trigger: atualiza atualizado_em automaticamente ───────────
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_atualizado_em'
  ) THEN
    CREATE TRIGGER trg_users_atualizado_em
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
  END IF;
END $$;

-- ── Consentimentos LGPD ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS consentimentos (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo       TEXT        NOT NULL,   -- ex: 'cadastro', 'analise_credito'
  aceito     BOOLEAN     NOT NULL,
  ip         TEXT,
  user_agent TEXT,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Sessões de autenticação ───────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_sessions (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Seed: admin padrão (senha trocada em produção via env) ────
-- Senha padrão: V8Admin@2025  (hash bcrypt rounds=10)
INSERT INTO users (id, name, email, password_hash, role, ativo)
VALUES (
  'admin-v8-001',
  'Admin V8',
  'admin@v8exclusive.com.br',
  '$2a$10$7QzKlV6UyBz3Xk9P2mN8OO1Kf0GzTqRvW5JxDpYwMsEhAlNCbUAy',
  'admin',
  true
) ON CONFLICT (email) DO NOTHING;
