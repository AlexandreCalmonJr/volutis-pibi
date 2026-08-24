/**
 * Transposição de cifras.
 * Formato suportado: colchetes inline — ex: "[G]Grande é o Se[D]nhor"
 * Acordes com sufixo (m7, sus4, add9...) e baixo invertido (D/F#) são preservados.
 */
const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#",
};

function noteIndex(note: string): number {
  const normalized = FLAT_TO_SHARP[note] ?? note;
  return SHARPS.indexOf(normalized);
}

export function transposeNote(note: string, semitones: number): string {
  const idx = noteIndex(note);
  if (idx < 0) return note;
  return SHARPS[(idx + semitones + 120) % 12];
}

const CHORD_RE = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/;

export function transposeChord(chord: string, semitones: number): string {
  const m = chord.match(CHORD_RE);
  if (!m) return chord;
  const [, root, suffix, bass] = m;
  return (
    transposeNote(root, semitones) +
    (suffix ?? "") +
    (bass ? "/" + transposeNote(bass, semitones) : "")
  );
}

/** Transpõe todos os acordes [X] de um texto de cifra */
export function transposeText(text: string, semitones: number): string {
  return text.replace(/\[([^\]]+)\]/g, (_, c) => `[${transposeChord(c, semitones)}]`);
}

/** Tom resultante a partir do original + deslocamento */
export function shiftKey(key: string | null | undefined, semitones: number): string {
  if (!key) return "?";
  const m = key.match(/^([A-G](?:#|b)?)(m?)$/);
  if (!m) return key;
  return transposeNote(m[1], semitones) + (m[2] ?? "");
}

/** Diferença em semitons entre dois tons (p/ abrir já no tom do culto) */
export function semitonesBetween(from?: string | null, to?: string | null): number {
  if (!from || !to) return 0;
  const a = noteIndex(from.replace(/m$/, ""));
  const b = noteIndex(to.replace(/m$/, ""));
  if (a < 0 || b < 0) return 0;
  return (b - a + 12) % 12;
}
