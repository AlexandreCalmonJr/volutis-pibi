import { useState, useRef, useEffect, type ReactNode } from "react";

export interface ActionMenuItem {
  id?: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "danger" | "primary";
  description?: string;
  customRender?: (close: () => void) => ReactNode;
}

interface ActionMenuProps {
  label?: string;
  icon?: ReactNode;
  items: ActionMenuItem[];
  variant?: "outline" | "primary" | "secondary";
  className?: string;
  align?: "left" | "right";
}

export function ActionMenu({
  label = "Ações",
  icon,
  items,
  variant = "outline",
  className = "",
  align = "right",
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const buttonStyles = {
    outline:
      "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)] shadow-sm",
    primary:
      "bg-[var(--color-primary)] text-white hover:opacity-95 shadow-sm",
    secondary:
      "bg-[var(--color-primary-light)] text-[var(--color-primary)] hover:bg-violet-100 dark:hover:bg-violet-900/40",
  }[variant];

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 cursor-pointer ${buttonStyles}`}
      >
        {icon ? (
          icon
        ) : (
          <svg className="w-4 h-4 text-current opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        )}
        <span>{label}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 text-current opacity-60 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute mt-2 w-56 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 shadow-2xl z-40 animate-in fade-in zoom-in-95 duration-150 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="menu"
        >
          {items.map((item, idx) => {
            if (item.customRender) {
              return (
                <div key={item.id ?? idx} className="px-1 py-0.5">
                  {item.customRender(() => setOpen(false))}
                </div>
              );
            }

            const itemColors = {
              default: "text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
              danger: "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30",
              primary: "text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]/50",
            }[item.variant ?? "default"];

            return (
              <button
                key={item.id ?? idx}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${itemColors}`}
                role="menuitem"
              >
                {item.icon && <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">{item.icon}</span>}
                <div className="flex-1 min-w-0">
                  <p className="truncate">{item.label}</p>
                  {item.description && (
                    <p className="text-[11px] text-[var(--color-muted)] font-normal truncate mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
