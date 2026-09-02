import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, belongsToChurch } from "../lib/db.js";
import { requireAuth, type AuthUser } from "../middleware/auth.js";
import { notifyMember } from "../services/notification.service.js";

const messageSchema = z.object({ content: z.string().min(1).max(2000) });

export async function chatRoutes(app: FastifyInstance) {
  app.get("/events/:eventId/chat", { preHandler: [requireAuth] }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    if (!(await belongsToChurch("event", eventId, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });
    const { after, limit } = req.query as { after?: string; limit?: string };
    const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
    return prisma.chatMessage.findMany({
      where: { eventId, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
      orderBy: { createdAt: "asc" },
      take,
    });
  });

  app.post("/events/:eventId/chat", { preHandler: [requireAuth] }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const auth = req.user as AuthUser;
    const body = messageSchema.parse(req.body);

    if (!(await belongsToChurch("event", eventId, auth.churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return reply.code(404).send({ error: "Evento não encontrado" });

    const author = auth.memberId
      ? await prisma.member.findUnique({ where: { id: auth.memberId } })
      : null;
    const authorName = author?.name ?? auth.email;

    const message = await prisma.chatMessage.create({
      data: { eventId, content: body.content, authorName },
    });

    // Broadcast em tempo real para todos os escalados do evento (exceto o autor)
    const scheduled = await prisma.scheduleItem.findMany({
      where: { eventId, status: { in: ["PENDING", "CONFIRMED", "SWAP_REQUESTED"] } },
      select: { memberId: true },
      distinct: ["memberId"],
    });
    for (const s of scheduled) {
      if (s.memberId === auth.memberId) continue;
      await notifyMember(s.memberId, {
        type: "CHAT_MESSAGE",
        title: `💬 ${authorName} — ${event.title}`,
        body: body.content.slice(0, 120),
        data: { eventId, messageId: message.id },
      });
    }

    return reply.code(201).send(message);
  });
}
