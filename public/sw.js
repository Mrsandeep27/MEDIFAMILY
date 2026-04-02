const CACHE_NAME = "medilog-v4";
const STATIC_ASSETS = [
  "/login",
  "/manifest.json",
];
const IS_LOCALHOST =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1";

// Install — cache only essential static assets (others cached on navigation)
self.addEventListener("install", (event) => {
  if (IS_LOCALHOST) {
    self.skipWaiting();
    return;
  }
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
  if (IS_LOCALHOST) {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
    self.clients.claim();
    return;
  }
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Push — show notification when server sends push
self.addEventListener("push", (event) => {
  let data = { title: "MediLog", body: "You have a new notification", url: "/home" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* use defaults */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/logo.png",
      badge: "/logo.png",
      tag: data.tag || "medilog-notification",
      data: { url: data.url || "/home" },
      requireInteraction: data.requireInteraction || false,
    })
  );
});

// Notification click — open or focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/home";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new tab
      return self.clients.openWindow(url);
    })
  );
});

// Fetch — network first, fallback to cache
self.addEventListener("fetch", (event) => {
  if (IS_LOCALHOST) return;

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
          return cached || caches.match("/login");
        });
      })
  );
});
