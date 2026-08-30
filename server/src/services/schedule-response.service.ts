import { prisma } from "../lib/db.js";
import { checkAndAwardBadges, POINTS } from "./gamification.service.js";
import { notifyMember } from "./notification.service.js";
import { sendDeclineAlertToLeader } from "./whatsapp.service.js";

export type ScheduleAction = "CONFIRM" | "DECLINE";

const RESPONSIVE_STATUSES = ["PENDING", "SWAP_REQUESTED"] as const;

export function getScheduleReplyCode(scheduleItemId: string): string {
  return scheduleItemId.slice(0, 10).toUpperCase();
}

function createResponseError(statusCode: number, message: string, code?: string) {
  const error = new Error(message) as Error & { statusCode: number; code?: string };
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

async function notifyLeadersAboutDecline(item: {
  event: { churchId: string; title: string };
  member: { name: string };
  roleName: string;
}, reason?: string) {
  const leaders = await prisma.ministryMember.findMany({
    where: { isLeader: true, member: { churchId: item.event.churchId } },
    include: { member: true },
    take: 3,
  });

  await Promise.allSettled(
    leaders.map((leader) => {
      if (!leader.member.phone) return Promise.resolve(false);
      return sendDeclineAlertToLeader({
        leaderName: leader.member.name,
        leaderPhone: leader.member.phone,
        memberName: item.member.name,
        eventTitle: item.event.title,
        roleName: item.roleName,
        reason,
      });
    })
  );
}

export async function respondToScheduleItem(params: {
  scheduleItemId: string;
  actorMemberId?: string;
  actorRole?: string;
  actorChurchId?: string;
  action: ScheduleAction;
  reason?: string;
}) {
  const { scheduleItemId, actorMemberId, actorRole, actorChurchId, action, reason } = params;

  const item = await prisma.scheduleItem.findUnique({
    where: { id: scheduleItemId },
    include: { member: true, event: true },
  });
  if (!item) throw createResponseError(404, "Item de escala não encontrado", "NOT_FOUND");

  const isSelf = actorMemberId === item.memberId;
  const isAdminSameChurch = actorRole === "ADMIN" && item.event.churchId === actorChurchId;
  if (!isSelf && !isAdminSameChurch) {
    throw createResponseError(403, "Só o próprio voluntário pode responder", "FORBIDDEN");
  }

  if (!RESPONSIVE_STATUSES.includes(item.status as (typeof RESPONSIVE_STATUSES)[number])) {
    throw createResponseError(409, `Escala já respondida (${item.status})`, "ALREADY_RESPONDED");
  }

  if (action === "DECLINE" && !reason) {
    throw createResponseError(400, "Informe o motivo da recusa", "DECLINE_REASON_REQUIRED");
  }

  const updated = await prisma.scheduleItem.update({
    where: { id: scheduleItemId },
    data: {
      status: action === "CONFIRM" ? "CONFIRMED" : "DECLINED",
      refusalReason: action === "DECLINE" ? reason : null,
    },
  });

  let newBadges: string[] = [];

  if (action === "CONFIRM") {
    await prisma.member.update({
      where: { id: item.memberId },
      data: { points: { increment: POINTS.CONFIRM } },
    });
    newBadges = await checkAndAwardBadges(item.memberId);
  } else {
    await notifyLeadersAboutDecline(item, reason);
  }

  await notifyMember(item.memberId, {
    type: action === "CONFIRM" ? "SCHEDULE_CONFIRMED" : "SCHEDULE_DECLINED",
    title: action === "CONFIRM" ? "Presença confirmada ✅" : "Escala recusada",
    body: `${item.event.title} — ${item.roleName}`,
    data: { scheduleItemId, eventId: item.eventId, action, newBadges },
  });

  return { updated, newBadges, item };
}

export async function resolvePendingScheduleItemForMember(memberId: string, scheduleIdentifier?: string) {
  const pendingItems = await prisma.scheduleItem.findMany({
    where: {
      memberId,
      status: { in: [...RESPONSIVE_STATUSES] },
    },
    include: { event: true, member: true },
    orderBy: { event: { date: "asc" } },
  });

  if (pendingItems.length === 0) {
    return { error: "NO_PENDING", items: [] as typeof pendingItems };
  }

  if (scheduleIdentifier) {
    const normalized = scheduleIdentifier.trim().toLowerCase();
    const matches = pendingItems.filter((item) => {
      const code = getScheduleReplyCode(item.id).toLowerCase();
      return item.id.toLowerCase() === normalized || item.id.toLowerCase().startsWith(normalized) || code === normalized;
    });

    if (matches.length === 1) {
      return { item: matches[0], items: pendingItems };
    }

    return { error: matches.length > 1 ? "AMBIGUOUS" : "NOT_FOUND", items: pendingItems };
  }

  if (pendingItems.length > 1) {
    return { error: "AMBIGUOUS", items: pendingItems };
  }

  return { item: pendingItems[0], items: pendingItems };
}

export async function respondToScheduleByPhone(params: {
  phone: string;
  action: ScheduleAction;
  scheduleIdentifier?: string;
  reason?: string;
}) {
  const { phone, action, scheduleIdentifier, reason } = params;

  const member = await prisma.member.findFirst({ where: { phone } });
  if (!member) {
    return { ok: false as const, code: "MEMBER_NOT_FOUND" };
  }

  const resolved = await resolvePendingScheduleItemForMember(member.id, scheduleIdentifier);
  if (!resolved.item) {
    return { ok: false as const, code: resolved.error ?? "NO_PENDING", items: resolved.items ?? [], memberId: member.id };
  }

  const result = await respondToScheduleItem({
    scheduleItemId: resolved.item.id,
    actorMemberId: member.id,
    actorRole: "VOLUNTEER",
    actorChurchId: resolved.item.event.churchId,
    action,
    reason,
  });

  return {
    ok: true as const,
    memberId: member.id,
    scheduleItem: resolved.item,
    updated: result.updated,
    newBadges: result.newBadges,
  };
}
