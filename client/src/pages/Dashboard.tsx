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

  useEffect(() => {
    api<DashboardStats>("/dashboard/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    </div>
  );
}
