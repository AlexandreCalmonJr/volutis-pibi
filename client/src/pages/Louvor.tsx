import { useState } from "react";
import { musicas, setlists } from "../data/mockData";

const tomColors: Record<string, string> = {
  "A": "#7c3aed", "B♭": "#2563eb", "B": "#db2777", "C": "#d97706",
  "D": "#059669", "E": "#4338ca", "F": "#dc2626", "F#": "#0891b2",
  "G": "#65a30d", "A♭": "#9333ea",
};

export default function Louvor() {
  const [aba, setAba] = useState<"setlists" | "repertorio" | "novo">("setlists");
  const [buscaMusica, setBuscaMusica] = useState("");
  const [setlistAberta, setSetlistAberta] = useState<number | null>(1);
  const [novoSetlist, setNovoSetlist] = useState({ evento: "", data: "" });
  const [musicasSelecionadas, setMusicasSelecionadas] = useState<number[]>([]);

  const musicasFiltradas = musicas.filter(
    (m) =>
      m.titulo.toLowerCase().includes(buscaMusica.toLowerCase()) ||
      m.artista.toLowerCase().includes(buscaMusica.toLowerCase())
  );

  const toggleMusica = (id: number) => {
    setMusicasSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]" style={{ fontFamily: "'Fraunces', serif" }}>
            Ministério de Louvor
          </h1>
          <p className="text-[#5b5077] text-sm mt-1">
            {musicas.length} músicas no repertório · {setlists.length} setlists criadas
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
          {/* List */}
          <div className="space-y-3">
            {setlists.map((s) => (
              <button
                key={s.id}
                onClick={() => setSetlistAberta(s.id)}
                className={`w-full text-left bg-white rounded-2xl border p-4 hover:shadow-md transition-all ${setlistAberta === s.id ? "border-[#a78bfa] shadow-md" : "border-[#e5e0f8] hover:border-[#c4b5fd]"}`}
              >
                <p className="font-semibold text-[#1e1b4b] text-sm">{s.eventoTitulo}</p>
                <p className="text-xs text-[#7c6ea8] mt-0.5">
                  {new Date(s.data).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                </p>
                <p className="text-xs text-[#7c3aed] font-medium mt-2">
                  {s.musicas.length} músicas · {s.ministerioLider}
                </p>
              </button>
            ))}
          </div>

          {/* Setlist detail */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
            {setlistAberta ? (() => {
              const sl = setlists.find((s) => s.id === setlistAberta)!;
              return (
                <>
                  <div className="px-6 py-4 border-b border-[#f0eefe]" style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)" }}>
                    <h2 className="font-bold text-[#1e1b4b]">{sl.eventoTitulo}</h2>
                    <p className="text-sm text-[#7c6ea8]">
                      {new Date(sl.data).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                    <p className="text-xs text-[#7c3aed] mt-1">Liderado por: {sl.ministerioLider}</p>
                  </div>
                  <div className="divide-y divide-[#f0eefe]">
                    {sl.musicas.map((mid, i) => {
                      const m = musicas.find((x) => x.id === mid)!;
                      if (!m) return null;
                      const tomColor = tomColors[m.tom] || "#7c3aed";
                      return (
                        <div key={mid} className="px-6 py-4 flex items-center gap-4 hover:bg-[#fafafe] transition-colors group">
                          <span className="text-lg font-bold text-[#d4c7f7] w-6 text-center">{i + 1}</span>
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: tomColor }}
                          >
                            {m.tom}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#1e1b4b] text-sm">{m.titulo}</p>
                            <p className="text-xs text-[#7c6ea8]">{m.artista} · {m.tempo}</p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {m.links.youtube && (
                              <a href={m.links.youtube} target="_blank" rel="noreferrer"
                                className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center"
                                title="YouTube">
                                <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
                                </svg>
                              </a>
                            )}
                            {m.links.spotify && (
                              <a href={m.links.spotify} target="_blank" rel="noreferrer"
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
                    <p className="text-xs text-[#7c6ea8]">Duração estimada: ~{sl.musicas.length * 4} min</p>
                    <button className="text-xs px-3 py-1.5 rounded-lg text-white font-medium hover:opacity-90" style={{ backgroundColor: "#7c3aed" }}>
                      Exportar para Holyx
                    </button>
                  </div>
                </>
              );
            })() : (
              <div className="flex items-center justify-center h-48 text-[#7c6ea8]">
                <p className="text-sm">Selecione uma setlist</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {musicasFiltradas.map((m) => {
              const tomColor = tomColors[m.tom] || "#7c3aed";
              return (
                <div key={m.id} className="bg-white rounded-2xl border border-[#e5e0f8] p-5 hover:shadow-md hover:border-[#c4b5fd] transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: tomColor }}
                    >
                      {m.tom}
                    </div>
                    <div className="flex gap-2">
                      {m.links.youtube && (
                        <a href={m.links.youtube} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
                          </svg>
                        </a>
                      )}
                      {m.links.spotify && (
                        <a href={m.links.spotify} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                  <h3 className="font-semibold text-[#1e1b4b]">{m.titulo}</h3>
                  <p className="text-sm text-[#7c6ea8]">{m.artista}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: tomColor + "15", color: tomColor }}>
                      Tom {m.tom}
                    </span>
                    <span className="text-xs text-[#7c6ea8]">{m.tempo}</span>
                  </div>
                  <p className="text-xs text-[#7c6ea8] mt-2">
                    Última vez: {new Date(m.ultimaVez).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </p>
                </div>
              );
            })}
            <button className="bg-white rounded-2xl border-2 border-dashed border-[#c4b5fd] p-5 flex flex-col items-center justify-center gap-2 text-[#7c3aed] hover:bg-[#f5f3ff] transition-colors min-h-[150px]">
              <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium">Adicionar Música</span>
            </button>
          </div>
        </div>
      )}

      {/* Nova Setlist */}
      {aba === "novo" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-[#e5e0f8] p-6 space-y-4">
            <h2 className="font-semibold text-[#1e1b4b]">Criar Nova Setlist</h2>
            <div>
              <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Evento</label>
              <input
                value={novoSetlist.evento}
                onChange={(e) => setNovoSetlist({ ...novoSetlist, evento: e.target.value })}
                placeholder="Nome do culto/evento"
                className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] placeholder:text-[#c4b5fd] focus:outline-none focus:border-[#a78bfa]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7c6ea8] uppercase tracking-wider mb-1.5">Data</label>
              <input
                type="date"
                value={novoSetlist.data}
                onChange={(e) => setNovoSetlist({ ...novoSetlist, data: e.target.value })}
                className="w-full px-4 py-2.5 text-sm border border-[#e5e0f8] rounded-xl text-[#1e1b4b] focus:outline-none focus:border-[#a78bfa]"
              />
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
                    const m = musicas.find((x) => x.id === id)!;
                    return (
                      <div key={id} className="flex items-center gap-3 bg-[#f5f3ff] rounded-xl px-3 py-2">
                        <span className="text-xs font-bold text-[#7c3aed]">{i + 1}</span>
                        <span className="text-sm font-medium text-[#1e1b4b] flex-1">{m.titulo}</span>
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

            <button className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90" style={{ backgroundColor: "#7c3aed" }}>
              Salvar Setlist
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#e5e0f8] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0eefe]">
              <h2 className="font-semibold text-[#1e1b4b]">Repertório</h2>
              <p className="text-xs text-[#7c6ea8]">Clique para adicionar à setlist</p>
            </div>
            <div className="divide-y divide-[#f0eefe] max-h-96 overflow-y-auto">
              {musicas.map((m) => {
                const selecionada = musicasSelecionadas.includes(m.id);
                const tomColor = tomColors[m.tom] || "#7c3aed";
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
                      {selecionada ? "✓" : m.tom}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1e1b4b]">{m.titulo}</p>
                      <p className="text-xs text-[#7c6ea8]">{m.artista} · {m.tempo}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
