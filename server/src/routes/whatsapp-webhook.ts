import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { parseWhatsAppResponse, sendWhatsAppMessage } from "../services/whatsapp.service.js";
import { notifyMember } from "../services/notification.service.js";

const WEBHOOK_SECRET = process.env.WAHA_WEBHOOK_SECRET;

const webhookEventSchema = z.object({
  event: z.string(),
  payload: z
    .object({
      from: z.string().optional(),
      body: z.string().optional(),
    })
    .optional(),
});

/**
 * Webhook para receber mensagens do WAHA (WhatsApp HTTP API).
 * Processa respostas interativas de confirmação de escala.
 *
 * Segurança: verifica header X-Webhook-Secret quando configurado.
 */
export async function whatsappWebhookRoutes(app: FastifyInstance) {
  /** POST /whatsapp/webhook — recebe mensagens do WAHA */
  app.post("/whatsapp/webhook", async (req, reply) => {
    // Verificação de autenticação via header compartilhado
    if (WEBHOOK_SECRET) {
      const token = (req.headers["x-webhook-secret"] as string) || "";
      if (token !== WEBHOOK_SECRET) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    }

    const parsed = webhookEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Payload inválido" });
    }

    const { event, payload } = parsed.data;

    if (event !== "message" || !payload) {
      return { ok: true };
    }

    const from = payload.from?.replace("@c.us", "")?.replace("@g.us", "");
    const text = payload.body;

    if (!from || !text) {
      return { ok: true };
    }

    console.log(`[WhatsApp Webhook] Mensagem de ${from}: ${text}`);

    const response = parseWhatsAppResponse(text);

    if (response.action === "unknown") {
      return { ok: true };
    }

    // Normalizar telefone para E.164 brasileiro
    const digits = from.replace(/\D/g, "");
    const phone = digits.startsWith("55") ? digits : `55${digits}`;

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
