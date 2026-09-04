/**
 * ⚡ SERVICE WORKER PWA — HUNTER PRO INTELLIGENCE
 * Caché ultra-liviano para instalación nativa y aceleración en Android/iOS
 */

const NOMBRE_CACHE = 'hunter-pro-v14';
const RECURSOS_CRITICOS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './favicon.svg',
  './assets/img/hunter_radar_logo.svg'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then((cache) => {
      return cache.addAll(RECURSOS_CRITICOS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) => {
      return Promise.all(
        claves.filter((k) => k !== NOMBRE_CACHE).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  // Estrategia Network-First con fallback inmediato a caché
  evento.respondWith(
    fetch(evento.request).catch(() => caches.match(evento.request))
  );
});
