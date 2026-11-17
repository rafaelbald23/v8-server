# v8-server

API REST da plataforma V8 Exclusive — Express + PostgreSQL.

## Stack
- Node.js 20 + Express 5
- PostgreSQL (Railway)
- JWT + bcryptjs
- ESLint (eslint:recommended)

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```
DATABASE_URL=postgresql://...
JWT_SECRET=...
NODE_ENV=development
PORT=3000
```

## Rodando local

```bash
npm install
npm run dev
```

## Branches
- `main` → produção (deploy automático Railway)
- `develop` → integração (CI lint)
- `feature/*` → PR para develop
