import { useState, useEffect, useRef, useCallback } from "react";

interface MetronomeProps {
  initialBpm?: number;
  onClose?: () => void;
  isOpen?: boolean;
}

export function Metronome({ initialBpm = 120, onClose, isOpen = true }: MetronomeProps) {
  const [bpm, setBpm] = useState(initialBpm);
  const [isPlaying, setIsPlaying] = useState(false);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const currentBeatRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const bpmRef = useRef<number>(bpm);
  const beatsPerBarRef = useRef<number>(beatsPerBar);
  const volumeRef = useRef<number>(volume);
  const isMutedRef = useRef<boolean>(isMuted);

  // Sync refs with state
  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    beatsPerBarRef.current = beatsPerBar;
  }, [beatsPerBar]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (initialBpm && initialBpm >= 40 && initialBpm <= 240) {
      setBpm(initialBpm);
    }
  }, [initialBpm]);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  };

  const playClick = useCallback((time: number, isAccent: boolean) => {
    if (!audioCtxRef.current || isMutedRef.current) return;
    try {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();

      osc.type = "sine";
      // Accent beat (1st beat) has higher pitch
      osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);

      gain.gain.setValueAtTime(volumeRef.current, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);

      osc.start(time);
      osc.stop(time + 0.05);
    } catch {
      // Audio context error fallback
    }
  }, []);

  const scheduler = useCallback(() => {
    if (!isPlayingRef.current || !audioCtxRef.current) return;

    // Schedule 100ms in advance
    while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + 0.1) {
      const isAccent = currentBeatRef.current === 0;
      playClick(nextNoteTimeRef.current, isAccent);

      const beatToSet = currentBeatRef.current;
      setTimeout(() => {
        if (isPlayingRef.current) {
          setCurrentBeat(beatToSet);
        }
      }, Math.max(0, (nextNoteTimeRef.current - audioCtxRef.current.currentTime) * 1000));

      const secondsPerBeat = 60.0 / bpmRef.current;
      nextNoteTimeRef.current += secondsPerBeat;
      currentBeatRef.current = (currentBeatRef.current + 1) % beatsPerBarRef.current;
    }

    timerRef.current = window.setTimeout(scheduler, 25);
  }, [playClick]);

  const startMetronome = () => {
    initAudio();
    if (!audioCtxRef.current) return;

    isPlayingRef.current = true;
    currentBeatRef.current = 0;
    setCurrentBeat(0);
    nextNoteTimeRef.current = audioCtxRef.current.currentTime + 0.05;
    setIsPlaying(true);
    scheduler();
  };

  const stopMetronome = () => {
    isPlayingRef.current = false;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(0);
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopMetronome();
    } else {
      startMetronome();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMetronome();
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Tap tempo handler
  const handleTap = () => {
    const now = performance.now();
    const newTapTimes = [...tapTimes, now].filter((t) => now - t < 3000); // Only keep taps within 3 seconds

    if (newTapTimes.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < newTapTimes.length; i++) {
        intervals.push(newTapTimes[i] - newTapTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 40 && calculatedBpm <= 240) {
        setBpm(calculatedBpm);
      }
    }
    setTapTimes(newTapTimes);
  };

  if (!isOpen) return null;

  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl space-y-5 select-none w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-violet-500/20">
            ⏱️
          </div>
          <div>
            <h3 className="font-bold text-sm text-[var(--color-ink)]">Metrônomo</h3>
            <p className="text-[11px] text-[var(--color-muted)]">Afinação e ritmo de ensaio</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={() => {
              stopMetronome();
              onClose();
            }}
            className="w-7 h-7 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-muted)] flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Visual Beats Indicator */}
      <div className="flex items-center justify-center gap-2.5 py-2">
        {Array.from({ length: beatsPerBar }).map((_, idx) => {
          const isActive = isPlaying && currentBeat === idx;
          const isAccent = idx === 0;
          return (
            <div
              key={idx}
              className={`h-4 rounded-full transition-all duration-75 ${
                isActive
                  ? isAccent
                    ? "w-10 bg-amber-500 scale-110 shadow-lg shadow-amber-500/50"
                    : "w-8 bg-violet-600 scale-105 shadow-md shadow-violet-500/40"
                  : "w-6 bg-[var(--color-border)] opacity-60"
              }`}
            />
          );
        })}
      </div>

      {/* BPM Big Display & Controls */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setBpm((b) => Math.max(40, b - 5))}
            className="w-8 h-8 rounded-lg border border-[var(--color-border)] text-xs font-bold text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] active:scale-95"
          >
            -5
          </button>
          <button
            onClick={() => setBpm((b) => Math.max(40, b - 1))}
            className="w-8 h-8 rounded-lg border border-[var(--color-border)] text-xs font-bold text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] active:scale-95"
          >
            -1
          </button>

          <div className="min-w-[100px]">
            <span className="text-4xl font-extrabold text-[var(--color-ink)] tracking-tight">{bpm}</span>
            <span className="block text-[11px] font-semibold text-[var(--color-muted)] uppercase tracking-wider">BPM</span>
          </div>

          <button
            onClick={() => setBpm((b) => Math.min(240, b + 1))}
            className="w-8 h-8 rounded-lg border border-[var(--color-border)] text-xs font-bold text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] active:scale-95"
          >
            +1
          </button>
          <button
            onClick={() => setBpm((b) => Math.min(240, b + 5))}
            className="w-8 h-8 rounded-lg border border-[var(--color-border)] text-xs font-bold text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] active:scale-95"
          >
            +5
          </button>
        </div>

        {/* BPM Slider */}
        <input
          type="range"
          min="40"
          max="240"
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-full accent-violet-600 cursor-pointer"
        />
      </div>

      {/* Time Signature and Tap Tempo */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <div className="flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
          {[2, 3, 4, 6].map((ts) => (
            <button
              key={ts}
              onClick={() => {
                setBeatsPerBar(ts);
                currentBeatRef.current = 0;
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                beatsPerBar === ts
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {ts}/4
            </button>
          ))}
        </div>

        <button
          onClick={handleTap}
          className="py-1.5 px-3 rounded-xl border border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-xs font-bold hover:bg-violet-100 transition-all active:scale-95"
        >
          👆 Tap Tempo
        </button>
      </div>

      {/* Main Play / Stop Button */}
      <div className="pt-2 flex items-center gap-3">
        <button
          onClick={togglePlay}
          className={`flex-1 py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ${
            isPlaying
              ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/30"
              : "bg-violet-600 hover:bg-violet-700 shadow-violet-500/30"
          }`}
        >
          {isPlaying ? (
            <>
              <span className="text-base">⏹️</span> Parar
            </>
          ) : (
            <>
              <span className="text-base">▶️</span> Iniciar Metrônomo
            </>
          )}
        </button>

        {/* Mute / Volume */}
        <button
          onClick={() => setIsMuted((m) => !m)}
          className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-sm transition-all ${
            isMuted
              ? "border-rose-300 bg-rose-50 dark:bg-rose-950/30 text-rose-600"
              : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-ink)]"
          }`}
          title={isMuted ? "Desmutar som" : "Mutar som"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>
    </div>
  );
}
