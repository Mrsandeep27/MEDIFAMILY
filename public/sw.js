const CACHE_NAME = "medilog-v2";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/manifest.json",
];

// Install — cache only essential static assets (others cached on navigation)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {
        // Silently fail — pages may redirect, cache on next visit
      })
    )
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET, API, and non-http(s) requests (chrome-extension, etc.)
  if (
    request.method !== "GET" ||
    request.url.includes("/api/") ||
    !request.url.startsWith("http")
  ) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline — serve from cache
        return caches.match(request).then((cached) => {
          return cached || caches.match("/");
        });
      })
  );
});
