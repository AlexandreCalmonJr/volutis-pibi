import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth, useNotifications, type NotificationItem } from "../store";
import { resolveNotificationTarget } from "../lib/notifications";
import { Avatar } from "../components/Avatar";

interface Event {
  id: string;
  title: string;
  date: string;
}

interface ChatSender {
  name: string;
  photoUrl?: string | null;
  avatarKey?: string | null;
}

interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  authorName: string;
}

function toChatSender(message: ChatMessage): ChatSender {
  return {
    name: message.authorName,
    photoUrl: null,
    avatarKey: null,
  };
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
  qrCode?: string | null;
  phone?: string;
  name?: string;
  session?: string;
  error?: string;
}

export default function Comunicacao() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tabParam = searchParams.get("tab");
  const requestedEventId = searchParams.get("eventId");
  const highlightedNotificationId = searchParams.get("notificationId");
  const highlightedMessageId = searchParams.get("messageId");
  const [aba, setAba] = useState<"chat" | "feed" | "notificacoes" | "whatsapp">("chat");
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

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
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [feedPosts, setFeedPosts] = useState<Array<any>>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [postingFeed, setPostingFeed] = useState(false);
  const [feedForm, setFeedForm] = useState({ content: "", mediaType: "IMAGE", mediaUrl: "", linkUrl: "" });
  const [feedCommentDrafts, setFeedCommentDrafts] = useState<Record<string, string>>({});

  // Test WhatsApp
  const [testPhone, setTestPhone] = useState("");
  const [testingWa, setTestingWa] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const user = useAuth((s) => s.user);
  const isLeaderOrAdmin = user?.role === "ADMIN" || user?.role === "MINISTRY_LEADER";
  const requestedTab = tabParam === "notificacoes" ? tabParam : tabParam === "whatsapp" && isLeaderOrAdmin ? tabParam : tabParam === "feed" ? tabParam : "chat";
  const notifications = useNotifications((s) => s.items);
  const setNotifications = useNotifications((s) => s.setItems);
  const markReadLocal = useNotifications((s) => s.markReadLocal);
  const markAllReadLocal = useNotifications((s) => s.markAllReadLocal);

  useEffect(() => {
    setAba(requestedTab);
  }, [requestedTab]);

  useEffect(() => {
    async function loadChatEvents() {
      setLoadingEvents(true);
      try {
        if (isLeaderOrAdmin) {
          const data = await api<Event[]>("/events");
          setEvents(data);
          if (requestedEventId && data.some((event) => event.id === requestedEventId)) {
            setEventId(requestedEventId);
          } else if (data.length > 0) {
            setEventId(data[0].id);
          }
        } else {
          const mySchedule = await api<{ items: Array<{ event: Event }> }>("/my/schedule?scope=all");
          const uniqueEventsMap = new Map<string, Event>();
          for (const item of mySchedule.items ?? []) {
            if (item.event && !uniqueEventsMap.has(item.event.id)) {
              uniqueEventsMap.set(item.event.id, item.event);
            }
          }
          const userEvents = Array.from(uniqueEventsMap.values());
          setEvents(userEvents);
          if (requestedEventId && userEvents.some((event) => event.id === requestedEventId)) {
            setEventId(requestedEventId);
          } else if (userEvents.length > 0) {
            setEventId(userEvents[0].id);
          }
        }
      } catch {
        setEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    }

    loadChatEvents();

    if (isLeaderOrAdmin) {
      api<Ministry[]>("/ministries")
        .then((data) => {
          setMinistries(data);
          if (data.length > 0) setSelectedMinistryId(data[0].id);
        })
        .catch(() => setMinistries([]));
    }
  }, [requestedEventId, isLeaderOrAdmin]);

  const fetchWhatsAppStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = await api<WhatsAppStatus & { qrCode?: string | null }>("/whatsapp/status");
      setWaStatus(data);
    } catch {
      setWaStatus({
        configured: false,
        connected: false,
        status: "DISCONNECTED",
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
    if (aba !== "chat") return;
    if (requestedEventId && events.some((event) => event.id === requestedEventId)) {
      setEventId(requestedEventId);
    }
  }, [aba, requestedEventId, events]);

  const fetchNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const res = await api<{ items: NotificationItem[] }>("/my/notifications?limit=50");
      setNotifications(res.items);
    } catch {
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  }, [setNotifications]);

  const fetchFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const posts = await api<any[]>("/feed/posts");
      setFeedPosts(posts);
    } catch {
      setFeedPosts([]);
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    if (aba === "notificacoes") fetchNotifications();
    if (aba === "feed") fetchFeed();
  }, [aba, fetchNotifications, fetchFeed]);

  // Polling quando estiver aguardando leitura do QR Code
  useEffect(() => {
    let interval: any = null;
    if (aba === "whatsapp" && (waStatus?.status === "SCAN_QR_CODE" || waStatus?.status === "CONNECTING")) {
      interval = setInterval(() => {
        api<WhatsAppStatus & { qrCode?: string | null }>("/whatsapp/status")
          .then((res) => {
            setWaStatus(res);
            if (res.connected) clearInterval(interval);
          })
          .catch(() => {});
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [aba, waStatus?.status]);

  async function handleConnectWhatsApp() {
    setConnecting(true);
    try {
      const res = await api<WhatsAppStatus & { qrCode?: string | null }>("/whatsapp/connect", {
        method: "POST",
      });
      setWaStatus(res);
    } catch {
      fetchWhatsAppStatus();
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnectWhatsApp() {
    if (!window.confirm("Deseja realmente desconectar o WhatsApp da Igreja?")) return;
    setDisconnecting(true);
    try {
      await api("/whatsapp/disconnect", { method: "POST" });
      setWaStatus({
        configured: true,
        connected: false,
        status: "DISCONNECTED",
      });
    } catch {
      fetchWhatsAppStatus();
    } finally {
      setDisconnecting(false);
    }
  }

  useEffect(() => {
    if (!eventId) return;
    setLoadingMessages(true);
    setChatError(null);
    api<ChatMessage[]>(`/events/${eventId}/chat`)
      .then(setMessages)
      .catch((err: any) => {
        setMessages([]);
        setChatError(err?.message || "Não foi possível carregar as mensagens.");
      })
      .finally(() => setLoadingMessages(false));
  }, [eventId]);

  useEffect(() => {
    if (aba !== "chat" || !eventId) return;
    const interval = setInterval(() => {
      const last = messages[messages.length - 1];
      const qs = last?.createdAt ? `?after=${encodeURIComponent(last.createdAt)}` : "";
      api<ChatMessage[]>(`/events/${eventId}/chat${qs}`)
        .then((incoming) => {
          if (!incoming.length) return;
          setMessages((prev) => {
            const seen = new Set(prev.map((item) => item.id));
            const merged = [...prev];
            for (const item of incoming) {
              if (!seen.has(item.id)) merged.push(item);
            }
            return merged;
          });
        })
        .catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [aba, eventId, messages]);

  const selectedEvent = events.find((e) => e.id === eventId);

  async function handleSend() {
    if (!novaMensagem.trim() || !eventId || sending) return;
    setSending(true);
    const text = novaMensagem.trim();
    setNovaMensagem("");
    setChatError(null);
    try {
      const created = await api<ChatMessage>(`/events/${eventId}/chat`, {
        method: "POST",
        body: { content: text },
      });
      setMessages((prev) => [...prev, created]);
    } catch (err: any) {
      setNovaMensagem(text);
      setChatError(err?.message || "Não foi possível enviar a mensagem.");
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
    return msg.authorName === (user?.memberName || user?.email || "");
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatNotificationDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleReadNotification(id: string) {
    markReadLocal(id);
    try {
      await api(`/notifications/${id}/read`, { method: "POST" });
    } catch {
      // best effort
    }
  }

  async function handleReadAllNotifications() {
    markAllReadLocal();
    try {
      await api("/notifications/read-all", { method: "POST" });
    } catch {
      // best effort
    }
  }

  async function handleCreateFeedPost(e: React.FormEvent) {
    e.preventDefault();
    if (!feedForm.content.trim() && !feedForm.mediaUrl.trim() && !feedForm.linkUrl.trim()) return;
    setPostingFeed(true);
    try {
      await api("/feed/posts", {
        method: "POST",
        body: {
          content: feedForm.content.trim() || undefined,
          mediaType: feedForm.mediaUrl.trim() ? feedForm.mediaType : feedForm.linkUrl.trim() ? "LINK" : undefined,
          mediaUrl: feedForm.mediaUrl.trim() || undefined,
          linkUrl: feedForm.linkUrl.trim() || undefined,
        },
      });
      setFeedForm({ content: "", mediaType: "IMAGE", mediaUrl: "", linkUrl: "" });
      await fetchFeed();
    } finally {
      setPostingFeed(false);
    }
  }

  async function handleFeedComment(postId: string) {
    const content = feedCommentDrafts[postId]?.trim();
    if (!content) return;
    await api(`/feed/posts/${postId}/comments`, { method: "POST", body: { content } });
    setFeedCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    await fetchFeed();
  }

  function handleChangeTab(nextTab: "chat" | "feed" | "notificacoes" | "whatsapp") {
    setAba(nextTab);
    const params = new URLSearchParams(searchParams);
    params.set("tab", nextTab);
    if (nextTab !== "chat") {
      params.delete("eventId");
      params.delete("messageId");
    } else if (eventId) {
      params.set("eventId", eventId);
    }
    if (nextTab !== "notificacoes") {
      params.delete("notificationId");
    }
    setSearchParams(params, { replace: true });
  }

  function handleSelectEvent(nextEventId: string) {
    setEventId(nextEventId);
    const params = new URLSearchParams(searchParams);
    params.set("tab", "chat");
    params.set("eventId", nextEventId);
    params.delete("messageId");
    setSearchParams(params, { replace: true });
  }

  function openNotificationContext(item: NotificationItem) {
    const target = resolveNotificationTarget(item);
    if (!item.readAt) {
      void handleReadNotification(item.id);
    }
    navigate(target.path);
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
            Chat por evento · Notificações{isLeaderOrAdmin ? " · WhatsApp & Comunicados" : ""}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#e5e0f8] rounded-xl p-1 w-fit">
        {(["chat", "feed", "notificacoes", ...(isLeaderOrAdmin ? ["whatsapp"] : [])] as const).map((a) => (
          <button
            key={a}
            onClick={() => handleChangeTab(a as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === a ? "text-white shadow-sm" : "text-[#7c6ea8] hover:bg-gray-50"}`}
            style={aba === a ? { backgroundColor: "#7c3aed" } : {}}
          >
            {a === "chat" ? "Chats de Evento" : a === "feed" ? "Feed" : a === "notificacoes" ? "Notificações" : "WhatsApp & Disparos"}
          </button>
        ))}
      </div>

      {aba === "feed" && (
        <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6">
          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-4 h-fit">
            <div>
              <h3 className="font-bold text-[#1e1b4b]">Feed da Igreja</h3>
              <p className="text-xs text-[#7c6ea8] mt-1">Compartilhe ideias, fotos, áudios e links com a equipe.</p>
            </div>
            <form onSubmit={handleCreateFeedPost} className="space-y-3">
              <textarea value={feedForm.content} onChange={(e) => setFeedForm((prev) => ({ ...prev, content: e.target.value }))} rows={5} placeholder="Conte uma novidade, deixe um recado ou organize a equipe..." className="w-full px-4 py-3 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#7c3aed] resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={feedForm.mediaType} onChange={(e) => setFeedForm((prev) => ({ ...prev, mediaType: e.target.value }))} className="w-full px-3.5 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] bg-white focus:outline-none focus:border-[#7c3aed]">
                  <option value="IMAGE">Foto</option>
                  <option value="AUDIO">Áudio</option>
                  <option value="LINK">Link</option>
                </select>
                <input value={feedForm.mediaUrl} onChange={(e) => setFeedForm((prev) => ({ ...prev, mediaUrl: e.target.value }))} placeholder="URL da mídia" className="w-full px-3.5 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" />
              </div>
              <input value={feedForm.linkUrl} onChange={(e) => setFeedForm((prev) => ({ ...prev, linkUrl: e.target.value }))} placeholder="URL extra (opcional)" className="w-full px-3.5 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" />
              <button type="submit" disabled={postingFeed} className="w-full py-3 px-4 rounded-xl text-white font-medium text-sm transition-all shadow-sm hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: "#7c3aed" }}>{postingFeed ? "Publicando..." : "Publicar no feed"}</button>
            </form>
          </div>
          <div className="space-y-4">
            {loadingFeed ? (
              <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8 text-center text-sm text-[#7c6ea8]">Carregando feed...</div>
            ) : feedPosts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8 text-center text-sm text-[#7c6ea8]">Ainda não há publicações. Faça a primeira!</div>
            ) : (
              feedPosts.map((post) => (
                <div key={post.id} className="bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={post.member?.name || post.authorName} photoUrl={post.member?.photoUrl} avatarKey={post.member?.avatarKey} size={40} />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1e1b4b]">{post.authorName}</p>
                      <p className="text-xs text-[#7c6ea8]">{formatNotificationDate(post.createdAt)}</p>
                    </div>
                  </div>
                  {post.content && <p className="text-sm text-[#1e1b4b] whitespace-pre-wrap">{post.content}</p>}
                  {post.mediaUrl && post.mediaType === "IMAGE" && <img src={post.mediaUrl} alt="Publicação" className="w-full rounded-2xl border border-[#ede9fe] object-cover max-h-[420px]" />}
                  {post.mediaUrl && post.mediaType === "AUDIO" && <audio controls className="w-full"><source src={post.mediaUrl} /></audio>}
                  {post.linkUrl && <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-xl bg-[#f5f3ff] px-4 py-2 text-sm font-semibold text-[#7c3aed]">Abrir link compartilhado</a>}
                  <div className="border-t border-[#f0eefe] pt-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#7c6ea8]">Comentários ({post.comments?.length || 0})</p>
                    <div className="space-y-3">
                      {(post.comments || []).map((comment: any) => (
                        <div key={comment.id} className="bg-[#faf8ff] rounded-xl p-3 border border-[#ede9fe]">
                          <div className="flex items-center gap-2 mb-1">
                            <Avatar name={comment.member?.name || comment.authorName} photoUrl={comment.member?.photoUrl} avatarKey={comment.member?.avatarKey} size={28} />
                            <p className="text-xs font-semibold text-[#1e1b4b]">{comment.authorName}</p>
                            <span className="text-[11px] text-[#7c6ea8]">{formatNotificationDate(comment.createdAt)}</span>
                          </div>
                          <p className="text-sm text-[#5b5077]">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input value={feedCommentDrafts[post.id] || ""} onChange={(e) => setFeedCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))} placeholder="Comente nesta publicação" className="flex-1 px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" />
                      <button type="button" onClick={() => void handleFeedComment(post.id)} className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: "#7c3aed" }}>Comentar</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
                      onClick={() => handleSelectEvent(ev.id)}
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
              {chatError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {chatError}
                </div>
              )}
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
                  const sender = toChatSender(msg);
                  return (
                    <div key={msg.id} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""} ${highlightedMessageId === msg.id ? "rounded-2xl ring-2 ring-[#7c3aed] p-2" : ""}`}>
                      {!mine && (
                        <Avatar name={sender.name} photoUrl={sender.photoUrl} avatarKey={sender.avatarKey} size={32} className="flex-shrink-0 mt-0.5" />
                      )}
                      <div className={`max-w-sm ${mine ? "items-end" : "items-start"} flex flex-col`}>
                        {!mine && (
                          <p className="text-xs font-medium text-[#5b5077] mb-1">{sender.name}</p>
                        )}
                        <div
                          className="px-4 py-2.5 rounded-2xl text-sm"
                          style={
                            mine
                              ? { backgroundColor: "#7c3aed", color: "white", borderBottomRightRadius: "4px" }
                              : { backgroundColor: "#f5f3ff", color: "#1e1b4b", borderBottomLeftRadius: "4px" }
                          }
                        >
                          {msg.content}
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
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
              <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede9fe]">
                <svg className="w-5 h-5 text-[#7c3aed]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1e1b4b]">Central de Notificações</h3>
                <p className="text-xs text-[#7c6ea8]">Histórico persistido + alertas em tempo real</p>
              </div>
            </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchNotifications}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-[#7c3aed] bg-[#f5f3ff]"
                >
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={handleReadAllNotifications}
                  disabled={!notifications.some((item) => !item.readAt)}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-white disabled:opacity-40"
                  style={{ backgroundColor: "#7c3aed" }}
                >
                  Marcar todas como lidas
                </button>
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

            <div className="mt-8 border-t border-[#f0eefe] pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-[#1e1b4b]">Notificações recentes</h4>
                  <p className="text-xs text-[#7c6ea8]">
                    {notifications.filter((item) => !item.readAt).length} não lida(s)
                  </p>
                </div>
              </div>

              {loadingNotifications ? (
                <div className="rounded-xl border border-[#ede9fe] bg-[#faf8ff] p-6 text-sm text-[#7c6ea8]">
                  Carregando notificações...
                </div>
              ) : notifications.length === 0 ? (
                <div className="rounded-xl border border-[#ede9fe] bg-[#faf8ff] p-6 text-sm text-[#7c6ea8]">
                  Nenhuma notificação encontrada para este usuário.
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 ${item.readAt ? "border-[#ede9fe] bg-white" : "border-[#c4b5fd] bg-[#faf5ff]"} ${highlightedNotificationId === item.id ? "ring-2 ring-[#7c3aed] ring-offset-2" : ""}`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="text-sm font-semibold text-[#1e1b4b]">{item.title}</h5>
                            {!item.readAt && (
                              <span className="inline-flex rounded-full bg-[#7c3aed] px-2 py-0.5 text-[10px] font-bold text-white">
                                Nova
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-[#5b5077]">{item.body}</p>
                          <p className="mt-2 text-[11px] text-[#7c6ea8]">
                            Recebida em {formatNotificationDate(item.at)}
                          </p>
                          {highlightedMessageId && item.data?.messageId === highlightedMessageId && (
                            <p className="mt-2 text-[11px] font-semibold text-[#7c3aed]">Mensagem destacada a partir da notificação</p>
                          )}
                          {item.whatsappLink && (
                            <a
                              href={item.whatsappLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex rounded-lg bg-[#16a34a] px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Abrir no WhatsApp
                            </a>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 md:items-end">
                          {!item.readAt && (
                            <button
                              type="button"
                              onClick={() => handleReadNotification(item.id)}
                              className="px-3 py-2 rounded-xl text-xs font-medium text-[#7c3aed] bg-[#f5f3ff] whitespace-nowrap"
                            >
                              Marcar como lida
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openNotificationContext(item)}
                            className="px-3 py-2 rounded-xl text-xs font-medium text-white whitespace-nowrap"
                            style={{ backgroundColor: "#7c3aed" }}
                          >
                            {resolveNotificationTarget(item).label}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp & Disparos - only for leaders/admins */}
      {aba === "whatsapp" && isLeaderOrAdmin && (
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
                    <h2 className="text-lg font-bold text-[#1e1b4b]">WhatsApp PIBI</h2>
                    {loadingStatus ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        Verificando...
                      </span>
                    ) : waStatus?.connected ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Conectado
                      </span>
                    ) : waStatus?.status === "SCAN_QR_CODE" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        Aguardando leitura do QR Code
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                        Desconectado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#7c6ea8] mt-0.5">
                    {waStatus?.connected
                      ? `Conectado ao número +${waStatus.phone || "Pareado"} · Disparos automáticos e respostas 1/2 ativas`
                      : waStatus?.status === "SCAN_QR_CODE"
                      ? "Escaneie o QR Code abaixo com o WhatsApp da Igreja para ativar."
                      : "Clique no botão Conectar WhatsApp para gerar o QR Code."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {waStatus?.connected ? (
                  <button
                    type="button"
                    onClick={handleDisconnectWhatsApp}
                    disabled={disconnecting}
                    className="px-3.5 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {disconnecting ? "Desconectando..." : "Desconectar Sessão"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectWhatsApp}
                    disabled={connecting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#16a34a] hover:bg-[#15803d] rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {connecting ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Gerando QR Code...
                      </>
                    ) : (
                      <>
                        <span>📱</span>
                        Conectar WhatsApp (Gerar QR Code)
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={fetchWhatsAppStatus}
                  disabled={loadingStatus}
                  className="px-3.5 py-2 text-xs font-medium text-[#7c3aed] bg-[#f5f3ff] hover:bg-[#ede9fe] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 ${loadingStatus ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Atualizar
                </button>
              </div>
            </div>

            {/* QR Code Banner se estiver aguardando leitura */}
            {waStatus?.status === "SCAN_QR_CODE" && waStatus?.qrCode && (
              <div className="mt-6 pt-6 border-t border-[#f0eefe] flex flex-col md:flex-row items-center justify-center gap-8 bg-[#fcfbfe] p-6 rounded-xl">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-[#e5e0f8]">
                  <img
                    src={waStatus.qrCode}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 object-contain rounded-xl"
                  />
                </div>
                <div className="space-y-3 text-center md:text-left max-w-md">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    Aguardando leitura do celular...
                  </div>
                  <h3 className="text-base font-bold text-[#1e1b4b]">Como conectar seu WhatsApp:</h3>
                  <ol className="text-xs text-[#5b5077] space-y-2 list-decimal list-inside leading-relaxed">
                    <li>Abra o <strong>WhatsApp</strong> no celular oficial da Igreja.</li>
                    <li>Toque em <strong>Mais opções</strong> (⋮) ou <strong>Configurações</strong> e selecione <strong>Aparelhos conectados</strong>.</li>
                    <li>Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para o QR Code ao lado.</li>
                  </ol>
                  <p className="text-[11px] text-[#7c6ea8]">
                    Assim que você escanear, esta tela atualizará automaticamente para <strong>🟢 Conectado</strong>!
                  </p>
                </div>
              </div>
            )}
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
