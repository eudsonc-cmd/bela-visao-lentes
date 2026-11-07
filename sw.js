// Guarda o aplicativo no celular para funcionar sem internet.
// Ao publicar uma versão nova, troque o número abaixo.
const VERSION = 'bv-lentes-v3';
const FILES = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];

// Baixa tudo direto do servidor (sem cache do navegador), para não guardar uma versão velha.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isPage = req => req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (isPage(req)) {
    // Página: com internet, sempre a mais nova; sem internet (ou rede lenta), a guardada.
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const net = await Promise.race([
          fetch(req.url.split('#')[0], { cache: 'no-cache' }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
        ]);
        if (net && net.ok) { cache.put('./index.html', net.clone()); return net; }
        throw new Error('bad');
      } catch (err) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }
  // Ícones e demais arquivos: os guardados primeiro.
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const net = await fetch(req);
    if (net && net.ok) cache.put(req, net.clone());
    return net;
  }));
});
