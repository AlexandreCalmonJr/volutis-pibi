import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../store";
import { CULTO_TEMPLATES } from "../data/templates";
import { EventMediaModal } from "../components/EventMediaModal";
import { ActionMenu } from "../components/ui";

interface Evento {
  id: string | number;
  title: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string | null;
  isRecurrent: boolean;
  recurrence: string | null;
  bannerUrl?: string | null;
  theme?: string | null;
  preacher?: string | null;
  youtubeBroadcastUrl?: string | null;
  youtubeStatus?: string | null;
  scheduleItems: any[];
}

const tipoLabels: Record<string, string> = {
  SUNDAY_MORNING: "Culto Dom. Manhã",
  SUNDAY_EVENING: "Culto Dom. Noite",
  WEDNESDAY_PRAYER: "Quarta de Oração",
  REHEARSAL: "Ensaio",
  SPECIAL_EVENT: "Especial",
};

const tipoColors: Record<string, { bg: string; text: string }> = {
  SUNDAY_MORNING: { bg: "#ede9fe", text: "#7c3aed" },
  SUNDAY_EVENING: { bg: "#dbeafe", text: "#2563eb" },
  WEDNESDAY_PRAYER: { bg: "#d1fae5", text: "#059669" },
  REHEARSAL: { bg: "#fef3c7", text: "#d97706" },
  SPECIAL_EVENT: { bg: "#fce7f3", text: "#db2777" },
};

export default function Eventos() {
  const user = useAuth((s) => s.user);
  const canManageEvents = user?.role === "ADMIN" || user?.role === "MINISTRY_LEADER";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [aba, setAba] = useState<"lista" | "templates" | "novo">("lista");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Modal de Mídias
  const [selectedMediaEvent, setSelectedMediaEvent] = useState<Evento | null>(null);

  const [novoEvento, setNovoEvento] = useState({
    titulo: "",
    data: "",
    horario: "",
    tipo: "SUNDAY_MORNING",
    recorrente: false,
    frequencia: "semanal",
  });
  const focusedEventId = searchParams.get("eventId");

  useEffect(() => {
    carregarEventos();
  }, []);

  useEffect(() => {
    if (focusedEventId) setAba("lista");
  }, [focusedEventId]);

  async function carregarEventos() {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await api<Evento[]>("/events");
      setEventos(dados);
    } catch (e: any) {
      setErro(e.message ?? "Erro ao carregar eventos");
    } finally {
      setCarregando(false);
    }
  }

  function resetFormulario() {
    setNovoEvento({ titulo: "", data: "", horario: "", tipo: "SUNDAY_MORNING", recorrente: false, frequencia: "semanal" });
    setEditingEventId(null);
  }

  async function salvarEvento() {
    if (!novoEvento.titulo || !novoEvento.data || !novoEvento.horario) return;
    setEnviando(true);
    try {
      const startTime = new Date(`${novoEvento.data}T${novoEvento.horario}:00`);
      const body = {
        title: novoEvento.titulo,
        type: novoEvento.tipo,
        date: new Date(`${novoEvento.data}T12:00:00`).toISOString(),
        startTime: startTime.toISOString(),
        isRecurrent: novoEvento.recorrente,
        recurrence: novoEvento.recorrente ? novoEvento.frequencia : undefined,
      };
      if (editingEventId) {
        await api(`/events/${editingEventId}`, { method: "PUT", body });
      } else {
        await api("/events", { method: "POST", body });
      }
      await carregarEventos();
      resetFormulario();
      setAba("lista");
    } catch (e: any) {
      setErro(e.message ?? (editingEventId ? "Erro ao atualizar evento" : "Erro ao criar evento"));
    } finally {
      setEnviando(false);
    }
  }

  async function excluirEvento(id: string) {
    setEnviando(true);
    try {
      await api(`/events/${id}`, { method: "DELETE" });
      await carregarEventos();
      if (editingEventId === id) resetFormulario();
      setAba("lista");
    } catch (e: any) {
      setErro(e.message ?? "Erro ao excluir evento");
    } finally {
      setEnviando(false);
    }
  }

  function editarEvento(evento: any) {
    const date = new Date(evento.startTime);
    setEditingEventId(String(evento.id));
    setNovoEvento({
      titulo: evento.title,
      data: new Date(evento.date).toISOString().slice(0, 10),
      horario: date.toISOString().slice(11, 16),
      tipo: evento.type,
      recorrente: Boolean(evento.isRecurrent),
      frequencia: evento.recurrence || "semanal",
    });
    setAba("novo");
  }

  const eventosRecorrentes = eventos.filter((e) => e.isRecurrent).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Eventos
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            {eventos.length} eventos · {eventosRecorrentes} recorrentes
          </p>
        </div>
        {canManageEvents && (
          <button
            onClick={() => { resetFormulario(); setAba("novo"); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 shadow-sm"
            style={{ backgroundColor: "#7c3aed" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Novo Evento
          </button>
        )}
      </div>

      {/* Tabs (somente líderes/admins vêem abas extras) */}
      {canManageEvents && (
        <div className="flex gap-1 bg-white border border-[#e5e0f8] rounded-xl p-1 w-fit">
          {(["lista", "templates", "novo"] as const).map((a) => (
            <button
              key={a}
              onClick={() => { if (a === "novo" && !editingEventId) resetFormulario(); setAba(a); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${aba === a ? "text-white" : "text-[#7c6ea8] hover:bg-gray-50"}`}
              style={aba === a ? { backgroundColor: "#7c3aed" } : {}}
            >
              {a === "lista" ? "Lista de Eventos" : a === "templates" ? "Templates" : "Novo Evento"}
            </button>
          ))}
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {erro}
        </div>
      )}

      {/* Loading */}
      {(aba === "lista" || !canManageEvents) && carregando && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#e5e0f8] border-t-[#7c3aed]" />
        </div>
      )}

      {/* Lista de Eventos */}
      {(aba === "lista" || !canManageEvents) && !carregando && (
        <div className="space-y-3">
          {eventos.length === 0 && (
            <p className="text-center text-[#7c6ea8] py-16">Nenhum evento encontrado.</p>
          )}
          {eventos.map((evento) => {
            const tag = tipoColors[evento.type] || { bg: "#f5f3ff", text: "#7c3aed" };
            const label = tipoLabels[evento.type] || evento.type;
            const start = evento.startTime?.substring(11, 16) ?? "";
            const end = evento.endTime?.substring(11, 16) ?? "";
            const horario = end ? `${start}–${end}` : start;
            return (
              <div
                key={evento.id}
                className={`bg-white rounded-2xl border p-5 hover:shadow-md transition-all hover:border-[#c4b5fd] ${String(evento.id) === focusedEventId ? "border-[#7c3aed] ring-2 ring-[#ddd6fe]" : "border-[#e5e0f8]"}`}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Banner Preview ou Data */}
                  {evento.bannerUrl ? (
                    <div className="w-24 h-16 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 border border-[#e5e0f8] relative group cursor-pointer" onClick={() => setSelectedMediaEvent(evento)}>
                      <img src={evento.bannerUrl} alt={evento.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold">Ver Arte</span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-white shadow-sm"
                      style={{ backgroundColor: tag.text }}
                    >
                      <p className="text-xs font-semibold opacity-80">
                        {new Date(evento.date).toLocaleDateString("pt-BR", { month: "short" }).toUpperCase()}
                      </p>
                      <p className="text-xl font-bold leading-tight">
                        {new Date(evento.date).getDate()}
                      </p>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-[#1e1b4b]">{evento.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: tag.bg, color: tag.text }}>
                        {label}
                      </span>
                      {evento.youtubeBroadcastUrl && (
                        <a
                          href={evento.youtubeBroadcastUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 font-semibold flex items-center gap-1.5 hover:bg-red-200 transition-colors"
                        >
                          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                          Live no YouTube
                        </a>
                      )}
                      {evento.isRecurrent && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Recorrente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-[#7c6ea8] flex-wrap">
                      <span>{horario}</span>
                      {evento.theme && <span className="text-indigo-600 font-medium">Tema: {evento.theme}</span>}
                      {evento.preacher && <span className="text-[#5b5077]">Preletor: {evento.preacher}</span>}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      className="text-xs px-3.5 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-primary)] font-medium transition-colors cursor-pointer shadow-sm"
                      onClick={() => navigate(`/escalas?eventId=${encodeURIComponent(String(evento.id))}`)}
                    >
                      Ver Escala
                    </button>
                    <ActionMenu
                      label="Ações"
                      items={[
                        {
                          id: "media",
                          label: "Mídias & Telão",
                          description: "Gerenciar fundos e slides",
                          onClick: () => setSelectedMediaEvent(evento),
                        },
                        ...(canManageEvents
                          ? [
                              {
                                id: "edit",
                                label: "Editar Evento",
                                description: "Alterar data, horário e tema",
                                onClick: () => editarEvento(evento),
                              },
                              {
                                id: "delete",
                                label: "Excluir Evento",
                                description: "Remover este evento",
                                variant: "danger" as const,
                                onClick: () => excluirEvento(String(evento.id)),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Templates */}
      {aba === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CULTO_TEMPLATES.map((template) => {
            const tag = tipoColors[template.type] || { bg: "#f5f3ff", text: "#7c3aed" };
            return (
              <div
                key={template.id}
                className="bg-white rounded-2xl border border-[#e5e0f8] p-5 flex flex-col justify-between hover:shadow-lg hover:border-[#c4b5fd] transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span
                      className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: tag.bg, color: tag.text }}
                    >
                      {template.tag}
                    </span>
                  </div>

                  <h3 className="font-bold text-[#1e1b4b] text-base mb-1">
                    {template.title}
                  </h3>

                  <p className="text-xs text-[#7c6ea8] leading-relaxed mb-3">
                    {template.descricao}
                  </p>

                  <div className="flex flex-wrap gap-2 text-[11px] text-[#5b5077] mb-4">
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium">
                      Início: {template.horario} ({template.duracaoMin} min)
                    </span>
                    <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-medium">
                      {template.recorrente ? `Recorrente · ${template.frequencia}` : "Evento Único"}
                    </span>
                  </div>

                  {template.funcoesSugeridas && (
                    <div className="border-t border-[#f0eefe] pt-2.5 mb-4">
                      <p className="text-[10px] font-bold text-[#7c6ea8] uppercase tracking-wider mb-1.5">
                        Equipes envolvidas:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {template.funcoesSugeridas.slice(0, 4).map((f) => (
                          <span key={f} className="text-[10px] bg-[#f8f7fe] text-[#6d5fa1] px-1.5 py-0.5 rounded border border-[#ede9fe]">
                            {f}
                          </span>
                        ))}
                        {template.funcoesSugeridas.length > 4 && (
                          <span className="text-[10px] text-[#7c6ea8] px-1 py-0.5">
                            +{template.funcoesSugeridas.length - 4} mais
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    resetFormulario();
                    setNovoEvento((prev) => ({
                      ...prev,
                      titulo: template.title,
                      tipo: template.type,
                      horario: template.horario,
                      recorrente: template.recorrente,
                      frequencia: template.frequencia,
                    }));
                    setAba("novo");
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Usar este template
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Novo Evento */}
      {aba === "novo" && (
        <div className="max-w-xl">
          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-4">
            <h2 className="font-semibold text-[#1e1b4b] text-lg">{editingEventId ? "Editar Evento" : "Criar Novo Evento"}</h2>

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

            <div>
              <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Tipo</label>
              <select
                value={novoEvento.tipo}
                onChange={(e) => setNovoEvento({ ...novoEvento, tipo: e.target.value })}
                className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#5b5077] bg-white focus:outline-none focus:border-[#a78bfa] transition-colors"
              >
                <option value="SUNDAY_MORNING">Culto Dom. Manhã</option>
                <option value="SUNDAY_EVENING">Culto Dom. Noite</option>
                <option value="WEDNESDAY_PRAYER">Quarta de Oração</option>
                <option value="REHEARSAL">Ensaio</option>
                <option value="SPECIAL_EVENT">Especial</option>
              </select>
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
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
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
                onClick={() => { resetFormulario(); setAba("lista"); }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#e5e0f8] text-[#5b5077] hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEvento}
                disabled={enviando || !novoEvento.titulo || !novoEvento.data || !novoEvento.horario}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#7c3aed" }}
              >
                {enviando ? (editingEventId ? "Salvando..." : "Criando...") : (editingEventId ? "Salvar alterações" : "Criar Evento")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mídias e Artes do Culto */}
      {selectedMediaEvent && (
        <EventMediaModal
          eventId={String(selectedMediaEvent.id)}
          eventTitle={selectedMediaEvent.title}
          eventDate={selectedMediaEvent.date}
          bannerUrl={selectedMediaEvent.bannerUrl}
          youtubeBroadcastUrl={selectedMediaEvent.youtubeBroadcastUrl}
          youtubeStatus={selectedMediaEvent.youtubeStatus}
          onClose={() => setSelectedMediaEvent(null)}
          onMediaUpdated={() => {
            carregarEventos();
          }}
        />
      )}
    </div>
  );
}
