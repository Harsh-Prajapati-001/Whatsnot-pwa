/* Whatsnot service worker: caches only the application shell and non-sensitive operational reads. */
const VERSION = "whatsnot-v1.0.0";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const SAFE_ROUTES = ["/dashboard", "/workspaces", "/monitoring", "/billing", "/settings"];
const PRECACHE = [
  "/dashboard",
  "/workspaces",
  "/monitoring",
  "/billing",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL, RUNTIME].includes(key)).map((key) => caches.delete(key)))),
    self.clients.claim()
  ]));
});

function isSensitive(url) {
  return /\/logs|\/messages|\/conversations|\/api-keys|\/environment|\/secrets|\/webhooks/i.test(url.pathname);
}

function isSafeOperationalRead(request, url) {
  if (request.method !== "GET" || isSensitive(url)) return false;
  return SAFE_ROUTES.some((route) => url.pathname === route || url.pathname.startsWith(`${route}/`));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== "GET") return;

  if (request.mode === "navigate") {
    if (isSensitive(url)) {
      event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
      return;
    }
    if (isSafeOperationalRead(request, url)) {
      event.respondWith(fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(RUNTIME).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => caches.match(request).then((cached) => cached || caches.match("/dashboard"))));
      return;
    }
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  if (["style", "script", "font", "image"].includes(request.destination)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(RUNTIME).then((cache) => cache.put(request, response.clone()));
      return response;
    })));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_PRIVATE_DATA") {
    event.waitUntil(caches.delete(RUNTIME));
  }
});

self.addEventListener("push", (event) => {
  let payload = { type: "security_alert", severity: "critical", resource: "/dashboard" };
  try { payload = { ...payload, ...event.data.json() }; } catch {}
  const labels = {
    deployment_complete: "Deployment completed",
    deployment_failed: "Deployment failed",
    webhook_failure: "Webhook delivery failed",
    quota_warning: "Usage quota warning",
    billing_reminder: "Billing reminder",
    security_alert: "Security alert"
  };
  event.waitUntil(self.registration.showNotification(labels[payload.type] || "Whatsnot alert", {
    body: "Open Whatsnot to review this operational update.",
    icon: "/icons/icon-192.png",
    badge: "/icons/monochrome-96.png",
    tag: `${payload.type}:${payload.resource}`,
    data: { url: payload.resource || "/dashboard" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.focus().then(() => existing.navigate(target));
    return clients.openWindow(target);
  }));
});

self.addEventListener("sync", (event) => {
  if (event.tag === "whatsnot-safe-actions") {
    event.waitUntil(self.clients.matchAll().then((windows) => windows.forEach((client) => client.postMessage({ type: "SYNC_SAFE_ACTIONS" }))));
  }
});
