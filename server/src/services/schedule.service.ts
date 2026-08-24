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

/** Janela de conflito: eventos que se sobrepõem em ±2h do início */
const CONFLICT_WINDOW_MS = 2 * 60 * 60 * 1000;

export async function findConflict(memberId: string, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return null;

  const existing = await prisma.scheduleItem.findMany({
    where: {
      memberId,
      status: { in: ["PENDING", "CONFIRMED"] },
      eventId: { not: eventId },
    },
    include: { event: true },
  });

  for (const item of existing) {
    const diff = Math.abs(item.event.startTime.getTime() - event.startTime.getTime());
    if (diff < CONFLICT_WINDOW_MS) return item;
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
  roles: string[];
  lastServedAt: Date | null;
  timesServedLast90d: number;
  score: number; // maior = melhor sugestão (menos sobrecarregado)
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
      roles,
      lastServedAt: recent[0]?.event.date ?? null,
      timesServedLast90d: recent.length,
      score: 100 - recent.length * 10, // menos serviços recentes = maior score
    });
  }

  return suggestions.sort((a, b) => b.score - a.score);
}
