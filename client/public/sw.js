// Service Worker — Network-First para HTML/navegação, Cache-First para assets estáticos
const CACHE_VERSION = "volutis-pibi-v2";

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

  // Ignorar requisições não-GET e rotas dinâmicas de backend
  if (
    e.request.method !== "GET" ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/ws")
  ) {
    return;
  }

  // 1. Requisições de navegação e HTML: Network-First (com fallback offline)
  // Garante que novas versões do bundle JS/CSS sejam carregadas imediatamente após deploy
  if (
    e.request.mode === "navigate" ||
    e.request.destination === "document" ||
    url.pathname.endsWith(".html") ||
    url.pathname === "/"
  ) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response.ok && url.origin === location.origin) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(e.request).then((cached) => cached || caches.match("/"));
        })
    );
    return;
  }

  // 2. Assets estáticos versionados com hash (/assets/...): Cache-First
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((response) => {
          if (response.ok && url.origin === location.origin) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(e.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. Outros recursos (ícones, manifest, etc.): Stale-While-Revalidate
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse.ok && url.origin === location.origin) {
          const clone = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(e.request, clone));
        }
        return networkResponse;
      }).catch(() => null);

      return cached || fetchPromise;
    })
  );
});

