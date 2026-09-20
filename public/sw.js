/**
 * ⚡ SERVICE WORKER PWA — ORIGGO (sw.js)
 * Estrategia de Caché Resiliente Offline-First, Partición de Imágenes LRU,
 * Stale-While-Revalidate y Alertas Web Push Interactivas.
 * Estándar Ecosistema Desmulta DevSecOps.
 */

const NOMBRE_CACHE_CORE = 'origgo-core-v14-20260920';
const NOMBRE_CACHE_IMGS = 'origgo-images-v14';
const LIMITE_MAXIMO_IMAGENES_CACHE = 60;

const RECURSOS_CRITICOS = [
  '/',
  '/index.html',
  '/data/inmobiliario.json',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/origgo-style.min.css',
  '/404.html'
];

/**
 * Placeholder SVG vectorial incrustado en data-URI para contingencia total offline.
 * Garantiza que ante desconexión o fallo de CDN, la interfaz jamás muestre imágenes rotas.
 */
const FALLBACK_INMUEBLE_SVG = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">' +
  '<defs>' +
    '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#0b131e"/>' +
      '<stop offset="50%" stop-color="#111b2b"/>' +
      '<stop offset="100%" stop-color="#060a11"/>' +
    '</linearGradient>' +
    '<radialGradient id="glow" cx="50%" cy="45%" r="55%">' +
      '<stop offset="0%" stop-color="#10b981" stop-opacity="0.22"/>' +
      '<stop offset="100%" stop-color="#10b981" stop-opacity="0"/>' +
    '</radialGradient>' +
  '</defs>' +
  '<rect width="800" height="500" fill="url(#bg)"/>' +
  '<rect width="800" height="500" fill="url(#glow)"/>' +
  '<g transform="translate(400, 215)" text-anchor="middle">' +
    '<circle cx="0" cy="-10" r="50" fill="#10b981" fill-opacity="0.08" stroke="#10b981" stroke-width="2" stroke-dasharray="5 3"/>' +
    '<path d="M-26 10 L0 -16 L26 10 L17 10 L17 28 L-17 28 L-17 10 Z" fill="none" stroke="#10b981" stroke-width="3" stroke-linejoin="round"/>' +
    '<rect x="-6" y="14" width="12" height="14" fill="#10b981" fill-opacity="0.3" rx="1"/>' +
    '<text y="78" fill="#e2e8f0" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="2.5">ORIGGO DIRECT</text>' +
    '<text y="100" fill="#64748b" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="500" letter-spacing="1">MODO OFFLINE DISPONIBLE</text>' +
  '</g>' +
  '</svg>'
);

/**
 * Control de cuota de almacenamiento: Purga LRU en partición de imágenes.
 * @param {string} nombreCache
 * @param {number} maxItems
 */
async function purgarExcesoCache(nombreCache, maxItems = LIMITE_MAXIMO_IMAGENES_CACHE) {
  try {
    const cache = await caches.open(nombreCache);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const cantidadAEliminar = keys.length - maxItems;
      for (let i = 0; i < cantidadAEliminar; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (_) {}
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE_CORE).then((cache) => {
      return Promise.allSettled(
        RECURSOS_CRITICOS.map((recurso) =>
          cache.add(recurso).catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  const cachesPermitidas = [NOMBRE_CACHE_CORE, NOMBRE_CACHE_IMGS];
  evento.waitUntil(
    caches.keys().then((claves) => {
      return Promise.all(
        claves
          .filter((k) => !cachesPermitidas.includes(k))
          .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(evento.request.url);
  } catch (_) {
    return;
  }

  // Ignorar protocolos no soportados (chrome-extension, data, etc.)
  if (!url.protocol.startsWith('http')) return;

  // NO INTERCEPTAR jamás servicios de traducción de Google, gstatic o telemetría externa
  if (url.hostname.includes('translate') ||
      url.hostname.includes('gstatic.com') ||
      url.hostname.includes('google.com') ||
      url.hostname.includes('googleapis.com')) {
    return;
  }

  // APIs serverless mutables o endpoints de pago: directo a red sin cachear jamás secretos
  if (url.pathname.startsWith('/api/payments/') ||
      url.pathname.startsWith('/api/auth/') ||
      url.pathname.startsWith('/api/user/') ||
      url.pathname.startsWith('/api/support') ||
      url.pathname.startsWith('/api/telemetry') ||
      url.pathname.startsWith('/api/leads/ingest') ||
      url.pathname.startsWith('/api/leads/unlock')) {
    return;
  }

  // 1. GESTIÓN DE IMÁGENES: Solo cachear imágenes locales del propio origen
  const esImagen = evento.request.destination === 'image' ||
    url.pathname.match(/\.(jpg|jpeg|png|webp|svg|gif|avif)$/i);

  // Si la imagen proviene de portales externos (Metrocuadrado, FincaRaiz, etc.), NO INTERCEPTAR.
  // El navegador la carga limpiamente con <img> nativo sin restricciones de connect-src.
  if (esImagen && url.origin !== self.location.origin) {
    return;
  }

  if (esImagen) {
    evento.respondWith(
      caches.open(NOMBRE_CACHE_IMGS).then(async (imgCache) => {
        const respuestaCache = await imgCache.match(evento.request);
        if (respuestaCache) {
          // Revalidación en segundo plano no bloqueante si hay red
          fetch(evento.request).then((redResp) => {
            if (redResp && (redResp.status === 200 || redResp.type === 'opaque')) {
              imgCache.put(evento.request, redResp.clone());
              purgarExcesoCache(NOMBRE_CACHE_IMGS, LIMITE_MAXIMO_IMAGENES_CACHE);
            }
          }).catch(() => {});
          return respuestaCache;
        }

        try {
          const redResp = await fetch(evento.request);
          if (redResp && (redResp.status === 200 || redResp.type === 'opaque')) {
            imgCache.put(evento.request, redResp.clone());
            purgarExcesoCache(NOMBRE_CACHE_IMGS, LIMITE_MAXIMO_IMAGENES_CACHE);
          }
          return redResp;
        } catch (_) {
          // Fallback ultra-seguro offline en imagen
          return new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500"><rect width="800" height="500" fill="#0b131e"/><text x="50%" y="50%" fill="#10b981" font-family="sans-serif" font-size="14" text-anchor="middle" font-weight="700">ORIGGO • IMAGEN OFFLINE</text></svg>`,
            { headers: { 'Content-Type': 'image/svg+xml;charset=utf-8' } }
          );
        }
      })
    );
    return;
  }

  // 2. ENDPOINT DE CONSULTA DE LEADS: Stale-While-Revalidate con Fallback a JSON local
  if (url.pathname === '/api/leads/list' || url.pathname.endsWith('/data/inmobiliario.json')) {
    evento.respondWith(
      caches.open(NOMBRE_CACHE_CORE).then(async (coreCache) => {
        const enCache = await coreCache.match(evento.request);
        const promesaRed = fetch(evento.request).then((redResp) => {
          if (redResp && redResp.status === 200) {
            coreCache.put(evento.request, redResp.clone());
          }
          return redResp;
        }).catch(async () => {
          if (enCache) return enCache;
          // Si falló api/leads/list, intentar servir el dataset local empaquetado
          const localJson = await coreCache.match('./data/inmobiliario.json');
          if (localJson) return localJson;
          return new Response(JSON.stringify({ ok: true, leads: [], total: 0, offline: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        });

        return enCache || promesaRed;
      })
    );
    return;
  }

  // 3. NAVEGACIÓN HTML Y ACTIVOS FUNCIONALES (CSS, JS)
  const esNavegacionOActivo = evento.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js');

  if (esNavegacionOActivo && url.origin === self.location.origin) {
    evento.respondWith(
      fetch(evento.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copia = networkResponse.clone();
          caches.open(NOMBRE_CACHE_CORE).then((cache) => cache.put(evento.request, copia));
        }
        return networkResponse;
      }).catch(async () => {
        const enCache = await caches.match(evento.request);
        if (enCache) return enCache;
        if (evento.request.mode === 'navigate') {
          return (await caches.match('./index.html')) || (await caches.match('./404.html'));
        }
        return new Response('/* Offline fallback */', { headers: { 'Content-Type': 'text/javascript' } });
      })
    );
    return;
  }

  // 4. RESTO DE RECURSOS ESTÁTICOS (EXCLUSIVO PARA EL MISMO ORIGEN)
  if (url.origin !== self.location.origin) {
    return; // No interceptar recursos de orígenes externos
  }

  evento.respondWith(
    caches.match(evento.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(evento.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(NOMBRE_CACHE_CORE).then((cache) => cache.put(evento.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(evento.request).catch(() => new Response('', { status: 408 }));
    }).catch(() => new Response('', { status: 408 }))
  );
});

// ═════════════════════════════════════════════════════════════════════════
// 🔔 EVENTOS DE WEB PUSH NOTIFICATIONS (RICH PUSH & QUICK ACTIONS)
// ═════════════════════════════════════════════════════════════════════════

self.addEventListener('push', (evento) => {
  let datos = {
    title: 'Nueva Oportunidad Directa — Origgo',
    body: 'Se acaba de detectar un nuevo inmueble sin comisiones.',
    icon: './apple-touch-icon.png',
    badge: './favicon-32x32.png',
    vibrate: [200, 100, 200, 100, 250],
    renotify: true,
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
    vibrate: datos.vibrate || [200, 100, 200, 100, 250],
    tag: datos.tag || (datos.data?.leadId ? `origgo-lead-${datos.data.leadId}` : 'origgo-alert'),
    renotify: datos.renotify !== false,
    requireInteraction: Boolean(datos.requireInteraction),
    data: datos.data || { url: './' },
    actions: datos.actions || [
      { action: 'explore', title: '🔍 Ver Oportunidad' }
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
  const accion = evento.action;
  const data = evento.notification.data || {};

  if (accion === 'whatsapp' && data.whatsappUrl) {
    evento.waitUntil(self.clients.openWindow(data.whatsappUrl));
    return;
  }

  if (accion === 'external' && data.externalUrl) {
    evento.waitUntil(self.clients.openWindow(data.externalUrl));
    return;
  }

  const urlDestino = data.url || './';

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
      for (const cliente of clientes) {
        if (cliente.url && 'focus' in cliente) {
          if (cliente.postMessage) {
            cliente.postMessage({
              tipo: 'ORIGGO_PUSH_CLICK',
              leadId: data.leadId || null,
              url: urlDestino
            });
          }
          if (typeof cliente.navigate === 'function' && urlDestino !== './') {
            cliente.navigate(urlDestino);
          }
          return cliente.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlDestino);
      }
    })
  );
});
