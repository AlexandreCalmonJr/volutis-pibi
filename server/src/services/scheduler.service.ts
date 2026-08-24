/**
 * Serviço de Agendamento (Scheduler) para Lembretes Automáticos.
 * Roda periodicamente verificando escalas nas próximas 24 horas.
 */

import { prisma } from "../lib/db.js";
import { notifyMember } from "./notification.service.js";
import { sendScheduleReminderWhatsApp } from "./whatsapp.service.js";

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // a cada 15 minutos
const REMINDER_WINDOW_HOURS = 24;

export async function processScheduleReminders(): Promise<number> {
  const now = new Date();
  const futureLimit = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

  try {
    // Busca itens de escala nos próximos 24h que ainda não receberam lembrete
    const items = await prisma.scheduleItem.findMany({
      where: {
        reminderSentAt: null,
        status: { in: ["PENDING", "CONFIRMED"] },
        event: {
          startTime: {
            gt: now,
            lte: futureLimit,
          },
        },
      },
      include: {
        member: true,
        event: true,
      },
    });

    if (items.length === 0) return 0;

    let sentCount = 0;
    for (const item of items) {
      // 1. Marca imediatamente como lembrado para evitar concorrência/duplicação
      await prisma.scheduleItem.update({
        where: { id: item.id },
        data: { reminderSentAt: new Date() },
      });

      // 2. Dispara WhatsApp automático (via WAHA, se configurado)
      await sendScheduleReminderWhatsApp({
        memberName: item.member.name,
        phone: item.member.phone,
        eventTitle: item.event.title,
        eventDate: item.event.startTime,
        roleName: item.roleName,
      });

      // 3. Notificação interna em tempo real (WebSocket / Push)
      notifyMember(item.memberId, {
        type: "SCHEDULE_REMINDER",
        title: "⏰ Lembrete de Escala (Amanhã)",
        body: `${item.event.title} — ${item.roleName}`,
        data: { scheduleItemId: item.id, eventId: item.eventId },
      });

      sentCount++;
    }

    if (sentCount > 0) {
      console.log(`[Scheduler] ${sentCount} lembrete(s) de escala de 24h enviado(s).`);
    }

    return sentCount;
  } catch (err: any) {
    console.error("[Scheduler] Erro ao processar lembretes de escala:", err);
    return 0;
  }
}

/**
 * Inicia o ciclo de verificação do agendador.
 */
export function startReminderScheduler(): NodeJS.Timeout {
  console.log("⏰ Agendador de lembretes automáticos de 24h iniciado.");

  // Primeira execução rápida (5s após subir o servidor)
  setTimeout(() => {
    processScheduleReminders().catch((err) =>
      console.error("[Scheduler] Erro na execução inicial:", err)
    );
  }, 5000);

  // Execução periódica a cada 15 minutos
  return setInterval(() => {
    processScheduleReminders().catch((err) =>
      console.error("[Scheduler] Erro na execução periódica:", err)
    );
  }, CHECK_INTERVAL_MS);
}
