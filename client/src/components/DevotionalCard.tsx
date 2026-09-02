import { useState, useEffect } from "react";
import { api } from "../api";

interface Devotional {
  id: string;
  reference: string;
  verse: string;
  title: string;
  reflection: string;
  theme: string;
  author: string;
  date: string;
}

export function DevotionalCard() {
  const [devotional, setDevotional] = useState<Devotional | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    api<Devotional>("/devotional/daily")
      .then(setDevotional)
      .catch(() => {
        // Fallback in case of network issue
        setDevotional({
          id: "default",
          reference: "Colossenses 3:23",
          verse: "Tudo o que fizerem, façam de todo o coração, como para o Senhor, e não para os homens.",
          title: "Servindo de Todo o Coração",
          reflection: "Cada ensaio, escala e culto é uma oportunidade de glorificar a Deus com seus dons e talentos.",
          theme: "Propósito",
          author: "Volutis PIBI",
          date: new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }),
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleShare = () => {
    if (!devotional) return;
    const text = `📖 *Devocional Diário — ${devotional.reference}*\n\n"${devotional.verse}"\n\n💡 _${devotional.reflection}_\n\n— Compartilhado via Volutis PIBI`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 animate-pulse space-y-3">
        <div className="h-4 w-32 bg-[var(--color-border)] rounded-full" />
        <div className="h-6 w-3/4 bg-[var(--color-border)] rounded-lg" />
        <div className="h-4 w-full bg-[var(--color-border)] rounded-lg" />
      </div>
    );
  }

  if (!devotional) return null;

  return (
    <div className="rounded-3xl border border-violet-200/70 dark:border-violet-900/60 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-indigo-500/10 p-5 sm:p-6 shadow-sm space-y-3.5 backdrop-blur-sm relative overflow-hidden">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-violet-600 text-white text-[11px] font-bold uppercase tracking-wider shadow-sm">
            Versículo do Dia
          </span>
        </div>

        <button
          onClick={handleShare}
          className="px-3.5 py-1.5 rounded-xl border border-violet-300 dark:border-violet-800 bg-white/80 dark:bg-slate-900/80 text-violet-700 dark:text-violet-300 text-xs font-semibold hover:bg-violet-50 transition-all shadow-sm active:scale-95 cursor-pointer"
          title="Copiar versículo formatado para o WhatsApp"
        >
          {copied ? "Copiado!" : "Compartilhar"}
        </button>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm font-bold text-violet-700 dark:text-violet-300">
          {devotional.title}
        </h3>
        <p className="text-base sm:text-lg italic font-medium text-[var(--color-ink)] leading-relaxed" style={{ fontFamily: "'Fraunces', serif" }}>
          "{devotional.verse}"
        </p>
        <p className="text-xs font-bold text-violet-600 dark:text-violet-400">
          — {devotional.reference}
        </p>
      </div>

      {/* Reflection */}
      <div className="pt-2 border-t border-violet-200/50 dark:border-violet-900/40">
        <p className={`text-xs text-[var(--color-text-secondary)] leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>
          <span className="font-semibold text-[var(--color-ink)]">Reflexão:</span> {devotional.reflection}
        </p>
        {devotional.reflection.length > 100 && (
          <button
            onClick={() => setIsExpanded((e) => !e)}
            className="text-[11px] font-bold text-violet-600 dark:text-violet-400 mt-1 hover:underline cursor-pointer"
          >
            {isExpanded ? "Ver menos" : "Ler reflexão completa"}
          </button>
        )}
      </div>
    </div>
  );
}
