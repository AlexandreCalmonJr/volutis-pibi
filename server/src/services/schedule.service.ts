/**
 * Lógica de escalas inteligentes (core Voluts):
 *  - Sugestão de voluntários por função, excluindo indisponíveis e conflitantes
 *  - Detecção de conflito de horário entre ministérios
 */
import { prisma, fromJson } from "../lib/db.js";

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Duração presumida quando o evento não informa endTime */
const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

function getEventWindow(event: { startTime: Date; endTime: Date | null }) {
  const start = event.startTime.getTime();
  const end = event.endTime?.getTime() ?? start + DEFAULT_EVENT_DURATION_MS;
  return { start, end };
}

function intervalsOverlap(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end;
}

export async function findConflict(memberId: string, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return null;
  const targetWindow = getEventWindow(event);

  const existing = await prisma.scheduleItem.findMany({
    where: {
      memberId,
      status: { in: ["PENDING", "CONFIRMED"] },
      eventId: { not: eventId },
    },
    include: { event: true },
  });

  for (const item of existing) {
    const scheduledWindow = getEventWindow(item.event);
    if (intervalsOverlap(targetWindow, scheduledWindow)) return item;
  }
  return null;
}

export async function isUnavailable(memberId: string, date: Date) {
  const items = await prisma.unavailability.findMany({ where: { memberId } });
  return items.some((u) => {
    if (u.recurring) return u.date.getDay() === date.getDay();
    return sameDay(u.date, date);
  });
}

export interface Suggestion {
  memberId: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  avatarKey: string | null;
  roles: string[];
  lastServedAt: Date | null;
  timesServedLast90d: number;
  score: number; // maior = melhor sugestão (menos sobrecarregado)
}

export async function getEligibleMinistryMembershipsForRole(
  memberId: string,
  churchId: string,
  roleName: string
) {
  const memberships = await prisma.ministryMember.findMany({
    where: {
      memberId,
      ministry: { churchId },
    },
    include: {
      ministry: {
        include: { roles: true },
      },
    },
  });

  return memberships.filter((membership) => {
    const ministryRoles = membership.ministry.roles.map((role) => role.name);
    if (!ministryRoles.includes(roleName)) return false;

    const assignedRoles = fromJson(membership.roles);
    return assignedRoles.length === 0 || assignedRoles.includes(roleName);
  });
}

/**
 * Sugere voluntários de um ministério para uma função em um evento.
 * Ordena por menor carga recente (revezamento justo).
 */
export async function suggestVolunteers(
  ministryId: string,
  roleName: string,
  eventId: string
): Promise<Suggestion[]> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return [];

  const candidates = await prisma.ministryMember.findMany({
    where: { ministryId },
    include: { member: true },
  });

  const ninetyDaysAgo = new Date(Date.now() - 90 * 864e5);
  const suggestions: Suggestion[] = [];

  for (const mm of candidates) {
    const roles = fromJson(mm.roles);
    if (roles.length > 0 && !roles.includes(roleName)) continue;

    if (await isUnavailable(mm.memberId, event.date)) continue;
    if (await findConflict(mm.memberId, eventId)) continue;

    // Já escalado neste evento?
    const already = await prisma.scheduleItem.findFirst({
      where: { eventId, memberId: mm.memberId, status: { not: "DECLINED" } },
    });
    if (already) continue;

    const recent = await prisma.scheduleItem.findMany({
      where: {
        memberId: mm.memberId,
        status: "CONFIRMED",
        event: { date: { gte: ninetyDaysAgo, lt: event.date } },
      },
      include: { event: true },
      orderBy: { event: { date: "desc" } },
    });

    suggestions.push({
      memberId: mm.memberId,
      name: mm.member.name,
      phone: mm.member.phone,
      photoUrl: mm.member.photoUrl,
      avatarKey: mm.member.avatarKey,
      roles,
      lastServedAt: recent[0]?.event.date ?? null,
      timesServedLast90d: recent.length,
      score: 100 - recent.length * 10, // menos serviços recentes = maior score
    });
  }

  return suggestions.sort((a, b) => b.score - a.score);
}

export interface AutoGenerateOptions {
  churchId: string;
  year: number;
  month: number; // 1 to 12
  ministryId?: string;
  overwrite?: boolean;
}

export interface AutoGenerateResult {
  month: number;
  year: number;
  eventsProcessed: number;
  rolesAssigned: number;
  skippedRoles: number;
  assignments: Array<{
    scheduleItemId: string;
    eventId: string;
    memberId: string;
    eventTitle: string;
    eventStartTime: Date;
    ministryName: string;
    roleName: string;
    memberName: string;
    memberPhone: string | null;
  }>;
}

/**
 * Gera automaticamente as escalas do mês para os eventos da igreja.
 * Utiliza o motor inteligente de rotação justa, respeitando indisponibilidades e evitando conflitos de horários.
 */
export async function autoGenerateMonthlySchedule(
  options: AutoGenerateOptions
): Promise<AutoGenerateResult> {
  const { churchId, year, month, ministryId, overwrite = false } = options;

  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const events = await prisma.event.findMany({
    where: {
      churchId,
      date: { gte: startOfMonth, lte: endOfMonth },
    },
    orderBy: { date: "asc" },
    include: {
      scheduleItems: {
        include: { member: true },
      },
    },
  });

  const ministries = await prisma.ministry.findMany({
    where: {
      churchId,
      ...(ministryId ? { id: ministryId } : {}),
    },
    include: {
      roles: true,
      members: {
        include: { member: true },
      },
    },
  });

  let rolesAssigned = 0;
  let skippedRoles = 0;
  const assignments: AutoGenerateResult["assignments"] = [];

  for (const event of events) {
    for (const ministry of ministries) {
      for (const role of ministry.roles) {
        // Verifica se a função já está preenchida
        const alreadyScheduled = event.scheduleItems.find(
          (s) => s.roleName === role.name && s.status !== "DECLINED"
        );

        if (alreadyScheduled && !overwrite) {
          continue;
        }

        if (alreadyScheduled && overwrite && alreadyScheduled.status === "PENDING") {
          await prisma.scheduleItem.delete({
            where: { id: alreadyScheduled.id },
          });
        }

        // Busca sugestão com melhor score (revezamento justo)
        const suggestions = await suggestVolunteers(ministry.id, role.name, event.id);

        if (suggestions.length > 0) {
          const chosen = suggestions[0];

          const item = await prisma.scheduleItem.create({
            data: {
              eventId: event.id,
              memberId: chosen.memberId,
              roleName: role.name,
              status: "PENDING",
            },
            include: {
              member: true,
              event: true,
            },
          });

          // Atualiza o estado em memória para as próximas funções do mesmo evento
          event.scheduleItems.push(item as any);

          rolesAssigned++;
          assignments.push({
            scheduleItemId: item.id,
            eventId: event.id,
            memberId: chosen.memberId,
            eventTitle: event.title,
            eventStartTime: item.event.startTime,
            ministryName: ministry.name,
            roleName: role.name,
            memberName: chosen.name,
            memberPhone: chosen.phone,
          });
        } else {
          skippedRoles++;
        }
      }
    }
  }

  return {
    month,
    year,
    eventsProcessed: events.length,
    rolesAssigned,
    skippedRoles,
    assignments,
  };
}
