import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../store";

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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedPreview, setSeedPreview] = useState<SeedPreview | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedSaving, setSeedSaving] = useState(false);
  const [seedFeedback, setSeedFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
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
        text: `${result.message} Removidos: ${result.removedVolunteers} voluntário(s), ${result.removedEvents} evento(s), ${result.removedSongs} música(s), ${result.removedMinistries} ministério(s).${result.skippedMinistries ? ` ${result.skippedMinistries} ministério(s) foram mantidos por ainda terem membros.` : ""}`,
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
    { label: "Total de Voluntários", value: stats?.totalVolunteers ?? "—", color: "#7c3aed", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
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
          <div className="flex gap-2">
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
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
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

      {seedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSeedOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">Limpeza de dados de seed</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Remove somente registros conhecidos do seed, sem mexer no administrador.</p>
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
                        <p className="font-semibold text-[var(--color-text)]">Voluntários demo</p>
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
