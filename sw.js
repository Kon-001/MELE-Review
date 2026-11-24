// Keeps the app itself available without internet. It stores no questions and no one's work.
const CACHE = "mele-app-v2";
const SHELL = ["./", "index.html", "reviewer.html", "config.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: "reload" })))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), ms))]);

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Firebase SDK files (versioned URLs): keep forever once fetched
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // The app's own files: newest when online, saved copy when not
  if (url.origin === self.location.origin) {
    e.respondWith(caches.open(CACHE).then(async c => {
      try {
        const res = await withTimeout(fetch(req), 6000);
        if (res && res.ok) c.put(req, res.clone());
        return res;
      } catch {
        const hit = (await c.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? (await c.match("index.html")) || (await c.match("./")) : null);
        if (hit) return hit;
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }
    }));
  }
});
