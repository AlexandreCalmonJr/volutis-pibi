/**
 * Badges automáticos — premiados após confirmações e check-ins.
 */
import { prisma } from "../lib/db.js";
import { notifyMember } from "./notification.service.js";

export const POINTS = {
  CONFIRM: 5,
  CHECKIN: 10,
} as const;

interface BadgeRule {
  name: string;
  icon: string;
  check: (stats: MemberStats) => boolean;
}

interface MemberStats {
  checkins: number;
  confirmations: number;
  points: number;
}

const RULES: BadgeRule[] = [
  { name: "Primeiro Check-in", icon: "🎉", check: (s) => s.checkins >= 1 },
  { name: "Presença Fiel", icon: "🛡️", check: (s) => s.checkins >= 10 },
  { name: "Coluna da Casa", icon: "🏛️", check: (s) => s.checkins >= 25 },
  { name: "Pronto para Servir", icon: "🙋", check: (s) => s.confirmations >= 5 },
  { name: "Servo Constante", icon: "⭐", check: (s) => s.confirmations >= 20 },
  { name: "Centurião", icon: "💯", check: (s) => s.points >= 100 },
];

export async function checkAndAwardBadges(memberId: string): Promise<string[]> {
  const [member, checkins, confirmations, existing] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId } }),
    prisma.checkIn.count({ where: { memberId } }),
    prisma.scheduleItem.count({ where: { memberId, status: "CONFIRMED" } }),
    prisma.badge.findMany({ where: { memberId }, select: { name: true } }),
  ]);
  if (!member) return [];

  const stats: MemberStats = { checkins, confirmations, points: member.points };
  const owned = new Set(existing.map((b) => b.name));
  const earned: string[] = [];

  for (const rule of RULES) {
    if (owned.has(rule.name) || !rule.check(stats)) continue;
    await prisma.badge.create({
      data: { memberId, name: rule.name, icon: rule.icon },
    });
    earned.push(rule.name);
    await notifyMember(memberId, {
      type: "BADGE_EARNED",
      title: `Nova conquista ${rule.icon}`,
      body: `Você ganhou o badge "${rule.name}"!`,
      data: { badge: rule.name },
    });
  }
  return earned;
}
