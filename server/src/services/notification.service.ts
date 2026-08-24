/**
 * Registro em memória de conexões WebSocket por memberId.
 * Usado para notificar escalas, respostas e trocas em tempo real.
 */
import type { WebSocket } from "ws";

const clients = new Map<string, Set<WebSocket>>();

export type NotificationType =
  | "SCHEDULE_ASSIGNED"
  | "SCHEDULE_CONFIRMED"
  | "SCHEDULE_DECLINED"
  | "SWAP_REQUESTED"
  | "SWAP_ACCEPTED"
  | "SWAP_DECLINED"
  | "CHECKIN_DONE"
  | "CHAT_MESSAGE"
  | "BADGE_EARNED";

export interface Notification {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  whatsappLink?: string | null;
  at: string;
}

export function registerClient(memberId: string, socket: WebSocket) {
  if (!clients.has(memberId)) clients.set(memberId, new Set());
  clients.get(memberId)!.add(socket);
  socket.on("close", () => {
    clients.get(memberId)?.delete(socket);
    if (clients.get(memberId)?.size === 0) clients.delete(memberId);
  });
}

export function notifyMember(memberId: string, n: Omit<Notification, "at">) {
  const payload = JSON.stringify({ ...n, at: new Date().toISOString() });
  for (const socket of clients.get(memberId) ?? []) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}

export function connectedMembers(): string[] {
  return [...clients.keys()];
}
