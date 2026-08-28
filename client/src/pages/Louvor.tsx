import { useState, useEffect } from "react";
import { api } from "../api";

interface Song {
  id: number;
  title: string;
  artist: string;
  originalKey: string;
  bpm: number | null;
  structure: string | null;
  youtubeUrl: string | null;
  spotifyUrl: string | null;
  cifraClubUrl: string | null;
  lyrics: string | null;
  chords: string | null;
  churchId: number;
}

interface SetlistItem {
  id: number;
  order: number;
  songKey: string | null;
  notes: string | null;
  song: { id: number; title: string; artist: string; originalKey: string; bpm: number | null; youtubeUrl?: string | null; spotifyUrl?: string | null };
}

interface Event {
  id: number;
  title: string;
  date: string;
  description?: string;
}

const tomColors: Record<string, string> = {
  "A": "#7c3aed", "Bb": "#2563eb", "B": "#db2777", "C": "#d97706",
  "D": "#059669", "E": "#4338ca", "F": "#dc2626", "F#": "#0891b2",
  "G": "#65a30d", "Ab": "#9333ea",
};

export default function Louvor() {
  const [aba, setAba] = useState<"setlists" | "repertorio" | "novo">("setlists");
  const [buscaMusica, setBuscaMusica] = useState("");
  const [setlistAberta, setSetlistAberta] = useState<number | null>(null);
  const [novoSetlist, setNovoSetlist] = useState({ eventoId: "", data: "" });
  const [musicasSelecionadas, setMusicasSelecionadas] = useState<number[]>([]);

  const [musicas, setMusicas] = useState<Song[]>([]);
  const [eventos, setEventos] = useState<Event[]>([]);
  const [setlistItens, setSetlistItens] = useState<SetlistItem[]>([]);

  const [carregandoMusicas, setCarregandoMusicas] = useState(false);
  const [carregandoEventos, setCarregandoEventos] = useState(false);
  const [carregandoSetlist, setCarregandoSetlist] = useState(false);
  const [salvandoSetlist, setSalvandoSetlist] = useState(false);
  const [adicionandoMusica, setAdicionandoMusica] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [novaMusica, setNovaMusica] = useState({ title: "", artist: "", originalKey: "", bpm: "" });

  useEffect(() => {
    carregarMusicas();
    carregarEventos();
  }, []);

  useEffect(() => {
    if (setlistAberta !== null) {
      carregarSetlist(setlistAberta);
    }
  }, [setlistAberta]);

  async function carregarMusicas() {
    setCarregandoMusicas(true);
    try {
      const data = await api<Song[]>("/songs");
      setMusicas(data);
    } catch {
      // erro silencioso
    } finally {
      setCarregandoMusicas(false);
    }
  }

  async function carregarEventos() {
    setCarregandoEventos(true);
    try {
      const data = await api<Event[]>("/events");
      setEventos(data);
    } catch {
      // erro silencioso
    } finally {
      setCarregandoEventos(false);
    }
  }

  async function carregarSetlist(eventId: number) {
    setCarregandoSetlist(true);
    try {
      const data = await api<SetlistItem[]>(`/events/${eventId}/setlist`);
      setSetlistItens(data);
    } catch {
      setSetlistItens([]);
    } finally {
      setCarregandoSetlist(false);
    }
  }

  async function adicionarMusica() {
    if (!novaMusica.title.trim()) return;
    setAdicionandoMusica(true);
    try {
      await api("/songs", {
        method: "POST",
        body: {
          title: novaMusica.title.trim(),
          artist: novaMusica.artist.trim() || undefined,
          originalKey: novaMusica.originalKey.trim() || undefined,
          bpm: novaMusica.bpm ? Number(novaMusica.bpm) : undefined,
        },
      });
      await carregarMusicas();
      setNovaMusica({ title: "", artist: "", originalKey: "", bpm: "" });
      setShowAddModal(false);
    } catch {
      // erro silencioso
    } finally {
      setAdicionandoMusica(false);
    }
  }

  async function salvarSetlist() {
    if (!setlistAberta || musicasSelecionadas.length === 0) return;
    setSalvandoSetlist(true);
    try {
      for (const songId of musicasSelecionadas) {
        await api(`/events/${setlistAberta}/setlist`, {
          method: "POST",
          body: { songId },
        });
      }
      await carregarSetlist(setlistAberta);
      setMusicasSelecionadas([]);
    } catch {
      // erro silencioso
    } finally {
      setSalvandoSetlist(false);
    }
  }

  const musicasFiltradas = musicas.filter(
    (m) =>
      m.title.toLowerCase().includes(buscaMusica.toLowerCase()) ||
      m.artist.toLowerCase().includes(buscaMusica.toLowerCase())
  );

  const toggleMusica = (id: number) => {
    setMusicasSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const eventosComSetlist = eventos.filter((e) => {
    if (setlistAberta === null) return true;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Ministério de Louvor
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            {musicas.length} músicas no repertório · {eventos.length} eventos
          </p>
        </div>
        <button
          onClick={() => setAba("novo")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: "#7c3aed" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nova Setlist
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#e5e0f8] rounded-xl p-1 w-fit">
        {(["setlists", "repertorio", "novo"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === a ? "text-white" : "text-[#7c6ea8] hover:bg-gray-50"}`}
            style={aba === a ? { backgroundColor: "#7c3aed" } : {}}
          >
            {a === "setlists" ? "Setlists" : a === "repertorio" ? "Repertório" : "Nova Setlist"}
          </button>
        ))}
      </div>

      {/* Setlists */}
      {aba === "setlists" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Event list */}
          <div className="space-y-3">
            {carregandoEventos ? (
              <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8 text-center">
                <p className="text-sm text-[#7c6ea8]">Carregando eventos...</p>
              </div>
            ) : eventos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8 text-center">
                <p className="text-sm text-[#7c6ea8]">Nenhum evento encontrado</p>
              </div>
            ) : (
              eventos.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSetlistAberta(e.id)}
                  className={`w-full text-left bg-white rounded-2xl border p-4 hover:shadow-md transition-all ${setlistAberta === e.id ? "border-[#a78bfa] shadow-md" : "border-[#e5e0f8] hover:border-[#c4b5fd]"}`}
                >
                  <p className="font-semibold text-[#1e1b4b] text-sm">{e.title}</p>
                  <p className="text-xs text-[#7c6ea8] mt-0.5">
                    {new Date(e.date).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                  </p>
                </button>
              ))
            )}
          </div>

          {/* Setlist detail */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
            {setlistAberta !== null ? (() => {
              const ev = eventos.find((e) => e.id === setlistAberta);
              return (
                <>
                  <div className="px-6 py-4 border-b border-[#f0eefe]" style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)" }}>
                    <h2 className="font-bold text-[#1e1b4b]">{ev?.title || "Evento"}</h2>
                    <p className="text-sm text-[#7c6ea8]">
                      {ev && new Date(ev.date).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  {carregandoSetlist ? (
                    <div className="flex items-center justify-center h-48">
                      <p className="text-sm text-[#7c6ea8]">Carregando setlist...</p>
                    </div>
                  ) : setlistItens.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-[#7c6ea8]">
                      <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <p className="text-sm">Nenhuma música nesta setlist</p>
                      <p className="text-xs mt-1">Adicione músicas na aba "Nova Setlist"</p>
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-[#f0eefe]">
                        {setlistItens.map((item, i) => {
                          const tom = item.songKey || item.song.originalKey;
                          const tomColor = tomColors[tom] || "#7c3aed";
                          return (
                            <div key={item.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[#fafafe] transition-colors group">
                              <span className="text-lg font-bold text-[#d4c7f7] w-6 text-center">{item.order || i + 1}</span>
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                style={{ backgroundColor: tomColor }}
                              >
                                {tom}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-[#1e1b4b] text-sm">{item.song.title}</p>
                                <p className="text-xs text-[#7c6ea8]">{item.song.artist} · {item.song.bpm ? `${item.song.bpm} BPM` : ""}</p>
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {item.song.youtubeUrl && (
                                  <a href={item.song.youtubeUrl} target="_blank" rel="noreferrer"
                                    className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center"
                                    title="YouTube">
                                    <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
                                    </svg>
                                  </a>
                                )}
                                {item.song.spotifyUrl && (
                                  <a href={item.song.spotifyUrl} target="_blank" rel="noreferrer"
                                    className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center"
                                    title="Spotify">
                                    <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                    </svg>
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="px-6 py-4 border-t border-[#f0eefe] flex items-center justify-between">
                        <p className="text-xs text-[#7c6ea8]">Duração estimada: ~{setlistItens.length * 4} min</p>
                        <button disabled className="text-xs px-3 py-1.5 rounded-lg text-[#7c6ea8] bg-gray-100 font-medium cursor-not-allowed">
                          Em breve
                        </button>
                      </div>
                    </>
                  )}
                </>
              );
            })() : (
              <div className="flex flex-col items-center justify-center h-48 text-[#7c6ea8]">
                <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
                <p className="text-sm">Selecione um evento</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Repertório */}
      {aba === "repertorio" && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7c6ea8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={buscaMusica}
              onChange={(e) => setBuscaMusica(e.target.value)}
              placeholder="Buscar música..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl bg-white text-[#1e1b4b] placeholder:text-[#7c6ea8] focus:outline-none focus:border-[#a78bfa]"
            />
          </div>

          {carregandoMusicas ? (
            <div className="bg-white rounded-2xl border border-[#e5e0f8] p-8 text-center">
              <p className="text-sm text-[#7c6ea8]">Carregando repertório...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {musicasFiltradas.map((m) => {
                const tomColor = tomColors[m.originalKey] || "#7c3aed";
                return (
                  <div key={m.id} className="bg-white rounded-2xl border border-[#e5e0f8] p-5 hover:shadow-md hover:border-[#c4b5fd] transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: tomColor }}
                      >
                        {m.originalKey}
                      </div>
                      <div className="flex gap-2">
                        {m.youtubeUrl && (
                          <a href={m.youtubeUrl} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
                            </svg>
                          </a>
                        )}
                        {m.spotifyUrl && (
                          <a href={m.spotifyUrl} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                    <h3 className="font-semibold text-[#1e1b4b]">{m.title}</h3>
                    <p className="text-sm text-[#7c6ea8]">{m.artist}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: tomColor + "15", color: tomColor }}>
                        Tom {m.originalKey}
                      </span>
                      {m.bpm && <span className="text-xs text-[#7c6ea8]">{m.bpm} BPM</span>}
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-white rounded-2xl border-2 border-dashed border-[#c4b5fd] p-5 flex flex-col items-center justify-center gap-2 text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors min-h-[150px]"
              >
                <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-medium">Adicionar Música</span>
              </button>
            </div>
          )}

          {showAddModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
                <h3 className="font-semibold text-[#1e1b4b]">Nova Música</h3>
                <input
                  value={novaMusica.title}
                  onChange={(e) => setNovaMusica({ ...novaMusica, title: e.target.value })}
                  placeholder="Título *"
                  className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#a78bfa]"
                />
                <input
                  value={novaMusica.artist}
                  onChange={(e) => setNovaMusica({ ...novaMusica, artist: e.target.value })}
                  placeholder="Artista"
                  className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#a78bfa]"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={novaMusica.originalKey}
                    onChange={(e) => setNovaMusica({ ...novaMusica, originalKey: e.target.value })}
                    placeholder="Tom (ex: A, G, C)"
                    className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#a78bfa]"
                  />
                  <input
                    value={novaMusica.bpm}
                    onChange={(e) => setNovaMusica({ ...novaMusica, bpm: e.target.value })}
                    placeholder="BPM"
                    type="number"
                    className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#a78bfa]"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm font-medium text-[#7c6ea8] hover:text-[#1e1b4b] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={adicionarMusica}
                    disabled={!novaMusica.title.trim() || adicionandoMusica}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: "#7c3aed" }}
                  >
                    {adicionandoMusica ? "Salvando..." : "Adicionar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nova Setlist */}
      {aba === "novo" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-4">
            <h2 className="font-semibold text-[#1e1b4b]">Criar Nova Setlist</h2>
            <div>
              <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Evento</label>
              <select
                value={setlistAberta || ""}
                onChange={(e) => setSetlistAberta(Number(e.target.value))}
                className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa]"
              >
                <option value="">Selecione um evento</option>
                {eventos.map((e) => (
                  <option key={e.id} value={e.id}>{e.title} — {new Date(e.date).toLocaleDateString("pt-BR")}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-2">
                Músicas Selecionadas ({musicasSelecionadas.length})
              </label>
              {musicasSelecionadas.length === 0 ? (
                <p className="text-sm text-[#7c6ea8]">Selecione músicas ao lado →</p>
              ) : (
                <div className="space-y-2">
                  {musicasSelecionadas.map((id, i) => {
                    const m = musicas.find((x) => x.id === id);
                    if (!m) return null;
                    return (
                      <div key={id} className="flex items-center gap-3 bg-[#f5f3ff] rounded-xl px-3 py-2">
                        <span className="text-xs font-bold text-[#7c3aed]">{i + 1}</span>
                        <span className="text-sm font-medium text-[#1e1b4b] flex-1">{m.title}</span>
                        <button onClick={() => toggleMusica(id)} className="text-[#7c6ea8] hover:text-red-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={salvarSetlist}
              disabled={!setlistAberta || musicasSelecionadas.length === 0 || salvandoSetlist}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#7c3aed" }}
            >
              {salvandoSetlist ? "Salvando..." : "Salvar Setlist"}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0eefe]">
              <h2 className="font-semibold text-[#1e1b4b]">Repertório</h2>
              <p className="text-xs text-[#7c6ea8]">Clique para adicionar à setlist</p>
            </div>
            <div className="divide-y divide-[#f0eefe] max-h-96 overflow-y-auto">
              {carregandoMusicas ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-[#7c6ea8]">Carregando...</p>
                </div>
              ) : musicas.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-[#7c6ea8]">Nenhuma música disponível</p>
                </div>
              ) : (
                musicas.map((m) => {
                  const selecionada = musicasSelecionadas.includes(m.id);
                  const tomColor = tomColors[m.originalKey] || "#7c3aed";
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMusica(m.id)}
                      className={`w-full flex items-center gap-4 px-6 py-3.5 text-left transition-colors ${selecionada ? "bg-[#f5f3ff]" : "hover:bg-gray-50"}`}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: selecionada ? "#7c3aed" : tomColor }}
                      >
                        {selecionada ? "✓" : m.originalKey}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#1e1b4b]">{m.title}</p>
                        <p className="text-xs text-[#7c6ea8]">{m.artist} {m.bpm ? `· ${m.bpm} BPM` : ""}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
