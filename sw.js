const CACHE_NAME = "cal-training-v73";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=73",
  "./app.js?v=73",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Network-first sin caché HTTP obsoleta; nunca cachear version.json ni Google Apps Script
self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (
    event.request.method !== "GET" ||
    url.includes("version.json") ||
    url.includes("script.google.com") ||
    url.includes("script.googleusercontent.com") ||
    url.includes("googleapis.com") ||
    url.includes("accounts.google.com")
  ) {
    return;
  }
  event.respondWith(
    fetch(event.request, { cache: "no-cache" })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
