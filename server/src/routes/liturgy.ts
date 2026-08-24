import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, belongsToChurch, itemEventChurch } from "../lib/db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";

const liturgySchema = z.object({
  title: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), // "19:00"
  durationMin: z.number().int().positive().optional(),
  responsible: z.string().optional(),
  bibleRef: z.string().optional(),
  notes: z.string().optional(),
});

const reorderSchema = z.object({ itemIds: z.array(z.string()).min(1) });

export async function liturgyRoutes(app: FastifyInstance) {
  app.get("/events/:eventId/liturgy", { preHandler: [requireAuth] }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    if (!(await belongsToChurch("event", eventId, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });
    return prisma.liturgyItem.findMany({ where: { eventId }, orderBy: { order: "asc" } });
  });

  app.post(
    "/events/:eventId/liturgy",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const { eventId } = req.params as { eventId: string };
      const body = liturgySchema.parse(req.body);
      if (!(await belongsToChurch("event", eventId, (req.user as AuthUser).churchId)))
        return reply.code(404).send({ error: "Evento não encontrado" });
      const last = await prisma.liturgyItem.findFirst({ where: { eventId }, orderBy: { order: "desc" } });
      const item = await prisma.liturgyItem.create({
        data: { ...body, eventId, order: (last?.order ?? 0) + 1 },
      });
      return reply.code(201).send(item);
    }
  );

  app.put(
    "/events/:eventId/liturgy/reorder",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const { eventId } = req.params as { eventId: string };
      if (!(await belongsToChurch("event", eventId, (req.user as AuthUser).churchId)))
        return reply.code(404).send({ error: "Evento não encontrado" });
      const { itemIds } = reorderSchema.parse(req.body);
      const valid = await prisma.liturgyItem.findMany({
        where: { id: { in: itemIds }, eventId },
        select: { id: true },
      });
      if (valid.length !== itemIds.length)
        return reply.code(400).send({ error: "Itens não pertencem a este evento" });
      await prisma.$transaction(
        itemIds.map((id, idx) => prisma.liturgyItem.update({ where: { id }, data: { order: idx + 1 } }))
      );
      return prisma.liturgyItem.findMany({ where: { eventId }, orderBy: { order: "asc" } });
    }
  );

  app.put("/liturgy-items/:id", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const church = await itemEventChurch("liturgyItem", id);
    if (!church || church !== (req.user as AuthUser).churchId)
      return reply.code(404).send({ error: "Item de liturgia não encontrado" });
    const body = liturgySchema.partial().parse(req.body);
    try {
      return await prisma.liturgyItem.update({ where: { id }, data: body });
    } catch {
      return reply.code(404).send({ error: "Item de liturgia não encontrado" });
    }
  });

  app.delete("/liturgy-items/:id", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const church = await itemEventChurch("liturgyItem", id);
    if (!church || church !== (req.user as AuthUser).churchId)
      return reply.code(404).send({ error: "Item de liturgia não encontrado" });
    try {
      await prisma.liturgyItem.delete({ where: { id } });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "Item de liturgia não encontrado" });
    }
  });
}
