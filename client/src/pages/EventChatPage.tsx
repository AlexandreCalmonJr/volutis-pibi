import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../store";

interface Event {
  id: string;
  title: string;
  date: string;
  startTime?: string | null;
  type?: string;
  churchId: string;
}

interface ChatMessage {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  eventId: string;
}

export default function EventChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const paramEventId = searchParams.get("eventId");

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(paramEventId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const user = useAuth((s) => s.user);
  const isLeaderOrAdmin = user?.role === "ADMIN" || user?.role === "MINISTRY_LEADER";

  // Carregar eventos disponíveis para chat
  useEffect(() => {
    async function loadEvents() {
      setLoadingEvents(true);
      try {
        if (isLeaderOrAdmin) {
          const data = await api<Event[]>("/events");
          setEvents(data);
          if (paramEventId && data.some((e) => e.id === paramEventId)) {
            setSelectedEventId(paramEventId);
          } else if (!selectedEventId && data.length > 0 && window.innerWidth >= 768) {
            setSelectedEventId(data[0].id);
          }
        } else {
          const res = await api<{ items: Array<{ event: Event }> }>("/my/schedule?scope=all");
          const evMap = new Map<string, Event>();
          for (const item of res.items || []) {
            if (item.event) evMap.set(item.event.id, item.event);
          }
          const list = Array.from(evMap.values());
          setEvents(list);
          if (paramEventId && list.some((e) => e.id === paramEventId)) {
            setSelectedEventId(paramEventId);
          } else if (!selectedEventId && list.length > 0 && window.innerWidth >= 768) {
            setSelectedEventId(list[0].id);
          }
        }
      } catch (err: any) {
        setChatError("Não foi possível carregar os cultos.");
      } finally {
        setLoadingEvents(false);
      }
    }
    loadEvents();
  }, [isLeaderOrAdmin, paramEventId]);

  // Carregar mensagens do evento selecionado
  useEffect(() => {
    if (!selectedEventId) {
      setMessages([]);
      return;
    }
    setSearchParams({ eventId: selectedEventId }, { replace: true });
    let cancelled = false;

    async function loadMessages() {
      setLoadingMessages(true);
      setChatError(null);
      try {
        const msgs = await api<ChatMessage[]>(`/events/${selectedEventId}/chat`);
        if (!cancelled) setMessages(msgs);
      } catch (err: any) {
        if (!cancelled) setChatError("Erro ao carregar mensagens deste culto.");
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }
    loadMessages();

    // Polling a cada 4 segundos
    const interval = setInterval(() => {
      api<ChatMessage[]>(`/events/${selectedEventId}/chat`)
        .then((msgs) => {
          if (!cancelled) setMessages(msgs);
        })
        .catch(() => {});
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedEventId]);

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEventId || !newMessage.trim() || sending) return;
    setSending(true);
    try {
      const msg = await api<ChatMessage>(`/events/${selectedEventId}/chat`, {
        method: "POST",
        body: { content: newMessage.trim() },
      });
      setMessages((prev) => [...prev, msg]);
      setNewMessage("");
    } catch (err: any) {
      alert("Erro ao enviar mensagem: " + (err.message || "Tente novamente"));
    } finally {
      setSending(false);
    }
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] max-w-7xl mx-auto">
      {/* Header da Página */}
      <div className="mb-3 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)]" style={{ fontFamily: "'Fraunces', serif" }}>
            Chats dos Cultos
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-muted)]">
            Comunicação direta com a equipe escalada para cada evento
          </p>
        </div>
      </div>

      {/* Container Principal */}
      <div className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden flex flex-col md:flex-row relative">
        {/* COLUNA 1: Lista de Eventos / Cultos */}
        {/* No mobile: se um evento estiver selecionado, esconde a lista (hidden md:flex) */}
        <div
          className={`w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-surface-2)] ${
            selectedEventId ? "hidden md:flex" : "flex h-full"
          }`}
        >
          <div className="p-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Cultos & Eventos ({events.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loadingEvents ? (
              <div className="p-6 text-center text-xs text-[var(--color-muted)]">
                Carregando eventos...
              </div>
            ) : events.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--color-muted)]">
                Nenhum evento encontrado para conversar.
              </div>
            ) : (
              events.map((event) => {
                const isSelected = event.id === selectedEventId;
                const formattedDate = new Date(event.date).toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                });

                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className={`w-full text-left p-3 rounded-2xl transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? "bg-[var(--color-primary)] text-white shadow-md shadow-violet-500/20"
                        : "bg-[var(--color-surface)] hover:bg-violet-50 dark:hover:bg-violet-950/30 text-[var(--color-ink)] border border-[var(--color-border)]"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-violet-100 dark:bg-violet-950 text-[var(--color-primary)]"
                      }`}
                    >
                      {event.title.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{event.title}</p>
                      <p
                        className={`text-xs mt-0.5 capitalize truncate ${
                          isSelected ? "text-white/80" : "text-[var(--color-muted)]"
                        }`}
                      >
                        {formattedDate} {event.startTime ? `· ${event.startTime}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA 2: Sala de Mensagens do Chat */}
        {/* No mobile: se nenhum evento selecionado, esconde a sala (hidden md:flex) */}
        <div
          className={`flex-1 flex flex-col h-full bg-[var(--color-surface)] ${
            !selectedEventId ? "hidden md:flex items-center justify-center" : "flex"
          }`}
        >
          {selectedEvent ? (
            <>
              {/* Header do Chat (com botão Voltar no Mobile) */}
              <div className="p-3.5 sm:px-5 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  {/* Botão Voltar para Mobile */}
                  <button
                    onClick={() => setSelectedEventId(null)}
                    className="md:hidden p-2 -ml-1 rounded-xl text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] cursor-pointer"
                    title="Voltar para lista de cultos"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)] font-bold flex items-center justify-center text-sm flex-shrink-0">
                    {selectedEvent.title.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-[var(--color-ink)] leading-tight truncate">
                      {selectedEvent.title}
                    </h3>
                    <p className="text-[11px] text-[var(--color-muted)]">
                      {new Date(selectedEvent.date).toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                      })}
                      {selectedEvent.startTime ? ` às ${selectedEvent.startTime}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-muted)] border border-[var(--color-border)]">
                    {messages.length} msg(s)
                  </span>
                </div>
              </div>

              {/* Lista de Mensagens com Scroll */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[var(--color-background)]">
                {loadingMessages ? (
                  <div className="text-center py-12 text-xs text-[var(--color-muted)]">
                    Carregando mensagens...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-16 text-[var(--color-muted)] space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] mx-auto flex items-center justify-center text-violet-500">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-ink)]">Nenhuma mensagem neste culto</p>
                    <p className="text-xs">Seja o primeiro a enviar uma mensagem para a equipe!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.authorName === (user?.memberName || user?.email);
                    const time = new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-semibold text-[var(--color-muted)]">
                            {isMe ? "Você" : msg.authorName}
                          </span>
                          <span className="text-[10px] text-[var(--color-muted)] opacity-70">
                            {time}
                          </span>
                        </div>

                        <div
                          className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words ${
                            isMe
                              ? "bg-[var(--color-primary)] text-white rounded-tr-xs"
                              : "bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)] rounded-tl-xs"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Barra de Digitação */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 sm:p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-2 flex-shrink-0"
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Mensagem para a equipe de ${selectedEvent.title}...`}
                  className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-all"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="px-4 py-2.5 rounded-xl bg-[var(--color-primary)] hover:opacity-95 text-white text-xs sm:text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 flex-shrink-0"
                >
                  <span>Enviar</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </>
          ) : (
            <div className="p-8 text-center text-[var(--color-muted)] space-y-2 my-auto">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-2)] mx-auto flex items-center justify-center text-violet-500">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="font-semibold text-sm text-[var(--color-ink)]">Selecione um culto na lista</p>
              <p className="text-xs">Clique em qualquer evento para abrir o chat com os voluntários escalados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
