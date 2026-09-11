/**
 * ⚡ SERVICE WORKER PWA — ORIGGO
 * Caché ultra-liviano para instalación nativa y aceleración en Android/iOS
 */

const NOMBRE_CACHE = 'origgo-v5';
const RECURSOS_CRITICOS = [
  './',
  './index.html',
  './style.min.css',
  './app.js',
  './app.min.js',
  './data/inmobiliario.json',
  './manifest.json',
  './favicon.svg',
  './favicon.ico',
  './favicon-32x32.png',
  './apple-touch-icon.png',
  './assets/img/push-icon-192.png',
  './assets/img/push-icon-512.png',
  './assets/img/origgo-icon.svg'
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
  // Solo interceptar peticiones GET
  if (evento.request.method !== 'GET') return;

  const url = new URL(evento.request.url);

  // Las peticiones a APIs serverless y CDNs externos deben ir directo a la red
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return;

  // Estrategia Cache-First con revalidación en red para recursos locales
  evento.respondWith(
    caches.match(evento.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(evento.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(NOMBRE_CACHE).then((cache) => cache.put(evento.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(evento.request);
    })
  );
});

// ═════════════════════════════════════════════════════════════════════════
// 🔔 EVENTOS DE WEB PUSH NOTIFICATIONS
// ═════════════════════════════════════════════════════════════════════════

self.addEventListener('push', (evento) => {
  let datos = {
    title: 'Nueva Oportunidad Directa — Origgo',
    body: 'Se acaba de detectar un nuevo inmueble sin comisiones.',
    icon: './apple-touch-icon.png',
    badge: './favicon-32x32.png',
    data: { url: './' }
  };

  if (evento.data) {
    try {
      datos = { ...datos, ...evento.data.json() };
    } catch (_) {
      datos.body = evento.data.text();
    }
  }

  const opciones = {
    body: datos.body,
    icon: datos.icon || './apple-touch-icon.png',
    badge: datos.badge || './favicon-32x32.png',
    vibrate: [100, 50, 100],
    data: datos.data || { url: './' },
    actions: [
      { action: 'open', title: 'Ver Oportunidad' }
    ]
  };

  if (datos.image) {
    opciones.image = datos.image;
  }

  evento.waitUntil(
    self.registration.showNotification(datos.title, opciones)
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const urlDestino = evento.notification.data?.url || './';

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
      for (const cliente of clientes) {
        if (cliente.url && 'focus' in cliente) {
          return cliente.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlDestino);
      }
    })
  );
});
