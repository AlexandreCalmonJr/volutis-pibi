// Service Worker — Volutis PIBI
const CACHE_VERSION = "volutis-pibi-v3";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Ignora requisições que não sejam GET
  if (e.request.method !== "GET") {
    return;
  }

  // Ignora rotas de API e WebSocket
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/ws")) {
    return;
  }

  // Ignora requisições de outras origens exceto fontes
  const isSameOrigin = url.origin === location.origin;
  const isFont = url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com");
  if (!isSameOrigin && !isFont) {
    return;
  }

  // 1. Navegação de páginas (HTML / rotas da SPA como /login, /escalas, /): Network-First
  if (
    e.request.mode === "navigate" ||
    e.request.destination === "document" ||
    (isSameOrigin && (url.pathname.endsWith(".html") || !url.pathname.includes(".")))
  ) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response.ok && isSameOrigin) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = (await caches.match(e.request)) || (await caches.match("/")) || (await caches.match("/index.html"));
          if (cached) return cached;
          return new Response("Offline", {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        })
    );
    return;
  }

  // 2. Assets estáticos versionados com hash (/assets/...): Cache-First
  if (isSameOrigin && url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(e.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. Outros recursos estáticos (ícones, manifest, fontes): Stale-While-Revalidate seguro
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(e.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});


