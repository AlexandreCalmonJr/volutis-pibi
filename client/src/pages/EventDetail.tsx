import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth, useToasts } from "../store";
import { Button, Card, PageHeader, StatusChip, fmtDate, fmtTime } from "../components/ui";
import { ChordViewer } from "../components/ChordViewer";
import { semitonesBetween } from "../lib/transpose";
import { useRealtimeNotifications } from "../ws";
import type { Song } from "./Repertoire";

interface SetlistItem { id: string; order: number; songKey: string | null; notes: string | null; song: Song }
interface LiturgyItem { id: string; order: number; title: string; startTime: string | null; durationMin: number | null; responsible: string | null; bibleRef: string | null }
interface ChatMsg { id: string; content: string; authorName: string; createdAt: string }
interface EventFull {
  id: string; title: string; date: string; startTime: string;
  scheduleItems: { id: string; status: string; roleName: string; member: { id: string; name: string; phone: string | null } }[];
}
interface Ministry { id: string; name: string; icon: string | null; roles: { id: string; name: string }[] }
interface Suggestion {
  memberId: string; name: string; phone: string | null;
  lastServedAt: string | null; timesServedLast90d: number; score: number;
}

type Tab = "equipe" | "setlist" | "liturgia" | "chat";

function waLink(phone: string | null, name: string, eventTitle: string, when: string, role: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  const msg = `Olá, ${name}! 🙌\n\nVocê foi escalado(a) para *${eventTitle}* — ${when}.\nFunção: *${role}*\n\nConfirme no app Volutis PIBI. Deus abençoe!`;
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const push = useToasts((s) => s.push);
  const isLeader = user?.role === "ADMIN" || user?.role === "MINISTRY_LEADER";

  const [event, setEvent] = useState<EventFull | null>(null);
  const [tab, setTab] = useState<Tab>("equipe");
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [selMinistry, setSelMinistry] = useState<Ministry | null>(null);
  const [selRole, setSelRole] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [setlist, setSetlist] = useState<SetlistItem[]>([]);
  const [liturgy, setLiturgy] = useState<LiturgyItem[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [openSong, setOpenSong] = useState<SetlistItem | null>(null);

  // pickers/forms
  const [addingSong, setAddingSong] = useState(false);
  const [songQuery, setSongQuery] = useState("");
  const [catalog, setCatalog] = useState<Song[]>([]);
  const [litForm, setLitForm] = useState({ title: "", startTime: "", durationMin: "", responsible: "", bibleRef: "" });
  const [showLitForm, setShowLitForm] = useState(false);
  const [msg, setMsg] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [ev, sl, li, ch] = await Promise.all([
      api<EventFull>(`/events/${id}`),
      api<SetlistItem[]>(`/events/${id}/setlist`),
      api<LiturgyItem[]>(`/events/${id}/liturgy`),
      api<ChatMsg[]>(`/events/${id}/chat`),
    ]);
    setEvent(ev); setSetlist(sl); setLiturgy(li); setChat(ch);
  }, [id]);

  useEffect(() => { load().catch(() => nav("/escalas")); }, [load, nav]);
  useRealtimeNotifications((n) => { if (n.data?.eventId === id) load(); });
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [chat.length, tab]);

  // Polling leve do chat quando a aba está aberta
  useEffect(() => {
    if (tab !== "chat" || !id) return;
    const t = setInterval(() => api<ChatMsg[]>(`/events/${id}/chat`).then(setChat).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [tab, id]);

  async function loadMinistries() {
    if (ministries.length === 0) setMinistries(await api<Ministry[]>("/ministries"));
  }

  async function pickRole(role: string) {
    setSelRole(role);
    setSuggestions(null);
    const list = await api<Suggestion[]>(
      `/events/${id}/suggestions?ministryId=${selMinistry!.id}&role=${encodeURIComponent(role)}`
    );
    setSuggestions(list);
  }

  async function assign(s: Suggestion) {
    try {
      const item = await api<{ whatsappLink: string | null }>(`/events/${id}/schedule`, {
        method: "POST",
        body: { memberId: s.memberId, roleName: selRole },
      });
      push({
        title: `${s.name} escalado(a) como ${selRole} ✅`,
        body: "Toque para avisar no WhatsApp",
        kind: "ok",
        whatsappLink: item.whatsappLink,
      });
      setSelRole(null); setSuggestions(null);
      load();
    } catch (e: any) {
      const extra = e?.data?.code === "CONFLICT" ? " — conflito de horário em outro evento" : e?.data?.code === "UNAVAILABLE" ? " — voluntário indisponível nesta data" : "";
      push({ title: e.message + extra, kind: "warn" });
    }
  }

  async function unassign(itemId: string) {
    await api(`/schedule-items/${itemId}`, { method: "DELETE" });
    load();
  }

  async function searchCatalog(q: string) {
    setSongQuery(q);
    const list = await api<Song[]>(`/songs${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setCatalog(list);
  }

  async function addToSetlist(songId: string) {
    try {
      await api(`/events/${id}/setlist`, { method: "POST", body: { songId } });
      setAddingSong(false); setSongQuery("");
      push({ title: "Música adicionada à setlist 🎵", kind: "ok" });
      load();
    } catch (e: any) { push({ title: e.message, kind: "warn" }); }
  }

  async function move(idx: number, dir: -1 | 1) {
    const ids = setlist.map((s) => s.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    const updated = await api<SetlistItem[]>(`/events/${id}/setlist/reorder`, { method: "PUT", body: { itemIds: ids } });
    setSetlist(updated);
  }

  async function changeKey(item: SetlistItem) {
    const key = prompt(`Tom do culto para "${item.song.title}":`, item.songKey ?? item.song.originalKey ?? "");
    if (!key) return;
    await api(`/setlist-items/${item.id}`, { method: "PUT", body: { songKey: key } });
    load();
  }

  async function removeFromSetlist(itemId: string) {
    await api(`/setlist-items/${itemId}`, { method: "DELETE" });
    load();
  }

  async function addLiturgy() {
    try {
      const body: any = { title: litForm.title };
      if (litForm.startTime) body.startTime = litForm.startTime;
      if (litForm.durationMin) body.durationMin = Number(litForm.durationMin);
      if (litForm.responsible) body.responsible = litForm.responsible;
      if (litForm.bibleRef) body.bibleRef = litForm.bibleRef;
      await api(`/events/${id}/liturgy`, { method: "POST", body });
      setLitForm({ title: "", startTime: "", durationMin: "", responsible: "", bibleRef: "" });
      setShowLitForm(false);
      load();
    } catch (e: any) { push({ title: e.message, kind: "warn" }); }
  }

  async function sendMsg() {
    if (!msg.trim()) return;
    const content = msg;
    setMsg("");
    try {
      await api(`/events/${id}/chat`, { method: "POST", body: { content } });
      const list = await api<ChatMsg[]>(`/events/${id}/chat`);
      setChat(list);
    } catch (e: any) { push({ title: e.message, kind: "warn" }); }
  }

  const input = "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent";
  if (!event) return <div className="p-6 text-sm text-muted">Carregando...</div>;

  if (openSong) {
    const offset = semitonesBetween(openSong.song.originalKey, openSong.songKey);
    return (
      <div className="mx-auto max-w-lg px-4 pt-6 pb-safe">
        <button onClick={() => setOpenSong(null)} className="mb-3 text-sm text-accent-soft">← Setlist</button>
        <PageHeader title={openSong.song.title} subtitle={`${openSong.song.artist ?? ""} · tom do culto: ${openSong.songKey ?? "—"}`} />
        {openSong.notes && <Card className="mb-3"><p className="text-sm">📝 {openSong.notes}</p></Card>}
        <ChordViewer chords={openSong.song.chords} lyrics={openSong.song.lyrics} originalKey={openSong.song.originalKey} initialOffset={offset} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-safe">
      <button onClick={() => nav(-1)} className="mb-3 text-sm text-accent-soft">← Voltar</button>
      <PageHeader title={event.title} subtitle={`${fmtDate(event.startTime)} · ${fmtTime(event.startTime)}`} />

      <div className="mb-4 flex rounded-xl bg-surface p-1">
        {(["equipe", "setlist", "liturgia", "chat"] as Tab[]).map((t) => (
          <button
            key={t} onClick={() => { setTab(t); if (t === "equipe" && isLeader) loadMinistries(); }}
            className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize transition sm:text-sm ${tab === t ? "bg-accent text-white" : "text-muted"}`}
          >
            {t === "equipe" ? "👥 Equipe" : t === "setlist" ? "🎵 Setlist" : t === "liturgia" ? "📜 Liturgia" : "💬 Chat"}
          </button>
        ))}
      </div>

      {tab === "equipe" && (
        <div className="space-y-2">
          {event.scheduleItems.map((s) => {
            const link = waLink(s.member.phone, s.member.name, event.title, `${fmtDate(event.startTime)} ${fmtTime(event.startTime)}`, s.roleName);
            return (
              <Card key={s.id}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{s.member.name}</p>
                    <p className="text-xs text-muted">{s.roleName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusChip status={s.status} />
                    {isLeader && link && s.status === "PENDING" && (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-ok/90 px-2.5 py-1.5 text-xs font-semibold text-bg">WhatsApp</a>
                    )}
                    {isLeader && <button onClick={() => unassign(s.id)} className="px-1 text-danger">×</button>}
                  </div>
                </div>
              </Card>
            );
          })}
          {event.scheduleItems.length === 0 && <Card><p className="text-sm text-muted">Ninguém escalado ainda.</p></Card>}

          {isLeader && (
            <Card className="space-y-3">
              <p className="text-sm font-semibold">➕ Escalar voluntário</p>
              <div className="flex flex-wrap gap-2">
                {ministries.map((m) => (
                  <button key={m.id}
                    onClick={() => { setSelMinistry(m); setSelRole(null); setSuggestions(null); }}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${selMinistry?.id === m.id ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}>
                    {m.icon} {m.name}
                  </button>
                ))}
              </div>
              {selMinistry && (
                <div className="flex flex-wrap gap-2">
                  {selMinistry.roles.map((r) => (
                    <button key={r.id} onClick={() => pickRole(r.name)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${selRole === r.name ? "bg-accent-soft text-bg" : "bg-surface text-ink border border-border"}`}>
                      {r.name}
                    </button>
                  ))}
                </div>
              )}
              {selRole && suggestions === null && <p className="text-xs text-muted">Buscando sugestões...</p>}
              {suggestions !== null && (
                <div className="space-y-2">
                  <p className="text-xs text-muted">Sugestões para <b className="text-accent-soft">{selRole}</b> (revezamento justo — quem serviu menos aparece primeiro):</p>
                  {suggestions.map((s, i) => (
                    <div key={s.memberId} className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
                      <div>
                        <p className="text-sm font-semibold">{i === 0 && "⭐ "}{s.name}</p>
                        <p className="text-[11px] text-muted">
                          {s.timesServedLast90d}x nos últimos 90d
                          {s.lastServedAt ? ` · último: ${fmtDate(s.lastServedAt)}` : " · nunca serviu no período"}
                        </p>
                      </div>
                      <Button variant="ok" onClick={() => assign(s)}>Escalar</Button>
                    </div>
                  ))}
                  {suggestions.length === 0 && (
                    <p className="text-xs text-warn">Nenhum voluntário disponível para esta função (indisponibilidade, conflito ou já escalado).</p>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === "setlist" && (
        <div className="space-y-2">
          {setlist.map((item, idx) => (
            <Card key={item.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3" onClick={() => setOpenSong(item)}>
                  <span className="font-display text-lg font-bold text-muted">{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.song.title}</p>
                    <p className="truncate text-xs text-muted">{item.song.artist ?? "—"}{item.notes ? ` · ${item.notes}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => isLeader && changeKey(item)} className="rounded-lg bg-accent/15 px-2 py-1 text-xs font-bold text-accent-soft">
                    {item.songKey ?? "—"}
                  </button>
                  {isLeader && (
                    <>
                      <button onClick={() => move(idx, -1)} className="px-1 text-muted">↑</button>
                      <button onClick={() => move(idx, 1)} className="px-1 text-muted">↓</button>
                      <button onClick={() => removeFromSetlist(item.id)} className="px-1 text-danger">×</button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {setlist.length === 0 && <Card><p className="text-sm text-muted">Setlist vazia.</p></Card>}
          {isLeader && !addingSong && (
            <>
              <Button className="w-full" variant="ghost" onClick={() => { setAddingSong(true); searchCatalog(""); }}>+ Adicionar música</Button>
              {setlist.length > 0 && (
                <Button
                  className="w-full"
                  onClick={async () => {
                    try {
                      const r = await api<{ sent: number; skipped: string[] }>(`/events/${id}/holyrics/send-setlist`, { method: "POST", body: { clear: true } });
                      push({
                        title: `Setlist enviada ao Holyrics 📽️ (${r.sent} música(s))`,
                        body: r.skipped.length ? `Sem vínculo no Holyrics: ${r.skipped.join(", ")}` : undefined,
                        kind: "ok",
                      });
                    } catch (e: any) { push({ title: e.message, kind: "warn" }); }
                  }}
                >
                  📽️ Enviar setlist ao Holyrics
                </Button>
              )}
            </>
          )}
          {addingSong && (
            <Card className="space-y-2">
              <input autoFocus placeholder="Buscar no repertório..." value={songQuery} onChange={(e) => searchCatalog(e.target.value)} className={input} />
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {catalog.map((s) => (
                  <button key={s.id} onClick={() => addToSetlist(s.id)} className="flex w-full items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-left text-sm active:bg-border">
                    <span>{s.title} <span className="text-muted">· {s.artist ?? "—"}</span></span>
                    {s.originalKey && <b className="text-accent-soft">{s.originalKey}</b>}
                  </button>
                ))}
                {catalog.length === 0 && <p className="p-2 text-xs text-muted">Nada encontrado.</p>}
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setAddingSong(false)}>Cancelar</Button>
            </Card>
          )}
        </div>
      )}

      {tab === "liturgia" && (
        <div>
          <div className="relative ml-3 space-y-4 border-l-2 border-border pl-5">
            {liturgy.map((l) => (
              <div key={l.id} className="relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-accent bg-bg" />
                <div className="flex items-baseline gap-2">
                  {l.startTime && <span className="font-display text-sm font-bold text-accent-soft">{l.startTime}</span>}
                  <p className="font-semibold">{l.title}</p>
                  {l.durationMin && <span className="text-xs text-muted">{l.durationMin} min</span>}
                </div>
                {(l.responsible || l.bibleRef) && (
                  <p className="mt-0.5 text-xs text-muted">
                    {l.responsible}{l.responsible && l.bibleRef ? " · " : ""}{l.bibleRef && <span className="text-warn">📖 {l.bibleRef}</span>}
                  </p>
                )}
              </div>
            ))}
            {liturgy.length === 0 && <p className="text-sm text-muted">Roteiro ainda não montado.</p>}
          </div>
          {isLeader && !showLitForm && (
            <Button className="mt-4 w-full" variant="ghost" onClick={() => setShowLitForm(true)}>+ Adicionar momento</Button>
          )}
          {showLitForm && (
            <Card className="mt-4 space-y-2">
              <input placeholder="Título (ex: Louvor) *" value={litForm.title} onChange={(e) => setLitForm({ ...litForm, title: e.target.value })} className={input} />
              <div className="flex gap-2">
                <input placeholder="Início (19:00)" value={litForm.startTime} onChange={(e) => setLitForm({ ...litForm, startTime: e.target.value })} className={input} />
                <input placeholder="Duração (min)" type="number" value={litForm.durationMin} onChange={(e) => setLitForm({ ...litForm, durationMin: e.target.value })} className={input} />
              </div>
              <input placeholder="Responsável" value={litForm.responsible} onChange={(e) => setLitForm({ ...litForm, responsible: e.target.value })} className={input} />
              <input placeholder="Referência bíblica (Sl 23:1)" value={litForm.bibleRef} onChange={(e) => setLitForm({ ...litForm, bibleRef: e.target.value })} className={input} />
              <div className="flex gap-2">
                <Button className="flex-1" disabled={!litForm.title} onClick={addLiturgy}>Salvar</Button>
                <Button variant="ghost" onClick={() => setShowLitForm(false)}>Cancelar</Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "chat" && (
        <div className="flex flex-col">
          <div className="max-h-[50vh] space-y-3 overflow-y-auto pb-2">
            {chat.map((m) => (
              <div key={m.id} className="rounded-2xl bg-surface p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold text-accent-soft">{m.authorName}</p>
                  <p className="text-[10px] text-muted">{fmtTime(m.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm">{m.content}</p>
              </div>
            ))}
            {chat.length === 0 && <p className="text-sm text-muted">Nenhuma mensagem ainda. Comece a conversa! 💬</p>}
            <div ref={chatEnd} />
          </div>
          <div className="mt-2 flex gap-2">
            <input
              placeholder="Mensagem para a equipe..." value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMsg()}
              className={input}
            />
            <Button onClick={sendMsg} disabled={!msg.trim()}>➤</Button>
          </div>
        </div>
      )}
    </div>
  );
}
