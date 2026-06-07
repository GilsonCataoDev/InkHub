# InkHub — ERP Multi-Tenant para Estúdios de Tatuagem

SaaS completo para estúdios que operam cafeteria e loja de materiais no mesmo espaço.

## Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Docker + Docker Compose)
- [Node.js 20+](https://nodejs.org/)
- [pnpm 9+](https://pnpm.io/) — `npm i -g pnpm`

## Setup em 3 comandos

```bash
# 1. Subir infraestrutura (Postgres, Redis, Adminer)
docker compose up postgres redis adminer -d

# 2. Instalar dependências e gerar cliente Prisma
pnpm install && pnpm db:generate && pnpm db:migrate:deploy

# 3. Popular banco com dados de demonstração
pnpm db:seed
```

Depois rode o projeto em modo desenvolvimento:

```bash
# Terminal 1 — API NestJS
cd apps/api && pnpm dev

# Terminal 2 — Frontend Next.js
cd apps/web && pnpm dev
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste se necessário:

```bash
cp .env.example .env
```

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | postgres local | Connection string PostgreSQL |
| `REDIS_URL` | redis local | Connection string Redis |
| `JWT_SECRET` | — | **Obrigatório mudar em produção** |
| `JWT_REFRESH_SECRET` | — | **Obrigatório mudar em produção** |
| `GOOGLE_CLIENT_ID` | — | OAuth Google (opcional no MVP) |
| `SMTP_HOST` | mailtrap | SMTP para e-mails (opcional) |

## URLs dos serviços

| Serviço | URL |
|---|---|
| **Frontend** | http://localhost:3000 |
| **API / NestJS** | http://localhost:3001 |
| **Swagger / Docs** | http://localhost:3001/api/docs |
| **Adminer (DB)** | http://localhost:8080 |

> Adminer: servidor `postgres`, usuário `inkhub`, senha `inkhub_secret`, banco `inkhub`

## Credenciais do seed

| Role | E-mail | Senha | Subdomínio |
|---|---|---|---|
| **Admin** | admin@demo-studio.com | admin123 | demo-studio |
| **Tatuador** | rafael@demo-studio.com | artist123 | demo-studio |
| **Barista** | barista@demo-studio.com | barista123 | demo-studio |
| **Recepção** | recepcao@demo-studio.com | recepcao123 | demo-studio |

## Deploy com Docker Compose (produção)

```bash
# Gere os secrets e preencha o .env
docker compose up -d

# Rodar migrations e seed na primeira vez
docker compose exec api npx prisma migrate deploy
docker compose exec api node -e "require('./dist/prisma/seed')"
```

## Estrutura do monorepo

```
InkHub/
├── apps/
│   ├── api/           NestJS 10 — API REST + Swagger
│   └── web/           Next.js 15 — App Router
├── packages/
│   └── database/      Schema Prisma + migrations + seed
├── docker-compose.yml
└── .env.example
```

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Zustand, React Query |
| Backend | NestJS, TypeScript, Swagger, JWT + OAuth Google |
| Banco | PostgreSQL 16, Prisma ORM |
| Cache | Redis |
| Testes | Jest, Supertest |
| Infra | Docker Compose |

## Módulos implementados

- **Dashboard** — receita (dia/semana/mês), agendamentos do dia, ranking de tatuadores, receita por fonte
- **Clientes** — CRUD, galeria de fotos, programa de fidelidade, consentimento, anamnese
- **Agenda** — calendário semanal, lista com filtros, máquina de estados de status
- **Tatuadores** — perfil, metas mensais, comissões, performance
- **Cafeteria** — cardápio, mesas, comandas, fechamento com baixa de estoque
- **Loja** — produtos, categorias, fornecedores, movimentações de estoque
- **Financeiro** — fluxo de caixa, contas a pagar/receber, DRE mensal
- **CRM** — aniversariantes, clientes inativos, campanhas, timeline de interações
- **RBAC** — 6 roles com permissões granulares por módulo

## Executar testes

```bash
# Testes unitários
cd apps/api && pnpm test

# Testes e2e (requer Postgres rodando)
cd apps/api && pnpm test:e2e
```

> Os testes e2e criam e destroem dados de tenant isolados; não afetam dados de produção/seed.

## Novos módulos (v2)

| Módulo | Rota API | Página |
|---|---|---|
| Usuários | `GET/POST/PUT /users` | `/settings` |
| Config tenant | `GET/PUT /tenants/me` | `/settings` |
| Consentimento PDF | `POST /clients/:id/consent/sign` | Botão em `/clients/:id` |
| Exportação CSV | `GET /financial/export/csv` | Botão em `/financial` |
| Exportação PDF DRE | `GET /financial/export/pdf` | Botão em `/financial` |
| Novo tatuador | — | `/tattoo-artists/new` |
| Novo produto | — | `/store/products/new` |

## Resolução de tenant

O backend aceita tenant por duas formas (em ordem de prioridade):

1. **Header** `X-Tenant-ID: <uuid>` — usado pelo frontend SPA
2. **Subdomínio** `studio1.inkhub.app` — resolve automaticamente via middleware
