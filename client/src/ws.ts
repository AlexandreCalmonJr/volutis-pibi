/**
 * Hook de notificações em tempo real via WebSocket.
 * Reconecta automaticamente e empurra toasts.
 */
import { useEffect, useRef } from "react";
import { useAuth, useNotifications, useToasts } from "./store";

export function useRealtimeNotifications(onEvent?: (n: any) => void) {
  const accessToken = useAuth((s) => s.accessToken);
  const push = useToasts((s) => s.push);
  const upsertNotification = useNotifications((s) => s.upsert);
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!accessToken) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const base = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace(/^http/, "ws")
        : `${proto}://${location.host}`;
      ws = new WebSocket(`${base}/ws?token=${accessToken}`);
      ws.onopen = () => { retry = 0; };
      ws.onmessage = (e) => {
        try {
          const n = JSON.parse(e.data);
          if (n.type !== "CONNECTED") {
            push({
              title: n.title,
              body: n.body,
              kind: n.type.includes("DECLINED") ? "warn" : "ok",
              whatsappLink: n.whatsappLink,
            });
            if (n.id) upsertNotification(n);
          }
          cbRef.current?.(n);
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        if (!closed && retry < 8) setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
      };
    };
    connect();
    return () => { closed = true; ws?.close(); };
  }, [accessToken, push, upsertNotification]);
}
