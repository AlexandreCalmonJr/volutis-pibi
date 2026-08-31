import { api } from "./api";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function getPushConfig() {
  return api<{ enabled: boolean; publicKey: string | null }>("/push/config");
}

export async function registerPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications não são suportadas neste dispositivo.");
  }

  const config = await getPushConfig();
  if (!config.enabled || !config.publicKey) {
    throw new Error("Push notifications ainda não foram configuradas no servidor.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    }));

  await api("/push/subscriptions", {
    method: "POST",
    body: subscription.toJSON(),
  });

  return subscription;
}

export async function unregisterPushSubscription() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await api("/push/subscriptions", { method: "DELETE", body: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe().catch(() => {});
}
