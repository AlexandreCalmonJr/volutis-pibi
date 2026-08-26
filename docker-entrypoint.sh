#!/bin/sh
set -e

cd /app/server

# Rodar migrations no banco de dados se DATABASE_URL estiver presente
if [ -n "$DATABASE_URL" ]; then
  echo "📦 Aplicando migrações do banco de dados..."
  npx prisma migrate deploy --skip-generate 2>/dev/null || npx prisma migrate dev --name init --skip-generate 2>/dev/null || true
fi

cd /app
exec "$@"
