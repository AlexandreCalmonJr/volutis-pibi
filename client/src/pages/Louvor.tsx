import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../store";
import { Skeleton, ListItemSkeleton } from "../components/Skeleton";
import { Metronome } from "../components/Metronome";
import { RehearsalPlayer, RehearsalTrack } from "../components/RehearsalPlayer";
import { ModalPortal } from "../components/ModalPortal";
import { ActionMenu, type ActionMenuItem, EmptyState } from "../components/ui";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  originalKey: string | null;
  bpm: number | null;
  structure: string | null;
  youtubeUrl: string | null;
  spotifyUrl: string | null;
  cifraClubUrl: string | null;
  lyrics: string | null;
  chords: string | null;
  holyricsId?: string | null;
  holyricsSyncStatus?: string | null;
  holyricsSyncError?: string | null;
  holyricsLastSyncAt?: string | null;
}

interface SetlistItem {
  id: string;
  order: number;
  songKey: string | null;
  notes: string | null;
  song: Song;
}

interface Event {
  id: string;
  title: string;
  date: string;
  startTime: string;
  roleName?: string;
}

interface HolyricsConfig {
  mode: "local" | "online" | null;
  localIp?: string | null;
  localPort?: number | null;
  hasToken: boolean;
  hasApiKey: boolean;
  configured: boolean;
}

interface HolyricsStatus {
  configured: boolean;
  connected: boolean;
  mode?: "local" | "online" | null;
  version?: string | null;
  permissions?: string[] | null;
  permissionsHealthy?: boolean;
  permissionsError?: string | null;
  error?: string | null;
  help?: string | null;
}

const tomColors: Record<string, string> = {
  A: "#7c3aed", Bb: "#2563eb", B: "#db2777", C: "#d97706",
  D: "#059669", E: "#4338ca", F: "#dc2626", "F#": "#0891b2",
  G: "#65a30d", Ab: "#9333ea",
};

const LOUVOR_ROLES = [
  "vocal", "ministro", "bateria", "baterista", "baixo", "baixista",
  "guitarra", "guitarrista", "violão", "violonista", "teclado",
  "tecladista", "teclas", "backing vocal", "backing", "voz",
  "sax", "saxofone", "flauta", "percussão", "louvor", "música", "músico"
];

function checkIsLouvorRole(roleName?: string) {
  if (!roleName) return false;
  const lower = roleName.toLowerCase();
  return LOUVOR_ROLES.some((r) => lower.includes(r));
}

export default function Louvor() {
  const user = useAuth((s) => s.user);
  const canManageHolyrics = user?.role === "ADMIN" || user?.role === "MINISTRY_LEADER";
  const canEditHolyricsConfig = user?.role === "ADMIN";
  const [aba, setAba] = useState<"setlists" | "repertorio" | "novo">("setlists");
  const [buscaMusica, setBuscaMusica] = useState("");
  const [setlistAberta, setSetlistAberta] = useState<string | null>(null);
  const [musicasSelecionadas, setMusicasSelecionadas] = useState<string[]>([]);
  const [musicas, setMusicas] = useState<Song[]>([]);
  const [eventos, setEventos] = useState<Event[]>([]);
  const [setlistItens, setSetlistItens] = useState<SetlistItem[]>([]);
  const [carregandoMusicas, setCarregandoMusicas] = useState(false);
  const [carregandoEventos, setCarregandoEventos] = useState(false);
  const [carregandoSetlist, setCarregandoSetlist] = useState(false);
  const [salvandoSetlist, setSalvandoSetlist] = useState(false);
  const [adicionandoMusica, setAdicionandoMusica] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHolyricsModal, setShowHolyricsModal] = useState(false);
  const [holyricsLoading, setHolyricsLoading] = useState(false);
  const [holyricsSaving, setHolyricsSaving] = useState(false);
  const [holyricsFeedback, setHolyricsFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [holyricsStatus, setHolyricsStatus] = useState<HolyricsStatus | null>(null);
  const [holyricsForm, setHolyricsForm] = useState({ mode: "local" as "local" | "online", localIp: "", localPort: "8091", token: "", apiKey: "" });
  const [novaMusica, setNovaMusica] = useState({ title: "", artist: "", originalKey: "", bpm: "", structure: "", youtubeUrl: "", spotifyUrl: "", cifraClubUrl: "", lyrics: "", chords: "" });
  const [syncAfterCreate, setSyncAfterCreate] = useState(true);
  const [publishAfterSave, setPublishAfterSave] = useState(true);
  const [syncingSongId, setSyncingSongId] = useState<string | null>(null);
  const [syncingLibrary, setSyncingLibrary] = useState(false);

  // Perfil e Ministérios do usuário
  const [userMinistries, setUserMinistries] = useState<string[]>([]);
  const [notifyingTeam, setNotifyingTeam] = useState(false);
  const [notifyFeedback, setNotifyFeedback] = useState<string | null>(null);
  const [selectedSongDetails, setSelectedSongDetails] = useState<Song | null>(null);

  // Metrônomo e Ensaio Online
  const [showMetronome, setShowMetronome] = useState(false);
  const [metronomeBpm, setMetronomeBpm] = useState(120);
  const [rehearsalPlaylist, setRehearsalPlaylist] = useState<RehearsalTrack[] | null>(null);
  const [rehearsalIndex, setRehearsalIndex] = useState(0);

  useEffect(() => {
    if (canManageHolyrics) {
      void carregarMusicas();
      void carregarEventos();
      void carregarHolyrics();
    } else {
      void carregarMeusEventosEscalados();
      void carregarPerfilMembro();
    }
  }, [canManageHolyrics]);

  useEffect(() => {
    if (setlistAberta) void carregarSetlist(setlistAberta);
  }, [setlistAberta]);

  async function carregarPerfilMembro() {
    try {
      const profile = await api<{ ministries?: Array<{ ministry: { name: string } }> }>("/members/me");
      if (profile.ministries) {
        setUserMinistries(profile.ministries.map((m) => m.ministry.name.toLowerCase()));
      }
    } catch {}
  }

  async function carregarMusicas() {
    setCarregandoMusicas(true);
    try { setMusicas(await api<Song[]>("/songs")); } finally { setCarregandoMusicas(false); }
  }

  async function carregarEventos() {
    setCarregandoEventos(true);
    try {
      const data = await api<Event[]>("/events");
      setEventos(data);
      if (data.length > 0 && !setlistAberta) {
        setSetlistAberta(data[0].id);
      }
    } finally {
      setCarregandoEventos(false);
    }
  }

  async function carregarMeusEventosEscalados() {
    setCarregandoEventos(true);
    try {
      const mySchedule = await api<{ items: Array<{ event: Event; roleName: string }> }>("/my/schedule?scope=all");
      const uniqueEventsMap = new Map<string, Event>();
      for (const item of mySchedule.items ?? []) {
        if (item.event && !uniqueEventsMap.has(item.event.id)) {
          uniqueEventsMap.set(item.event.id, { ...item.event, roleName: item.roleName });
        }
      }
      const list = Array.from(uniqueEventsMap.values());
      setEventos(list);
      if (list.length > 0) {
        setSetlistAberta(list[0].id);
      }
    } catch {
      setEventos([]);
    } finally {
      setCarregandoEventos(false);
    }
  }

  async function carregarSetlist(eventId: string) {
    setCarregandoSetlist(true);
    try {
      setSetlistItens(await api<SetlistItem[]>(`/events/${eventId}/setlist`));
    } catch {
      setSetlistItens([]);
    } finally {
      setCarregandoSetlist(false);
    }
  }

  async function notificarEquipe(eventId: string) {
    setNotifyingTeam(true);
    setNotifyFeedback(null);
    try {
      const res = await api<{ success: boolean; notifiedCount: number; songsCount: number }>(`/events/${eventId}/setlist/notify`, {
        method: "POST",
      });
      setNotifyFeedback(`Notificação enviada com sucesso para ${res.notifiedCount} voluntário(s) escalado(s)! 📢`);
      setTimeout(() => setNotifyFeedback(null), 4000);
    } catch (err: any) {
      alert(err?.message || "Não foi possível enviar a notificação.");
    } finally {
      setNotifyingTeam(false);
    }
  }

  async function carregarHolyrics() {
    setHolyricsLoading(true);
    try {
      const [config, status] = await Promise.all([
        api<HolyricsConfig>("/holyrics/config"),
        api<HolyricsStatus>("/holyrics/status").catch(() => ({ configured: false, connected: false })),
      ]);
      setHolyricsStatus(status);
      setHolyricsForm({
        mode: config.mode || "local",
        localIp: config.localIp || "",
        localPort: String(config.localPort || 8091),
        token: "",
        apiKey: "",
      });
    } finally {
      setHolyricsLoading(false);
    }
  }

  async function testarHolyrics() {
    setHolyricsFeedback(null);
    try {
      const result = await api<HolyricsStatus>("/holyrics/status");
      setHolyricsStatus(result);
      setHolyricsFeedback({ type: result.connected ? "ok" : "error", text: result.connected ? `Conexão OK${result.version ? ` · versão ${result.version}` : ""}` : result.error || "Holyrics não respondeu." });
    } catch (err: any) {
      setHolyricsFeedback({ type: "error", text: err?.message || "Falha ao testar conexão." });
    }
  }

  async function salvarConfigHolyrics() {
    setHolyricsSaving(true);
    setHolyricsFeedback(null);
    try {
      const payload: any = {
        mode: holyricsForm.mode,
        localIp: holyricsForm.localIp || undefined,
        localPort: holyricsForm.localPort ? Number(holyricsForm.localPort) : undefined,
      };
      if (holyricsForm.token) payload.token = holyricsForm.token;
      if (holyricsForm.apiKey) payload.apiKey = holyricsForm.apiKey;
      await api("/holyrics/config", { method: "PUT", body: payload });
      await carregarHolyrics();
      setHolyricsFeedback({ type: "ok", text: "Configuração do Holyrics salva com sucesso." });
      setShowHolyricsModal(false);
    } catch (err: any) {
      setHolyricsFeedback({ type: "error", text: err?.message || "Erro ao salvar configuração." });
    } finally {
      setHolyricsSaving(false);
    }
  }

  async function importarDoHolyrics() {
    setHolyricsFeedback(null);
    try {
      const res = await api<{ imported: number; totalInHolyrics: number }>("/holyrics/import-songs", { method: "POST" });
      setHolyricsFeedback({ type: "ok", text: `Importação concluída: ${res.imported} novas músicas importadas.` });
      await carregarMusicas();
    } catch (err: any) {
      setHolyricsFeedback({ type: "error", text: err?.message || "Erro ao importar do Holyrics." });
    }
  }

  async function sincronizarBiblioteca() {
    setSyncingLibrary(true);
    setHolyricsFeedback(null);
    try {
      const res = await api<{ sentCount: number; updatedCount: number; errorCount: number; errors: any[] }>("/holyrics/sync-library", { method: "POST" });
      setHolyricsFeedback({ type: res.errorCount === 0 ? "ok" : "error", text: `Sincronização: ${res.sentCount} enviadas, ${res.updatedCount} atualizadas.` });
      await carregarMusicas();
    } catch (err: any) {
      setHolyricsFeedback({ type: "error", text: err?.message || "Erro ao sincronizar repertório com o Holyrics." });
    } finally {
      setSyncingLibrary(false);
    }
  }

  async function sincronizarMusica(songId: string) {
    setSyncingSongId(songId);
    setHolyricsFeedback(null);
    try {
      const res = await api<any>(`/songs/${songId}/holyrics/send`, { method: "POST" });
      setHolyricsFeedback({ type: "ok", text: `Música "${res.title}" sincronizada no Holyrics.` });
      await carregarMusicas();
    } catch (err: any) {
      setHolyricsFeedback({ type: "error", text: err?.message || "Erro ao sincronizar música com Holyrics." });
    } finally {
      setSyncingSongId(null);
    }
  }

  async function enviarSetlistHolyrics() {
    if (!setlistAberta) return;
    setHolyricsFeedback(null);
    try {
      const res = await api<any>(`/events/${setlistAberta}/holyrics/send-setlist`, { method: "POST", body: { clear: true } });
      setHolyricsFeedback({ type: "ok", text: `Setlist publicada no Holyrics (${res.sent} músicas adicionadas à playlist).` });
    } catch (err: any) {
      setHolyricsFeedback({ type: "error", text: err?.message || "Erro ao enviar setlist para o Holyrics." });
    }
  }

  async function adicionarMusica() {
    if (!novaMusica.title.trim()) return;
    setAdicionandoMusica(true);
    try {
      const created = await api<Song>("/songs", {
        method: "POST",
        body: {
          title: novaMusica.title.trim(),
          artist: novaMusica.artist.trim() || undefined,
          originalKey: novaMusica.originalKey.trim() || undefined,
          bpm: novaMusica.bpm ? Number(novaMusica.bpm) : undefined,
          structure: novaMusica.structure.trim() || undefined,
          youtubeUrl: novaMusica.youtubeUrl.trim() || undefined,
          spotifyUrl: novaMusica.spotifyUrl.trim() || undefined,
          cifraClubUrl: novaMusica.cifraClubUrl.trim() || undefined,
          lyrics: novaMusica.lyrics.trim() || undefined,
          chords: novaMusica.chords.trim() || undefined,
        },
      });
      if (syncAfterCreate && canManageHolyrics && holyricsStatus?.configured) {
        await sincronizarMusica(created.id);
      }
      setNovaMusica({ title: "", artist: "", originalKey: "", bpm: "", structure: "", youtubeUrl: "", spotifyUrl: "", cifraClubUrl: "", lyrics: "", chords: "" });
      setShowAddModal(false);
      await carregarMusicas();
    } catch (err: any) {
      alert(err?.message || "Não foi possível cadastrar a música.");
    } finally {
      setAdicionandoMusica(false);
    }
  }

  async function removerMusica(id: string) {
    if (!confirm("Deseja realmente excluir esta música do repertório?")) return;
    try {
      await api(`/songs/${id}`, { method: "DELETE" });
      await carregarMusicas();
    } catch (err: any) {
      alert(err?.message || "Não foi possível excluir a música.");
    }
  }

  async function salvarSetlist() {
    if (!setlistAberta || musicasSelecionadas.length === 0) return;
    setSalvandoSetlist(true);
    try {
      for (const songId of musicasSelecionadas) {
        await api(`/events/${setlistAberta}/setlist`, { method: "POST", body: { songId } });
      }
      await carregarSetlist(setlistAberta);
      if (publishAfterSave && canManageHolyrics && holyricsStatus?.configured) {
        await enviarSetlistHolyrics();
      }
      setMusicasSelecionadas([]);
      setAba("setlists");
    } finally { setSalvandoSetlist(false); }
  }

  const [draggedSetlistIndex, setDraggedSetlistIndex] = useState<number | null>(null);

  async function reordenarSetlist(newItems: SetlistItem[]) {
    setSetlistItens(newItems);
    if (!setlistAberta) return;
    try {
      await api(`/events/${setlistAberta}/setlist/reorder`, {
        method: "PUT",
        body: { itemIds: newItems.map((i) => i.id) },
      });
    } catch (err: any) {
      alert(err?.message || "Erro ao reordenar setlist.");
      await carregarSetlist(setlistAberta);
    }
  }

  function moverItemSetlist(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= setlistItens.length) return;
    const items = [...setlistItens];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    void reordenarSetlist(items);
  }

  async function removerItemSetlist(id: string) {
    await api(`/setlist-items/${id}`, { method: "DELETE" });
    if (setlistAberta) await carregarSetlist(setlistAberta);
  }

  const musicasFiltradas = useMemo(
    () => musicas.filter((m) => m.title.toLowerCase().includes(buscaMusica.toLowerCase()) || (m.artist || "").toLowerCase().includes(buscaMusica.toLowerCase())),
    [musicas, buscaMusica]
  );
  const toggleMusica = (id: string) => setMusicasSelecionadas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const eventoAtual = eventos.find((e) => e.id === setlistAberta);
  const isLouvorVolunteer = canManageHolyrics || 
    userMinistries.some((m) => m.includes("louvor") || m.includes("música") || m.includes("musica")) ||
    checkIsLouvorRole(eventoAtual?.roleName);
  const holyricsActionItems: ActionMenuItem[] = [
    {
      id: "import-holyrics",
      label: "Importar do Holyrics",
      description: "Puxar músicas do software",
      icon: <span>📥</span>,
      onClick: importarDoHolyrics,
    },
    {
      id: "sync-holyrics",
      label: syncingLibrary ? "Sincronizando..." : "Sincronizar Repertório",
      description: "Atualizar status de sincronia",
      icon: <span>🔄</span>,
      disabled: syncingLibrary,
      onClick: sincronizarBiblioteca,
    },
    {
      id: "config-holyrics",
      label: "Configurações Holyrics",
      description: "IP, porta e token de conexão",
      icon: <span>⚙️</span>,
      onClick: () => setShowHolyricsModal(true),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Repertório & Louvor
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            {canManageHolyrics
              ? `${musicas.length} músicas no catálogo · ${eventos.length} cultos`
              : isLouvorVolunteer
              ? "Músicas e cifras dos cultos em que você está escalado para tocar e cantar"
              : "Músicas e letras dos cultos em que você está escalado"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {canManageHolyrics && (
            <>
              <ActionMenu label="Ações" items={holyricsActionItems} />
              <button
                onClick={() => setAba("novo")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 active:scale-95 shadow-sm cursor-pointer"
                style={{ backgroundColor: "#7c3aed" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nova Setlist
              </button>
            </>
          )}
        </div>
      </div>

      {notifyFeedback && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-semibold flex items-center gap-2">
          <span>📢</span> {notifyFeedback}
        </div>
      )}

      {holyricsFeedback && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${holyricsFeedback.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {holyricsFeedback.text}
        </div>
      )}

      {/* Tabs para Líder/Admin */}
      {canManageHolyrics && (
        <div className="flex gap-1 bg-white border border-[#e5e0f8] rounded-xl p-1 w-fit">
          {(["setlists", "repertorio", "novo"] as const).map((a) => (
            <button key={a} onClick={() => setAba(a)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === a ? "text-white" : "text-[#7c6ea8] hover:bg-gray-50"}`} style={aba === a ? { backgroundColor: "#7c3aed" } : {}}>
              {a === "setlists" ? "Setlists dos Cultos" : a === "repertorio" ? "Catálogo de Músicas" : "Nova Setlist"}
            </button>
          ))}
        </div>
      )}

      {/* Visão de Setlists (Tanto para voluntários quanto para líderes) */}
      {(aba === "setlists" || !canManageHolyrics) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Eventos */}
          <div className="space-y-3">
            <h3 className="font-semibold text-xs text-[#7c6ea8] uppercase tracking-wider px-1">
              {canManageHolyrics ? "Cultos com Setlist" : "Meus Cultos Escalados"}
            </h3>
            {carregandoEventos ? (
              <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8 text-center">
                <p className="text-sm text-[#7c6ea8]">Carregando eventos...</p>
              </div>
            ) : eventos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8 text-center space-y-2">
                <p className="text-sm font-semibold text-[#1e1b4b]">Nenhum culto encontrado</p>
                <p className="text-xs text-[#7c6ea8]">
                  {canManageHolyrics ? "Crie um evento na aba Eventos primeiro." : "Você não possui escalas ativas no momento."}
                </p>
              </div>
            ) : (
              eventos.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSetlistAberta(e.id)}
                  className={`w-full text-left bg-white rounded-2xl border p-4 transition-all ${
                    setlistAberta === e.id
                      ? "border-[#7c3aed] ring-2 ring-[#ddd6fe] shadow-sm"
                      : "border-[#e5e0f8] hover:border-[#c4b5fd]"
                  }`}
                >
                  <p className="font-bold text-[#1e1b4b] text-sm">{e.title}</p>
                  <p className="text-xs text-[#7c6ea8] mt-1">
                    📅 {new Date(e.date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                  </p>
                  {e.roleName && (
                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                      Sua função: {e.roleName}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Músicas do Culto Selecionado */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden flex flex-col justify-between">
            {setlistAberta ? (() => {
              const ev = eventos.find((e) => e.id === setlistAberta);
              return (
                <div>
                  {/* Cabeçalho do Culto */}
                  <div className="px-6 py-4 border-b border-[#f0eefe] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-[#f5f3ff] to-[#ede9fe]">
                    <div>
                      <h2 className="font-bold text-[#1e1b4b] text-base">{ev?.title || "Culto"}</h2>
                      <p className="text-xs text-[#7c6ea8]">
                        {ev && new Date(ev.date).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {canManageHolyrics && setlistItens.length > 0 && (
                        <ActionMenu
                          label="Ações"
                          items={[
                            {
                              id: "notify-team",
                              label: notifyingTeam ? "Enviando..." : "Notificar Músicos",
                              description: "Enviar push com músicas e tons",
                              icon: <span>📢</span>,
                              disabled: notifyingTeam,
                              onClick: () => notificarEquipe(setlistAberta),
                            },
                            {
                              id: "publish-holyrics",
                              label: "Publicar no Holyrics",
                              description: "Transmitir setlist ao Holyrics",
                              icon: <span>📡</span>,
                              onClick: enviarSetlistHolyrics,
                            },
                          ]}
                        />
                      )}

                      {setlistItens.length > 0 && (
                        <button
                          onClick={() => {
                            const tracks: RehearsalTrack[] = setlistItens.map((item) => ({
                              id: item.song.id,
                              title: item.song.title,
                              artist: item.song.artist,
                              originalKey: item.songKey || item.song.originalKey,
                              bpm: item.song.bpm,
                              youtubeUrl: item.song.youtubeUrl,
                              spotifyUrl: item.song.spotifyUrl,
                            }));
                            setRehearsalPlaylist(tracks);
                            setRehearsalIndex(0);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold hover:opacity-90 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                          title="Ouvir playlist completa do setlist com players de áudio/vídeo"
                        >
                          <span>🎧</span> Ensaio Online
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Lista de Músicas */}
                  {carregandoSetlist ? (
                    <div className="p-4 space-y-3">
                      <ListItemSkeleton />
                      <ListItemSkeleton />
                      <ListItemSkeleton />
                    </div>
                  ) : setlistItens.length === 0 ? (
                    <div className="p-8">
                      <EmptyState
                        title="Nenhuma música neste culto"
                        description="Assim que a liderança definir o repertório, as músicas e cifras aparecerão aqui."
                        actionLabel={canManageHolyrics ? "+ Adicionar Música" : undefined}
                        onAction={canManageHolyrics ? () => setAba("repertorio") : undefined}
                        className="border-0 bg-transparent shadow-none"
                      />
                    </div>
                  ) : (
                    <div className="divide-y divide-[#f0eefe]">
                      {setlistItens.map((item, i) => {
                        const tom = item.songKey || item.song.originalKey || "?";
                        const tomColor = tomColors[tom] || "#7c3aed";
                        const isDragging = draggedSetlistIndex === i;

                        return (
                          <div
                            key={item.id}
                            draggable={canManageHolyrics}
                            onDragStart={() => setDraggedSetlistIndex(i)}
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnd={() => setDraggedSetlistIndex(null)}
                            onDrop={() => {
                              if (draggedSetlistIndex !== null && draggedSetlistIndex !== i) {
                                moverItemSetlist(draggedSetlistIndex, i);
                              }
                              setDraggedSetlistIndex(null);
                            }}
                            className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                              isDragging
                                ? "opacity-40 bg-violet-50 scale-[0.98] border border-dashed border-violet-400"
                                : "hover:bg-[#faf9fe]"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Reorder controls for leaders */}
                              {canManageHolyrics && (
                                <div className="flex items-center gap-1">
                                  <div
                                    className="cursor-grab active:cursor-grabbing text-[#7c6ea8] hover:text-[#1e1b4b] p-1 font-bold text-xs"
                                    title="Arraste para reordenar esta música"
                                  >
                                    ⋮⋮
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => moverItemSetlist(i, i - 1)}
                                      disabled={i === 0}
                                      className="w-4 h-4 rounded text-[9px] flex items-center justify-center text-[#7c6ea8] hover:bg-violet-100 disabled:opacity-20"
                                      title="Mover para cima"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moverItemSetlist(i, i + 1)}
                                      disabled={i === setlistItens.length - 1}
                                      className="w-4 h-4 rounded text-[9px] flex items-center justify-center text-[#7c6ea8] hover:bg-violet-100 disabled:opacity-20"
                                      title="Mover para baixo"
                                    >
                                      ▼
                                    </button>
                                  </div>
                                </div>
                              )}

                              <span className="text-base font-bold text-[#7c6ea8] w-5 text-center">
                                {i + 1}
                              </span>

                              {/* Tom em destaque exclusivo para Louvor / Líder */}
                              {isLouvorVolunteer ? (
                                <div
                                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
                                  style={{ backgroundColor: tomColor }}
                                  title={`Tom do Culto: ${tom}`}
                                >
                                  {tom}
                                </div>
                              ) : (
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-50 text-violet-600 text-base flex-shrink-0">
                                  🎵
                                </div>
                              )}

                              <div className="min-w-0">
                                <p className="font-bold text-[#1e1b4b] text-sm truncate">{item.song.title}</p>
                                <p className="text-xs text-[#7c6ea8]">
                                  {item.song.artist || "Sem artista"}
                                  {isLouvorVolunteer && item.song.bpm ? ` · ${item.song.bpm} BPM` : ""}
                                  {isLouvorVolunteer && item.song.structure ? ` · ${item.song.structure}` : ""}
                                </p>
                                {item.notes && (
                                  <p className="text-[11px] text-amber-800 bg-amber-50 rounded-md px-2 py-0.5 mt-1 inline-block border border-amber-200">
                                    Obs: {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Links e Ações Rápidas */}
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                              <button
                                onClick={() => setSelectedSongDetails(item.song)}
                                className="px-2.5 py-1.5 rounded-lg border border-[#c4b5fd] text-[#7c3aed] hover:bg-[#f5f3ff] text-xs font-semibold transition-all flex items-center gap-1"
                              >
                                <span>📄</span> {isLouvorVolunteer ? "Letra / Cifra" : "Letra da Música"}
                              </button>

                              {/* Cifra Club apenas para Louvor */}
                              {isLouvorVolunteer && item.song.cifraClubUrl && (
                                <a
                                  href={item.song.cifraClubUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold transition-all flex items-center gap-1"
                                >
                                  <span>🎸</span> Cifra
                                </a>
                              )}

                              {/* YouTube para todos */}
                              {item.song.youtubeUrl && (
                                <a
                                  href={item.song.youtubeUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold transition-all flex items-center gap-1"
                                >
                                  <span>📺</span> YouTube
                                </a>
                              )}

                              {/* Spotify para todos */}
                              {item.song.spotifyUrl && (
                                <a
                                  href={item.song.spotifyUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-all flex items-center gap-1"
                                >
                                  <span>🎧</span> Spotify
                                </a>
                              )}

                              {canManageHolyrics && (
                                <button
                                  onClick={() => removerItemSetlist(item.id)}
                                  className="px-2 py-1.5 rounded-lg text-rose-500 hover:bg-rose-50 text-xs font-semibold transition-all"
                                  title="Remover do setlist"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {setlistItens.length > 0 && (
                    <div className="px-6 py-3 border-t border-[#f0eefe] bg-[#faf8ff] flex items-center justify-between text-xs text-[#7c6ea8]">
                      <p>Músicas: <strong>{setlistItens.length}</strong> (~{setlistItens.length * 4} min)</p>
                      {canManageHolyrics && (
                        <p>Vinculadas ao Holyrics: {setlistItens.filter((item) => !!item.song.holyricsId).length}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="flex flex-col items-center justify-center py-20 text-[#7c6ea8]">
                <p className="text-sm">Selecione um culto para ver o repertório</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Aba Catálogo de Músicas (Apenas Líder / Admin) */}
      {canManageHolyrics && aba === "repertorio" && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <input
              value={buscaMusica}
              onChange={(e) => setBuscaMusica(e.target.value)}
              placeholder="Buscar música por título ou artista..."
              className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl focus:outline-none focus:border-[#7c3aed]"
            />
          </div>
          {carregandoMusicas ? (
            <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8 text-center">
              <p className="text-sm text-[#7c6ea8]">Carregando repertório...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {musicasFiltradas.map((m) => {
                const tomColor = tomColors[m.originalKey || ""] || "#7c3aed";
                return (
                  <div key={m.id} className="bg-white rounded-2xl border border-[#e5e0f8] p-5 flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: tomColor }}>
                          {m.originalKey || "?"}
                        </div>
                        <div className="flex gap-1.5">
                          {m.holyricsId && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                              Holyrics
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className="font-bold text-[#1e1b4b] text-base">{m.title}</h3>
                      <p className="text-xs text-[#7c6ea8] mt-0.5">{m.artist || "Sem artista"}</p>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: tomColor + "15", color: tomColor }}>
                          Tom {m.originalKey || "?"}
                        </span>
                        {m.bpm && <span className="text-xs text-[#7c6ea8]">{m.bpm} BPM</span>}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#ede9fe] flex gap-2 flex-wrap items-center justify-between">
                      <button
                        onClick={() => setSelectedSongDetails(m)}
                        className="text-xs font-semibold text-[#7c3aed] hover:underline"
                      >
                        Ver Detalhes / Letra
                      </button>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => sincronizarMusica(m.id)}
                          disabled={syncingSongId === m.id}
                          className="px-2.5 py-1.5 rounded-lg border border-[#c4b5fd] text-[#7c3aed] text-xs font-semibold disabled:opacity-50 hover:bg-[#f5f3ff]"
                        >
                          {syncingSongId === m.id ? "Sincronizando..." : m.holyricsId ? "Reenviar" : "Holyrics"}
                        </button>
                        <button
                          onClick={() => removerMusica(m.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-white rounded-2xl border-2 border-dashed border-[#c4b5fd] p-5 flex flex-col items-center justify-center gap-2 text-[#7c3aed] min-h-[160px] hover:bg-[#f5f3ff] transition-colors"
              >
                <span className="text-2xl">➕</span>
                <span className="text-sm font-semibold">Adicionar Nova Música</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Aba Nova Setlist (Apenas Líder / Admin) */}
      {canManageHolyrics && aba === "novo" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-4">
            <h2 className="font-bold text-[#1e1b4b]">Montar Setlist do Culto</h2>
            <div>
              <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">
                Selecione o Culto
              </label>
              <select
                value={setlistAberta || ""}
                onChange={(e) => setSetlistAberta(e.target.value || null)}
                className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl focus:outline-none focus:border-[#7c3aed]"
              >
                <option value="">Selecione um culto...</option>
                {eventos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} — {new Date(e.date).toLocaleDateString("pt-BR")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-2">
                Músicas Selecionadas ({musicasSelecionadas.length})
              </label>
              {musicasSelecionadas.length === 0 ? (
                <p className="text-xs text-[#7c6ea8] py-2">Clique nas músicas da lista ao lado para adicionar.</p>
              ) : (
                <div className="space-y-2">
                  {musicasSelecionadas.map((id, i) => {
                    const m = musicas.find((x) => x.id === id);
                    if (!m) return null;
                    return (
                      <div key={id} className="flex items-center gap-3 bg-[#f5f3ff] border border-[#ede9fe] rounded-xl px-3 py-2">
                        <span className="text-xs font-bold text-[#7c3aed]">{i + 1}</span>
                        <span className="text-sm font-semibold text-[#1e1b4b] flex-1">{m.title}</span>
                        <span className="text-xs text-[#7c6ea8]">{m.originalKey}</span>
                        <button onClick={() => toggleMusica(id)} className="text-[#7c6ea8] hover:text-red-500 font-bold px-1">
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-[#5b5077] pt-1">
              <input type="checkbox" checked={publishAfterSave} onChange={(e) => setPublishAfterSave(e.target.checked)} />
              Publicar automaticamente no Holyrics ao salvar a setlist
            </label>

            <button
              onClick={salvarSetlist}
              disabled={!setlistAberta || musicasSelecionadas.length === 0 || salvandoSetlist}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 shadow-sm transition-all"
              style={{ backgroundColor: "#7c3aed" }}
            >
              {salvandoSetlist ? "Salvando..." : "Salvar Setlist do Culto"}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0eefe] bg-[#faf8ff]">
              <h2 className="font-bold text-[#1e1b4b] text-sm">Catálogo de Músicas</h2>
              <p className="text-xs text-[#7c6ea8]">Clique nas músicas para compor o setlist</p>
            </div>
            <div className="divide-y divide-[#f0eefe] max-h-96 overflow-y-auto">
              {carregandoMusicas ? (
                <div className="p-4 space-y-2">
                  <ListItemSkeleton />
                  <ListItemSkeleton />
                  <ListItemSkeleton />
                </div>
              ) : (
                musicas.map((m) => {
                  const selecionada = musicasSelecionadas.includes(m.id);
                  const tomColor = tomColors[m.originalKey || ""] || "#7c3aed";
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMusica(m.id)}
                      className={`w-full flex items-center gap-4 px-6 py-3 text-left transition-colors ${
                        selecionada ? "bg-[#f5f3ff]" : "hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: selecionada ? "#7c3aed" : tomColor }}
                      >
                        {selecionada ? "✓" : m.originalKey || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1e1b4b] truncate">{m.title}</p>
                        <p className="text-xs text-[#7c6ea8]">{m.artist || "Sem artista"}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes da Música (Letra / Cifra / Mídia) */}
      {selectedSongDetails && (
        <ModalPortal isOpen={!!selectedSongDetails}>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedSongDetails(null)} />
            <div className="relative bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-[#e5e0f8] space-y-4 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] overflow-y-auto my-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between border-b border-[#f0eefe] pb-4 flex-shrink-0">
                <div>
                  <h3 className="font-bold text-xl text-[#1e1b4b]">{selectedSongDetails.title}</h3>
                  <p className="text-sm text-[#7c6ea8] mt-0.5">{selectedSongDetails.artist || "Artista não informado"}</p>
                </div>
                <button onClick={() => setSelectedSongDetails(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                  ✕
                </button>
              </div>

              <div className="flex gap-2 flex-wrap">
                {isLouvorVolunteer && (
                  <span className="px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                    Tom: {selectedSongDetails.originalKey || "Livre"}
                  </span>
                )}
                {isLouvorVolunteer && selectedSongDetails.bpm && (
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                    ⏱️ {selectedSongDetails.bpm} BPM
                  </span>
                )}
                {isLouvorVolunteer && selectedSongDetails.structure && (
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                    Estrutura: {selectedSongDetails.structure}
                  </span>
                )}
              </div>

              {/* Links rápidos */}
              <div className="flex gap-2 flex-wrap pt-1">
                {(selectedSongDetails.youtubeUrl || selectedSongDetails.spotifyUrl) && (
                  <button
                    onClick={() => {
                      setRehearsalPlaylist([
                        {
                          id: selectedSongDetails.id,
                          title: selectedSongDetails.title,
                          artist: selectedSongDetails.artist,
                          originalKey: selectedSongDetails.originalKey,
                          bpm: selectedSongDetails.bpm,
                          youtubeUrl: selectedSongDetails.youtubeUrl,
                          spotifyUrl: selectedSongDetails.spotifyUrl,
                        },
                      ]);
                      setRehearsalIndex(0);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-all cursor-pointer shadow-sm"
                  >
                    🎧 Ouvir no Ensaio Online
                  </button>
                )}
                {isLouvorVolunteer && selectedSongDetails.cifraClubUrl && (
                  <a href={selectedSongDetails.cifraClubUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100">
                    🎸 Abrir no Cifra Club ↗
                  </a>
                )}
                {selectedSongDetails.youtubeUrl && (
                  <a href={selectedSongDetails.youtubeUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100">
                    📺 Assistir no YouTube ↗
                  </a>
                )}
                {selectedSongDetails.spotifyUrl && (
                  <a href={selectedSongDetails.spotifyUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-all">
                    🎧 Ouvir no Spotify ↗
                  </a>
                )}
              </div>

              {/* Letra da Música */}
              {selectedSongDetails.lyrics ? (
                <div className="space-y-1.5 pt-2">
                  <p className="text-xs font-bold text-[#5b5077] uppercase tracking-wider">Letra da Música</p>
                  <div className="p-4 bg-slate-50 dark:bg-[var(--color-surface-2)] border border-slate-200 dark:border-[var(--color-border)] rounded-2xl whitespace-pre-wrap font-sans text-sm text-[#1e1b4b] dark:text-[var(--color-ink)] leading-relaxed max-h-60 overflow-y-auto">
                    {selectedSongDetails.lyrics}
                  </div>
                </div>
              ) : null}

              {/* Cifra / Observações exclusiva para Louvor */}
              {isLouvorVolunteer && selectedSongDetails.chords ? (
                <div className="space-y-1.5 pt-2">
                  <p className="text-xs font-bold text-[#5b5077] uppercase tracking-wider">Cifra & Observações</p>
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl whitespace-pre-wrap font-mono text-xs text-amber-300 leading-relaxed max-h-60 overflow-y-auto">
                    {selectedSongDetails.chords}
                  </div>
                </div>
              ) : null}

              <div className="pt-3 flex justify-end border-t border-[#f0eefe]">
                <button
                  onClick={() => setSelectedSongDetails(null)}
                  className="px-5 py-2 rounded-xl text-white text-xs font-semibold shadow-sm"
                  style={{ backgroundColor: "#7c3aed" }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Adicionar Música */}
      {showAddModal && (
        <ModalPortal isOpen={showAddModal}>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
            <div className="relative bg-white dark:bg-[var(--color-surface)] rounded-3xl p-6 sm:p-7 w-full max-w-xl shadow-2xl border border-[#e5e0f8] dark:border-[var(--color-border)] flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] my-auto animate-in zoom-in-95 duration-150">
              {/* Header com botão de fechar */}
              <div className="flex items-center justify-between border-b border-[#f0eefe] dark:border-[var(--color-border)] pb-4 mb-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎵</span>
                  <h3 className="font-bold text-[#1e1b4b] dark:text-[var(--color-ink)] text-lg">
                    Nova Música para o Repertório
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-9 h-9 rounded-xl hover:bg-gray-100 dark:hover:bg-[var(--color-surface-2)] flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-[var(--color-ink)] transition-colors text-lg cursor-pointer"
                  title="Fechar modal"
                >
                  ✕
                </button>
              </div>

              {/* Conteúdo do Formulário */}
              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                <div>
                  <label className="block text-xs font-semibold text-[#7c6ea8] dark:text-[var(--color-muted)] uppercase tracking-wider mb-1">
                    Título *
                  </label>
                  <input
                    value={novaMusica.title}
                    onChange={(e) => setNovaMusica({ ...novaMusica, title: e.target.value })}
                    placeholder="Nome da música..."
                    className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] dark:border-[var(--color-border)] rounded-xl bg-white dark:bg-[var(--color-surface-2)] text-[#1e1b4b] dark:text-[var(--color-ink)] focus:outline-none focus:border-[#7c3aed]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#7c6ea8] dark:text-[var(--color-muted)] uppercase tracking-wider mb-1">
                    Artista / Ministério
                  </label>
                  <input
                    value={novaMusica.artist}
                    onChange={(e) => setNovaMusica({ ...novaMusica, artist: e.target.value })}
                    placeholder="Ex: Isaías Saad, Morada, Elevation..."
                    className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] dark:border-[var(--color-border)] rounded-xl bg-white dark:bg-[var(--color-surface-2)] text-[#1e1b4b] dark:text-[var(--color-ink)] focus:outline-none focus:border-[#7c3aed]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#7c6ea8] dark:text-[var(--color-muted)] uppercase tracking-wider mb-1">
                      Tom Original
                    </label>
                    <input
                      value={novaMusica.originalKey}
                      onChange={(e) => setNovaMusica({ ...novaMusica, originalKey: e.target.value })}
                      placeholder="Ex: G, A, C#, F#m"
                      className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] dark:border-[var(--color-border)] rounded-xl bg-white dark:bg-[var(--color-surface-2)] text-[#1e1b4b] dark:text-[var(--color-ink)] focus:outline-none focus:border-[#7c3aed]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#7c6ea8] dark:text-[var(--color-muted)] uppercase tracking-wider mb-1">
                      BPM (Andamento)
                    </label>
                    <input
                      type="number"
                      value={novaMusica.bpm}
                      onChange={(e) => setNovaMusica({ ...novaMusica, bpm: e.target.value })}
                      placeholder="Ex: 72"
                      className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] dark:border-[var(--color-border)] rounded-xl bg-white dark:bg-[var(--color-surface-2)] text-[#1e1b4b] dark:text-[var(--color-ink)] focus:outline-none focus:border-[#7c3aed]"
                    />
                  </div>
                </div>

                {/* Links */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#7c6ea8] dark:text-[var(--color-muted)] uppercase tracking-wider">
                    Links de Referência
                  </label>
                  <input
                    value={novaMusica.youtubeUrl}
                    onChange={(e) => setNovaMusica({ ...novaMusica, youtubeUrl: e.target.value })}
                    placeholder="YouTube URL (https://...)"
                    className="w-full px-4 py-2 text-xs border border-[#e5e0f8] dark:border-[var(--color-border)] rounded-xl bg-white dark:bg-[var(--color-surface-2)] text-[#1e1b4b] dark:text-[var(--color-ink)] focus:outline-none focus:border-[#7c3aed]"
                  />
                  <input
                    value={novaMusica.spotifyUrl}
                    onChange={(e) => setNovaMusica({ ...novaMusica, spotifyUrl: e.target.value })}
                    placeholder="Spotify URL (https://...)"
                    className="w-full px-4 py-2 text-xs border border-[#e5e0f8] dark:border-[var(--color-border)] rounded-xl bg-white dark:bg-[var(--color-surface-2)] text-[#1e1b4b] dark:text-[var(--color-ink)] focus:outline-none focus:border-[#7c3aed]"
                  />
                  <input
                    value={novaMusica.cifraClubUrl}
                    onChange={(e) => setNovaMusica({ ...novaMusica, cifraClubUrl: e.target.value })}
                    placeholder="CifraClub URL (https://...)"
                    className="w-full px-4 py-2 text-xs border border-[#e5e0f8] dark:border-[var(--color-border)] rounded-xl bg-white dark:bg-[var(--color-surface-2)] text-[#1e1b4b] dark:text-[var(--color-ink)] focus:outline-none focus:border-[#7c3aed]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#7c6ea8] dark:text-[var(--color-muted)] uppercase tracking-wider mb-1">
                    Estrutura da Música
                  </label>
                  <input
                    value={novaMusica.structure}
                    onChange={(e) => setNovaMusica({ ...novaMusica, structure: e.target.value })}
                    placeholder="Ex: Intro | V1 | Refrão | V2 | Refrão | Ponte | Solo | Fim"
                    className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] dark:border-[var(--color-border)] rounded-xl bg-white dark:bg-[var(--color-surface-2)] text-[#1e1b4b] dark:text-[var(--color-ink)] focus:outline-none focus:border-[#7c3aed]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#7c6ea8] dark:text-[var(--color-muted)] uppercase tracking-wider mb-1">
                    Letra Completa
                  </label>
                  <textarea
                    value={novaMusica.lyrics}
                    onChange={(e) => setNovaMusica({ ...novaMusica, lyrics: e.target.value })}
                    placeholder="Cole a letra da música..."
                    rows={4}
                    className="w-full px-4 py-2.5 text-xs border border-[#e5e0f8] dark:border-[var(--color-border)] rounded-xl bg-white dark:bg-[var(--color-surface-2)] text-[#1e1b4b] dark:text-[var(--color-ink)] focus:outline-none focus:border-[#7c3aed] resize-none font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#7c6ea8] dark:text-[var(--color-muted)] uppercase tracking-wider mb-1">
                    Cifra / Anotações de Palco
                  </label>
                  <textarea
                    value={novaMusica.chords}
                    onChange={(e) => setNovaMusica({ ...novaMusica, chords: e.target.value })}
                    placeholder="Anotações de palco, acordes ou dicas de execução..."
                    rows={3}
                    className="w-full px-4 py-2.5 text-xs border border-[#e5e0f8] dark:border-[var(--color-border)] rounded-xl bg-white dark:bg-[var(--color-surface-2)] text-[#1e1b4b] dark:text-[var(--color-ink)] focus:outline-none focus:border-[#7c3aed] resize-none font-mono"
                  />
                </div>
              </div>

              {/* Footer fixo */}
              <div className="flex gap-3 justify-end pt-4 border-t border-[#f0eefe] dark:border-[var(--color-border)] mt-4 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[var(--color-border)] text-sm font-semibold text-[#7c6ea8] dark:text-[var(--color-muted)] hover:bg-gray-50 dark:hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={adicionarMusica}
                  disabled={!novaMusica.title.trim() || adicionandoMusica}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all shadow-md active:scale-95 cursor-pointer"
                  style={{ backgroundColor: "#7c3aed" }}
                >
                  {adicionandoMusica ? "Salvando..." : "Adicionar ao Repertório"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Config Holyrics */}
      {showHolyricsModal && (
        <ModalPortal isOpen={showHolyricsModal}>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHolyricsModal(false)} />
            <div className="relative bg-white dark:bg-[var(--color-surface)] rounded-3xl p-6 sm:p-7 w-full max-w-lg space-y-4 shadow-2xl border border-[#e5e0f8] dark:border-[var(--color-border)] my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] overflow-y-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#f0eefe] dark:border-[var(--color-border)] pb-3 flex-shrink-0">
                <h3 className="font-bold text-[#1e1b4b] dark:text-[var(--color-ink)] text-base">Configuração Holyrics</h3>
                <button
                  type="button"
                  onClick={() => setShowHolyricsModal(false)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-[var(--color-surface-2)] flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-[var(--color-ink)]"
                >
                  ✕
                </button>
              </div>
              <select value={holyricsForm.mode} onChange={(e) => setHolyricsForm((prev) => ({ ...prev, mode: e.target.value as "local" | "online" }))} className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl">
                <option value="local">Local (Rede da Igreja)</option>
                <option value="online">Online (Nuvem)</option>
              </select>
              {holyricsForm.mode === "local" ? (
                <div className="grid grid-cols-2 gap-3">
                  <input value={holyricsForm.localIp} onChange={(e) => setHolyricsForm((prev) => ({ ...prev, localIp: e.target.value }))} placeholder="IP local do Holyrics" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" />
                  <input value={holyricsForm.localPort} onChange={(e) => setHolyricsForm((prev) => ({ ...prev, localPort: e.target.value }))} placeholder="Porta (ex: 8091)" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" />
                </div>
              ) : (
                <input value={holyricsForm.apiKey} onChange={(e) => setHolyricsForm((prev) => ({ ...prev, apiKey: e.target.value }))} placeholder="API key" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" />
              )}
              <input value={holyricsForm.token} onChange={(e) => setHolyricsForm((prev) => ({ ...prev, token: e.target.value }))} placeholder="Token" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" />
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={testarHolyrics} className="px-4 py-2 rounded-xl border border-[#e5e0f8] text-[#7c3aed] text-sm font-semibold">Testar conexão</button>
                {canEditHolyricsConfig && (
                  <button onClick={salvarConfigHolyrics} disabled={holyricsSaving} className="px-4 py-2 rounded-xl bg-[#7c3aed] text-white text-sm font-semibold disabled:opacity-50">
                    {holyricsSaving ? "Salvando..." : "Salvar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Floating Metronome */}
      {showMetronome && (
        <ModalPortal isOpen={showMetronome}>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMetronome(false)} />
            <div className="relative my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)]">
              <Metronome
                initialBpm={metronomeBpm}
                onClose={() => setShowMetronome(false)}
              />
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Ensaio Online Player */}
      {rehearsalPlaylist && (
        <RehearsalPlayer
          playlist={rehearsalPlaylist}
          initialIndex={rehearsalIndex}
          onClose={() => setRehearsalPlaylist(null)}
          onSelectTrack={(track) => {
            const found = musicas.find((m) => m.id === track.id);
            if (found) setSelectedSongDetails(found);
          }}
        />
      )}
    </div>
  );
}
