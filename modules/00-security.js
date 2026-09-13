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
        const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
        mostrarNotificacionToast(
          esIngles
            ? '🛡️ Printing blocked for data protection (Law 1581 of 2012). View contacts on screen.'
            : '🛡️ Impresión bloqueada por protección de datos (Ley 1581 de 2012). Consulta tus contactos en pantalla.',
          'warning'
        );
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

/**
 * Guarda una cookie segura en el navegador con directivas OWASP (SameSite=Lax, Secure en HTTPS).
 * @param {string} nombre
 * @param {string} valor
 * @param {number} [dias=365]
 */
function guardarCookieSegura(nombre, valor, dias = 365) {
  if (typeof document === 'undefined' || !nombre) return;
  const nombreSeguro = encodeURIComponent(String(nombre).trim());
  const valorSeguro = encodeURIComponent(String(valor || '').trim());
  let expiracion = '';
  if (dias > 0) {
    const d = new Date();
    d.setTime(d.getTime() + (dias * 24 * 60 * 60 * 1000));
    expiracion = `; expires=${d.toUTCString()}; max-age=${dias * 86400}`;
  } else if (dias < 0) {
    expiracion = '; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';
  }
  const esHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
  const flagSecure = esHttps ? '; Secure' : '';
  document.cookie = `${nombreSeguro}=${valorSeguro}${expiracion}; path=/; SameSite=Lax${flagSecure}`;
}

/**
 * Recupera el valor de una cookie segura por su nombre.
 * @param {string} nombre
 * @returns {string|null}
 */
function obtenerCookieSegura(nombre) {
  if (typeof document === 'undefined' || !nombre) return null;
  const nombreClave = encodeURIComponent(String(nombre).trim()) + '=';
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (let c of cookies) {
    c = c.trim();
    if (c.indexOf(nombreClave) === 0) {
      try {
        return decodeURIComponent(c.substring(nombreClave.length));
      } catch (e) {
        return c.substring(nombreClave.length);
      }
    }
  }
  return null;
}

/**
 * Elimina una cookie segura expirando su fecha de inmediato.
 * @param {string} nombre
 */
function borrarCookieSegura(nombre) {
  guardarCookieSegura(nombre, '', -1);
}

/**
 * Retorna el tema actual configurado en el DOM o en persistencia.
 * @returns {'dark'|'light'}
 */
function obtenerTemaActual() {
  if (typeof document !== 'undefined' && document.documentElement) {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  try {
    const local = localStorage.getItem('hunter_theme');
    if (local === 'light' || local === 'dark') return local;
  } catch (e) {}
  const c = obtenerCookieSegura('origgo_theme');
  if (c === 'light' || c === 'dark') return c;
  return 'dark';
}

/**
 * Aplica un tema ('dark'|'light') con aceleración GPU (View Transitions) y persistencia en cookie.
 * @param {'dark'|'light'} nuevoTema
 */
function aplicarTema(nuevoTema) {
  if (nuevoTema !== 'dark' && nuevoTema !== 'light') return;
  const actual = obtenerTemaActual();
  if (actual === nuevoTema) return;

  const mutar = () => {
    document.documentElement.setAttribute('data-theme', nuevoTema);
    if (typeof actualizarIconoTema === 'function') actualizarIconoTema(nuevoTema);
  };

  if (typeof ejecutarConTransicionSuave === 'function') {
    ejecutarConTransicionSuave(mutar);
  } else {
    mutar();
  }

  try { localStorage.setItem('hunter_theme', nuevoTema); } catch (e) {}
  guardarCookieSegura('origgo_theme', nuevoTema, 365);
}

/**
 * Sincroniza en segundo plano las preferencias de idioma y tema en cookie y en el servidor.
 * @param {string|null} [nuevoLang]
 * @param {string|null} [nuevoTheme]
 */
function sincronizarPreferenciasEnServidor(nuevoLang, nuevoTheme) {
  const lang = nuevoLang || (typeof obtenerIdiomaActual === 'function' ? obtenerIdiomaActual() : 'es');
  const theme = nuevoTheme || (typeof obtenerTemaActual === 'function' ? obtenerTemaActual() : 'dark');

  guardarCookieSegura('origgo_prefs', JSON.stringify({ lang, theme }), 365);
  if (nuevoLang) guardarCookieSegura('origgo_lang', nuevoLang, 365);
  if (nuevoTheme) guardarCookieSegura('origgo_theme', nuevoTheme, 365);

  const sesion = (typeof sesionUsuario !== 'undefined' && sesionUsuario) ? sesionUsuario : null;
  const token = sesion?.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('hunter_pro_token') : null);

  if (token) {
    fetch('/api/user/balance', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ preferredLang: lang, preferredTheme: theme })
    }).catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    guardarCookieSegura,
    obtenerCookieSegura,
    borrarCookieSegura,
    obtenerTemaActual,
    aplicarTema,
    sincronizarPreferenciasEnServidor
  });
}



