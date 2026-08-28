import { useState, useEffect, useCallback } from "react";
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

interface Ministry {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
}

interface WhatsAppStatus {
  configured: boolean;
  connected: boolean;
  status: string;
  phone?: string;
  name?: string;
  session?: string;
  error?: string;
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

  // WhatsApp state
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [targetType, setTargetType] = useState<"ALL" | "MINISTRY" | "LEADERS">("ALL");
  const [selectedMinistryId, setSelectedMinistryId] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState<{ total: number; sentWhatsapp: number } | null>(null);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  // Test WhatsApp
  const [testPhone, setTestPhone] = useState("");
  const [testingWa, setTestingWa] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const user = useAuth((s) => s.user);

  useEffect(() => {
    api<Event[]>("/events")
      .then((data) => {
        setEvents(data);
        if (data.length > 0) setEventId(data[0].id);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));

    api<Ministry[]>("/ministries")
      .then((data) => {
        setMinistries(data);
        if (data.length > 0) setSelectedMinistryId(data[0].id);
      })
      .catch(() => setMinistries([]));
  }, []);

  const fetchWhatsAppStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = await api<WhatsAppStatus>("/whatsapp/status");
      setWaStatus(data);
    } catch {
      setWaStatus({
        configured: false,
        connected: false,
        status: "OFFLINE",
        error: "Não foi possível conectar ao servidor",
      });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (aba === "whatsapp") {
      fetchWhatsAppStatus();
    }
  }, [aba, fetchWhatsAppStatus]);

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

  async function handleBroadcastSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!broadcastMessage.trim() || broadcasting) return;

    setBroadcasting(true);
    setBroadcastSuccess(null);
    setBroadcastError(null);

    try {
      const res = await api<{ ok: boolean; totalRecipients: number; sentViaWhatsapp: number }>(
        "/whatsapp/broadcast",
        {
          method: "POST",
          body: {
            message: broadcastMessage.trim(),
            ministryId: targetType === "MINISTRY" ? selectedMinistryId : undefined,
            target: targetType === "LEADERS" ? "LEADERS" : "ALL",
          },
        }
      );

      setBroadcastSuccess({
        total: res.totalRecipients,
        sentWhatsapp: res.sentViaWhatsapp,
      });
      setBroadcastMessage("");
    } catch (err: any) {
      setBroadcastError(err?.message || "Erro ao disparar comunicado.");
    } finally {
      setBroadcasting(false);
    }
  }

  async function handleTestWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    if (!testPhone.trim() || testingWa) return;

    setTestingWa(true);
    setTestFeedback(null);

    try {
      const res = await api<{ ok: boolean; message: string }>("/whatsapp/test", {
        method: "POST",
        body: { phone: testPhone.trim() },
      });
      setTestFeedback({ success: true, message: res.message || "Mensagem enviada com sucesso!" });
      setTestPhone("");
    } catch (err: any) {
      setTestFeedback({
        success: false,
        message: err?.message || "Falha no envio de teste. Verifique a conexão do WAHA.",
      });
    } finally {
      setTestingWa(false);
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
            Chat por evento · Notificações · WhatsApp & Comunicados
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#e5e0f8] rounded-xl p-1 w-fit">
        {(["chat", "notificacoes", "whatsapp"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === a ? "text-white shadow-sm" : "text-[#7c6ea8] hover:bg-gray-50"}`}
            style={aba === a ? { backgroundColor: "#7c3aed" } : {}}
          >
            {a === "chat" ? "Chats de Evento" : a === "notificacoes" ? "Notificações" : "WhatsApp & Disparos"}
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
                  className="px-4 py-2.5 rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede9fe]">
                <svg className="w-5 h-5 text-[#7c3aed]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1e1b4b]">Central de Notificações em Tempo Real</h3>
                <p className="text-xs text-[#7c6ea8]">Alertas instantâneos via WebSocket para todos os membros</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#f8f7ff] border border-[#ede9fe] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-[#7c3aed] font-semibold text-sm">
                  <span>📅</span> Novas Escalas & Lembretes
                </div>
                <p className="text-xs text-[#5b5077] leading-relaxed">
                  Voluntários recebem avisos imediatos ao serem adicionados em escalas e 24h antes do culto.
                </p>
              </div>

              <div className="bg-[#f8f7ff] border border-[#ede9fe] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-[#7c3aed] font-semibold text-sm">
                  <span>🔄</span> Solicitações de Troca
                </div>
                <p className="text-xs text-[#5b5077] leading-relaxed">
                  Líderes e voluntários são notificados instantaneamente quando alguém solicita ou aceita trocas de escala.
                </p>
              </div>

              <div className="bg-[#f8f7ff] border border-[#ede9fe] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-[#7c3aed] font-semibold text-sm">
                  <span>🏆</span> Gamificação & Check-in
                </div>
                <p className="text-xs text-[#5b5077] leading-relaxed">
                  Confirmação visual de pontos e badges conquistados ao realizar check-in no culto.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp & Disparos */}
      {aba === "whatsapp" && (
        <div className="space-y-6">
          {/* Status Bar */}
          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#dcfce7] flex-shrink-0">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#16a34a">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#1e1b4b]">Serviço de WhatsApp (WAHA)</h2>
                    {loadingStatus ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        Verificando...
                      </span>
                    ) : waStatus?.connected ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Conectado
                      </span>
                    ) : waStatus?.status === "SCAN_QR_CODE" || waStatus?.status === "QR_CODE_PENDING" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Aguardando QR Code
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        {waStatus?.configured ? "Desconectado" : "Não Configurado"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#7c6ea8] mt-0.5">
                    {waStatus?.connected
                      ? `Sessão "${waStatus.session || "default"}" ativa · Número: +${waStatus.phone || "Pareado"}`
                      : waStatus?.configured
                      ? "O servidor WAHA está configurado mas precisa ser autenticado ou iniciado."
                      : "Defina WHATSAPP_API_URL no ambiente para ativar disparos automáticos."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchWhatsAppStatus}
                  disabled={loadingStatus}
                  className="px-3.5 py-2 text-xs font-medium text-[#7c3aed] bg-[#f5f3ff] hover:bg-[#ede9fe] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 ${loadingStatus ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Atualizar Conexão
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Broadcast Form (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-5">
              <div className="flex items-center gap-2">
                <span className="text-xl">📢</span>
                <div>
                  <h3 className="font-bold text-[#1e1b4b]">Disparo de Comunicado em Massa</h3>
                  <p className="text-xs text-[#7c6ea8]">Envie avisos oficiais para voluntários via WhatsApp e Notificação no App</p>
                </div>
              </div>

              <form onSubmit={handleBroadcastSubmit} className="space-y-4">
                {/* Target selector */}
                <div>
                  <label className="block text-xs font-semibold text-[#5b5077] uppercase tracking-wider mb-2">
                    Destinatários
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetType("ALL")}
                      className={`px-3 py-2.5 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        targetType === "ALL"
                          ? "bg-[#7c3aed] text-white border-[#7c3aed] shadow-sm"
                          : "bg-[#f8f7ff] text-[#5b5077] border-[#e5e0f8] hover:bg-[#ede9fe]"
                      }`}
                    >
                      🏛️ Toda a Igreja
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetType("MINISTRY")}
                      className={`px-3 py-2.5 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        targetType === "MINISTRY"
                          ? "bg-[#7c3aed] text-white border-[#7c3aed] shadow-sm"
                          : "bg-[#f8f7ff] text-[#5b5077] border-[#e5e0f8] hover:bg-[#ede9fe]"
                      }`}
                    >
                      🎵 Por Ministério
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetType("LEADERS")}
                      className={`px-3 py-2.5 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        targetType === "LEADERS"
                          ? "bg-[#7c3aed] text-white border-[#7c3aed] shadow-sm"
                          : "bg-[#f8f7ff] text-[#5b5077] border-[#e5e0f8] hover:bg-[#ede9fe]"
                      }`}
                    >
                      👑 Somente Líderes
                    </button>
                  </div>
                </div>

                {/* Ministry selector */}
                {targetType === "MINISTRY" && (
                  <div>
                    <label className="block text-xs font-semibold text-[#5b5077] uppercase tracking-wider mb-1.5">
                      Selecione o Ministério
                    </label>
                    <select
                      value={selectedMinistryId}
                      onChange={(e) => setSelectedMinistryId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] bg-white focus:outline-none focus:border-[#7c3aed]"
                    >
                      {ministries.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Message input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#5b5077] uppercase tracking-wider">
                      Mensagem do Comunicado
                    </label>
                    <span className="text-[11px] text-[#7c6ea8]">
                      {broadcastMessage.length} caracteres
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Ex: Paz a todos! Teremos ensaio geral no sábado às 15h. Contamos com a presença de todos."
                    className="w-full px-4 py-3 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#7c3aed] transition-colors resize-none"
                  />
                  <p className="text-[11px] text-[#7c6ea8] mt-1">
                    Dica: No WhatsApp, use <span className="font-mono text-purple-700">*negrito*</span> ou <span className="font-mono text-purple-700">_itálico_</span> para destacar palavras.
                  </p>
                </div>

                {broadcastSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                    <span className="text-base">✅</span>
                    <div>
                      <strong>Comunicado enviado!</strong> {broadcastSuccess.total} voluntário(s) notificados no App ({broadcastSuccess.sentWhatsapp} via WhatsApp direto).
                    </div>
                  </div>
                )}

                {broadcastError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                    <span className="text-base">❌</span>
                    <div>{broadcastError}</div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!broadcastMessage.trim() || broadcasting}
                  className="w-full py-3 px-4 rounded-xl text-white font-medium text-sm transition-all shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                  style={{ backgroundColor: "#7c3aed" }}
                >
                  {broadcasting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Disparando comunicados...
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      Disparar Comunicado via WhatsApp & App
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Side Column: Test + Active Automations (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Test form */}
              <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧪</span>
                  <div>
                    <h3 className="font-bold text-[#1e1b4b] text-sm">Teste Rápido de Disparo</h3>
                    <p className="text-xs text-[#7c6ea8]">Envie uma mensagem de teste para seu celular</p>
                  </div>
                </div>

                <form onSubmit={handleTestWhatsApp} className="space-y-3">
                  <input
                    type="tel"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Ex: 71999998888 (com DDD)"
                    className="w-full px-3.5 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#7c3aed]"
                  />

                  {testFeedback && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                        testFeedback.success
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}
                    >
                      <span>{testFeedback.success ? "✅" : "⚠️"}</span>
                      <span>{testFeedback.message}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!testPhone.trim() || testingWa}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-[#16a34a] bg-[#dcfce7] hover:bg-[#bbf7d0] transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {testingWa ? "Enviando teste..." : "Enviar Mensagem de Teste WhatsApp"}
                  </button>
                </form>
              </div>

              {/* Automations Info */}
              <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-3">
                <h3 className="font-bold text-[#1e1b4b] text-sm">Automações Ativas 24/7</h3>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5 bg-[#f8f7ff] p-3 rounded-xl">
                    <span className="text-sm mt-0.5">⏰</span>
                    <div>
                      <p className="text-xs font-semibold text-[#1e1b4b]">Lembrete 24h antes do Culto</p>
                      <p className="text-[11px] text-[#7c6ea8]">Disparado a cada 15 min pelo agendador automático.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 bg-[#f8f7ff] p-3 rounded-xl">
                    <span className="text-sm mt-0.5">📱</span>
                    <div>
                      <p className="text-xs font-semibold text-[#1e1b4b]">Confirmação Interativa (1 ou 2)</p>
                      <p className="text-[11px] text-[#7c6ea8]">O voluntário responde "1" e a escala confirma no banco de dados.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 bg-[#f8f7ff] p-3 rounded-xl">
                    <span className="text-sm mt-0.5">🎉</span>
                    <div>
                      <p className="text-xs font-semibold text-[#1e1b4b]">Aprovação de Voluntários</p>
                      <p className="text-[11px] text-[#7c6ea8]">Ao aprovar na triagem, envia link para definir senha (48h).</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
