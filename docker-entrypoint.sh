#!/bin/sh
set -e

cd /app/server

# Sincronizar schema e rodar seed se DATABASE_URL estiver presente
if [ -n "$DATABASE_URL" ]; then
  echo "📦 Sincronizando schema do banco de dados (Prisma)..."
  npx prisma db push --skip-generate || true
  
  echo "🌱 Executando seed inicial (se necessário)..."
  npx tsx prisma/seed.ts || true
fi

cd /app
exec "$@"

