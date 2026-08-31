import { create } from "zustand";
import { persist } from "zustand/middleware";
import { API_URL } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  role: "ADMIN" | "MINISTRY_LEADER" | "VOLUNTEER" | "MEMBER";
  memberId?: string;
  memberName?: string;
  avatarKey?: string | null;
  photoUrl?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: AuthUser, access: string, refreshTok: string) => void;
  setTokens: (access: string, refreshTok: string) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => {
        // Invalidar refresh token no servidor (fire-and-forget)
        const token = useAuth.getState().accessToken;
        if (token) {
          fetch(`${API_URL}/api/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
        set({ user: null, accessToken: null, refreshToken: null });
      },
    }),
    { name: "volut-auth" }
  )
);

/* ── Toasts ─────────────────────────────────────────────── */
export interface Toast {
  id: number;
  title: string;
  body?: string;
  kind?: "info" | "ok" | "warn";
  whatsappLink?: string | null;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 6000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/* ── Notificações ───────────────────────────────────────── */
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  whatsappLink?: string | null;
  at: string;
  readAt?: string | null;
}

interface NotificationState {
  items: NotificationItem[];
  setItems: (items: NotificationItem[]) => void;
  upsert: (item: NotificationItem) => void;
  markReadLocal: (id: string) => void;
  markAllReadLocal: () => void;
  clear: () => void;
}

export const useNotifications = create<NotificationState>((set) => ({
  items: [],
  setItems: (items) =>
    set({
      items: [...items].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
      ),
    }),
  upsert: (item) =>
    set((state) => {
      const existing = state.items.find((n) => n.id === item.id);
      if (existing) {
        return {
          items: state.items
            .map((n) => (n.id === item.id ? { ...n, ...item } : n))
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
        };
      }
      return {
        items: [item, ...state.items].sort(
          (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
        ),
      };
    }),
  markReadLocal: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
          : item
      ),
    })),
  markAllReadLocal: () =>
    set((state) => ({
      items: state.items.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
    })),
  clear: () => set({ items: [] }),
}));
