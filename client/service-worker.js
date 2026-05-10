const CACHE_VERSION = "2026.05.09.10";
const STELLARSYNC_CACHE = `stellarsync-shell-${CACHE_VERSION}`;
const STELLARSYNC_ASSETS = [
  "./",
  "./algorithmwitch.html",
  "./manifest.webmanifest",
  "./stellarsync-plugin.js",
  "./icons/stellarsync-192.png",
  "./icons/stellarsync-512.png",
  "./icons/stellarsync-apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STELLARSYNC_CACHE).then((cache) => cache.addAll(STELLARSYNC_ASSETS)).catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== STELLARSYNC_CACHE).map((key) => caches.delete(key)))
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
  if (url.pathname.includes("/exec") || url.pathname.endsWith("/service-worker.js") || url.searchParams.has("action")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STELLARSYNC_CACHE).then((cache) => cache.put("./algorithmwitch.html", copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match("./algorithmwitch.html"))
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
        .catch(() => cached);
    })
  );
});
