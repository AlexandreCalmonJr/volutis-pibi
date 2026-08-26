import { useState } from "react";
import { eventos } from "../data/mockData";

const tipoColors: Record<string, { bg: string; text: string }> = {
  Culto: { bg: "#ede9fe", text: "#7c3aed" },
  EBD: { bg: "#dbeafe", text: "#2563eb" },
  Oração: { bg: "#d1fae5", text: "#059669" },
  Conferência: { bg: "#fef3c7", text: "#d97706" },
  Especial: { bg: "#fce7f3", text: "#db2777" },
};

const templates = [
  { nome: "Culto Domingo Manhã", funcoes: [{ f: "Recepcionista", qtd: 4 }, { f: "Técnico de Som", qtd: 1 }, { f: "Operador de Slides", qtd: 1 }, { f: "Vocal", qtd: 3 }, { f: "Guitarra", qtd: 1 }, { f: "Bateria", qtd: 1 }] },
  { nome: "Culto Domingo Noite", funcoes: [{ f: "Recepcionista", qtd: 2 }, { f: "Técnico de Som", qtd: 1 }, { f: "Operador de Slides", qtd: 1 }, { f: "Vocal", qtd: 2 }] },
  { nome: "Culto de Oração", funcoes: [{ f: "Técnico de Som", qtd: 1 }, { f: "Intercessora", qtd: 2 }] },
  { nome: "EBD", funcoes: [{ f: "Professora EBD", qtd: 3 }, { f: "Monitor", qtd: 2 }] },
  { nome: "Conferência", funcoes: [{ f: "Recepcionista", qtd: 6 }, { f: "Técnico de Som", qtd: 2 }, { f: "Câmera", qtd: 2 }, { f: "Vocal", qtd: 4 }] },
];

export default function Eventos() {
  const [aba, setAba] = useState<"lista" | "templates" | "novo">("lista");
  const [novoEvento, setNovoEvento] = useState({
    titulo: "",
    data: "",
    horario: "",
    tipo: "Culto",
    local: "",
    recorrente: false,
    frequencia: "semanal",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Eventos
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            {eventos.length} eventos em setembro · {eventos.filter((e) => e.recorrente).length} recorrentes
          </p>
        </div>
        <button
          onClick={() => setAba("novo")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: "#7c3aed" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Evento
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#e5e0f8] rounded-xl p-1 w-fit">
        {(["lista", "templates", "novo"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${aba === a ? "text-white" : "text-[#7c6ea8] hover:bg-gray-50"}`}
            style={aba === a ? { backgroundColor: "#7c3aed" } : {}}
          >
            {a === "lista" ? "Lista de Eventos" : a === "templates" ? "Templates" : "Novo Evento"}
          </button>
        ))}
      </div>

      {/* Lista de Eventos */}
      {aba === "lista" && (
        <div className="space-y-3">
          {eventos.map((evento) => {
            const tag = tipoColors[evento.tipo] || { bg: "#f5f3ff", text: "#7c3aed" };
            const pct = Math.round((evento.voluntariosEscalados / evento.vagasNecessarias) * 100);
            return (
              <div
                key={evento.id}
                className="bg-white rounded-2xl border border-[#e5e0f8] p-5 hover:shadow-md transition-all hover:border-[#c4b5fd]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Data */}
                  <div
                    className="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-white"
                    style={{ backgroundColor: tag.text }}
                  >
                    <p className="text-xs font-semibold opacity-80">
                      {new Date(evento.data).toLocaleDateString("pt-BR", { month: "short" }).toUpperCase()}
                    </p>
                    <p className="text-xl font-bold leading-tight">
                      {new Date(evento.data).getDate()}
                    </p>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-[#1e1b4b]">{evento.titulo}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: tag.bg, color: tag.text }}>
                        {evento.tipo}
                      </span>
                      {evento.recorrente && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Recorrente
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#7c6ea8]">
                      {evento.horario} · {evento.local}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {evento.ministerios.map((m) => (
                        <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-[#f5f3ff] text-[#7c3aed] font-medium">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Escalas */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#1e1b4b]">
                        {evento.voluntariosEscalados}/{evento.vagasNecessarias}
                      </p>
                      <p className="text-xs text-[#7c6ea8]">voluntários</p>
                    </div>
                    <div className="w-28">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: pct >= 100 ? "#10b981" : pct > 70 ? "#f59e0b" : "#ef4444",
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="text-xs px-3 py-1.5 rounded-lg border border-[#e5e0f8] text-[#5b5077] hover:bg-gray-50 transition-colors">
                        Escala
                      </button>
                      <button className="text-xs px-3 py-1.5 rounded-lg border border-[#e5e0f8] text-[#5b5077] hover:bg-gray-50 transition-colors">
                        Editar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Templates */}
      {aba === "templates" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.nome} className="bg-white rounded-2xl border border-[#e5e0f8] p-5 hover:shadow-md hover:border-[#c4b5fd] transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#ede9fe" }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <button className="text-xs text-[#7c3aed] font-medium hover:underline">Editar</button>
              </div>
              <h3 className="font-semibold text-[#1e1b4b] mb-3">{t.nome}</h3>
              <div className="space-y-1.5">
                {t.funcoes.map((f) => (
                  <div key={f.f} className="flex items-center justify-between text-xs">
                    <span className="text-[#5b5077]">{f.f}</span>
                    <span className="font-semibold text-[#1e1b4b]">×{f.qtd}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-[#f0eefe] flex gap-2">
                <button className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90" style={{ backgroundColor: "#7c3aed" }}>
                  Usar Template
                </button>
              </div>
            </div>
          ))}

          {/* Add template */}
          <button className="bg-white rounded-2xl border-2 border-dashed border-[#c4b5fd] p-5 flex flex-col items-center justify-center gap-2 text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors min-h-[200px]">
            <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-medium">Novo Template</span>
          </button>
        </div>
      )}

      {/* Novo Evento */}
      {aba === "novo" && (
        <div className="max-w-xl">
          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-4">
            <h2 className="font-semibold text-[#1e1b4b] text-lg">Criar Novo Evento</h2>

            <div>
              <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Título</label>
              <input
                value={novoEvento.titulo}
                onChange={(e) => setNovoEvento({ ...novoEvento, titulo: e.target.value })}
                placeholder="ex: Culto Domingo Manhã"
                className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#a78bfa] transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Data</label>
                <input
                  type="date"
                  value={novoEvento.data}
                  onChange={(e) => setNovoEvento({ ...novoEvento, data: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Horário</label>
                <input
                  type="time"
                  value={novoEvento.horario}
                  onChange={(e) => setNovoEvento({ ...novoEvento, horario: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa] transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Tipo</label>
                <select
                  value={novoEvento.tipo}
                  onChange={(e) => setNovoEvento({ ...novoEvento, tipo: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#5b5077] bg-white focus:outline-none focus:border-[#a78bfa] transition-colors"
                >
                  <option>Culto</option>
                  <option>EBD</option>
                  <option>Oração</option>
                  <option>Conferência</option>
                  <option>Especial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Local</label>
                <input
                  value={novoEvento.local}
                  onChange={(e) => setNovoEvento({ ...novoEvento, local: e.target.value })}
                  placeholder="Templo Principal"
                  className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#a78bfa] transition-colors"
                />
              </div>
            </div>

            {/* Recorrente */}
            <div className="flex items-center justify-between bg-[#f5f3ff] rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[#1e1b4b]">Evento Recorrente</p>
                <p className="text-xs text-[#7c6ea8]">Repete automaticamente</p>
              </div>
              <button
                onClick={() => setNovoEvento({ ...novoEvento, recorrente: !novoEvento.recorrente })}
                className={`w-10 h-6 rounded-full transition-all relative ${novoEvento.recorrente ? "" : "bg-gray-200"}`}
                style={novoEvento.recorrente ? { backgroundColor: "#7c3aed" } : {}}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${novoEvento.recorrente ? "left-4.5" : "left-0.5"}`}
                  style={{ left: novoEvento.recorrente ? "18px" : "2px" }}
                />
              </button>
            </div>

            {novoEvento.recorrente && (
              <div>
                <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Frequência</label>
                <div className="flex gap-2">
                  {["semanal", "quinzenal", "mensal"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setNovoEvento({ ...novoEvento, frequencia: f })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${novoEvento.frequencia === f ? "text-white" : "border border-[#e5e0f8] text-[#7c6ea8] hover:bg-gray-50"}`}
                      style={novoEvento.frequencia === f ? { backgroundColor: "#7c3aed" } : {}}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setAba("lista")}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#e5e0f8] text-[#5b5077] hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90" style={{ backgroundColor: "#7c3aed" }}>
                Criar Evento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
