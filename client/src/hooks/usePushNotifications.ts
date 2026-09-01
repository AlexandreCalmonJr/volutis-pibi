import { useState, useEffect, useCallback } from "react";
import { getPushConfig, registerPushSubscription, unregisterPushSubscription } from "../push";
import { useAuth } from "../store";

export function usePushNotifications() {
  const user = useAuth((s) => s.user);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [serverEnabled, setServerEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);

    if (!supported) {
      setPermission("unsupported");
      setLoading(false);
      return;
    }

    setPermission(Notification.permission);

    try {
      const config = await getPushConfig();
      setServerEnabled(config.enabled);

      if (config.enabled && Notification.permission === "granted") {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } else {
        setIsSubscribed(false);
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao verificar suporte a notificações.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const enablePush = async (): Promise<boolean> => {
    if (!isSupported) {
      setError("Notificações push não são suportadas neste navegador/dispositivo.");
      return false;
    }

    setBusy(true);
    setError(null);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setError("Permissão para notificações foi negada pelo navegador.");
        return false;
      }

      await registerPushSubscription();
      setIsSubscribed(true);
      return true;
    } catch (err: any) {
      setError(err?.message || "Falha ao ativar notificações.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    setBusy(true);
    setError(null);
    try {
      await unregisterPushSubscription();
      setIsSubscribed(false);
    } catch (err: any) {
      setError(err?.message || "Falha ao desativar notificações.");
    } finally {
      setBusy(false);
    }
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    serverEnabled,
    loading,
    busy,
    error,
    enablePush,
    disablePush,
    refresh: checkStatus,
  };
}
