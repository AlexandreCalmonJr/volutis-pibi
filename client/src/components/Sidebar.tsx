import { useAuth } from "../store";
import { useNavigate } from "react-router-dom";
import { Avatar } from "./Avatar";
import { usePushNotifications } from "../hooks/usePushNotifications";

export type Page = string;

interface SidebarProps {
  currentPage: string;
  onNavigate: (path: string) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const navItems: { path: string; label: string; icon: string; roles?: string[] }[] = [
  { path: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { path: "/escalas", label: "Escalas", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { path: "/eventos", label: "Eventos", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
  { path: "/voluntarios", label: "Voluntários", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", roles: ["ADMIN", "MINISTRY_LEADER"] },
  { path: "/triagem", label: "Triagem", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", roles: ["ADMIN", "MINISTRY_LEADER"] },
  { path: "/usuarios", label: "Usuários", icon: "M5.121 17.804A9.004 9.004 0 0112 15a9.004 9.004 0 016.879 2.804M15 11a3 3 0 11-6 0 3 3 0 016 0zM19 21H5a2 2 0 01-2-2v-1a7 7 0 0114 0v1a2 2 0 01-2 2z", roles: ["ADMIN"] },
  { path: "/convites", label: "Convites", icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", roles: ["ADMIN", "MINISTRY_LEADER"] },
  { path: "/ministerios", label: "Ministérios", icon: "M3 7h18M6 7v13m12-13v13M8 11h8M8 15h8", roles: ["ADMIN", "MINISTRY_LEADER"] },
  { path: "/comunicacao", label: "Comunicação", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { path: "/louvor", label: "Louvor", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3", roles: ["ADMIN", "MINISTRY_LEADER"] },
  { path: "/relatorios", label: "Relatórios", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", roles: ["ADMIN", "MINISTRY_LEADER"] },
];

export default function Sidebar({ currentPage, onNavigate, mobileOpen, onMobileClose }: SidebarProps) {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const { isSupported, isSubscribed, permission, loading, busy, error, enablePush } = usePushNotifications();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const displayName = user?.memberName || (user?.email?.split("@")[0] ?? "Usuário");
  const roleLabel = user?.role === "ADMIN" ? "Administrador"
    : user?.role === "MINISTRY_LEADER" ? "Líder de Ministério"
    : user?.role === "VOLUNTEER" ? "Voluntário"
    : "Membro";
  const filteredNav = navItems.filter((item) => {
    if (!item.roles) return true;
    return user?.role && item.roles.includes(user.role);
  });

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={[
          "fixed top-0 left-0 z-30 h-full w-64 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        style={{ backgroundColor: "var(--color-sidebar)" }}
      >
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Volut</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Menu
          </p>
          {filteredNav.map((item) => {
            const active = currentPage === item.path || (item.path !== "/" && currentPage.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                className={[
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  active
                    ? "text-white"
                    : "text-indigo-300 hover:text-white hover:bg-white/5",
                ].join(" ")}
                style={active ? { backgroundColor: "var(--color-sidebar-active)" } : {}}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-2">
          {isSupported && !loading && (
            <div className="rounded-xl p-3 bg-white/5 border border-white/10 text-xs">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${isSubscribed ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                <span className="text-white font-medium">
                  {isSubscribed ? "Notificações ativas" : "Alertas no celular"}
                </span>
              </div>
              {!isSubscribed ? (
                <>
                  <p className="text-indigo-300 text-[11px] mb-2.5 leading-relaxed">
                    Receba avisos de escalas e eventos mesmo com o app fechado.
                  </p>
                  <button
                    onClick={enablePush}
                    disabled={busy || permission === "denied"}
                    className="w-full py-1.5 px-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {busy ? "Ativando..." : permission === "denied" ? "Bloqueado no navegador" : "Ativar no Celular"}
                  </button>
                  {error && <p className="text-rose-300 text-[10px] mt-1.5">{error}</p>}
                </>
              ) : (
                <p className="text-emerald-300/80 text-[11px]">
                  Dispositivo registrado para receber escalas em segundo plano.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <Avatar name={displayName} photoUrl={user?.photoUrl} avatarKey={user?.avatarKey} size={36} className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{displayName}</p>
              <p className="text-indigo-400 text-xs truncate">{roleLabel}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-indigo-400 hover:text-white transition-colors"
              title="Sair"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
