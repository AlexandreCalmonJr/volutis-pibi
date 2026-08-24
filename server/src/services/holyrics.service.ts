/**
 * Cliente da API REST do Holyrics.
 *
 * Modo local:  POST http://IP:PORT/api/{action}?token=TOKEN
 * Modo online: POST https://api.holyrics.com.br/request/{action}
 *              headers: api_key, token
 *
 * Respostas normalizadas para { status: "ok"|"error", data?, error? }.
 */
import type { Church } from "@prisma/client";

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
