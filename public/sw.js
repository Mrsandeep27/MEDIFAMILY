const CACHE_NAME = "medifamily-v5";
const STATIC_ASSETS = ["/login", "/manifest.json"];
const IS_LOCALHOST =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1";

// ─── Install ────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  if (IS_LOCALHOST) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

// ─── Activate — clean old caches ────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

// ─── Push — show notification from server push ──────────────────────
self.addEventListener("push", (event) => {
  let data = {
    title: "MediFamily",
    body: "You have a new notification",
    url: "/home",
  };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* use defaults */
  }

  const options = {
    body: data.body,
    icon: "/logo.png",
    badge: "/logo.png",
    tag: data.tag || "medifamily-notification",
    data: { url: data.url || "/home", type: data.type || "general" },
    requireInteraction: data.requireInteraction || false,
  };

  // Add vibration + actions for medicine reminders
  if (data.type === "medicine-reminder") {
    options.vibrate = [200, 100, 200, 100, 200];
    options.actions = [
      { action: "taken", title: "✅ Taken" },
      { action: "snooze", title: "⏰ Snooze 10min" },
    ];
    options.requireInteraction = true;
  }

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ─── Notification Click — handle actions + navigation ───────────────
self.addEventListener("notificationclick", (event) => {
  const { action } = event;
  const data = event.notification.data || {};

  event.notification.close();

  // Handle medicine reminder actions
  if (data.type === "medicine-reminder") {
    if (action === "taken") {
      // Tell the app that medicine was taken
      event.waitUntil(
        self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((clients) => {
            for (const client of clients) {
              client.postMessage({
                type: "REMINDER_ACTION",
                action: "taken",
                reminderId: data.reminderId,
                medicineName: data.medicineName,
              });
            }
          })
      );
      return;
    }

    if (action === "snooze") {
      // Re-show notification after 10 minutes
      event.waitUntil(
        new Promise((resolve) => {
          setTimeout(() => {
            self.registration
              .showNotification(
                `💊 Reminder: ${data.medicineName || "Take your medicine"}`,
                {
                  body: "Snoozed reminder — time to take your medicine!",
                  icon: "/logo.png",
                  badge: "/logo.png",
                  tag: `reminder-snooze-${data.reminderId || "med"}`,
                  vibrate: [200, 100, 200, 100, 200],
                  requireInteraction: true,
                  data: { ...data },
                  actions: [
                    { action: "taken", title: "✅ Taken" },
                    { action: "snooze", title: "⏰ Snooze 10min" },
                  ],
                }
              )
              .then(resolve);
          }, 10 * 60 * 1000); // 10 minutes
        })
      );
      return;
    }
  }

  // Default: open/focus the app at the right URL
  const url = data.url || "/home";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

// ─── Fetch — network first, fallback to cache ───────────────────────
self.addEventListener("fetch", (event) => {
  if (IS_LOCALHOST) return;

  const { request } = event;

  // Skip non-GET, API, and non-http(s) requests
  if (
    request.method !== "GET" ||
    request.url.includes("/api/") ||
    !request.url.startsWith("http")
  )
    return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches
          .match(request)
          .then((cached) => cached || caches.match("/login"));
      })
  );
});
