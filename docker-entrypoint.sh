#!/bin/sh
set -e

cd /app/server

echo "📦 Sincronizando schema do banco de dados (Prisma)..."
npx prisma db push --skip-generate || true

echo "🌱 Executando seed inicial (se necessário)..."
npx tsx prisma/seed.ts || true

exec "$@"

