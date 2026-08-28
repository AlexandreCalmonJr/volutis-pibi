FROM node:20-slim

WORKDIR /app

# Instalar OpenSSL e certificados necessários para o Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copiar arquivos de configuração de pacotes
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Instalar dependências do backend
RUN npm install --workspace=server --include-workspace-root

# Copiar código-fonte do backend
COPY server/ ./server/

# Gerar Prisma Client
RUN cd server && npx prisma generate

# Script de inicialização
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app/server

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npx", "tsx", "src/server.ts"]
