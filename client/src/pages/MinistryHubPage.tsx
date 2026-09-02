import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../store";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/EmptyState";

interface Ministry {
  id: string;
  name: string;
  color?: string | null;
  description?: string | null;
  members?: Array<{
    id: string;
    isLeader: boolean;
    roles?: string[];
    member: {
      id: string;
      name: string;
      email?: string | null;
      phone?: string | null;
      photoUrl?: string | null;
      avatarKey?: string | null;
    };
  }>;
}

interface FeedPost {
  id: string;
  content: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  linkUrl: string | null;
  authorName: string;
  createdAt: string;
  member: {
    id: string;
    name: string;
    photoUrl?: string | null;
    avatarKey?: string | null;
  };
  comments: Array<{
    id: string;
    content: string;
    authorName: string;
    createdAt: string;
    member: {
      id: string;
      name: string;
      photoUrl?: string | null;
      avatarKey?: string | null;
    };
  }>;
}

export default function MinistryHubPage() {
  const { id: routeMinistryId } = useParams();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [selectedMinistryId, setSelectedMinistryId] = useState<string>("");
  const [loadingMinistries, setLoadingMinistries] = useState(true);
  const [aba, setAba] = useState<"feed" | "chat" | "membros" | "escalas">("feed");

  // Feed State
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);

  // Equipe Chat State (simulado com armazenamento local ou endpoint de mensagens)
  const [teamMessages, setTeamMessages] = useState<Array<{ id: string; authorName: string; content: string; createdAt: string }>>([]);
  const [newTeamMsg, setNewTeamMsg] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Próximas Escalas
  const [scales, setScales] = useState<any[]>([]);
  const [loadingScales, setLoadingScales] = useState(false);

  // Carregar lista de ministérios disponíveis
  useEffect(() => {
    async function loadMinistries() {
      setLoadingMinistries(true);
      try {
        const data = await api<Ministry[]>("/ministries");
        setMinistries(data);
        if (routeMinistryId && data.some((m) => m.id === routeMinistryId)) {
          setSelectedMinistryId(routeMinistryId);
        } else if (data.length > 0) {
          setSelectedMinistryId(data[0].id);
        }
      } catch {
        // Fallback
      } finally {
        setLoadingMinistries(false);
      }
    }
    loadMinistries();
  }, [routeMinistryId]);

  // Carregar Feed
  useEffect(() => {
    if (!selectedMinistryId || aba !== "feed") return;
    async function fetchPosts() {
      setLoadingFeed(true);
      try {
        const feedData = await api<FeedPost[]>("/feed/posts");
        setPosts(feedData);
      } catch {
        setPosts([]);
      } finally {
        setLoadingFeed(false);
      }
    }
    fetchPosts();
  }, [selectedMinistryId, aba]);

  // Carregar Escalas
  useEffect(() => {
    if (!selectedMinistryId || aba !== "escalas") return;
    async function fetchScales() {
      setLoadingScales(true);
      try {
        const events = await api<any[]>("/events");
        setScales(events.slice(0, 10));
      } catch {
        setScales([]);
      } finally {
        setLoadingScales(false);
      }
    }
    fetchScales();
  }, [selectedMinistryId, aba]);

  // Enviar publicação no Feed da Equipe
  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!postContent.trim() && !mediaUrl.trim() && !linkUrl.trim()) return;
    setPosting(true);
    try {
      const newPost = await api<FeedPost>("/feed/posts", {
        method: "POST",
        body: {
          content: postContent.trim() || undefined,
          mediaUrl: mediaUrl.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
        },
      });
      setPosts((prev) => [newPost, ...prev]);
      setPostContent("");
      setMediaUrl("");
      setLinkUrl("");
    } catch (err: any) {
      alert("Erro ao publicar: " + (err.message || "Tente novamente"));
    } finally {
      setPosting(false);
    }
  }

  // Comentar em post
  async function handleAddComment(postId: string) {
    const text = commentDrafts[postId]?.trim();
    if (!text) return;
    setCommentingPostId(postId);
    try {
      const comment = await api<any>(`/feed/posts/${postId}/comments`, {
        method: "POST",
        body: { content: text },
      });
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments: [...(p.comments || []), comment] } : p))
      );
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    } catch (err: any) {
      alert("Erro ao comentar: " + (err.message || "Tente novamente"));
    } finally {
      setCommentingPostId(null);
    }
  }

  // Enviar mensagem no chat da equipe
  function handleSendTeamMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamMsg.trim()) return;
    const msg = {
      id: Date.now().toString(),
      authorName: user?.memberName || user?.email || "Você",
      content: newTeamMsg.trim(),
      createdAt: new Date().toISOString(),
    };
    setTeamMessages((prev) => [...prev, msg]);
    setNewTeamMsg("");
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const currentMinistry = ministries.find((m) => m.id === selectedMinistryId);

  if (loadingMinistries) {
    return (
      <div className="py-20 text-center text-sm text-[var(--color-muted)]">
        Carregando informações do ministério...
      </div>
    );
  }

  if (!currentMinistry) {
    return (
      <div className="py-16">
        <EmptyState
          title="Nenhum ministério encontrado"
          description="Você ainda não está vinculado a um ministério ativo ou a lista está vazia."
        />
      </div>
    );
  }

  const ministryMembers = currentMinistry.members || [];
  const leaders = ministryMembers.filter((m) => m.isLeader);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Seletor de Modo (visível para Admin e Líderes) */}
      {(user?.role === "ADMIN" || user?.role === "MINISTRY_LEADER") && (
        <div className="flex gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-1.5 w-fit shadow-xs">
          <button
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all bg-[var(--color-primary)] text-white shadow-sm cursor-default"
          >
            Hub & Mural da Equipe
          </button>
          <button
            onClick={() => navigate("/ministerios-gestao")}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] cursor-pointer"
          >
            Gestão de Ministérios & Trocas ⚙
          </button>
        </div>
      )}

      {/* Seletor Rápido de Múltiplos Ministérios (Pills / Chips) */}
      {ministries.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider whitespace-nowrap mr-1">
            Minhas Equipes:
          </span>
          {ministries.map((m) => {
            const isCurrent = m.id === selectedMinistryId;
            return (
              <button
                key={m.id}
                onClick={() => {
                  setSelectedMinistryId(m.id);
                  navigate(`/ministerios/${m.id}`);
                }}
                className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  isCurrent
                    ? "bg-[var(--color-primary)] text-white shadow-md shadow-violet-500/20 ring-2 ring-violet-400/30"
                    : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-border)]"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: m.color || "var(--color-primary)" }}
                />
                <span>{m.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Top Banner: Informações do Ministério Selecionado */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl text-white shadow-md"
              style={{ backgroundColor: currentMinistry.color || "var(--color-primary)" }}
            >
              {currentMinistry.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)]" style={{ fontFamily: "'Fraunces', serif" }}>
                  {currentMinistry.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                  {ministryMembers.length} voluntário(s)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
                Liderança:{" "}
                <strong className="text-[var(--color-ink)]">
                  {leaders.length > 0 ? leaders.map((l) => l.member.name).join(", ") : "Não definido"}
                </strong>
              </p>
            </div>
          </div>

          {/* Trocar de Ministério se houver mais de um */}
          {ministries.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[var(--color-muted)] whitespace-nowrap">
                Alternar equipe:
              </label>
              <select
                value={selectedMinistryId}
                onChange={(e) => {
                  setSelectedMinistryId(e.target.value);
                  navigate(`/ministerios/${e.target.value}`);
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-primary)]"
              >
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Abas Internas do Ministério */}
        <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-4 mt-6 overflow-x-auto pb-1">
          <button
            onClick={() => setAba("feed")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              aba === "feed"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            Mural da Equipe
          </button>
          <button
            onClick={() => setAba("chat")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              aba === "chat"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            Chat da Equipe
          </button>
          <button
            onClick={() => setAba("membros")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              aba === "membros"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            Voluntários ({ministryMembers.length})
          </button>
          <button
            onClick={() => setAba("escalas")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              aba === "escalas"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            Próximos Cultos
          </button>
        </div>
      </div>

      {/* CONTEÚDO DAS ABAS */}

      {/* ABA 1: Mural & Feed da Equipe */}
      {aba === "feed" && (
        <div className="space-y-5">
          {/* Caixa de Criação de Post */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <Avatar name={user?.memberName || user?.email} photoUrl={user?.photoUrl} size={38} />
              <p className="text-xs font-semibold text-[var(--color-muted)]">
                Compartilhe um recado, foto de ensaio ou aviso para a equipe de {currentMinistry.name}
              </p>
            </div>
            <form onSubmit={handleCreatePost} className="space-y-3">
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="O que você quer compartilhar com o ministério hoje?"
                rows={3}
                className="w-full p-3.5 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] resize-none transition-colors"
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="URL de foto / imagem (opcional)"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={posting || (!postContent.trim() && !mediaUrl.trim())}
                  className="px-5 py-2 rounded-xl bg-[var(--color-primary)] text-white text-xs sm:text-sm font-semibold hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  {posting ? "Publicando..." : "Publicar no Mural"}
                </button>
              </div>
            </form>
          </div>

          {/* Lista de Publicações */}
          {loadingFeed ? (
            <div className="py-12 text-center text-xs text-[var(--color-muted)]">
              Carregando publicações do mural...
            </div>
          ) : posts.length === 0 ? (
            <div className="py-12">
              <EmptyState
                title="Mural vazio no momento"
                description={`Seja o primeiro a compartilhar uma foto ou aviso com a equipe de ${currentMinistry.name}!`}
              />
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-3.5"
              >
                {/* Autor do Post */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={post.authorName} photoUrl={post.member?.photoUrl} avatarKey={post.member?.avatarKey} size={40} />
                    <div>
                      <p className="font-bold text-sm text-[var(--color-ink)]">{post.authorName}</p>
                      <p className="text-[11px] text-[var(--color-muted)]">
                        {new Date(post.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Conteúdo do Post */}
                {post.content && (
                  <p className="text-sm text-[var(--color-ink)] leading-relaxed whitespace-pre-line">
                    {post.content}
                  </p>
                )}

                {/* Imagem do Post */}
                {post.mediaUrl && (
                  <div className="rounded-xl overflow-hidden border border-[var(--color-border)] max-h-96 bg-black/5">
                    <img src={post.mediaUrl} alt="Foto da publicação" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Seção de Comentários */}
                <div className="border-t border-[var(--color-border)] pt-3 space-y-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                    Comentários ({post.comments?.length || 0})
                  </span>

                  {post.comments?.map((c) => (
                    <div key={c.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--color-surface-2)]">
                      <Avatar name={c.authorName} photoUrl={c.member?.photoUrl} avatarKey={c.member?.avatarKey} size={28} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--color-ink)]">{c.authorName}</span>
                          <span className="text-[10px] text-[var(--color-muted)]">
                            {new Date(c.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{c.content}</p>
                      </div>
                    </div>
                  ))}

                  {/* Input de Novo Comentário */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={commentDrafts[post.id] || ""}
                      onChange={(e) => setCommentDrafts({ ...commentDrafts, [post.id]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id)}
                      placeholder="Escreva um comentário..."
                      className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddComment(post.id)}
                      disabled={commentingPostId === post.id || !commentDrafts[post.id]?.trim()}
                      className="px-3.5 py-2 rounded-xl bg-[var(--color-primary)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
                    >
                      {commentingPostId === post.id ? "..." : "Comentar"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ABA 2: Chat da Equipe */}
      {aba === "chat" && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-sm flex flex-col h-[520px] overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-[var(--color-ink)]">Canal da Equipe de {currentMinistry.name}</h3>
              <p className="text-[11px] text-[var(--color-muted)]">Converse com todos os companheiros deste ministério</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              Canal Ativo
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--color-background)]">
            {teamMessages.length === 0 ? (
              <div className="py-24 text-center text-xs text-[var(--color-muted)] space-y-1">
                <p className="font-semibold text-sm text-[var(--color-ink)]">Início da conversa da equipe</p>
                <p>Nenhuma mensagem enviada hoje. Diga olá para os voluntários!</p>
              </div>
            ) : (
              teamMessages.map((m) => {
                const isMe = m.authorName === (user?.memberName || user?.email);
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-[var(--color-muted)] mb-0.5 px-1">{m.authorName}</span>
                    <div
                      className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isMe
                          ? "bg-[var(--color-primary)] text-white"
                          : "bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)]"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendTeamMessage} className="p-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-2">
            <input
              type="text"
              value={newTeamMsg}
              onChange={(e) => setNewTeamMsg(e.target.value)}
              placeholder={`Enviar mensagem para a equipe de ${currentMinistry.name}...`}
              className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]"
            />
            <button
              type="submit"
              disabled={!newTeamMsg.trim()}
              className="px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-40 cursor-pointer"
            >
              Enviar
            </button>
          </form>
        </div>
      )}

      {/* ABA 3: Membros da Equipe */}
      {aba === "membros" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ministryMembers.map((item) => (
            <div
              key={item.id}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-[var(--color-primary)] transition-all shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={item.member.name} photoUrl={item.member.photoUrl} avatarKey={item.member.avatarKey} size={44} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm text-[var(--color-ink)] truncate">{item.member.name}</p>
                    {item.isLeader && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        Líder
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-muted)] truncate">
                    {item.roles && item.roles.length > 0 ? item.roles.join(", ") : "Voluntário"}
                  </p>
                </div>
              </div>

              {item.member.phone && (
                <a
                  href={`https://wa.me/55${item.member.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 hover:bg-emerald-100 transition-colors flex-shrink-0"
                  title="Conversar no WhatsApp"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ABA 4: Próximas Escalas */}
      {aba === "escalas" && (
        <div className="space-y-3">
          {loadingScales ? (
            <div className="py-12 text-center text-xs text-[var(--color-muted)]">Carregando cultos...</div>
          ) : scales.length === 0 ? (
            <EmptyState title="Nenhum culto agendado" description="Não há escalas futuras registradas no momento." />
          ) : (
            scales.map((event) => (
              <div
                key={event.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <h4 className="font-bold text-sm text-[var(--color-ink)]">{event.title}</h4>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">
                    {new Date(event.date).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                    {event.startTime ? ` às ${event.startTime}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/chat?eventId=${event.id}`)}
                  className="px-3.5 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-primary)] bg-[var(--color-surface-2)] text-xs font-semibold hover:opacity-90 cursor-pointer flex items-center gap-1.5"
                >
                  Abrir Chat do Culto ↗
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
