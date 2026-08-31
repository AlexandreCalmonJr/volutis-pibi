import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, belongsToChurch, itemEventChurch } from "../lib/db.js";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.js";
import {
  findConflict,
  isUnavailable,
  suggestVolunteers,
  autoGenerateMonthlySchedule,
  getEligibleMinistryMembershipsForRole,
} from "../services/schedule.service.js";
import { respondToScheduleItem } from "../services/schedule-response.service.js";
import { notifyMember } from "../services/notification.service.js";
import {
  buildScheduleWhatsAppLink,
  sendScheduleAssignedWhatsApp,
} from "../services/whatsapp.service.js";

function formatNotificationDateTime(date: Date) {
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function dispatchScheduleAssignedNotification(params: {
  memberId: string;
  memberName: string;
  memberPhone: string | null;
  eventId: string;
  eventTitle: string;
  eventStartTime: Date;
  roleName: string;
  scheduleItemId: string;
  appUrl: string;
}) {
  const { memberId, memberName, memberPhone, eventId, eventTitle, eventStartTime, roleName, scheduleItemId, appUrl } = params;
  const confirmUrl = `${appUrl}/escala/${scheduleItemId}`;
  const whenText = formatNotificationDateTime(eventStartTime);
  const whatsappLink = buildScheduleWhatsAppLink({
    memberName,
    phone: memberPhone,
    eventTitle,
    eventDate: eventStartTime,
    roleName,
    scheduleItemId,
    confirmUrl,
  });

  await notifyMember(memberId, {
    type: "SCHEDULE_ASSIGNED",
    title: "Você foi escalado! 🙌",
    body: `${eventTitle} em ${whenText} — função: ${roleName}`,
    data: { scheduleItemId, eventId },
    whatsappLink,
  });

  const whatsappSent = await sendScheduleAssignedWhatsApp({
    memberName,
    phone: memberPhone,
    eventTitle,
    eventDate: eventStartTime,
    roleName,
    scheduleItemId,
    confirmUrl,
  }).catch(() => false);

  return { whatsappLink, whatsappSent };
}

const autoGenerateSchema = z.object({
  year: z.number().int().min(2020).max(2050),
  month: z.number().int().min(1).max(12),
  ministryId: z.string().optional(),
  overwrite: z.boolean().optional().default(false),
});

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

const importScheduleSchema = z.object({
  notify: z.boolean().default(true),
  overwritePending: z.boolean().default(false),
  createMissingEvents: z.boolean().default(true),
  rows: z.array(z.object({
    eventTitle: z.string().min(2),
    eventType: z.string().optional(),
    date: z.string().min(8),
    startTime: z.string().min(4),
    endTime: z.string().optional(),
    roleName: z.string().min(1),
    memberName: z.string().min(2),
    memberEmail: z.string().email().optional(),
    memberPhone: z.string().optional(),
    force: z.boolean().optional(),
  })).min(1),
});

const previewScheduleSchema = importScheduleSchema.pick({ createMissingEvents: true, rows: true });

function getAppUrl(req: any): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const origin = req.headers.origin;
  if (origin) return origin;
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  return host ? `${proto}://${host}` : "http://localhost:5173";
}

function parseImportDate(input: string) {
  const raw = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseImportDateTime(dateInput: string, timeInput: string) {
  const date = parseImportDate(dateInput);
  if (!date) return null;
  const time = timeInput.trim();
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(match[1]), Number(match[2]), 0, 0);
}

function normalizePhone(input?: string) {
  if (!input) return undefined;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `55${digits.slice(0, 2)}9${digits.slice(2)}`;
  if (digits.length === 11) return `55${digits}`;
  if (digits.length === 13 && digits.startsWith("55")) return digits;
  return digits.length >= 10 ? digits : undefined;
}

async function resolveMemberForImport(churchId: string, row: z.infer<typeof importScheduleSchema>["rows"][number]) {
  return row.memberEmail
    ? prisma.member.findFirst({ where: { churchId, user: { email: row.memberEmail.trim().toLowerCase() } } })
    : row.memberPhone
      ? prisma.member.findFirst({ where: { churchId, phone: normalizePhone(row.memberPhone) } })
      : prisma.member.findFirst({ where: { churchId, name: row.memberName.trim() } });
}

export async function scheduleRoutes(app: FastifyInstance) {
  // ── Gerar Escala Automática do Mês ───────────────────────────────────
  app.post(
    "/schedules/auto-generate",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const auth = req.user as AuthUser;
      if (!auth.churchId) {
        return reply.code(400).send({ error: "Igreja não identificada no usuário autenticado" });
      }
      const body = autoGenerateSchema.parse(req.body);
      if (body.ministryId && !(await belongsToChurch("ministry", body.ministryId, auth.churchId))) {
        return reply.code(404).send({ error: "Ministério não encontrado" });
      }

      const result = await autoGenerateMonthlySchedule({
        churchId: auth.churchId,
        year: body.year,
        month: body.month,
        ministryId: body.ministryId,
        overwrite: body.overwrite,
      });

      const appUrl = getAppUrl(req);
      const notificationResults = await Promise.allSettled(
        result.assignments.map((assignment) =>
          dispatchScheduleAssignedNotification({
            memberId: assignment.memberId,
            memberName: assignment.memberName,
            memberPhone: assignment.memberPhone,
            eventId: assignment.eventId,
            eventTitle: assignment.eventTitle,
            eventStartTime: assignment.eventStartTime,
            roleName: assignment.roleName,
            scheduleItemId: assignment.scheduleItemId,
            appUrl,
          })
        )
      );

      const whatsappNotificationsSent = notificationResults.filter(
        (entry) => entry.status === "fulfilled" && entry.value.whatsappSent
      ).length;

      return {
        ...result,
        notificationsSent: result.assignments.length,
        whatsappNotificationsSent,
      };
    }
  );

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
        member: { select: { id: true, name: true, photoUrl: true, avatarKey: true, phone: true } },
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

      const eligibleMemberships = await getEligibleMinistryMembershipsForRole(
        body.memberId,
        auth.churchId,
        body.roleName
      );
      if (eligibleMemberships.length === 0) {
        return reply.code(409).send({
          error: "Voluntário não está vinculado a um ministério compatível com esta função",
          code: "ROLE_NOT_ALLOWED",
        });
      }

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
      const { whatsappLink } = await dispatchScheduleAssignedNotification({
        memberId: body.memberId,
        memberName: item.member.name,
        memberPhone: item.member.phone,
        eventId,
        eventTitle: item.event.title,
        eventStartTime: item.event.startTime,
        roleName: item.roleName,
        scheduleItemId: item.id,
        appUrl,
      });

      return reply.code(201).send({ ...item, whatsappLink });
    }
  );

  app.post(
    "/schedules/import/preview",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const auth = req.user as AuthUser;
      if (!auth.churchId) return reply.code(400).send({ error: "Igreja não identificada no usuário autenticado" });
      const body = previewScheduleSchema.parse(req.body);

      const previewRows: Array<{ row: number; eventTitle: string; roleName: string; memberName: string; status: "ready" | "warning" | "error"; message: string }> = [];
      let ready = 0;
      let warnings = 0;
      let errors = 0;

      for (const [index, row] of body.rows.entries()) {
        const eventDate = parseImportDate(row.date);
        const startTime = parseImportDateTime(row.date, row.startTime);
        if (!eventDate || !startTime) {
          previewRows.push({ row: index + 1, eventTitle: row.eventTitle, roleName: row.roleName, memberName: row.memberName, status: "error", message: "Data ou horário inválidos" });
          errors++;
          continue;
        }

        const member = await resolveMemberForImport(auth.churchId, row);
        if (!member) {
          previewRows.push({ row: index + 1, eventTitle: row.eventTitle, roleName: row.roleName, memberName: row.memberName, status: "error", message: "Voluntário não encontrado" });
          errors++;
          continue;
        }

        const startOfDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 23, 59, 59, 999);
        const event = await prisma.event.findFirst({ where: { churchId: auth.churchId, title: row.eventTitle.trim(), date: { gte: startOfDay, lte: endOfDay } } });
        const eligible = await getEligibleMinistryMembershipsForRole(member.id, auth.churchId, row.roleName.trim());
        const hasConflict = event ? !!(await findConflict(member.id, event.id)) : false;

        if (eligible.length === 0) {
          previewRows.push({ row: index + 1, eventTitle: row.eventTitle, roleName: row.roleName, memberName: row.memberName, status: "error", message: "Voluntário sem vínculo compatível" });
          errors++;
        } else if (!event && body.createMissingEvents) {
          previewRows.push({ row: index + 1, eventTitle: row.eventTitle, roleName: row.roleName, memberName: row.memberName, status: "warning", message: "Evento será criado na importação" });
          warnings++;
        } else if (!event) {
          previewRows.push({ row: index + 1, eventTitle: row.eventTitle, roleName: row.roleName, memberName: row.memberName, status: "error", message: "Evento não encontrado" });
          errors++;
        } else if (hasConflict) {
          previewRows.push({ row: index + 1, eventTitle: row.eventTitle, roleName: row.roleName, memberName: row.memberName, status: "warning", message: "Possível conflito de horário" });
          warnings++;
        } else {
          previewRows.push({ row: index + 1, eventTitle: row.eventTitle, roleName: row.roleName, memberName: row.memberName, status: "ready", message: "Pronta para importar" });
          ready++;
        }
      }

      return { summary: { total: body.rows.length, ready, warnings, errors }, rows: previewRows };
    }
  );

  app.post(
    "/schedules/import",
    { preHandler: [requireRole("MINISTRY_LEADER")] },
    async (req, reply) => {
      const auth = req.user as AuthUser;
      if (!auth.churchId) return reply.code(400).send({ error: "Igreja não identificada no usuário autenticado" });
      const body = importScheduleSchema.parse(req.body);
      const appUrl = getAppUrl(req);

      const summary = {
        imported: 0,
        createdEvents: 0,
        notified: 0,
        skipped: 0,
        errors: [] as Array<{ row: number; message: string }>,
      };

      for (const [index, row] of body.rows.entries()) {
        try {
          const eventDate = parseImportDate(row.date);
          const startTime = parseImportDateTime(row.date, row.startTime);
          const endTime = row.endTime ? parseImportDateTime(row.date, row.endTime) : null;

          if (!eventDate || !startTime) {
            summary.skipped++;
            summary.errors.push({ row: index + 1, message: "Data ou horário inválidos" });
            continue;
          }

          const member = await resolveMemberForImport(auth.churchId, row);

          if (!member) {
            summary.skipped++;
            summary.errors.push({ row: index + 1, message: `Voluntário não encontrado: ${row.memberName}` });
            continue;
          }

          const startOfDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 0, 0, 0, 0);
          const endOfDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 23, 59, 59, 999);

          let event = await prisma.event.findFirst({
            where: {
              churchId: auth.churchId,
              title: row.eventTitle.trim(),
              date: { gte: startOfDay, lte: endOfDay },
            },
          });

          if (!event && body.createMissingEvents) {
            event = await prisma.event.create({
              data: {
                churchId: auth.churchId,
                title: row.eventTitle.trim(),
                type: row.eventType?.trim() || "SPECIAL_EVENT",
                date: eventDate,
                startTime,
                endTime: endTime ?? undefined,
              },
            });
            summary.createdEvents++;
          }

          if (!event) {
            summary.skipped++;
            summary.errors.push({ row: index + 1, message: `Evento não encontrado: ${row.eventTitle}` });
            continue;
          }

          const eligible = await getEligibleMinistryMembershipsForRole(member.id, auth.churchId, row.roleName.trim());
          if (eligible.length === 0) {
            summary.skipped++;
            summary.errors.push({ row: index + 1, message: `Voluntário sem vínculo compatível para ${row.roleName}` });
            continue;
          }

          if (await isUnavailable(member.id, event.date)) {
            summary.skipped++;
            summary.errors.push({ row: index + 1, message: `Voluntário indisponível nesta data: ${row.memberName}` });
            continue;
          }

          const conflict = await findConflict(member.id, event.id);
          if (conflict && !row.force) {
            summary.skipped++;
            summary.errors.push({ row: index + 1, message: `Conflito de horário para ${row.memberName}` });
            continue;
          }

          const existing = await prisma.scheduleItem.findFirst({
            where: { eventId: event.id, memberId: member.id, roleName: row.roleName.trim() },
          });

          if (existing) {
            if (body.overwritePending && existing.status === "PENDING") {
              await prisma.scheduleItem.delete({ where: { id: existing.id } });
            } else {
              summary.skipped++;
              summary.errors.push({ row: index + 1, message: `Escala já existente para ${row.memberName} em ${row.roleName}` });
              continue;
            }
          }

          const item = await prisma.scheduleItem.create({
            data: {
              eventId: event.id,
              memberId: member.id,
              roleName: row.roleName.trim(),
              status: "PENDING",
            },
            include: { member: true, event: true },
          });

          if (body.notify) {
            await dispatchScheduleAssignedNotification({
              memberId: member.id,
              memberName: item.member.name,
              memberPhone: item.member.phone,
              eventId: event.id,
              eventTitle: item.event.title,
              eventStartTime: item.event.startTime,
              roleName: item.roleName,
              scheduleItemId: item.id,
              appUrl,
            });
            summary.notified++;
          }

          summary.imported++;
        } catch (error: any) {
          summary.skipped++;
          summary.errors.push({ row: index + 1, message: error?.message || "Erro inesperado ao importar a linha" });
        }
      }

      return summary;
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

    const result = await respondToScheduleItem({
      scheduleItemId: id,
      actorMemberId: auth.memberId,
      actorRole: auth.role,
      actorChurchId: auth.churchId,
      action: body.action,
      reason: body.reason,
    });

    return result.updated;
  });

  // ── Solicitar troca ──────────────────────────────────────────────────
  app.post("/schedule-items/:id/swap", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = req.user as AuthUser;
    const body = swapSchema.parse(req.body);

    if (!auth.churchId) {
      return reply.code(400).send({ error: "Igreja não identificada no usuário autenticado" });
    }

    const item = await prisma.scheduleItem.findUnique({
      where: { id },
      include: { event: true, member: true },
    });
    if (!item) return reply.code(404).send({ error: "Item de escala não encontrado" });
    if (auth.memberId !== item.memberId)
      return reply.code(403).send({ error: "Só o voluntário escalado pode pedir troca" });
    if (!(await belongsToChurch("member", body.targetMemberId, auth.churchId)))
      return reply.code(404).send({ error: "Voluntário alvo não encontrado" });

    const targetEligibleMemberships = await getEligibleMinistryMembershipsForRole(
      body.targetMemberId,
      auth.churchId,
      item.roleName
    );
    if (targetEligibleMemberships.length === 0)
      return reply.code(409).send({ error: "Voluntário alvo não pode assumir esta função", code: "ROLE_NOT_ALLOWED" });

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

    await notifyMember(body.targetMemberId, {
      type: "SWAP_REQUESTED",
      title: "Pedido de troca de escala 🔄",
      body: `${item.member.name} pediu para você assumir ${item.roleName} em ${item.event.title}`,
      data: { swapRequestId: swap.id, scheduleItemId: id, eventId: item.eventId },
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
      await notifyMember(original.memberId, {
        type: "SWAP_ACCEPTED",
        title: "Troca aceita ✅",
        body: `Sua vaga de ${original.roleName} em ${original.event.title} foi assumida`,
        data: { swapRequestId: id, scheduleItemId: original.id, eventId: original.eventId },
      });
    } else {
      await prisma.$transaction([
        prisma.swapRequest.update({
          where: { id },
          data: { status: "DECLINED", respondedAt: new Date() },
        }),
        prisma.scheduleItem.update({ where: { id: original.id }, data: { status: "PENDING" } }),
      ]);
      await notifyMember(original.memberId, {
        type: "SWAP_DECLINED",
        title: "Troca recusada",
        body: `O pedido de troca em ${original.event.title} foi recusado — a escala voltou para você`,
        data: { swapRequestId: id, scheduleItemId: original.id, eventId: original.eventId },
      });
    }

    return prisma.swapRequest.findUnique({ where: { id } });
  });

  // ── Feed pessoal do voluntário ───────────────────────────────────────
  app.get("/my/schedule", { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = req.user as AuthUser;
    if (!auth.memberId) return reply.code(400).send({ error: "Usuário sem membro vinculado" });
    const { scope } = (req.query as { scope?: string }) ?? {};
    const includeAllHistory = scope === "all";
    const [items, swapInvites] = await Promise.all([
      prisma.scheduleItem.findMany({
        where: {
          memberId: auth.memberId,
          ...(includeAllHistory ? {} : { event: { date: { gte: new Date(Date.now() - 864e5) } } }),
        },
        include: { event: true, checkin: true },
        orderBy: { event: { date: includeAllHistory ? "desc" : "asc" } },
      }),
      prisma.swapRequest.findMany({
        where: { targetMemberId: auth.memberId, status: "PENDING" },
        include: { scheduleItem: { include: { event: true, member: true } } },
      }),
    ]);
    return { items, swapInvites };
  });
}
