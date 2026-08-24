import { useMemo, useState } from "react";
import { shiftKey, transposeText } from "../lib/transpose";
import { Button } from "./ui";

/**
 * Visualizador de cifra com transposição.
 * Renderiza acordes [X] destacados acima do texto corrido.
 */
export function ChordViewer({
  chords, lyrics, originalKey, initialOffset = 0,
}: {
  chords?: string | null; lyrics?: string | null;
  originalKey?: string | null; initialOffset?: number;
}) {
  const [offset, setOffset] = useState(initialOffset);
  const source = chords || lyrics || "";
  const hasChords = /\[[^\]]+\]/.test(source);

  const rendered = useMemo(() => transposeText(source, offset), [source, offset]);

  return (
    <div>
      {hasChords && (
        <div className="mb-3 flex items-center gap-3">
          <Button variant="ghost" onClick={() => setOffset((o) => o - 1)}>♭ −1</Button>
          <div className="min-w-16 text-center">
            <p className="font-display text-lg font-bold text-accent-soft">{shiftKey(originalKey, offset)}</p>
            <p className="text-[10px] text-muted">{offset === 0 ? "tom original" : `${offset > 0 ? "+" : ""}${offset} st`}</p>
          </div>
          <Button variant="ghost" onClick={() => setOffset((o) => o + 1)}>♯ +1</Button>
          {offset !== 0 && (
            <button onClick={() => setOffset(0)} className="text-xs text-muted underline">resetar</button>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl bg-surface-2 p-4 font-mono text-sm leading-7">
        {rendered.split("\n").map((line, i) => (
          <p key={i} className="whitespace-pre">
            {line.split(/(\[[^\]]+\])/g).map((part, j) =>
              part.startsWith("[") ? (
                <b key={j} className="mx-0.5 rounded bg-accent/20 px-1 text-accent-soft">
                  {part.slice(1, -1)}
                </b>
              ) : (
                <span key={j}>{part}</span>
              )
            )}
          </p>
        ))}
      </div>
    </div>
  );
}
