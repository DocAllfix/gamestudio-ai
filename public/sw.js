// GameSmith service worker — cache-first for static assets, network-first for API.
const CACHE = "gamesmith-v1";
const PRECACHE = ["/", "/feed", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Pass through API/webhook routes — never cache them.
  if (request.url.includes("/api/")) return;

  event.respondWith(
    caches.match(request).then(
      (cached) => cached ?? fetch(request).catch(() => cached),
    ),
  );
});
