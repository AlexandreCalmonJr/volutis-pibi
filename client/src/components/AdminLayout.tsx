import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar, { Page } from "./Sidebar";
import { useTheme } from "../themeStore";
import { useAuth } from "../store";

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/escalas": "Escalas",
  "/admin/eventos": "Eventos",
  "/admin/voluntarios": "Voluntários",
  "/admin/comunicacao": "Comunicação",
  "/admin/louvor": "Louvor",
  "/admin/relatorios": "Relatórios",
};

export default function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const user = useAuth((s) => s.user);

  const currentPath = location.pathname;
  const pageTitle = pageTitles[currentPath] || "Admin";

  // Derive the sidebar "page" from the current route
  const currentPage: Page = (() => {
    if (currentPath === "/admin") return "dashboard";
    const segment = currentPath.replace("/admin/", "");
    return segment as Page;
  })();

  const handleNavigate = (_page: Page) => {
    // Navigation is handled by react-router links in Sidebar
  };

  return (
    <div className="flex h-full" style={{ backgroundColor: "var(--color-bg)" }}>
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-primary-light)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-sm font-semibold text-[var(--color-ink)]">{pageTitle}</h1>
              <p className="text-xs text-[var(--color-muted)] hidden sm:block">Primeira Igreja Batista de Itapuã</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-primary-light)] transition-colors border border-[var(--color-border)]"
              title={theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
            >
              {theme === "light" ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>

            {/* Search */}
            <div className="relative hidden sm:block">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                placeholder="Buscar..."
                className="pl-9 pr-4 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent-soft)] w-48 transition-all focus:w-64"
              />
            </div>

            {/* Notifications */}
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-primary-light)] transition-colors border border-[var(--color-border)]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            </button>

            {/* User avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer"
              style={{ backgroundColor: "#7c3aed" }}
            >
              {user?.memberName ? user.memberName.split(" ").slice(0, 2).map((n) => n[0]).join("") : "US"}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
