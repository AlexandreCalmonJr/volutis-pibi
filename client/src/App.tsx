import { useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Escalas from "./pages/Escalas";
import Eventos from "./pages/Eventos";
import Voluntarios from "./pages/Voluntarios";
import Comunicacao from "./pages/Comunicacao";
import Louvor from "./pages/Louvor";
import Relatorios from "./pages/Relatorios";
import Triagem from "./pages/TriagemPage";
import LoginPage from "./pages/LoginPage";
import CadastroPage from "./pages/CadastroPage";
import DefinirSenhaPage from "./pages/DefinirSenhaPage";
import { useRealtimeNotifications } from "./ws";
import { ToastHost } from "./components/ui";
import { useAuth } from "./store";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/escalas": "Escalas",
  "/eventos": "Eventos",
  "/voluntarios": "Voluntários",
  "/comunicacao": "Comunicação",
  "/louvor": "Louvor",
  "/relatorios": "Relatórios",
  "/triagem": "Triagem",
};

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = useAuth((s) => s.user);

  useRealtimeNotifications();

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "US";

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
        <header className="bg-white border-b border-[var(--color-border)] px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-background)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-sm font-semibold text-[var(--color-text)]">
                {pageTitles[location.pathname] ?? "Volutis"}
              </h1>
              <p className="text-xs text-[var(--color-muted)] hidden sm:block">Igreja Batista Central</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative hidden sm:block">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                placeholder="Buscar..."
                className="pl-9 pr-4 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-white text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] w-48 transition-all focus:w-64"
              />
            </div>

            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-background)] transition-colors border border-[var(--color-border)]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            </button>

            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/escalas" element={<Escalas />} />
            <Route path="/eventos" element={<Eventos />} />
            <Route path="/voluntarios" element={<Voluntarios />} />
            <Route path="/comunicacao" element={<Comunicacao />} />
            <Route path="/louvor" element={<Louvor />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/triagem" element={<Triagem />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ToastHost />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
