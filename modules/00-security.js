/**
 * MÓDULO DE SEGURIDAD CLIENTE
 * Helpers compartidos para sanitizar texto, teléfonos y URLs antes de pintar HTML.
 */

const HOSTS_ANUNCIOS_PERMITIDOS = [
  'fincaraiz.com.co',
  'metrocuadrado.com',
  'tucarro.com.co',
  'mercadolibre.com.co'
];

const HOSTS_WHATSAPP_PERMITIDOS = [
  'wa.me',
  'api.whatsapp.com',
  'whatsapp.com'
];

/**
 * Sanitización de texto HTML para prevenir inyecciones.
 * @param {string} texto
 * @returns {string}
 */
function escaparHtml(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function hostPermitido(hostname, hostsPermitidos) {
  return hostsPermitidos.some(host => hostname === host || hostname.endsWith(`.${host}`));
}

/**
 * Sanitiza URLs controlables por datos/caché antes de insertarlas en atributos href.
 * @param {string|null|undefined} urlRaw
 * @param {string[]} hostsPermitidos
 * @returns {string}
 */
function sanitizarUrlCliente(urlRaw, hostsPermitidos) {
  const valor = String(urlRaw || '').trim();
  if (!valor) return '';

  try {
    const url = new URL(valor, window.location.origin);
    if (url.protocol !== 'https:') return '';
    if (!hostPermitido(url.hostname.toLowerCase(), hostsPermitidos)) return '';
    return escaparHtml(url.href);
  } catch (e) {
    return '';
  }
}

/**
 * Normaliza teléfonos a formato tel:+57XXXXXXXXXX sin caracteres de control.
 * @param {string|null|undefined} telefonoRaw
 * @returns {string}
 */
function sanitizarTelCliente(telefonoRaw) {
  const valor = String(telefonoRaw || '').trim();
  if (!valor) return '';
  const limpio = valor.replace(/[^\d+]/g, '');
  if (!/^\+?[0-9]{10,15}$/.test(limpio)) return '';
  return escaparHtml(limpio.startsWith('+') ? limpio : `+${limpio}`);
}

/**
 * Devuelve una copia segura del contacto antes de pintar enlaces o botones.
 * @param {object|null|undefined} contacto
 * @returns {object|null}
 */
function sanitizarContactoCliente(contacto) {
  if (!contacto || typeof contacto !== 'object') return null;
  return {
    ...contacto,
    whatsappUrl: sanitizarUrlCliente(contacto.whatsappUrl, HOSTS_WHATSAPP_PERMITIDOS),
    enlace: sanitizarUrlCliente(contacto.enlace, HOSTS_ANUNCIOS_PERMITIDOS),
    telLlamar: sanitizarTelCliente(contacto.telLlamar)
  };
}

function esEntornoDesarrolloCliente() {
  try {
    const host = window.location.hostname;
    return window.location.protocol === 'file:' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      window.location.search.includes('debug=origgo');
  } catch (e) {
    return false;
  }
}

/**
 * Registra diagnósticos solo en entornos de desarrollo para mantener F12 limpio en producción.
 * @param {'log'|'info'|'warn'|'error'|'debug'} nivel
 * @param {...unknown} args
 */
function registrarLogDesarrollo(nivel, ...args) {
  if (!esEntornoDesarrolloCliente()) return;
  try {
    const metodo = ['log', 'info', 'warn', 'error', 'debug'].includes(nivel) ? nivel : 'log';
    const consola = window.console;
    if (consola && typeof consola[metodo] === 'function') {
      consola[metodo](...args);
    }
  } catch (e) {
    // Sin acción: el registro nunca debe afectar la experiencia del usuario.
  }
}

/**
 * Ejecuta una mutación del DOM utilizando la View Transitions API nativa de W3C
 * para eliminar parpadeos, destellos o saltos bruscos (Cross-fade sedoso acelerado por GPU).
 * Si el navegador no soporta la API o el usuario tiene 'prefers-reduced-motion', se ejecuta directamente.
 * @param {Function} mutacionDOM - Callback con los cambios que alteran el DOM.
 * @returns {Promise<void>}
 */
function ejecutarConTransicionSuave(mutacionDOM) {
  if (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return document.startViewTransition(() => mutacionDOM()).finished;
  }
  return Promise.resolve(mutacionDOM());
}

/**
 * Intercepta y neutraliza atajos de teclado de impresión masiva (Ctrl+P / Cmd+P)
 * para proteger los datos de contacto de los propietarios conforme a la Ley 1581 de 2012.
 */
function inicializarProteccionAntiImpresion() {
  if (typeof window === 'undefined') return;
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      if (typeof mostrarNotificacionToast === 'function') {
        mostrarNotificacionToast('🛡️ Impresión bloqueada por protección de datos (Ley 1581 de 2012). Consulta tus contactos en pantalla.', 'warning');
      }
    }
  });
}

// Memoria volátil de deduplicación de reportes (evita spam ante bucles de error)
const erroresReportadosRecientemente = new Map();

/**
 * Despacha un informe de anomalía o fallo de red/render hacia el Perro Guardián (/api/telemetry/report).
 * @param {object} params
 * @param {string} params.tipo
 * @param {string} params.mensaje
 * @param {string} [params.origen]
 * @param {string} [params.stack]
 */
function reportarFalloCliente({ tipo = 'ERROR_CLIENTE', mensaje = '', origen = 'interfaz_web', stack = '' } = {}) {
  if (typeof window === 'undefined') return;

  const msgStr = String(mensaje || '').slice(0, 500);
  const stackStr = String(stack || '').slice(0, 1500);

  // Ignorar errores ajenos introducidos por extensiones de terceros
  if (stackStr.includes('extension://') || msgStr.includes('extension://')) return;

  // Deduplicación en ventana de 60 segundos
  const claveError = `${tipo}:${msgStr}`;
  const ahora = Date.now();
  const ultimoEnvio = erroresReportadosRecientemente.get(claveError) || 0;
  if (ahora - ultimoEnvio < 60000) return;
  erroresReportadosRecientemente.set(claveError, ahora);

  // Limpiar memoria si el mapa crece demasiado
  if (erroresReportadosRecientemente.size > 50) {
    erroresReportadosRecientemente.clear();
  }

  const payload = JSON.stringify({
    tipo,
    mensaje: msgStr,
    origen,
    stack: stackStr,
    url: window.location.href,
    timestamp: ahora
  });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/telemetry/report', blob);
      return;
    }
  } catch (_) {}

  try {
    fetch('/api/telemetry/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(() => {});
  } catch (_) {}
}

/**
 * Inicializa los escuchadores globales de excepciones no capturadas y promesas rechazadas.
 */
function inicializarPerroGuardian() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (e) => {
    reportarFalloCliente({
      tipo: 'UNCAUGHT_ERROR',
      mensaje: e.message || 'Error no capturado en script',
      origen: e.filename ? `${e.filename}:${e.lineno || 0}` : 'window.onerror',
      stack: e.error ? (e.error.stack || '') : ''
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const razon = e.reason;
    const msg = razon instanceof Error ? razon.message : String(razon || 'Promesa rechazada sin capturar');
    const st = razon instanceof Error ? (razon.stack || '') : '';
    reportarFalloCliente({
      tipo: 'UNHANDLED_REJECTION',
      mensaje: msg,
      origen: 'window.onunhandledrejection',
      stack: st
    });
  });
}

