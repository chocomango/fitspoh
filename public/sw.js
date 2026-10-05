const VERSION = "fitspoh-shell-v1";
const MEDIA = "fitspoh-media-v1";
const root = new URL("./", self.location).href;
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await cache.addAll([
        root,
        root + "index.html",
        root + "icon.svg",
        root + "icon-192.png",
        root + "icon-512.png",
        root + "manifest.webmanifest",
      ]);
      const shell = await cache.match(root + "index.html");
      const html = await shell.text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => new URL(m[1], root))
        .filter(
          (url) =>
            url.origin === self.location.origin &&
            url.pathname.includes("/assets/"),
        )
        .map((url) => url.href);
      await cache.addAll(assets);
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("fitspoh-shell-") && name !== VERSION)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const media = url.pathname.includes("/exercises/");
      const cache = await caches.open(media ? MEDIA : VERSION);
      if (media) {
        const stored = await cache.match(request);
        if (stored) return stored;
      }
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        const stored = await cache.match(request);
        if (stored) return stored;
        if (request.mode === "navigate") {
          const shell = await cache.match(root + "index.html");
          if (shell) return shell;
        }
        return new Response(
          "Offline: this guide has not been downloaded yet.",
          { status: 503 },
        );
      }
    })(),
  );
});
