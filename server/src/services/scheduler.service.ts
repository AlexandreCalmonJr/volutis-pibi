/**
 * Serviço de Agendamento (Scheduler) para Lembretes Automáticos.
 * Roda periodicamente verificando escalas nas próximas 24 horas.
 */

import { prisma } from "../lib/db.js";
import { notifyMember } from "./notification.service.js";
import { sendInteractiveScheduleReminder } from "./whatsapp.service.js";

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // a cada 15 minutos
const REMINDER_WINDOW_HOURS = 24;

function formatReminderDateTime(date: Date) {
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
      const appUrl = process.env.APP_URL ?? "https://volutis-pibi.vercel.app";

      // 1. Dispara WhatsApp automático com código rastreável
      const whatsappSent = await sendInteractiveScheduleReminder({
        memberName: item.member.name,
        phone: item.member.phone,
        eventTitle: item.event.title,
        eventDate: item.event.startTime,
        roleName: item.roleName,
        scheduleItemId: item.id,
        confirmUrl: `${appUrl}/escala/${item.id}`,
      });

      // 2. Notificação interna persistida + tempo real
      await notifyMember(item.memberId, {
        type: "SCHEDULE_REMINDER",
        title: "⏰ Lembrete de Escala (Amanhã)",
        body: `${item.event.title} em ${formatReminderDateTime(item.event.startTime)} — função: ${item.roleName}`,
        data: { scheduleItemId: item.id, eventId: item.eventId },
      });

      // 3. Marca como enviado somente após persistir a notificação interna
      await prisma.scheduleItem.update({
        where: { id: item.id },
        data: { reminderSentAt: new Date() },
      });

      if (whatsappSent || item.memberId) sentCount++;
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
export function startReminderScheduler(): ReturnType<typeof setInterval> {
  console.log("⏰ Agendador de lembretes automáticos de 24h iniciado.");

  setTimeout(() => {
    processScheduleReminders().catch((err) =>
      console.error("[Scheduler] Erro na execução inicial:", err)
    );
  }, 5000);

  return setInterval(() => {
    processScheduleReminders().catch((err) =>
      console.error("[Scheduler] Erro na execução periódica:", err)
    );
  }, CHECK_INTERVAL_MS);
}
