# Volut PIBI

Sistema de gestão de escalas, ministérios, repertório e integração com Holyrics para a Primeira Igreja Batista de Itapuã. Inspirado no app Voluts.

## Funcionalidades

- 📅 **Escalas inteligentes** — sugestão por revezamento justo, detecção de conflitos e indisponibilidades, aceite/recusa/troca, aviso via WhatsApp (wa.me)
- 👥 **Ministérios** — Louvor, Mídia, Som, Transmissão, Recepção, Kids, Diaconia com funções e RBAC (Admin, Líder, Voluntário, Membro)
- 🎵 **Estante musical** — catálogo com cifras, transposição de tom automática, setlist por culto
- 📜 **Liturgia** — roteiro do culto com timeline, responsáveis e referências bíblicas
- 💬 **Chat por evento** — substitui o grupo de WhatsApp do culto
- 📽️ **Holyrics** — importação de músicas, envio de setlist, projeção remota de versículos/contagem/textos, controle de slides
- 🏆 **Gamificação** — pontos, badges automáticos, ranking, check-in por QR/manual
- 📱 **PWA** — instalável no celular, notificações em tempo real via WebSocket

## Rodando localmente

```bash
# Na raiz do monorepo
cp server/.env.example server/.env
npm install
npm run prisma:generate -w server

# Suba um PostgreSQL local antes (ex.: docker compose up -d postgres)
npx prisma migrate deploy --schema server/prisma/schema.prisma
npm run seed -w server
npm run dev:server      # http://localhost:3333

# Frontend (outro terminal, ainda na raiz)
npm run dev:client      # http://localhost:5173
```

Se preferir subir os serviços auxiliares por contêiner:

```bash
docker compose up -d postgres waha
```

> O backend atual usa **PostgreSQL** tanto localmente quanto em produção.

Login do seed: `admin@pibi.org.br` / `pibi2026` · voluntários: `joao|maria|pedro@pibi.org.br` / `volutis123`

## Testes

```bash
# Na raiz do monorepo, com PostgreSQL rodando e `server/.env` configurado
npm run test -w server
npm run test:flows -w server
npm run test:all -w server
```

Testes avulsos úteis:

```bash
npx tsx server/src/tests/smoke-phase2.ts     # Fase 2 — escalas
npx tsx server/src/tests/smoke-phase4.ts     # Fase 4 — repertório/liturgia/chat
npx tsx server/src/tests/smoke-phase5.ts     # Fase 5 — Holyrics (mock)
npx tsx server/src/tests/smoke-phase6.ts     # Fase 6 — badges/painel do líder
```

## Deploy

Ver [DEPLOY.md](./DEPLOY.md) — Vercel (frontend) + Northflank/Railway/Render (backend) + PostgreSQL.

## Prisma e banco existente

Se o banco PostgreSQL já existe e contém dados reais, siga `server/prisma/BASELINE_POSTGRES.md` antes de depender de `prisma migrate deploy` em produção.

## Stack

React 19 · Vite 6 · Tailwind 4 · Zustand | Node 22 · Fastify 5 · Prisma 6 · Zod | PostgreSQL | JWT + refresh rotativo | WebSocket
