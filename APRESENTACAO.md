# InkHub — ERP Completo para Estúdios de Tatuagem

> **A plataforma SaaS que transforma a gestão do seu estúdio em uma operação profissional, lucrativa e escalável.**

---

## O Problema

Estúdios de tatuagem faturam bem, mas perdem dinheiro onde não enxergam:

- Agendamentos anotados em papel ou WhatsApp particular → clientes sem retorno, sessões perdidas
- Comissões calculadas na mão → erros, desentendimentos com tatuadores
- Sem controle de estoque → tintas e insumos sumindo sem rastreio
- Financeiro no Excel → sem visão real de lucro, DRE impossível
- Portfólio espalhado no Instagram → sem captação ativa de novos clientes
- Lembretes de retorno feitos manualmente → horas perdidas no celular

**InkHub resolve tudo isso em um único painel, acessível de qualquer dispositivo.**

---

## O que é o InkHub

InkHub é um **ERP SaaS multi-tenant** desenvolvido especificamente para estúdios de tatuagem e estúdios híbridos (tattoo + café, tattoo + loja). Cada estúdio opera em um ambiente completamente isolado, com seus próprios dados, usuários e configurações.

Acesso via navegador — **sem instalação, sem servidor próprio, sem manutenção**.

---

## Módulos e Funcionalidades

### 🗓 Agenda & Agendamentos
- Calendário visual com status em tempo real (Pendente → Confirmado → Em Sessão → Concluído)
- Cadastro completo por sessão: tatuador, cliente, estilo, valor, depósito, data de toque
- Visão semanal por tatuador
- Histórico completo de sessões por cliente

### 👤 Clientes
- Ficha completa: nome, e-mail, telefone, CPF, data de nascimento, notas internas
- Histórico de agendamentos, pagamentos e interações
- Anamnese digital (registro de saúde e contraindicações)
- Galeria de fotos por cliente
- Programa de fidelidade com pontos e transações

### 💰 Checkout & Pagamentos
- Cálculo automático de comissão por tatuador (percentual ou fixo por tipo de serviço)
- Desconto, gorjeta e abatimento de depósito
- Múltiplos métodos: Pix, cartão de crédito/débito, dinheiro, transferência
- Dedução automática de estoque no ato do checkout
- Registro de pontos de fidelidade

### 📊 Financeiro
- Fluxo de caixa com entradas e saídas detalhadas
- Contas a pagar e a receber (vencimento, pagamento, status)
- **DRE (Demonstrativo de Resultado)** — receita bruta, descontos, comissões, custos, lucro líquido
- Dashboard com gráfico de receita dos últimos 30 dias
- Exportação em **CSV e PDF**

### 📦 Estoque & Loja
- Cadastro de produtos com categoria, fornecedor, preço de custo e venda
- Controle de estoque mínimo com alerta de reposição
- Movimentações: compra, venda, uso interno, ajuste, perda, devolução
- Histórico completo de movimentações por produto

### ☕ Café / Bar (módulo opcional)
- Cardápio digital por categoria
- Gestão de mesas com status em tempo real
- Abertura e fechamento de comandas
- Integração com estoque de insumos

### 🎨 Portfólio Público
- Página pública por estúdio (`seudominio.inkhub.app`)
- Filtros por estilo e tatuador
- Cada item com imagem, descrição, placement e tags
- SEO nativo (Open Graph, metadados por item)
- Ativação/desativação por item, destaque de favoritos

### 📝 Briefing / Formulário de Captação
- Link público único por estúdio
- Cliente preenche: estilo, placement, tamanho, orçamento, referências, se é primeira tatuagem
- Upload de imagens de referência
- Gestão interna: Novo → Contatado → Convertido / Arquivado
- Estatísticas de conversão

### 📱 WhatsApp Integration
**Opção 1 — Baileys (QR Code):**
- Conecta o WhatsApp existente do estúdio via QR code
- Sem custo de API
- Resposta automática a confirmações (SIM/NÃO) de agendamentos

**Opção 2 — Evolution API:**
- API de produção com webhook seguro (HMAC SHA-256)
- Ideal para volume alto de mensagens

**Automações:**
- Disparo automático por evento: agendamento criado, data de retorno, aniversário, cliente inativo
- Canal: WhatsApp ou e-mail (SMTP configurável)
- Templates personalizáveis com variáveis dinâmicas

### 🤝 CRM
- Timeline de interações por cliente
- Campanhas de reativação (clientes inativos > N dias)
- Lista de aniversariantes do mês
- Ranking de maiores clientes por valor gasto

### 📋 Consentimento LGPD
- Termo de consentimento digital com assinatura por IP e user-agent
- Histórico de consentimentos por cliente
- Export e esquecimento de dados conforme Lei 13.709/18

---

## Gestão de Usuários e Equipe

| Perfil | Acesso |
|---|---|
| **Admin** | Tudo — configurações, financeiro, usuários, relatórios |
| **Manager** | Operação completa, sem gestão de usuários |
| **Tatuador** | Agenda própria, portfólio, checkout das próprias sessões |
| **Recepcionista** | Agenda, clientes, checkout, briefings |
| **Barista** | Módulo café |
| **Estoquista** | Estoque e loja |

Múltiplos usuários simultâneos, sem limite por plano (configurável).

---

## Segurança (Nível Corporativo)

InkHub foi desenvolvido com padrões **OWASP Top 10** aplicados:

- ✅ **Autenticação por cookies httpOnly** — tokens nunca expostos em JavaScript
- ✅ **MFA TOTP** — segundo fator obrigatório para Admin/Manager (Google Authenticator)
- ✅ **Refresh token rotation** — detecção automática de roubo de sessão
- ✅ **Isolamento total por tenant** — impossível acessar dados de outro estúdio
- ✅ **Rate limiting** — proteção contra força bruta em login e registro
- ✅ **HMAC em webhooks** — webhooks validados criptograficamente
- ✅ **Upload seguro** — validação de MIME type, limite de 5 MB, sanitização de nome
- ✅ **Audit log completo** — todas as ações sensíveis registradas com IP e user-agent
- ✅ **LGPD** — endpoint de esquecimento e exportação de dados

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Backend | NestJS (Node.js) + TypeScript |
| Frontend | Next.js 15 (React 19) + Tailwind CSS |
| Banco de dados | PostgreSQL + Prisma ORM |
| Autenticação | JWT + OAuth Google + MFA TOTP |
| WhatsApp | Baileys (QR) + Evolution API |
| Monorepo | pnpm workspaces + Turborepo |
| Containerização | Docker + Docker Compose |

---

## Diferenciais Competitivos

| InkHub | Sistemas genéricos | Planilha/papel |
|---|---|---|
| Feito para tatuagem | ❌ Adaptado | ❌ Manual |
| Comissão automática | ❌ Manual | ❌ Manual |
| WhatsApp nativo | ❌ Extra pago | ❌ Não tem |
| Portfólio público | ❌ Não tem | ❌ Não tem |
| MFA + Audit log | ❌ Básico | ❌ Não tem |
| Multi-estúdio | ❌ Plano separado | ❌ Não tem |
| Open source ready | ✅ | ❌ |

---

## Modelo de Negócio (Sugestão)

| Plano | Público | Preço sugerido |
|---|---|---|
| **Free** | Até 3 usuários, 100 clientes | Gratuito |
| **Pro** | Usuários ilimitados, todos os módulos | R$ 197/mês |
| **Enterprise** | Multi-unidade, SLA, suporte dedicado | R$ 497/mês |

> Preços são referência — o licenciante define a tabela final.

---

## Implantação

### Self-hosted (Docker)
```bash
git clone https://github.com/GilsonCataoDev/InkHub
cp .env.example .env   # configure as variáveis
docker compose up -d
```
Banco de dados, API e frontend sobem com **um único comando**.

### Cloud (recomendado para SaaS)
- API: Railway / Render / VPS
- Frontend: Vercel / Netlify
- DB: Supabase / Neon / PlanetScale

---

## Variáveis de Ambiente Necessárias

```env
DATABASE_URL=            # PostgreSQL
JWT_SECRET=              # Mínimo 32 caracteres
JWT_REFRESH_SECRET=      # Mínimo 32 caracteres
MFA_ENCRYPTION_KEY=      # Mínimo 32 caracteres (para TOTP)
SMTP_HOST / SMTP_USER    # E-mail para automações
GOOGLE_CLIENT_ID         # OAuth Google (opcional)
EVOLUTION_WEBHOOK_SECRET # Webhook WhatsApp (opcional)
```

---

## Roadmap

- [ ] App mobile (React Native) para tatuadores
- [ ] Integração com Mercado Pago / Stripe para cobrança de sinal online
- [ ] Agendamento online pelo cliente (link público)
- [ ] Relatório de rentabilidade por tatuador
- [ ] Notificações push (PWA)
- [ ] Módulo de franchise / multi-unidade com consolidação

---

## Contato

**Repositório:** [github.com/GilsonCataoDev/InkHub](https://github.com/GilsonCataoDev/InkHub)

---

*InkHub — Gestão profissional para estúdios que levam o negócio a sério.*
