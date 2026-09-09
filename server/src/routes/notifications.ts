import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";
import {
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  notifyMember,
} from "../services/notification.service.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  unreadOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
});

export async function notificationRoutes(app: FastifyInstance) {
  app.get("/my/notifications", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.memberId) return reply.code(400).send({ error: "Usuário sem membro vinculado" });

    const query = listQuerySchema.parse(req.query ?? {});
    const notifications = await listNotifications(auth.memberId, query.limit ?? 50, query.unreadOnly ?? false);
    return { items: notifications };
  });

  app.get("/my/notifications/unread-count", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.memberId) return reply.code(400).send({ error: "Usuário sem membro vinculado" });

    const unreadCount = await prisma.userNotification.count({
      where: {
        memberId: auth.memberId,
        readAt: null,
      },
    });

    return { unreadCount };
  });

  app.post("/notifications/:id/read", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.memberId) return reply.code(400).send({ error: "Usuário sem membro vinculado" });

    const { id } = req.params as { id: string };
    const updated = await markNotificationAsRead(auth.memberId, id);
    if (!updated) return reply.code(404).send({ error: "Notificação não encontrada" });
    return updated;
  });

  app.post("/notifications/read-all", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.memberId) return reply.code(400).send({ error: "Usuário sem membro vinculado" });
    return markAllNotificationsAsRead(auth.memberId);
  });

  /** POST /notifications/broadcast — Enviar comunicado para um ministério ou para a igreja */
  const broadcastSchema = z.object({
    ministryId: z.string().optional(),
    title: z.string().min(3, "Título deve ter no mínimo 3 caracteres").max(100),
    body: z.string().min(5, "Mensagem deve ter no mínimo 5 caracteres").max(500),
    whatsappLink: z.string().url().optional(),
  });

  app.post("/notifications/broadcast", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });

    const input = broadcastSchema.parse(req.body);

    let targetMemberIds: string[] = [];

    if (input.ministryId) {
      const members = await prisma.ministryMember.findMany({
        where: {
          ministryId: input.ministryId,
          ministry: { churchId: auth.churchId },
        },
        select: { memberId: true },
      });
      targetMemberIds = [...new Set(members.map((m) => m.memberId))];
    } else if (auth.role === "ADMIN") {
      const members = await prisma.member.findMany({
        where: { churchId: auth.churchId, approvalStatus: "ACTIVE" },
        select: { id: true },
      });
      targetMemberIds = members.map((m) => m.id);
    } else {
      return reply.code(403).send({ error: "Apenas administradores podem enviar comunicado para toda a igreja." });
    }

    if (targetMemberIds.length === 0) {
      return { success: true, message: "Nenhum membro encontrado para o destinatário selecionado.", sentCount: 0 };
    }

    // Dispara notificações (WebSocket in-app + Web Push em background)
    let sentCount = 0;
    for (const memberId of targetMemberIds) {
      await notifyMember(memberId, {
        type: "ANNOUNCEMENT",
        title: input.title,
        body: input.body,
        whatsappLink: input.whatsappLink,
      }).catch(() => {});
      sentCount++;
    }

    return {
      success: true,
      message: `Comunicado enviado com sucesso para ${sentCount} membro(s).`,
      sentCount,
    };
  });
}
