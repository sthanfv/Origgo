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

/**
 * Calcula una huella digital determinista del dispositivo (Device Fingerprint)
 * combinando hardware, motor gráfico, resolución, zona horaria y arquitectura.
 * 
 * @returns {Promise<string>} Hash SHA-256 de la huella digital
 */
async function obtenerDeviceFingerprint() {
  if (typeof window === 'undefined') return 'server_mock_device';

  // Caché en sesión de ventana para evitar recalcular innecesariamente
  if (window._origgoCachedDeviceId) return window._origgoCachedDeviceId;

  const componentes = [];

  try {
    // 1. Hardware y entorno de ejecución
    componentes.push(navigator.userAgent || '');
    componentes.push(navigator.language || '');
    componentes.push(navigator.hardwareConcurrency || 2);
    componentes.push(navigator.deviceMemory || 4);
    componentes.push(navigator.platform || '');
    componentes.push(screen.width + 'x' + screen.height + 'x' + screen.colorDepth);
    componentes.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');

    // 2. Huella gráfica Canvas 2D
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Origgo,DevSecOps 2026! 🏢', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Origgo,DevSecOps 2026! 🏢', 4, 17);
        componentes.push(canvas.toDataURL());
      }
    } catch (_) {}

    // 3. Huella WebGL (Tarjeta gráfica y renderer físico)
    try {
      const glCanvas = document.createElement('canvas');
      const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          componentes.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '');
          componentes.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
        }
      }
    } catch (_) {}
  } catch (err) {
    componentes.push('fallback_fingerprint_' + Math.random());
  }

  const huellaPlana = componentes.join('###');

  // Cálculo criptográfico con WebCrypto (SHA-256)
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      const encoder = new TextEncoder();
      const data = encoder.encode(huellaPlana);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      window._origgoCachedDeviceId = hashHex;
      return hashHex;
    }
  } catch (_) {}

  // Fallback determinista en entornos sin WebCrypto
  let hash = 0;
  for (let i = 0; i < huellaPlana.length; i++) {
    hash = ((hash << 5) - hash) + huellaPlana.charCodeAt(i);
    hash |= 0;
  }
  const fallbackId = 'dev_' + Math.abs(hash).toString(16).padStart(16, '0');
  window._origgoCachedDeviceId = fallbackId;
  return fallbackId;
}

/**
 * Comprueba de forma multicapa (Zombie Storage) si este dispositivo ya consumió su regalo de bienvenida.
 * Lee concurrentemente de localStorage y cookies para resistir borrados selectivos.
 * 
 * @returns {boolean}
 */
function esDispositivoMarcadoComoReclamado() {
  if (typeof window === 'undefined') return false;

  let reclamado = false;

  // 1. Chequeo en localStorage
  try {
    if (localStorage.getItem('origgo_device_claimed') === '1') {
      reclamado = true;
    }
  } catch (_) {}

  // 2. Chequeo en Cookies persistentes
  try {
    if (typeof document !== 'undefined' && document.cookie) {
      if (document.cookie.includes('origgo_device_claimed=1')) {
        reclamado = true;
      }
    }
  } catch (_) {}

  // Sincronización de auto-reparación Zombie si alguna capa fue purgada
  if (reclamado) {
    marcarDispositivoComoReclamado();
  }

  return reclamado;
}

/**
 * Persiste de forma indestructible (Zombie Storage) la marca de dispositivo que ya reclamó su regalo.
 * Escribe en localStorage y en una cookie de 10 años que no se elimina al cerrar sesión.
 * 
 * @param {string} [deviceId]
 */
function marcarDispositivoComoReclamado(deviceId) {
  if (typeof window === 'undefined') return;

  // 1. Persistencia en localStorage
  try {
    localStorage.setItem('origgo_device_claimed', '1');
    if (deviceId) {
      localStorage.setItem('origgo_device_id', String(deviceId));
    }
  } catch (_) {}

  // 2. Persistencia en Cookie con expiración a 10 años (inmune a cierre de sesión)
  try {
    if (typeof document !== 'undefined') {
      const diezAniosEnSegundos = 10 * 365 * 24 * 60 * 60;
      document.cookie = `origgo_device_claimed=1; max-age=${diezAniosEnSegundos}; path=/; SameSite=Lax`;
      if (deviceId) {
        document.cookie = `origgo_device_id=${encodeURIComponent(deviceId)}; max-age=${diezAniosEnSegundos}; path=/; SameSite=Lax`;
      }
    }
  } catch (_) {}
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      inicializarSoporteOffline();
      esDispositivoMarcadoComoReclamado();
    });
  } else {
    inicializarSoporteOffline();
    esDispositivoMarcadoComoReclamado();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    estaDispositivoOnline,
    actualizarBannerConectividad,
    asegurarConexionParaAccion,
    inicializarSoporteOffline,
    obtenerDeviceFingerprint,
    esDispositivoMarcadoComoReclamado,
    marcarDispositivoComoReclamado
  };
}
