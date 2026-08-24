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

# Copiar todo o projeto
COPY package.json ./
COPY server/ server/
RUN npm install --workspace=server && cd server && npx prisma generate

# Copiar frontend buildado
COPY --from=client-build /app/client/dist ./client/dist

# Rodar migrations e seed no build (SQLite — dados ficam dentro do container)
RUN cd server && npx prisma migrate deploy && npx tsx prisma/seed.ts

ENV NODE_ENV=production
ENV PORT=8080
# JWT_SECRET forte para produção (troque se quiser)
ENV JWT_SECRET=a3f8b2c7d9e1f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2

EXPOSE 8080

CMD ["npx", "tsx", "server/src/server.ts"]
