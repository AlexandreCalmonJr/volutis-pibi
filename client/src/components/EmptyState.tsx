import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
  children,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] ${className}`}
    >
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center mb-4 shadow-sm">
        {icon ? (
          icon
        ) : (
          <svg className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        )}
      </div>

      <h3 className="text-base sm:text-lg font-bold text-[var(--color-text)] mb-1 font-display">
        {title}
      </h3>

      {description && (
        <p className="text-xs sm:text-sm text-[var(--color-muted)] max-w-sm leading-relaxed mb-5">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
        >
          {actionLabel}
        </button>
      )}

      {children}
    </div>
  );
}
