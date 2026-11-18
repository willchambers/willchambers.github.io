// Retires the old Photostream at /photostream/. The app moved to
// /photos/photostream/ on 2026-11-18 (github.com/willchambers/photos).
//
// The old app registers /photostream/sw.js on every launch, so the browser
// fetches this file and replaces the old worker with it. This worker:
// - has no fetch handler, so every request goes to the network, where
//   /photostream/ is now a redirect page;
// - sends any open old-app window to the new address, keeping its #hash;
// - then unregisters itself.
// It deletes no caches (the new app uses the same cache names on this origin)
// and touches no storage.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: "window" });
    await Promise.all(windows.map((client) =>
      client.navigate(`/photos/photostream/${new URL(client.url).hash}`).catch(() => {}),
    ));
    await self.registration.unregister();
  })());
});
