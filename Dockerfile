# ---- Build do frontend ----
FROM node:20-alpine AS client-build
WORKDIR /app
COPY package.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm install --workspace=client
COPY client/ client/
RUN npm run build -w client

# ---- Imagem final ----
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_URL="file:./dev.db"

# Copiar todo o projeto
COPY package.json ./
COPY server/ server/
RUN npm install --workspace=server && cd server && npx prisma generate

# Copiar frontend buildado
COPY --from=client-build /app/client/dist ./client/dist

# Criar script de entrypoint
COPY <<'EOF' /app/docker-entrypoint.sh
#!/bin/sh
set -e
cd /app/server
npx prisma migrate deploy --skip-generate 2>/dev/null || npx prisma migrate dev --name init --skip-generate 2>/dev/null || true
npx tsx prisma/seed.ts 2>/dev/null || true
cd /app
exec "$@"
EOF
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npx", "tsx", "server/src/server.ts"]
