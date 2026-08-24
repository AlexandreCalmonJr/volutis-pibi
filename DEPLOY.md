# Deploy — Volutis PIBI

Arquitetura de produção:

- **Frontend (PWA)** → **Vercel** (estático, grátis)
- **Backend (API + WebSocket)** → **Railway** ou **Render** (a Vercel não suporta WebSocket persistente em serverless)
- **Banco** → **PostgreSQL** (Supabase, Neon ou o Postgres do próprio Railway — todos têm tier gratuito)

---

## 1. Banco de dados (PostgreSQL)

1. Crie um banco no [Supabase](https://supabase.com), [Neon](https://neon.tech) ou Railway.
2. Copie a connection string (`postgresql://...`).
3. No arquivo `server/prisma/schema.prisma`, troque o provider:

```prisma
datasource db {
  provider = "postgresql"   // era "sqlite"
  url      = env("DATABASE_URL")
}
```

4. Gere a migração de produção localmente (uma vez):

```bash
cd server
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." npx tsx prisma/seed.ts   # opcional: dados iniciais
```

> O schema usa String para enums/listas justamente para funcionar igual em SQLite e PostgreSQL — nenhuma outra mudança é necessária.

## 2. Backend (Railway)

1. Suba o repositório no GitHub.
2. No [Railway](https://railway.app): **New Project → Deploy from GitHub** → selecione a pasta `server/` como root (Settings → Root Directory: `server`).
3. Variáveis de ambiente:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | connection string do PostgreSQL |
| `JWT_SECRET` | segredo forte (ex: `openssl rand -hex 32`) |
| `APP_URL` | URL do frontend na Vercel (ex: `https://volutis-pibi.vercel.app`) |
| `CORS_ORIGINS` | mesma URL do frontend |
| `PORT` | Railway injeta automaticamente — o server já lê `process.env.PORT` |

4. Comandos (Settings → Deploy):
   - **Build**: `npm install && npx prisma generate && npx prisma migrate deploy`
   - **Start**: `npm start`
5. Anote a URL pública gerada (ex: `https://volutis-pibi-api.up.railway.app`).

## 3. Frontend (Vercel)

1. Na [Vercel](https://vercel.com): **Add New → Project** → importe o repositório.
2. **Root Directory**: `client` · Framework: Vite (detectado automaticamente).
3. Variável de ambiente:

| Variável | Valor |
|---|---|
| `VITE_API_URL` | URL do backend no Railway (ex: `https://volutis-pibi-api.up.railway.app`) |

4. Deploy. O `vercel.json` já cuida das rewrites da SPA e do cache correto do service worker.

## 4. Pós-deploy

1. Acesse a URL da Vercel e faça login (`admin@pibi.org.br` / senha do seed — **troque a senha imediatamente** ou crie novos usuários e remova os de exemplo).
2. No celular: abra no Chrome/Safari → "Adicionar à tela de início" para instalar o PWA.
3. Configure o Holyrics em **Perfil → Painel Holyrics**:
   - **Rede local**: o backend na nuvem NÃO alcança o IP local da igreja. Para uso local, rode o backend em um PC da igreja OU use o modo **online** (plano Advanced do Holyrics), que funciona de qualquer lugar.
4. Teste o fluxo: criar escala → voluntário recebe → aceita → check-in no culto.

### Nota sobre Holyrics local vs. nuvem

| Cenário | Funciona? |
|---|---|
| Backend na nuvem + Holyrics modo **online** | ✅ de qualquer lugar |
| Backend na nuvem + Holyrics modo **local** | ❌ (nuvem não enxerga a rede da igreja) |
| Backend em PC da igreja + Holyrics **local** | ✅ na rede da igreja |

Recomendação: comece com o backend na nuvem; se a igreja não tiver o plano Advanced, o painel Holyrics pode esperar ou o backend pode rodar num PC local com o app apontando para ele.
