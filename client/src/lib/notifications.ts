export interface NotificationRouteInput {
  id?: string;
  type: string;
  data?: Record<string, unknown>;
}

export interface NotificationRouteTarget {
  path: string;
  label: string;
}

function readString(data: Record<string, unknown> | undefined, key: string): string | null {
  const value = data?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function resolveNotificationTarget(notification: NotificationRouteInput): NotificationRouteTarget {
  const eventId = readString(notification.data, "eventId");
  const scheduleItemId = readString(notification.data, "scheduleItemId");
  const messageId = readString(notification.data, "messageId");

  if (notification.type === "CHAT_MESSAGE" && eventId) {
    const params = new URLSearchParams({ tab: "chat", eventId });
    if (messageId) params.set("messageId", messageId);
    return { path: `/comunicacao?${params.toString()}`, label: "Abrir chat" };
  }

  if (["SCHEDULE_ASSIGNED", "SCHEDULE_REMINDER", "SCHEDULE_CONFIRMED", "SCHEDULE_DECLINED", "CHECKIN_DONE"].includes(notification.type)) {
    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);
    if (scheduleItemId) params.set("scheduleItemId", scheduleItemId);
    return {
      path: params.toString() ? `/escalas?${params.toString()}` : "/escalas",
      label: "Abrir escala",
    };
  }

  if (["SWAP_REQUESTED", "SWAP_ACCEPTED", "SWAP_DECLINED", "ANNOUNCEMENT", "BADGE_EARNED"].includes(notification.type)) {
    const params = new URLSearchParams({ tab: "notificacoes" });
    if (notification.id) params.set("notificationId", notification.id);
    return {
      path: `/comunicacao?${params.toString()}`,
      label: "Abrir notificação",
    };
  }

  if (eventId) {
    return { path: `/eventos?eventId=${encodeURIComponent(eventId)}`, label: "Abrir evento" };
  }

  return { path: "/comunicacao?tab=notificacoes", label: "Ver detalhes" };
}
