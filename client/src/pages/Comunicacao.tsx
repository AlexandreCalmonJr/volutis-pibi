import { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../store";

interface Event {
  id: string;
  title: string;
  date: string;
}

interface ChatSender {
  id: string;
  name: string;
  photoUrl?: string;
}

interface ChatMessage {
  id: string;
  text: string;
  createdAt: string;
  sender: ChatSender;
}

export default function Comunicacao() {
  const [aba, setAba] = useState<"chat" | "notificacoes" | "whatsapp">("chat");
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const user = useAuth((s) => s.user);

  useEffect(() => {
    api<Event[]>("/events")
      .then((data) => {
        setEvents(data);
        if (data.length > 0) setEventId(data[0].id);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    setLoadingMessages(true);
    api<ChatMessage[]>(`/events/${eventId}/chat`)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [eventId]);

  const selectedEvent = events.find((e) => e.id === eventId);

  async function handleSend() {
    if (!novaMensagem.trim() || !eventId || sending) return;
    setSending(true);
    const text = novaMensagem.trim();
    setNovaMensagem("");
    try {
      const created = await api<ChatMessage>(`/events/${eventId}/chat`, {
        method: "POST",
        body: { text },
      });
      setMessages((prev) => [...prev, created]);
    } catch {
      setNovaMensagem(text);
    } finally {
      setSending(false);
    }
  }

  function isMyMessage(msg: ChatMessage) {
    return user?.memberId ? msg.sender.id === user.memberId : msg.sender.id === user?.id;
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Comunicação
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            Chat por evento · Notificações · WhatsApp
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#e5e0f8] rounded-xl p-1 w-fit">
        {(["chat", "notificacoes", "whatsapp"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === a ? "text-white" : "text-[#7c6ea8] hover:bg-gray-50"}`}
            style={aba === a ? { backgroundColor: "#7c3aed" } : {}}
          >
            {a === "chat" ? "Chats" : a === "notificacoes" ? "Notificações" : "WhatsApp"}
          </button>
        ))}
      </div>

      {/* Chat */}
      {aba === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}>
          {/* Event list */}
          <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[#f0eefe]">
              <p className="text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider">Eventos</p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[#f0eefe]">
              {loadingEvents ? (
                <div className="p-6 text-center text-sm text-[#7c6ea8]">Carregando eventos...</div>
              ) : events.length === 0 ? (
                <div className="p-6 text-center text-sm text-[#7c6ea8]">Nenhum evento encontrado.</div>
              ) : (
                events.map((ev) => {
                  const ativo = eventId === ev.id;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setEventId(ev.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${ativo ? "bg-[#f5f3ff]" : "hover:bg-gray-50"}`}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: "#7c3aed" }}
                      >
                        {ev.title?.[0] || "E"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${ativo ? "text-[#7c3aed]" : "text-[#1e1b4b]"}`}>
                          {ev.title}
                        </p>
                        <p className="text-xs text-[#7c6ea8] truncate">{formatDate(ev.date)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat window */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden flex flex-col">
            {/* Chat header */}
            <div className="px-6 py-4 border-b border-[#f0eefe] flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: "#7c3aed" }}
              >
                {selectedEvent?.title?.[0] || "E"}
              </div>
              <div>
                <p className="font-semibold text-[#1e1b4b]">{selectedEvent?.title || "Selecione um evento"}</p>
                <p className="text-xs text-[#7c6ea8]">
                  {selectedEvent ? `${messages.length} mensagens` : ""}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {!eventId ? (
                <div className="flex-1 flex items-center justify-center h-full">
                  <p className="text-sm text-[#7c6ea8]">Selecione um evento para ver as mensagens.</p>
                </div>
              ) : loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-[#7c6ea8]">Carregando mensagens...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-[#7c6ea8]">Nenhuma mensagem ainda. Envie a primeira!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const mine = isMyMessage(msg);
                  const initials = msg.sender.name
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("");
                  return (
                    <div key={msg.id} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                      {!mine && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5 overflow-hidden"
                          style={{ backgroundColor: "#7c3aed" }}
                        >
                          {msg.sender.photoUrl ? (
                            <img src={msg.sender.photoUrl} alt={msg.sender.name} className="w-full h-full object-cover" />
                          ) : (
                            initials
                          )}
                        </div>
                      )}
                      <div className={`max-w-sm ${mine ? "items-end" : "items-start"} flex flex-col`}>
                        {!mine && (
                          <p className="text-xs font-medium text-[#5b5077] mb-1">{msg.sender.name}</p>
                        )}
                        <div
                          className="px-4 py-2.5 rounded-2xl text-sm"
                          style={
                            mine
                              ? { backgroundColor: "#7c3aed", color: "white", borderBottomRightRadius: "4px" }
                              : { backgroundColor: "#f5f3ff", color: "#1e1b4b", borderBottomLeftRadius: "4px" }
                          }
                        >
                          {msg.text}
                        </div>
                        <p className="text-xs text-[#7c6ea8] mt-1">{formatTime(msg.createdAt)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-[#f0eefe]">
              <div className="flex gap-3">
                <input
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={!eventId || sending}
                  placeholder={selectedEvent ? `Mensagem para ${selectedEvent.title}...` : "Selecione um evento..."}
                  className="flex-1 px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#a78bfa] transition-colors disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!eventId || !novaMensagem.trim() || sending}
                  className="px-4 py-2.5 rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#7c3aed" }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notificações */}
      {aba === "notificacoes" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "#ede9fe" }}>
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#1e1b4b] mb-2">Notificações</h3>
            <p className="text-sm text-[#7c6ea8] max-w-sm">
              Gerenciamento de notificações estará disponível em breve.
            </p>
          </div>
        </div>
      )}

      {/* WhatsApp */}
      {aba === "whatsapp" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#dcfce7" }}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#16a34a">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-[#1e1b4b]">Integração WhatsApp</h3>
                  <p className="text-xs text-[#7c6ea8]">Informacional</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-[#f5f3ff] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#1e1b4b]">Lembretes automáticos</p>
                    <p className="text-xs text-[#7c6ea8]">1 dia antes do serviço</p>
                  </div>
                  <div className="w-10 h-6 rounded-full relative" style={{ backgroundColor: "#7c3aed" }}>
                    <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow" />
                  </div>
                </div>
                <div className="flex items-center justify-between bg-[#f5f3ff] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#1e1b4b]">Consulta de disponibilidade</p>
                    <p className="text-xs text-[#7c6ea8]">Mensal, no dia 25</p>
                  </div>
                  <div className="w-10 h-6 rounded-full relative" style={{ backgroundColor: "#7c3aed" }}>
                    <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow" />
                  </div>
                </div>
                <div className="flex items-center justify-between bg-[#f5f3ff] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#1e1b4b]">Confirmação de escala</p>
                    <p className="text-xs text-[#7c6ea8]">Ao gerar nova escala</p>
                  </div>
                  <div className="w-10 h-6 rounded-full relative" style={{ backgroundColor: "#7c3aed" }}>
                    <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "#dcfce7" }}>
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="#16a34a">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#1e1b4b] mb-2">Histórico de Envios</h3>
            <p className="text-sm text-[#7c6ea8] max-w-sm">
              Integração com WhatsApp para envio de mensagens estará disponível em breve.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
