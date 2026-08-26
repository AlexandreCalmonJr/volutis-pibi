import { useState } from "react";
import { ministerios } from "../data/mockData";
import { MINISTERIO_COLORS, MINISTERIOS } from "../lib/constants";

const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const escalas: Record<number, { ministerio: string; voluntario: string; funcao: string }[]> = {
  1: [
    { ministerio: "Louvor", voluntario: "Ana Paula Costa", funcao: "Vocal" },
    { ministerio: "Mídia", voluntario: "Carlos Eduardo", funcao: "Técnico de Som" },
    { ministerio: "Recepção", voluntario: "Beatriz Fernandes", funcao: "Recepcionista" },
  ],
  4: [
    { ministerio: "Mídia", voluntario: "Rafael Oliveira", funcao: "Operador de Slides" },
    { ministerio: "Intercessão", voluntario: "Priscila Nunes", funcao: "Intercessora" },
  ],
  8: [
    { ministerio: "Louvor", voluntario: "Ana Paula Costa", funcao: "Vocal" },
    { ministerio: "Louvor", voluntario: "João Victor Mendes", funcao: "Guitarra" },
    { ministerio: "Mídia", voluntario: "Lucas Pereira", funcao: "Técnico de Som" },
    { ministerio: "Infantil", voluntario: "Mariana Santos", funcao: "Professora EBD" },
  ],
  11: [
    { ministerio: "Mídia", voluntario: "Carlos Eduardo", funcao: "Técnico de Som" },
    { ministerio: "Recepção", voluntario: "Beatriz Fernandes", funcao: "Líder de Acolhimento" },
  ],
  14: [
    { ministerio: "Louvor", voluntario: "Isabela Rocha", funcao: "Vocal" },
    { ministerio: "Louvor", voluntario: "Ana Paula Costa", funcao: "Vocal" },
    { ministerio: "Mídia", voluntario: "Rafael Oliveira", funcao: "Câmera" },
    { ministerio: "Recepção", voluntario: "Beatriz Fernandes", funcao: "Recepcionista" },
    { ministerio: "Jovens", voluntario: "Isabela Rocha", funcao: "Liderança" },
  ],
  15: [
    { ministerio: "Louvor", voluntario: "João Victor Mendes", funcao: "Guitarra" },
    { ministerio: "Mídia", voluntario: "Lucas Pereira", funcao: "Técnico de Som" },
    { ministerio: "Recepção", voluntario: "Beatriz Fernandes", funcao: "Recepcionista" },
  ],
  18: [
    { ministerio: "Mídia", voluntario: "Carlos Eduardo", funcao: "Técnico de Som" },
    { ministerio: "Intercessão", voluntario: "Priscila Nunes", funcao: "Intercessora" },
  ],
  22: [
    { ministerio: "Diaconato", voluntario: "Thiago Almeida", funcao: "Diácono" },
    { ministerio: "Mídia", voluntario: "Rafael Oliveira", funcao: "Operador de Slides" },
    { ministerio: "Louvor", voluntario: "Ana Paula Costa", funcao: "Vocal" },
  ],
  25: [
    { ministerio: "Mídia", voluntario: "Lucas Pereira", funcao: "Técnico de Som" },
    { ministerio: "Recepção", voluntario: "Beatriz Fernandes", funcao: "Recepcionista" },
  ],
  29: [
    { ministerio: "Louvor", voluntario: "Ana Paula Costa", funcao: "Vocal" },
    { ministerio: "Louvor", voluntario: "João Victor Mendes", funcao: "Guitarra" },
    { ministerio: "Mídia", voluntario: "Carlos Eduardo", funcao: "Técnico de Som" },
    { ministerio: "Recepção", voluntario: "Beatriz Fernandes", funcao: "Recepcionista" },
    { ministerio: "Infantil", voluntario: "Mariana Santos", funcao: "Professora EBD" },
  ],
};

const primeiroOffset = 0; // Sept 1 = Sunday
const diasNoMes = 30;

export default function Escalas() {
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(1);
  const [filtroMinisterio, setFiltroMinisterio] = useState("Todos");
  const [gerandoEscala, setGerandoEscala] = useState(false);
  const [escalasGeradas, setEscalasGeradas] = useState(false);

  const handleGerar = () => {
    setGerandoEscala(true);
    setTimeout(() => {
      setGerandoEscala(false);
      setEscalasGeradas(true);
    }, 2000);
  };

  const escalaDia = diaSelecionado ? (escalas[diaSelecionado] || []) : [];
  const escalaDiaFiltrada = filtroMinisterio === "Todos"
    ? escalaDia
    : escalaDia.filter((e) => e.ministerio === filtroMinisterio);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Escalas — Setembro 2024
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            {Object.keys(escalas).length} dias com escalas geradas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGerar}
            disabled={gerandoEscala}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-70"
            style={{ backgroundColor: "#7c3aed" }}
          >
            {gerandoEscala ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Gerando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Gerar Escala Automática
              </>
            )}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#e5e0f8] text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar
          </button>
        </div>
      </div>

      {escalasGeradas && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3 text-green-700 text-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <strong>Escala gerada com sucesso!</strong> 47 voluntários distribuídos em 12 eventos. Notificações serão enviadas via WhatsApp.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendário */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#f0eefe] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="w-8 h-8 rounded-lg border border-[#e5e0f8] flex items-center justify-center hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4 text-[#7c6ea8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="font-semibold text-[#1e1b4b]">Setembro 2024</h2>
              <button className="w-8 h-8 rounded-lg border border-[#e5e0f8] flex items-center justify-center hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4 text-[#7c6ea8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: "#7c3aed" }} />
              <span className="text-[#7c6ea8]">Com escala</span>
              <span className="w-3 h-3 rounded-full inline-block bg-amber-400 ml-2" />
              <span className="text-[#7c6ea8]">Incompleto</span>
            </div>
          </div>
          <div className="p-4">
            {/* Days header */}
            <div className="grid grid-cols-7 mb-2">
              {dias.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-[#7c6ea8] py-1">
                  {d}
                </div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Offset */}
              {Array.from({ length: primeiroOffset }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {Array.from({ length: diasNoMes }).map((_, i) => {
                const day = i + 1;
                const temEscala = day in escalas;
                const isSelected = diaSelecionado === day;
                const isToday = day === 1;
                return (
                  <button
                    key={day}
                    onClick={() => setDiaSelecionado(day === diaSelecionado ? null : day)}
                    className={[
                      "relative aspect-square rounded-xl text-sm font-medium transition-all",
                      isSelected
                        ? "text-white"
                        : temEscala
                          ? "text-[#1e1b4b] hover:bg-[#f5f3ff]"
                          : "text-[#7c6ea8] hover:bg-gray-50",
                    ].join(" ")}
                    style={isSelected ? { backgroundColor: "#7c3aed" } : {}}
                  >
                    {isToday && !isSelected && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#7c3aed]" />
                    )}
                    {day}
                    {temEscala && !isSelected && (
                      <span
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{ backgroundColor: "#7c3aed" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Templates */}
          <div className="px-6 py-4 border-t border-[#f0eefe]">
            <p className="text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-3">Templates de Culto</p>
            <div className="flex flex-wrap gap-2">
              {["Culto Domingo Manhã", "Culto Domingo Noite", "Oração — Quarta", "Conferência", "EBD"].map((t) => (
                <button
                  key={t}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#e5e0f8] text-[#5b5077] hover:bg-[#f5f3ff] hover:text-[#7c3aed] hover:border-[#c4b5fd] transition-all"
                >
                  {t}
                </button>
              ))}
              <button className="text-xs px-3 py-1.5 rounded-full border border-dashed border-[#c4b5fd] text-[#7c3aed] hover:bg-[#f5f3ff] transition-all">
                + Novo Template
              </button>
            </div>
          </div>
        </div>

        {/* Escala do dia */}
        <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-[#f0eefe]">
            <h2 className="font-semibold text-[#1e1b4b]">
              {diaSelecionado
                ? `Dia ${diaSelecionado} de Setembro`
                : "Selecione um dia"}
            </h2>
            {diaSelecionado && (
              <div className="mt-2">
                <select
                  value={filtroMinisterio}
                  onChange={(e) => setFiltroMinisterio(e.target.value)}
                  className="text-xs border border-[#e5e0f8] rounded-lg px-2 py-1 text-[#5b5077] bg-white focus:outline-none focus:border-[#a78bfa]"
                >
                  <option>Todos</option>
                  {MINISTERIOS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {!diaSelecionado ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#7c6ea8]">
                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">Clique em um dia para ver a escala</p>
              </div>
            ) : escalaDiaFiltrada.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#7c6ea8]">
                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-sm">Sem escalas para este dia</p>
                <button className="mt-2 text-xs text-[#7c3aed] hover:underline">+ Adicionar voluntário</button>
              </div>
            ) : (
              <div className="divide-y divide-[#f0eefe]">
                {escalaDiaFiltrada.map((e, i) => {
                  const colors = MINISTERIO_COLORS[e.ministerio] || { bg: "#f5f3ff", text: "#7c3aed" };
                  const initials = e.voluntario.split(" ").slice(0, 2).map((n) => n[0]).join("");
                  return (
                    <div key={i} className="px-6 py-3 flex items-center gap-3 hover:bg-[#fafafe] transition-colors group">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1e1b4b] truncate">{e.voluntario}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: colors.bg, color: colors.text }}
                          >
                            {e.ministerio}
                          </span>
                          <span className="text-xs text-[#7c6ea8]">{e.funcao}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="w-7 h-7 rounded-lg hover:bg-amber-50 flex items-center justify-center" title="Substituir">
                          <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </button>
                        <button className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center" title="Remover">
                          <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {diaSelecionado && (
            <div className="px-6 py-4 border-t border-[#f0eefe]">
              <button className="w-full py-2 rounded-xl text-sm font-semibold border-2 border-dashed border-[#c4b5fd] text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors">
                + Adicionar Voluntário
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
