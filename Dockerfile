# Imagem base leve com Node.js 20
FROM node:20-alpine

WORKDIR /app

# Dependências nativas necessárias para o Prisma Engine no Alpine Linux
RUN apk add --no-cache openssl libc6-compat

# Copiar arquivos de configuração de pacotes e workspaces
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Instalar dependências do backend
RUN npm install --workspace=server --include-workspace-root

# Copiar código-fonte do backend
COPY server/ ./server/

# Gerar o Prisma Client
RUN cd server && npx prisma generate

# Copiar script de inicialização
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npx", "tsx", "server/src/server.ts"]
