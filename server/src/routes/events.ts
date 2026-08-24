import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, belongsToChurch } from "../lib/db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";

const EVENT_TYPES = [
  "SUNDAY_MORNING",
  "SUNDAY_EVENING",
  "WEDNESDAY_PRAYER",
  "REHEARSAL",
  "SPECIAL_EVENT",
] as const;

const eventSchema = z.object({
  title: z.string().min(2),
  type: z.enum(EVENT_TYPES),
  date: z.string().datetime(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  isRecurrent: z.boolean().default(false),
  recurrence: z.string().optional(),
});

export async function eventRoutes(app: FastifyInstance) {
  app.get("/events", { preHandler: [requireAuth] }, async (req) => {
    const auth = req.user as AuthUser;
    const { from, to } = req.query as { from?: string; to?: string };
    return prisma.event.findMany({
      where: {
        churchId: auth.churchId ?? undefined,
        date: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: {
        scheduleItems: {
          include: { member: { select: { id: true, name: true, photoUrl: true } } },
        },
      },
      orderBy: { date: "asc" },
    });
  });

  app.get("/events/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("event", id, auth.churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        scheduleItems: {
          include: {
            // Minimização: apenas os campos usados pela UI
            member: { select: { id: true, name: true, photoUrl: true, phone: true } },
            checkin: true,
          },
        },
        liturgyItems: { orderBy: { order: "asc" } },
        setlistItems: { include: { song: true }, orderBy: { order: "asc" } },
      },
    });
    if (!event) return reply.code(404).send({ error: "Evento não encontrado" });
    // Telefone dos escalados só para líderes (usado no botão WhatsApp)
    if (!["ADMIN", "MINISTRY_LEADER"].includes(auth.role)) {
      for (const s of event.scheduleItems) (s.member as any).phone = null;
    }
    return event;
  });

  app.post("/events", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.churchId) return reply.code(400).send({ error: "Usuário sem igreja vinculada" });
    const body = eventSchema.parse(req.body);
    const event = await prisma.event.create({
      data: {
        title: body.title,
        type: body.type,
        date: new Date(body.date),
        startTime: new Date(body.startTime),
        endTime: body.endTime ? new Date(body.endTime) : undefined,
        isRecurrent: body.isRecurrent,
        recurrence: body.recurrence,
        churchId: auth.churchId,
      },
    });
    return reply.code(201).send(event);
  });

  app.put("/events/:id", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await belongsToChurch("event", id, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });
    const body = eventSchema.partial().parse(req.body);
    try {
      return await prisma.event.update({
        where: { id },
        data: {
          ...body,
          date: body.date ? new Date(body.date) : undefined,
          startTime: body.startTime ? new Date(body.startTime) : undefined,
          endTime: body.endTime ? new Date(body.endTime) : undefined,
        },
      });
    } catch {
      return reply.code(404).send({ error: "Evento não encontrado" });
    }
  });

  app.delete("/events/:id", { preHandler: [requireRole("MINISTRY_LEADER")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await belongsToChurch("event", id, (req.user as AuthUser).churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });
    try {
      await prisma.event.delete({ where: { id } });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "Evento não encontrado" });
    }
  });
}
