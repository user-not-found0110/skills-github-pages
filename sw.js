// This tool has been retired. When a phone that still has it installed checks
// for updates, this worker deletes the tool's offline copy and removes itself,
// then reloads any open window so nothing of the old tool keeps running.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(n => /^splash-(pw|content|followup|leads|agent|pace|weather)-v\d+$/.test(n))
      .map(n => caches.delete(n)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    windows.forEach(w => w.navigate(w.url));
  })());
});
