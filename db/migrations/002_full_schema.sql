-- ═══════════════════════════════════════════════════════════
-- V8 Exclusive — Schema completo (Sprint 1 / V8-T-02)
-- Idempotente: seguro rodar múltiplas vezes
-- ═══════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Função utilitária: atualiza atualizado_em ─────────────────
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 1. USERS — Tomador / Investidor / Admin
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name            TEXT        NOT NULL,
  email           TEXT        NOT NULL UNIQUE,
  password_hash   TEXT        NOT NULL,
  role            TEXT        NOT NULL DEFAULT 'tomador'
                                CHECK (role IN ('tomador','investidor','admin')),
  -- tomador: false até pagar a taxa de cadastro
  -- investidor/admin: true desde o cadastro
  ativo           BOOLEAN     NOT NULL DEFAULT false,
  -- status do onboarding
  status          TEXT        NOT NULL DEFAULT 'pendente'
                                CHECK (status IN ('pendente','ativo','suspenso','bloqueado')),
  avatar_url      TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (LOWER(email));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_atualizado_em') THEN
    CREATE TRIGGER trg_users_atualizado_em
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. PERFIL DO TOMADOR
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tomador_perfil (
  id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id             TEXT        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Dados pessoais / empresariais
  cpf_cnpj            TEXT,
  tipo_pessoa         TEXT        CHECK (tipo_pessoa IN ('pf','pj')),
  data_nascimento     DATE,
  telefone            TEXT,
  whatsapp            TEXT,

  -- Endereço
  cep                 TEXT,
  logradouro          TEXT,
  numero              TEXT,
  complemento         TEXT,
  bairro              TEXT,
  cidade              TEXT,
  estado              CHAR(2),

  -- Dados profissionais
  profissao           TEXT,
  empresa_empregadora TEXT,
  renda_declarada     NUMERIC(12,2),
  tempo_emprego_meses INTEGER,

  -- Finalidade do crédito (preenchida na solicitação)
  finalidade_credito  TEXT,

  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tomador_perfil_atualizado_em') THEN
    CREATE TRIGGER trg_tomador_perfil_atualizado_em
    BEFORE UPDATE ON tomador_perfil
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3. CONTATOS E REFERÊNCIAS DO TOMADOR
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tomador_contatos (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo        TEXT        NOT NULL CHECK (tipo IN ('familiar','referencia_pessoal','referencia_comercial')),
  nome        TEXT        NOT NULL,
  telefone    TEXT,
  whatsapp    TEXT,
  relacao     TEXT,          -- ex: "mãe", "amigo", "sócio"
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 4. DOCUMENTOS DO TOMADOR
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tomador_documentos (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo          TEXT        NOT NULL
                              CHECK (tipo IN (
                                'rg_frente','rg_verso','cnh_frente','cnh_verso',
                                'cpf','cnpj','comprovante_residencia',
                                'comprovante_renda','extrato_bancario','outros'
                              )),
  url           TEXT        NOT NULL,   -- path no storage
  nome_arquivo  TEXT,
  tamanho_bytes INTEGER,
  mime_type     TEXT,
  status        TEXT        NOT NULL DEFAULT 'pendente'
                              CHECK (status IN ('pendente','aprovado','rejeitado')),
  rejeitado_motivo TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 5. PERFIL DO INVESTIDOR
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investidor_perfil (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id         TEXT        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  cpf_cnpj        TEXT,
  tipo_pessoa     TEXT        CHECK (tipo_pessoa IN ('pf','pj')),
  telefone        TEXT,
  whatsapp        TEXT,
  cep             TEXT,
  cidade          TEXT,
  estado          CHAR(2),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_investidor_perfil_atualizado_em') THEN
    CREATE TRIGGER trg_investidor_perfil_atualizado_em
    BEFORE UPDATE ON investidor_perfil
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 6. CONSENTIMENTOS LGPD
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consentimentos (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo        TEXT        NOT NULL
                            CHECK (tipo IN (
                              'cadastro','analise_credito','open_finance',
                              'comunicacao','compartilhamento_dados'
                            )),
  aceito      BOOLEAN     NOT NULL,
  versao      TEXT        NOT NULL DEFAULT '1.0',
  ip          TEXT,
  user_agent  TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 7. CATÁLOGO DE SERVIÇOS (parametrizado — sem valor hardcoded)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS servicos (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  codigo      TEXT        NOT NULL UNIQUE,  -- ex: 'TAXA_CADASTRO', 'ANALISE_DETALHADA'
  nome        TEXT        NOT NULL,
  descricao   TEXT,
  valor       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_servicos_atualizado_em') THEN
    CREATE TRIGGER trg_servicos_atualizado_em
    BEFORE UPDATE ON servicos
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 8. COBRANÇAS (payment_orders)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_orders (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id         TEXT        NOT NULL REFERENCES users(id),
  servico_id      TEXT        NOT NULL REFERENCES servicos(id),
  valor           NUMERIC(10,2) NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pendente'
                                CHECK (status IN ('pendente','pago','expirado','cancelado','estornado')),
  gateway         TEXT,                   -- ex: 'asaas', 'mercadopago'
  gateway_id      TEXT,                   -- ID da cobrança no gateway
  pix_qr_code     TEXT,                   -- QR Code base64 ou string
  pix_copia_cola  TEXT,
  expires_at      TIMESTAMPTZ,
  pago_em         TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_orders_atualizado_em') THEN
    CREATE TRIGGER trg_payment_orders_atualizado_em
    BEFORE UPDATE ON payment_orders
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 9. SOLICITAÇÕES DE CRÉDITO
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitacoes (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tomador_id        TEXT        NOT NULL REFERENCES users(id),
  valor_solicitado  NUMERIC(12,2) NOT NULL,
  prazo_meses       INTEGER     NOT NULL,
  finalidade        TEXT,
  status            TEXT        NOT NULL DEFAULT 'aguardando_analise'
                                  CHECK (status IN (
                                    'aguardando_analise','em_analise','aprovada',
                                    'recusada','aguardando_contrato',
                                    'contrato_assinado','desembolsada','cancelada'
                                  )),
  investidor_id     TEXT        REFERENCES users(id),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_solicitacoes_atualizado_em') THEN
    CREATE TRIGGER trg_solicitacoes_atualizado_em
    BEFORE UPDATE ON solicitacoes
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 10. CONTRATOS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contratos (
  id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  solicitacao_id   TEXT        NOT NULL UNIQUE REFERENCES solicitacoes(id),
  tomador_id       TEXT        NOT NULL REFERENCES users(id),
  investidor_id    TEXT        NOT NULL REFERENCES users(id),
  valor            NUMERIC(12,2) NOT NULL,
  taxa_juros_mes   NUMERIC(6,4) NOT NULL,   -- ex: 0.0350 = 3,50% a.m.
  prazo_meses      INTEGER     NOT NULL,
  taxa_v8          NUMERIC(6,4) NOT NULL DEFAULT 0,  -- % da V8 sobre o empréstimo
  status           TEXT        NOT NULL DEFAULT 'pendente'
                                 CHECK (status IN ('pendente','assinado','ativo','quitado','inadimplente','cancelado')),
  url_documento    TEXT,
  assinado_em      TIMESTAMPTZ,
  desembolsado_em  TIMESTAMPTZ,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_contratos_atualizado_em') THEN
    CREATE TRIGGER trg_contratos_atualizado_em
    BEFORE UPDATE ON contratos
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 11. PARCELAS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcelas (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  contrato_id     TEXT        NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  numero          INTEGER     NOT NULL,
  valor           NUMERIC(12,2) NOT NULL,
  vencimento      DATE        NOT NULL,
  pago_em         DATE,
  valor_pago      NUMERIC(12,2),
  status          TEXT        NOT NULL DEFAULT 'aberta'
                                CHECK (status IN ('aberta','paga','atrasada','renegociada')),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS parcelas_contrato_idx  ON parcelas (contrato_id);
CREATE INDEX IF NOT EXISTS parcelas_vencimento_idx ON parcelas (vencimento);

-- ────────────────────────────────────────────────────────────
-- 12. LEDGER FINANCEIRO (3 fluxos separados)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tipo            TEXT        NOT NULL
                                CHECK (tipo IN (
                                  'receita_taxa',      -- taxa paga pelo tomador/investidor à V8
                                  'desembolso',        -- dinheiro enviado ao tomador
                                  'recebimento'        -- parcela recebida
                                )),
  referencia_id   TEXT,       -- payment_order_id | contrato_id | parcela_id
  referencia_tipo TEXT,       -- 'payment_order' | 'contrato' | 'parcela'
  valor           NUMERIC(12,2) NOT NULL,
  descricao       TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 13. CUSTOS DE ANÁLISE (cost center por solicitação)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analise_custos (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  solicitacao_id  TEXT        NOT NULL REFERENCES solicitacoes(id) ON DELETE CASCADE,
  tipo            TEXT        NOT NULL
                                CHECK (tipo IN ('open_finance','serasa','ocr','ia','armazenamento','outros')),
  valor           NUMERIC(10,4) NOT NULL DEFAULT 0,
  descricao       TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 14. AGENDA DE COBRANÇA DO INVESTIDOR
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agenda_cobranca (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  investidor_id   TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tomador_id      TEXT        NOT NULL REFERENCES users(id),
  contrato_id     TEXT        REFERENCES contratos(id),
  data_contato    DATE        NOT NULL,
  tipo            TEXT        NOT NULL DEFAULT 'cobranca'
                                CHECK (tipo IN ('cobranca','follow_up','negociacao','outro')),
  canal           TEXT        CHECK (canal IN ('whatsapp','telefone','email','presencial')),
  notas           TEXT,
  concluido       BOOLEAN     NOT NULL DEFAULT false,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_agenda_cobranca_atualizado_em') THEN
    CREATE TRIGGER trg_agenda_cobranca_atualizado_em
    BEFORE UPDATE ON agenda_cobranca
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 15. AUTOMAÇÕES DE MENSAGEM
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automacoes (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  nome            TEXT        NOT NULL,
  gatilho         TEXT        NOT NULL
                                CHECK (gatilho IN ('parcela_vencida','parcela_vence_hoje','parcela_vence_amanha','contrato_encerrado')),
  canal           TEXT        NOT NULL DEFAULT 'whatsapp'
                                CHECK (canal IN ('whatsapp','email','sms')),
  template        TEXT        NOT NULL,   -- mensagem com variáveis ex: {{nome}}, {{valor}}
  ativo           BOOLEAN     NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_automacoes_atualizado_em') THEN
    CREATE TRIGGER trg_automacoes_atualizado_em
    BEFORE UPDATE ON automacoes
    FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 16. LOG DE AUTOMAÇÕES DISPARADAS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automacoes_log (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  automacao_id  TEXT        NOT NULL REFERENCES automacoes(id),
  user_id       TEXT        NOT NULL REFERENCES users(id),
  contrato_id   TEXT        REFERENCES contratos(id),
  status        TEXT        NOT NULL CHECK (status IN ('enviado','falhou')),
  erro          TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 17. TRILHA DE AUDITORIA
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id       TEXT        REFERENCES users(id),
  acao          TEXT        NOT NULL,   -- ex: 'DECISAO_APROVACAO', 'STATUS_ALTERADO'
  tabela        TEXT,
  registro_id   TEXT,
  detalhe       JSONB,
  ip            TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_user_idx     ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_tabela_idx   ON audit_log (tabela, registro_id);

-- ────────────────────────────────────────────────────────────
-- SEED — Serviços iniciais (valores configuráveis pelo admin)
-- ────────────────────────────────────────────────────────────
INSERT INTO servicos (codigo, nome, descricao, valor) VALUES
  ('TAXA_CADASTRO',     'Taxa de cadastro',          'Paga pelo tomador para ativar o acesso à plataforma.',  0.00),
  ('ANALISE_DETALHADA', 'Análise detalhada',          'Paga pelo investidor para ver o dossiê completo do tomador.', 2.00),
  ('REANALISE',         'Reanálise de solicitação',  'Nova análise após atualização de documentos.',          0.00)
ON CONFLICT (codigo) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SEED — Admin padrão
-- ────────────────────────────────────────────────────────────
-- Senha: V8Admin@2025  (bcrypt rounds=10)
INSERT INTO users (id, name, email, password_hash, role, ativo, status)
VALUES (
  'admin-v8-001',
  'Admin V8',
  'admin@v8exclusive.com.br',
  '$2a$10$7QzKlV6UyBz3Xk9P2mN8OO1Kf0GzTqRvW5JxDpYwMsEhAlNCbUAy',
  'admin',
  true,
  'ativo'
) ON CONFLICT (email) DO NOTHING;
