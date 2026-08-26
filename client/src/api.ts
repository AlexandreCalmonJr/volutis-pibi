/**
 * Cliente HTTP com injeção de JWT e refresh automático em 401.
 */
import { useAuth } from "./store";

export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

async function refresh(): Promise<boolean> {
  const { refreshToken, setTokens, logout } = useAuth.getState();
  if (!refreshToken) return false;
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    logout();
    return false;
  }
  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  return true;
}


export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  retried = false
): Promise<T> {
  const { accessToken } = useAuth.getState();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_URL}/api${cleanPath}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });


  if (res.status === 401 && !retried && (await refresh())) {
    return api<T>(path, options, true);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Erro ${res.status}`, res.status, data);
  return data as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: any) {
    super(message);
  }
}
