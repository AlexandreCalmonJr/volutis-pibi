import { useState } from "react";

export interface RehearsalTrack {
  id: string;
  title: string;
  artist?: string | null;
  originalKey?: string | null;
  bpm?: number | null;
  youtubeUrl?: string | null;
  spotifyUrl?: string | null;
}

interface RehearsalPlayerProps {
  playlist: RehearsalTrack[];
  initialIndex?: number;
  onClose: () => void;
  onSelectTrack?: (track: RehearsalTrack) => void;
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function extractSpotifyEmbed(url: string): string | null {
  if (!url) return null;
  // Transforms https://open.spotify.com/track/XYZ -> https://open.spotify.com/embed/track/XYZ
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("spotify.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const type = parts[0]; // track, album, playlist
        const id = parts[1];
        return `https://open.spotify.com/embed/${type}/${id}`;
      }
    }
  } catch {
    // URL parsing error fallback
  }
  return null;
}

export function RehearsalPlayer({
  playlist,
  initialIndex = 0,
  onClose,
  onSelectTrack,
}: RehearsalPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);

  if (!playlist || playlist.length === 0) return null;

  const currentTrack = playlist[currentIndex] || playlist[0];
  const youtubeId = currentTrack?.youtubeUrl ? extractYouTubeId(currentTrack.youtubeUrl) : null;
  const spotifyEmbedUrl = currentTrack?.spotifyUrl ? extractSpotifyEmbed(currentTrack.spotifyUrl) : null;

  const handleNext = () => {
    if (currentIndex < playlist.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (onSelectTrack) onSelectTrack(playlist[nextIdx]);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      if (onSelectTrack) onSelectTrack(playlist[prevIdx]);
    }
  };

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end max-w-[calc(100vw-2rem)] sm:max-w-md w-full animate-in slide-in-from-bottom-5 duration-200">
      <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl overflow-hidden backdrop-blur-md">
        {/* Header bar */}
        <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 px-4 py-3 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg">🎧</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-200">
                Ensaio Online ({currentIndex + 1}/{playlist.length})
              </p>
              <h4 className="text-sm font-bold truncate max-w-[200px] sm:max-w-[260px]">
                {currentTrack.title}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Toggle playlist */}
            {playlist.length > 1 && (
              <button
                onClick={() => setShowPlaylist((p) => !p)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                  showPlaylist ? "bg-white/30 text-white" : "hover:bg-white/20 text-white/80"
                }`}
                title="Ver lista de músicas"
              >
                📋
              </button>
            )}

            {/* Minimize */}
            <button
              onClick={() => setIsMinimized((m) => !m)}
              className="w-7 h-7 rounded-lg hover:bg-white/20 flex items-center justify-center text-xs transition-colors"
              title={isMinimized ? "Expandir player" : "Minimizar player"}
            >
              {isMinimized ? "🔼" : "🔽"}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-white/20 flex items-center justify-center text-xs transition-colors"
              title="Fechar player"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Minimized bar details */}
        {isMinimized && (
          <div className="p-3 flex items-center justify-between gap-3 text-xs bg-[var(--color-surface)]">
            <div className="flex items-center gap-2 truncate">
              {currentTrack.originalKey && (
                <span className="px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 font-bold text-[10px]">
                  Tom: {currentTrack.originalKey}
                </span>
              )}
              {currentTrack.bpm && (
                <span className="text-[11px] text-[var(--color-muted)] font-medium">
                  {currentTrack.bpm} BPM
                </span>
              )}
              <span className="truncate text-[var(--color-ink)] font-medium">
                {currentTrack.artist || "Primeira Igreja Batista de Itapuã"}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="p-1 rounded-lg hover:bg-[var(--color-surface-2)] disabled:opacity-30 text-[var(--color-ink)]"
              >
                ⏮️
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === playlist.length - 1}
                className="p-1 rounded-lg hover:bg-[var(--color-surface-2)] disabled:opacity-30 text-[var(--color-ink)]"
              >
                ⏭️
              </button>
            </div>
          </div>
        )}

        {/* Maximized Player Content */}
        {!isMinimized && (
          <div className="p-4 space-y-3 bg-[var(--color-surface)]">
            {/* Media Player Frame */}
            {youtubeId ? (
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-inner">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&enablejsapi=1`}
                  title={currentTrack.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : spotifyEmbedUrl ? (
              <div className="w-full rounded-2xl overflow-hidden shadow-inner">
                <iframe
                  src={spotifyEmbedUrl}
                  title={currentTrack.title}
                  className="w-full h-[152px] border-0"
                  allow="encrypted-media"
                />
              </div>
            ) : (
              <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] space-y-1">
                <p className="text-2xl">🎵</p>
                <p className="text-xs font-semibold text-[var(--color-ink)]">
                  Nenhum link de áudio/vídeo anexado
                </p>
                <p className="text-[11px] text-[var(--color-muted)]">
                  Edite a música e insira um link do YouTube ou Spotify.
                </p>
              </div>
            )}

            {/* Track Info & Navigation */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                {currentTrack.originalKey && (
                  <span className="px-2.5 py-1 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 font-bold text-xs">
                    Tom: {currentTrack.originalKey}
                  </span>
                )}
                {currentTrack.bpm && (
                  <span className="px-2 py-1 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-ink)] font-semibold text-xs border border-[var(--color-border)]">
                    {currentTrack.bpm} BPM
                  </span>
                )}
                <span className="text-xs text-[var(--color-muted)] truncate max-w-[140px]">
                  {currentTrack.artist || "Sem artista"}
                </span>
              </div>

              {/* Prev / Next buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="px-2.5 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-ink)] hover:bg-[var(--color-border)] disabled:opacity-30 transition-all active:scale-95"
                  title="Música anterior"
                >
                  ⏮️ Anterior
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentIndex === playlist.length - 1}
                  className="px-2.5 py-1.5 rounded-xl border border-[var(--color-border)] bg-violet-600 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-30 transition-all active:scale-95"
                  title="Próxima música"
                >
                  Próxima ⏭️
                </button>
              </div>
            </div>

            {/* Playlist Drawer / Overview */}
            {showPlaylist && playlist.length > 1 && (
              <div className="pt-2 border-t border-[var(--color-border)] space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)] px-1">
                  Playlist do Culto ({playlist.length})
                </p>
                {playlist.map((track, idx) => {
                  const isCurrent = idx === currentIndex;
                  return (
                    <button
                      key={track.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        if (onSelectTrack) onSelectTrack(track);
                      }}
                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between text-xs transition-colors ${
                        isCurrent
                          ? "bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-200 font-bold"
                          : "hover:bg-[var(--color-surface-2)] text-[var(--color-ink)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-4 text-center text-[10px] text-[var(--color-muted)]">
                          {idx + 1}
                        </span>
                        <span className="truncate">{track.title}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-[var(--color-muted)]">
                        {track.originalKey || "-"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
