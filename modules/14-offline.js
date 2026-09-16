/**
 * 📡 MÓDULO DE RESILIENCIA OFFLINE Y MONITOREO DE CONECTIVIDAD (modules/14-offline.js)
 * Detección instantánea de desconexión, banner contextual accesible,
 * sincronización reactiva al restaurar red y reporte al Perro Guardián.
 * Estándar Ecosistema Desmulta DevSecOps (< 500 líneas).
 */

let estadoConexionActivo = typeof navigator !== 'undefined' ? navigator.onLine : true;
let elementoBannerOffline = null;
let temporizadorOcultarBanner = null;

/**
 * Retorna si el dispositivo cuenta con conexión activa a internet.
 * @returns {boolean}
 */
function estaDispositivoOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

/**
 * Crea o localiza el contenedor del banner flotante de conectividad.
 * @returns {HTMLElement|null}
 */
function obtenerOCrearBannerOffline() {
  if (typeof document === 'undefined') return null;
  let banner = document.getElementById('offlineStatusBar');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offlineStatusBar';
    banner.className = 'offline-status-bar';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-atomic', 'true');
    banner.innerHTML = `
      <div class="offline-status-content">
        <span class="offline-status-icon" id="offlineStatusIcon"><i class="fa-solid fa-wifi"></i></span>
        <span class="offline-status-text" id="offlineStatusText">Modo sin conexión</span>
      </div>
    `;
    document.body.appendChild(banner);
  }
  return banner;
}

/**
 * Actualiza visualmente el banner según el estado de conectividad.
 * @param {boolean} online
 */
function actualizarBannerConectividad(online) {
  const banner = obtenerOCrearBannerOffline();
  if (!banner) return;

  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const iconEl = banner.querySelector('#offlineStatusIcon');
  const textEl = banner.querySelector('#offlineStatusText');

  if (temporizadorOcultarBanner) {
    clearTimeout(temporizadorOcultarBanner);
    temporizadorOcultarBanner = null;
  }

  if (!online) {
    // ESTADO OFFLINE (Alerta persistente y no invasiva)
    banner.classList.remove('status-online');
    banner.classList.add('status-offline', 'visible');

    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-plane-slash"></i>';
    if (textEl) {
      textEl.textContent = isEn
        ? 'Offline mode • Browsing local saved properties'
        : 'Modo sin conexión • Explorando inmuebles guardados en tu equipo';
    }

    // Reportar al Perro Guardián para observabilidad serverless
    if (typeof reportarFalloCliente === 'function') {
      try {
        reportarFalloCliente({
          tipo: 'CLIENT_OFFLINE_DETECTED',
          mensaje: 'El cliente pasó a estado offline',
          origen: 'modules/14-offline.js'
        });
      } catch (_) {}
    }
  } else {
    // ESTADO ONLINE RESTAURADO (Notificación transitoria de éxito)
    banner.classList.remove('status-offline');
    banner.classList.add('status-online', 'visible');

    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    if (textEl) {
      textEl.textContent = isEn
        ? 'Connection restored • Real-time catalog synced'
        : 'Conexión reestablecida • Catálogo sincronizado en tiempo real';
    }

    // Auto-ocultar tras 3.5 segundos
    temporizadorOcultarBanner = setTimeout(() => {
      banner.classList.remove('visible');
    }, 3500);

    // Intentar refrescar catálogo de fondo si está disponible
    if (typeof cargarCatalogoOportunidades === 'function') {
      try {
        cargarCatalogoOportunidades();
      } catch (_) {}
    }
  }
}

/**
 * Valida si una acción crítica (ej. compra de desbloqueos con pasarela Wompi)
 * puede ejecutarse o si debe ser protegida ante ausencia de red.
 * @param {string} [accionNombre]
 * @returns {boolean}
 */
function asegurarConexionParaAccion(accionNombre = 'esta_accion') {
  if (estaDispositivoOnline()) return true;

  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const mensaje = isEn
    ? '⚠️ You are currently offline. This operation requires an active internet connection. Please reconnect and retry.'
    : '⚠️ Te encuentras sin conexión a internet. Esta operación requiere conexión activa. Vuelve a intentarlo al recuperar señal.';

  if (typeof mostrarNotificacionToast === 'function') {
    mostrarNotificacionToast(mensaje, 'warning');
  }

  // Notificar al sistema de monitoreo
  if (typeof reportarFalloCliente === 'function') {
    try {
      reportarFalloCliente({
        tipo: 'OFFLINE_BLOCKED_ACTION',
        mensaje: `Acción '${accionNombre}' bloqueada por falta de conexión`,
        origen: 'modules/14-offline.js'
      });
    } catch (_) {}
  }

  return false;
}

/**
 * Inicializa los escuchadores globales de conectividad y Service Worker sync.
 */
function inicializarSoporteOffline() {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    estadoConexionActivo = true;
    actualizarBannerConectividad(true);
  });

  window.addEventListener('offline', () => {
    estadoConexionActivo = false;
    actualizarBannerConectividad(false);
  });

  // Si al iniciar la página el navegador ya está offline, presentar el banner
  if (!navigator.onLine) {
    actualizarBannerConectividad(false);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarSoporteOffline);
  } else {
    inicializarSoporteOffline();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    estaDispositivoOnline,
    actualizarBannerConectividad,
    asegurarConexionParaAccion,
    inicializarSoporteOffline
  };
}
