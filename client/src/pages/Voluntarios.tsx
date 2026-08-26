import { useState } from "react";
import { voluntarios, ministerios, Voluntario } from "../data/mockData";
import { MINISTERIO_COLORS, MINISTERIOS } from "../lib/constants";

const statusConfig = {
  ativo: { bg: "#d1fae5", text: "#059669", label: "Ativo" },
  pendente: { bg: "#fef3c7", text: "#d97706", label: "Pendente" },
  inativo: { bg: "#f3f4f6", text: "#6b7280", label: "Inativo" },
};

function safeTaxa(presencas: number, faltas: number): number {
  const total = presencas + faltas;
  return total > 0 ? Math.round((presencas / total) * 100) : 0;
}

interface ProfileModalProps {
  voluntario: Voluntario;
  onClose: () => void;
}

function ProfileModal({ voluntario: v, onClose }: ProfileModalProps) {
  const s = statusConfig[v.status];
  const color = MINISTERIO_COLORS[v.ministerio]?.text || "#7c3aed";
  const initials = v.nome.split(" ").slice(0, 2).map((n) => n[0]).join("");
  const taxaPresenca = safeTaxa(v.presencas, v.faltas);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center" style={{ backgroundColor: color + "10" }}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center hover:bg-white transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3"
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
          <h2 className="text-lg font-bold text-[#1e1b4b]">{v.nome}</h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-sm" style={{ color }}>{v.ministerio}</span>
            <span className="text-gray-300">·</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: s.bg, color: s.text }}
            >
              {s.label}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-[#f5f3ff] rounded-xl p-3">
              <p className="text-xl font-bold text-[#1e1b4b]">{v.presencas}</p>
              <p className="text-xs text-[#7c6ea8]">Presenças</p>
            </div>
            <div className="text-center bg-[#f5f3ff] rounded-xl p-3">
              <p className="text-xl font-bold text-[#1e1b4b]">{taxaPresenca}%</p>
              <p className="text-xs text-[#7c6ea8]">Taxa</p>
            </div>
            <div className="text-center bg-[#f5f3ff] rounded-xl p-3">
              <p className="text-xl font-bold text-[#1e1b4b]">{v.faltas}</p>
              <p className="text-xs text-[#7c6ea8]">Faltas</p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-[#7c6ea8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-sm text-[#1e1b4b]">{v.telefone}</span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-[#7c6ea8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-[#1e1b4b]">{v.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-[#7c6ea8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-[#1e1b4b]">
                Membro desde {new Date(v.dataIngresso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </span>
            </div>
          </div>

          {/* Funções */}
          <div>
            <p className="text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-2">Funções</p>
            <div className="flex flex-wrap gap-1.5">
              {v.funcoes.map((f) => (
                <span key={f} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: color + "15", color }}>
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Disponibilidade */}
          <div>
            <p className="text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-2">Disponibilidade</p>
            <div className="flex flex-wrap gap-1.5">
              {v.disponibilidade.length > 0 ? v.disponibilidade.map((d) => (
                <span key={d} className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-medium">
                  {d}
                </span>
              )) : (
                <span className="text-xs text-[#7c6ea8]">Indisponível</span>
              )}
            </div>
          </div>

          {/* Batizado */}
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${v.batizado ? "bg-green-100" : "bg-gray-100"}`}>
              {v.batizado ? (
                <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <span className="text-sm text-[#5b5077]">{v.batizado ? "Batizado/a" : "Não batizado/a"}</span>
          </div>

          {/* Actions */}
          {v.status === "pendente" && (
            <div className="flex gap-2 pt-2">
              <button className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90" style={{ backgroundColor: "#10b981" }}>
                Aprovar Voluntário
              </button>
              <button className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                Recusar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Voluntarios() {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [filtroMinisterio, setFiltroMinisterio] = useState("Todos");
  const [voluntarioSelecionado, setVoluntarioSelecionado] = useState<Voluntario | null>(null);
  const [visualizacao, setVisualizacao] = useState<"grid" | "lista">("grid");

  const filtrados = voluntarios.filter((v) => {
    const matchBusca = v.nome.toLowerCase().includes(busca.toLowerCase()) ||
      v.ministerio.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "Todos" || v.status === filtroStatus.toLowerCase();
    const matchMinisterio = filtroMinisterio === "Todos" || v.ministerio === filtroMinisterio;
    return matchBusca && matchStatus && matchMinisterio;
  });

  const pendentes = voluntarios.filter((v) => v.status === "pendente");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Voluntários
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            {voluntarios.filter((v) => v.status === "ativo").length} ativos · {pendentes.length} aguardando aprovação
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#e5e0f8] text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Importar Excel
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90" style={{ backgroundColor: "#7c3aed" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Novo Voluntário
          </button>
        </div>
      </div>

      {/* Aprovações pendentes */}
      {pendentes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-amber-800">
                {pendentes.length} voluntário(s) aguardando aprovação
              </span>
            </div>
            <button
              onClick={() => setFiltroStatus("Pendente")}
              className="text-xs text-amber-700 font-semibold hover:underline"
            >
              Ver todos
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7c6ea8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar voluntário..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl bg-white text-[#1e1b4b] placeholder:text-[#7c6ea8] focus:outline-none focus:border-[#a78bfa] transition-colors"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="text-sm border border-[#e5e0f8] rounded-xl px-3 py-2.5 bg-white text-[#5b5077] focus:outline-none focus:border-[#a78bfa]"
        >
          <option>Todos</option>
          <option>Ativo</option>
          <option>Pendente</option>
          <option>Inativo</option>
        </select>
        <select
          value={filtroMinisterio}
          onChange={(e) => setFiltroMinisterio(e.target.value)}
          className="text-sm border border-[#e5e0f8] rounded-xl px-3 py-2.5 bg-white text-[#5b5077] focus:outline-none focus:border-[#a78bfa]"
        >
          <option>Todos</option>
          {MINISTERIOS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <div className="flex gap-1 bg-white border border-[#e5e0f8] rounded-xl p-1">
          <button
            onClick={() => setVisualizacao("grid")}
            className={`px-3 py-1.5 rounded-lg transition-all ${visualizacao === "grid" ? "bg-[#f5f3ff] text-[#7c3aed]" : "text-[#7c6ea8] hover:bg-gray-50"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setVisualizacao("lista")}
            className={`px-3 py-1.5 rounded-lg transition-all ${visualizacao === "lista" ? "bg-[#f5f3ff] text-[#7c3aed]" : "text-[#7c6ea8] hover:bg-gray-50"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {visualizacao === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((v) => {
            const s = statusConfig[v.status];
            const color = MINISTERIO_COLORS[v.ministerio]?.text || "#7c3aed";
            const initials = v.nome.split(" ").slice(0, 2).map((n) => n[0]).join("");
            const taxa = safeTaxa(v.presencas, v.faltas);
            return (
              <button
                key={v.id}
                onClick={() => setVoluntarioSelecionado(v)}
                className="bg-white rounded-2xl border border-[#e5e0f8] p-5 text-left hover:shadow-md hover:border-[#c4b5fd] transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: color }}
                  >
                    {initials}
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: s.bg, color: s.text }}
                  >
                    {s.label}
                  </span>
                </div>
                <p className="font-semibold text-[#1e1b4b] group-hover:text-[#7c3aed] transition-colors">{v.nome}</p>
                <p className="text-xs text-[#7c6ea8] mt-0.5">{v.ministerio} · {v.funcoes[0]}</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-[#7c6ea8] mb-1">
                      <span>Presença</span>
                      <span className="font-medium" style={{ color: taxa > 85 ? "#10b981" : taxa > 70 ? "#f59e0b" : "#ef4444" }}>
                        {taxa}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${taxa}%`,
                          backgroundColor: taxa > 85 ? "#10b981" : taxa > 70 ? "#f59e0b" : "#ef4444",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
          <div className="divide-y divide-[#f0eefe]">
            {filtrados.map((v) => {
              const s = statusConfig[v.status];
              const color = MINISTERIO_COLORS[v.ministerio]?.text || "#7c3aed";
              const initials = v.nome.split(" ").slice(0, 2).map((n) => n[0]).join("");
              const taxa = safeTaxa(v.presencas, v.faltas);
              return (
                <button
                  key={v.id}
                  onClick={() => setVoluntarioSelecionado(v)}
                  className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-[#fafafe] transition-colors text-left"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1e1b4b] text-sm">{v.nome}</p>
                    <p className="text-xs text-[#7c6ea8]">{v.ministerio} · {v.funcoes.join(", ")}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4">
                    <span className="text-xs text-[#7c6ea8]">{v.presencas} presenças</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: taxa > 85 ? "#10b981" : taxa > 70 ? "#f59e0b" : "#ef4444" }}
                    >
                      {taxa}%
                    </span>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={{ backgroundColor: s.bg, color: s.text }}
                    >
                      {s.label}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-[#c4b5fd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filtrados.length === 0 && (
        <div className="text-center py-16 text-[#7c6ea8]">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
          </svg>
          <p>Nenhum voluntário encontrado</p>
        </div>
      )}

      {voluntarioSelecionado && (
        <ProfileModal
          voluntario={voluntarioSelecionado}
          onClose={() => setVoluntarioSelecionado(null)}
        />
      )}
    </div>
  );
}
