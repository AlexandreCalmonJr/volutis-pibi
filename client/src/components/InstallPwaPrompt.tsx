import React, { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Verifica se já está rodando como app instalado (PWA standalone)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return;

    // Checa se o usuário fechou o aviso recentemente (últimos 3 dias)
    const dismissedAt = localStorage.getItem("volut_pwa_dismissed_at");
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < 3 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Detecta iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);

    if (isIosDevice && isSafari && !standalone) {
      setIsIos(true);
      setDismissed(false);
    }

    // Escuta evento nativo do Android/Chrome/Edge
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDismissed(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("volut_pwa_dismissed_at", Date.now().toString());
  };

  if (isStandalone || dismissed || (!deferredPrompt && !isIos)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-[#1a1333]/95 backdrop-blur-md border border-[#7c3aed]/40 shadow-2xl shadow-purple-950/60 rounded-2xl p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-xl">📲</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h4 className="font-bold text-sm text-white">Instalar o Volut no celular</h4>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-white text-xs p-1 rounded-md transition"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-purple-200/80 mt-1 leading-relaxed">
              {isIos
                ? "Para instalar no iPhone: toque no ícone de Compartilhar (abaixo) e selecione 'Adicionar à Tela de Início' ➕."
                : "Acesse suas escalas, notificações e repertório com a rapidez de um app nativo!"}
            </p>

            {!isIos && deferredPrompt && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>⚡</span> Instalar Agora
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-2.5 py-1.5 text-xs text-purple-300 hover:text-white transition"
                >
                  Mais tarde
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
