import { eventos, notificacoes } from "../data/mockData";
import { useAuth } from "../store";
import { MINISTERIO_COLORS } from "../lib/constants";

const stats = [
  { label: "Total de Voluntários", value: "47", sub: "+3 este mês", color: "#7c3aed", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { label: "Escalas este Mês", value: "12", sub: "4 eventos pendentes", color: "#f59e0b", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { label: "Taxa de Presença", value: "89%", sub: "Acima da meta", color: "#10b981", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { label: "Aprovações Pendentes", value: "3", sub: "Novos voluntários", color: "#ef4444", icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
];

const proximosEventos = eventos.slice(0, 4);

const atividadesRecentes = [
  { descricao: "Ana Paula confirmou presença no Culto Domingo Manhã", tempo: "Há 15min", tipo: "checkin" },
  { descricao: "Escala gerada automaticamente para 08/09", tempo: "Há 1h", tipo: "escala" },
  { descricao: "Rafael Oliveira solicitou substituição", tempo: "Há 2h", tipo: "troca" },
  { descricao: "Fernanda Lima aguarda aprovação de cadastro", tempo: "Há 3h", tipo: "cadastro" },
  { descricao: "Lembrete automático enviado para 8 voluntários", tempo: "Há 4h", tipo: "notificacao" },
];

const tipoColors: Record<string, string> = {
  checkin: "#10b981",
  escala: "#7c3aed",
  troca: "#f59e0b",
  cadastro: "#3b82f6",
  notificacao: "#6b7280",
};

const tipoIcons: Record<string, string> = {
  checkin: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  escala: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  troca: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
  cadastro: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
  notificacao: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
};

const tipoEventoColor: Record<string, { bg: string; text: string }> = {
  Culto: { bg: "#ede9fe", text: "#7c3aed" },
  EBD: { bg: "#dbeafe", text: "#2563eb" },
  Oração: { bg: "#d1fae5", text: "#059669" },
  Conferência: { bg: "#fef3c7", text: "#d97706" },
  Especial: { bg: "#fce7f3", text: "#db2777" },
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Dashboard() {
  const user = useAuth((s) => s.user);
  const displayName = user?.memberName || (user?.email?.split("@")[0] ?? "Usuário");

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]" style={{ fontFamily: "'Fraunces', serif" }}>
            {getGreeting()}, {displayName} 👋
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1 capitalize">
            {dateStr} · Igreja Batista Central
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Gerar Escala
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
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
            <p className="text-xs text-[var(--color-muted)] mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
            <h2 className="font-semibold text-[var(--color-text)]">Próximos Eventos</h2>
            <span className="text-xs text-[var(--color-primary)] font-medium cursor-pointer hover:underline">
              Ver todos
            </span>
          </div>
          <div className="divide-y divide-[var(--color-border-light)]">
            {proximosEventos.map((evento) => {
              const tag = tipoEventoColor[evento.tipo] || { bg: "#f5f3ff", text: "#7c3aed" };
              const pct = evento.vagasNecessarias > 0
                ? Math.round((evento.voluntariosEscalados / evento.vagasNecessarias) * 100)
                : 0;
              return (
                <div key={evento.id} className="px-6 py-4 hover:bg-[var(--color-surface-2)] transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="text-center min-w-[44px]">
                      <p className="text-xs text-[var(--color-muted)] font-medium">
                        {new Date(evento.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase()}
                      </p>
                      <p className="text-lg font-bold text-[var(--color-text)] leading-tight">
                        {new Date(evento.data).getDate()}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[var(--color-text)] text-sm">{evento.titulo}</p>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: tag.bg, color: tag.text }}
                        >
                          {evento.tipo}
                        </span>
                        {evento.recorrente && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                            Recorrente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-muted)] mt-0.5">
                        {evento.horario} · {evento.local}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 100 ? "#10b981" : pct > 70 ? "#f59e0b" : "#ef4444",
                            }}
                          />
                        </div>
                        <span className="text-xs text-[var(--color-muted)] whitespace-nowrap">
                          {evento.voluntariosEscalados}/{evento.vagasNecessarias} voluntários
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border-light)]">
            <h2 className="font-semibold text-[var(--color-text)]">Atividade Recente</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            {atividadesRecentes.map((a, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: tipoColors[a.tipo] + "18" }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={tipoColors[a.tipo]} strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={tipoIcons[a.tipo]} />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text)] leading-relaxed">{a.descricao}</p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">{a.tempo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--color-text)]">Notificações Recentes</h2>
          <button
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--color-primary-light)", color: "var(--color-primary)" }}
          >
            + Nova Notificação
          </button>
        </div>
        <div className="divide-y divide-[var(--color-border-light)]">
          {notificacoes.map((n) => {
            const statusConfig = {
              enviado: { bg: "#d1fae5", text: "#059669", label: "Enviado" },
              aguardando: { bg: "#fef3c7", text: "#d97706", label: "Aguardando" },
              pendente: { bg: "#fee2e2", text: "#dc2626", label: "Pendente" },
            };
            const s = statusConfig[n.status as keyof typeof statusConfig];
            return (
              <div key={n.id} className="px-6 py-3 flex items-center gap-4 hover:bg-[var(--color-surface-2)] transition-colors">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--color-primary-light)" }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="var(--color-primary)" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-[var(--color-text)]">{n.descricao}</p>
                  <p className="text-xs text-[var(--color-muted)]">{n.horario}</p>
                </div>
                {s && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: s.bg, color: s.text }}>
                    {s.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
