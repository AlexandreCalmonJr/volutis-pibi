/**
 * Cliente da API REST do Holyrics.
 *
 * Modo local:  POST http://IP:PORT/api/{action}?token=TOKEN
 * Modo online: POST https://api.holyrics.com.br/request/{action}
 *              headers: api_key, token
 *
 * Respostas normalizadas para { status: "ok"|"error", data?, error? }.
 */
import type { Church, Event, Song } from "@prisma/client";

export interface HolyricsResult<T = any> {
  status: "ok" | "error";
  data?: T;
  error?: string;
}

const TIMEOUT_MS = 8000;

export class HolyricsNotConfiguredError extends Error {
  constructor() {
    super("Holyrics não configurado. Defina modo, endereço e token nas configurações.");
  }
}

export function isConfigured(church: Church): boolean {
  if (church.holyricsMode === "local") {
    return !!(church.holyricsLocalIp && church.holyricsLocalPort && church.holyricsToken);
  }
  if (church.holyricsMode === "online") {
    return !!(church.holyricsApiKey && church.holyricsToken);
  }
  return false;
}

export async function callHolyrics<T = any>(
  church: Church,
  action: string,
  body: Record<string, unknown> = {}
): Promise<HolyricsResult<T>> {
  if (!isConfigured(church)) throw new HolyricsNotConfiguredError();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let res: Response;
    if (church.holyricsMode === "local") {
      const base = `http://${church.holyricsLocalIp}:${church.holyricsLocalPort}/api`;
      res = await fetch(`${base}/${action}?token=${encodeURIComponent(church.holyricsToken!)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } else {
      res = await fetch(`https://api.holyrics.com.br/request/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          api_key: church.holyricsApiKey!,
          token: church.holyricsToken!,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    }

    const json: any = await res.json().catch(() => ({ status: "error", error: `HTTP ${res.status}` }));

    // Normalização: modo online embrulha em response.response
    if (church.holyricsMode === "online") {
      if (json.status !== "ok") {
        const err = typeof json.error === "object" ? json.error?.message ?? json.error?.key : json.error;
        return { status: "error", error: err ?? "Erro de transporte" };
      }
      if (json.response_status === "timeout") {
        return { status: "error", error: "Holyrics não respondeu (timeout)" };
      }
      const inner = json.response ?? {};
      return inner.status === "ok"
        ? { status: "ok", data: inner.data }
        : { status: "error", error: inner.error ?? "Erro no Holyrics" };
    }

    return json.status === "ok"
      ? { status: "ok", data: json.data }
      : { status: "error", error: typeof json.error === "string" ? json.error : "Erro no Holyrics" };
  } catch (e: any) {
    const msg =
      e.name === "AbortError"
        ? "Holyrics não respondeu (timeout). Verifique se o programa está aberto e o API Server ativado."
        : `Falha de conexão: ${e.message}`;
    return { status: "error", error: msg };
  } finally {
    clearTimeout(timer);
  }
}

function splitSlides(text?: string | null) {
  return (text || "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, idx) => ({
      text: part,
      slide_description: idx === 0 ? "Verso 1" : `Parte ${idx + 1}`,
    }));
}

export async function findMatchingHolyricsSong(church: Church, song: Pick<Song, "title" | "artist">) {
  const result = await callHolyrics<any[]>(church, "SearchLyrics", {
    text: song.title,
    title: true,
    artist: true,
    note: false,
    lyrics: false,
  });
  if (result.status !== "ok") return null;

  const normalizedTitle = song.title.trim().toLowerCase();
  const normalizedArtist = (song.artist || "").trim().toLowerCase();
  return (result.data || []).find((item) => {
    const title = String(item.title || "").trim().toLowerCase();
    const artist = String(item.artist || "").trim().toLowerCase();
    return title === normalizedTitle && artist === normalizedArtist;
  }) || null;
}

export async function syncSongToHolyrics(church: Church, song: Song) {
  let holyricsId = song.holyricsId || undefined;
  if (!holyricsId) {
    const existing = await findMatchingHolyricsSong(church, song);
    if (existing?.id) holyricsId = String(existing.id);
  }

  const slides = splitSlides(song.lyrics || song.chords || undefined);
  const payload: Record<string, unknown> = {
    title: song.title,
    artist: song.artist || undefined,
    key: song.originalKey || undefined,
    bpm: song.bpm || undefined,
  };
  if (slides.length > 0) {
    payload.slides = slides;
    payload.order = slides.map((_, idx) => idx + 1).join(",");
  }

  if (holyricsId) {
    const update = await callHolyrics<any>(church, "EditItem", {
      action: "EditSong",
      data: { id: holyricsId, ...payload },
    });
    return update.status === "ok"
      ? { ok: true as const, holyricsId, mode: song.holyricsId ? "updated" as const : "linked" as const }
      : { ok: false as const, error: update.error || "Não foi possível atualizar a música no Holyrics" };
  }

  const create = await callHolyrics<any>(church, "CreateItem", {
    action: "CreateSong",
    data: payload,
  });
  if (create.status !== "ok") {
    return { ok: false as const, error: create.error || "Não foi possível criar a música no Holyrics" };
  }

  const createdId = String(create.data?.id || create.data?.item?.id || "");
  if (!createdId) {
    return { ok: false as const, error: "Holyrics respondeu sem ID da música criada" };
  }

  return { ok: true as const, holyricsId: createdId, mode: "created" as const };
}

export async function checkHolyricsPermissions(church: Church, actions: string[]) {
  return callHolyrics<any>(church, "CheckPermissions", { actions: actions.join(",") });
}

function formatHolyricsDatetime(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export async function findMatchingHolyricsSchedule(church: Church, event: Pick<Event, "title" | "startTime">) {
  const eventDate = new Date(event.startTime);
  const targetName = event.title.trim().toLowerCase();
  const targetDateTime = formatHolyricsDatetime(eventDate);

  const schedules = await callHolyrics<any[]>(church, "GetSchedules", {
    month: eventDate.getMonth() + 1,
    year: eventDate.getFullYear(),
  });
  if (schedules.status !== "ok") {
    return { match: null, error: schedules.error || "Não foi possível listar as escalas do Holyrics" };
  }

  const match = (schedules.data || []).find((item) => {
    const name = String(item.name || item.title || "").trim().toLowerCase();
    const datetime = String(item.datetime || "").slice(0, 16);
    return name === targetName && datetime === targetDateTime;
  }) || null;

  return { match, error: null };
}
