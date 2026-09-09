import { prisma } from "./db.js";

const ownerId = `${process.env.HOSTNAME || "local"}:${process.pid}:${Math.random().toString(36).slice(2, 8)}`;

/**
 * Adquire ou renova um lease atômico para execução de jobs concorrentes.
 * Garante que apenas uma instância execute o agendador por vez, sem race conditions.
 */
export async function acquireSchedulerLease(key: string, ttlMs: number): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    // 1. Tenta atualizar atomicamente um lease que já expirou OU que já pertence a esta instância
    const updated = await prisma.schedulerLease.updateMany({
      where: {
        key,
        OR: [
          { expiresAt: { lte: now } },
          { ownerId },
        ],
      },
      data: {
        ownerId,
        expiresAt,
      },
    });

    if (updated.count > 0) {
      return true;
    }

    // 2. Se nenhuma linha foi atualizada, o lease pode ainda não existir no banco.
    // Tenta criar de forma atômica. Se outra réplica criar ao mesmo tempo,
    // o banco de dados dispara violação de unicidade (P2002) e retornamos false com segurança.
    try {
      await prisma.schedulerLease.create({
        data: {
          key,
          ownerId,
          expiresAt,
        },
      });
      return true;
    } catch (createErr: any) {
      if (createErr?.code === "P2002") {
        return false;
      }
      throw createErr;
    }
  } catch (err: any) {
    console.error(`[SchedulerLock] Erro ao adquirir lease '${key}':`, err?.message || err);
    return false;
  }
}

/**
 * Libera voluntariamente o lease expirando-o imediatamente.
 */
export async function releaseSchedulerLease(key: string): Promise<void> {
  try {
    await prisma.schedulerLease.updateMany({
      where: {
        key,
        ownerId,
      },
      data: {
        expiresAt: new Date(0),
      },
    });
  } catch (err: any) {
    console.error(`[SchedulerLock] Erro ao liberar lease '${key}':`, err?.message || err);
  }
}
