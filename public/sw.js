/*
 * Oya service worker (SPEC §14.8), kept deliberately small (D-021):
 *  - precaches /help/emergency (static, works without JavaScript) so emergency numbers load with no network;
 *  - caches built static assets (/_next/static, immutable) so cached pages render styled offline;
 *  - network-first for everything else; a failed page navigation falls back to the emergency page.
 * Personal pages (/app, /ops) and API responses are never cached.
 */
const VERSION = "oya-v1";
const SHELL = ["/help/emergency", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match("/help/emergency")) || Response.error()),
    );
  }
});
