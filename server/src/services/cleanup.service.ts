/**
 * Serviço de Manutenção e Limpeza Periódica do Banco de Dados.
 * Executado periodicamente para remover tokens expirados, convites antigos e notificações lidas obsoletas.
 */

import { prisma } from "../lib/db.js";

const CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000; // a cada 12 horas

export async function runDatabaseCleanup(): Promise<{
  expiredInvitesDeleted: number;
  expiredTokensDeleted: number;
  oldNotificationsDeleted: number;
}> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  try {
    // 1. Remove convites expirados há mais de 7 dias
    const { count: expiredInvitesDeleted } = await prisma.invite.deleteMany({
      where: {
        expiresAt: { lt: sevenDaysAgo },
      },
    });

    // 2. Remove refresh tokens de sessão já expirados
    const { count: expiredTokensDeleted } = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    // 3. Remove notificações lidas com mais de 60 dias
    const { count: oldNotificationsDeleted } = await prisma.userNotification.deleteMany({
      where: {
        readAt: { not: null },
        createdAt: { lt: sixtyDaysAgo },
      },
    });

    console.log(
      `[CleanupJob] Manutenção concluída: ${expiredInvitesDeleted} convite(s), ${expiredTokensDeleted} token(s) e ${oldNotificationsDeleted} notificação(ões) removidos.`
    );

    return {
      expiredInvitesDeleted,
      expiredTokensDeleted,
      oldNotificationsDeleted,
    };
  } catch (err: any) {
    console.error("[CleanupJob] Erro durante a limpeza do banco de dados:", err?.message || err);
    return {
      expiredInvitesDeleted: 0,
      expiredTokensDeleted: 0,
      oldNotificationsDeleted: 0,
    };
  }
}

/**
 * Inicia o cron de limpeza automática em segundo plano.
 */
export function startDatabaseCleanupScheduler(): ReturnType<typeof setInterval> {
  // Executa uma vez após 1 minuto do servidor subir
  setTimeout(() => {
    runDatabaseCleanup().catch(() => {});
  }, 60 * 1000);

  // E repete a cada 12 horas
  return setInterval(() => {
    runDatabaseCleanup().catch(() => {});
  }, CLEANUP_INTERVAL_MS);
}
