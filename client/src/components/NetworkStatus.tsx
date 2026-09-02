import { useState, useEffect } from "react";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : true
  );
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-medium shadow-lg backdrop-blur flex items-center gap-2 transition-all duration-300 ${
        !isOnline
          ? "bg-amber-600/90 text-white border border-amber-500/30"
          : "bg-emerald-600/90 text-white border border-emerald-500/30"
      }`}
    >
      {!isOnline ? (
        <>
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>Sem conexão com a internet. Verifique sua rede.</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>Conexão restabelecida!</span>
        </>
      )}
    </div>
  );
}
