import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Escalas = lazy(() => import("./pages/Escalas"));
const Eventos = lazy(() => import("./pages/Eventos"));
const Voluntarios = lazy(() => import("./pages/Voluntarios"));
const Comunicacao = lazy(() => import("./pages/Comunicacao"));
const Louvor = lazy(() => import("./pages/Louvor"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Triagem = lazy(() => import("./pages/TriagemPage"));
const Convites = lazy(() => import("./pages/ConvitesPage"));
const Ministerios = lazy(() => import("./pages/MinisteriosPage"));
const UsuariosAdmin = lazy(() => import("./pages/UsuariosAdminPage"));
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CadastroPage from "./pages/CadastroPage";
import DefinirSenhaPage from "./pages/DefinirSenhaPage";
import { useRealtimeNotifications } from "./ws";
import { ToastHost, ThemeToggle } from "./components/ui";
import { OnboardingModal } from "./components/OnboardingModal";
import { PullToRefresh } from "./components/PullToRefresh";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NetworkStatus } from "./components/NetworkStatus";
import { useAuth, useNotifications, type NotificationItem } from "./store";
import { api } from "./api";
import { resolveNotificationTarget } from "./lib/notifications";
import { Avatar } from "./components/Avatar";
import { getPushConfig, registerPushSubscription } from "./push";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/escalas": "Escalas",
  "/eventos": "Eventos",
  "/voluntarios": "Voluntários",
  "/comunicacao": "Comunicação",
  "/perfil": "Perfil",
  "/louvor": "Louvor",
  "/relatorios": "Relatórios",
  "/triagem": "Triagem",
  "/usuarios": "Usuários",
  "/convites": "Convites",
  "/ministerios": "Ministérios",
};

function EscalaDeepLink() {
  const { id } = useParams();
  return <Navigate to={`/escalas${id ? `?scheduleItemId=${encodeURIComponent(id)}` : ""}`} replace />;
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-10 h-10 rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)] animate-spin" />
    </div>
  );
}

function LeaderRoute({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  if (user?.role !== "ADMIN" && user?.role !== "MINISTRY_LEADER") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [pushAvailable, setPushAvailable] = useState(false);
  const [pushEnabledServer, setPushEnabledServer] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const [pushBusy, setPushBusy] = useState(false);
  const user = useAuth((s) => s.user);
  const notifications = useNotifications((s) => s.items);
  const setNotifications = useNotifications((s) => s.setItems);
  const markReadLocal = useNotifications((s) => s.markReadLocal);
  const markAllReadLocal = useNotifications((s) => s.markAllReadLocal);

  useRealtimeNotifications();

  useEffect(() => {
    if (!user) return;
    setNotificationsLoading(true);
    api<{ items: NotificationItem[] }>("/my/notifications?limit=20")
      .then((res) => setNotifications(res.items))
      .catch(() => setNotifications([]))
      .finally(() => setNotificationsLoading(false));
  }, [user, setNotifications]);

  useEffect(() => {
    if (!user || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    setPushAvailable(true);
    getPushConfig()
      .then((config) => {
        setPushEnabledServer(config.enabled);
        if (config.enabled && Notification.permission === "granted") {
          return registerPushSubscription();
        }
      })
      .catch(() => setPushEnabledServer(false));
  }, [user]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications]
  );

  useEffect(() => {
    setNotificationsOpen(false);
  }, [location.pathname, location.search]);

  async function handleMarkNotificationRead(id: string) {
    markReadLocal(id);
    try {
      await api(`/notifications/${id}/read`, { method: "POST" });
    } catch {
      // best effort
    }
  }

  async function handleMarkAllNotificationsRead() {
    markAllReadLocal();
    try {
      await api("/notifications/read-all", { method: "POST" });
    } catch {
      // best effort
    }
  }

  function formatNotificationTime(dateStr: string) {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleNotificationClick(item: NotificationItem) {
    if (!item.readAt) {
      void handleMarkNotificationRead(item.id);
    }
    const target = resolveNotificationTarget(item);
    navigate(target.path);
  }

  async function handleEnablePush() {
    if (!("Notification" in window)) return;
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== "granted") throw new Error("Permissão de notificação não concedida.");
      await registerPushSubscription();
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="flex h-full" style={{ backgroundColor: "var(--color-background)" }}>
      <Sidebar
        currentPage={location.pathname}
        onNavigate={(path) => {
          navigate(path);
          setMobileMenuOpen(false);
        }}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-sm font-semibold text-[var(--color-text)]">
                {pageTitles[location.pathname] ?? "Volut"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative hidden sm:block">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                placeholder="Buscar..."
                className="pl-9 pr-4 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] w-48 transition-all focus:w-64"
              />
            </div>

            <ThemeToggle />

            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((open) => !open)}
                className="relative w-9 h-9 rounded-xl flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] transition-colors border border-[var(--color-border)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 px-1 text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-[360px] max-w-[90vw] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">Notificações</p>
                      <p className="text-xs text-[var(--color-muted)]">{unreadCount} não lida(s)</p>
                    </div>
                    <button
                      onClick={handleMarkAllNotificationsRead}
                      disabled={unreadCount === 0}
                      className="text-xs font-medium text-[var(--color-primary)] disabled:opacity-40"
                    >
                      Marcar todas
                    </button>
                  </div>

                  {pushAvailable && pushEnabledServer && pushPermission !== "granted" && (
                    <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-primary-light)]/40">
                      <p className="text-xs font-medium text-[var(--color-text)]">Ative as notificações do dispositivo para receber alertas mesmo com o app fechado.</p>
                      <button
                        onClick={handleEnablePush}
                        disabled={pushBusy || pushPermission === "denied"}
                        className="mt-2 text-xs font-semibold text-[var(--color-primary)] disabled:opacity-40 cursor-pointer"
                      >
                        {pushPermission === "denied" ? "Permissão bloqueada no navegador" : pushBusy ? "Ativando..." : "Ativar notificações no celular"}
                      </button>
                    </div>
                  )}

                  <div className="max-h-[420px] overflow-y-auto">
                    {notificationsLoading ? (
                      <div className="px-4 py-6 text-sm text-[var(--color-muted)]">Carregando notificações...</div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-[var(--color-muted)]">Nenhuma notificação ainda.</div>
                    ) : (
                      notifications.slice(0, 8).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleNotificationClick(item)}
                          className={`w-full text-left px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-2)] transition-colors ${
                            item.readAt ? "opacity-75" : "bg-[var(--color-primary-light)]/20"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--color-text)] truncate">{item.title}</p>
                              <p className="mt-1 text-xs text-[var(--color-muted)] line-clamp-2">{item.body}</p>
                              <p className="mt-2 text-[11px] text-[var(--color-muted)]">{formatNotificationTime(item.at)}</p>
                              <p className="mt-2 text-[11px] font-medium text-[var(--color-primary)]">{resolveNotificationTarget(item).label}</p>
                            </div>
                            {!item.readAt && <span className="mt-1 w-2.5 h-2.5 rounded-full bg-[var(--color-primary)] flex-shrink-0" />}
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
                    <button
                      onClick={() => {
                        navigate("/comunicacao");
                        setNotificationsOpen(false);
                      }}
                      className="text-xs font-medium text-[var(--color-primary)]"
                    >
                      Ver central completa
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => navigate("/perfil")} className="rounded-full" title="Abrir perfil">
              <Avatar name={user?.memberName || user?.email} photoUrl={user?.photoUrl} avatarKey={user?.avatarKey} size={36} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <PullToRefresh>
            <div key={location.pathname} className="page-transition">
              <ErrorBoundary fallbackTitle="Erro ao exibir esta página" fallbackDescription="Não foi possível carregar as informações desta seção. Tente novamente.">
                <Suspense fallback={<PageLoader />}>
                  <Routes location={location}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/escalas" element={<Escalas />} />
                    <Route path="/eventos" element={<Eventos />} />
                    <Route path="/voluntarios" element={<Voluntarios />} />
                    <Route path="/comunicacao" element={<Comunicacao />} />
                    <Route path="/perfil" element={<Perfil />} />
                    <Route path="/louvor" element={<Louvor />} />
                    <Route path="/relatorios" element={<LeaderRoute><Relatorios /></LeaderRoute>} />
                    <Route path="/triagem" element={<LeaderRoute><Triagem /></LeaderRoute>} />
                    <Route path="/usuarios" element={<LeaderRoute><UsuariosAdmin /></LeaderRoute>} />
                    <Route path="/convites" element={<LeaderRoute><Convites /></LeaderRoute>} />
                    <Route path="/ministerios" element={<LeaderRoute><Ministerios /></LeaderRoute>} />
                    <Route path="/escala/:id" element={<EscalaDeepLink />} />
                    <Route path="*" element={<div className="text-center py-20"><p className="text-lg font-semibold text-[var(--color-text)]">Página não encontrada</p><p className="text-sm text-[var(--color-muted)] mt-2">O endpoint que você procura não existe.</p></div>} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </div>
          </PullToRefresh>
        </main>
      </div>

      {/* Guided Tour for New Volunteers */}
      <OnboardingModal />
    </div>
  );
}

export default function App() {
  return (
    <>
      <ToastHost />
      <NetworkStatus />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/cadastro/:slug" element={<CadastroPage />} />
        <Route path="/definir-senha" element={<DefinirSenhaPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}
