import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, belongsToChurch, itemEventChurch } from "../lib/db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";
import { findConflict, isUnavailable, suggestVolunteers } from "../services/schedule.service.js";
import { notifyMember } from "../services/notification.service.js";
import { buildScheduleWhatsAppLink } from "../services/whatsapp.service.js";
import { checkAndAwardBadges } from "../services/gamification.service.js";

const assignSchema = z.object({
  memberId: z.string(),
  roleName: z.string().min(1),
  force: z.boolean().default(false), // líder pode ignorar aviso de conflito
});

const respondSchema = z.object({
  action: z.enum(["CONFIRM", "DECLINE"]),
  reason: z.string().optional(),
});

const swapSchema = z.object({
  targetMemberId: z.string(),
  message: z.string().optional(),
});

const swapRespondSchema = z.object({
  action: z.enum(["ACCEPT", "DECLINE"]),
});

function getAppUrl(req: any): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const origin = req.headers.origin;
  if (origin) return origin;
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  return host ? `${proto}://${host}` : "https://volutis-pibi.vercel.app";
}

export async function scheduleRoutes(app: FastifyInstance) {
  // ── Sugestões inteligentes ───────────────────────────────────────────
  app.get(
    "/events/:eventId/suggestions",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const { eventId } = req.params as { eventId: string };
      const auth = req.user as AuthUser;
      const { ministryId, role } = req.query as { ministryId?: string; role?: string };
      if (!ministryId || !role)
        return reply.code(400).send({ error: "Parâmetros ministryId e role são obrigatórios" });
      if (!(await belongsToChurch("event", eventId, auth.churchId)) || !(await belongsToChurch("ministry", ministryId, auth.churchId)))
        return reply.code(404).send({ error: "Evento ou ministério não encontrado" });
      return suggestVolunteers(ministryId, role, eventId);
    }
  );

  // ── Escala do evento ─────────────────────────────────────────────────
  app.get("/events/:eventId/schedule", { preHandler: [requireAuth] }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const auth = req.user as AuthUser;
    if (!(await belongsToChurch("event", eventId, auth.churchId)))
      return reply.code(404).send({ error: "Evento não encontrado" });
    const items = await prisma.scheduleItem.findMany({
      where: { eventId },
      include: {
        member: { select: { id: true, name: true, photoUrl: true, phone: true } },
        checkin: true,
        swapRequests: { where: { status: "PENDING" } },
      },
    });
    if (!["ADMIN", "MINISTRY_LEADER"].includes(auth.role)) {
      for (const s of items) (s.member as any).phone = null;
    }
    return items;
  });

  // ── Atribuir voluntário (líder) ──────────────────────────────────────
  app.post(
    "/events/:eventId/schedule",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const { eventId } = req.params as { eventId: string };
      const auth = req.user as AuthUser;
      const body = assignSchema.parse(req.body);

      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event || event.churchId !== auth.churchId)
        return reply.code(404).send({ error: "Evento não encontrado" });
      if (!(await belongsToChurch("member", body.memberId, auth.churchId)))
        return reply.code(404).send({ error: "Membro não encontrado" });

      // Indisponibilidade
      if (await isUnavailable(body.memberId, event.date)) {
        return reply.code(409).send({
          error: "Voluntário marcou indisponibilidade nesta data",
          code: "UNAVAILABLE",
        });
      }

      // Conflito de horário com outro ministério/evento
      const conflict = await findConflict(body.memberId, eventId);
      if (conflict && !body.force) {
        return reply.code(409).send({
          error: "Voluntário já escalado em outro evento no mesmo horário",
          code: "CONFLICT",
          conflictEventId: conflict.eventId,
          conflictRole: conflict.roleName,
        });
      }

      const item = await prisma.scheduleItem.create({
        data: { eventId, memberId: body.memberId, roleName: body.roleName },
        include: { member: true, event: true },
      });

      const appUrl = getAppUrl(req);
      const whatsappLink = buildScheduleWhatsAppLink({
        memberName: item.member.name,
        phone: item.member.phone,
        eventTitle: item.event.title,
        eventDate: item.event.startTime,
        roleName: item.roleName,
        confirmUrl: `${appUrl}/escala/${item.id}`,
      });

      notifyMember(body.memberId, {
        type: "SCHEDULE_ASSIGNED",
        title: "Você foi escalado! 🙌",
        body: `${item.event.title} — função: ${item.roleName}`,
        data: { scheduleItemId: item.id, eventId },
        whatsappLink,
      });

      return reply.code(201).send({ ...item, whatsappLink });
    }
  );

  app.delete(
    "/schedule-items/:id",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const church = await itemEventChurch("scheduleItem", id);
      if (!church || church !== (req.user as AuthUser).churchId)
        return reply.code(404).send({ error: "Item de escala não encontrado" });
      try {
        await prisma.scheduleItem.delete({ where: { id } });
        return reply.code(204).send();
      } catch {
        return reply.code(404).send({ error: "Item de escala não encontrado" });
      }
    }
  );

  // ── Aceitar / Recusar (voluntário) ───────────────────────────────────
  app.post("/schedule-items/:id/respond", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    const body = respondSchema.parse(req.body);

    const item = await prisma.scheduleItem.findUnique({
      where: { id },
      include: { member: true, event: true },
    });
    if (!item) return reply.code(404).send({ error: "Item de escala não encontrado" });
    const isSelf = auth.memberId === item.memberId;
    const isAdminSameChurch = auth.role === "ADMIN" && item.event.churchId === auth.churchId;
    if (!isSelf && !isAdminSameChurch)
      return reply.code(403).send({ error: "Só o próprio voluntário pode responder" });
    if (item.status !== "PENDING" && item.status !== "SWAP_REQUESTED")
      return reply.code(409).send({ error: `Escala já respondida (${item.status})` });

    if (body.action === "DECLINE" && !body.reason)
      return reply.code(400).send({ error: "Informe o motivo da recusa" });

    const updated = await prisma.scheduleItem.update({
      where: { id },
      data: {
        status: body.action === "CONFIRM" ? "CONFIRMED" : "DECLINED",
        refusalReason: body.action === "DECLINE" ? body.reason : null,
      },
    });

    if (body.action === "CONFIRM") {
      await prisma.member.update({
        where: { id: item.memberId },
        data: { points: { increment: POINTS.CONFIRM } },
      });
      await checkAndAwardBadges(item.memberId);
    }

    // Notifica líderes do ministério? Simplificação: notifica o próprio membro (feedback) —
    // broadcast a líderes entra com o painel em tempo real da Fase 3.
    notifyMember(item.memberId, {
      type: body.action === "CONFIRM" ? "SCHEDULE_CONFIRMED" : "SCHEDULE_DECLINED",
      title: body.action === "CONFIRM" ? "Presença confirmada ✅" : "Escala recusada",
      body: `${item.event.title} — ${item.roleName}`,
      data: { scheduleItemId: id },
    });

    return updated;
  });

  // ── Solicitar troca ──────────────────────────────────────────────────
  app.post("/schedule-items/:id/swap", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    const body = swapSchema.parse(req.body);

    const item = await prisma.scheduleItem.findUnique({
      where: { id },
      include: { event: true, member: true },
    });
    if (!item) return reply.code(404).send({ error: "Item de escala não encontrado" });
    if (auth.memberId !== item.memberId)
      return reply.code(403).send({ error: "Só o voluntário escalado pode pedir troca" });
    if (!(await belongsToChurch("member", body.targetMemberId, auth.churchId)))
      return reply.code(404).send({ error: "Voluntário alvo não encontrado" });

    // O alvo está disponível?
    if (await isUnavailable(body.targetMemberId, item.event.date))
      return reply.code(409).send({ error: "Voluntário alvo está indisponível nesta data", code: "UNAVAILABLE" });
    const conflict = await findConflict(body.targetMemberId, item.eventId);
    if (conflict)
      return reply.code(409).send({ error: "Voluntário alvo tem conflito de horário", code: "CONFLICT" });

    const [swap] = await prisma.$transaction([
      prisma.swapRequest.create({
        data: { scheduleItemId: id, targetMemberId: body.targetMemberId, message: body.message },
      }),
      prisma.scheduleItem.update({ where: { id }, data: { status: "SWAP_REQUESTED" } }),
    ]);

    notifyMember(body.targetMemberId, {
      type: "SWAP_REQUESTED",
      title: "Pedido de troca de escala 🔄",
      body: `${item.member.name} pediu para você assumir ${item.roleName} em ${item.event.title}`,
      data: { swapRequestId: swap.id, scheduleItemId: id },
    });

    return reply.code(201).send(swap);
  });

  // ── Responder troca (voluntário alvo) ────────────────────────────────
  app.post("/swap-requests/:id/respond", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    const body = swapRespondSchema.parse(req.body);

    const swap = await prisma.swapRequest.findUnique({
      where: { id },
      include: { scheduleItem: { include: { event: true, member: true } } },
    });
    if (!swap) return reply.code(404).send({ error: "Pedido de troca não encontrado" });
    if (auth.memberId !== swap.targetMemberId)
      return reply.code(403).send({ error: "Só o voluntário convidado pode responder" });
    if (swap.status !== "PENDING")
      return reply.code(409).send({ error: `Pedido já respondido (${swap.status})` });

    const original = swap.scheduleItem;

    if (body.action === "ACCEPT") {
      await prisma.$transaction([
        prisma.swapRequest.update({
          where: { id },
          data: { status: "ACCEPTED", respondedAt: new Date() },
        }),
        // Reatribui a vaga ao novo voluntário, já confirmada
        prisma.scheduleItem.update({
          where: { id: original.id },
          data: { memberId: swap.targetMemberId, status: "CONFIRMED", refusalReason: null },
        }),
      ]);
      notifyMember(original.memberId, {
        type: "SWAP_ACCEPTED",
        title: "Troca aceita ✅",
        body: `Sua vaga de ${original.roleName} em ${original.event.title} foi assumida`,
        data: { swapRequestId: id },
      });
    } else {
      await prisma.$transaction([
        prisma.swapRequest.update({
          where: { id },
          data: { status: "DECLINED", respondedAt: new Date() },
        }),
        prisma.scheduleItem.update({ where: { id: original.id }, data: { status: "PENDING" } }),
      ]);
      notifyMember(original.memberId, {
        type: "SWAP_DECLINED",
        title: "Troca recusada",
        body: `O pedido de troca em ${original.event.title} foi recusado — a escala voltou para você`,
        data: { swapRequestId: id },
      });
    }

    return prisma.swapRequest.findUnique({ where: { id } });
  });

  // ── Feed pessoal do voluntário ───────────────────────────────────────
  app.get("/my/schedule", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.memberId) return reply.code(400).send({ error: "Usuário sem membro vinculado" });
    const [items, swapInvites] = await Promise.all([
      prisma.scheduleItem.findMany({
        where: { memberId: auth.memberId, event: { date: { gte: new Date(Date.now() - 864e5) } } },
        include: { event: true, checkin: true },
        orderBy: { event: { date: "asc" } },
      }),
      prisma.swapRequest.findMany({
        where: { targetMemberId: auth.memberId, status: "PENDING" },
        include: { scheduleItem: { include: { event: true, member: true } } },
      }),
    ]);
    return { items, swapInvites };
  });
}
