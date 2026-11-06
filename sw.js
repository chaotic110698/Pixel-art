// Service worker : fonctionnement hors ligne.
// Pensez à incrémenter VERSION à chaque mise en ligne et à régénérer la liste
// avec : node scripts/sw-files.mjs --write
const VERSION = 'v6';
const CACHE = 'pixel-atelier-' + VERSION;
const PRECACHE = [
  "./",
  "./index.html",
  "./capture.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/core/doc.js",
  "./js/core/history.js",
  "./js/core/image-ops.js",
  "./js/core/layer-ops.js",
  "./js/core/palettes.js",
  "./js/core/raster.js",
  "./js/core/selection.js",
  "./js/export/export-ui.js",
  "./js/export/exporter.js",
  "./js/export/gif.js",
  "./js/export/png.js",
  "./js/export/render.js",
  "./js/export/zip.js",
  "./js/library/builder.js",
  "./js/library/character.js",
  "./js/library/library-ui.js",
  "./js/library/library.js",
  "./js/library/parts/accessories.js",
  "./js/library/parts/bodies.js",
  "./js/library/parts/brows.js",
  "./js/library/parts/eyes.js",
  "./js/library/parts/hair.js",
  "./js/library/parts/heads.js",
  "./js/library/parts/mouths.js",
  "./js/library/parts/noses.js",
  "./js/library/parts/tops.js",
  "./js/main.js",
  "./js/pngtuber/assets.js",
  "./js/pngtuber/capture.js",
  "./js/pngtuber/engine.js",
  "./js/pngtuber/pngtuber.js",
  "./js/pngtuber/standalone.js",
  "./js/render/celcache.js",
  "./js/render/compose.js",
  "./js/render/renderer.js",
  "./js/render/viewport.js",
  "./js/storage/db.js",
  "./js/storage/project-file.js",
  "./js/storage/projects-ui.js",
  "./js/storage/serialize.js",
  "./js/storage/storage.js",
  "./js/tools/index.js",
  "./js/tools/paint-tools.js",
  "./js/tools/painter.js",
  "./js/tools/select-tools.js",
  "./js/tools/shape-tools.js",
  "./js/ui/actions.js",
  "./js/ui/colors-panel.js",
  "./js/ui/dialogs.js",
  "./js/ui/expressions-panel.js",
  "./js/ui/grid-panel.js",
  "./js/ui/icons.js",
  "./js/ui/input.js",
  "./js/ui/layers-panel.js",
  "./js/ui/menu.js",
  "./js/ui/shortcuts.js",
  "./js/ui/timeline.js",
  "./js/ui/toolbar.js",
  "./js/ui/tutorial.js",
  "./js/util/color.js",
  "./js/util/dom.js",
  "./js/util/emitter.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' : contourne le cache HTTP du navigateur pour obtenir les fichiers à jour
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pixel-atelier-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate pour les fichiers de l'application (même origine).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      return Response.error();
    }),
  );
});
