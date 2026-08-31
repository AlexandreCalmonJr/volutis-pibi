import webpush from "web-push";
import { prisma } from "../lib/db.js";
import type { Notification } from "./notification.service.js";

let vapidConfigured = false;

function getConfig() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  return {
    subject,
    publicKey,
    privateKey,
    enabled: !!(subject && publicKey && privateKey),
  };
}

function ensureConfigured() {
  const { enabled, subject, publicKey, privateKey } = getConfig();
  if (!enabled) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(subject!, publicKey!, privateKey!);
    vapidConfigured = true;
  }
  return true;
}

function notificationUrl(notification: Notification) {
  const eventId = typeof notification.data?.eventId === "string" ? notification.data.eventId : null;
  const scheduleItemId = typeof notification.data?.scheduleItemId === "string" ? notification.data.scheduleItemId : null;
  const messageId = typeof notification.data?.messageId === "string" ? notification.data.messageId : null;

  if (notification.type === "CHAT_MESSAGE" && eventId) {
    const params = new URLSearchParams({ tab: "chat", eventId });
    if (messageId) params.set("messageId", messageId);
    return `/comunicacao?${params.toString()}`;
  }

  if (["SCHEDULE_ASSIGNED", "SCHEDULE_REMINDER", "SCHEDULE_CONFIRMED", "SCHEDULE_DECLINED", "CHECKIN_DONE"].includes(notification.type)) {
    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);
    if (scheduleItemId) params.set("scheduleItemId", scheduleItemId);
    return `/escalas${params.toString() ? `?${params.toString()}` : ""}`;
  }

  const params = new URLSearchParams({ tab: "notificacoes" });
  if (notification.id) params.set("notificationId", notification.id);
  return `/comunicacao?${params.toString()}`;
}

export function getPushPublicConfig() {
  const { enabled, publicKey } = getConfig();
  return { enabled, publicKey: enabled ? publicKey ?? null : null };
}

export function isPushConfigured() {
  return getConfig().enabled;
}

export async function countPushSubscriptions(memberId: string) {
  return prisma.pushSubscription.count({ where: { memberId } });
}

export async function upsertPushSubscription(
  memberId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      memberId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    },
    create: {
      memberId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    },
  });
}

export async function removePushSubscription(memberId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { memberId, endpoint } });
}

export async function sendPushToMember(memberId: string, notification: Notification) {
  if (!ensureConfigured()) return { sent: 0, skipped: true };

  const subscriptions = await prisma.pushSubscription.findMany({ where: { memberId } });
  if (!subscriptions.length) return { sent: 0, skipped: true };

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    tag: notification.type,
    data: {
      notificationId: notification.id,
      url: notificationUrl(notification),
      whatsappLink: notification.whatsappLink ?? null,
      ...notification.data,
    },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
          { TTL: 60 }
        );
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: { lastNotifiedAt: new Date() },
        });
        return true;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
        }
        return false;
      }
    })
  );

  return { sent: results.filter((item) => item.status === "fulfilled" && item.value).length, skipped: false };
}
