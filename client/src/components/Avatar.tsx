type AvatarTone = "violet" | "blue" | "emerald" | "amber" | "rose" | "slate";

const AVATAR_STYLES: Record<AvatarTone, { bg: string; fg: string; ring: string }> = {
  violet: { bg: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", fg: "#ffffff", ring: "#ede9fe" },
  blue: { bg: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", fg: "#ffffff", ring: "#dbeafe" },
  emerald: { bg: "linear-gradient(135deg, #10b981 0%, #047857 100%)", fg: "#ffffff", ring: "#d1fae5" },
  amber: { bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", fg: "#ffffff", ring: "#fef3c7" },
  rose: { bg: "linear-gradient(135deg, #f43f5e 0%, #be123c 100%)", fg: "#ffffff", ring: "#ffe4e6" },
  slate: { bg: "linear-gradient(135deg, #64748b 0%, #334155 100%)", fg: "#ffffff", ring: "#e2e8f0" },
};

export const AVATAR_OPTIONS = Object.keys(AVATAR_STYLES) as AvatarTone[];

export function getInitials(name?: string | null, fallback = "US") {
  const base = name?.trim();
  if (!base) return fallback;
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || fallback;
}

export function Avatar({
  name,
  photoUrl,
  avatarKey,
  size = 40,
  textClassName = "font-bold",
  className = "",
}: {
  name?: string | null;
  photoUrl?: string | null;
  avatarKey?: string | null;
  size?: number;
  textClassName?: string;
  className?: string;
}) {
  const tone = (avatarKey && avatarKey in AVATAR_STYLES ? avatarKey : "violet") as AvatarTone;
  const style = AVATAR_STYLES[tone];
  const initials = getInitials(name);
  return (
    <div
      className={`rounded-full flex items-center justify-center overflow-hidden shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
        background: style.bg,
        color: style.fg,
        boxShadow: `0 0 0 3px ${style.ring}`,
      }}
      aria-label={`Avatar de ${name || "usuário"}`}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={name || "usuário"} className="w-full h-full object-cover" />
      ) : (
        <span className={textClassName} style={{ fontSize: Math.max(12, Math.round(size * 0.32)) }}>{initials}</span>
      )}
    </div>
  );
}
