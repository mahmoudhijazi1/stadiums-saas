const CACHE = "owner-shell-v2";
const OFFLINE_URL = "/offline.html";

// Push (owner alerts). Where a tap goes when the payload's url is missing or not an owner path.
const DEFAULT_URL = "/owner/requests";
// The generated logo of this host's stadium: the route picks the stadium from the Host.
const NOTIFICATION_ICON = "/brand/icon/192";
// Shown when a push arrives empty or unreadable. A browser that is told "userVisibleOnly" must
// show something for every push, or it may drop the subscription.
const FALLBACK = {
  ar: { title: "ملاعب", body: "لديك تحديث جديد." },
  en: { title: "Lebstads", body: "You have a new update." },
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((cached) => {
        if (cached) return cached;
        return new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }),
    ),
  );
});

/**
 * Only a path under /owner/ on this origin. Anything else (an absolute URL, another site,
 * "//host", a path that climbs out with "..", a non-string) becomes DEFAULT_URL.
 */
function safeOwnerPath(raw) {
  if (typeof raw !== "string") return DEFAULT_URL;
  if (!raw.startsWith("/owner/") || raw.includes("\\")) return DEFAULT_URL;
  try {
    const url = new URL(raw, self.location.origin);
    if (url.origin !== self.location.origin) return DEFAULT_URL;
    if (!url.pathname.startsWith("/owner/")) return DEFAULT_URL;
    return url.pathname + url.search + url.hash;
  } catch {
    return DEFAULT_URL;
  }
}

function text(value, fallback) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

// ALWAYS shows a notification, even for no data or invalid JSON.
self.addEventListener("push", (event) => {
  let data = null;
  try {
    data = event.data ? event.data.json() : null;
  } catch {
    data = null;
  }
  if (!data || typeof data !== "object") data = {};

  const lang = data.lang === "en" ? "en" : "ar";
  const fallback = FALLBACK[lang];
  event.waitUntil(
    self.registration.showNotification(text(data.title, fallback.title), {
      body: text(data.body, fallback.body),
      icon: NOTIFICATION_ICON,
      tag: text(data.tag, "owner"),
      renotify: true,
      dir: data.dir === "ltr" ? "ltr" : "rtl",
      lang,
      data: { url: safeOwnerPath(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeOwnerPath(event.notification.data && event.notification.data.url);
  const absolute = new URL(target, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const existing = windows.find((client) => {
          try {
            return new URL(client.url).pathname.startsWith("/owner/");
          } catch {
            return false;
          }
        });
        if (!existing) return self.clients.openWindow(absolute);
        return existing
          .focus()
          .then((focused) => (focused || existing).navigate(absolute))
          .catch(() => self.clients.openWindow(absolute));
      }),
  );
});
