# Volutis PIBI

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
# Backend
cd server
cp .env.example .env
npm install
npx prisma migrate dev
npm run seed
npm run dev        # http://localhost:3333

# Frontend (outro terminal)
cd client
npm install
npm run dev        # http://localhost:5173 (proxy /api e /ws p/ :3333)
```

Login do seed: `admin@pibi.org.br` / `pibi2026` · voluntários: `joao|maria|pedro@pibi.org.br` / `volutis123`

## Testes

```bash
cd server
npm test                              # Fase 1 — fundação
npx tsx src/tests/smoke-phase2.ts     # Fase 2 — escalas
npx tsx src/tests/smoke-phase4.ts     # Fase 4 — repertório/liturgia/chat
npx tsx src/tests/smoke-phase5.ts     # Fase 5 — Holyrics (mock)
npx tsx src/tests/smoke-phase6.ts     # Fase 6 — badges/painel do líder
```

## Deploy

Ver [DEPLOY.md](./DEPLOY.md) — Vercel (frontend) + Railway (backend) + PostgreSQL.

## Stack

React 19 · Vite 6 · Tailwind 4 · Zustand | Node 22 · Fastify 5 · Prisma 6 · Zod | SQLite (dev) / PostgreSQL (prod) | JWT + refresh rotativo | WebSocket
