import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Card, PageHeader, StatusChip, fmtDate, fmtTime } from "../components/ui";

interface EventRow {
  id: string; title: string; type: string; date: string; startTime: string;
  scheduleItems: { id: string; status: string; roleName: string; member: { name: string } }[];
}

const TYPE_ICON: Record<string, string> = {
  SUNDAY_MORNING: "🌅", SUNDAY_EVENING: "🌙", WEDNESDAY_PRAYER: "🙏",
  REHEARSAL: "🎸", SPECIAL_EVENT: "✨",
};

export default function Schedule() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 30 * 864e5).toISOString();
    api<EventRow[]>(`/events?from=${from}&to=${to}`).then(setEvents).catch(() => {});
  }, []);

  // Agrupa por semana
  const byDay = events.reduce<Record<string, EventRow[]>>((acc, e) => {
    const key = fmtDate(e.date);
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-safe">
      <PageHeader title="Agenda" subtitle="Cultos e eventos dos próximos 30 dias" />
      <div className="space-y-5">
        {Object.entries(byDay).map(([day, evts]) => (
          <section key={day}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{day}</h2>
            <div className="space-y-2">
              {evts.map((e) => (
                <Card key={e.id} className="cursor-pointer" >
                  <div onClick={() => setOpen(open === e.id ? null : e.id)} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{TYPE_ICON[e.type] ?? "📅"}</span>
                      <div>
                        <p className="font-semibold">{e.title}</p>
                        <p className="text-xs text-muted">{fmtTime(e.startTime)}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted">
                      {e.scheduleItems.length > 0 ? `${e.scheduleItems.length} escalado(s)` : "sem escala"}
                    </span>
                  </div>
                  {open === e.id && (
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      {e.scheduleItems.map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-sm">
                          <span>{s.member.name} <span className="text-muted">— {s.roleName}</span></span>
                          <StatusChip status={s.status} />
                        </div>
                      ))}
                      <button
                        onClick={(ev2) => { ev2.stopPropagation(); nav(`/evento/${e.id}`); }}
                        className="mt-1 w-full rounded-xl bg-accent/15 py-2 text-sm font-medium text-accent-soft"
                      >
                        Abrir evento → setlist · liturgia · chat
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </section>
        ))}
        {events.length === 0 && <Card><p className="text-sm text-muted">Nenhum evento nos próximos 30 dias.</p></Card>}
      </div>
    </div>
  );
}
