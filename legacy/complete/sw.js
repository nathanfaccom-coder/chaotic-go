// ==========================================
// SERVICE WORKER - MODO: INTERNET PRIMEIRO
// ==========================================
const CACHE_NAME = 'chaotic-go-dinamico-v2';

const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './scanner.html',
  './style.css',
  './cartas.js',
  './logo.png',
  './manifest.json'
];

// INSTALAÇÃO: Força o novo Service Worker a assumir o controle na hora
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// ATIVAÇÃO: Limpa os caches velhos fantasmas
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// INTERCEPTADOR (A Mágica): Tenta a Internet primeiro. Se falhar (offline), usa o Cache.
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(respostaInternet => {
        // Deu certo! Tem internet. Vamos salvar um clone invisível no cache para a próxima vez.
        const cloneParaCache = respostaInternet.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, cloneParaCache);
        });
        return respostaInternet; // Entrega o arquivo novinho para o jogo
      })
      .catch(() => {
        // Falhou! O jogador está sem internet. Puxa do Cache Fantasma!
        return caches.match(event.request);
      })
  );
});
