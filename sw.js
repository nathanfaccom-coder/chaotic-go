// Chaotic GO — atualização segura: não armazenar telas autenticadas em cache.
const CACHE = 'chaotic-go-release-20261030-28';
const FILES = ['./index.html','./style.css','./cartas.js','./logo.png','./manifest.json'];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(
    FILES.map(path => cache.add(path).catch(() => {}))
  )));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(names => Promise.all(
      names.filter(name => name.startsWith('chaotic-go-') && name !== CACHE).map(name=>caches.delete(name))
    ))
  ]));
});
self.addEventListener('fetch', event => {
  const request=event.request, url=new URL(request.url);
  if(request.method!=='GET' || url.origin!==self.location.origin) return;
  // Não permitir que versões antigas de login, scanner ou JS autenticado
  // sejam reaproveitadas. Esses arquivos sempre exigem conexão atual.
  if(request.mode==='navigate' || /\.(?:js|html)$/i.test(url.pathname)) return;
  event.respondWith(fetch(request).then(response=>{
    if(response.ok && response.type==='basic') {
      const clone=response.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,clone)));
    }
    return response;
  }).catch(()=>caches.match(request)));
});