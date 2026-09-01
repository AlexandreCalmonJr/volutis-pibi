import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../store";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { DevotionalCard } from "../components/DevotionalCard";

interface DashboardEvent {
  id: string;
  title: string;
  date: string;
  type: string;
  scheduleCount: number;
}

interface DashboardStats {
  totalVolunteers: number;
  pendingApprovals: number;
  eventsThisMonth: number;
  events: DashboardEvent[];
}

interface SeedPreview {
  counts: {
    volunteers: number;
    events: number;
    songs: number;
    ministries: number;
    removableMinistries: number;
  };
}

const tipoEventoColor: Record<string, { bg: string; text: string }> = {
  SUNDAY_MORNING: { bg: "#ede9fe", text: "#7c3aed" },
  SUNDAY_EVENING: { bg: "#dbeafe", text: "#2563eb" },
  WEDNESDAY_PRAYER: { bg: "#d1fae5", text: "#059669" },
  REHEARSAL: { bg: "#fef3c7", text: "#d97706" },
  SPECIAL_EVENT: { bg: "#fce7f3", text: "#db2777" },
};

const tipoEventoLabel: Record<string, string> = {
  SUNDAY_MORNING: "Culto Dom. Manhã",
  SUNDAY_EVENING: "Culto Dom. Noite",
  WEDNESDAY_PRAYER: "Quarta de Oração",
  REHEARSAL: "Ensaio",
  SPECIAL_EVENT: "Especial",
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Dashboard() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const displayName = user?.memberName || (user?.email?.split("@")[0] ?? "Usuário");
  const { isSupported, isSubscribed, permission, loading: pushLoading, busy: pushBusy, error: pushError, enablePush } = usePushNotifications();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedPreview, setSeedPreview] = useState<SeedPreview | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedSaving, setSeedSaving] = useState(false);
  const [seedFeedback, setSeedFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pushTestBusy, setPushTestBusy] = useState(false);
  const [pushTestFeedback, setPushTestFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pushPanelOpen, setPushPanelOpen] = useState(false);
  const [pushMembers, setPushMembers] = useState<{ id: string; name: string; email: string | null; pushDevices: number }[]>([]);
  const [pushTarget, setPushTarget] = useState<"ALL" | string>("ALL");
  const [pushTitle, setPushTitle] = useState("Aviso da Igreja 📢");
  const [pushBody, setPushBody] = useState("");
  const [pushMembersLoading, setPushMembersLoading] = useState(false);

  async function openPushPanel() {
    setPushPanelOpen(true);
    setPushTestFeedback(null);
    setPushMembersLoading(true);
    try {
      const result = await api<{ pushConfigured: boolean; members: typeof pushMembers }>("/admin/members-push");
      setPushMembers(result.members);
    } catch (e: any) {
      setPushTestFeedback({ type: "error", text: e.message || "Não foi possível carregar membros." });
    } finally {
      setPushMembersLoading(false);
    }
  }

  async function runPushTest() {
    if (!isAdmin || !pushBody.trim()) return;
    setPushTestBusy(true);
    setPushTestFeedback(null);
    try {
      if (pushTarget === "ALL") {
        const result = await api<{ ok: boolean; sent: number; total: number; message: string }>("/admin/broadcast", {
          method: "POST",
          body: { title: pushTitle, body: pushBody },
        });
        setPushTestFeedback({ type: result.ok ? "ok" : "error", text: result.message });
      } else {
        const result = await api<{ ok: boolean; sent: number; subscriptions: number; message: string }>("/admin/push-test", {
          method: "POST",
          body: { memberId: pushTarget },
        });
        setPushTestFeedback({ type: result.ok ? "ok" : "error", text: result.message });
      }
    } catch (e: any) {
      setPushTestFeedback({ type: "error", text: e.message || "Não foi possível enviar a notificação." });
    } finally {
      setPushTestBusy(false);
    }
  }
  const [seedOptions, setSeedOptions] = useState({
    removeVolunteers: true,
    removeEvents: true,
    removeSongs: true,
    removeMinistries: false,
  });

  const isAdmin = user?.role === "ADMIN";

  const fetchDashboard = () => {
    setLoading(true);
    api<DashboardStats>("/dashboard/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function openSeedCleanup() {
    if (!isAdmin) return;
    setSeedOpen(true);
    setSeedLoading(true);
    setSeedFeedback(null);
    try {
      const preview = await api<SeedPreview>("/admin/seed-data/preview");
      setSeedPreview(preview);
    } catch (e: any) {
      setSeedFeedback({ type: "error", text: e.message || "Não foi possível carregar os dados do seed." });
    } finally {
      setSeedLoading(false);
    }
  }

  async function runSeedCleanup() {
    setSeedSaving(true);
    setSeedFeedback(null);
    try {
      const result = await api<{ message: string; preview: SeedPreview; removedVolunteers: number; removedEvents: number; removedSongs: number; removedMinistries: number; skippedMinistries: number }>("/admin/seed-data/cleanup", {
        method: "POST",
        body: seedOptions,
      });
      setSeedPreview(result.preview);
      setSeedFeedback({
        type: "ok",
        text: `${result.message} Removidos: ${result.removedVolunteers} membro(s), ${result.removedEvents} evento(s), ${result.removedSongs} música(s), ${result.removedMinistries} ministério(s).${result.skippedMinistries ? ` ${result.skippedMinistries} ministério(s) foram mantidos por ainda terem membros.` : ""}`,
      });
      fetchDashboard();
    } catch (e: any) {
      setSeedFeedback({ type: "error", text: e.message || "Não foi possível executar a limpeza." });
    } finally {
      setSeedSaving(false);
    }
  }


  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const statCards = [
    { label: "Membros do Ministério", value: stats?.totalVolunteers ?? "—", color: "#7c3aed", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { label: "Eventos este Mês", value: stats?.eventsThisMonth ?? "—", color: "#f59e0b", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { label: "Aprovações Pendentes", value: stats?.pendingApprovals ?? "—", color: "#ef4444", icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]" style={{ fontFamily: "'Fraunces', serif" }}>
            {getGreeting()}, {displayName}
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1 capitalize">
            {dateStr}
          </p>
        </div>
        {(user?.role === "ADMIN" || user?.role === "MINISTRY_LEADER") && (
          <div className="flex gap-2 flex-wrap justify-end">
            {isAdmin && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/admin/export/backup.json", {
                      headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
                    });
                    if (!res.ok) throw new Error("Erro ao gerar backup");
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `backup-volutis-${new Date().toISOString().split("T")[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  } catch (err: any) {
                    alert(err?.message || "Não foi possível exportar o backup.");
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 transition-all cursor-pointer shadow-sm"
                title="Exportar backup completo de todos os dados da igreja em JSON"
              >
                <span>📥</span> Backup
              </button>
            )}
            {isAdmin && (
              <button
                onClick={openPushPanel}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#c4b5fd] text-[#7c3aed] bg-white hover:bg-[#f5f3ff] transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Enviar notificação
              </button>
            )}
            {isAdmin && (
              <button
                onClick={openSeedCleanup}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-all"
              >
                Limpar seed
              </button>
            )}
            <button
              onClick={() => navigate("/escalas")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95 shadow-sm"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Gerar Escala
            </button>
          </div>
        )}
      </div>

      {/* Devocional Diário */}
      <DevotionalCard />

      {isSupported && !pushLoading && !isSubscribed && (
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-purple-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-violet-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text)]">
                Ativar notificações no celular 📲
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 max-w-xl">
                Não perca suas escalas! Receba lembretes automáticos e avisos importantes diretamente na tela de bloqueio, mesmo com o app fechado.
              </p>
              {pushError && (
                <p className="text-xs text-rose-600 font-medium mt-1">
                  {pushError}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={enablePush}
            disabled={pushBusy || permission === "denied"}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-violet-500/20 hover:shadow-lg flex items-center justify-center gap-2 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {pushBusy ? "Ativando..." : permission === "denied" ? "Permissão bloqueada" : "Ativar no meu celular"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-[var(--color-border)] animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-gray-100 mb-3" />
              <div className="h-8 w-16 bg-gray-100 rounded mb-1" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-5 border border-[var(--color-border)] hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: stat.color + "18" }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={stat.color} strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-[var(--color-text)]">{stat.value}</p>
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--color-text)]">Próximos Eventos</h2>
          <button
            onClick={() => navigate("/eventos")}
            className="text-xs text-[var(--color-primary)] font-medium hover:underline"
          >
            Ver todos
          </button>
        </div>
        <div className="divide-y divide-[var(--color-border-light)]">
          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-[var(--color-muted)]">Carregando...</div>
          ) : stats?.events && stats.events.length > 0 ? (
            stats.events.slice(0, 5).map((evento) => {
              const tag = tipoEventoColor[evento.type] || { bg: "#f5f3ff", text: "#7c3aed" };
              const label = tipoEventoLabel[evento.type] || evento.type;
              return (
                <div key={evento.id} className="px-6 py-4 hover:bg-[var(--color-surface-2)] transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="text-center min-w-[44px]">
                      <p className="text-xs text-[var(--color-muted)] font-medium">
                        {new Date(evento.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase()}
                      </p>
                      <p className="text-lg font-bold text-[var(--color-text)] leading-tight">
                        {new Date(evento.date).getDate()}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[var(--color-text)] text-sm">{evento.title}</p>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: tag.bg, color: tag.text }}
                        >
                          {label}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-muted)] mt-0.5">
                        {evento.scheduleCount} escalado(s)
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-6 py-8 text-center text-sm text-[var(--color-muted)]">
              Nenhum evento este mês
            </div>
          )}
        </div>
      </div>

      {pushPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPushPanelOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">Enviar notificação</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Envie para um membro específico ou para todos</p>
              </div>
              <button onClick={() => setPushPanelOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-lg">×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {pushTestFeedback && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${pushTestFeedback.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  {pushTestFeedback.text}
                </div>
              )}

              {pushMembersLoading ? (
                <div className="py-8 text-center text-sm text-[var(--color-muted)]">Carregando membros...</div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-[var(--color-text)] mb-1.5">Destinatário</label>
                    <select
                      value={pushTarget}
                      onChange={(e) => setPushTarget(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-white text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                    >
                      <option value="ALL">📢 Todos os membros ({pushMembers.length})</option>
                      {pushMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.pushDevices > 0 ? `(${m.pushDevices} dispositivo${m.pushDevices > 1 ? "s" : ""})` : "(sem push ativo)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--color-text)] mb-1.5">Título</label>
                    <input
                      value={pushTitle}
                      onChange={(e) => setPushTitle(e.target.value)}
                      placeholder="Ex: Aviso importante"
                      className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-white text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--color-text)] mb-1.5">Mensagem</label>
                    <textarea
                      value={pushBody}
                      onChange={(e) => setPushBody(e.target.value)}
                      placeholder="Digite a mensagem da notificação..."
                      rows={3}
                      className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-white text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
                    />
                  </div>

                  {pushTarget !== "ALL" && (() => {
                    const selected = pushMembers.find((m) => m.id === pushTarget);
                    return selected && selected.pushDevices === 0 ? (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                        ⚠️ Este membro não possui dispositivos com push ativo. A notificação aparecerá no app, mas não chegará como notificação no celular. O membro precisa abrir o app e ativar as notificações.
                      </div>
                    ) : null;
                  })()}

                  <div className="rounded-xl bg-violet-50/60 border border-violet-200 px-4 py-3 text-xs text-violet-800">
                    💡 A notificação será entregue via push no celular (se o membro ativou) e também aparecerá dentro do app em tempo real via WebSocket.
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[var(--color-border)] flex justify-end gap-3">
              <button onClick={() => setPushPanelOpen(false)} className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-secondary)]">Fechar</button>
              <button
                onClick={runPushTest}
                disabled={pushTestBusy || !pushBody.trim() || pushMembersLoading}
                className="px-5 py-2 rounded-xl bg-[#7c3aed] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[#6d28d9] transition-colors"
              >
                {pushTestBusy ? "Enviando..." : pushTarget === "ALL" ? `Enviar para todos (${pushMembers.length})` : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {seedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSeedOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">Limpeza de dados para Produção</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Remove registros de teste e seed, sem mexer na conta do administrador.</p>
              </div>
              <button onClick={() => setSeedOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200">×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {seedFeedback && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${seedFeedback.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  {seedFeedback.text}
                </div>
              )}

              {seedLoading ? (
                <div className="py-10 text-center text-sm text-[var(--color-muted)]">Carregando prévia...</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3">
                      <input type="checkbox" checked={seedOptions.removeVolunteers} onChange={(e) => setSeedOptions((prev) => ({ ...prev, removeVolunteers: e.target.checked }))} />
                      <div>
                        <p className="font-semibold text-[var(--color-text)]">Membros demo/teste</p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">Encontrados: {seedPreview?.counts.volunteers ?? 0}</p>
                      </div>
                    </label>
                    <label className="rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3">
                      <input type="checkbox" checked={seedOptions.removeEvents} onChange={(e) => setSeedOptions((prev) => ({ ...prev, removeEvents: e.target.checked }))} />
                      <div>
                        <p className="font-semibold text-[var(--color-text)]">Eventos de seed</p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">Encontrados: {seedPreview?.counts.events ?? 0}</p>
                      </div>
                    </label>
                    <label className="rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3">
                      <input type="checkbox" checked={seedOptions.removeSongs} onChange={(e) => setSeedOptions((prev) => ({ ...prev, removeSongs: e.target.checked }))} />
                      <div>
                        <p className="font-semibold text-[var(--color-text)]">Músicas demo</p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">Encontradas: {seedPreview?.counts.songs ?? 0}</p>
                      </div>
                    </label>
                    <label className="rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3">
                      <input type="checkbox" checked={seedOptions.removeMinistries} onChange={(e) => setSeedOptions((prev) => ({ ...prev, removeMinistries: e.target.checked }))} />
                      <div>
                        <p className="font-semibold text-[var(--color-text)]">Ministérios de seed</p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">Encontrados: {seedPreview?.counts.ministries ?? 0} · removíveis agora: {seedPreview?.counts.removableMinistries ?? 0}</p>
                      </div>
                    </label>
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    Ministérios com membros vinculados não são apagados automaticamente. O administrador principal `admin@pibi.org.br` também é preservado.
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[var(--color-border)] flex justify-end gap-3">
              <button onClick={() => setSeedOpen(false)} className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-secondary)]">Fechar</button>
              <button onClick={runSeedCleanup} disabled={seedLoading || seedSaving} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
                {seedSaving ? "Limpando..." : "Executar limpeza"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
