import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { useAuth, useToasts } from "../store";
import { Button, Card, PageHeader, StatusChip, fmtDate, fmtTime } from "../components/ui";
import { useRealtimeNotifications } from "../ws";

interface FeedItem {
  id: string; status: string; roleName: string;
  event: { id: string; title: string; date: string; startTime: string };
  checkin: { id: string } | null;
}
interface SwapInvite {
  id: string; message: string | null;
  scheduleItem: { roleName: string; member: { name: string }; event: { title: string; startTime: string } };
}

export default function Home() {
  const user = useAuth((s) => s.user);
  const push = useToasts((s) => s.push);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [swapInvites, setSwapInvites] = useState<SwapInvite[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [swapFor, setSwapFor] = useState<string | null>(null); // scheduleItemId em troca
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: FeedItem[]; swapInvites: SwapInvite[] }>("/my/schedule");
      setItems(data.items);
      setSwapInvites(data.swapInvites);
    } catch { /* sem membro vinculado */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeNotifications(() => load());

  async function respond(id: string, action: "CONFIRM" | "DECLINE") {
    let reason: string | undefined;
    if (action === "DECLINE") {
      reason = prompt("Motivo da recusa:") ?? undefined;
      if (!reason) return;
    }
    try {
      await api(`/schedule-items/${id}/respond`, { method: "POST", body: { action, reason } });
      push({ title: action === "CONFIRM" ? "Presença confirmada ✅ (+5 pts)" : "Escala recusada", kind: "ok" });
      load();
    } catch (e: any) { push({ title: e.message, kind: "warn" }); }
  }

  async function openSwap(id: string) {
    if (members.length === 0) {
      const list = await api<{ id: string; name: string }[]>("/members");
      setMembers(list.filter((m) => m.id !== user?.memberId));
    }
    setSwapFor(id);
  }

  async function requestSwap(scheduleItemId: string, targetMemberId: string) {
    try {
      await api(`/schedule-items/${scheduleItemId}/swap`, { method: "POST", body: { targetMemberId } });
      push({ title: "Pedido de troca enviado 🔄", kind: "ok" });
      setSwapFor(null);
      load();
    } catch (e: any) {
      const detail = e instanceof ApiError && e.data?.code === "CONFLICT" ? " (conflito de horário)" : "";
      push({ title: e.message + detail, kind: "warn" });
    }
  }

  async function respondSwap(id: string, action: "ACCEPT" | "DECLINE") {
    try {
      await api(`/swap-requests/${id}/respond`, { method: "POST", body: { action } });
      push({ title: action === "ACCEPT" ? "Você assumiu a escala ✅" : "Troca recusada", kind: "ok" });
      load();
    } catch (e: any) { push({ title: e.message, kind: "warn" }); }
  }

  async function checkin(id: string) {
    try {
      await api(`/schedule-items/${id}/checkin`, { method: "POST", body: { method: "manual" } });
      push({ title: "Check-in realizado ✅ +10 pontos!", kind: "ok" });
      load();
    } catch (e: any) { push({ title: e.message, kind: "warn" }); }
  }

  const pending = items.filter((i) => i.status === "PENDING");
  const upcoming = items.filter((i) => i.status !== "PENDING" && i.status !== "DECLINED");

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-safe">
      <PageHeader title={`Olá! 👋`} subtitle="Suas próximas escalas na PIBI" />

      {loading && <p className="text-sm text-muted">Carregando...</p>}

      {swapInvites.length > 0 && (
        <section className="mb-5 space-y-3">
          <h2 className="text-sm font-semibold text-accent-soft">Convites de troca</h2>
          {swapInvites.map((s) => (
            <Card key={s.id} className="border-accent/40">
              <p className="text-sm">
                <b>{s.scheduleItem.member.name}</b> pediu para você assumir{" "}
                <b>{s.scheduleItem.roleName}</b> em {s.scheduleItem.event.title}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {fmtDate(s.scheduleItem.event.startTime)} · {fmtTime(s.scheduleItem.event.startTime)}
                {s.message && ` — "${s.message}"`}
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="ok" onClick={() => respondSwap(s.id, "ACCEPT")}>Assumir</Button>
                <Button variant="danger" onClick={() => respondSwap(s.id, "DECLINE")}>Recusar</Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      {pending.length > 0 && (
        <section className="mb-5 space-y-3">
          <h2 className="text-sm font-semibold text-warn">Aguardando sua resposta</h2>
          {pending.map((i) => (
            <Card key={i.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{i.event.title}</p>
                  <p className="text-xs text-muted">
                    {fmtDate(i.event.startTime)} · {fmtTime(i.event.startTime)} — {i.roleName}
                  </p>
                </div>
                <StatusChip status={i.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="ok" onClick={() => respond(i.id, "CONFIRM")}>Aceitar</Button>
                <Button variant="danger" onClick={() => respond(i.id, "DECLINE")}>Recusar</Button>
                <Button variant="ghost" onClick={() => openSwap(i.id)}>Solicitar troca</Button>
              </div>
              {swapFor === i.id && (
                <div className="mt-3 rounded-xl bg-surface-2 p-3">
                  <p className="mb-2 text-xs font-medium text-muted">Trocar com quem?</p>
                  <div className="flex flex-wrap gap-2">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => requestSwap(i.id, m.id)}
                        className="rounded-lg bg-surface px-3 py-1.5 text-xs font-medium active:bg-border"
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">Próximos compromissos</h2>
        {upcoming.length === 0 && !loading && (
          <Card><p className="text-sm text-muted">Nenhuma escala futura. Aproveite o descanso! 🌿</p></Card>
        )}
        {upcoming.map((i) => {
          const start = new Date(i.event.startTime).getTime();
          const inWindow = Math.abs(Date.now() - start) < 3 * 3600_000;
          return (
            <Card key={i.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{i.event.title}</p>
                  <p className="text-xs text-muted">
                    {fmtDate(i.event.startTime)} · {fmtTime(i.event.startTime)} — {i.roleName}
                  </p>
                </div>
                <StatusChip status={i.status} />
              </div>
              {i.status === "CONFIRMED" && !i.checkin && inWindow && (
                <Button variant="primary" className="mt-3" onClick={() => checkin(i.id)}>
                  📍 Fazer check-in (+10 pts)
                </Button>
              )}
              {i.checkin && <p className="mt-2 text-xs font-medium text-ok">📍 Check-in feito</p>}
            </Card>
          );
        })}
      </section>
    </div>
  );
}
