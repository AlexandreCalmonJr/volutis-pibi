import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth, useToasts } from "../store";
import { Button, Card, PageHeader } from "../components/ui";
import { ChordViewer } from "../components/ChordViewer";

export interface Song {
  id: string; title: string; artist: string | null; originalKey: string | null;
  bpm: number | null; structure: string | null; youtubeUrl: string | null;
  spotifyUrl: string | null; cifraClubUrl: string | null;
  lyrics: string | null; chords: string | null;
}

export default function Repertoire() {
  const user = useAuth((s) => s.user);
  const push = useToasts((s) => s.push);
  const isLeader = user?.role === "ADMIN" || user?.role === "MINISTRY_LEADER";

  const [songs, setSongs] = useState<Song[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Song | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", artist: "", originalKey: "", bpm: "", structure: "", youtubeUrl: "", cifraClubUrl: "", chords: "" });

  const load = (query = "") =>
    api<Song[]>(`/songs${query ? `?q=${encodeURIComponent(query)}` : ""}`).then(setSongs).catch(() => {});

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  async function createSong() {
    try {
      const body: any = { title: form.title };
      if (form.artist) body.artist = form.artist;
      if (form.originalKey) body.originalKey = form.originalKey;
      if (form.bpm) body.bpm = Number(form.bpm);
      if (form.structure) body.structure = form.structure;
      if (form.youtubeUrl) body.youtubeUrl = form.youtubeUrl;
      if (form.cifraClubUrl) body.cifraClubUrl = form.cifraClubUrl;
      if (form.chords) body.chords = form.chords;
      const song = await api<Song>("/songs", { method: "POST", body });
      push({ title: "Música adicionada 🎵", kind: "ok" });
      setCreating(false);
      setForm({ title: "", artist: "", originalKey: "", bpm: "", structure: "", youtubeUrl: "", cifraClubUrl: "", chords: "" });
      load();
      setSelected(song);
    } catch (e: any) { push({ title: e.message, kind: "warn" }); }
  }

  const input = "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent";

  if (selected) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-6 pb-safe">
        <button onClick={() => setSelected(null)} className="mb-3 text-sm text-accent-soft">← Repertório</button>
        <PageHeader title={selected.title} subtitle={selected.artist ?? undefined} />
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {selected.originalKey && <span className="rounded-full bg-surface-2 px-3 py-1">Tom: <b className="text-accent-soft">{selected.originalKey}</b></span>}
          {selected.bpm && <span className="rounded-full bg-surface-2 px-3 py-1">{selected.bpm} BPM</span>}
        </div>
        {selected.structure && (
          <Card className="mb-4"><p className="text-xs text-muted">Estrutura</p><p className="mt-1 text-sm font-medium">{selected.structure}</p></Card>
        )}
        {(selected.chords || selected.lyrics) ? (
          <ChordViewer chords={selected.chords} lyrics={selected.lyrics} originalKey={selected.originalKey} />
        ) : (
          <Card><p className="text-sm text-muted">Sem cifra/letra cadastrada.</p></Card>
        )}
        <div className="mt-4 flex gap-2">
          {selected.youtubeUrl && (
            <a href={selected.youtubeUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-danger/15 px-4 py-2.5 text-sm font-medium text-danger">▶ YouTube</a>
          )}
          {selected.cifraClubUrl && (
            <a href={selected.cifraClubUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-warn/15 px-4 py-2.5 text-sm font-medium text-warn">🎸 Cifra Club</a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-safe">
      <PageHeader title="Estante Musical" subtitle={`${songs.length} música(s) no repertório`} />
      <div className="mb-4 flex gap-2">
        <input placeholder="Buscar por título ou artista..." value={q} onChange={(e) => setQ(e.target.value)} className={input} />
        {isLeader && <Button onClick={() => setCreating((v) => !v)}>{creating ? "×" : "+"}</Button>}
      </div>

      {creating && (
        <Card className="mb-4 space-y-2">
          <p className="text-sm font-semibold">Nova música</p>
          <input placeholder="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} />
          <input placeholder="Artista" value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} className={input} />
          <div className="flex gap-2">
            <input placeholder="Tom (ex: G)" value={form.originalKey} onChange={(e) => setForm({ ...form, originalKey: e.target.value })} className={input} />
            <input placeholder="BPM" type="number" value={form.bpm} onChange={(e) => setForm({ ...form, bpm: e.target.value })} className={input} />
          </div>
          <input placeholder="Estrutura (Intro - V1 - C ...)" value={form.structure} onChange={(e) => setForm({ ...form, structure: e.target.value })} className={input} />
          <input placeholder="Link YouTube" value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} className={input} />
          <input placeholder="Link Cifra Club" value={form.cifraClubUrl} onChange={(e) => setForm({ ...form, cifraClubUrl: e.target.value })} className={input} />
          <textarea
            placeholder={"Cifra — use colchetes: [G]Grande é o Se[D]nhor"}
            value={form.chords} onChange={(e) => setForm({ ...form, chords: e.target.value })}
            rows={5} className={`${input} font-mono`}
          />
          <Button className="w-full" disabled={!form.title} onClick={createSong}>Salvar música</Button>
        </Card>
      )}

      <div className="space-y-2">
        {songs.map((s) => (
          <Card key={s.id} className="cursor-pointer active:bg-surface-2">
            <div onClick={() => setSelected(s)} className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{s.title}</p>
                <p className="text-xs text-muted">{s.artist ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {s.originalKey && <span className="rounded-lg bg-accent/15 px-2 py-1 font-bold text-accent-soft">{s.originalKey}</span>}
                {s.bpm && <span className="text-muted">{s.bpm} bpm</span>}
              </div>
            </div>
          </Card>
        ))}
        {songs.length === 0 && <Card><p className="text-sm text-muted">Nenhuma música {q ? "encontrada" : "cadastrada ainda"}.</p></Card>}
      </div>
    </div>
  );
}
