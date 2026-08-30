import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, type AuthUser } from "../middleware/auth.js";
import {
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
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
}
