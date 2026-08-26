import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { parseWhatsAppResponse, sendWhatsAppMessage } from "../services/whatsapp.service.js";
import { notifyMember } from "../services/notification.service.js";

/**
 * Webhook para receber mensagens do WAHA (WhatsApp HTTP API).
 * Processa respostas interativas de confirmação de escala.
 */
export async function whatsappWebhookRoutes(app: FastifyInstance) {
  /** POST /whatsapp/webhook — recebe mensagens do WAHA */
  app.post("/whatsapp/webhook", async (req, reply) => {
    const body = req.body as any;

    // WAHA envia diferentes formatos dependendo da configuração
    // Formato esperado: { event: "message", payload: { from: "...", body: "...", ... } }
    const event = body?.event;
    const payload = body?.payload;

    if (event !== "message" || !payload) {
      // Acknowledge non-message events
      return { ok: true };
    }

    const from = payload.from?.replace("@c.us", "")?.replace("@g.us", "");
    const text = payload.body;

    if (!from || !text) {
      return { ok: true };
    }

    console.log(`[WhatsApp Webhook] Mensagem de ${from}: ${text}`);

    // Processar resposta interativa
    const response = parseWhatsAppResponse(text);

    if (response.action === "unknown") {
      // Mensagem não reconhecida — ignorar
      return { ok: true };
    }

    // Buscar o último agendamento pendente deste número
    const phone = from.startsWith("55") ? from : `55${from}`;
    const member = await prisma.member.findFirst({
      where: { phone },
      include: {
        scheduleItems: {
          where: { status: "PENDING" },
          orderBy: { event: { date: "asc" } },
          take: 1,
          include: { event: true, member: true },
        },
      },
    });

    if (!member || member.scheduleItems.length === 0) {
      // Nenhum agendamento pendente para este número
      return { ok: true };
    }

    const scheduleItem = member.scheduleItems[0];

    if (response.action === "confirm") {
      await prisma.scheduleItem.update({
        where: { id: scheduleItem.id },
        data: { status: "CONFIRMED" },
      });

      await sendWhatsAppMessage({
        to: phone,
        text: `✅ Presença confirmada para *${scheduleItem.event.title}*!\n\nObrigado e Deus abençoe! — Volutis PIBI`,
      });

      // Notificar o líder via WebSocket
      notifyMember(member.id, {
        type: "SCHEDULE_CONFIRMED",
        title: "Escala confirmada",
        body: `Sua presença em "${scheduleItem.event.title}" foi confirmada.`,
      });
    } else if (response.action === "decline") {
      await prisma.scheduleItem.update({
        where: { id: scheduleItem.id },
        data: { status: "DECLINED" },
      });

      await sendWhatsAppMessage({
        to: phone,
        text: `❌ Presença recusada para *${scheduleItem.event.title}*.\n\nSe precisar de ajuda, entre em contato com o líder do ministério.\n\nDeus abençoe! — Volutis PIBI`,
      });

      // Notificar o líder via WebSocket
      notifyMember(member.id, {
        type: "SCHEDULE_DECLINED",
        title: "Escala recusada",
        body: `Sua presença em "${scheduleItem.event.title}" foi recusada.`,
      });
    }

    return { ok: true };
  });

  /** GET /whatsapp/webhook — verificação de webhook (para WAHA) */
  app.get("/whatsapp/webhook", async () => {
    return { status: "ok", message: "WhatsApp webhook is active" };
  });
}
