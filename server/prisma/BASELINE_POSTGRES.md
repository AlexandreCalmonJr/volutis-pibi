# Baselining do PostgreSQL existente

Este projeto já foi usado com SQLite no passado, mas o banco ativo agora é PostgreSQL.
Se o banco do ambiente já tem dados reais e foi sincronizado por `prisma db push`, o passo correto é **baselinear** a migration inicial em vez de resetar o banco.

## O que mudou no repositório

- o histórico antigo foi arquivado em `prisma/migrations_sqlite_archive/`
- a nova migration oficial é `20260831000000_postgres_baseline`
- `prisma/migrations/migration_lock.toml` agora usa `provider = "postgresql"`

## Procedimento seguro no banco existente

> Faça backup do banco antes.

1. confirme que o `DATABASE_URL` aponta para o PostgreSQL correto
2. gere o Prisma Client:

```bash
npm run prisma:generate -w server
```

3. marque a baseline como já aplicada no banco existente:

```bash
npm run prisma:baseline:mark -w server
```

4. valide o status:

```bash
npx prisma migrate status --schema server/prisma/schema.prisma
```

5. depois disso, os próximos deploys devem usar apenas:

```bash
npx prisma migrate deploy --schema server/prisma/schema.prisma
```

## Quando usar `PRISMA_ALLOW_DB_PUSH_FALLBACK=true`

Somente em ambiente temporário, homologação descartável ou recuperação emergencial consciente.
Não é o fluxo recomendado para produção com dados reais.

## Observação

A baseline não altera o banco existente por si só; ela apenas ensina o Prisma a considerar o estado atual como ponto inicial da história de migrations.
