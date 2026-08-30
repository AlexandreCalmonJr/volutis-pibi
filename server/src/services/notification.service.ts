/**
 * Registro em memória de conexões WebSocket por memberId.
 * Usado para notificar escalas, respostas e trocas em tempo real.
 */
import type { WebSocket } from "ws";
import { prisma } from "../lib/db.js";

const clients = new Map<string, Set<WebSocket>>();

export type NotificationType =
  | "SCHEDULE_ASSIGNED"
  | "SCHEDULE_CONFIRMED"
  | "SCHEDULE_DECLINED"
  | "SCHEDULE_REMINDER"
  | "SWAP_REQUESTED"
  | "SWAP_ACCEPTED"
  | "SWAP_DECLINED"
  | "CHECKIN_DONE"
  | "CHAT_MESSAGE"
  | "BADGE_EARNED"
  | "ANNOUNCEMENT";

export interface Notification {
  id?: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  whatsappLink?: string | null;
  at: string;
  readAt?: string | null;
}

function parseData(data: string | null | undefined): Record<string, unknown> | undefined {
  if (!data) return undefined;
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

export function serializeNotification(notification: {
  id: string;
  type: string;
  title: string;
  body: string;
  data: string | null;
  whatsappLink: string | null;
  createdAt: Date;
  readAt: Date | null;
}): Notification {
  return {
    id: notification.id,
    type: notification.type as NotificationType,
    title: notification.title,
    body: notification.body,
    data: parseData(notification.data),
    whatsappLink: notification.whatsappLink,
    at: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
  };
}

export function registerClient(memberId: string, socket: WebSocket) {
  if (!clients.has(memberId)) clients.set(memberId, new Set());
  clients.get(memberId)!.add(socket);
  socket.on("close", () => {
    clients.get(memberId)?.delete(socket);
    if (clients.get(memberId)?.size === 0) clients.delete(memberId);
  });
}

export async function notifyMember(memberId: string, n: Omit<Notification, "id" | "at" | "readAt">) {
  const created = await prisma.userNotification.create({
    data: {
      memberId,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data ? JSON.stringify(n.data) : null,
      whatsappLink: n.whatsappLink ?? null,
    },
  });

  const message = serializeNotification(created);
  const payload = JSON.stringify(message);
  for (const socket of clients.get(memberId) ?? []) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }

  return message;
}

export function connectedMembers(): string[] {
  return [...clients.keys()];
}

export async function listNotifications(memberId: string, limit = 50, unreadOnly = false) {
  const rows = await prisma.userNotification.findMany({
    where: {
      memberId,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map(serializeNotification);
}

export async function markNotificationAsRead(memberId: string, notificationId: string) {
  const notification = await prisma.userNotification.findFirst({
    where: { id: notificationId, memberId },
  });
  if (!notification) return null;

  const updated = await prisma.userNotification.update({
    where: { id: notificationId },
    data: { readAt: notification.readAt ?? new Date() },
  });

  return serializeNotification(updated);
}

export async function markAllNotificationsAsRead(memberId: string) {
  const now = new Date();
  const result = await prisma.userNotification.updateMany({
    where: { memberId, readAt: null },
    data: { readAt: now },
  });
  return { updatedCount: result.count, readAt: now.toISOString() };
}
