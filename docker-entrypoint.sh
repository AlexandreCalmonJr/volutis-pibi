#!/bin/sh
set -e

cd /app/server

# Rodar migrations / db push no banco de dados se DATABASE_URL estiver presente
if [ -n "$DATABASE_URL" ]; then
  echo "📦 Sincronizando schema do banco de dados (Prisma)..."
  npx prisma db push --skip-generate 2>/dev/null || npx prisma migrate deploy --skip-generate 2>/dev/null || true
  
  echo "🌱 Executando seed inicial (se necessário)..."
  npx tsx prisma/seed.ts 2>/dev/null || true
fi

cd /app
exec "$@"

