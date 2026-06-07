# Build context: repo root (Railway usa o root do repo como contexto)
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.0.0
WORKDIR /app

# Instala dependências (build)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
RUN pnpm install --frozen-lockfile --ignore-scripts

# Build
FROM deps AS builder
COPY . .
# Gera o Prisma client
RUN pnpm --filter @inkhub/database generate
# Builda a API
RUN pnpm --filter @inkhub/api build

# Runner de produção: reinstala deps isoladas para evitar problemas de symlink do pnpm
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Workspace files para instalar deps de produção
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/

# Instala apenas deps de produção (sem devDeps)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copia o build e o Prisma schema
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

# Gera Prisma client no runner (já com as deps certas)
RUN pnpm --filter @inkhub/database generate

RUN mkdir -p uploads auth_sessions

EXPOSE 3000
CMD ["node", "dist/main.js"]
