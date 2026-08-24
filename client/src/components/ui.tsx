import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useToasts } from "../store";

/* ── Status chip ────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "⏳ Pendente", cls: "bg-warn/15 text-warn" },
  CONFIRMED: { label: "✅ Confirmado", cls: "bg-ok/15 text-ok" },
  DECLINED: { label: "❌ Recusado", cls: "bg-danger/15 text-danger" },
  SWAP_REQUESTED: { label: "🔄 Troca solicitada", cls: "bg-accent-soft/15 text-accent-soft" },
};

export function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, cls: "bg-surface-2 text-muted" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

/* ── Card ───────────────────────────────────────────────── */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-4 ${className}`}>{children}</div>
  );
}

export function Button({
  children, onClick, variant = "primary", disabled, className = "",
}: {
  children: ReactNode; onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "ok"; disabled?: boolean; className?: string;
}) {
  const styles = {
    primary: "bg-accent text-white active:bg-accent/80",
    ok: "bg-ok/90 text-bg font-semibold active:bg-ok/70",
    danger: "bg-danger/15 text-danger active:bg-danger/25",
    ghost: "bg-surface-2 text-ink active:bg-border",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

/* ── Bottom navigation ──────────────────────────────────── */
const tabs = [
  { to: "/", label: "Início", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { to: "/escalas", label: "Escalas", icon: "M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" },
  { to: "/repertorio", label: "Músicas", icon: "M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z" },
  { to: "/perfil", label: "Perfil", icon: "M12 12a5 5 0 100-10 5 5 0 000 10zM4 21a8 8 0 0116 0" },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? "text-accent-soft" : "text-muted"
              }`
            }
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={t.icon} />
            </svg>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/* ── Toasts ─────────────────────────────────────────────── */
export function ToastHost() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="toast-in pointer-events-auto w-full max-w-md cursor-pointer rounded-2xl border border-border bg-surface-2 p-3 shadow-xl shadow-black/40"
        >
          <p className="text-sm font-semibold">{t.title}</p>
          {t.body && <p className="mt-0.5 text-xs text-muted">{t.body}</p>}
          {t.whatsappLink && (
            <a
              href={t.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-2 inline-block rounded-lg bg-ok/90 px-3 py-1.5 text-xs font-semibold text-bg"
            >
              Avisar no WhatsApp
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Header ─────────────────────────────────────────────── */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-4">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}

export function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}
export function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
