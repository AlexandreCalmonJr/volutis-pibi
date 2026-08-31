# Deploy — Volut PIBI

Arquitetura de produção:

- **Frontend (PWA)** → **Vercel**
- **Backend (API + WebSocket)** → **Northflank**, **Railway** ou **Render**
- **Banco** → **PostgreSQL** (Northflank Addon, Supabase, Neon ou Railway)

---

## 1. Banco de dados (PostgreSQL)

1. Crie um banco no **Northflank PostgreSQL Addon**, [Supabase](https://supabase.com), [Neon](https://neon.tech) ou Railway.
2. Copie a connection string (`postgresql://...`).
3. O backend já está configurado para `provider = "postgresql"` em `server/prisma/schema.prisma`.
4. Aplique as migrations e, se quiser, rode o seed inicial:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy --schema server/prisma/schema.prisma
DATABASE_URL="postgresql://..." npm run seed -w server
```

> O ambiente atual do projeto usa PostgreSQL como padrão.

### Banco já existente com dados reais

Se o banco do Northflank já está em uso e veio de um período em que o projeto ainda tinha histórico antigo de SQLite, **não resete o banco**. Faça o baseline da migration PostgreSQL primeiro: [Prisma Baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining).

```bash
DATABASE_URL="postgresql://..." npm run prisma:generate -w server
DATABASE_URL="postgresql://..." npm run prisma:baseline:mark -w server
DATABASE_URL="postgresql://..." npx prisma migrate status --schema server/prisma/schema.prisma
```

Depois disso, os próximos deploys podem usar `prisma migrate deploy` normalmente.

## 2. Backend (Northflank)

1. Suba o repositório no GitHub.
2. No [Northflank](https://northflank.com), crie um serviço a partir do repositório.
3. Use o `Dockerfile` da raiz do projeto **ou** configure o build da workspace `server`.
4. Variáveis de ambiente:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | connection string do PostgreSQL |
| `JWT_SECRET` | segredo forte (ex: `openssl rand -hex 32`) |
| `APP_URL` | URL pública do frontend |
| `CORS_ORIGINS` | domínio do frontend |
| `PORT` | o provedor injeta automaticamente; o server lê `process.env.PORT` |

5. Se optar por build manual, use:
   - **Build**: `npm install && npm run prisma:generate -w server && npx prisma migrate deploy --schema server/prisma/schema.prisma`
   - **Start**: `npm start -w server`
6. Anote a URL pública gerada.

> Em produção, o container agora falha de propósito se `prisma migrate deploy` quebrar. O fallback `prisma db push` só roda com `PRISMA_ALLOW_DB_PUSH_FALLBACK=true` explicitamente definido.

## 2.1 Alternativas de backend

- **Railway** e **Render** também funcionam, desde que `DATABASE_URL` aponte para PostgreSQL.

## 3. Frontend (Vercel)

1. Na [Vercel](https://vercel.com): **Add New → Project** → importe o repositório.
2. **Root Directory**: `client` · Framework: Vite.
3. Variável de ambiente:

| Variável | Valor |
|---|---|
| `VITE_API_URL` | URL pública do backend (ex: `https://volutis-pibi-api.seu-dominio.com`) |

4. Faça o deploy. O `vercel.json` já cuida das rewrites da SPA e do cache do service worker.

## 4. Pós-deploy

1. Acesse a URL da Vercel e faça login (`admin@pibi.org.br` / senha do seed — **troque a senha imediatamente**).
2. No celular: abra no Chrome/Safari → “Adicionar à tela de início” para instalar o PWA.
3. Configure o Holyrics em **Perfil → Painel Holyrics**.
4. Teste o fluxo: criar escala → voluntário recebe → aceita → check-in no culto.

### Nota sobre Holyrics local vs. nuvem

| Cenário | Funciona? |
|---|---|
| Backend na nuvem + Holyrics modo **online** | ✅ de qualquer lugar |
| Backend na nuvem + Holyrics modo **local** | ❌ |
| Backend em PC da igreja + Holyrics **local** | ✅ na rede da igreja |

Recomendação: comece com o backend na nuvem; se a igreja não tiver o plano Advanced, o painel Holyrics pode esperar ou o backend pode rodar num PC local com o app apontando para ele.
