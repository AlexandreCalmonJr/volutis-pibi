import { useState, useEffect } from "react";
import { api } from "../api";
import { MINISTERIO_COLORS, MINISTERIOS } from "../lib/constants";

const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const mesNomes = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface ScheduleItem {
  id: string;
  status: string;
  roleName: string;
  member: { id: string; name: string; photoUrl?: string };
  checkin?: { id: string; arrived: boolean };
}

interface Event {
  id: string;
  title: string;
  type: string;
  date: string;
  startTime: string;
  scheduleItems: ScheduleItem[];
}

export default function Escalas() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesAtual, setMesAtual] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);
  const [filtroMinisterio, setFiltroMinisterio] = useState("Todos");

  // Auto Gerar Escala
  const [modalAutoOpen, setModalAutoOpen] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [selectedMinistryId, setSelectedMinistryId] = useState("ALL");
  const [ministriesList, setMinistriesList] = useState<Array<{ id: string; name: string }>>([]);
  const [autoResult, setAutoResult] = useState<{
    eventsProcessed: number;
    rolesAssigned: number;
    skippedRoles: number;
    assignments: Array<{
      eventTitle: string;
      roleName: string;
      memberName: string;
      ministryName: string;
    }>;
  } | null>(null);

  useEffect(() => {
    api<Array<{ id: string; name: string }>>("/ministries")
      .then((data) => setMinistriesList(data))
      .catch(() => setMinistriesList([]));
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [mesAtual]);

  async function fetchEvents() {
    setLoading(true);
    try {
      const data = await api<Event[]>("/events");
      const startOfMonth = new Date(mesAtual.year, mesAtual.month, 1);
      const endOfMonth = new Date(mesAtual.year, mesAtual.month + 1, 0, 23, 59, 59);
      const filtered = data.filter((ev) => {
        const d = new Date(ev.date);
        return d >= startOfMonth && d <= endOfMonth;
      });
      setEvents(filtered);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoGenerate() {
    setGerando(true);
    setAutoResult(null);
    try {
      const result = await api<any>("/schedules/auto-generate", {
        method: "POST",
        body: {
          year: mesAtual.year,
          month: mesAtual.month + 1,
          ministryId: selectedMinistryId === "ALL" ? undefined : selectedMinistryId,
          overwrite,
        },
      });
      setAutoResult(result);
      await fetchEvents();
    } catch (err: any) {
      alert(err.message || "Erro ao gerar escala automática.");
    } finally {
      setGerando(false);
    }
  }

  function eventosPorDia(dia: number): Event[] {
    return events.filter((ev) => {
      const d = new Date(ev.date);
      return d.getFullYear() === mesAtual.year
        && d.getMonth() === mesAtual.month
        && d.getDate() === dia;
    });
  }

  const diasNoMes = new Date(mesAtual.year, mesAtual.month + 1, 0).getDate();
  const primeiroOffset = new Date(mesAtual.year, mesAtual.month, 1).getDay();

  const eventDays = new Set(events.map((ev) => new Date(ev.date).getDate()));
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === mesAtual.year && today.getMonth() === mesAtual.month;

  function navigateMonth(delta: number) {
    setMesAtual((prev) => {
      const newDate = new Date(prev.year, prev.month + delta, 1);
      return { year: newDate.getFullYear(), month: newDate.getMonth() };
    });
    setDiaSelecionado(null);
  }

  const eventosDoDia = diaSelecionado ? eventosPorDia(diaSelecionado) : [];
  const itemsDoDia = eventosDoDia.flatMap((ev) =>
    ev.scheduleItems.map((item) => ({ ...item, eventTitle: ev.title, eventType: ev.type }))
  );
  const itemsFiltrados = filtroMinisterio === "Todos"
    ? itemsDoDia
    : itemsDoDia.filter((item) => item.roleName === filtroMinisterio);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Escalas — {mesNomes[mesAtual.month]} {mesAtual.year}
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            {events.length} eventos este mês
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setAutoResult(null);
              setModalAutoOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 shadow-sm cursor-pointer"
            style={{ backgroundColor: "#7c3aed" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Gerar Escala Automática
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendário */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#f0eefe] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateMonth(-1)}
                className="w-8 h-8 rounded-lg border border-[#e5e0f8] flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 text-[#7c6ea8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="font-semibold text-[#1e1b4b]">{mesNomes[mesAtual.month]} {mesAtual.year}</h2>
              <button
                onClick={() => navigateMonth(1)}
                className="w-8 h-8 rounded-lg border border-[#e5e0f8] flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
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
            {loading ? (
              <div className="flex justify-center py-12">
                <svg className="w-8 h-8 animate-spin text-[#7c3aed]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: primeiroOffset }).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}
                {Array.from({ length: diasNoMes }).map((_, i) => {
                  const day = i + 1;
                  const temEscala = eventDays.has(day);
                  const isSelected = diaSelecionado === day;
                  const isToday = isCurrentMonth && today.getDate() === day;
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
            )}
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
                ? `${diaSelecionado} de ${mesNomes[mesAtual.month]}`
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
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#7c6ea8]">
                <svg className="w-8 h-8 animate-spin text-[#7c3aed] mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm">Carregando escalas...</p>
              </div>
            ) : !diaSelecionado ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#7c6ea8]">
                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">Clique em um dia para ver a escala</p>
              </div>
            ) : eventosDoDia.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#7c6ea8]">
                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">Nenhum evento neste dia</p>
              </div>
            ) : itemsFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#7c6ea8]">
                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-sm">Sem escalas para este ministerio</p>
                <button className="mt-2 text-xs text-[#7c3aed] hover:underline">+ Adicionar voluntário</button>
              </div>
            ) : (
              <div className="divide-y divide-[#f0eefe]">
                {itemsFiltrados.map((item) => {
                  const roleName = item.roleName;
                  const colors = MINISTERIO_COLORS[roleName] || { bg: "#f5f3ff", text: "#7c3aed" };
                  const initials = item.member.name.split(" ").slice(0, 2).map((n) => n[0]).join("");
                  return (
                    <div key={item.id} className="px-6 py-3 flex items-center gap-3 hover:bg-[#fafafe] transition-colors group">
                      {item.member.photoUrl ? (
                        <img
                          src={item.member.photoUrl}
                          alt={item.member.name}
                          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: colors.bg, color: colors.text }}
                        >
                          {initials}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1e1b4b] truncate">{item.member.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: colors.bg, color: colors.text }}
                          >
                            {roleName}
                          </span>
                          <span className="text-xs text-[#7c6ea8]">{item.eventTitle}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="w-7 h-7 rounded-lg hover:bg-amber-50 flex items-center justify-center" title="Substituir">
                          <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </button>
                        <button className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center" title="Remover">
                          <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

          {diaSelecionado && eventosDoDia.length > 0 && (
            <div className="px-6 py-4 border-t border-[#f0eefe]">
              <button className="w-full py-2 rounded-xl text-sm font-semibold border-2 border-dashed border-[#c4b5fd] text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors">
                + Adicionar Voluntário
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Geração Automática */}
      {modalAutoOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#e5e0f8] space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-[#f0eefe] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#ede9fe] flex items-center justify-center text-xl">
                  ⚡
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[#1e1b4b]">Gerar Escala Automática</h3>
                  <p className="text-xs text-[#7c6ea8]">
                    {mesNomes[mesAtual.month]} de {mesAtual.year}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalAutoOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {autoResult ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                    <span>🎉</span> Escala gerada com sucesso!
                  </div>
                  <p className="text-xs text-emerald-700">
                    <strong>{autoResult.rolesAssigned}</strong> voluntários foram escalados em{" "}
                    <strong>{autoResult.eventsProcessed}</strong> eventos com balanceamento inteligente.
                  </p>
                </div>

                {autoResult.assignments.length > 0 && (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    <p className="text-xs font-semibold text-[#5b5077] uppercase tracking-wider">
                      Atribuições Realizadas:
                    </p>
                    {autoResult.assignments.map((a, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-[#f8f7ff] border border-[#ede9fe] rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#1e1b4b]">{a.memberName}</p>
                          <p className="text-[11px] text-[#7c6ea8]">
                            {a.eventTitle} · {a.ministryName}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full font-medium bg-[#ede9fe] text-[#7c3aed]">
                          {a.roleName}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setModalAutoOpen(false)}
                    className="px-5 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-all cursor-pointer"
                    style={{ backgroundColor: "#7c3aed" }}
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#5b5077] uppercase tracking-wider mb-1.5">
                    Ministério Alvo
                  </label>
                  <select
                    value={selectedMinistryId}
                    onChange={(e) => setSelectedMinistryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] bg-white focus:outline-none focus:border-[#7c3aed]"
                  >
                    <option value="ALL">🏛️ Todos os Ministérios</option>
                    {ministriesList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="overwriteCheck"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                    className="w-4 h-4 rounded text-[#7c3aed] border-gray-300 focus:ring-[#7c3aed]"
                  />
                  <label htmlFor="overwriteCheck" className="text-xs text-[#5b5077] cursor-pointer">
                    Substituir escalas pendentes já existentes no mês
                  </label>
                </div>

                <div className="p-3.5 bg-[#f8f7ff] border border-[#ede9fe] rounded-xl text-xs text-[#5b5077] space-y-1 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-semibold text-[#7c3aed]">
                    <span>🧠</span> Algoritmo Inteligente Volutis:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[#7c6ea8]">
                    <li>Verifica indisponibilidades e bloqueios de data informados pelos voluntários.</li>
                    <li>Evita sobreposição de horários entre diferentes ministérios no mesmo culto.</li>
                    <li>Prioriza voluntários com menor número de escalas nos últimos 90 dias (revezamento justo).</li>
                  </ul>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#f0eefe]">
                  <button
                    type="button"
                    onClick={() => setModalAutoOpen(false)}
                    disabled={gerando}
                    className="px-4 py-2 text-xs font-medium text-[#5b5077] hover:bg-gray-100 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoGenerate}
                    disabled={gerando}
                    className="px-5 py-2.5 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: "#7c3aed" }}
                  >
                    {gerando ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Calculando e Escalando...
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        Confirmar e Gerar
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
