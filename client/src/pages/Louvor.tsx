import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../store";

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

  useEffect(() => {
    void carregarMusicas();
    void carregarEventos();
    if (canManageHolyrics) void carregarHolyrics();
  }, [canManageHolyrics]);

  useEffect(() => {
    if (setlistAberta) void carregarSetlist(setlistAberta);
  }, [setlistAberta]);

  async function carregarMusicas() {
    setCarregandoMusicas(true);
    try { setMusicas(await api<Song[]>("/songs")); } finally { setCarregandoMusicas(false); }
  }

  async function carregarEventos() {
    setCarregandoEventos(true);
    try { setEventos(await api<Event[]>("/events")); } finally { setCarregandoEventos(false); }
  }

  async function carregarSetlist(eventId: string) {
    setCarregandoSetlist(true);
    try { setSetlistItens(await api<SetlistItem[]>(`/events/${eventId}/setlist`)); } catch { setSetlistItens([]); } finally { setCarregandoSetlist(false); }
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
      await api("/holyrics/config", {
        method: "PUT",
        body: {
          mode: holyricsForm.mode,
          localIp: holyricsForm.mode === "local" ? holyricsForm.localIp.trim() : undefined,
          localPort: holyricsForm.mode === "local" ? Number(holyricsForm.localPort) : undefined,
          token: holyricsForm.token.trim() || undefined,
          apiKey: holyricsForm.mode === "online" ? holyricsForm.apiKey.trim() || undefined : undefined,
        },
      });
      await carregarHolyrics();
      setHolyricsFeedback({ type: "ok", text: "Configuração do Holyrics salva." });
    } catch (err: any) {
      setHolyricsFeedback({ type: "error", text: err?.message || "Não foi possível salvar a configuração do Holyrics." });
    } finally {
      setHolyricsSaving(false);
    }
  }

  async function importarDoHolyrics() {
    setHolyricsFeedback(null);
    try {
      const result = await api<{ imported: number; updated: number; total: number }>("/holyrics/import-songs", { method: "POST", body: {} });
      await carregarMusicas();
      setHolyricsFeedback({ type: "ok", text: `Importação concluída: ${result.imported} novas e ${result.updated} atualizadas.` });
    } catch (err: any) {
      setHolyricsFeedback({ type: "error", text: err?.message || "Falha ao importar músicas do Holyrics." });
    }
  }

  async function sincronizarMusica(songId: string) {
    setSyncingSongId(songId);
    setHolyricsFeedback(null);
    try {
      const result = await api<{ song: Song; result: string }>(`/holyrics/sync-song/${songId}`, { method: "POST", body: {} });
      setMusicas((current) => current.map((song) => (song.id === songId ? result.song : song)));
      setHolyricsFeedback({ type: "ok", text: result.result === "linked" ? "Música vinculada ao item já existente no Holyrics." : "Música sincronizada com o Holyrics." });
    } catch (err: any) {
      setHolyricsFeedback({ type: "error", text: err?.message || "Falha ao sincronizar música com Holyrics." });
      await carregarMusicas();
    } finally {
      setSyncingSongId(null);
    }
  }

  async function sincronizarBiblioteca() {
    setSyncingLibrary(true);
    setHolyricsFeedback(null);
    try {
      const result = await api<{ synced: number; linked: number; failed: number; errors: Array<{ song: string; error: string }> }>("/holyrics/sync-library", { method: "POST", body: {} });
      await carregarMusicas();
      setHolyricsFeedback({
        type: result.failed > 0 ? "error" : "ok",
        text: `Biblioteca sincronizada: ${result.synced} criada(s)/atualizada(s), ${result.linked} vinculada(s), ${result.failed} falha(s).${result.errors[0] ? ` Primeira falha: ${result.errors[0].song} — ${result.errors[0].error}` : ""}`,
      });
    } catch (err: any) {
      setHolyricsFeedback({ type: "error", text: err?.message || "Falha ao sincronizar biblioteca com Holyrics." });
    } finally {
      setSyncingLibrary(false);
    }
  }

  async function enviarSetlistHolyrics() {
    if (!setlistAberta) return;
    setHolyricsFeedback(null);
    try {
      const result = await api<{ sent: number; skipped: string[]; liturgyItems: number }>(`/events/${setlistAberta}/holyrics/send-setlist`, { method: "POST", body: { clear: true } });
      await carregarMusicas();
      setHolyricsFeedback({ type: "ok", text: `Setlist publicada no Holyrics (${result.sent} música(s) e ${result.liturgyItems} item(ns) de liturgia no painel).${result.skipped.length ? ` Sem vínculo: ${result.skipped.join(", ")}` : ""}` });
    } catch (err: any) {
      setHolyricsFeedback({ type: "error", text: err?.message || "Falha ao enviar setlist ao Holyrics." });
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
      } else {
        await carregarMusicas();
      }
      setNovaMusica({ title: "", artist: "", originalKey: "", bpm: "", structure: "", youtubeUrl: "", spotifyUrl: "", cifraClubUrl: "", lyrics: "", chords: "" });
      setShowAddModal(false);
    } finally { setAdicionandoMusica(false); }
  }

  async function removerMusica(id: string) {
    await api(`/songs/${id}`, { method: "DELETE" });
    await carregarMusicas();
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

  async function removerItemSetlist(id: string) {
    await api(`/setlist-items/${id}`, { method: "DELETE" });
    if (setlistAberta) await carregarSetlist(setlistAberta);
  }

  const musicasFiltradas = useMemo(
    () => musicas.filter((m) => m.title.toLowerCase().includes(buscaMusica.toLowerCase()) || (m.artist || "").toLowerCase().includes(buscaMusica.toLowerCase())),
    [musicas, buscaMusica]
  );
  const toggleMusica = (id: string) => setMusicasSelecionadas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>Ministério de Louvor</h1>
          <p className="text-[#5b5077] text-sm mt-1">{musicas.length} músicas no repertório · {eventos.length} eventos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageHolyrics && <button onClick={() => setShowHolyricsModal(true)} className="px-4 py-2 rounded-xl border border-[#e5e0f8] text-[#7c3aed] text-sm font-semibold">Holyrics</button>}
          {canManageHolyrics && <button onClick={importarDoHolyrics} className="px-4 py-2 rounded-xl border border-[#e5e0f8] text-[#1e1b4b] text-sm font-semibold">Importar do Holyrics</button>}
          {canManageHolyrics && <button onClick={sincronizarBiblioteca} disabled={syncingLibrary} className="px-4 py-2 rounded-xl border border-[#e5e0f8] text-[#1e1b4b] text-sm font-semibold disabled:opacity-50">{syncingLibrary ? "Sincronizando..." : "Sincronizar repertório"}</button>}
          <button onClick={() => setAba("novo")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: "#7c3aed" }}>Nova Setlist</button>
        </div>
      </div>

      {holyricsFeedback && <div className={`rounded-2xl border px-4 py-3 text-sm ${holyricsFeedback.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>{holyricsFeedback.text}</div>}

      {canManageHolyrics && (
        <div className="bg-white rounded-2xl border border-[#e5e0f8] p-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#1e1b4b]">Status Holyrics</p>
            <p className="text-xs text-[#7c6ea8] mt-1">{holyricsLoading ? "Carregando status..." : holyricsStatus?.connected ? `Conectado${holyricsStatus?.version ? ` · versão ${holyricsStatus.version}` : ""}` : holyricsStatus?.configured ? (holyricsStatus.error || "Configurado, porém sem conexão") : "Ainda não configurado"}</p>
            {holyricsStatus?.permissionsError && <p className="text-[11px] text-amber-700 mt-1">Permissões do token: {holyricsStatus.permissionsError}</p>}
            {holyricsStatus?.help && <p className="text-[11px] text-[#7c6ea8] mt-1">{holyricsStatus.help}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${holyricsStatus?.connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{holyricsStatus?.connected ? "Conectado" : holyricsStatus?.configured ? "Sem conexão" : "Não configurado"}</span>
            {holyricsStatus?.permissionsHealthy !== undefined && <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${holyricsStatus.permissionsHealthy ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{holyricsStatus.permissionsHealthy ? "Permissões OK" : "Permissões pendentes"}</span>}
            <button onClick={carregarHolyrics} className="px-4 py-2 rounded-xl border border-[#e5e0f8] text-sm font-semibold text-[#7c3aed]">Atualizar status</button>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-white border border-[#e5e0f8] rounded-xl p-1 w-fit">
        {(["setlists", "repertorio", "novo"] as const).map((a) => (
          <button key={a} onClick={() => setAba(a)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === a ? "text-white" : "text-[#7c6ea8] hover:bg-gray-50"}`} style={aba === a ? { backgroundColor: "#7c3aed" } : {}}>{a === "setlists" ? "Setlists" : a === "repertorio" ? "Repertório" : "Nova Setlist"}</button>
        ))}
      </div>

      {aba === "setlists" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            {carregandoEventos ? <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8 text-center"><p className="text-sm text-[#7c6ea8]">Carregando eventos...</p></div> : eventos.map((e) => (
              <button key={e.id} onClick={() => setSetlistAberta(e.id)} className={`w-full text-left bg-white rounded-2xl border p-4 ${setlistAberta === e.id ? "border-[#a78bfa] shadow-md" : "border-[#e5e0f8]"}`}>
                <p className="font-semibold text-[#1e1b4b] text-sm">{e.title}</p>
                <p className="text-xs text-[#7c6ea8] mt-0.5">{new Date(e.date).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
              </button>
            ))}
          </div>
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
            {setlistAberta ? (() => {
              const ev = eventos.find((e) => e.id === setlistAberta);
              return <>
                <div className="px-6 py-4 border-b border-[#f0eefe] flex items-center justify-between gap-3" style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)" }}>
                  <div>
                    <h2 className="font-bold text-[#1e1b4b]">{ev?.title || "Evento"}</h2>
                    <p className="text-sm text-[#7c6ea8]">{ev && new Date(ev.date).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
                  </div>
                  {canManageHolyrics && <button onClick={enviarSetlistHolyrics} className="px-4 py-2 rounded-xl bg-[#1e1b4b] text-white text-sm font-semibold">Publicar no Holyrics</button>}
                </div>
                {carregandoSetlist ? <div className="flex items-center justify-center h-48"><p className="text-sm text-[#7c6ea8]">Carregando setlist...</p></div> : setlistItens.length === 0 ? <div className="flex flex-col items-center justify-center h-48 text-[#7c6ea8]"><p className="text-sm">Nenhuma música nesta setlist</p></div> : <>
                  <div className="divide-y divide-[#f0eefe]">
                    {setlistItens.map((item, i) => {
                      const tom = item.songKey || item.song.originalKey || "?";
                      const tomColor = tomColors[tom] || "#7c3aed";
                      return <div key={item.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[#fafafe] transition-colors group">
                        <span className="text-lg font-bold text-[#d4c7f7] w-6 text-center">{item.order || i + 1}</span>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: tomColor }}>{tom}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#1e1b4b] text-sm">{item.song.title}</p>
                          <p className="text-xs text-[#7c6ea8]">{item.song.artist || "Sem artista"} · {item.song.bpm ? `${item.song.bpm} BPM` : "sem BPM"}{item.song.holyricsId ? " · vinc. Holyrics" : " · sem vínculo Holyrics"}</p>
                        </div>
                        <button onClick={() => removerItemSetlist(item.id)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold">Remover</button>
                      </div>;
                    })}
                  </div>
                  <div className="px-6 py-4 border-t border-[#f0eefe] flex items-center justify-between"><p className="text-xs text-[#7c6ea8]">Duração estimada: ~{setlistItens.length * 4} min</p><p className="text-xs text-[#7c6ea8]">Vinculadas ao Holyrics: {setlistItens.filter((item) => !!item.song.holyricsId).length}</p></div>
                </>}
              </>;
            })() : <div className="flex flex-col items-center justify-center h-48 text-[#7c6ea8]"><p className="text-sm">Selecione um evento</p></div>}
          </div>
        </div>
      )}

      {aba === "repertorio" && (
        <div className="space-y-4">
          <div className="relative max-w-sm"><input value={buscaMusica} onChange={(e) => setBuscaMusica(e.target.value)} placeholder="Buscar música..." className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" /></div>
          {carregandoMusicas ? <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8 text-center"><p className="text-sm text-[#7c6ea8]">Carregando repertório...</p></div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{musicasFiltradas.map((m) => {
            const tomColor = tomColors[m.originalKey || ""] || "#7c3aed";
            return <div key={m.id} className="bg-white rounded-2xl border border-[#e5e0f8] p-5">
              <div className="flex items-start justify-between mb-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: tomColor }}>{m.originalKey || "?"}</div><div className="flex gap-2">{m.holyricsId && <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Holyrics</span>}</div></div>
              <h3 className="font-semibold text-[#1e1b4b]">{m.title}</h3><p className="text-sm text-[#7c6ea8]">{m.artist || "Sem artista"}</p>
              <div className="flex items-center gap-3 mt-3"><span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: tomColor + "15", color: tomColor }}>Tom {m.originalKey || "?"}</span>{m.bpm && <span className="text-xs text-[#7c6ea8]">{m.bpm} BPM</span>}</div>
              <div className="mt-4 flex gap-2 flex-wrap">{canManageHolyrics && <button onClick={() => sincronizarMusica(m.id)} disabled={syncingSongId === m.id} className="px-3 py-2 rounded-xl border border-[#c4b5fd] text-[#7c3aed] text-xs font-semibold disabled:opacity-50">{syncingSongId === m.id ? "Sincronizando..." : m.holyricsId ? "Reenviar" : "Enviar ao Holyrics"}</button>}<button onClick={() => removerMusica(m.id)} className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-semibold">Excluir</button></div>
              {m.holyricsSyncStatus && <p className={`mt-3 text-[11px] ${m.holyricsSyncStatus === "ERROR" ? "text-red-600" : "text-[#7c6ea8]"}`}>Status Holyrics: {m.holyricsSyncStatus}{m.holyricsLastSyncAt ? ` · ${new Date(m.holyricsLastSyncAt).toLocaleString("pt-BR")}` : ""}{m.holyricsSyncError ? ` · ${m.holyricsSyncError}` : ""}</p>}
            </div>;
          })}<button onClick={() => setShowAddModal(true)} className="bg-white rounded-2xl border-2 border-dashed border-[#c4b5fd] p-5 flex flex-col items-center justify-center gap-2 text-[#7c3aed] min-h-[150px]"><span className="text-sm font-medium">Adicionar Música</span></button></div>}
          {showAddModal && <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-xl space-y-4"><h3 className="font-semibold text-[#1e1b4b]">Nova Música</h3><input value={novaMusica.title} onChange={(e) => setNovaMusica({ ...novaMusica, title: e.target.value })} placeholder="Título *" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" /><input value={novaMusica.artist} onChange={(e) => setNovaMusica({ ...novaMusica, artist: e.target.value })} placeholder="Artista" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" /><div className="grid grid-cols-2 gap-3"><input value={novaMusica.originalKey} onChange={(e) => setNovaMusica({ ...novaMusica, originalKey: e.target.value })} placeholder="Tom" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" /><input value={novaMusica.bpm} onChange={(e) => setNovaMusica({ ...novaMusica, bpm: e.target.value })} placeholder="BPM" type="number" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" /></div><input value={novaMusica.youtubeUrl} onChange={(e) => setNovaMusica({ ...novaMusica, youtubeUrl: e.target.value })} placeholder="YouTube URL" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" /><input value={novaMusica.spotifyUrl} onChange={(e) => setNovaMusica({ ...novaMusica, spotifyUrl: e.target.value })} placeholder="Spotify URL" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" /><input value={novaMusica.cifraClubUrl} onChange={(e) => setNovaMusica({ ...novaMusica, cifraClubUrl: e.target.value })} placeholder="CifraClub URL" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" /><textarea value={novaMusica.structure} onChange={(e) => setNovaMusica({ ...novaMusica, structure: e.target.value })} placeholder="Estrutura" rows={3} className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl resize-none" /><textarea value={novaMusica.lyrics} onChange={(e) => setNovaMusica({ ...novaMusica, lyrics: e.target.value })} placeholder="Letra da música (separe blocos com linha em branco)" rows={6} className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl resize-none" /><textarea value={novaMusica.chords} onChange={(e) => setNovaMusica({ ...novaMusica, chords: e.target.value })} placeholder="Cifra/observações para palco (opcional)" rows={4} className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl resize-none" /><label className="flex items-center gap-2 text-sm text-[#5b5077]"><input type="checkbox" checked={syncAfterCreate} onChange={(e) => setSyncAfterCreate(e.target.checked)} /> Enviar ao Holyrics após criar</label><div className="flex gap-3 justify-end"><button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium text-[#7c6ea8]">Cancelar</button><button onClick={adicionarMusica} disabled={!novaMusica.title.trim() || adicionandoMusica} className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#7c3aed" }}>{adicionandoMusica ? "Salvando..." : "Adicionar"}</button></div></div></div>}
        </div>
      )}

      {aba === "novo" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-4"><h2 className="font-semibold text-[#1e1b4b]">Criar Nova Setlist</h2><div><label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Evento</label><select value={setlistAberta || ""} onChange={(e) => setSetlistAberta(e.target.value || null)} className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl"><option value="">Selecione um evento</option>{eventos.map((e) => <option key={e.id} value={e.id}>{e.title} — {new Date(e.date).toLocaleDateString("pt-BR")}</option>)}</select></div><div><label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-2">Músicas Selecionadas ({musicasSelecionadas.length})</label>{musicasSelecionadas.length === 0 ? <p className="text-sm text-[#7c6ea8]">Selecione músicas ao lado →</p> : <div className="space-y-2">{musicasSelecionadas.map((id, i) => { const m = musicas.find((x) => x.id === id); if (!m) return null; return <div key={id} className="flex items-center gap-3 bg-[#f5f3ff] rounded-xl px-3 py-2"><span className="text-xs font-bold text-[#7c3aed]">{i + 1}</span><span className="text-sm font-medium text-[#1e1b4b] flex-1">{m.title}</span><button onClick={() => toggleMusica(id)} className="text-[#7c6ea8]">×</button></div>; })}</div>}</div><label className="flex items-center gap-2 text-sm text-[#5b5077]"><input type="checkbox" checked={publishAfterSave} onChange={(e) => setPublishAfterSave(e.target.checked)} /> Publicar no Holyrics ao salvar a setlist</label><button onClick={salvarSetlist} disabled={!setlistAberta || musicasSelecionadas.length === 0 || salvandoSetlist} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#7c3aed" }}>{salvandoSetlist ? "Salvando..." : "Salvar Setlist"}</button></div>
          <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden"><div className="px-6 py-4 border-b border-[#f0eefe]"><h2 className="font-semibold text-[#1e1b4b]">Repertório</h2><p className="text-xs text-[#7c6ea8]">Clique para adicionar à setlist</p></div><div className="divide-y divide-[#f0eefe] max-h-96 overflow-y-auto">{carregandoMusicas ? <div className="p-8 text-center"><p className="text-sm text-[#7c6ea8]">Carregando...</p></div> : musicas.map((m) => { const selecionada = musicasSelecionadas.includes(m.id); const tomColor = tomColors[m.originalKey || ""] || "#7c3aed"; return <button key={m.id} onClick={() => toggleMusica(m.id)} className={`w-full flex items-center gap-4 px-6 py-3.5 text-left transition-colors ${selecionada ? "bg-[#f5f3ff]" : "hover:bg-gray-50"}`}><div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: selecionada ? "#7c3aed" : tomColor }}>{selecionada ? "✓" : m.originalKey || "?"}</div><div className="flex-1"><p className="text-sm font-medium text-[#1e1b4b]">{m.title}</p><p className="text-xs text-[#7c6ea8]">{m.artist || "Sem artista"} {m.bpm ? `· ${m.bpm} BPM` : ""}</p></div>{m.holyricsId && <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Holyrics</span>}</button>; })}</div></div>
        </div>
      )}

      {showHolyricsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between"><h3 className="font-semibold text-[#1e1b4b]">Configuração Holyrics</h3><button onClick={() => setShowHolyricsModal(false)} className="text-[#7c6ea8]">×</button></div>
            <select value={holyricsForm.mode} onChange={(e) => setHolyricsForm((prev) => ({ ...prev, mode: e.target.value as "local" | "online" }))} className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl"><option value="local">Local</option><option value="online">Online</option></select>
            {holyricsForm.mode === "local" ? <div className="grid grid-cols-2 gap-3"><input value={holyricsForm.localIp} onChange={(e) => setHolyricsForm((prev) => ({ ...prev, localIp: e.target.value }))} placeholder="IP local do Holyrics" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" /><input value={holyricsForm.localPort} onChange={(e) => setHolyricsForm((prev) => ({ ...prev, localPort: e.target.value }))} placeholder="Porta" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" /></div> : <input value={holyricsForm.apiKey} onChange={(e) => setHolyricsForm((prev) => ({ ...prev, apiKey: e.target.value }))} placeholder="API key" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" />}
            <input value={holyricsForm.token} onChange={(e) => setHolyricsForm((prev) => ({ ...prev, token: e.target.value }))} placeholder="Token" className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl" />
            <div className="rounded-xl bg-[#f8f7ff] border border-[#ede9fe] p-4 text-xs text-[#5b5077] space-y-1"><p>• Modo local: o PC com Holyrics precisa estar ligado, na mesma rede e com API Server ativado.</p><p>• Modo online: use token e API key válidos do painel do Holyrics.</p><p>• Para criar ou editar músicas direto no Holyrics, habilite as permissões avançadas do API Server.</p></div>
            <div className="flex justify-end gap-3"><button onClick={testarHolyrics} className="px-4 py-2 rounded-xl border border-[#e5e0f8] text-[#7c3aed] text-sm font-semibold">Testar conexão</button>{canEditHolyricsConfig && <button onClick={salvarConfigHolyrics} disabled={holyricsSaving} className="px-4 py-2 rounded-xl bg-[#7c3aed] text-white text-sm font-semibold disabled:opacity-50">{holyricsSaving ? "Salvando..." : "Salvar configuração"}</button>}</div>
          </div>
        </div>
      )}
    </div>
  );
}
