// Chaotic GO — cache exclusivamente de recursos públicos e imutáveis da interface.
// Nunca persistir respostas de sessão, APIs, arquivos privados ou URLs com parâmetros.
const CACHE = 'chaotic-go-release-20261111-132';
const PUBLIC_ASSETS = new Set([
  '/index.html', '/style.css', '/cartas.js', '/logo.png', '/manifest.json'
]);
const scopedPath = path => new URL(path, self.registration.scope).pathname;
const allowedAssets = new Set([...PUBLIC_ASSETS].map(path => scopedPath('.' + path)));
// Apenas recursos estáticos não executáveis podem ser mantidos offline.
const offlineAssets = [...allowedAssets].filter(path => /\.(?:png|css|json)$/i.test(path));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await Promise.all(offlineAssets
      .map(path => cache.add(new Request(path, {cache:'reload'})).catch(() => {})));
    await self.skipWaiting();
  }));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(names => Promise.all(
      names.filter(name => name.startsWith('chaotic-go-') && name !== CACHE)
        .map(name => caches.delete(name))
    ))
  ]));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode === 'navigate' || request.headers.has('Authorization')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.search || url.hash) return;
  if (!allowedAssets.has(url.pathname)) return;
  // JS/HTML exigem rede para não executar versões antigas após login/atualização.
  if (!offlineAssets.includes(url.pathname)) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  }).catch(() => caches.match(request)));
});
