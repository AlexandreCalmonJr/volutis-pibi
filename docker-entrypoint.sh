#!/bin/sh
set -e

cd /app/server

echo "📦 Marcando baseline como aplicada (idempotente)..."
npx prisma migrate resolve --applied 20260831000000_postgres_baseline 2>/dev/null || true

echo "📦 Sincronizando schema do banco de dados (Prisma)..."
if npx prisma migrate deploy; then
  echo "✅ Migrations aplicadas com sucesso."
elif [ "${PRISMA_ALLOW_DB_PUSH_FALLBACK:-false}" = "true" ]; then
  echo "⚠️ Migration falhou; usando fallback explícito via prisma db push."
  npx prisma db push --skip-generate
else
  echo "❌ Falha ao aplicar migrations. Em produção com banco real, resolva o baseline/migrations antes do deploy ou defina PRISMA_ALLOW_DB_PUSH_FALLBACK=true conscientemente."
  exit 1
fi

echo "🌱 Executando seed inicial (se necessário)..."
npx tsx prisma/seed.ts || true

exec "$@"
