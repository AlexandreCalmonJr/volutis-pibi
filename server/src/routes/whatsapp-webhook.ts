import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import {
  parseWhatsAppResponse,
  sendWhatsAppMessage,
  getWhatsAppStatus,
} from "../services/whatsapp.service.js";
import { notifyMember } from "../services/notification.service.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";

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

const broadcastSchema = z.object({
  ministryId: z.string().optional(),
  target: z.enum(["ALL", "VOLUNTEERS", "LEADERS"]).default("ALL"),
  message: z.string().min(3, "Mensagem deve ter pelo menos 3 caracteres"),
});

/**
 * Rotas de Integração WhatsApp (Status, Webhook e Disparo de Comunicados).
 */
export async function whatsappWebhookRoutes(app: FastifyInstance) {
  /** GET /whatsapp/status — consulta status da conexão com WAHA */
  app.get("/whatsapp/status", { preHandler: [requireAuth] }, async () => {
    return await getWhatsAppStatus();
  });

  /** POST /whatsapp/test — envia mensagem de teste */
  app.post(
    "/whatsapp/test",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const body = z
        .object({
          phone: z.string().min(8, "Telefone inválido"),
          message: z.string().optional(),
        })
        .parse(req.body);

      const text =
        body.message ||
        "🔔 *Teste de Conexão WhatsApp — Volutis PIBI*\n\nA integração com o WAHA está funcionando perfeitamente! ✅";

      const sent = await sendWhatsAppMessage({
        to: body.phone,
        text,
      });

      if (!sent) {
        return reply.code(400).send({
          ok: false,
          error:
            "Não foi possível enviar a mensagem. Verifique se o servidor WAHA está conectado e com o QR Code autenticado.",
        });
      }

      return { ok: true, message: "Mensagem de teste enviada com sucesso!" };
    }
  );

  /** POST /whatsapp/broadcast — disparo de comunicado em massa */
  app.post("/whatsapp/broadcast", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) {
      return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    }

    if (auth.role !== "ADMIN" && auth.role !== "MINISTRY_LEADER") {
      return reply.code(403).send({ error: "Permissão insuficiente para envio de comunicados" });
    }

    const body = broadcastSchema.parse(req.body);

    let targetMinistryId = body.ministryId;
    if (auth.role === "MINISTRY_LEADER" && !targetMinistryId) {
      const leaderMinistry = await prisma.ministryMember.findFirst({
        where: { member: { userId: auth.sub }, isLeader: true },
      });
      if (!leaderMinistry) {
        return reply.code(403).send({ error: "Você não lidera nenhum ministério" });
      }
      targetMinistryId = leaderMinistry.ministryId;
    }

    let members: any[] = [];
    if (targetMinistryId) {
      const ministryMembers = await prisma.ministryMember.findMany({
        where: {
          ministryId: targetMinistryId,
          ministry: { churchId: auth.churchId },
          ...(body.target === "LEADERS" ? { isLeader: true } : {}),
        },
        include: { member: true },
      });
      members = ministryMembers.map((mm) => mm.member);
    } else {
      members = await prisma.member.findMany({
        where: {
          churchId: auth.churchId,
          approvalStatus: "ACTIVE",
          ...(body.target === "LEADERS"
            ? { ministryMembers: { some: { isLeader: true } } }
            : {}),
        },
      });
    }

    const uniqueMembers = Array.from(new Map(members.map((m) => [m.id, m])).values());

    let sentWhatsappCount = 0;
    for (const m of uniqueMembers) {
      // 1. Notificação interna em tempo real (WebSocket)
      notifyMember(m.id, {
        type: "ANNOUNCEMENT",
        title: "📢 Comunicado da Igreja",
        body: body.message,
      });

      // 2. WhatsApp
      if (m.phone) {
        const formattedMessage = `📢 *Comunicado Volutis PIBI*\n\nOlá, ${m.name}! 🙌\n\n${body.message}\n\n🙏 Deus abençoe!`;
        const sent = await sendWhatsAppMessage({
          to: m.phone,
          text: formattedMessage,
        });
        if (sent) sentWhatsappCount++;
      }
    }

    return {
      ok: true,
      totalRecipients: uniqueMembers.length,
      sentViaWhatsapp: sentWhatsappCount,
    };
  });

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
