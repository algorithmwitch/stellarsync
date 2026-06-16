const CACHE_VERSION = "2026.06.16.01-launch-hardening";
const STELLARSYNC_CACHE = `stellarsync-app-shell-${CACHE_VERSION}`;
const STELLARSYNC_ASSETS = [
  "./",
  "./index.html",
  "./load.html",
  "./manifest.webmanifest",
  "../icon/stellarsync-192.png",
  "../icon/stellarsync-512.png",
  "../icon/stellarsync-apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STELLARSYNC_CACHE)
      .then((cache) => cache.addAll(STELLARSYNC_ASSETS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("stellarsync-app-shell-") && key !== STELLARSYNC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/service-worker.js")) return;
  if (url.searchParams.has("action")) return;
  if (url.pathname.includes("/functions/v1/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STELLARSYNC_CACHE).then((cache) => cache.put("./index.html", copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") return response;
          const copy = response.clone();
          caches.open(STELLARSYNC_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(() => cached)
    })
  );
});
