# Build context: repo root (Railway usa o root do repo como contexto)
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.0.0
WORKDIR /app

# Instala dependências
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
RUN pnpm install --frozen-lockfile --ignore-scripts

# Build
FROM deps AS builder
COPY . .
# Gera o Prisma client (produz binários para linux-musl/Alpine)
RUN pnpm --filter @inkhub/database generate
# Remove cache incremental do TypeScript para forçar rebuild completo
RUN find /app -name "*.tsbuildinfo" -delete
# Builda a API
RUN pnpm --filter @inkhub/api build

# Runner de produção
FROM node:20-alpine AS runner
# openssl é necessário para o Prisma detectar corretamente OpenSSL 3.x
# e carregar o binário linux-musl-openssl-3.0.x em vez do 1.1
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9.0.0
WORKDIR /app
ENV NODE_ENV=production

# Copia workspace manifests (necessário para o pnpm entender a estrutura)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/

# Instala prod deps com hoisting para evitar problemas de symlink do pnpm no Docker
# --shamefully-hoist: todos os pacotes vão para root node_modules (como npm), sem symlinks
RUN pnpm install --frozen-lockfile --prod --shamefully-hoist

# Copia o build compilado
COPY --from=builder /app/apps/api/dist ./dist

# Copia o Prisma schema (para migrations em runtime)
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

# Gera o Prisma client para o ambiente de produção (Alpine linux-musl)
RUN pnpm --filter @inkhub/database generate

RUN mkdir -p uploads auth_sessions

EXPOSE 3000
# Roda migrations antes de iniciar o app (prisma disponível via shamefully-hoist)
CMD ["sh", "-c", "node_modules/.bin/prisma migrate resolve --rolled-back 20260608000000_init --schema packages/database/prisma/schema.prisma 2>/dev/null; node_modules/.bin/prisma migrate deploy --schema packages/database/prisma/schema.prisma && node dist/main.js"]
