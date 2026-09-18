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
    // ✅ HAL-04: El parámetro de depuración por URL fue eliminado — no se puede activar debug desde producción.
    return window.location.protocol === 'file:' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1';
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
  if (typeof mutacionDOM !== 'function') return Promise.resolve();
  const sinTransicion = typeof document === 'undefined' || !('startViewTransition' in document) ||
    (typeof window !== 'undefined' && window.self !== window.top) || (document.hidden) ||
    (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (sinTransicion) {
    try { mutacionDOM(); } catch (e) { console.warn('[DOM] Error mutación:', e); }
    return Promise.resolve();
  }
  try {
    const t = document.startViewTransition(() => {
      try { return mutacionDOM(); } catch (err) { console.warn('[ViewTransition] Error:', err); }
    });
    if (t) {
      if (t.ready && typeof t.ready.catch === 'function') t.ready.catch(() => {});
      if (t.updateCallbackDone && typeof t.updateCallbackDone.catch === 'function') t.updateCallbackDone.catch(() => {});
      if (t.finished && typeof t.finished.catch === 'function') return t.finished.catch(() => null);
    }
    return Promise.resolve();
  } catch (_) {
    try { mutacionDOM(); } catch (e) {}
    return Promise.resolve();
  }
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

    // Descartar abortos benignos de View Transitions o cancelaciones normales de red
    if (
      msg.includes('Transition was aborted') ||
      msg.includes('DOM update timed out') ||
      (razon && (razon.name === 'AbortError' || razon.code === 20))
    ) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      return;
    }

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
  if (typeof obtenerCookieSegura === 'function') {
    const c = obtenerCookieSegura('origgo_theme');
    if (c === 'light' || c === 'dark') return c;
    try {
      const p = JSON.parse(obtenerCookieSegura('origgo_prefs') || '{}');
      if (p.theme === 'light' || p.theme === 'dark') return p.theme;
    } catch (_) {}
  }
  return 'light';
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

  if (typeof sesionUsuario !== 'undefined' && sesionUsuario) {
    if (lang) sesionUsuario.preferredLang = lang;
    if (theme) sesionUsuario.preferredTheme = theme;
  }

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

/**
 * Genera un UUID v4 criptográficamente seguro para idempotencia y trazabilidad.
 * Compatible con window.crypto y fallback RFC4122.
 * @returns {string} UUID v4
 */
function generarUUIDv4() {
  const c = typeof window !== 'undefined' ? (window.crypto || window.msCrypto) : null;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const b = new Uint8Array(16);
    c.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.random() * 16 | 0;
    return (ch === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Resuelve un desafío criptográfico Proof-of-Work en el navegador mediante Web Crypto API.
 * @param {object} challenge
 * @param {string} challenge.salt
 * @param {number} challenge.dificultad
 * @returns {Promise<number>} Nonce que satisface la dificultad
 */
async function resolverDesafioPoWNavegador(challenge) {
  if (!challenge || !challenge.salt) return 0;
  const dif = parseInt(challenge.dificultad, 10) || 3;
  const prefijoRequerido = '0'.repeat(dif);
  const salt = challenge.salt;

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    let nonce = 0;
    while (nonce < 1000000) {
      const data = encoder.encode(`${salt}:${nonce}`);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      if (hashHex.startsWith(prefijoRequerido)) {
        return nonce;
      }
      nonce++;
    }
  }
  return 0;
}

/**
 * Obtiene y resuelve de forma invisible un desafío de seguridad para login.
 * @returns {Promise<{ securityChallenge?: object, turnstileToken?: string }>}
 */
async function obtenerDesafioSeguridadResuelto() {
  try {
    const res = await fetch('/api/auth/challenge');
    if (!res.ok) return {};
    const data = await res.json();
    if (!data || !data.challenge) return {};

    const turnstileToken = (typeof window !== 'undefined' && window.__turnstileToken) || null;
    if (turnstileToken) return { turnstileToken };

    const nonce = await resolverDesafioPoWNavegador(data.challenge);
    return {
      securityChallenge: {
        ...data.challenge,
        nonce
      }
    };
  } catch (e) {
    return {};
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    guardarCookieSegura,
    obtenerCookieSegura,
    borrarCookieSegura,
    obtenerTemaActual,
    aplicarTema,
    sincronizarPreferenciasEnServidor,
    generarUUIDv4,
    resolverDesafioPoWNavegador,
    obtenerDesafioSeguridadResuelto
  });
}


/**
 * 🧠 MÓDULO DE ESTADO Y SESIÓN (modules/01-state.js)
 * Gestión de estado global, persistencia en localStorage, sesión JWT, balance y membresías.
 * Estándar Ecosistema Desmulta DevSecOps.
 */

// Estado en memoria de la interfaz y sesión de usuario
let datosActuales = null;
let leadSeleccionado = null;
let wompiScriptCargado = false;
const carruselIndices = {};
let limiteVisible = 15; // Lote de 15 oportunidades por página optimizado para móviles y desktop
let paginaActual = 1;

// ✅ HAL-01 — PROTECCIÓN ANTI-MANIPULACIÓN DE SESIÓN DESDE CONSOLA
// La variable interna _sesionUsuario es la fuente de verdad del módulo.
// Se expone en window como propiedad de SOLO LECTURA para que asignaciones
// directas desde F12/consola (ej: sesionUsuario.credits = 99999) no tengan efecto.
let _sesionUsuario = null; // Fuente de verdad interna
// Alias mutable para compatibilidad interna del módulo (usado por el propio JS)
let sesionUsuario = null;

if (typeof window !== 'undefined') {
  // Interceptar escritura directa de window.sesionUsuario desde la consola
  try {
    Object.defineProperty(window, '_origgoSesionProtegida', {
      get() { return _sesionUsuario; },
      set() { /* escritura externa ignorada silenciosamente */ },
      configurable: false,
      enumerable: false
    });
  } catch (_) { /* Entornos sin window (SSR/test) — ignorar */ }
}

try {
  let tokenLocal = localStorage.getItem('hunter_pro_token');
  if (!tokenLocal && typeof obtenerCookieSegura === 'function') {
    tokenLocal = obtenerCookieSegura('origgo_token');
    if (tokenLocal) {
      try { localStorage.setItem('hunter_pro_token', tokenLocal); } catch (_) {}
    }
  }
  if (tokenLocal) {
    _sesionUsuario = { token: tokenLocal };
    sesionUsuario = _sesionUsuario;
  }
  localStorage.removeItem('hunter_user_data');
  localStorage.removeItem('hunter_unlocked_contacts');
} catch (e) {
  _sesionUsuario = null;
  sesionUsuario = null;
}
let cacheContactosDesbloqueados = {};
// ✅ HAL-06: Flag atómico anti-race-condition para la restauración de sesión por PIN.
let restauracionEnProgreso = false;
// Variables de estado reactivo del Omnibox y filtros
let filtroCiudadActivo = "";
let filtroOperacionActivo = ""; // "" = todas, "venta", "arriendo"
let filtroTratoDirectoActivo = false;
let filtroHoyActivo = false;
let textoBusquedaActivo = "";
let criterioOrdenActivo = "recientes";

function aplicarPreferenciasUsuario(usr) {
  if (!usr) return;
  if (usr.preferredLang && typeof cambiarIdioma === 'function' && typeof obtenerIdiomaActual === 'function' && usr.preferredLang !== obtenerIdiomaActual()) cambiarIdioma(usr.preferredLang);
  if (usr.preferredTheme && typeof aplicarTema === 'function' && typeof obtenerTemaActual === 'function' && usr.preferredTheme !== obtenerTemaActual()) aplicarTema(usr.preferredTheme);
}

function establecerSesionDesdeToken(data, { msgEs, msgEn, titleEs, titleEn, isWelcome = false }) {
  localStorage.setItem('hunter_pro_token', data.token);
  if (typeof guardarCookieSegura === 'function') guardarCookieSegura('origgo_token', data.token, 30);
  if (isWelcome && typeof marcarDispositivoComoReclamado === 'function') marcarDispositivoComoReclamado();
  sesionUsuario = { ...data.user, token: data.token };
  delete sesionUsuario.pin;
  aplicarPreferenciasUsuario(data.user);
  actualizarBadgeVip();
  sincronizarFiltroCiudadUsuario();
  const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  mostrarNotificacionToast(esIngles ? msgEn : msgEs, 'success', { title: esIngles ? titleEn : titleEs, duration: 6000 });
  window.history.replaceState({}, document.title, window.location.pathname);
}

/**
 * Inicializa y restaura la sesión de usuario persistente (JWT / PIN / Wompi Callback).
 */
async function inicializarSesionUsuario() {
  const urlParams = new URLSearchParams(window.location.search);
  const recoveryToken = urlParams.get('recovery_token'), magicToken = urlParams.get('magic_token'), welcomeToken = urlParams.get('welcome_token');
  let paymentRef = urlParams.get('payment_ref') || urlParams.get('ref') || localStorage.getItem('origgo_pending_ref');
  const wompiId = urlParams.get('id');

  // 🎁 Activación de Regalo Freemium (Doble Opt-In por correo) con auto-desbloqueo de propiedad
  if (welcomeToken) {
    try {
      const targetLeadId = urlParams.get('lead') || sessionStorage.getItem('origgo_pending_unlock_lead');
      sessionStorage.removeItem('origgo_pending_unlock_lead');
      const res = await fetch('/api/auth/welcome-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: welcomeToken }) });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.token) throw new Error(data.message || 'El enlace de activación no es válido o expiró.');
      establecerSesionDesdeToken(data, { 
        msgEs: targetLeadId ? '🎉 ¡Acceso activado! Revelando contacto directo...' : '🎉 ¡Acceso activado! Tienes 1 desbloqueo directo listo.', 
        msgEn: targetLeadId ? '🎉 Access verified! Revealing direct contact...' : '🎉 Access verified! 1 courtesy unlock ready.', 
        titleEs: 'Desbloqueo de Cortesía ($0)', titleEn: 'Courtesy Pass', isWelcome: true 
      });
      if (targetLeadId) setTimeout(() => { if (typeof ejecutarDesbloqueoLeadPorId === 'function') ejecutarDesbloqueoLeadPorId(targetLeadId); }, 350);
      return;
    } catch (e) {
      const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
      mostrarNotificacionToast(e.message || (esIngles ? 'The activation link is invalid or expired.' : 'El enlace de activación no es válido o expiró.'), 'warning');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  if (magicToken) {
    try {
      const res = await fetch('/api/auth/magic-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: magicToken }) });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.token) throw new Error(data.message || 'El enlace no es válido o expiró.');
      establecerSesionDesdeToken(data, { msgEs: '¡Bienvenido! Sesión iniciada con Acceso Seguro.', msgEn: 'Welcome back! Secure access verified.', titleEs: 'Acceso Seguro', titleEn: 'Secure Access' });
      return;
    } catch (e) {
      const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
      mostrarNotificacionToast(e.message || (esIngles ? 'The access link is invalid or expired.' : 'El enlace de acceso no es válido o expiró.'), 'warning');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  if (recoveryToken) {
    try {
      const res = await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'recover_token', recoveryToken }) });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.token) throw new Error(data.message || 'El enlace de recuperación no es válido o expiró.');
      establecerSesionDesdeToken(data, { msgEs: 'Sesión restaurada correctamente.', msgEn: 'Session successfully restored.', titleEs: 'Acceso recuperado', titleEn: 'Access Restored' });
      return;
    } catch (e) {
      localStorage.removeItem('hunter_pro_token');
      if (typeof borrarCookieSegura === 'function') borrarCookieSegura('origgo_token');
      sesionUsuario = null;
      const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
      mostrarNotificacionToast(e.message || (esIngles ? 'The recovery link is invalid or has expired.' : 'El enlace de recuperación no es válido o expiró.'), 'warning');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  if (wompiId && !paymentRef) {
    try {
      const resVerify = await fetch(`/api/payments/verify?id=${wompiId}`);
      const dataVerify = await resVerify.json().catch(() => null);
      if (resVerify.ok && dataVerify?.ok && dataVerify.reference) paymentRef = dataVerify.reference;
    } catch (e) { registrarLogDesarrollo('warn', '[Sesión] Error al verificar Wompi ID:', e.message); }
  }

  if (paymentRef && paymentRef.startsWith('HNT-')) {
    try {
      const tokenGuardado = localStorage.getItem('hunter_pro_token');
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tokenGuardado ? { Authorization: `Bearer ${tokenGuardado}` } : {}) },
        body: JSON.stringify({ action: 'claim_reference', reference: paymentRef })
      });
      const data = await res.json().catch(() => null);
      const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
      if (data?.requiresLogin) {
        mostrarNotificacionToast(data.message || (esIngles ? 'Payment credited. Sign in with your PIN.' : 'Pago acreditado. Inicia sesión con tu PIN.'), 'warning', { title: esIngles ? 'Account Protection' : 'Protección de cuenta', duration: 7000 });
        if (typeof abrirModalCheckout === 'function') abrirModalCheckout(undefined, 'tengo-pin');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      if (res.ok && data?.ok && data.token) {
        localStorage.setItem('hunter_pro_token', data.token);
        if (typeof guardarCookieSegura === 'function') guardarCookieSegura('origgo_token', data.token, 30);
        localStorage.removeItem('origgo_pending_ref');
        const pinNuevo = data.user?.pin || null;
        sesionUsuario = { ...data.user, token: data.token };
        delete sesionUsuario.pin;
        aplicarPreferenciasUsuario(data.user);
        actualizarBadgeVip();
        sincronizarFiltroCiudadUsuario();
        const notif = typeof generarMensajeBienvenidaToast === 'function' 
          ? generarMensajeBienvenidaToast(sesionUsuario)
          : { titulo: esIngles ? '🎉 Payment confirmed!' : '🎉 ¡Pago confirmado!', mensaje: esIngles ? 'Your access has been accredited.' : 'Tu acceso quedó acreditado.', tipo: 'success' };
        mostrarNotificacionToast(notif.mensaje, notif.tipo, { title: notif.titulo, duration: 6000 });
        if (typeof abrirModalBienvenidaVIP === 'function') abrirModalBienvenidaVIP({ tipo: sesionUsuario.plan, ciudad: sesionUsuario.planCity }, { ...sesionUsuario, pin: pinNuevo });
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    } catch (e) { registrarLogDesarrollo('warn', '[Sesión] No se pudo reclamar por referencia:', e.message); }
  }

  // 2. Revalidar sesión persistente en segundo plano desde el servidor
  const tokenGuardado = (sesionUsuario && sesionUsuario.token) || localStorage.getItem('hunter_pro_token') || (typeof obtenerCookieSegura === 'function' ? obtenerCookieSegura('origgo_token') : null);
  if (tokenGuardado) {
    try {
      const res = await fetch('/api/user/balance', {
        headers: { 'Authorization': `Bearer ${tokenGuardado}` }
      });
      if (res.ok) {
        const data = await res.json();
        sesionUsuario = { ...data, token: tokenGuardado };
        if (typeof guardarCookieSegura === 'function') {
          guardarCookieSegura('origgo_token', tokenGuardado, 30);
        }
        aplicarPreferenciasUsuario(data);
        actualizarBadgeVip();
        sincronizarFiltroCiudadUsuario();
      } else if (res.status === 401 || res.status === 403 || res.status === 404) {
        localStorage.removeItem('hunter_pro_token');
        if (typeof borrarCookieSegura === 'function') borrarCookieSegura('origgo_token');
        localStorage.removeItem('hunter_user_data');
        localStorage.removeItem('hunter_unlocked_contacts');
        cacheContactosDesbloqueados = {};
        sesionUsuario = null;
        actualizarBadgeVip();
      }
    } catch (e) {
      registrarLogDesarrollo('warn', '[Sesión] Fallo al verificar balance persistente:', e.message);
    }
  }
}

/**
 * Actualiza visualmente el botón VIP del header, chip móvil y menú lateral.
 */
function actualizarBadgeVip() {
  const btnHeader = document.getElementById('btnVipHeader'), btnNavVip = document.getElementById('btnNavVip');
  const btnMobileChip = document.getElementById('btnMobileStatusChip'), sideUserBox = document.getElementById('sideMenuUserAccount');
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';

  if (sesionUsuario) {
    let htmlBadge = '', labelMovil = '', htmlChipMovil = '', htmlSideUser = '';
    const phoneFormateado = sesionUsuario.phone ? `+57 ${sesionUsuario.phone}` : (isEn ? 'Active Account' : 'Cuenta Activa');

    if (sesionUsuario.plan === 'national') {
      htmlBadge = `<i class="fa-solid fa-crown"></i><span class="vip-btn-text">${isEn ? 'National VIP' : 'VIP Nacional'}</span>`;
      labelMovil = isEn ? 'Nat. VIP' : 'VIP Nac.';
      htmlChipMovil = `<i class="fa-solid fa-crown" style="color:#FBBF24;"></i><span>${isEn ? 'National 30d' : 'Nacional 30d'}</span>`;
      htmlSideUser = `<div class="side-user-card side-user-vip-national"><div class="side-user-top"><span class="side-user-badge-gold">👑 ${isEn ? 'National VIP' : 'VIP Nacional'}</span><span class="side-user-phone">${escaparHtml(phoneFormateado)}</span></div><p class="side-user-desc">${isEn ? 'Full unlimited nationwide access active for 30 days.' : 'Acceso total ilimitado a todo el país activo por 30 días.'}</p></div>`;
    } else if (sesionUsuario.plan === 'city') {
      const ciudad = typeof escaparHtml === 'function' ? escaparHtml(sesionUsuario.planCity || 'Ciudad') : (sesionUsuario.planCity || 'Ciudad');
      htmlBadge = `<i class="fa-solid fa-crown"></i><span class="vip-btn-text">VIP ${ciudad}</span>`;
      labelMovil = isEn ? 'City VIP' : 'VIP Ciudad';
      htmlChipMovil = `<i class="fa-solid fa-crown" style="color:#34D399;"></i><span>${ciudad} 30d</span>`;
      htmlSideUser = `<div class="side-user-card side-user-vip-city"><div class="side-user-top"><span class="side-user-badge-emerald">👑 VIP ${ciudad}</span><span class="side-user-phone">${escaparHtml(phoneFormateado)}</span></div><p class="side-user-desc">${isEn ? `Unlimited contact reveals in ${ciudad} for 30 days.` : `Desbloqueo ilimitado de contactos en ${ciudad} por 30 días.`}</p></div>`;
    } else {
      const cr = Number(sesionUsuario.credits || 0);
      const palabraCred = cr === 1 ? (isEn ? 'Credit' : 'Crédito') : (isEn ? 'Credits' : 'Créditos');
      htmlBadge = `<span class="vip-btn-text">⚡ ${cr} ${palabraCred}</span>`;
      labelMovil = `${cr} Creds`;
      htmlChipMovil = cr > 0 ? `<i class="fa-solid fa-bolt" style="color:#34D399;"></i><span>${cr} Creds</span>` : `<i class="fa-solid fa-bolt" style="color:#F59E0B;"></i><span>0 Creds</span>`;
      const descCreds = cr > 0 ? (isEn ? 'Active balance to unlock verified direct owners.' : 'Saldo activo para desbloquear propietarios directos.') : (isEn ? 'No active balance. Top up to unlock contacts.' : 'Sin saldo activo. Recarga para desbloquear contactos.');
      htmlSideUser = `<div class="side-user-card"><div class="side-user-top"><span class="side-user-badge-creds">⚡ ${cr} ${palabraCred}</span><span class="side-user-phone">${escaparHtml(phoneFormateado)}</span></div><p class="side-user-desc">${descCreds}</p></div>`;
    }

    if (btnHeader) btnHeader.innerHTML = htmlBadge;
    if (btnNavVip) {
      const span = btnNavVip.querySelector('span'), icon = btnNavVip.querySelector('i');
      if (span) span.textContent = labelMovil;
      if (icon) icon.className = (sesionUsuario.plan || Number(sesionUsuario.credits || 0) === 0) ? 'fa-solid fa-crown' : 'fa-solid fa-bolt';
    }
    if (btnMobileChip) { btnMobileChip.innerHTML = htmlChipMovil; btnMobileChip.classList.remove('is-hidden'); }
    if (sideUserBox) { sideUserBox.innerHTML = htmlSideUser; sideUserBox.classList.remove('is-hidden'); }
    const btnSideLogout = document.getElementById('sideMenuLogoutBtn');
    if (btnSideLogout) btnSideLogout.classList.remove('is-hidden');
  } else {
    if (btnHeader) btnHeader.innerHTML = `<i class="fa-solid fa-bolt"></i><span class="vip-btn-text">${isEn ? 'Credits / Plans' : 'Créditos / Planes'}</span>`;
    if (btnNavVip) {
      const span = btnNavVip.querySelector('span'), icon = btnNavVip.querySelector('i');
      if (span) span.textContent = isEn ? 'Credits' : 'Créditos';
      if (icon) icon.className = 'fa-solid fa-bolt';
    }
    if (btnMobileChip) { btnMobileChip.innerHTML = `<i class="fa-solid fa-bolt"></i><span>${isEn ? 'Credits' : 'Créditos'}</span>`; btnMobileChip.classList.remove('is-hidden'); }
    if (sideUserBox) { sideUserBox.innerHTML = ''; sideUserBox.classList.add('is-hidden'); }
    const btnSideLogout = document.getElementById('sideMenuLogoutBtn');
    if (btnSideLogout) btnSideLogout.classList.add('is-hidden');
  }
}

/**
 * Sincroniza el filtro de ubicación del Omnibox con la ciudad del Plan Pro del usuario.
 */
function sincronizarFiltroCiudadUsuario() {
  if (!sesionUsuario || sesionUsuario.plan !== 'city' || !sesionUsuario.planCity) return;
  const targetCity = String(sesionUsuario.planCity).trim();
  if (!targetCity) return;
  filtroCiudadActivo = targetCity;

  const dropdownLocation = document.getElementById("cmdLocationDropdown");
  const pillLocation = document.getElementById("cmdFilterLocation");
  const labelLocation = document.getElementById("cmdFilterLocationLabel");

  if (dropdownLocation) {
    let matchItem = null;
    dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(item => {
      const itemCity = item.getAttribute("data-city") || "";
      if (itemCity && (itemCity.toLowerCase().includes(targetCity.toLowerCase()) || targetCity.toLowerCase().includes(itemCity.toLowerCase()))) matchItem = item;
    });
    if (matchItem) {
      dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(i => i.classList.remove("active"));
      matchItem.classList.add("active");
      const spanText = matchItem.querySelector("span")?.textContent || targetCity;
      if (labelLocation) labelLocation.textContent = spanText;
      if (pillLocation) pillLocation.classList.add("active-filter");
    } else if (labelLocation) {
      labelLocation.textContent = targetCity;
      if (pillLocation) pillLocation.classList.add("active-filter");
    }
  }
  const sideMenuSelect = document.getElementById("sideMenuCitySelect"), sideMenuBadge = document.getElementById("sideMenuCityBadge");
  if (sideMenuSelect) {
    let matchedVal = "";
    for (const opt of sideMenuSelect.options) {
      if (opt.value && (opt.value.toLowerCase().includes(targetCity.toLowerCase()) || targetCity.toLowerCase().includes(opt.value.toLowerCase()))) {
        matchedVal = opt.value; break;
      }
    }
    sideMenuSelect.value = matchedVal || targetCity;
  }
  if (sideMenuBadge) sideMenuBadge.textContent = targetCity;
  if (typeof aplicarFiltrosOmnibox === 'function') aplicarFiltrosOmnibox();
}

/**
 * Restaura la sesión de un usuario existente usando WhatsApp + PIN.
 * ✅ HAL-06: Protegido con flag atómico anti-race-condition.
 */
async function restaurarSesionConPin() {
  if (restauracionEnProgreso) return;
  restauracionEnProgreso = true;
  const inputWa = document.getElementById('restoreWhatsappInput'), inputPin = document.getElementById('restorePinInput');
  const msgBox = document.getElementById('restoreStatusMsg'), btn = document.getElementById('btnRestoreSession');
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const celular = inputWa ? inputWa.value.trim() : '', pin = inputPin ? inputPin.value.trim().toUpperCase() : '';
  if (!celular || !pin) {
    if (msgBox) { msgBox.className = 'restore-status-msg error'; msgBox.textContent = isEn ? 'Enter your WhatsApp number and security PIN.' : 'Ingresa tu número de WhatsApp y tu PIN de seguridad.'; msgBox.style.display = 'block'; }
    restauracionEnProgreso = false;
    return;
  }
  if (btn) { btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEn ? 'Verifying credentials...' : 'Verificando credenciales...'}`; btn.disabled = true; }
  const esReferencia = pin.startsWith('HNT-') && pin.length > 12;
  let securityData = {};
  if (!esReferencia && typeof obtenerDesafioSeguridadResuelto === 'function') securityData = await obtenerDesafioSeguridadResuelto();
  const requestBody = esReferencia ? { action: 'claim_reference', reference: pin, lang: isEn ? 'en' : 'es' } : { celular, pin, lang: isEn ? 'en' : 'es', ...securityData };

  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || data.error || (isEn ? 'Incorrect credentials or reference' : 'Credenciales o referencia incorrectas'));
    if (data.requiresLogin) throw new Error(data.message || (isEn ? 'Payment credited. Enter your PIN to continue.' : 'Pago acreditado. Ingresa tu PIN para continuar.'));

    localStorage.setItem('hunter_pro_token', data.token);
    if (typeof guardarCookieSegura === 'function') guardarCookieSegura('origgo_token', data.token, 30);
    localStorage.removeItem('origgo_pending_ref');
    const pinDevuelto = data.user?.pin || null;
    sesionUsuario = { ...data.user, token: data.token };
    delete sesionUsuario.pin;
    aplicarPreferenciasUsuario(data.user);
    actualizarBadgeVip();
    sincronizarFiltroCiudadUsuario();
    renderizarInterfaz(datosActuales);

    if (msgBox) {
      msgBox.className = 'restore-status-msg success';
      msgBox.textContent = pinDevuelto
        ? (isEn ? `✅ Payment verified! PIN: ${pinDevuelto}. Balance: ${data.user.credits} credits.` : `✅ ¡Pago verificado! Tu PIN es ${pinDevuelto}. Saldo: ${data.user.credits} créditos.`)
        : (isEn ? `✅ Welcome back! Available: ${data.user.credits} credits.` : `✅ ¡Bienvenido de nuevo! Tienes ${data.user.credits} créditos disponibles.`);
      msgBox.style.display = 'block';
    }
    setTimeout(() => { abrirModalCheckout(undefined, 'perfil'); }, 800);
  } catch (err) {
    if (msgBox) { msgBox.className = 'restore-status-msg error'; msgBox.textContent = err.message; msgBox.style.display = 'block'; }
  } finally {
    restauracionEnProgreso = false;
    if (btn) { btn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> ${isEn ? 'Restore My Credits' : 'Restaurar Mis Créditos'}`; btn.disabled = false; }
  }
}

/**
 * Cierra la sesión activa del usuario.
 * Preserva intacta la marca Zombie del dispositivo (origgo_device_claimed)
 * para evitar que el usuario burle el modelo freemium al desloguearse.
 */
function cerrarSesionUsuario() {
  localStorage.removeItem('hunter_pro_token');
  if (typeof borrarCookieSegura === 'function') borrarCookieSegura('origgo_token');
  localStorage.removeItem('hunter_user_data');
  localStorage.removeItem('hunter_unlocked_contacts');
  cacheContactosDesbloqueados = {};
  sesionUsuario = null;
  if (typeof esDispositivoMarcadoComoReclamado === 'function') esDispositivoMarcadoComoReclamado();
  actualizarBadgeVip();
  renderizarInterfaz(datosActuales);
  const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  mostrarNotificacionToast(esIngles ? 'Logged out successfully.' : 'Sesión cerrada correctamente.', 'info');
}

/**
 * Autoservicio para restaurar acceso mediante PIN o Magic Link por correo electrónico.
 */
async function recuperarPinConReferencia() {
  const inputEmail = document.getElementById('recoveryReferenceInput'), msgBox = document.getElementById('recoveryResultMsg'), btn = document.getElementById('btnExecuteAutoRecovery');
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const email = inputEmail ? inputEmail.value.trim() : '';
  if (!email || !email.includes('@')) {
    if (msgBox) {
      msgBox.className = 'restore-status-msg restore-status-recovery-result error';
      msgBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${isEn ? 'Please enter a valid email address.' : 'Por favor, ingresa un correo electrónico válido.'}`;
      msgBox.style.display = 'block';
    }
    return;
  }
  if (btn) { btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEn ? 'Sending...' : 'Enviando...'}`; btn.disabled = true; }
  try {
    const response = await fetch('/api/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, lang: isEn ? 'en' : 'es' })
    });
    const result = await response.json();
    if (msgBox) {
      msgBox.className = response.ok ? 'restore-status-msg restore-status-recovery-result success' : 'restore-status-msg restore-status-recovery-result error';
      msgBox.textContent = result.message || (response.ok ? (isEn ? 'If an account exists, instructions were sent.' : 'Si existe una cuenta asociada, enviaremos instrucciones.') : (isEn ? 'Could not process request.' : 'No se pudo procesar la solicitud.'));
      msgBox.style.display = 'block';
      if (response.ok && inputEmail) inputEmail.value = '';
    }
  } catch (error) {
    if (msgBox) {
      msgBox.className = 'restore-status-msg restore-status-recovery-result error';
      msgBox.innerHTML = `<i class="fa-solid fa-network-wired"></i> ${isEn ? 'Connection error. Try again.' : 'Error de conexión. Intenta de nuevo.'}`;
      msgBox.style.display = 'block';
    }
  } finally {
    if (btn) { btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ${isEn ? 'Send instructions' : 'Enviar instrucciones'}`; btn.disabled = false; }
  }
}

/**
 * Solicita el envío de un Magic Link de acceso sin contraseña al correo del usuario.
 */
async function solicitarMagicLinkPorCorreo() {
  const inputEmail = document.getElementById('magicLinkEmailInput') || document.getElementById('recoveryReferenceInput');
  const msgBox = document.getElementById('magicLinkStatusMsg') || document.getElementById('recoveryResultMsg') || document.getElementById('restoreStatusMsg');
  const btn = document.getElementById('btnSendMagicLink'), isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const email = inputEmail ? inputEmail.value.trim() : '';

  if (!email || !email.includes('@')) {
    if (msgBox) {
      msgBox.className = 'restore-status-msg restore-status-recovery-result error';
      msgBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${isEn ? 'Please enter a valid email address.' : 'Por favor, ingresa un correo electrónico válido.'}`;
      msgBox.style.display = 'block';
    }
    return;
  }
  if (btn) { btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEn ? 'Sending link...' : 'Enviando enlace...'}`; btn.disabled = true; }
  try {
    const response = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, lang: isEn ? 'en' : 'es' })
    });
    const result = await response.json();
    if (msgBox) {
      msgBox.className = response.ok ? 'restore-status-msg restore-status-recovery-result success' : 'restore-status-msg restore-status-recovery-result error';
      msgBox.textContent = result.message || (response.ok ? (isEn ? 'Instant access link sent to your inbox.' : 'Enlace de acceso rápido enviado a tu correo.') : (isEn ? 'Could not send access link.' : 'No se pudo enviar el enlace de acceso.'));
      msgBox.style.display = 'block';
      if (response.ok && inputEmail) inputEmail.value = '';
    }
  } catch (error) {
    if (msgBox) {
      msgBox.className = 'restore-status-msg restore-status-recovery-result error';
      msgBox.innerHTML = `<i class="fa-solid fa-network-wired"></i> ${isEn ? 'Connection error. Try again.' : 'Error de conexión. Intenta de nuevo.'}`;
      msgBox.style.display = 'block';
    }
  } finally {
    if (btn) { btn.innerHTML = `<i class="fa-solid fa-envelope-circle-check"></i> ${isEn ? 'Send Direct Link' : 'Enviar Enlace de Acceso'}`; btn.disabled = false; }
  }
}

// 🛡️ Secreto Comercial: purga automática tras inactividad (>15m) y sincronización multi-pestaña
let _lastActive = Date.now();
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') _lastActive = Date.now();
    else if (document.visibilityState === 'visible' && Date.now() - _lastActive > 15 * 60 * 1000 && Object.keys(cacheContactosDesbloqueados).length > 0) {
      cacheContactosDesbloqueados = {};
      if (typeof renderizarInterfaz === 'function' && datosActuales) renderizarInterfaz(datosActuales);
    }
  });
  window.addEventListener('storage', e => { if (e.key === 'hunter_pro_token' && typeof inicializarSesionUsuario === 'function') inicializarSesionUsuario(); });
}
window.solicitarMagicLinkPorCorreo = solicitarMagicLinkPorCorreo;


/**
 * 🔔 MÓDULO DE NOTIFICACIONES TOAST (modules/02-toast.js)
 * Notificaciones flotantes con acabado premium, ambient glow, micro-barra y gestos de deslizamiento.
 * Estándar Ecosistema Desmulta UI/UX.
 */

/**
 * Muestra una notificación toast ejecutiva de alta gama con iluminación ambiental,
 * micro-barra de progreso interactiva, soporte de gestos táctiles y modo oscuro/claro.
 * Compatible con la referencia Sonner / Radix Luxury Toast.
 * 
 * @param {string} mensaje - Texto principal o detalle de la alerta
 * @param {'success'|'error'|'warning'|'info'|'vip'} [tipo='success'] - Tipo semántico de notificación
 * @param {string|{title?: string, duration?: number, actionText?: string, onAction?: Function}} [opciones] - Opciones o título manual
 */
function mostrarNotificacionToast(mensaje, tipo = 'success', opciones = {}) {
  // Normalizar opciones
  const opts = typeof opciones === 'string' ? { title: opciones } : (opciones || {});
  let duracionMs = opts.duration || 4500;
  let tipoFinal = tipo;
  let titulo = opts.title || '';
  let mensajeLimpio = String(mensaje || '').trim();
  const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';

  // Detección e interpretación inteligente de prefijos y emojis
  if (mensajeLimpio.startsWith('👑')) {
    tipoFinal = 'vip';
    if (!titulo) titulo = esIngles ? 'VIP Pro Membership' : 'Membresía VIP Pro';
    mensajeLimpio = mensajeLimpio.replace(/^👑\s*/, '');
  } else if (mensajeLimpio.startsWith('🎉')) {
    if (!titulo) titulo = esIngles ? 'Success!' : '¡Operación Exitosa!';
    mensajeLimpio = mensajeLimpio.replace(/^🎉\s*/, '');
  } else if (mensajeLimpio.startsWith('📍')) {
    if (!titulo) titulo = esIngles ? 'Regional Coverage' : 'Cobertura Regional';
    mensajeLimpio = mensajeLimpio.replace(/^📍\s*/, '');
  } else if (mensajeLimpio.startsWith('⚠️')) {
    tipoFinal = 'warning';
    if (!titulo) titulo = esIngles ? 'System Notice' : 'Aviso del Sistema';
    mensajeLimpio = mensajeLimpio.replace(/^⚠️\s*/, '');
  } else if (mensajeLimpio.startsWith('✅')) {
    if (!titulo) titulo = esIngles ? 'Confirmation' : 'Confirmación';
    mensajeLimpio = mensajeLimpio.replace(/^✅\s*/, '');
  } else if (mensajeLimpio.startsWith('❌')) {
    tipoFinal = 'error';
    if (!titulo) titulo = esIngles ? 'Access Restricted' : 'Acceso Restringido';
    mensajeLimpio = mensajeLimpio.replace(/^❌\s*/, '');
  }

  // Títulos por defecto según el tipo si no se asignaron previamente
  if (!titulo) {
    if (tipoFinal === 'vip') titulo = esIngles ? 'VIP Pro Membership' : 'Membresía VIP Pro';
    else if (tipoFinal === 'error') titulo = esIngles ? 'Action Required' : 'Acción Requerida';
    else if (tipoFinal === 'warning') titulo = esIngles ? 'Attention' : 'Atención';
    else if (tipoFinal === 'info') titulo = esIngles ? 'Information' : 'Información';
    else titulo = esIngles ? 'Origgo Notification' : 'Notificación Origgo';
  }

  // Contenedor global de toasts
  let container = document.getElementById('hunterToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'hunterToastContainer';
    container.className = 'hunter-toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  // Si ya hay un toast activo, cerramos el previo de inmediato para evitar sobrecargas
  const toastsExistentes = container.querySelectorAll('.hunter-toast:not(.hunter-toast--closing)');
  if (toastsExistentes.length >= 2) {
    toastsExistentes[0].classList.add('hunter-toast--closing');
    setTimeout(() => toastsExistentes[0].remove(), 280);
  }

  // Selector de Icono SVG de alta fidelidad según el tipo
  let iconoSvg = '';
  if (tipoFinal === 'vip') {
    iconoSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"/></svg>`;
  } else if (tipoFinal === 'error') {
    iconoSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  } else if (tipoFinal === 'warning') {
    iconoSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  } else if (tipoFinal === 'info') {
    iconoSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  } else {
    // success por defecto
    iconoSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  }

  // Generar tarjeta toast
  const toast = document.createElement('div');
  toast.className = `hunter-toast hunter-toast--${tipoFinal}`;
  toast.setAttribute('role', 'alert');

  const segundosTotal = Math.round(duracionMs / 1000);
  const escapeFn = typeof escaparHtml === 'function' ? escaparHtml : (t) => String(t || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const tituloSeguro = escapeFn(titulo);
  const mensajeSeguro = escapeFn(mensajeLimpio);
  const actionTextSeguro = opts.actionText ? escapeFn(opts.actionText) : '';

  let actionHtml = '';
  if (opts.actionText) {
    actionHtml = `<button type="button" class="hunter-toast-action-btn">${actionTextSeguro}</button>`;
  }

  toast.innerHTML = `
    <div class="hunter-toast-glow"></div>
    <div class="hunter-toast-inner">
      <div class="hunter-toast-icon-wrapper">
        ${iconoSvg}
      </div>
      <div class="hunter-toast-content">
        <div class="hunter-toast-header">
          <h4 class="hunter-toast-title">${tituloSeguro}</h4>
          <button type="button" class="hunter-toast-close" aria-label="${esIngles ? 'Close notification' : 'Cerrar notificación'}" title="${esIngles ? 'Close' : 'Cerrar'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <p class="hunter-toast-description">${mensajeSeguro}</p>
        ${actionHtml}
      </div>
    </div>
    <div class="hunter-toast-footer">
      <span class="hunter-toast-timer-label">${esIngles ? `Closes in ${segundosTotal}s · Click to pause` : `Cierra en ${segundosTotal}s · Clic para pausar`}</span>
      <div class="hunter-toast-progress-track">
        <div class="hunter-toast-progress-bar"></div>
      </div>
    </div>
  `;

  container.appendChild(toast);
  const progressBar = toast.querySelector('.hunter-toast-progress-bar');
  const animacionProgreso = progressBar && typeof progressBar.animate === 'function'
    ? progressBar.animate(
      [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
      { duration: duracionMs, easing: 'linear', fill: 'forwards' }
    )
    : null;

  // Vincular acción opcional si se suministró callback
  if (opts.onAction && typeof opts.onAction === 'function') {
    const actionBtn = toast.querySelector('.hunter-toast-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onAction();
        cerrarToast();
      });
    }
  }

  // Función de cierre elegante
  let cerrado = false;
  function cerrarToast() {
    if (cerrado) return;
    cerrado = true;
    toast.classList.add('hunter-toast--closing');
    if (animacionProgreso) animacionProgreso.cancel();
    clearTimeout(timeoutId);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 280);
  }

  // Botón de cierre superior
  const closeBtn = toast.querySelector('.hunter-toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cerrarToast();
    });
  }

  // Lógica de temporizador interactivo con soporte para pausa en hover y touch
  let tiempoRestante = duracionMs;
  let tiempoInicio = Date.now();
  let timeoutId = null;
  let estaPausado = false;
  const timerLabel = toast.querySelector('.hunter-toast-timer-label');

  function iniciarTimer(ms) {
    tiempoInicio = Date.now();
    timeoutId = setTimeout(() => {
      cerrarToast();
    }, ms);
  }

  function pausarTimer() {
    if (cerrado || estaPausado) return;
    estaPausado = true;
    clearTimeout(timeoutId);
    const transcurrido = Date.now() - tiempoInicio;
    tiempoRestante = Math.max(500, tiempoRestante - transcurrido);
    toast.classList.add('hunter-toast--paused');
    if (animacionProgreso) animacionProgreso.pause();
    if (timerLabel) timerLabel.textContent = esIngles ? 'Paused · Swipe up to dismiss' : 'En pausa · Desliza hacia arriba para cerrar';
  }

  function reanudarTimer() {
    if (cerrado || !estaPausado) return;
    estaPausado = false;
    toast.classList.remove('hunter-toast--paused');
    if (animacionProgreso && animacionProgreso.playState !== 'finished') animacionProgreso.play();
    const segsRest = Math.ceil(tiempoRestante / 1000);
    if (timerLabel) timerLabel.textContent = esIngles ? `Closes in ${segsRest}s · Click to pause` : `Cierra en ${segsRest}s · Clic para pausar`;
    iniciarTimer(tiempoRestante);
  }

  // Pausa en hover de escritorio
  toast.addEventListener('mouseenter', pausarTimer);
  toast.addEventListener('mouseleave', reanudarTimer);

  // Gestos táctiles para móviles: pausa en toque y Swipe-Up para descartar
  let touchStartY = 0;
  let touchDiffY = 0;

  toast.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    pausarTimer();
  }, { passive: true });

  toast.addEventListener('touchmove', (e) => {
    touchDiffY = e.touches[0].clientY - touchStartY;
    if (touchDiffY < 0) {
      // Arrastre hacia arriba
      toast.style.transform = `translateY(${Math.max(touchDiffY, -80)}px) scale(${1 + touchDiffY / 500})`;
      toast.style.opacity = `${1 + touchDiffY / 120}`;
    }
  }, { passive: true });

  toast.addEventListener('touchend', () => {
    if (touchDiffY < -40) {
      // Gesto de deslizamiento hacia arriba confirmado: descartar
      cerrarToast();
    } else {
      // Volver a posición original y reanudar
      toast.style.transform = '';
      toast.style.opacity = '';
      reanudarTimer();
    }
    touchDiffY = 0;
  }, { passive: true });

  // Iniciar la cuenta regresiva inicial
  iniciarTimer(duracionMs);
}

/**
 * Construye la notificación toast personalizada con tono de alta gama y exclusividad según el plan.
 * @param {object} usuario - Datos del usuario autenticado
 * @param {string|null} [tipoProducto] - Tipo de producto adquirido
 * @param {string|null} [ciudad] - Ciudad de cobertura si aplica
 * @returns {{ titulo: string, mensaje: string, tipo: string }}
 */
function generarMensajeBienvenidaToast(usuario, tipoProducto = null, ciudad = null) {
  const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const plan = usuario?.plan || 'free';
  const city = ciudad || usuario?.planCity || (esIngles ? 'your city' : 'tu ciudad');

  if (plan === 'national' || tipoProducto === 'subscription_national') {
    return {
      titulo: esIngles ? '👑 National Elite Unlocked!' : '👑 ¡Élite Nacional Desbloqueada!',
      mensaje: esIngles
        ? 'Welcome to the National VIP Pass! Full access across Colombia and price drop radar activated. Save your PIN; restore anytime via email.'
        : '¡Bienvenido al Plan Nacional VIP! Acceso total en toda Colombia y radar de rebajas activado. Guarda tu PIN; también puedes recuperarlo por correo.',
      tipo: 'vip'
    };
  }

  if (plan === 'city' || tipoProducto === 'subscription_city') {
    return {
      titulo: esIngles ? `👑 Pro Pass ${city} Active!` : `👑 ¡Membresía Pro ${city} Activa!`,
      mensaje: esIngles
        ? `Welcome! Enjoy 30 days of unlimited access to direct property owners in ${city}.`
        : `¡Bienvenido! Disfrutas de acceso ilimitado a propietarios directos de ${city} por 30 días.`,
      tipo: 'vip'
    };
  }

  if (tipoProducto === 'pack_10_leads' || (usuario?.credits >= 10)) {
    return {
      titulo: esIngles ? '⭐ 10 Contacts Pro Pack Active!' : '⭐ ¡Paquete Pro 10 Contactos Activo!',
      mensaje: esIngles
        ? `30% savings secured! You have ${usuario?.credits || 10} verified contacts with no expiration.`
        : `¡Ahorro del 30% asegurado! Tienes ${usuario?.credits || 10} contactos verificados sin vencimiento.`,
      tipo: 'success'
    };
  }

  return {
    titulo: esIngles ? '🎉 Payment Successful!' : '🎉 ¡Operación Exitosa!',
    mensaje: esIngles
      ? `Payment approved! You have ${usuario?.credits || 1} direct credit available.`
      : `¡Pago aprobado! Tienes ${usuario?.credits || 1} crédito disponible sin intermediarios.`,
    tipo: 'success'
  };
}


/**
 * 🌐 MÓDULO DE RED Y CLIENTE API (modules/03-api.js)
 * Comunicación HTTP centralizada, inyección de x-trace-id, cola de reintentos
 * exponencial y fail-safe resiliente para la terminal de oportunidades.
 * Estándar Ecosistema Desmulta DevSecOps.
 */

function generarTraceId() {
  return 'hnt_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
}

/**
 * Realiza peticiones fetch con cola de reintentos, backoff exponencial y jitter aleatorio.
 * @param {string} url
 * @param {RequestInit} [opciones]
 * @param {object} [config]
 * @param {number} [config.maxReintentos]
 * @param {number} [config.delayBaseMs]
 * @param {number} [config.factorBackoff]
 * @param {number} [config.jitterMs]
 * @param {number} [config.timeoutMs]
 * @returns {Promise<any>}
 */
async function fetchConReintentos(url, opciones = {}, {
  maxReintentos = 2,
  delayBaseMs = 800,
  factorBackoff = 2,
  jitterMs = 300,
  timeoutMs = 4500
} = {}) {
  let ultimoError = null;

  for (let intento = 0; intento <= maxReintentos; intento++) {
    const controlador = new AbortController();
    const timerId = setTimeout(() => controlador.abort(), timeoutMs);

    try {
      const traceId = generarTraceId();
      const headers = new Headers(opciones.headers || {});
      if (!headers.has('x-trace-id')) headers.set('x-trace-id', traceId);

      const res = await fetch(url, {
        ...opciones,
        headers,
        signal: controlador.signal
      });

      clearTimeout(timerId);

      // Si el servidor responde 4xx (salvo 429), no reintentar pues la petición es errónea
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(`HTTP ${res.status}: Petición no recuperable`);
        }
        throw new Error(`HTTP ${res.status}: Error de servidor`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timerId);
      ultimoError = err;

      // Si se agotaron los intentos, salir del bucle
      if (intento === maxReintentos) break;

      // Calcular backoff exponencial con jitter para no saturar la red
      const espera = (delayBaseMs * Math.pow(factorBackoff, intento)) + Math.floor(Math.random() * jitterMs);
      registrarLogDesarrollo('warn', `[fetchConReintentos] Reintento ${intento + 1}/${maxReintentos} en ${espera}ms para ${url}:`, err.message);
      await new Promise(resolve => setTimeout(resolve, espera));
    }
  }

  // Notificar al Perro Guardián ante agotamiento de cola de reintentos
  if (typeof reportarFalloCliente === 'function') {
    reportarFalloCliente({
      tipo: 'FETCH_REINTENTOS_AGOTADOS',
      mensaje: `Fallo persistente tras ${maxReintentos + 1} intentos: ${ultimoError?.message || 'Error desconocido'}`,
      origen: url
    });
  }

  throw ultimoError;
}

/**
 * Valida que los datos recibidos cumplan con el contrato estructural mínimo de Origgo.
 * @param {any} datos
 * @returns {boolean}
 */
function validarContratoCatalogo(datos) {
  if (!datos || typeof datos !== 'object') return false;
  if (!Array.isArray(datos.leads) || datos.leads.length === 0) return false;
  const primerLead = datos.leads[0];
  return Boolean(primerLead && primerLead.id && primerLead.contacto_cifrado);
}

/**
 * Consulta el catálogo mediante el endpoint serverless paginado (/api/leads/list).
 * Soporta filtros en backend, ordenamiento, particionamiento en lotes de 15 items
 * y fallback automático a contingencia local offline.
 * @param {object} [opciones]
 * @param {number} [opciones.page=1]
 * @param {number} [opciones.limit=15]
 * @param {string} [opciones.city='']
 * @param {string} [opciones.operation='']
 * @param {string} [opciones.search='']
 * @param {string} [opciones.sort='recientes']
 * @param {boolean} [opciones.reset=false]
 * @param {boolean} [opciones.append=false]
 */
async function consultarCatalogoPaginado({
  page = 1,
  limit = 15,
  city = (typeof filtroCiudadActivo !== 'undefined' ? filtroCiudadActivo : ''),
  operation = (typeof filtroOperacionActivo !== 'undefined' ? filtroOperacionActivo : ''),
  search = (typeof textoBusquedaActivo !== 'undefined' ? textoBusquedaActivo : ''),
  sort = (typeof criterioOrdenActivo !== 'undefined' ? criterioOrdenActivo : 'recientes'),
  reset = false,
  append = false
} = {}) {
  const container = document.getElementById("bentoGridContainer");
  if (container && (page === 1 || reset) && !append) {
    container.innerHTML = typeof generarHtmlSkeletons === 'function' ? generarHtmlSkeletons(6) : '';
  }

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort: String(sort || 'recientes')
  });
  if (city) queryParams.set('city', city);
  if (operation) queryParams.set('operation', operation);
  if (search) queryParams.set('search', search);

  const url = `/api/leads/list?${queryParams.toString()}`;

  try {
    const data = await fetchConReintentos(url, { cache: 'no-cache' }, {
      maxReintentos: 2,
      delayBaseMs: 500,
      timeoutMs: 3500
    });

    if (!data || !data.ok || !Array.isArray(data.leads)) {
      throw new Error(data?.error || 'Respuesta inválida del catálogo serverless.');
    }

    if (data.ciudades && typeof sincronizarDropdownCiudades === 'function') {
      sincronizarDropdownCiudades(data.ciudades);
    }

    if (append && datosActuales && Array.isArray(datosActuales.leads)) {
      datosActuales.leads.push(...data.leads);
      datosActuales.page = data.page;
      datosActuales.hayMas = data.hayMas;
      datosActuales.totalPages = data.totalPages;
      datosActuales.total = data.total;
    } else {
      datosActuales = {
        config: data.config || (datosActuales?.config || {}),
        leads: data.leads,
        total: data.total,
        totalPages: data.totalPages,
        page: data.page,
        hayMas: data.hayMas,
        ciudades: data.ciudades
      };
    }

    paginaActual = data.page;
    limiteVisible = limit;

    if (typeof renderizarInterfaz === 'function') {
      renderizarInterfaz(datosActuales);
    }
    return data;
  } catch (err) {
    registrarLogDesarrollo('warn', '[consultarCatalogoPaginado] Fallback a contingencia local offline:', err.message);
    return await cargarDatosLocalFallback('./data/inmobiliario.json');
  }
}

/**
 * Fallback resiliente offline que carga el dataset estático local ante fallos de conexión.
 * @param {string} rutaJson
 */
async function cargarDatosLocalFallback(rutaJson) {
  const container = document.getElementById("bentoGridContainer");
  try {
    const localData = await fetchConReintentos(rutaJson, {}, {
      maxReintentos: 1,
      delayBaseMs: 600,
      timeoutMs: 3500
    });
    if (validarContratoCatalogo(localData)) {
      if (Array.isArray(localData.leads) && typeof deduplicarLeads === 'function') {
        localData.leads = deduplicarLeads(localData.leads);
      }
      datosActuales = localData;
      limiteVisible = 15;
      paginaActual = 1;
      if (typeof renderizarInterfaz === 'function') renderizarInterfaz(localData);
      return localData;
    }
    throw new Error('Estructura de catálogo local inválida');
  } catch (fallbackErr) {
    registrarLogDesarrollo('error', '[cargarDatosLocalFallback] Falló la carga local de emergencia:', fallbackErr);
    if (container) {
      const errTxt = typeof escaparHtml === 'function' ? escaparHtml(fallbackErr.message) : String(fallbackErr.message || '');
      container.innerHTML = `
        <div class="error-state-msg">
          <p class="error-state-title">Terminal de oportunidades fuera de línea.</p>
          <p class="error-state-detail">${errTxt}</p>
          <button type="button" class="btn-retry-catalog" onclick="consultarCatalogoPaginado({ page: 1, reset: true })">
            <i class="fa-solid fa-rotate-right"></i> Reintentar Conexión
          </button>
        </div>
      `;
    }
  }
}

/**
 * Carga un archivo JSON y realiza el mapeo dinámico de llaves en la interfaz.
 * Soporta carga primaria serverless con fallback local inmediato ante fallos de red.
 * @param {string} rutaJson
 */
async function cargarDatos(rutaJson) {
  if (typeof rutaJson === 'string' && rutaJson.includes('inmobiliario.json')) {
    return await consultarCatalogoPaginado({ page: 1, reset: true });
  }
  return await cargarDatosLocalFallback(rutaJson);
}

if (typeof window !== 'undefined') {
  window.consultarCatalogoPaginado = consultarCatalogoPaginado;
  window.cargarDatos = cargarDatos;
}


/**
 * 🔍 MÓDULO DE BÚSQUEDA Y FILTROS (modules/04-filters.js)
 * Normalización de búsqueda fonética/inteligente, omnibox y sincronización de ciudades.
 * Estándar Ecosistema Desmulta.
 */

/**
 * Normaliza una cadena de texto para búsqueda flexible y tolerante a la escritura:
 * - Convierte a minúsculas
 * - Remueve diacríticos y acentos (á->a, é->e, í->i, ó->o, ú->u, ü->u)
 * - Mapea 'ñ' a 'n' para permitir que búsquedas sin eñe (dueno -> dueño) coincidan
 * - Sustituye caracteres de puntuación por espacios
 * - Colapsa espacios redundantes
 * @param {string} str
 * @returns {string}
 */
function normalizarTextoBusqueda(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[.,;:()\-–—_'"/\\#+!¿?¡]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Diccionario de sinónimos, abreviaturas y variantes léxicas en Colombia
 * para búsquedas inmobiliarias y vehiculares de alta precisión.
 */
const DICCIONARIO_TERMINOS = {
  "apto": ["apartamento", "departamento", "apto"], "aptos": ["apartamento", "apto"], "apartamento": ["apartamento", "apto"], "apartamentos": ["apartamento", "apto"], "ph": ["penthouse", "duplex", "ph"], "penthouse": ["penthouse", "ph", "duplex"], "duplex": ["duplex", "penthouse"], "casa": ["casa", "quinta", "campestre", "chalet"], "casas": ["casa", "quinta", "campestre"], "lote": ["lote", "terreno", "campestre"], "campestre": ["campestre", "quinta", "casa", "lote"],
  "alcoba": ["habitacion", "habitaciones", "hab", "alcoba", "cuarto"], "alcobas": ["habitacion", "hab", "alcoba"], "habitacion": ["habitacion", "hab", "alcoba", "cuarto"], "habitaciones": ["habitacion", "hab", "alcoba"], "hab": ["habitacion", "hab", "alcoba"], "cuarto": ["habitacion", "hab", "alcoba"], "bano": ["bano", "banos", "ducha"], "banos": ["bano", "banos", "ducha"],
  "garaje": ["garaje", "garajes", "parqueadero", "parq"], "garajes": ["garaje", "parqueadero", "parq"], "parqueadero": ["garaje", "parqueadero", "parq"], "parqueaderos": ["garaje", "parqueadero", "parq"], "parq": ["garaje", "parqueadero"], "dueno": ["propietario", "particular", "directo", "dueno", "fsbo"], "dueño": ["propietario", "particular", "directo", "dueno", "fsbo"], "propietario": ["propietario", "particular", "directo", "dueno"], "particular": ["propietario", "particular", "directo", "dueno"], "directo": ["directo", "dueno", "propietario", "particular"],
  "rebaja": ["rebaja", "descuento", "ganga", "barato", "oportunidad"], "descuento": ["rebaja", "descuento", "ganga", "arbitraje"], "ganga": ["rebaja", "ganga", "oportunidad", "arbitraje"], "viaje": ["viaje", "motivo", "urgente"], "urgente": ["urgente", "viaje", "motivo", "oportunidad"], "arbitraje": ["arbitraje", "descuento", "ganga"], "carro": ["vehiculo", "auto", "camioneta", "sedan", "suv", "carro"], "auto": ["vehiculo", "carro", "camioneta", "sedan", "suv"], "vehiculo": ["vehiculo", "carro", "camioneta", "auto"], "camioneta": ["camioneta", "suv", "pickup", "4x4"], "suv": ["suv", "camioneta", "4x4"], "pickup": ["pickup", "camioneta", "4x4"], "sedan": ["sedan", "carro", "auto"], "4x4": ["4x4", "camioneta", "suv", "pickup"],
  "apartment": ["apartamento", "apto"], "apartments": ["apartamento", "apto"], "flat": ["apartamento", "apto"], "condo": ["apartamento", "apto"], "house": ["casa", "quinta", "campestre"], "houses": ["casa", "quinta"], "home": ["casa", "apartamento"], "land": ["lote", "terreno"], "lot": ["lote", "terreno"], "plot": ["lote", "terreno"], "office": ["oficina"], "building": ["edificio"], "estate": ["finca", "campestre"], "warehouse": ["bodega"], "commercial": ["local", "comercial"], "store": ["local"],
  "bedroom": ["habitacion", "hab", "alcoba"], "bedrooms": ["habitacion", "hab", "alcoba"], "bed": ["habitacion", "hab"], "beds": ["habitaciones", "hab"], "bath": ["bano", "banos"], "baths": ["bano", "banos"], "bathroom": ["bano"], "bathrooms": ["bano", "banos"], "parking": ["garaje", "parqueadero"], "garage": ["garaje", "parqueadero"], "owner": ["propietario", "directo", "dueno"], "owners": ["propietario", "dueno"], "direct": ["directo", "dueno"], "discount": ["rebaja", "descuento", "ganga"], "bargain": ["ganga", "rebaja"], "deal": ["oportunidad", "directo"], "urgent": ["urgente", "viaje"],
  "studio": ["apartaestudio", "apartamento", "apto"], "pool": ["piscina"], "gym": ["gimnasio"], "balcony": ["balcon", "terraza"], "terrace": ["terraza", "balcon"], "furnished": ["amoblado", "amoblada"], "view": ["vista", "panoramica"], "security": ["vigilancia", "porteria"], "elevator": ["ascensor"], "storage": ["deposito", "bodega"], "rent": ["arriendo", "alquiler"], "sale": ["venta"], "luxury": ["lujo", "penthouse"], "investment": ["inversion", "arbitraje"], "remodeled": ["remodelado", "nuevo"], "bogota": ["bogota", "rosales", "chico"], "medellin": ["medellin", "poblado", "laureles"], "cali": ["cali", "pance"], "cartagena": ["cartagena", "bocagrande"], "pereira": ["pereira", "cerritos"], "bucaramanga": ["bucaramanga"]
};

/**
 * Evalúa si una tarjeta coincide con la búsqueda del usuario:
 * - Divide la consulta en tokens
 * - Verifica coincidencia directa, sinónimos y prefijos de raíz
 * - Aplica límites de seguridad (máximo 80 caracteres)
 * @param {string} textoTarjetaNormalizado
 * @param {string} busquedaUsuario
 * @returns {boolean}
 */
function coincideBusquedaInteligente(textoTarjetaNormalizado, busquedaUsuario) {
  if (!busquedaUsuario) return true;
  const queryLimpia = normalizarTextoBusqueda(busquedaUsuario.slice(0, 80));
  if (!queryLimpia) return true;

  const tokens = queryLimpia.split(" ").filter(t => t.length > 0);
  if (tokens.length === 0) return true;

  return tokens.every(token => {
    // 1. Coincidencia directa como subcadena
    if (textoTarjetaNormalizado.includes(token)) return true;

    // 2. Coincidencia por sinónimos o variantes léxicas
    const sinonimos = DICCIONARIO_TERMINOS[token];
    if (sinonimos && sinonimos.some(s => textoTarjetaNormalizado.includes(s))) {
      return true;
    }

    // 3. Tolerancia por prefijo (palabra parcial de al menos 4 caracteres)
    if (token.length >= 4) {
      const raiz = token.slice(0, token.length - 1);
      if (textoTarjetaNormalizado.includes(raiz)) return true;
    }

    return false;
  });
}

/**
 * Aplica los filtros combinados (Omnibox de búsqueda libre inteligente, Ciudad y Trato Directo)
 * sobre la grilla de oportunidades Bento.
 */
function aplicarFiltrosOmnibox() {
  paginaActual = 1;
  limiteVisible = 15;
  if (typeof consultarCatalogoPaginado === 'function') {
    consultarCatalogoPaginado({
      page: 1,
      limit: 15,
      city: filtroCiudadActivo,
      operation: filtroOperacionActivo,
      search: textoBusquedaActivo,
      sort: criterioOrdenActivo,
      reset: true
    });
  } else if (datosActuales) {
    ejecutarConTransicionSuave(() => {
      renderizarInterfaz(datosActuales);
    });
  }
}

/**
 * Restablece todos los filtros del Omnibox a su estado por defecto.
 */
function restablecerTodosLosFiltros() {
  textoBusquedaActivo = "";
  filtroCiudadActivo = "";
  filtroTratoDirectoActivo = false;
  filtroHoyActivo = false;
  filtroOperacionActivo = "";

  const btnHoy = document.getElementById("cmdFilterToday");
  if (btnHoy) { btnHoy.classList.remove("active-filter"); btnHoy.setAttribute("aria-pressed", "false"); }
  const omnibox = document.getElementById("omniboxSearch");
  if (omnibox) omnibox.value = "";
  const btnClear = document.getElementById("cmdSearchClear");
  if (btnClear) btnClear.classList.remove("visible");

  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const lblLoc = document.getElementById("cmdFilterLocationLabel");
  if (lblLoc) lblLoc.textContent = isEn ? "All Cities" : "Colombia (Todas)";
  const lblOp = document.getElementById("cmdFilterOperationLabel");
  if (lblOp) lblOp.textContent = isEn ? "All Operations" : "Todas las operaciones";

  document.querySelectorAll(".cmd-filter-pill").forEach(p => p.classList.remove("active-filter", "open"));
  document.querySelectorAll(".cmd-dropdown-menu").forEach(d => d.classList.remove("show"));
  document.querySelectorAll(".cmd-filter-pill-dropdown-wrapper").forEach(w => w.classList.remove("open"));

  aplicarFiltrosOmnibox();
}

/**
 * Extrae de forma reactiva y única todas las ciudades presentes en el dataset activo o su resumen
 * y reconstruye tanto el menú desplegable táctico (desktop) como el selector off-canvas (móvil).
 * Soporta tanto arreglo de leads como objeto de resumen agregado del backend.
 * @param {Array|Object} fuente
 */
function sincronizarDropdownCiudades(fuente) {
  if (!fuente) return;

  const conteoPorCiudad = {};
  if (Array.isArray(fuente)) {
    if (fuente.length === 0) return;
    fuente.forEach(l => {
      let c = (l.ciudad || l.ubicacion || "").trim();
      if (!c) return;
      if (c.includes(",")) c = c.split(",").pop().trim();
      const cNorm = c.charAt(0).toUpperCase() + c.slice(1);
      conteoPorCiudad[cNorm] = (conteoPorCiudad[cNorm] || 0) + 1;
    });
  } else if (typeof fuente === 'object') {
    Object.assign(conteoPorCiudad, fuente);
  }

  const ciudadesOrdenadas = Object.keys(conteoPorCiudad).sort((a, b) => a.localeCompare(b, "es"));

  // 1. Dropdown Desktop en la Barra de Comandos
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const dropdown = document.getElementById("cmdLocationDropdown");
  if (dropdown) {
    let html = `
      <div class="cmd-dropdown-item ${filtroCiudadActivo === "" ? "active" : ""}" data-city="">
        <i class="fa-solid fa-earth-americas"></i>
        <span data-i18n="filter_colombia_all">${isEn ? 'Colombia (All)' : 'Colombia (Todas)'}</span>
        <i class="fa-solid fa-check item-check"></i>
      </div>
    `;

    ciudadesOrdenadas.forEach(ciudad => {
      const cLow = ciudad.toLowerCase();
      let icon = "fa-solid fa-location-dot";
      if (cLow.includes("bogot")) icon = "fa-solid fa-city";
      else if (cLow.includes("medell") || cLow.includes("antioquia")) icon = "fa-solid fa-mountain-city";
      else if (cLow.includes("cali")) icon = "fa-solid fa-tree-city";
      else if (cLow.includes("barranquilla")) icon = "fa-solid fa-anchor";
      else if (cLow.includes("cartagena") || cLow.includes("santa marta")) icon = "fa-solid fa-umbrella-beach";
      else if (cLow.includes("bucaramanga")) icon = "fa-solid fa-building";
      else if (cLow.includes("pereira") || cLow.includes("manizales")) icon = "fa-solid fa-mug-hot";

      const esActivo = filtroCiudadActivo && filtroCiudadActivo.toLowerCase() === ciudad.toLowerCase();
      const cant = conteoPorCiudad[ciudad];

      html += `
        <div class="cmd-dropdown-item ${esActivo ? "active" : ""}" data-city="${escaparHtml(ciudad)}">
          <i class="${icon}"></i>
          <span>${escaparHtml(ciudad)}</span>
          <span class="city-lead-count city-count-badge">(${cant})</span>
          <i class="fa-solid fa-check item-check"></i>
        </div>
      `;
    });

    dropdown.innerHTML = html;
  }

  // 2. Selector Móvil en el Menú Lateral Off-Canvas
  const sideSelect = document.getElementById("sideMenuCitySelect");
  if (sideSelect) {
    let selHtml = `<option value="" data-i18n="filter_all_cities">${isEn ? 'All Cities' : 'Todas las Ciudades'}</option>`;
    ciudadesOrdenadas.forEach(ciudad => {
      const sel = filtroCiudadActivo && filtroCiudadActivo.toLowerCase() === ciudad.toLowerCase() ? "selected" : "";
      selHtml += `<option value="${escaparHtml(ciudad)}" ${sel}>${escaparHtml(ciudad)} (${conteoPorCiudad[ciudad]})</option>`;
    });
    sideSelect.innerHTML = selHtml;
  }
}

/**
 * Deduplica un conjunto de leads garantizando una sola instancia canónica por oportunidad.
 * Aplica triple clave de idempotencia:
 * 1. ID único del lead
 * 2. Enlace fuente original de la publicación (Marketplace/Portal)
 * 3. Firma estructural única (título + precio + ubicación + superficie)
 * @param {Array} leads
 * @returns {Array}
 */
function deduplicarLeads(leads) {
  if (!Array.isArray(leads) || leads.length === 0) return [];
  const vistosIds = new Set();
  const vistosEnlaces = new Set();
  const vistosFirmas = new Set();

  return leads.filter((item) => {
    if (!item || typeof item !== "object") return false;

    // 1. Deduplicación por ID único
    if (item.id) {
      const idLimpio = String(item.id).trim();
      if (vistosIds.has(idLimpio)) return false;
      vistosIds.add(idLimpio);
    }

    // 2. Deduplicación por enlace original público (si no está ofuscado)
    const enlace = item.enlace || item.url;
    if (enlace && typeof enlace === "string" && enlace.length > 5 && !enlace.includes("••••")) {
      const enlaceNorm = enlace.trim().toLowerCase().split("?")[0];
      if (vistosEnlaces.has(enlaceNorm)) return false;
      vistosEnlaces.add(enlaceNorm);
    }

    // 3. Deduplicación por firma estructural
    const titNorm = normalizarTextoBusqueda(item.titulo || "");
    const prec = item.precio_raw || String(item.precio || "").replace(/\D/g, "");
    const ciuNorm = normalizarTextoBusqueda(item.ciudad || item.ubicacion || "");
    const supNorm = normalizarTextoBusqueda(item.dato_1 || item.superficie_m2 || "");

    if (titNorm && prec && ciuNorm) {
      const firma = `${titNorm}__${prec}__${ciuNorm}__${supNorm}`;
      if (vistosFirmas.has(firma)) return false;
      vistosFirmas.add(firma);
    }

    return true;
  });
}

/**
 * Filtra y ordena los leads del catálogo según los criterios activos:
 * - Búsqueda semántica/fonética en Omnibox
 * - Filtro por Ciudad
 * - Ordenamiento por menor $/m², rebajas recientes o más recientes
 * @param {Array} leads
 * @returns {Array}
 */
function filtrarYOrdenarLeads(leads) {
  if (!Array.isArray(leads)) return [];
  const leadsUnicos = deduplicarLeads(leads);

  const filtrados = leadsUnicos.filter((item) => {
    // A. Filtro por Ciudad
    if (filtroCiudadActivo) {
      const ciudadesObjetivo = filtroCiudadActivo.split("|").map(normalizarTextoBusqueda);
      const itemCiudadNorm = normalizarTextoBusqueda(item.ciudad || "");
      const itemUbicNorm = normalizarTextoBusqueda(item.ubicacion || "");
      const itemTituloNorm = normalizarTextoBusqueda(item.titulo || "");
      const itemBarrioNorm = normalizarTextoBusqueda(item.barrio || "");
      const coincideCiudad = ciudadesObjetivo.some((c) =>
        itemCiudadNorm.includes(c) || itemUbicNorm.includes(c) || itemTituloNorm.includes(c) || itemBarrioNorm.includes(c)
      );
      if (!coincideCiudad) return false;
    }

    // B. Filtro por Texto Libre (Omnibox)
    if (textoBusquedaActivo) {
      const detallesValores = item.detalles ? Object.values(item.detalles).join(' ') : '';
      const detallesEnValores = item.detalles_en ? Object.values(item.detalles_en).join(' ') : '';
      const itemSearchText = normalizarTextoBusqueda(
        `${item.titulo || ''} ${item.titulo_en || ''} ${item.tipo_inmueble || ''} ${item.tipo_inmueble_en || ''} ${item.ciudad || ''} ${item.ubicacion || ''} ${item.barrio || ''} ${item.precio || ''} ${item.precio_usd || ''} ${item.precio_m2 || ''} ${item.urgencia || ''} ${item.urgencia_en || ''} ${item.rebaja || ''} ${item.dato_1 || ''} ${item.dato_2 || ''} ${detallesValores} ${detallesEnValores} property real estate direct owner fsbo apartment house flat pool studio deal`
      );
      if (!coincideBusquedaInteligente(itemSearchText, textoBusquedaActivo)) return false;
    }

    // C. Filtro Rápido de Oportunidades del Día (Últimas 24 horas)
    if (filtroHoyActivo) {
      const ahora = Date.now();
      const UN_DIA_MS = 24 * 60 * 60 * 1000;
      const ts = Number(item.timestamp_ms || 0);
      const rel = String(item.fecha_relativa || '').toLowerCase();
      const esDeHoy = (ts > 0 && (ahora - ts) <= UN_DIA_MS) ||
        (Number(item.dias_en_mercado || 0) <= 1) ||
        rel.includes('ahora') ||
        rel.includes('min') ||
        rel.includes('hora');
      if (!esDeHoy) return false;
    }

    // D. Filtro por Tipo de Operación (Venta / Arriendo)
    if (filtroOperacionActivo) {
      const tit = normalizarTextoBusqueda(item.titulo || "");
      const op = normalizarTextoBusqueda(item.tipo_operacion || "");
      if (filtroOperacionActivo === "venta" && !tit.includes("venta") && !op.includes("venta")) return false;
      if (filtroOperacionActivo === "arriendo" && !tit.includes("arriendo") && !tit.includes("alquiler") && !op.includes("arriendo")) return false;
    }

    return true;
  });

  // E. Ordenamiento Dinámico
  if (criterioOrdenActivo === 'precio_m2_asc') {
    filtrados.sort((a, b) => {
      const m2A = Number(String(a.precio_m2 || '').replace(/\D/g, '')) || Infinity;
      const m2B = Number(String(b.precio_m2 || '').replace(/\D/g, '')) || Infinity;
      return m2A - m2B;
    });
  } else if (criterioOrdenActivo === 'rebajas') {
    filtrados.sort((a, b) => {
      const rebA = Boolean(a.rebaja && a.rebaja.trim() !== '') ? 1 : 0;
      const rebB = Boolean(b.rebaja && b.rebaja.trim() !== '') ? 1 : 0;
      return rebB - rebA;
    });
  } else if (criterioOrdenActivo === 'precio_asc') {
    filtrados.sort((a, b) => (a.precio_raw || 0) - (b.precio_raw || 0));
  } else if (criterioOrdenActivo === 'precio_desc') {
    filtrados.sort((a, b) => (b.precio_raw || 0) - (a.precio_raw || 0));
  }

  return filtrados;
}

/**
 * Cierra todos los dropdowns de la Barra de Comandos para evitar superposiciones.
 * @param {string} [exceptoId] - ID del dropdown que no debe cerrarse.
 */
function cerrarTodosLosDropdownsFiltro(exceptoId = null) {
  if (typeof cerrarMenuAutocomplete === 'function') {
    try { cerrarMenuAutocomplete(); } catch (_) {}
  }
  const configs = [
    { id: "cmdLocationDropdown", pillId: "cmdFilterLocation" },
    { id: "cmdSortDropdown", pillId: "cmdFilterSort" },
    { id: "cmdOperationDropdown", pillId: "cmdFilterOperation" }
  ];
  configs.forEach(({ id, pillId }) => {
    if (id !== exceptoId) {
      const drop = document.getElementById(id);
      const pill = document.getElementById(pillId);
      if (drop) drop.classList.remove("show");
      if (pill) {
        pill.classList.remove("open");
        pill.setAttribute("aria-expanded", "false");
        const w = pill.closest(".cmd-filter-pill-dropdown-wrapper");
        if (w) w.classList.remove("open");
      }
    }
  });
}

/**
 * Alterna el estado de un menú desplegable cerrando los demás.
 * @param {HTMLElement} pill
 * @param {HTMLElement} dropdown
 */
function alternarDropdownFiltro(pill, dropdown) {
  if (!pill || !dropdown) return;
  const yaAbierto = dropdown.classList.contains("show");
  cerrarTodosLosDropdownsFiltro(dropdown.id);
  const nuevoEstado = !yaAbierto;
  dropdown.classList.toggle("show", nuevoEstado);
  pill.classList.toggle("open", nuevoEstado);
  pill.setAttribute("aria-expanded", String(nuevoEstado));
  const wrapper = pill.closest(".cmd-filter-pill-dropdown-wrapper");
  if (wrapper) wrapper.classList.toggle("open", nuevoEstado);
}

/**
 * Inicializa el selector táctico de ordenamiento en la Barra de Comandos.
 */
function inicializarBarraOrdenamiento() {
  const pillSort = document.getElementById("cmdFilterSort");
  const dropdownSort = document.getElementById("cmdSortDropdown");
  const labelSort = document.getElementById("cmdFilterSortLabel");
  if (!pillSort || !dropdownSort) return;

  pillSort.addEventListener("click", (e) => {
    e.stopPropagation();
    alternarDropdownFiltro(pillSort, dropdownSort);
  });

  dropdownSort.addEventListener("click", (e) => {
    const item = e.target.closest(".cmd-dropdown-item");
    if (!item) return;
    e.stopPropagation();
    const sortValue = item.getAttribute("data-sort") || "recientes";
    criterioOrdenActivo = sortValue;

    dropdownSort.querySelectorAll(".cmd-dropdown-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");

    const spanText = item.querySelector("span") ? item.querySelector("span").textContent : "Más Recientes";
    if (labelSort) labelSort.textContent = spanText;

    pillSort.classList.toggle("active-filter", sortValue !== "recientes");
    cerrarTodosLosDropdownsFiltro();
    aplicarFiltrosOmnibox();
  });

  inicializarBarraOperacion();
}

/**
 * Inicializa el selector de tipo de operación (Todas / Venta / Arriendo).
 */
function inicializarBarraOperacion() {
  const pillOp = document.getElementById("cmdFilterOperation");
  const dropOp = document.getElementById("cmdOperationDropdown");
  const lblOp = document.getElementById("cmdFilterOperationLabel");
  if (!pillOp || !dropOp) return;

  pillOp.addEventListener("click", (e) => {
    e.stopPropagation();
    alternarDropdownFiltro(pillOp, dropOp);
  });

  dropOp.addEventListener("click", (e) => {
    const it = e.target.closest(".cmd-dropdown-item");
    if (!it) return;
    e.stopPropagation();
    filtroOperacionActivo = it.getAttribute("data-operation") || "";
    dropOp.querySelectorAll(".cmd-dropdown-item").forEach(i => i.classList.remove("active"));
    it.classList.add("active");
    if (lblOp) lblOp.textContent = it.querySelector("span")?.textContent || "Todas las operaciones";
    pillOp.classList.toggle("active-filter", filtroOperacionActivo !== "");
    cerrarTodosLosDropdownsFiltro();
    aplicarFiltrosOmnibox();
  });
}

/**
 * Inicializa el botón de filtro rápido para oportunidades captadas en el día.
 */
function inicializarFiltroHoy() {
  const btnHoy = document.getElementById("cmdFilterToday");
  if (!btnHoy) return;

  btnHoy.addEventListener("click", () => {
    filtroHoyActivo = !filtroHoyActivo;
    btnHoy.classList.toggle("active-filter", filtroHoyActivo);
    btnHoy.setAttribute("aria-pressed", String(filtroHoyActivo));
    aplicarFiltrosOmnibox();
  });
}

// Cierre global seguro de dropdowns al hacer clic fuera
if (typeof window !== "undefined") {
  window.addEventListener("click", (e) => {
    if (!e.target.closest(".cmd-filter-pill-dropdown-wrapper")) {
      cerrarTodosLosDropdownsFiltro();
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DICCIONARIO_TERMINOS,
    normalizarTextoBusqueda,
    coincideBusquedaInteligente,
    deduplicarLeads,
    filtrarYOrdenarLeads,
    cerrarTodosLosDropdownsFiltro
  };
}


/**
 * 🎠 MÓDULO DE CARRUSELES Y FICHA TÉCNICA (modules/05-carousel.js)
 * Carruseles fotográficos táctiles, navegación y drawer slide-up de detalles.
 * Estándar Ecosistema Desmulta UI/UX.
 */

/**
 * Desplaza las diapositivas del carrusel fotográfico.
 * @param {number} cardIndex
 * @param {number} delta
 * @param {number} totalFotos
 * @param {Event} event
 */
function moverCarrusel(cardIndex, delta, totalFotos, event) {
  if (event) event.stopPropagation();
  if (typeof carruselIndices[cardIndex] !== 'number') carruselIndices[cardIndex] = 0;

  const actual = carruselIndices[cardIndex];
  const nuevo = (actual + delta + totalFotos) % totalFotos;
  carruselIndices[cardIndex] = nuevo;

  actualizarVistaCarrusel(cardIndex, nuevo);
}

/**
 * Mueve el carrusel a una diapositiva específica.
 * @param {number} cardIndex
 * @param {number} targetIndex
 * @param {Event} event
 */
function irACarrusel(cardIndex, targetIndex, event) {
  if (event) event.stopPropagation();
  carruselIndices[cardIndex] = targetIndex;
  actualizarVistaCarrusel(cardIndex, targetIndex);
}

/**
 * Actualiza las clases visuales de slides y dots para un carrusel.
 * @param {number} cardIndex
 * @param {number} activeIndex
 */
function actualizarVistaCarrusel(cardIndex, activeIndex) {
  const track = document.getElementById(`carousel-${cardIndex}`);
  if (!track) return;

  const slides = track.querySelectorAll('.carousel-slide');
  slides.forEach((slide, sIdx) => {
    if (sIdx === activeIndex) {
      slide.classList.add('active');
      // Carga bajo demanda de la foto activa si aún no se ha descargado
      const img = slide.querySelector('img[data-src]');
      if (img) {
        img.decoding = 'async';
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      }
    } else {
      slide.classList.remove('active');
    }
  });

  // Precarga proactiva del siguiente slide para respuesta instantánea sin peso inicial
  if (slides.length > 1) {
    const nextIdx = (activeIndex + 1) % slides.length;
    const nextImg = slides[nextIdx]?.querySelector('img[data-src]');
    if (nextImg) {
      nextImg.decoding = 'async';
      nextImg.src = nextImg.dataset.src;
      nextImg.removeAttribute('data-src');
    }
  }

  const dotsContainer = document.getElementById(`dots-${cardIndex}`);
  if (dotsContainer) {
    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    dots.forEach((dot, dIdx) => {
      if (dIdx === activeIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  const photoBadge = document.getElementById(`carousel-badge-${cardIndex}`);
  if (photoBadge && slides.length > 0) {
    photoBadge.innerHTML = `<i class="fa-regular fa-image"></i> ${activeIndex + 1}/${slides.length}`;
  }
}

/**
 * Abre el panel deslizable de la Ficha Técnica (Slide-Up Drawer).
 * @param {number} index
 * @param {Event} event
 */
function abrirFichaTecnica(index, event) {
  if (event) event.stopPropagation();
  const overlay = document.getElementById(`slideup-${index}`);
  if (overlay) overlay.classList.add('active');
}

/**
 * Cierra el panel deslizable de la Ficha Técnica.
 * @param {number} index
 * @param {Event} event
 */
function cerrarFichaTecnica(index, event) {
  if (event) event.stopPropagation();
  const overlay = document.getElementById(`slideup-${index}`);
  if (overlay) overlay.classList.remove('active');
}

/**
 * Inicializa gestos táctiles en carruseles sin interferir con el scroll vertical.
 * @param {HTMLElement} trackEl
 * @param {number} cardIndex
 * @param {number} totalFotos
 */
function habilitarSwipeTactilCarrusel(trackEl, cardIndex, totalFotos) {
  if (!trackEl || trackEl.dataset.deslizamientoConfigurado === "true" || totalFotos <= 1) return;
  trackEl.dataset.deslizamientoConfigurado = "true";

  let startX = 0;
  let startY = 0;
  let isSwiping = false;

  trackEl.addEventListener("touchstart", (event) => {
    if (!event.touches || event.touches.length !== 1) return;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    isSwiping = true;
  }, { passive: true });

  trackEl.addEventListener("touchmove", (event) => {
    if (!isSwiping || !event.touches || event.touches.length !== 1) return;
    const diffY = Math.abs(event.touches[0].clientY - startY);
    const diffX = Math.abs(event.touches[0].clientX - startX);

    if (diffY > diffX && diffY > 15) {
      isSwiping = false;
    }
  }, { passive: true });

  trackEl.addEventListener("touchend", (event) => {
    if (!isSwiping) return;
    isSwiping = false;
    const touch = event.changedTouches ? event.changedTouches[0] : null;
    if (!touch) return;

    const diffX = touch.clientX - startX;
    const diffY = Math.abs(touch.clientY - startY);

    if (Math.abs(diffX) >= 35 && Math.abs(diffX) > diffY) {
      moverCarrusel(cardIndex, diffX < 0 ? 1 : -1, totalFotos);
    }
  }, { passive: true });
}



/**
 * 🃏 MÓDULO DE RENDERIZADO BENTO GRID (modules/06-cards.js)
 * Renderizado de oportunidades, skeletons, badges ejecutivos, formateo de precios
 * y soporte bilingüe adaptativo (ES/EN) con sello verificado.
 * Estándar Ecosistema Desmulta UI/UX (< 500 líneas).
 */

/**
 * Data URI del SVG vectorial corporativo de fallback en caso de indisponibilidad de imagen externa.
 * Optimizado a nivel de bytes, no bloqueante y 100% resiliente sin dependencia de red.
 */
const FALLBACK_INMUEBLE_SVG = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0b131e"/><stop offset="50%" stop-color="#111b2b"/><stop offset="100%" stop-color="#060a11"/></linearGradient><radialGradient id="glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#10b981" stop-opacity="0.22"/><stop offset="100%" stop-color="#10b981" stop-opacity="0"/></radialGradient></defs><rect width="800" height="500" fill="url(#bg)"/><rect width="800" height="500" fill="url(#glow)"/><g transform="translate(400, 215)" text-anchor="middle"><circle cx="0" cy="-10" r="50" fill="#10b981" fill-opacity="0.08" stroke="#10b981" stroke-width="2" stroke-dasharray="5 3"/><path d="M-26 10 L0 -16 L26 10 L17 10 L17 28 L-17 28 L-17 10 Z" fill="none" stroke="#10b981" stroke-width="3" stroke-linejoin="round"/><rect x="-6" y="14" width="12" height="14" fill="#10b981" fill-opacity="0.3" rx="1"/><text y="78" fill="#e2e8f0" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="2.5">ORIGGO DIRECT</text><text y="100" fill="#64748b" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="500" letter-spacing="1">VERIFIED PROPERTY</text></g></svg>'
);

/**
 * Manejador resiliente de fallo de carga de imagen de lead.
 * Sustituye de inmediato la imagen rota por un placeholder SVG esmeralda corporativo.
 * @param {HTMLImageElement} imgEl
 */
function manejarErrorImagenLead(imgEl) {
  if (!imgEl || imgEl._fallbackAplicado) return;
  imgEl._fallbackAplicado = true;
  imgEl.onerror = null;
  imgEl.src = FALLBACK_INMUEBLE_SVG;
  imgEl.classList.add('img-fallback-applied');
}
if (typeof window !== 'undefined') window.manejarErrorImagenLead = manejarErrorImagenLead;

/**
 * Formatea un precio con el símbolo $ separado sin mostrar jamás 'COP'.
 * @param {string} precioStr
 * @returns {string}
 */
function formatearPrecioDisplay(precioStr) {
  if (!precioStr) return '<span class="price-currency-sign">$</span> <span class="price-number">0</span>';
  let str = String(precioStr).replace(/COP|USD|pesos/gi, '').trim();
  if (str.startsWith('$')) str = str.substring(1).trim();
  return `<span class="price-currency-sign">$</span> <span class="price-number">${escaparHtml(str)}</span>`;
}

/**
 * Genera el marcado de tarjetas esqueleto con efecto Shimmer Bento acelerado por GPU.
 * @param {number} [cantidad=6]
 * @returns {string}
 */
function generarHtmlSkeletons(cantidad = 6) {
  const n = Math.max(1, Math.min(12, Number(cantidad) || 6));
  return Array(n).fill(0).map((_, i) => `
    <article class="bento-card skeleton-card skeleton-delay-${i % 6}" aria-busy="true" aria-label="Cargando oportunidad...">
      <div class="skeleton-media skeleton-shimmer"></div>
      <div class="card-body skeleton-body">
        <div class="skeleton-line skeleton-shimmer skeleton-line-sm"></div>
        <div class="skeleton-line skeleton-shimmer skeleton-line-lg"></div>
        <div class="skeleton-box skeleton-shimmer skeleton-box-data"></div>
        <div class="skeleton-footer"><div class="skeleton-line skeleton-shimmer skeleton-line-price"></div><div class="skeleton-btn skeleton-shimmer skeleton-btn-ph"></div></div>
      </div>
    </article>`).join('');
}

/**
 * Inyecta temporalmente los skeletons Shimmer en el contenedor Bento Grid.
 * @param {number} [cantidad=6]
 */
function mostrarSkeletonsCargaBento(cantidad = 6) {
  const c = document.getElementById("bentoGridContainer");
  if (c) c.innerHTML = generarHtmlSkeletons(cantidad);
}
if (typeof window !== 'undefined') {
  window.generarHtmlSkeletons = generarHtmlSkeletons;
  window.mostrarSkeletonsCargaBento = mostrarSkeletonsCargaBento;
}

/**
 * Formatea dinámicamente el tiempo relativo transcurrido (Bilingüe ES/EN).
 * @param {number|string} timestampMs
 * @param {string} [fallback]
 * @returns {string}
 */
function formatearTiempoRelativo(timestampMs, fallback) {
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  if (!timestampMs || isNaN(Number(timestampMs))) {
    if (fallback && isEn) {
      const f = String(fallback).toLowerCase();
      if (f.includes('justo')) return '⚡ Just now';
      const m = f.match(/hace\s+(\d+)\s*(h|m|d|hora|min)/);
      if (m) return `${m[1]}${m[2].charAt(0)} ago`;
      return f.includes('hoy') ? 'Today' : (f.includes('ayer') ? 'Yesterday' : 'Recent');
    }
    return fallback || (isEn ? 'Recent' : 'Reciente');
  }
  const diffMs = Date.now() - Number(timestampMs);
  if (diffMs < 0) return isEn ? '⚡ Just now' : '⚡ Justo ahora';
  const diffMin = Math.floor(diffMs / 60000), diffHoras = Math.floor(diffMin / 60), diffDias = Math.floor(diffHoras / 24);
  if (diffMin < 1) return isEn ? '⚡ Just now' : '⚡ Justo ahora';
  if (diffMin < 60) return isEn ? `${diffMin}m ago` : `Hace ${diffMin} min`;
  if (diffHoras < 24) return isEn ? `${diffHoras}h ago` : `Hace ${diffHoras} ${diffHoras === 1 ? 'hora' : 'horas'}`;
  if (diffDias < 30) return isEn ? `${diffDias}d ago` : `Hace ${diffDias} ${diffDias === 1 ? 'día' : 'días'}`;
  return isEn ? 'Recent' : (fallback || 'Reciente');
}

/**
 * Recalcula y actualiza contadores de tiempo en todas las tarjetas del DOM.
 */
function actualizarTiemposRelativosEnDOM() {
  document.querySelectorAll('.badge-time-pill[data-timestamp]').forEach((pill) => {
    const ts = pill.getAttribute('data-timestamp'), txtEl = pill.querySelector('.time-relative-text');
    if (ts && txtEl) txtEl.textContent = formatearTiempoRelativo(Number(ts), txtEl.textContent);
  });
}

/**
 * Traduce el badge de urgencia / estatus al idioma actual.
 */
function traducirBadgeUrgencia(urgencia, isEn) {
  if (!urgencia || !isEn) return urgencia || '';
  const u = String(urgencia).toLowerCase();
  if (u.includes('oportunidad') || u.includes('trato directo')) return '🔥 Direct Deal';
  if (u.includes('traslado')) return '🔥 Urgent Relocation';
  if (u.includes('ganga')) return '📉 Bargain Deal';
  if (u.includes('venta rápida')) return '💼 Quick Sale';
  if (u.includes('arbitraje')) return '⚡ High Arbitrage';
  if (u.includes('rebaja')) return '📉 Price Drop';
  return u.includes('cerrado') ? 'Closed' : (u.includes('urgente') ? 'Urgent' : urgencia);
}

/**
 * Traduce la distribución de ambientes (ej. "3 Hab • 2 Baños • 1 Garajes").
 */
function traducirDatoDistribucion(val, isEn) {
  if (!isEn || !val) return val || 'N/A';
  return String(val)
    .replace(/\b1\s*Hab\b/gi, '1 Bed').replace(/(\d+)\s*Hab\b/gi, '$1 Beds')
    .replace(/\b1\s*Baño\b/gi, '1 Bath').replace(/(\d+)\s*Baños?\b/gi, '$1 Baths')
    .replace(/\b1\s*Garajes?\b/gi, '1 Parking').replace(/(\d+)\s*Garajes?\b/gi, '$1 Parking');
}

/**
 * Traduce títulos de inmuebles del catálogo según el idioma seleccionado.
 */
function traducirTituloCatalogo(titulo, isEn) {
  if (!isEn || !titulo) return titulo || '';
  return String(titulo)
    .replace(/^Apartamento\s+en\s+Venta\b/gi, 'Apartment for Sale')
    .replace(/^Casa\s+en\s+Venta\b/gi, 'House for Sale')
    .replace(/^Lote\s+en\s+Venta\b/gi, 'Land / Lot for Sale')
    .replace(/^Oficina\s+en\s+Venta\b/gi, 'Office for Sale')
    .replace(/^Finca\s+en\s+Venta\b/gi, 'Country Estate for Sale')
    .replace(/^Local\s+en\s+Venta\b/gi, 'Commercial Space for Sale')
    .replace(/^Bodega\s+en\s+Venta\b/gi, 'Warehouse for Sale')
    .replace(/\ben\s+Venta\b/gi, 'for Sale');
}

/**
 * Traduce el tipo de propiedad de manera determinista.
 */
function traducirTipoInmueble(tipo, isEn) {
  if (!isEn || !tipo) return tipo || '';
  const m = {
    apartamento: 'Apartment', casa: 'House', lote: 'Land / Plot',
    oficina: 'Office', finca: 'Country Estate', local: 'Commercial Space', bodega: 'Warehouse'
  };
  return m[tipo.toLowerCase().trim()] || tipo;
}

/**
 * Traduce especificaciones del Slide-up Drawer con sello verificado.
 * ✅ HAL-05: El HTML del badge se genera localmente basándose SOLO en la clave del campo,
 * nunca en el valor del JSON externo. Todos los valores del dataset se escapan siempre.
 */
function traducirSlideupDetalles(detalles, isEn) {
  if (!detalles) return {};
  const salida = {};
  for (const [k, v] of Object.entries(detalles)) {
    const kLow = k.toLowerCase();
    let kTrad = k, vTrad = String(v || 'N/A');
    if (isEn) {
      const mapaClaves = { estrato: 'Stratum', 'área': 'Built Area', superficie: 'Built Area', hab: 'Bedrooms', alcoba: 'Bedrooms', 'baño': 'Bathrooms', parqueadero: 'Parking', garaje: 'Parking', contacto: 'Contact', 'ubicación': 'Location', tipo: 'Property Type', 'operación': 'Deal Type' };
      for (const [sub, trad] of Object.entries(mapaClaves)) {
        if (kLow.includes(sub)) { kTrad = trad; break; }
      }

      vTrad = vTrad
        .replace(/(\d+)\s*Residencial/gi, '$1 Residential')
        .replace(/\b1\s*alcobas?\b/gi, '1 Bedroom').replace(/(\d+)\s*alcobas?\b/gi, '$1 Bedrooms')
        .replace(/\b1\s*completos?\b/gi, '1 Full Bath').replace(/(\d+)\s*completos?\b/gi, '$1 Full Baths')
        .replace(/\b1\s*espacios?\b/gi, '1 Space').replace(/(\d+)\s*espacios?\b/gi, '$1 Spaces')
        .replace(/Propietario Verificado/gi, 'Verified Owner')
        .replace(/Venta Directa con Propietario/gi, 'Direct Sale with Owner');
    } else {
      vTrad = vTrad.replace(/\b1 espacios\b/gi, '1 espacio').replace(/\b1 alcobas\b/gi, '1 alcoba').replace(/\b1 completos\b/gi, '1 completo');
    }

    // ✅ HAL-05 REMEDIACIÓN: El badge de "Verificado" se genera localmente basándose SOLO en la CLAVE.
    // Se elimina la detección de strings del valor externo del JSON para evitar XSS.
    // NUNCA se confía en el valor del dataset para emitir HTML sin escapar.
    const esCampoContacto = kLow.includes('contacto') || kTrad.toLowerCase().includes('contact');
    if (esCampoContacto) {
      salida[kTrad] = `<span class="verified-badge-wrap"><i class="fa-solid fa-circle-check verified-badge-icon"></i> ${isEn ? 'Verified Owner' : 'Propietario Verificado'}</span>`;
    } else {
      salida[kTrad] = escaparHtml(vTrad); // ← SIEMPRE escapar valores del JSON externo
    }
  }
  return salida;
}

/**
 * Renderiza la interfaz utilizando Mapeo Dinámico de Llaves (Content-Agnostic) y Dark Luxury Cards.
 * @param {Object} dataset
 */
function renderizarInterfaz(dataset) {
  const config = dataset.config || {}, leads = dataset.leads || [];
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const dict = typeof DICCIONARIO_I18N !== 'undefined' ? (DICCIONARIO_I18N[isEn ? 'en' : 'es'] || {}) : {};

  if (typeof sincronizarDropdownCiudades === 'function') sincronizarDropdownCiudades(leads);
  if (typeof poblarEstadisticasHero === 'function') poblarEstadisticasHero(dataset);

  const elTitle = document.getElementById("heroTitle"), elSubtitle = document.getElementById("heroSubtitle");
  const elBadgeSectores = document.getElementById("badgeSectores"), elBadgeSectoresHero = document.getElementById("badgeSectoresHero");

  if (elTitle) {
    elTitle.innerHTML = isEn ? (dict.hero_title || 'Properties for sale <span class="editorial-italic">directly</span> from owners') : 'Inmuebles en venta <span class="editorial-italic">directo</span> de sus dueños';
  }
  if (elSubtitle) {
    elSubtitle.textContent = isEn ? (dict.hero_subtitle || 'Zero middleman and zero agency commissions. Fresh off-market opportunities and urgent price drops detected today in Colombia.') : (config.subtitulo && !config.subtitulo.toLowerCase().includes('radar de captación') ? config.subtitulo : 'Sin intermediarios ni comisiones de inmobiliaria. Oportunidades y rebajas de urgencia detectadas hoy en Colombia antes de que lleguen a las agencias.');
  }
  if (config.total_sectores_monitoreados) {
    const txt = isEn ? `${config.total_sectores_monitoreados} ${dict.hero_badge_suffix || 'Districts Monitored in Real Time'}` : `${config.total_sectores_monitoreados} Sectores Monitoreados en Tiempo Real`;
    if (elBadgeSectores) elBadgeSectores.textContent = txt;
    if (elBadgeSectoresHero) elBadgeSectoresHero.textContent = txt;
  }
  const countEl = document.getElementById("catalogCountText");
  if (countEl) {
    countEl.textContent = isEn ? `${leads.length} ${leads.length === 1 ? (dict.catalog_count_single || 'direct opportunity') : (dict.catalog_count_suffix || 'direct opportunities')}` : `${leads.length} oportunidades directas`;
  }
  const headingEl = document.getElementById("catalogHeading");
  if (headingEl) headingEl.textContent = isEn ? (dict.catalog_heading || "Live Direct Listings") : "Inmuebles Directos en Vivo";

  const container = document.getElementById("bentoGridContainer");
  if (!container) return;
  if (leads.length === 0) {
    container.innerHTML = `<div class="empty-state-msg"><p>${isEn ? 'No active opportunities recorded at this time.' : 'No hay oportunidades activas registradas en este momento.'}</p></div>`;
    return;
  }

  const col1NombreRaw = config.columna_variable_1 || "Atributo 1", col2NombreRaw = config.columna_variable_2 || "Atributo 2";
  const col1Nombre = isEn ? (col1NombreRaw.toLowerCase().includes('superficie') ? 'Area' : col1NombreRaw) : col1NombreRaw;
  const col2Nombre = isEn ? (col2NombreRaw.toLowerCase().includes('distribución') ? 'Layout' : col2NombreRaw) : col2NombreRaw;

  const esServerless = Boolean(dataset && (dataset.totalPages !== undefined || dataset.total !== undefined));
  const totalPaginas = esServerless ? (dataset.totalPages || 1) : Math.ceil(leadsFiltrados.length / limiteVisible);
  if (!esServerless && paginaActual > totalPaginas && totalPaginas > 0) paginaActual = totalPaginas;
  const leadsVisibles = esServerless ? leads : leadsFiltrados.slice((paginaActual - 1) * limiteVisible, paginaActual * limiteVisible);

  if (countEl) {
    const sufijoCiudad = filtroCiudadActivo ? (isEn ? ` in ${filtroCiudadActivo}` : ` en ${filtroCiudadActivo}`) : '';
    const conteoTotal = esServerless ? (dataset.total || leads.length) : leadsFiltrados.length;
    countEl.textContent = isEn ? `${conteoTotal} ${conteoTotal === 1 ? (dict.catalog_count_single || 'direct opportunity') : (dict.catalog_count_suffix || 'direct opportunities')}${sufijoCiudad}` : `${conteoTotal} oportunidad${conteoTotal === 1 ? '' : 'es'} directa${conteoTotal === 1 ? '' : 's'}${sufijoCiudad}`;
  }

  let htmlContenido = leadsVisibles.map((item, visibleIdx) => {
    const index = dataset.leads.indexOf(item), claseUrgencia = item.urgencia_tipo || "urgente";
    const imgUrl = item.imagen || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80";
    const tieneMultiplesFotos = Array.isArray(item.imagenes) && item.imagenes.length > 1;
    const fotos = tieneMultiplesFotos ? item.imagenes : [imgUrl];

    let mediaHtml = '';
    if (tieneMultiplesFotos) {
      mediaHtml = `<div class="carousel-track" id="carousel-${index}">
        ${fotos.map((foto, fIdx) => `<div class="carousel-slide ${fIdx === 0 ? 'active' : ''}" data-slide="${fIdx}"><img ${fIdx === 0 ? `src="${escaparHtml(foto)}"` : `data-src="${escaparHtml(foto)}"`} alt="${escaparHtml(item.titulo)} - Foto ${fIdx + 1}" class="carousel-img" ${visibleIdx < 3 && fIdx === 0 ? 'fetchpriority="high" loading="eager"' : 'loading="lazy" fetchpriority="low"'} decoding="async" onerror="manejarErrorImagenLead(this)" /></div>`).join('')}
        <button class="carousel-nav-btn prev" data-action="carrusel-prev" data-index="${index}" data-total="${fotos.length}" title="${isEn ? 'Previous photo' : 'Foto Anterior'}"><i class="fa-solid fa-chevron-left"></i></button>
        <button class="carousel-nav-btn next" data-action="carrusel-next" data-index="${index}" data-total="${fotos.length}" title="${isEn ? 'Next photo' : 'Siguiente Foto'}"><i class="fa-solid fa-chevron-right"></i></button>
        <div class="carousel-dots" id="dots-${index}">${fotos.map((_, fIdx) => `<span class="carousel-dot ${fIdx === 0 ? 'active' : ''}" data-dot="${fIdx}"></span>`).join('')}</div>
      </div>`;
    } else {
      mediaHtml = `<img src="${escaparHtml(imgUrl)}" alt="${escaparHtml(item.titulo)}" class="card-static-img" ${visibleIdx < 3 ? 'fetchpriority="high" loading="eager"' : 'loading="lazy" fetchpriority="low"'} decoding="async" onerror="manejarErrorImagenLead(this)" />`;
    }

    const estaDesbloqueado = sesionUsuario && Array.isArray(sesionUsuario.unlockedLeads) && sesionUsuario.unlockedLeads.includes(item.id);
    const contacto = estaDesbloqueado ? (cacheContactosDesbloqueados[item.id] || null) : null;
    const contactoSeguro = sanitizarContactoCliente(contacto);
    const datosRev = contacto?._datosRevelados || null;
    const portalNombre = item.portal || ((item.enlace_bloqueado || item.enlace || '').toLowerCase().includes('metrocuadrado') ? 'Metrocuadrado' : 'Finca Raíz');

    const tiempoRelativoTexto = formatearTiempoRelativo(item.timestamp_ms, item.fecha_relativa);
    const statusBadgeTexto = (isEn && item.urgencia_en) ? item.urgencia_en : traducirBadgeUrgencia(item.urgencia, isEn);
    const ubicacionTexto = isEn && item.ubicacion ? item.ubicacion.replace(/Estrato\s*(\d+)/gi, 'Stratum $1') : (item.ubicacion || '');
    const ubicacionFinal = (estaDesbloqueado && datosRev?.ubicacionCompleta) ? datosRev.ubicacionCompleta : ubicacionTexto;
    const tituloBase = (isEn && item.titulo_en) ? item.titulo_en : traducirTituloCatalogo(item.titulo, isEn);
    const tituloFinal = (estaDesbloqueado && datosRev?.tituloOriginal) ? datosRev.tituloOriginal : tituloBase;
    const dato2Texto = traducirDatoDistribucion(item.dato_2, isEn);

    const detallesBase = (isEn && item.detalles_en) ? item.detalles_en : (item.detalles || {});
    const detalles = Object.keys(detallesBase).length > 0 ? { ...detallesBase, [isEn ? "Location" : "Ubicación"]: ubicacionFinal } : { [col1NombreRaw]: item.dato_1 || "No especificado", [col2NombreRaw]: item.dato_2 || "No especificado", [isEn ? "Location" : "Ubicación"]: ubicacionFinal, [isEn ? "Property Type" : "Tipo"]: (isEn && item.tipo_inmueble_en) ? item.tipo_inmueble_en : (item.tipo_inmueble || "Propiedad Residencial"), [isEn ? "Deal Type" : "Operación"]: isEn ? "Direct Deal with Owner" : "Venta Directa con Propietario" };
    const detallesTraducidos = (isEn && item.detalles_en) ? detalles : traducirSlideupDetalles(detalles, isEn);

    const tipoBase = (isEn && item.tipo_inmueble_en) ? item.tipo_inmueble_en : (item.tipo_inmueble || (isEn ? 'Property' : 'Inmueble'));
    const tipoOp = isEn ? `${tipoBase} for Sale` : `${tipoBase} en Venta`;
    const barrioTexto = item.barrio ? item.barrio.trim() : '';
    const ciudadTexto = item.ciudad ? item.ciudad.trim() : '';
    const zonaTexto = barrioTexto ? (ciudadTexto ? `${barrioTexto}, ${ciudadTexto}` : barrioTexto) : ciudadTexto;
    const subtituloEditorial = zonaTexto ? `${tipoOp} · ${zonaTexto}` : tipoOp;

    const areaLimpia = (item.dato_1 || '').replace(/Superficie\s*/i, '').trim();
    const distLimpia = (dato2Texto || '').replace(/\s*[•·]\s*/g, ' · ').trim();
    const specsInline = [areaLimpia, distLimpia].filter(Boolean).join(' · ');

    const claseRetrasoEntrada = index === 1 ? 'enter-delay-soft' : '';
    const detallesStr = item.detalles ? Object.entries(item.detalles).map(([k, v]) => `${k} ${v}`).join(' ') : '';
    const corpusBruto = [item.titulo, item.ubicacion, item.barrio, item.ciudad, item.tipo_inmueble, item.urgencia, item.rebaja, item.dato_1, item.dato_2, item.precio, item.precio_m2, detallesStr, 'inmueble propiedad vivienda particular directo dueno property real estate direct owner fsbo apartment house flat'].filter(Boolean).join(' ');
    const searchDataCorpus = normalizarTextoBusqueda(corpusBruto), ciudadNorm = normalizarTextoBusqueda(item.ciudad || ''), barrioNorm = normalizarTextoBusqueda(item.barrio || '');

    return `
      <article class="bento-card ${estaDesbloqueado ? 'card-unlocked' : ''} ${claseRetrasoEntrada}" data-index="${index}" data-lead-id="${escaparHtml(item.id || '')}" data-ciudad="${escaparHtml(item.ciudad || '')}" data-ciudad-norm="${escaparHtml(ciudadNorm)}" data-barrio-norm="${escaparHtml(barrioNorm)}" data-tipo="${escaparHtml(item.tipo_inmueble || '')}" data-search="${escaparHtml(searchDataCorpus)}">
        <div class="card-media-wrapper" data-action="abrir-ficha" data-index="${index}">
          ${mediaHtml}
          ${tieneMultiplesFotos ? `<span class="carousel-photo-badge" id="carousel-badge-${index}"><i class="fa-regular fa-image"></i> 1/${fotos.length}</span>` : ''}
          <div class="card-media-gradient"></div>
          <div class="card-floating-badges">
            <span class="badge-time-pill" data-timestamp="${item.timestamp_ms || ''}"><i class="fa-regular fa-clock"></i> <span class="time-relative-text">${escaparHtml(tiempoRelativoTexto)}</span></span>
            ${estaDesbloqueado ? `<span class="card-unlocked-badge"><i class="fa-solid fa-unlock"></i> ${isEn ? 'Unlocked' : 'Desbloqueado'}</span>` : ''}
          </div>
        </div>

        <div class="card-body">
          <div>
            <div class="card-price-row">
              <div class="price-main">${formatearPrecioDisplay(item.precio)}</div>
              <button class="btn-specs-pill" data-action="abrir-ficha" data-index="${index}" title="${isEn ? 'View Dossier' : 'Ver Ficha'}">${isEn ? 'Dossier' : 'Ficha'} <i class="fa-solid fa-chevron-up"></i></button>
            </div>
            <div class="card-location"><i class="fa-solid fa-location-dot"></i> <span>${escaparHtml(subtituloEditorial)}</span></div>
            <h3 class="card-title" data-action="abrir-ficha" data-index="${index}">${escaparHtml(tituloFinal)}</h3>
            ${specsInline ? `<div class="card-specs-inline" data-action="abrir-ficha" data-index="${index}" title="${isEn ? 'Click to open details' : 'Click para ver detalles'}"><i class="fa-solid fa-ruler-combined"></i> <span>${escaparHtml(specsInline)}</span></div>` : ''}
            ${(estaDesbloqueado && contacto) ? `<div class="card-contact-phone-bar"><span><i class="fa-solid fa-phone"></i> <strong class="contact-phone-number">${escaparHtml(contacto?.telefonoDisplay || contacto?.telefono || (isEn ? 'View in Ad' : 'Ver en Anuncio'))}</strong></span><span class="unlocked-portal-pill"><i class="fa-solid fa-building-flag"></i> ${escaparHtml(portalNombre)}</span></div>` : ''}
          </div>

          <div class="card-bottom-row">
            ${estaDesbloqueado && contacto ? `
              <div class="unlocked-action-cluster">
                ${contactoSeguro?.enlace ? `<a href="${contactoSeguro.enlace}" target="_blank" rel="noopener noreferrer" class="btn-view-ad-direct" title="${isEn ? 'View original owner listing' : 'Ver anuncio original'}"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${isEn ? 'View Listing' : 'Ver Anuncio'}</a>` : ''}
                ${contactoSeguro?.whatsappUrl ? `<a href="${contactoSeguro.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-direct btn-whatsapp-compact" title="WhatsApp" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}
                ${contactoSeguro?.telLlamar ? `<a href="tel:${contactoSeguro.telLlamar}" class="btn-call-direct" title="${isEn ? 'Call Owner' : 'Llamar al dueño'}" aria-label="Llamar"><i class="fa-solid fa-phone"></i> ${isEn ? 'Call' : 'Llamar'}</a>` : ''}
              </div>
            ` : estaDesbloqueado && !contacto ? `
              <button class="btn-unlock-lead btn-already-unlocked" data-action="revelar-desbloqueado" data-index="${index}">
                <i class="fa-solid fa-lock-open"></i> ${isEn ? 'Reveal Contact (Unlocked)' : 'Ver Contacto (Desbloqueado)'}
              </button>
            ` : `
              <button class="btn-unlock-lead btn-action-primary ${item.urgencia_tipo === 'cerrado' ? 'closed' : ''}" data-action="abrir-checkout" data-index="${index}">
                <i class="fa-solid fa-lock"></i> ${item.urgencia_tipo === 'cerrado' ? (isEn ? 'View Closed' : 'Ver Cierre') : (isEn ? 'View Direct Contact' : 'Ver Contacto Directo')}
              </button>
            `}
          </div>
        </div>

        <div class="card-slideup-overlay" id="slideup-${index}">
          <div class="slideup-header">
            <div class="slideup-title"><i class="fa-solid fa-circle-info"></i> ${escaparHtml(estaDesbloqueado && datosRev?.tituloOriginal ? datosRev.tituloOriginal : (isEn ? 'Property Overview' : 'Detalles de la Propiedad'))}</div>
            <button class="btn-slideup-close" data-action="cerrar-ficha" data-index="${index}" title="${isEn ? 'Close Details' : 'Cerrar Detalles'}"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="slideup-body">
            <div class="slideup-specs-grid">
              ${item.precio_m2 ? `<div class="slideup-spec-card"><span class="slideup-spec-key"><i class="fa-solid fa-calculator"></i> ${isEn ? 'Rate per m²' : 'Valor por m²'}</span><span class="slideup-spec-val">${escaparHtml(item.precio_m2)}</span></div>` : ''}
              ${item.descuento_arbitraje > 0 ? `<div class="slideup-spec-card highlight-arbitrage"><span class="slideup-spec-key"><i class="fa-solid fa-chart-line"></i> ${isEn ? 'Arbitrage Opportunity' : 'Margen Arbitraje'}</span><span class="slideup-spec-val">-${item.descuento_arbitraje}% vs ${isEn ? 'Median' : 'Mediana'}</span></div>` : ''}
              ${item.ahorro_spread ? `<div class="slideup-spec-card highlight-spread"><span class="slideup-spec-key"><i class="fa-solid fa-tags"></i> ${isEn ? 'Spread Discount' : 'Rebaja Inter-Portal'}</span><span class="slideup-spec-val">-${escaparHtml(item.ahorro_spread)}</span></div>` : ''}
              <div class="slideup-spec-card"><span class="slideup-spec-key"><i class="fa-solid fa-building-flag"></i> ${isEn ? 'Source Portal' : 'Portal de Origen'}</span><span class="slideup-spec-val">${escaparHtml(portalNombre)}</span></div>
              ${Object.entries(detallesTraducidos).map(([k, v]) => {
                const kLow = k.toLowerCase();
                const iconClass = (kLow.includes('estrato') || kLow.includes('stratum')) ? 'fa-layer-group' : (kLow.includes('área') || kLow.includes('built area') || kLow.includes('superficie')) ? 'fa-ruler-combined' : (kLow.includes('hab') || kLow.includes('bedroom')) ? 'fa-bed' : (kLow.includes('baño') || kLow.includes('bath')) ? 'fa-bath' : (kLow.includes('garaje') || kLow.includes('parqueadero') || kLow.includes('parking')) ? 'fa-square-parking' : (kLow.includes('contacto') || kLow.includes('contact')) ? 'fa-user-shield' : 'fa-circle-info';
                const esBadgeConfiable = kLow.includes('contacto') || kLow.includes('contact');
                return `<div class="slideup-spec-card"><span class="slideup-spec-key"><i class="fa-solid ${iconClass}"></i> ${escaparHtml(k)}</span><span class="slideup-spec-val">${esBadgeConfiable ? v : v}</span></div>`;
              }).join('')}
            </div>

            <div class="slideup-trust-card">
              <div class="trust-badge"><i class="fa-solid fa-shield-halved"></i> ${isEn ? 'Direct Deal with Owner' : 'Trato Directo con el Propietario'}</div>
              <p class="trust-desc">${isEn ? 'Property marketed directly by its legitimate owner. Zero brokerage markups and zero intermediate agents, ready for direct call or WhatsApp.' : 'Propiedad comercializada directamente por su dueño. Sin inmobiliarias ni comisiones intermedias, lista para negociar por llamada o WhatsApp.'}</p>
            </div>

            <div class="slideup-action-group">
              ${estaDesbloqueado && contacto ? `
                <div class="slideup-unlocked-layout">
                  <div class="unlocked-phone-box">
                    <div class="unlocked-phone-label"><i class="fa-solid fa-unlock"></i> ${isEn ? 'Unlocked Contact Details' : 'Datos de Contacto Desbloqueados'}</div>
                    <div class="unlocked-phone-number">${escaparHtml(contacto?.telefonoDisplay || contacto?.telefono || (isEn ? 'Fetching contact...' : 'Consultando contacto...'))}</div>
                  </div>
                  <div class="slideup-unlocked-row">
                    ${contactoSeguro?.whatsappUrl ? `<a href="${contactoSeguro.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn btn-whatsapp-direct cta-flex" title="WhatsApp" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}
                    ${contactoSeguro?.telLlamar ? `<a href="tel:${contactoSeguro.telLlamar}" class="slideup-cta-btn cta-flex-sm cta-call" title="${isEn ? 'Call Owner' : 'Llamar al dueño'}" aria-label="Llamar"><i class="fa-solid fa-phone"></i> ${isEn ? 'Call' : 'Llamar'}</a>` : ''}
                    ${contactoSeguro?.enlace ? `<a href="${contactoSeguro.enlace}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn cta-flex cta-neutral" title="${isEn ? 'View Original Listing' : 'Ver Anuncio Original'}" aria-label="Anuncio"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${isEn ? 'View Listing' : 'Ver Anuncio'}</a>` : ''}
                  </div>
                  <div class="slideup-next-steps">
                    <div class="next-steps-title"><i class="fa-solid fa-list-check"></i> ${isEn ? 'Next Steps to Close Deal' : 'Siguientes Pasos de Negociación'}</div>
                    <ul class="next-steps-list">
                      <li class="next-step-item"><span class="next-step-num">1</span><span><strong>${isEn ? 'Contact:' : 'Contacto:'}</strong> ${isEn ? 'Send pre-formatted WhatsApp message or place direct phone call.' : 'Envía el mensaje de WhatsApp preparado o realiza llamada directa.'}</span></li>
                      <li class="next-step-item"><span class="next-step-num">2</span><span><strong>${isEn ? 'Tour:' : 'Visita:'}</strong> ${isEn ? 'Ask for additional media and arrange property walkthrough.' : 'Pide fotos adicionales y agenda visita presencial al inmueble.'}</span></li>
                      <li class="next-step-item"><span class="next-step-num">3</span><span><strong>${isEn ? 'Deal:' : 'Acuerdo:'}</strong> ${isEn ? 'Verify title certificate and negotiate with zero agency fees.' : 'Verifica el certificado de tradición y acuerda sin pagar comisión.'}</span></li>
                    </ul>
                  </div>
                  <span class="slideup-cta-note slideup-cta-note-ok"><i class="fa-solid fa-check-double"></i> ${isEn ? 'Contact and direct link unlocked for your account' : 'Contacto y enlace directo desbloqueados para tu cuenta'}</span>
                </div>
              ` : estaDesbloqueado && !contacto ? `
                <button class="slideup-cta-btn btn-already-unlocked" data-action="revelar-desbloqueado" data-index="${index}"><i class="fa-solid fa-lock-open"></i> ${isEn ? 'Reveal Contact (Unlocked)' : 'Ver Contacto (Desbloqueado)'}</button>
                <span class="slideup-cta-note slideup-cta-note-ok"><i class="fa-solid fa-check-double"></i> ${isEn ? 'Already unlocked for your account ($0 cost)' : 'Ya desbloqueado para tu cuenta (Costo $0)'}</span>
              ` : `
                <button class="slideup-cta-btn" data-action="slideup-cta" data-index="${index}"><i class="fa-solid fa-unlock-keyhole"></i> ${isEn ? 'Unlock Owner Contact' : 'Desbloquear Contacto del Dueño'}</button>
                <span class="slideup-cta-note"><i class="fa-solid fa-bolt"></i> ${isEn ? 'Instant access • Zero broker commissions' : 'Acceso al instante • Sin pagar comisiones'}</span>
              `}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  if (totalPaginas > 1 || dataset?.hayMas) {
    const btnPrevHtml = paginaActual > 1 ? `<button type="button" class="btn-pagination" id="btnPrevPage" aria-label="${isEn ? 'Previous page' : 'Página anterior'}"><i class="fa-solid fa-chevron-left"></i> ${isEn ? 'Previous' : 'Anterior'}</button>` : '';
    const btnNextHtml = (paginaActual < totalPaginas || dataset?.hayMas) ? `<button type="button" class="btn-pagination" id="btnNextPage" aria-label="${isEn ? 'Next page' : 'Página siguiente'}">${isEn ? 'Next' : 'Siguiente'} <i class="fa-solid fa-chevron-right"></i></button>` : '';
    const btnLoadMore = dataset?.hayMas ? `<button type="button" class="btn-load-more" id="btnLoadMoreLeads"><i class="fa-solid fa-angles-down"></i> ${isEn ? 'Load more opportunities' : 'Cargar más oportunidades'}</button>` : '';
    htmlContenido += `<div class="pagination-controls">${btnPrevHtml}<span class="pagination-info">${isEn ? `Page ${paginaActual} of ${totalPaginas}` : `Página ${paginaActual} de ${totalPaginas}`}</span>${btnNextHtml}${btnLoadMore}</div>`;
  }

  container.innerHTML = htmlContenido;

  if (totalPaginas > 1 || dataset?.hayMas) {
    const btnPrev = document.getElementById("btnPrevPage"), btnNext = document.getElementById("btnNextPage"), btnLoad = document.getElementById("btnLoadMoreLeads");
    if (btnPrev && paginaActual > 1) {
      btnPrev.addEventListener("click", () => {
        if (typeof consultarCatalogoPaginado === 'function') {
          consultarCatalogoPaginado({ page: paginaActual - 1, reset: true });
        } else {
          paginaActual--;
          renderizarInterfaz(dataset);
        }
        document.getElementById("catalogHeaderRow")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    if (btnNext && (paginaActual < totalPaginas || dataset?.hayMas)) {
      btnNext.addEventListener("click", () => {
        if (typeof consultarCatalogoPaginado === 'function') {
          consultarCatalogoPaginado({ page: paginaActual + 1, reset: true });
        } else {
          paginaActual++;
          renderizarInterfaz(dataset);
        }
        document.getElementById("catalogHeaderRow")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    if (btnLoad) {
      btnLoad.addEventListener("click", () => {
        btnLoad.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cargando...';
        btnLoad.disabled = true;
        if (typeof consultarCatalogoPaginado === 'function') {
          consultarCatalogoPaginado({ page: paginaActual + 1, append: true });
        }
      });
    }
  }

  iniciarScrollReveal();

  // ✅ HAL-11: Limpiar siempre el timer anterior antes de crear uno nuevo.
  // Previene la acumulación de setInterval en sesiones largas con múltiples re-renders.
  if (window._timerRelativoCards) clearInterval(window._timerRelativoCards);
  window._timerRelativoCards = setInterval(actualizarTiemposRelativosEnDOM, 60000);

  container.querySelectorAll('.carousel-track').forEach((track) => {
    const card = track.closest('.bento-card');
    const cardIndex = Number.parseInt(card?.getAttribute('data-index') || '', 10);
    const totalFotos = track.querySelectorAll('.carousel-slide').length;
    if (typeof habilitarSwipeTactilCarrusel === 'function' && Number.isFinite(cardIndex) && totalFotos > 1) {
      habilitarSwipeTactilCarrusel(track, cardIndex, totalFotos);
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { traducirBadgeUrgencia, traducirTituloCatalogo, traducirDatoDistribucion, formatearTiempoRelativo, generarHtmlSkeletons, mostrarSkeletonsCargaBento };
}


/**
 * 🔓 MÓDULO DE DESBLOQUEO DE CONTACTOS (modules/07-unlock.js)
 * Desbloqueo atómico de propietarios, actualización de tarjeta en DOM y enlace a WhatsApp.
 * Estándar Ecosistema Desmulta Seguridad.
 */

// Registro de operaciones de desbloqueo en progreso para evitar dobles clics o peticiones concurrentes
const desbloqueosEnProgreso = new Set();

/**
 * Maneja el clic en "Desbloquear": si tiene créditos desbloquea directo, sino abre checkout.
 * @param {number} index
 * @param {object} [opciones]
 */
async function manejarClicDesbloquear(index, opciones = {}) {
  if (!datosActuales?.leads || !datosActuales.leads[index]) return;
  const lead = datosActuales.leads[index];
  leadSeleccionado = lead;
  if (opciones && opciones.desdeFicha) {
    leadSeleccionado._desdeFicha = true;
    leadSeleccionado._fichaIndex = index;
  }

  const yaEstaDesbloqueado = sesionUsuario && Array.isArray(sesionUsuario.unlockedLeads) && sesionUsuario.unlockedLeads.includes(lead.id);
  const tienePlanActivo = sesionUsuario?.plan === 'national' || sesionUsuario?.plan === 'city';
  const tieneCreditos = sesionUsuario && Number(sesionUsuario.credits || 0) >= 1;

  if (sesionUsuario && (yaEstaDesbloqueado || tieneCreditos || tienePlanActivo)) {
    await ejecutarDesbloqueoLead(lead, index);
  } else {
    abrirModalCheckout(index, 'comprar');
  }
}

/**
 * Actualiza quirúrgicamente una tarjeta en el DOM sin recargar la grilla ni parpadear.
 * @param {string} leadId
 * @param {object} contacto
 * @param {number|undefined} index
 * @param {object|undefined} datosRevelados - Título y ubicación reales (post-desbloqueo)
 * @param {Array|undefined} siguientesPasos - Protocolo de siguientes pasos bilingüe
 */
function actualizarTarjetaEnElDOM(leadId, contacto, index, datosRevelados, siguientesPasos) {
  const card = document.querySelector(`.bento-card[data-lead-id="${leadId}"]`) || 
               (typeof index === 'number' ? document.querySelector(`.bento-card[data-index="${index}"]`) : null);
  if (!card) {
    renderizarInterfaz(datosActuales);
    return;
  }
  const contactoSeguro = typeof sanitizarContactoCliente === 'function'
    ? sanitizarContactoCliente(contacto)
    : contacto;

  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';

  card.classList.add('card-unlocked');

  // Revelar título y ubicación reales si vienen del backend
  if (datosRevelados) {
    const cardTitle = card.querySelector('.card-title');
    if (cardTitle && datosRevelados.tituloOriginal) {
      cardTitle.textContent = datosRevelados.tituloOriginal;
    }
    const cardLocation = card.querySelector('.card-location');
    if (cardLocation && datosRevelados.ubicacionCompleta) {
      cardLocation.innerHTML = '<i class="fa-solid fa-location-dot"></i> ' + escaparHtml(datosRevelados.ubicacionCompleta);
    }
  }

  // 1. Badge superior flotante de "Desbloqueado" / "Unlocked"
  const floatingBadges = card.querySelector('.card-floating-badges');
  if (floatingBadges) {
    let unlockedBadge = floatingBadges.querySelector('.card-unlocked-badge');
    if (!unlockedBadge) {
      unlockedBadge = document.createElement('span');
      unlockedBadge.className = 'card-unlocked-badge';
      unlockedBadge.innerHTML = `<i class="fa-solid fa-unlock"></i> ${isEn ? 'Unlocked' : 'Desbloqueado'}`;
      const statusPill = floatingBadges.querySelector('.badge-status-pill');
      if (statusPill) statusPill.remove();
      floatingBadges.appendChild(unlockedBadge);
    }
  }

  // 2. Barra de teléfono revelado en el cuerpo
  const cardBody = card.querySelector('.card-body');
  if (cardBody && contacto) {
    let phoneBar = cardBody.querySelector('.card-contact-phone-bar');
    if (!phoneBar) {
      phoneBar = document.createElement('div');
      phoneBar.className = 'card-contact-phone-bar';
      const specsInline = cardBody.querySelector('.card-specs-inline') || cardBody.querySelector('.card-title');
      const bottomRow = cardBody.querySelector('.card-bottom-row');
      if (specsInline && specsInline.parentNode) {
        specsInline.parentNode.insertBefore(phoneBar, specsInline.nextSibling);
      } else if (bottomRow) {
        cardBody.insertBefore(phoneBar, bottomRow);
      } else {
        cardBody.appendChild(phoneBar);
      }
    }
    const telDisplay = contacto.telefonoDisplay || contacto.telefono || (isEn ? 'View in Ad' : 'Ver en Anuncio');
    phoneBar.innerHTML = `
      <span><i class="fa-solid fa-phone"></i> <strong class="contact-phone-number">${escaparHtml(telDisplay)}</strong></span>
      <span class="unlocked-portal-pill"><i class="fa-solid fa-building-flag"></i> ${escaparHtml(contacto.portal || 'Finca Raíz')}</span>
    `;
  }

  // 3. Botones de acción directa (WhatsApp, Llamar, Ver Anuncio)
  const bottomRow = card.querySelector('.card-bottom-row');
  if (bottomRow) {
    const existingCluster = bottomRow.querySelector('.unlocked-action-cluster');
    const existingUnlockBtn = bottomRow.querySelector('.btn-unlock-action, .btn-unlock-lead, [data-action="desbloquear-lead"]');
    const existingDirectBtn = bottomRow.querySelector('button[data-action="contactar-whatsapp"]');

    const cluster = existingCluster || document.createElement('div');
    cluster.className = 'unlocked-action-cluster';
    cluster.innerHTML = `
      ${contactoSeguro?.enlace ? `
        <a href="${contactoSeguro.enlace}" target="_blank" rel="noopener noreferrer" class="btn-view-ad-direct" title="${isEn ? 'View original owner listing' : 'Ver anuncio original del propietario directo'}">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> ${isEn ? 'View Listing' : 'Ver Anuncio'}
        </a>
      ` : ''}
      ${contactoSeguro?.whatsappUrl ? `
        <a href="${contactoSeguro.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-direct btn-whatsapp-compact" title="WhatsApp" aria-label="WhatsApp">
          <i class="fa-brands fa-whatsapp"></i> WhatsApp
        </a>
      ` : ''}
      ${contactoSeguro?.telLlamar ? `
        <a href="tel:${contactoSeguro.telLlamar}" class="btn-call-direct" title="${isEn ? 'Call Owner' : 'Llamar al dueño'}" aria-label="Llamar">
          <i class="fa-solid fa-phone"></i> ${isEn ? 'Call' : 'Llamar'}
        </a>
      ` : ''}
      ${(!contactoSeguro?.enlace && !contactoSeguro?.whatsappUrl && !contactoSeguro?.telLlamar) ? `
        <button class="btn-whatsapp-direct" data-action="contactar-whatsapp" data-index="${index}" title="${isEn ? 'Reveal owner contact and link' : 'Revelar contacto y enlace del propietario'}">
          <i class="fa-solid fa-unlock"></i> ${isEn ? 'Reveal Contact' : 'Revelar Contacto'}
        </button>
      ` : ''}
    `;

    if (existingUnlockBtn) existingUnlockBtn.replaceWith(cluster);
    else if (existingDirectBtn) existingDirectBtn.replaceWith(cluster);
    else if (!existingCluster) bottomRow.appendChild(cluster);
  }

  // 4. Actualizar el Slide-Up Drawer si existe en el DOM
  const cardIndex = card.getAttribute('data-index');
  const slideup = document.getElementById(`slideup-${cardIndex}`);
  if (slideup) {
    if (datosRevelados) {
      const slideTitle = slideup.querySelector('.slideup-title');
      if (slideTitle && datosRevelados.tituloOriginal) {
        slideTitle.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${escaparHtml(datosRevelados.tituloOriginal)}`;
      }
    }
    const specCards = slideup.querySelectorAll('.slideup-spec-card');
    specCards.forEach(sc => {
      const k = sc.querySelector('.slideup-spec-key');
      const v = sc.querySelector('.slideup-spec-val');
      if (k && v) {
        if (/contacto|contact/i.test(k.textContent)) {
          v.innerHTML = `<span class="verified-badge-wrap"><i class="fa-solid fa-circle-check verified-badge-icon"></i> ${isEn ? 'Verified Owner' : 'Propietario Verificado'}</span>`;
        } else if (/ubicación|location/i.test(k.textContent) && datosRevelados?.ubicacionCompleta) {
          v.textContent = datosRevelados.ubicacionCompleta;
        }
      }
    });

    const pasosRender = Array.isArray(siguientesPasos) && siguientesPasos.length > 0
      ? siguientesPasos
      : (contacto?._siguientesPasos && Array.isArray(contacto._siguientesPasos)
        ? contacto._siguientesPasos
        : (isEn ? [
            { paso: 1, titulo: 'Contact:', accion: 'Send pre-formatted WhatsApp message or place direct phone call.' },
            { paso: 2, titulo: 'Tour:', accion: 'Ask for additional media and arrange property walkthrough.' },
            { paso: 3, titulo: 'Deal:', accion: 'Verify title certificate and negotiate with zero agency fees.' }
          ] : [
            { paso: 1, titulo: 'Contacto:', accion: 'Envía el mensaje de WhatsApp preparado o realiza llamada directa.' },
            { paso: 2, titulo: 'Visita:', accion: 'Pide fotos adicionales y agenda visita presencial al inmueble.' },
            { paso: 3, titulo: 'Acuerdo:', accion: 'Verifica el certificado de tradición y acuerda sin pagar comisión.' }
          ]));

    const pasosHtml = pasosRender.map(p => `
      <li class="next-step-item"><span class="next-step-num">${p.paso}</span><span><strong>${escaparHtml(p.titulo || (p.clave ? p.clave + ':' : ''))}</strong> ${escaparHtml(p.accion || p.descripcion || '')}</span></li>
    `).join('');

    const actionGroup = slideup.querySelector('.slideup-action-group');
    if (actionGroup) {
      actionGroup.innerHTML = `
        <div class="slideup-unlocked-layout">
          <div class="unlocked-phone-box">
            <div class="unlocked-phone-label"><i class="fa-solid fa-unlock"></i> ${isEn ? 'Unlocked Contact Details' : 'Datos de Contacto Desbloqueados'}</div>
            <div class="unlocked-phone-number">${escaparHtml(contacto?.telefonoDisplay || contacto?.telefono || (isEn ? 'Fetching contact...' : 'Consultando contacto...'))}</div>
          </div>
          <div class="slideup-unlocked-row">
            ${contactoSeguro?.whatsappUrl ? `
              <a href="${contactoSeguro.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn btn-whatsapp-direct cta-flex" title="WhatsApp" aria-label="WhatsApp">
                <i class="fa-brands fa-whatsapp"></i> WhatsApp
              </a>
            ` : ''}
            ${contactoSeguro?.telLlamar ? `
              <a href="tel:${contactoSeguro.telLlamar}" class="slideup-cta-btn cta-flex-sm cta-call" title="${isEn ? 'Call Owner' : 'Llamar al dueño'}" aria-label="Llamar">
                <i class="fa-solid fa-phone"></i> ${isEn ? 'Call' : 'Llamar'}
              </a>
            ` : ''}
            ${contactoSeguro?.enlace ? `
              <a href="${contactoSeguro.enlace}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn cta-flex cta-neutral" title="${isEn ? 'View Original Listing' : 'Ver Anuncio Original'}" aria-label="Anuncio">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> ${isEn ? 'View Listing' : 'Ver Anuncio'}
              </a>
            ` : ''}
          </div>
          <div class="slideup-next-steps">
            <div class="next-steps-title"><i class="fa-solid fa-list-check"></i> ${isEn ? 'Next Steps to Close Deal' : 'Siguientes Pasos de Negociación'}</div>
            <ul class="next-steps-list">
              ${pasosHtml}
            </ul>
          </div>
          <span class="slideup-cta-note slideup-cta-note-ok">
            <i class="fa-solid fa-check-double"></i> ${isEn ? 'Contact and direct link unlocked for your account' : 'Contacto y enlace directo desbloqueados para tu cuenta'}
          </span>
        </div>
      `;
    }
  }
}

/**
 * Desbloquea un lead llamando a /api/leads/unlock y descifrando el contacto en backend.
 * @param {object} lead
 * @param {number|undefined} index
 */
async function ejecutarDesbloqueoLead(lead, index) {
  if (!sesionUsuario || !sesionUsuario.token) {
    abrirModalCheckout(index, 'comprar');
    return;
  }
  if (!lead || !lead.id) return;

  // 🛡️ Protección anti-rebote: evitar peticiones concurrentes para el mismo lead
  if (desbloqueosEnProgreso.has(lead.id)) {
    return;
  }
  desbloqueosEnProgreso.add(lead.id);

  const cardEl = typeof index === 'number' ? document.querySelector(`.bento-card[data-index="${index}"]`) : (lead?.id ? document.querySelector(`.bento-card[data-lead-id="${lead.id}"]`) : null);
  const btn = cardEl ? cardEl.querySelector('.btn-unlock-action, .btn-unlock-lead, [data-action="desbloquear-lead"], [data-action="contactar-whatsapp"]') : null;
  const textoOriginal = btn ? btn.innerHTML : '';
  const isEnUnlock = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEnUnlock ? 'Unlocking...' : 'Desbloqueando...'}`;
    btn.disabled = true;
  }

  // Deshabilitar también el botón dentro de la Ficha Técnica (Drawer) si está abierta
  const slideup = typeof index === 'number' ? document.getElementById(`slideup-${index}`) : null;
  const slideupBtn = slideup ? slideup.querySelector('.slideup-cta-btn[data-action="slideup-cta"]') : null;
  const slideupTextoOriginal = slideupBtn ? slideupBtn.innerHTML : '';
  if (slideupBtn) {
    slideupBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEnUnlock ? 'Unlocking...' : 'Desbloqueando...'}`;
    slideupBtn.disabled = true;
  }

  try {
    const unlockHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sesionUsuario.token}`
    };
    if (typeof generarUUIDv4 === 'function') {
      unlockHeaders['Idempotency-Key'] = generarUUIDv4();
    }

    const res = await fetch('/api/leads/unlock', {
      method: 'POST',
      headers: unlockHeaders,
      body: JSON.stringify({
        leadId: lead.id,
        contactoCifrado: lead.contacto_cifrado || '',
        leadCity: lead.ciudad || lead.ubicacion || lead.barrio || '',
        lang: isEnUnlock ? 'en' : 'es'
      })
    });

    const data = await res.json();
    const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';

    if (!res.ok || !data.ok) {
      if (res.status === 429 || data.error === 'CUOTA_DIARIA_EXCEDIDA') {
        const msgCuota = esIngles ? 'Fair use daily limit reached (35 contacts/day). Resets tomorrow.' : (data.message || 'Cuota de uso justo alcanzada (35 contactos/día). Se reiniciará mañana.');
        mostrarNotificacionToast(`🛡️ ${msgCuota}`, 'warning');
        return;
      }
      if (res.status === 403 && data.error === 'PLAN_CIUDAD_DIFERENTE') {
        const msgCiudad = esIngles ? 'Your active pass does not cover this city.' : (data.message || 'Tu membresía no cubre esta ciudad.');
        mostrarNotificacionToast(`📍 ${msgCiudad}`, 'error');
        abrirModalCheckout(index, 'comprar');
        return;
      }
      if (res.status === 402) {
        mostrarNotificacionToast(esIngles ? '⚠️ Insufficient credits to unlock this owner contact.' : '⚠️ Saldo insuficiente para desbloquear este contacto.', 'error');
        abrirModalCheckout(index, 'comprar');
        return;
      }
      throw new Error(data.error || (esIngles ? 'Error unlocking contact' : 'Error al desbloquear contacto'));
    }

    sesionUsuario.credits = data.creditsRemaining;
    if (data.token) {
      localStorage.setItem('hunter_pro_token', data.token);
      if (typeof guardarCookieSegura === 'function') guardarCookieSegura('origgo_token', data.token, 30);
      sesionUsuario.token = data.token;
    }
    if (Array.isArray(data.unlockedLeads)) {
      sesionUsuario.unlockedLeads = data.unlockedLeads;
    } else {
      if (!sesionUsuario.unlockedLeads) sesionUsuario.unlockedLeads = [];
      if (!sesionUsuario.unlockedLeads.includes(lead.id)) {
        sesionUsuario.unlockedLeads.push(lead.id);
      }
    }
    cacheContactosDesbloqueados[lead.id] = typeof sanitizarContactoCliente === 'function'
      ? sanitizarContactoCliente(data.contacto)
      : data.contacto;
    // Cachear datos revelados y siguientes pasos para re-renderizado futuro
    if (data.datosRevelados) {
      cacheContactosDesbloqueados[lead.id]._datosRevelados = data.datosRevelados;
    }
    if (data.siguientesPasos) {
      cacheContactosDesbloqueados[lead.id]._siguientesPasos = data.siguientesPasos;
    }

    cerrarModalCheckout();
    actualizarBadgeVip();
    actualizarTarjetaEnElDOM(lead.id, cacheContactosDesbloqueados[lead.id], index, data.datosRevelados, data.siguientesPasos);

    // Si el usuario desbloqueó desde la segunda capa (Ficha Técnica), mantener el drawer abierto y enfocar
    if (slideup && (leadSeleccionado?._desdeFicha || slideup.classList.contains('active'))) {
      slideup.classList.add('active');
      const phoneBox = slideup.querySelector('.unlocked-phone-box');
      if (phoneBox) setTimeout(() => phoneBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
      if (leadSeleccionado) delete leadSeleccionado._desdeFicha;
    }

    let mensajeExito = '';
    if (data.alreadyUnlocked) {
      mensajeExito = esIngles
        ? '✅ Property already unlocked previously (Cost: 0 credits). Contact restored.'
        : '✅ Inmueble ya desbloqueado previamente (Costo: 0 créditos). Contacto restablecido.';
    } else if (data.planBenefit) {
      const restHoy = typeof data.dailyUnlocksRemaining === 'number'
        ? (esIngles ? ` (${data.dailyUnlocksRemaining} left today)` : ` (${data.dailyUnlocksRemaining} restantes hoy)`)
        : '';
      mensajeExito = esIngles
        ? `👑 Contact unlocked at zero cost via your Pro Pass!${restHoy}`
        : `👑 ¡Contacto desbloqueado sin costo por tu Membresía Pro!${restHoy}`;
    } else {
      if (data.creditsRemaining === 0) {
        mensajeExito = esIngles
          ? '🎉 Direct owner contact unlocked! WhatsApp & call ready.'
          : '🎉 ¡Contacto del propietario desbloqueado! WhatsApp y llamada listos.';
      } else {
        const palabraCredito = data.creditsRemaining === 1
          ? (esIngles ? 'credit' : 'crédito')
          : (esIngles ? 'credits' : 'créditos');
        mensajeExito = esIngles
          ? `🎉 Contact unlocked! Remaining balance: ${data.creditsRemaining} ${palabraCredito}.`
          : `🎉 ¡Contacto desbloqueado! Saldo restante: ${data.creditsRemaining} ${palabraCredito}.`;
      }
    }
    mostrarNotificacionToast(mensajeExito);
  } catch (err) {
    registrarLogDesarrollo('error', '[Desbloqueo] Error:', err);
    const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
    const esErrorRed = !navigator.onLine || err.name === 'TypeError' || String(err.message || '').toLowerCase().includes('failed to fetch') || String(err.message || '').toLowerCase().includes('network');
    if (esErrorRed) {
      mostrarNotificacionToast(esIngles ? '📡 Unstable network or offline. Your credits are safe; please try again.' : '📡 Red inestable o sin conexión. Tus créditos están protegidos; intenta nuevamente.', 'error');
    } else {
      mostrarNotificacionToast(err.message || (esIngles ? 'Connection error during contact unlock' : 'Error de conexión durante el desbloqueo'), 'error');
    }
  } finally {
    desbloqueosEnProgreso.delete(lead.id);
    if (btn) {
      btn.innerHTML = textoOriginal;
      btn.disabled = false;
    }
    if (slideupBtn) {
      slideupBtn.innerHTML = slideupTextoOriginal;
      slideupBtn.disabled = false;
    }
  }
}

/**
 * Maneja el clic en "Chatear Propietario" de un inmueble previamente desbloqueado.
 * @param {number} index
 */
async function manejarContactoWhatsapp(index) {
  if (!datosActuales?.leads || !datosActuales.leads[index]) return;
  const lead = datosActuales.leads[index];

  const contacto = cacheContactosDesbloqueados[lead.id];
  const contactoSeguro = typeof sanitizarContactoCliente === 'function'
    ? sanitizarContactoCliente(contacto)
    : contacto;
  if (contactoSeguro?.whatsappUrl) {
    window.open(contactoSeguro.whatsappUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  if (contactoSeguro?.enlace) {
    window.open(contactoSeguro.enlace, '_blank', 'noopener,noreferrer');
    return;
  }

  await ejecutarDesbloqueoLead(lead, index);
}

/**
 * Abre una ventana emergente optimizada para impresión con el dossier completo de la propiedad.
 * @param {string} leadId
 */
function abrirDossierImprimible(leadId) {
  const dataset = window._origgoDatasetCompleto || (window.datosLeadsCache ? { leads: window.datosLeadsCache } : null);
  const lead = dataset?.leads?.find(l => String(l.id) === String(leadId)) || (typeof leadSeleccionado !== 'undefined' ? leadSeleccionado : null);
  if (!lead) return;
  const contacto = (typeof cacheContactosDesbloqueados !== 'undefined' ? cacheContactosDesbloqueados[leadId] : null) || lead.contacto;
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  const tel = contacto?.telefonoDisplay || contacto?.telefono || (isEn ? 'Direct in listing' : 'Directo en anuncio');
  const wa = contacto?.whatsappUrl || '';
  const web = contacto?.enlace || '';
  const html = `<!DOCTYPE html><html lang="${isEn ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${lead.titulo || 'Origgo Dossier'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #0A110E; background: #FFF; }
    .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 18px; }
    .logo { font-size: 28px; font-weight: 800; color: #047857; margin: 0; }
    .tag { font-size: 10px; color: #059669; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
    .box { border: 1px solid #CBDAD0; border-radius: 12px; padding: 18px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0; }
    .metric { background: #F2F7F4; border-radius: 8px; padding: 10px; text-align: center; }
    .metric-k { font-size: 10px; color: #4B6358; font-weight: 800; text-transform: uppercase; }
    .metric-v { font-size: 15px; font-weight: 800; color: #0A110E; margin-top: 4px; }
    .contact { background: #ECFDF5; border: 2px solid #059669; border-radius: 12px; padding: 18px; text-align: center; margin: 18px 0; }
    .phone { font-size: 24px; font-weight: 800; color: #064E3B; font-family: monospace; letter-spacing: 2px; }
    .btn { display: inline-block; background: #059669; color: #FFF; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px; margin: 6px 4px; cursor: pointer; border: none; }
    .wa-btn { background: #25D366; }
    .notice { background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 12px; font-size: 12px; color: #991B1B; line-height: 1.4; margin-top: 16px; }
    @media print { .no-print { display: none !important; } }
  </style></head><body>
    <div class="header"><h1 class="logo">Origgo</h1><div class="tag">${isEn ? 'CONFIDENTIAL PROPERTY DOSSIER · DIRECT OWNER' : 'DOSSIER CONFIDENCIAL DE PROPIEDAD · TRATO DIRECTO'}</div></div>
    <div class="box">
      <h2 style="margin:0 0 6px;">${lead.titulo || ''}</h2>
      <p style="color:#4B6358;margin:0 0 14px;font-size:13px;">📍 ${lead.ubicacion || 'Colombia'} · <em>${contacto?.portal || lead.portal || 'Finca Raíz'}</em></p>
      <div class="grid">
        <div class="metric"><div class="metric-k">${isEn ? 'Price' : 'Precio'}</div><div class="metric-v" style="color:#047857;">${lead.precio || 'Consultar'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Area' : 'Área'}</div><div class="metric-v">${lead.detalles?.['Área'] || lead.dato_1 || 'N/A'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Value / m²' : 'Valor / m²'}</div><div class="metric-v">${lead.precio_m2 || 'N/A'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Rooms' : 'Habitaciones'}</div><div class="metric-v">${lead.detalles?.['Habitaciones'] || 'N/A'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Baths' : 'Baños'}</div><div class="metric-v">${lead.detalles?.['Baños'] || 'N/A'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Stratum' : 'Estrato'}</div><div class="metric-v">${lead.detalles?.['Estrato'] || 'N/A'}</div></div>
      </div>
    </div>
    <div class="contact">
      <div style="font-size:11px;font-weight:800;color:#047857;letter-spacing:1px;margin-bottom:6px;">${isEn ? 'VERIFIED DIRECT OWNER CONTACT' : 'CONTACTO DIRECTO VERIFICADO'}</div>
      <div class="phone">${tel}</div>
      <div style="margin-top:12px;">
        ${wa ? `<a href="${wa}" target="_blank" class="btn wa-btn">💬 WhatsApp</a>` : ''}
        ${web ? `<a href="${web}" target="_blank" class="btn">🔗 ${isEn ? 'View Ad' : 'Ver Anuncio'}</a>` : ''}
      </div>
    </div>
    <div class="notice">
      <strong>🛡️ ${isEn ? 'Direct Closing Protocol:' : 'Protocolo de Cierre Directo:'}</strong>
      ${isEn ? 'Verify Title Certificate before sending down payment. Negotiate directly with 0% broker fees.' : 'Verifica el Certificado de Tradición y Libertad antes de transferir anticipos. Negocia sin comisiones de agencia.'}
    </div>
    <div style="text-align:center;margin-top:24px;" class="no-print">
      <button onclick="window.print()" class="btn" style="font-size:14px;padding:12px 28px;">🖨️ ${isEn ? 'Print / Save as PDF' : 'Imprimir / Guardar como PDF'}</button>
    </div>
  </body></html>`;
  w.document.write(html); w.document.close();
}
window.abrirDossierImprimible = abrirDossierImprimible;

/**
 * Desbloquea automáticamente un lead por su ID, enfocando la tarjeta en pantalla.
 * @param {string} leadId
 */
async function ejecutarDesbloqueoLeadPorId(leadId) {
  if (!leadId) return;
  let intentos = 0;
  while ((!datosActuales?.leads || datosActuales.leads.length === 0) && intentos < 15) {
    await new Promise(r => setTimeout(r, 200));
    intentos++;
  }
  const idx = datosActuales?.leads ? datosActuales.leads.findIndex(l => String(l.id) === String(leadId)) : -1;
  if (idx === -1) return;
  await ejecutarDesbloqueoLead(datosActuales.leads[idx], idx);
  const card = document.querySelector(`.bento-card[data-lead-id="${leadId}"]`) || document.querySelector(`.bento-card[data-index="${idx}"]`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
window.ejecutarDesbloqueoLeadPorId = ejecutarDesbloqueoLeadPorId;


/**
 * 💳 MÓDULO DE CHECKOUT Y PASARELA WOMPI (modules/08-checkout.js)
 * Modal de compra, selector de planes, orquestación del widget Wompi
 * y gestión de 3 pestañas de cuenta con perfil VIP enriquecido.
 * Estándar Ecosistema Desmulta Finanzas.
 */

let pagoWompiEnProgreso = false;

/**
 * Carga de forma asíncrona y segura el script oficial del widget de Wompi.
 */
function cargarScriptWompi() {
  if (document.getElementById("wompi-widget-script")) return;
  const script = document.createElement("script");
  script.id = "wompi-widget-script";
  script.src = "https://checkout.wompi.co/widget.js";
  script.async = true;
  script.onload = () => { wompiScriptCargado = true; registrarLogDesarrollo('log', "✅ Widget de Wompi cargado exitosamente."); };
  script.onerror = () => { registrarLogDesarrollo('warn', "⚠️ No se pudo cargar el script de Wompi de la CDN."); };
  document.head.appendChild(script);
}

/**
 * Cambia la pestaña activa del modal de checkout.
 * @param {'comprar'|'tengo-pin'|'perfil'|'mi-cuenta'} pestana
 */
function cambiarPestanaCheckout(pestana) {
  const tabMiCuenta = document.getElementById('tabBtnMiCuenta'), tabComprar = document.getElementById('tabBtnComprar'), tabPin = document.getElementById('tabBtnTengoPin');
  const panelComprar = document.getElementById('panelComprar'), panelPin = document.getElementById('panelTengoPin'), panelPerfil = document.getElementById('panelUsuarioActivo');
  const tabsBar = document.getElementById('checkoutTabsBar');

  [panelComprar, panelPin, panelPerfil, tabMiCuenta, tabComprar, tabPin].forEach(el => el?.classList.remove('active'));
  if (tabsBar) tabsBar.style.display = 'flex';

  if (pestana === 'comprar') {
    tabComprar?.classList.add('active'); panelComprar?.classList.add('active');
  } else if (pestana === 'tengo-pin') {
    tabPin?.classList.add('active'); panelPin?.classList.add('active');
  } else if (pestana === 'perfil' || pestana === 'mi-cuenta') {
    tabMiCuenta?.classList.add('active'); panelPerfil?.classList.add('active');
  }
}

/**
 * Abre el modal de checkout para comprar créditos, ver PIN o perfil.
 * @param {number|undefined} index - Índice del lead seleccionado si aplica
 * @param {string|null} pestana - Pestaña inicial
 */
function abrirModalCheckout(index, pestana = null) {
  if (!wompiScriptCargado) cargarScriptWompi();

  if (typeof index === 'number' && datosActuales?.leads && datosActuales.leads[index]) {
    const prevDesdeFicha = Boolean(leadSeleccionado?._desdeFicha);
    const prevFichaIdx = typeof leadSeleccionado?._fichaIndex === 'number' ? leadSeleccionado._fichaIndex : index;
    leadSeleccionado = { ...datosActuales.leads[index], _desdeFicha: prevDesdeFicha, _fichaIndex: prevFichaIdx };
  }

  const modal = document.getElementById("checkoutModal");
  const elSummary = document.getElementById("modalLeadSummary");
  const tabMiCuenta = document.getElementById('tabBtnMiCuenta');

  if (elSummary) {
    if (leadSeleccionado) {
      elSummary.style.display = 'block';
      const imgHtml = leadSeleccionado.imagen ? `<div class="modal-lead-thumb-wrap"><img src="${escaparHtml(leadSeleccionado.imagen)}" alt="${escaparHtml(leadSeleccionado.titulo)}" class="modal-lead-thumb" /><div class="modal-lead-thumb-gradient"></div></div>` : '';
      const lblProp = typeof t === 'function' ? t('modal_summary_property', 'Inmueble:') : 'Inmueble:';
      const lblLoc = typeof t === 'function' ? t('modal_summary_location', 'Ubicación:') : 'Ubicación:';
      const lblPrice = typeof t === 'function' ? t('modal_summary_price', 'Precio Publicado:') : 'Precio Publicado:';
      const lblUnit = typeof t === 'function' ? t('modal_summary_unit_value', 'Valor Unitario:') : 'Valor Unitario:';
      elSummary.innerHTML = `${imgHtml}<div class="modal-summary-item"><span class="modal-summary-label">${lblProp}</span><strong class="modal-summary-value">${escaparHtml(leadSeleccionado.titulo)}</strong></div><div class="modal-summary-item"><span class="modal-summary-label">${lblLoc}</span><span class="modal-summary-label">${escaparHtml(leadSeleccionado.ubicacion)}</span></div><div class="modal-summary-item"><span class="modal-summary-label">${lblPrice}</span><strong class="modal-summary-price">${escaparHtml(leadSeleccionado.precio)}</strong></div>${leadSeleccionado.precio_m2 ? `<div class="modal-summary-item modal-summary-divider"><span class="modal-summary-label">${lblUnit}</span><strong class="modal-summary-value">${escaparHtml(leadSeleccionado.precio_m2)}</strong></div>` : ''}`;
    } else {
      elSummary.style.display = 'none';
    }
  }

  // Si el usuario ya tiene sesión activa
  if (sesionUsuario) {
    if (tabMiCuenta) tabMiCuenta.style.display = 'flex';

    const elPhone = document.getElementById('userActivePhone'), elPin = document.getElementById('userActivePin');
    const elCredits = document.getElementById('userActiveCredits'), elPlan = document.getElementById('userActivePlan');
    const elCount = document.getElementById('userActiveUnlockedCount'), inputWa = document.getElementById('checkoutWhatsappInput');
    const cardCredits = document.getElementById('userCreditsCard'), badgeWrap = document.getElementById('userMembershipBadgeWrap');
    const badgeEl = document.getElementById('userMembershipBadge'), labelCredits = document.getElementById('userCreditsLabel');
    const extraWrap = document.getElementById('userExtraCreditsWrap'), extraPill = document.getElementById('userExtraCreditsPill');
    const benefitsWrap = document.getElementById('userBenefitsToggleWrap'), benefitsList = document.getElementById('userBenefitsList');

    const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
    if (elPhone) elPhone.textContent = sesionUsuario.phone ? `+57 ${sesionUsuario.phone}` : (isEn ? 'Active Account' : 'Cuenta Activa');
    if (elPin) elPin.textContent = sesionUsuario.pin ? `PIN: ${sesionUsuario.pin}` : (isEn ? 'Protected PIN' : 'PIN protegido');
    if (inputWa) inputWa.value = sesionUsuario.phone || '';

    if (sesionUsuario.plan === 'national') {
      cardCredits?.classList.add('vip-mode');
      if (badgeWrap) badgeWrap.style.display = 'block';
      if (badgeEl) badgeEl.innerHTML = `<i class="fa-solid fa-crown"></i> ${isEn ? 'National VIP Pass' : 'Plan Nacional VIP'}`;
      if (labelCredits) labelCredits.textContent = isEn ? 'Coverage Status' : 'Estado de Cobertura';
      if (elCredits) elCredits.textContent = isEn ? 'Unlimited Colombia' : 'Colombia Ilimitada';
      if (elPlan) elPlan.textContent = isEn ? 'Full unrestricted access across all Colombian cities.' : 'Acceso total sin límites a todas las ciudades y categorías.';
      if (extraWrap && extraPill) {
        extraWrap.style.display = sesionUsuario.credits > 0 ? 'block' : 'none';
        if (sesionUsuario.credits > 0) extraPill.textContent = isEn ? `⚡ Vault: ${sesionUsuario.credits} Safe Credits` : `⚡ Bóveda: ${sesionUsuario.credits} Créditos seguros`;
      }
      if (benefitsWrap) benefitsWrap.style.display = 'block';
      if (benefitsList) benefitsList.innerHTML = isEn ? `<li><i class="fa-solid fa-check"></i> Unlimited unlocks.</li>` : `<li><i class="fa-solid fa-check"></i> Desbloqueos ilimitados.</li>`;
    } else if (sesionUsuario.plan === 'city') {
      const cNom = sesionUsuario.planCity || 'Bogotá', cNomSeguro = escaparHtml(cNom);
      cardCredits?.classList.add('vip-mode');
      if (badgeWrap) badgeWrap.style.display = 'block';
      if (badgeEl) badgeEl.innerHTML = `<i class="fa-solid fa-crown"></i> ${isEn ? `Pro City Pass (${cNomSeguro})` : `Plan Pro Ciudad (${cNomSeguro})`}`;
      if (labelCredits) labelCredits.textContent = isEn ? 'Coverage Status' : 'Estado de Cobertura';
      if (elCredits) elCredits.textContent = isEn ? 'Unlimited Access' : 'Acceso Ilimitado';
      if (elPlan) elPlan.textContent = isEn ? `100% Direct owner unlocks in ${cNom} for 30 days.` : `Desbloqueo de propietarios al 100% en ${cNom} por 30 días.`;
      if (extraWrap && extraPill) {
        extraWrap.style.display = sesionUsuario.credits > 0 ? 'block' : 'none';
        if (sesionUsuario.credits > 0) extraPill.textContent = isEn ? `⚡ Vault: ${sesionUsuario.credits} Credits other cities` : `⚡ Bóveda: ${sesionUsuario.credits} Créditos otras ciudades`;
      }
      if (benefitsWrap) benefitsWrap.style.display = 'block';
      if (benefitsList) benefitsList.innerHTML = isEn ? `<li><i class="fa-solid fa-check"></i> Direct owners in ${cNomSeguro}.</li>` : `<li><i class="fa-solid fa-check"></i> Propietarios directos en ${cNomSeguro}.</li>`;
    } else {
      cardCredits?.classList.remove('vip-mode');
      if (badgeWrap) badgeWrap.style.display = 'none';
      if (labelCredits) labelCredits.textContent = isEn ? 'Available Balance' : 'Saldo Disponible';
      if (elCredits) elCredits.textContent = isEn ? `⚡ ${sesionUsuario.credits} Credits` : `⚡ ${sesionUsuario.credits} Créditos`;
      if (elPlan) elPlan.textContent = isEn ? 'Standard Plan: 1 credit = 1 direct owner.' : 'Plan Estándar: 1 crédito = 1 propietario directo.';
      if (extraWrap) extraWrap.style.display = 'none';
      if (benefitsWrap) benefitsWrap.style.display = 'none';
    }

    if (elCount) {
      const cant = (sesionUsuario.unlockedLeads || []).length;
      elCount.textContent = isEn
        ? `You have unlocked ${cant} direct ${cant === 1 ? 'property' : 'properties'}.`
        : `Has desbloqueado ${cant} ${cant === 1 ? 'propiedad' : 'propiedades'} directamente.`;
    }

    if (pestana === 'comprar') {
      cambiarPestanaCheckout('comprar');
    } else {
      cambiarPestanaCheckout('mi-cuenta');
    }
  } else {
    if (tabMiCuenta) tabMiCuenta.style.display = 'none';
    cambiarPestanaCheckout(pestana || 'comprar');
  }

  // Sincronizar visibilidad y bloqueo de regalo freemium si ya fue reclamado en este dispositivo
  const radioActivo = document.querySelector('input[name="checkoutProduct"]:checked');
  const groupCity = document.getElementById("groupCitySelect"), groupEmail = document.getElementById("groupEmailInput");
  const optWelcome = document.getElementById("optWelcomeFree");
  const yaReclamado = typeof esDispositivoMarcadoComoReclamado === 'function' && esDispositivoMarcadoComoReclamado();
  const bloquearWelcome = Boolean((sesionUsuario && sesionUsuario.welcomeCreditClaimed) || yaReclamado);

  if (optWelcome) {
    if (bloquearWelcome) {
      optWelcome.classList.add('is-claimed');
      const ribbon = optWelcome.querySelector('.freemium-ribbon');
      if (ribbon) ribbon.textContent = (typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en') ? '✓ CLAIMED' : '✓ YA CANJEADO';
      const radioW = optWelcome.querySelector('input[type="radio"]');
      if (radioW?.checked) {
        radioW.checked = false;
        const rSingle = document.getElementById('optSingleLead')?.querySelector('input[type="radio"]');
        if (rSingle) { rSingle.checked = true; rSingle.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    } else {
      optWelcome.classList.remove('is-claimed');
    }
  }
  if (groupCity) groupCity.style.display = (radioActivo?.value === 'subscription_city') ? 'block' : 'none';
  if (groupEmail) groupEmail.style.display = (radioActivo?.value === 'welcome_free') ? 'block' : 'none';

  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

/**
 * Cierra el modal de checkout.
 */
function cerrarModalCheckout() {
  document.getElementById("checkoutModal")?.classList.remove("active");
  document.body.style.overflow = "";
}

/**
 * Reconcilia la acreditación del pago con reintentos para mitigar latencias de pasarela.
 */
async function reclamarSesionPostPago(orderData, productType, ciudad) {
  const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  mostrarNotificacionToast(esIngles ? 'Confirming payment accreditation with your bank...' : 'Confirmando acreditación de pago con tu banco...', 'info', { title: esIngles ? 'Verifying balance' : 'Verificando saldo', duration: 4500 });
  const tokenGuardado = localStorage.getItem('hunter_pro_token') || sesionUsuario?.token || '';
  const headersClaim = { 'Content-Type': 'application/json' };
  if (tokenGuardado) headersClaim.Authorization = `Bearer ${tokenGuardado}`;

  for (let intento = 1; intento <= 3; intento++) {
    try {
      const claimRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: headersClaim,
        body: JSON.stringify({ action: 'claim_reference', reference: orderData.reference, lang: esIngles ? 'en' : 'es' })
      });
      const claimText = await claimRes.text();
      let claimData = null;
      try { claimData = JSON.parse(claimText); } catch (_) {}

      if (claimRes.status === 202 && claimData?.requiresLogin) {
        mostrarNotificacionToast(claimData.message || (esIngles ? 'Payment credited. Sign in with your existing PIN.' : 'Pago acreditado. Inicia sesión con tu PIN existente.'), 'warning', { title: esIngles ? 'Account Protection' : 'Protección de cuenta', duration: 7000 });
        abrirModalCheckout(undefined, 'tengo-pin');
        return true;
      }

      if (claimRes.ok && claimData?.ok && claimData?.token) {
        localStorage.setItem('hunter_pro_token', claimData.token);
        if (typeof guardarCookieSegura === 'function') guardarCookieSegura('origgo_token', claimData.token, 30);
        localStorage.removeItem('origgo_pending_ref');
        const pinNuevo = claimData.user?.pin || null;
        sesionUsuario = { ...claimData.user, token: claimData.token };
        delete sesionUsuario.pin;
        if (claimData.user?.preferredLang && typeof cambiarIdioma === 'function' && typeof obtenerIdiomaActual === 'function' && claimData.user.preferredLang !== obtenerIdiomaActual()) {
          cambiarIdioma(claimData.user.preferredLang);
        }
        if (claimData.user?.preferredTheme && typeof aplicarTema === 'function' && typeof obtenerTemaActual === 'function' && claimData.user.preferredTheme !== obtenerTemaActual()) {
          aplicarTema(claimData.user.preferredTheme);
        }
        actualizarBadgeVip();
        sincronizarFiltroCiudadUsuario();
        renderizarInterfaz(datosActuales);

        const notif = typeof generarMensajeBienvenidaToast === 'function'
          ? generarMensajeBienvenidaToast(sesionUsuario, productType, ciudad)
          : { titulo: esIngles ? '🎉 Payment Successful!' : '🎉 ¡Pago Exitoso!', mensaje: esIngles ? 'Your access has been secured.' : 'Tu acceso quedó acreditado de forma segura.', tipo: 'success' };
        mostrarNotificacionToast(notif.mensaje, notif.tipo, { title: notif.titulo, duration: 6000 });

        if (typeof abrirModalBienvenidaVIP === 'function') {
          abrirModalBienvenidaVIP({ tipo: productType, ciudad }, { ...sesionUsuario, pin: pinNuevo });
        }
        if (leadSeleccionado) {
          const idxLead = typeof leadSeleccionado._fichaIndex === 'number' ? leadSeleccionado._fichaIndex : (datosActuales?.leads ? datosActuales.leads.findIndex(l => l.id === leadSeleccionado.id) : undefined);
          await ejecutarDesbloqueoLead(leadSeleccionado, idxLead);
        }
        return true;
      }

      if (claimRes.status === 403 && intento < 3) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
    } catch (errClaim) {
      registrarLogDesarrollo('warn', `[Claim Intento ${intento}] Error de red:`, errClaim);
      if (intento < 3) await new Promise(r => setTimeout(r, 1500));
    }
  }

  localStorage.setItem('origgo_pending_ref', orderData.reference);
  mostrarNotificacionToast(
    esIngles
      ? `Payment received (Ref: ${orderData.reference}). Your bank is finalizing processing. If not reflected, tap Restore Account.`
      : `Pago recibido (Ref: ${orderData.reference}). Tu banco está procesando la confirmación. Si no se refleja, pulsa Restaurar Cuenta.`,
    'warning',
    { title: esIngles ? 'Processing Confirmation' : 'Confirmación en proceso', duration: 9000 }
  );
  return false;
}

/**
 * Inicia la orden de pago y abre el widget oficial de Wompi con firma SHA256.
 */
async function ejecutarPagoWompi() {
  if (pagoWompiEnProgreso) return;
  if (typeof asegurarConexionParaAccion === 'function' && !asegurarConexionParaAccion('pago_wompi')) return;

  const radio = document.querySelector('input[name="checkoutProduct"]:checked');
  const productType = radio ? radio.value : 'pack_10_leads';
  const inputWa = document.getElementById('checkoutWhatsappInput');
  const errorBox = document.getElementById('checkoutPhoneError');
  const inputWrapper = document.getElementById('checkoutInputWrapper');
  const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const whatsappRaw = inputWa ? inputWa.value.trim() : '';
  const celularLimpio = whatsappRaw.replace(/\D/g, '');
  const celular = celularLimpio.startsWith('57') && celularLimpio.length === 12 ? celularLimpio.substring(2) : celularLimpio;

  if (!celular || celular.length < 10) {
    if (errorBox) { errorBox.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + (esIngles ? 'Please enter your real 10-digit WhatsApp number.' : 'Por favor ingresa tu WhatsApp real (10 dígitos).'); errorBox.classList.remove('is-hidden'); errorBox.style.display = 'block'; }
    if (inputWrapper) { inputWrapper.classList.add('input-error-shake'); setTimeout(() => inputWrapper.classList.remove('input-error-shake'), 600); }
    if (inputWa) { inputWa.focus(); inputWa.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    return;
  }

  if (errorBox) {
    errorBox.classList.add('is-hidden');
    errorBox.style.display = 'none';
  }

  // Flujo Freemium: 🎁 1 Desbloqueo Gratis de Bienvenida ($0 COP) con Doble Opt-In
  if (productType === 'welcome_free') {
    const inputEmail = document.getElementById('checkoutEmailInput'), emailError = document.getElementById('checkoutEmailError');
    const emailVal = inputEmail ? inputEmail.value.trim() : '';
    if (!emailVal || !emailVal.includes('@')) {
      if (emailError) {
        emailError.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + (esIngles ? 'Please enter a valid email.' : 'Por favor ingresa un correo válido.');
        emailError.classList.remove('is-hidden'); emailError.style.display = 'block';
      }
      inputEmail?.focus(); return;
    }
    if (emailError) { emailError.classList.add('is-hidden'); emailError.style.display = 'none'; }
    const btnPagar = document.getElementById('btnConfirmWompi'), textoOriginal = btnPagar ? btnPagar.innerHTML : '';
    if (btnPagar) { btnPagar.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${esIngles ? 'Sending link...' : 'Enviando enlace...'}`; btnPagar.disabled = true; }
    try {
      let deviceId = null;
      if (typeof obtenerDeviceFingerprint === 'function') {
        try { deviceId = await obtenerDeviceFingerprint(); } catch (_) {}
      }
      const pendingLeadId = leadSeleccionado?.id || null;
      if (pendingLeadId) {
        try { sessionStorage.setItem('origgo_pending_unlock_lead', pendingLeadId); } catch (_) {}
      }
      const res = await fetch('/api/auth/welcome-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ celular, phone: celular, email: emailVal, deviceId, leadId: pendingLeadId, lang: esIngles ? 'en' : 'es' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || (esIngles ? 'Could not claim gift.' : 'No se pudo activar el regalo.'));

      if (data.pendingVerification) {
        cerrarModalCheckout();
        mostrarNotificacionToast(
          esIngles ? `📧 Activation link sent to ${data.email}. Open it to reveal direct owner contact!` : `📧 Enviamos un enlace de activación a ${data.email}. Ábrelo para ver de inmediato el contacto directo del propietario.`,
          'success',
          { title: esIngles ? 'Verify Email' : 'Verifica tu Correo', duration: 9000 }
        );
        return;
      }

      if (data.token) {
        localStorage.setItem('hunter_pro_token', data.token);
        if (typeof guardarCookieSegura === 'function') guardarCookieSegura('origgo_token', data.token, 30);
        if (typeof marcarDispositivoComoReclamado === 'function') marcarDispositivoComoReclamado(deviceId);
        sesionUsuario = { ...data.user, token: data.token };
        delete sesionUsuario.pin;
        actualizarBadgeVip();
        sincronizarFiltroCiudadUsuario();
        cerrarModalCheckout();
        if (leadSeleccionado) {
          const idxLead = typeof leadSeleccionado._fichaIndex === 'number' ? leadSeleccionado._fichaIndex : (datosActuales?.leads ? datosActuales.leads.findIndex(l => l.id === leadSeleccionado.id) : undefined);
          await ejecutarDesbloqueoLead(leadSeleccionado, idxLead);
        }
      }
      return;
    } catch (errGift) {
      if (errorBox) { errorBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${escaparHtml(errGift.message)}`; errorBox.classList.remove('is-hidden'); errorBox.style.display = 'block'; }
      else { mostrarNotificacionToast(`⚠️ ${errGift.message}`); }
      return;
    } finally {
      if (btnPagar) { btnPagar.innerHTML = textoOriginal; btnPagar.disabled = false; }
    }
  }

  // Validación estricta de ciudad para Plan Pro Ciudad
  let ciudad = null;
  if (productType === 'subscription_city') {
    const selectCity = document.getElementById('checkoutCitySelect'), cityError = document.getElementById('checkoutCityError');
    ciudad = selectCity ? selectCity.value.trim() : '';
    if (!ciudad) {
      if (cityError) { cityError.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + (esIngles ? 'Please select your coverage city.' : 'Por favor selecciona la ciudad de cobertura.'); cityError.classList.remove('is-hidden'); cityError.style.display = 'block'; }
      if (selectCity) { selectCity.focus(); selectCity.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return;
    }
    if (cityError) { cityError.classList.add('is-hidden'); cityError.style.display = 'none'; }
  }

  const btnPagar = document.getElementById('btnConfirmWompi');
  const textoOriginal = btnPagar ? btnPagar.innerHTML : '';
  let idempotencyKey = '';
  if (btnPagar) {
    btnPagar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (esIngles ? 'Connecting to secure checkout...' : 'Conectando con pago seguro...');
    btnPagar.disabled = true;
  }

  try {
    pagoWompiEnProgreso = true;
    idempotencyKey = typeof generarUUIDv4 === 'function' ? generarUUIDv4() : (window.crypto?.randomUUID?.() || '');
    const headersOrden = {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    };
    if (sesionUsuario?.token) {
      headersOrden.Authorization = `Bearer ${sesionUsuario.token}`;
    }

    const res = await fetch('/api/payments/create-order', {
      method: 'POST',
      headers: headersOrden,
      body: JSON.stringify({ productType, celular, ciudad, lang: esIngles ? 'en' : 'es' })
    });

    const orderData = await res.json();
    if (!res.ok || !orderData.ok) {
      throw new Error(orderData.message || orderData.error || (esIngles ? 'Could not generate payment order' : 'No se pudo generar la orden de pago'));
    }

    if (typeof WidgetCheckout === 'undefined') {
      await new Promise((resolve) => {
        const scriptId = 'wompi-widget-script';
        if (!document.getElementById(scriptId)) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.src = 'https://checkout.wompi.co/widget.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => resolve();
          document.body.appendChild(script);
        } else {
          const check = setInterval(() => {
            if (typeof WidgetCheckout !== 'undefined') {
              clearInterval(check);
              resolve();
            }
          }, 100);
          setTimeout(() => { clearInterval(check); resolve(); }, 3000);
        }
      });
    }

    if (typeof WidgetCheckout !== 'undefined') {
      const checkout = new WidgetCheckout({
        currency: 'COP',
        amountInCents: orderData.amountInCents,
        reference: orderData.reference,
        publicKey: orderData.publicKey,
        signature: {
          integrity: orderData.signature
        },
        redirectUrl: `${window.location.origin}?ref=${encodeURIComponent(orderData.reference)}`
      });

      cerrarModalCheckout();

      checkout.open(async (result) => {
        const trx = result?.transaction;
        const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
        if (trx?.status === 'APPROVED') {
          await reclamarSesionPostPago(orderData, productType, ciudad);
        } else if (trx?.status === 'PENDING') {
          localStorage.setItem('origgo_pending_ref', orderData.reference);
          mostrarNotificacionToast(
            esIngles
              ? `Your payment (Ref: ${orderData.reference}) is pending validation by your bank. It will auto-credit once confirmed.`
              : `Tu pago (Ref: ${orderData.reference}) está en validación por tu banco. Se acreditará automáticamente al confirmarse.`,
            'info',
            { title: esIngles ? 'Payment in Validation' : 'Pago en Validación (PSE / Nequi)', duration: 8500 }
          );
        } else if (trx && (trx.status === 'DECLINED' || trx.status === 'ERROR')) {
          mostrarNotificacionToast(
            esIngles
              ? 'The transaction was declined by the financial institution. Please try another payment method.'
              : 'La transacción no fue aprobada por la entidad financiera. Intenta con otro medio de pago.',
            'error',
            { title: esIngles ? 'Payment Declined' : 'Pago Rechazado', duration: 7500 }
          );
        }
      });
      return;
    }

    // Fallback comercial si la CDN de Wompi estuviera inaccesible
    const msg = encodeURIComponent(`Hola Origgo, deseo activar ${orderData.productName} para el celular ${celular}. Ref: ${orderData.reference}`);
    const whatsappNum = window.PORTAL_CONFIG?.contacto?.whatsapp || '573001234567';
    window.open(`https://wa.me/${whatsappNum}?text=${msg}`, '_blank', 'noopener,noreferrer');
    cerrarModalCheckout();
  } catch (err) {
    registrarLogDesarrollo('error', '[Pago Wompi] Error:', err);
    const mensajeError = err?.message || (typeof err === 'string' ? err : 'Error al conectar con la pasarela de pagos.');
    if (errorBox) { errorBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escaparHtml(mensajeError)}`; errorBox.classList.remove('is-hidden'); errorBox.style.display = 'block'; }
    else mostrarNotificacionToast(`⚠️ ${mensajeError}`);
  } finally {
    pagoWompiEnProgreso = false;
    if (btnPagar) { btnPagar.innerHTML = textoOriginal; btnPagar.disabled = false; }
  }
}

// Inicialización de Listeners Propios de Pestañas y Acordeón en Checkout
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("tabBtnMiCuenta")?.addEventListener("click", () => cambiarPestanaCheckout('mi-cuenta'));
  const btnToggle = document.getElementById("btnToggleUserBenefits"), acc = document.getElementById("userBenefitsAccordion");
  btnToggle?.addEventListener("click", () => {
    acc?.classList.toggle("active");
    const active = acc?.classList.contains("active"), isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
    btnToggle.innerHTML = active
      ? (isEn ? '<i class="fa-solid fa-chevron-up"></i> Hide Privileges' : '<i class="fa-solid fa-chevron-up"></i> Ocultar Privilegios')
      : (isEn ? '<i class="fa-solid fa-sparkles"></i> View Membership Privileges' : '<i class="fa-solid fa-sparkles"></i> Ver Privilegios de mi Membresía');
  });
});


/**
 * ✨ MÓDULO DE EFECTOS UI Y MICRO-INTERACCIONES (modules/09-ui-effects.js)
 * Háptica táctil, ondas ripple, scroll reveal, parallax GPU y menú lateral off-canvas.
 * Estándar Ecosistema Desmulta Frontend.
 */

/**
 * Inicia el IntersectionObserver para revelar suavemente las tarjetas a medida que el usuario hace scroll.
 */
function iniciarScrollReveal() {
  const cards = document.querySelectorAll(".bento-card:not(.skeleton-card)");
  if (!cards.length) return;

  if (!("IntersectionObserver" in window)) {
    cards.forEach(card => card.classList.add("revealed"));
    return;
  }

  // Margen predictivo amplio: activa la tarjeta 350px antes de que entre a la pantalla
  // para que esté completamente revelada cuando el usuario haga scroll en el teléfono
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.transitionDelay = '0s';
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.01,
    rootMargin: "350px 0px 250px 0px"
  });

  cards.forEach(card => observer.observe(card));
}

/**
 * Sincroniza visualmente el icono y tooltip del conmutador de tema.
 * @param {string} theme - 'dark' o 'light'
 */
function actualizarIconoTema(theme) {
  const btnTheme = document.getElementById("btnThemeToggle");
  const btnThemeMobile = document.getElementById("btnThemeToggleMobile");

  if (btnTheme) {
    const icon = btnTheme.querySelector("i");
    if (icon) {
      if (theme === "light") {
        icon.className = "fa-solid fa-moon";
        btnTheme.title = "Cambiar a Modo Oscuro AMOLED";
      } else {
        icon.className = "fa-solid fa-sun";
        btnTheme.title = "Cambiar a Modo Claro Arquitectónico";
      }
    }
  }

  if (btnThemeMobile) {
    const iconM = btnThemeMobile.querySelector("i");
    const spanM = btnThemeMobile.querySelector("span");
    if (iconM) {
      if (theme === "light") {
        iconM.className = "fa-solid fa-moon";
        if (spanM) spanM.textContent = "Noche";
      } else {
        iconM.className = "fa-solid fa-sun";
        if (spanM) spanM.textContent = "Día";
      }
    }
  }
}

/* ═══════════════════════════════════════════════════
   ✨ MOTOR DE MICRO-INTERACCIONES Y HÁPTICA
   ═══════════════════════════════════════════════════ */
function inicializarEfectosPremium() {
  // 1. Motor Háptico (Vibración silenciosa nativa - Ajustado para motores más pesados)
  const hapticLight = () => { if (navigator.vibrate) navigator.vibrate(30); };
  const hapticHeavy = () => { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); };

  // 2. Efecto Onda (Ripple) y Háptica Unificada
  const inyectarOndaRipple = (btn, e, esPesado = false) => {
    if (!btn) return;
    if (esPesado) hapticHeavy(); else hapticLight();
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const clientX = (e && typeof e.clientX === 'number' && e.clientX > 0) ? e.clientX : (rect.left + rect.width / 2);
    const clientY = (e && typeof e.clientY === 'number' && e.clientY > 0) ? e.clientY : (rect.top + rect.height / 2);
    const x = clientX - rect.left - size / 2;
    const y = clientY - rect.top - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple-span';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    btn.classList.add('btn-ripple');
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 450);
  };

  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-unlock-lead, .btn-wompi-pay, .slideup-cta-btn, .mobile-nav-btn, .btn-hero-cta, .btn-menu-pill');
    if (btn) inyectarOndaRipple(btn, e, btn.classList.contains('btn-wompi-pay'));
  });

  document.querySelectorAll('.mobile-nav-btn').forEach(navBtn => {
    navBtn.addEventListener('pointerdown', (e) => {
      inyectarOndaRipple(navBtn, e, navBtn.id === 'btnNavVip');
    }, { passive: true });
  });

  // 3. Comando Flotante Magnético (Sticky Glass)
  const commandBar = document.querySelector('.command-bar-wrapper');
  if (commandBar) {
    // Usamos passive: true para no bloquear el hilo principal de scroll
    window.addEventListener('scroll', () => {
      if (window.scrollY > 15) {
        commandBar.classList.add('is-scrolled');
      } else {
        commandBar.classList.remove('is-scrolled');
      }
    }, { passive: true });
  }

  // 4. Motor Parallax GPU sin Forced Reflow (desactivado en pantallas táctiles/móviles para 60fps)
  const esTactilOMovil = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 768;
  const prefiereMenorMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!esTactilOMovil && !prefiereMenorMovimiento) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const cards = document.querySelectorAll('.bento-card.revealed');
          const windowHeight = window.innerHeight;
          // Fase 1: Lecturas en lote (Read Phase)
          const updates = [];
          cards.forEach((card) => {
            const rect = card.getBoundingClientRect();
            if (rect.top < windowHeight && rect.bottom > 0) {
              const yPos = ((rect.top / windowHeight) * 15) - 7.5;
              const img = card.querySelector('.carousel-slide.active img, .card-static-img');
              if (img) updates.push({ img, yPos });
            }
          });
          // Fase 2: Escrituras en lote (Write Phase - Cero Forced Reflow)
          updates.forEach(({ img, yPos }) => {
            img.style.transform = `translate3d(0, ${yPos}%, 0)`;
          });
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // 5. Lógica del Menú Lateral Móvil (Off-Canvas)
  const sideMenu = document.getElementById('sideMenu');
  const menuOverlay = document.getElementById('sideMenuOverlay') || document.getElementById('menuOverlay');
  const btnCloseMenu = document.getElementById('btnCloseSideMenu') || document.getElementById('btnCloseMenu');
  const btnNavMenuBottom = document.getElementById('btnNavMenuBottom');
  const btnMenuTrigger = document.getElementById('btnMenuTrigger');

  const actualizarIconoBotonMenu = (estaAbierto) => {
    if (btnNavMenuBottom) {
      const span = btnNavMenuBottom.querySelector('span[data-i18n="nav_menu"]') || btnNavMenuBottom.querySelector(':scope > span');
      if (span) span.textContent = estaAbierto ? (typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en' ? 'Close' : 'Cerrar') : (typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en' ? 'Menu' : 'Menú');
      btnNavMenuBottom.classList.toggle('active', estaAbierto);
      btnNavMenuBottom.classList.toggle('is-active', estaAbierto);
      btnNavMenuBottom.setAttribute('aria-expanded', estaAbierto ? 'true' : 'false');
    }
    if (btnMenuTrigger) btnMenuTrigger.classList.toggle('is-active', estaAbierto);
  };

  const abrirSideMenu = () => {
    if (sideMenu && menuOverlay) {
      sideMenu.classList.add('active');
      menuOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      actualizarIconoBotonMenu(true);
    }
  };

  const cerrarSideMenu = () => {
    if (sideMenu && menuOverlay) {
      sideMenu.classList.remove('active');
      menuOverlay.classList.remove('active');
      document.body.style.overflow = '';
      actualizarIconoBotonMenu(false);
    }
  };

  if (btnNavMenuBottom) {
    btnNavMenuBottom.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      inyectarOndaRipple(btnNavMenuBottom, e);
      if (sideMenu && sideMenu.classList.contains('active')) {
        cerrarSideMenu();
      } else {
        abrirSideMenu();
      }
    });
  }

  if (btnMenuTrigger) {
    btnMenuTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (sideMenu && sideMenu.classList.contains('active')) {
        cerrarSideMenu();
      } else {
        abrirSideMenu();
      }
    });
  }

  if (btnCloseMenu) {
    btnCloseMenu.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarSideMenu();
    });
  }

  if (menuOverlay) {
    menuOverlay.addEventListener('click', cerrarSideMenu);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sideMenu && sideMenu.classList.contains('active')) {
      cerrarSideMenu();
    }
  });

  // Vinculación de Enlaces de Navegación del Menú Lateral
  const sideLinks = document.querySelectorAll('.side-menu-link[data-side]');
  sideLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const action = link.getAttribute('data-side');
      cerrarSideMenu();
      sideLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      if (action === 'dashboard' || action === 'inmuebles') {
        e.preventDefault();
        const tabInm = document.querySelector('.cmd-niche-tab[data-dataset="./data/inmobiliario.json"]');
        if (tabInm) tabInm.click();
        else if (typeof restablecerTodosLosFiltros === 'function') restablecerTodosLosFiltros();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (action === 'vip') {
        e.preventDefault();
        abrirModalCheckout(0);
      } else if (action === 'terminos') {
        e.preventDefault();
        abrirModalLegal('terminos');
      }
    });
  });

  // Inicializar controlador del modal legal
  inicializarModalLegal();
}

/**
 * Textos claros y transparentes para usuarios y propietarios.
 */
const TEXTOS_LEGALES_ORIGGO = {
  terminos: {
    titulo: 'Cómo Funciona Origgo',
    subtitulo: 'Conexión directa entre compradores y propietarios',
    badge: 'Transparencia',
    icono: 'fa-solid fa-file-contract',
    html: `
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-handshake"></i> 1. Trato Directo sin Intermediarios</div>
        <p>Origgo recopila y organiza anuncios publicados directamente por propietarios en internet. No somos una inmobiliaria ni cobramos comisión sobre la venta o arriendo. El trato lo haces tú directamente con el dueño.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-key"></i> 2. Créditos de Desbloqueo</div>
        <p>Cada crédito te permite ver el WhatsApp real del dueño para contactarlo de inmediato. Tus créditos no vencen y quedan protegidos con tu número de teléfono.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-shield-halved"></i> 3. Uso Personal y Protección</div>
        <p>El acceso a los contactos es para tu uso personal o comercial directo. Protegemos los datos para evitar llamadas masivas o molestias a los propietarios.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-lock"></i> 4. Pagos Seguros con Wompi</div>
        <p>Tus pagos se procesan de forma segura a través de la pasarela oficial Wompi (vigilada por la Superintendencia Financiera de Colombia). Origgo no guarda tus tarjetas ni claves bancarias.</p>
      </div>
    `
  },
  exoneracion: {
    titulo: 'Seguridad y Trato Directo',
    subtitulo: 'Recomendaciones importantes para comprar con tranquilidad',
    badge: 'Seguridad',
    icono: 'fa-solid fa-shield-halved',
    html: `
      <div class="legal-section legal-section-warning">
        <div class="legal-section-badge"><i class="fa-solid fa-circle-exclamation"></i> 1. Sin Comisión ni Intermediación</div>
        <p>Origgo <strong>no es una inmobiliaria ni cobra comisiones</strong>. No fijamos precios, no recibimos arras ni intervenimos en las promesas de compraventa. Negocias de tú a tú con el propietario.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-magnifying-glass"></i> 2. Revisa la propiedad antes de pagar</div>
        <p>Te aconsejamos visitar el inmueble en persona, conocer al propietario y solicitar un Certificado de Tradición y Libertad reciente en la oficina de registro antes de entregar dinero o firmar acuerdos.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-comments"></i> 3. Acuerdos entre Particulares</div>
        <p>Los anuncios se toman de publicaciones abiertas en internet. Cualquier acuerdo, precio o promesa de compraventa es responsabilidad mutua entre tú y el dueño del inmueble.</p>
      </div>
    `
  },
  privacidad: {
    titulo: 'Privacidad y Tus Datos',
    subtitulo: 'Protección de tu información según la Ley 1581 de 2012',
    badge: 'Tus Datos Seguros',
    icono: 'fa-solid fa-user-shield',
    html: `
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-lock"></i> 1. Cómo Usamos tu Teléfono y Correo</div>
        <p>Tu número de WhatsApp y correo solo se usan para entregarte tu código de acceso, guardar tus créditos y enviarte confirmación de compra. <strong>Cero venta de datos y cero spam</strong>.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-globe"></i> 2. Inmuebles Catalogados</div>
        <p>La información proviene de anuncios que los propietarios han compartido de manera pública y abierta en internet.</p>
      </div>
      <div class="legal-section legal-section-highlight">
        <div class="legal-section-badge"><i class="fa-brands fa-whatsapp"></i> 3. ¿Eres dueño y deseas retirar tu anuncio?</div>
        <p>Si eres el propietario de un inmueble aquí publicado y prefieres que no aparezca, escríbenos a nuestro WhatsApp de soporte y lo retiramos de inmediato sin ningún costo.</p>
      </div>
    `
  },
  reembolsos: {
    titulo: 'Garantía de Saldo y Respaldo',
    subtitulo: 'Tu dinero y tus créditos siempre protegidos',
    badge: 'Garantía de Saldo',
    icono: 'fa-solid fa-rotate-left',
    html: `
      <div class="legal-section legal-section-highlight">
        <div class="legal-section-badge"><i class="fa-solid fa-key"></i> 1. Tu Saldo Nunca se Pierde</div>
        <p>Si cambias de celular o borras el navegador, tus créditos siguen a salvo. Puedes recuperarlos en segundos desde <strong>"Restaurar Cuenta"</strong> con tu número de WhatsApp.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-bolt"></i> 2. Desbloqueo al Instante</div>
        <p>Cada vez que usas un crédito para ver el contacto de un propietario, la información se revela de inmediato en tu pantalla.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-brands fa-whatsapp"></i> 3. Soporte y Solución de Inconvenientes</div>
        <p>Si tuviste algún inconveniente con un pago en Wompi o una falla en el sistema, escríbenos directamente a nuestro WhatsApp de soporte y te repondremos tus créditos o daremos solución prioritaria.</p>
      </div>
    `
  }
};

let pestanaLegalActiva = 'terminos';

/**
 * Abre el modal legal institucional con la pestaña seleccionada.
 * @param {string} tabKey - 'terminos' | 'exoneracion' | 'privacidad'
 */
function abrirModalLegal(tabKey = 'terminos') {
  const modal = document.getElementById('modalLegalOverlay');
  if (!modal) return;

  pestanaLegalActiva = TEXTOS_LEGALES_ORIGGO[tabKey] ? tabKey : 'terminos';
  renderizarContenidoLegal(pestanaLegalActiva);

  modal.classList.add('active');
  modal.style.display = 'flex';
  modal.style.pointerEvents = 'auto';
  document.body.style.overflow = 'hidden';

  const tabButtons = modal.querySelectorAll('.legal-tab-btn');
  tabButtons.forEach(btn => {
    const isCurrent = btn.getAttribute('data-legal-tab') === pestanaLegalActiva;
    btn.classList.toggle('active', isCurrent);
    btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
  });
}

/**
 * Cierra el modal legal institucional.
 */
function cerrarModalLegal() {
  const modal = document.getElementById('modalLegalOverlay');
  if (!modal) return;

  modal.classList.remove('active');
  modal.style.pointerEvents = 'none';
  document.body.style.overflow = '';
  setTimeout(() => {
    if (!modal.classList.contains('active')) {
      modal.style.display = 'none';
    }
  }, 250);
}

/**
 * Renderiza el contenido y cabeceras de la pestaña seleccionada en el modal legal.
 * @param {string} tabKey
 */
function renderizarContenidoLegal(tabKey) {
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const repo = (isEn && window.TEXTOS_LEGALES_ORIGGO_EN) ? window.TEXTOS_LEGALES_ORIGGO_EN : TEXTOS_LEGALES_ORIGGO;
  const data = repo[tabKey] || repo.terminos || TEXTOS_LEGALES_ORIGGO.terminos;
  const titleEl = document.getElementById('legalModalTitle');
  const subEl = document.getElementById('legalModalSubtitle');
  const tagEl = document.getElementById('legalHeaderTag');
  const boxEl = document.getElementById('legalContentBox');

  if (titleEl) titleEl.textContent = data.titulo;
  if (subEl) subEl.textContent = data.subtitulo;
  if (tagEl) tagEl.innerHTML = `<i class="${data.icono}"></i> ${data.badge}`;
  if (boxEl) {
    boxEl.innerHTML = data.html;
    boxEl.scrollTop = 0;
  }
}

/**
 * Inicializa todos los eventos táctiles y de clic para el modal legal.
 */
function inicializarModalLegal() {
  const modal = document.getElementById('modalLegalOverlay');
  const btnClose = document.getElementById('btnLegalCloseIcon');
  const btnAccept = document.getElementById('btnLegalCancel');
  const btnTerminosFooter = document.getElementById('btnOpenTerminos');
  const btnPrivacidadFooter = document.getElementById('btnOpenPrivacidad');
  const btnReembolsosFooter = document.getElementById('btnOpenReembolsos');

  if (btnClose) {
    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cerrarModalLegal();
    });
    btnClose.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cerrarModalLegal();
    }, { passive: false });
  }

  if (btnAccept) btnAccept.addEventListener('click', (e) => { e.preventDefault(); cerrarModalLegal(); });

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cerrarModalLegal();
    });

    const tabBtns = modal.querySelectorAll('.legal-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-legal-tab');
        if (tab && TEXTOS_LEGALES_ORIGGO[tab]) {
          pestanaLegalActiva = tab;
          tabBtns.forEach(b => {
            const isMatch = b === btn;
            b.classList.toggle('active', isMatch);
            b.setAttribute('aria-selected', isMatch ? 'true' : 'false');
          });
          renderizarContenidoLegal(tab);
        }
      });
    });
  }

  if (btnTerminosFooter) btnTerminosFooter.addEventListener('click', (e) => { e.preventDefault(); abrirModalLegal('terminos'); });
  if (btnPrivacidadFooter) btnPrivacidadFooter.addEventListener('click', (e) => { e.preventDefault(); abrirModalLegal('privacidad'); });
  if (btnReembolsosFooter) btnReembolsosFooter.addEventListener('click', (e) => { e.preventDefault(); abrirModalLegal('reembolsos'); });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      cerrarModalLegal();
    }
  });
}

// Exposición global
window.abrirModalLegal = abrirModalLegal;
window.cerrarModalLegal = cerrarModalLegal;
window.inicializarModalLegal = inicializarModalLegal;
window.renderizarContenidoLegal = renderizarContenidoLegal;

function animarContador(e,t,n=1200){if(!e)return;let a=t!==undefined?t:parseInt(e.getAttribute("data-target")||"0",10),s=0,r=performance.now(),i=document.documentElement.lang||"es",o=n=>new Intl.NumberFormat(i==="es"?"es-CO":"en-US").format(n);function d(c){let l=Math.min((c-r)/n,1),m=Math.floor(s+(a-s)*(1-Math.pow(1-l,4)));e.textContent=o(m);l<1?window.requestAnimationFrame(d):(e.textContent=o(a))}window.requestAnimationFrame(d)}
function poblarEstadisticasHero(d){if(!d||!d.leads||!d.config)return;let t=document.getElementById("statLeadsTotal"),c=document.getElementById("statCiudades"),s=document.getElementById("statSectores"),f=document.getElementById("catalogFreshnessText"),h=document.getElementById("heroLiveStats");if(t)animarContador(t,d.leads.length);if(c)animarContador(c,new Set(d.leads.map(l=>l.ciudad)).size);if(s)animarContador(s,d.config.total_sectores_monitoreados);if(f&&d.config.actualizado_en){const m=d.config.actualizado_en.match(/(\d{1,2}:\d{2}\s*(?:[ap]\.?\s*m\.?)?)/i);const esEn=document.documentElement.lang==="en";f.textContent=(esEn?"Today ":"Hoy ")+(m?m[1].replace(/\s+/g," ").trim():d.config.actualizado_en);const p=f.closest(".catalog-freshness");if(p)p.setAttribute("title",(esEn?"Last sync: ":"Última sincronización: ")+d.config.actualizado_en);}if(h)h.style.animation="fadeInUp 0.8s ease forwards";}
window.animarContador = animarContador;
window.poblarEstadisticasHero = poblarEstadisticasHero;


/**
 * 🎯 MÓDULO DE LISTENERS Y EVENTOS (modules/10-listeners.js)
 * Vinculación de eventos del DOM, atajos de teclado y orquestación de la UI.
 * Estándar Ecosistema Desmulta.
 */


// Exposición global para compatibilidad y testing
window.moverCarrusel = moverCarrusel;
window.irACarrusel = irACarrusel;
window.abrirFichaTecnica = abrirFichaTecnica;
window.cerrarFichaTecnica = cerrarFichaTecnica;
window.abrirModalCheckout = abrirModalCheckout;
window.aplicarFiltrosOmnibox = aplicarFiltrosOmnibox;

/**
 * Configuración de listeners e interactividad.
 */
function configurarListeners() {
  // Selector de Nicho Unificado (Soporta .cmd-niche-tab y .niche-tab)
  const tabs = document.querySelectorAll(".cmd-niche-tab, .niche-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const datasetRuta = tab.getAttribute("data-dataset");
      // Sincronizar todas las pestañas vinculadas a la misma ruta
      document.querySelectorAll(`[data-dataset="${datasetRuta}"]`).forEach(t => t.classList.add("active"));
      if (datasetRuta) {
        restablecerTodosLosFiltros();
        cargarDatos(datasetRuta);
      }
    });
  });

  // Buscador Omnibox con Debounce (Evita saturación de CPU)
  const omnibox = document.getElementById("omniboxSearch");
  const btnSearchClear = document.getElementById("cmdSearchClear");
  let timeoutBusqueda;

  if (omnibox) {
    omnibox.addEventListener("input", (e) => {
      clearTimeout(timeoutBusqueda);
      textoBusquedaActivo = e.target.value;
      
      if (btnSearchClear) {
        btnSearchClear.classList.toggle("visible", textoBusquedaActivo.trim().length > 0);
      }
      
      // Retrasa la ejecución 300ms hasta que el usuario deje de teclear
      timeoutBusqueda = setTimeout(() => {
        aplicarFiltrosOmnibox();
      }, 300);
    });
  }

  if (btnSearchClear && omnibox) {
    btnSearchClear.addEventListener("click", () => {
      clearTimeout(timeoutBusqueda);
      omnibox.value = "";
      textoBusquedaActivo = "";
      btnSearchClear.classList.remove("visible");
      omnibox.focus();
      aplicarFiltrosOmnibox();
    });
  }

  // Delegación de Eventos en el Contenedor Bento (Cero fugas de memoria y optimización para Samsung J7)
  const bentoGrid = document.getElementById("bentoGridContainer");
  if (bentoGrid && !bentoGrid.dataset.delegacionConfigurada) {
    bentoGrid.dataset.delegacionConfigurada = "true";
    bentoGrid.addEventListener("click", (e) => {
      const actionEl = e.target.closest("[data-action]");
      if (!actionEl) return;

      const action = actionEl.getAttribute("data-action");
      const idx = parseInt(actionEl.getAttribute("data-index"), 10);
      if (isNaN(idx)) return;

      if (action === "carrusel-prev") {
        e.stopPropagation();
        const total = parseInt(actionEl.getAttribute("data-total"), 10) || 1;
        moverCarrusel(idx, -1, total, e);
      } else if (action === "carrusel-next") {
        e.stopPropagation();
        const total = parseInt(actionEl.getAttribute("data-total"), 10) || 1;
        moverCarrusel(idx, 1, total, e);
      } else if (action === "abrir-ficha") {
        e.stopPropagation();
        abrirFichaTecnica(idx, e);
      } else if (action === "cerrar-ficha") {
        e.stopPropagation();
        cerrarFichaTecnica(idx, e);
      } else if (action === "abrir-checkout" || action === "revelar-desbloqueado") {
        e.stopPropagation();
        manejarClicDesbloquear(idx, { desdeFicha: Boolean(e.target.closest('.card-slideup-overlay')) });
      } else if (action === "slideup-cta") {
        e.stopPropagation();
        manejarClicDesbloquear(idx, { desdeFicha: true });
      } else if (action === "contactar-whatsapp") {
        e.stopPropagation();
        manejarContactoWhatsapp(idx);
      }

      const contactLink = e.target.closest('a[href*="wa.me"], a[href^="tel:"]');
      if (contactLink) {
        const slideup = contactLink.closest('.card-slideup-overlay');
        const firstStep = slideup?.querySelector('.next-step-item:first-child');
        if (firstStep) firstStep.classList.add('completed');
      }
    });
  }

  // Desplazamiento suave al catálogo desde el botón principal del hero
  const btnHeroCta = document.getElementById("btnHeroCta");
  if (btnHeroCta) {
    btnHeroCta.addEventListener("click", () => {
      const catalogHeader = document.getElementById("catalogHeaderRow");
      if (catalogHeader) {
        catalogHeader.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  // Navegación Inferior Nativa (Solo Móvil)
  const mobileNavBtns = document.querySelectorAll(".mobile-nav-btn");
  mobileNavBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const navType = btn.getAttribute("data-nav");
      if (navType === "menu") return; // El menú lateral tiene su propio ciclo de vida

      mobileNavBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      if (navType === "home") {
        if (typeof restablecerTodosLosFiltros === "function") restablecerTodosLosFiltros();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (navType === "search") {
        const omnibox = document.getElementById("omniboxSearch");
        if (omnibox) {
          omnibox.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => omnibox.focus(), 350);
        }
      } else if (navType === "vip") {
        abrirModalCheckout();
      }
    });
  });

  // Precarga bajo demanda de Wompi al acercar el cursor o iniciar toque en botones VIP
  const preCargarWompi = () => { if (!wompiScriptCargado) cargarScriptWompi(); };
  const elBtnNavVip = document.getElementById("btnNavVip");
  if (elBtnNavVip) {
    elBtnNavVip.addEventListener("mouseenter", preCargarWompi, { once: true });
    elBtnNavVip.addEventListener("touchstart", preCargarWompi, { once: true, passive: true });
  }

  // Dropdown de Ciudades de Alta Demanda
  const pillLocation = document.getElementById("cmdFilterLocation");
  const dropdownLocation = document.getElementById("cmdLocationDropdown");
  const labelLocation = document.getElementById("cmdFilterLocationLabel");

  if (pillLocation && dropdownLocation) {
    pillLocation.addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeof alternarDropdownFiltro === "function") {
        alternarDropdownFiltro(pillLocation, dropdownLocation);
      } else {
        const isOpen = dropdownLocation.classList.toggle("show");
        pillLocation.classList.toggle("open", isOpen);
        pillLocation.setAttribute("aria-expanded", String(isOpen));
      }
    });

    dropdownLocation.addEventListener("click", (e) => {
      const item = e.target.closest(".cmd-dropdown-item");
      if (!item) return;
      e.stopPropagation();
      const cityValue = item.getAttribute("data-city") || "";
      filtroCiudadActivo = cityValue;

      dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      const spanText = item.querySelector("span") ? item.querySelector("span").textContent : "Colombia (Todas)";
      if (labelLocation) labelLocation.textContent = spanText;

      // Sincronizar con el selector del menú móvil si existe
      const sideMenuSelect = document.getElementById("sideMenuCitySelect");
      const sideMenuBadge = document.getElementById("sideMenuCityBadge");
      if (sideMenuSelect) sideMenuSelect.value = cityValue;
      if (sideMenuBadge) sideMenuBadge.textContent = cityValue || "Todas";

      pillLocation.classList.toggle("active-filter", cityValue !== "");
      if (typeof cerrarTodosLosDropdownsFiltro === "function") {
        cerrarTodosLosDropdownsFiltro();
      } else {
        dropdownLocation.classList.remove("show");
        pillLocation.classList.remove("open");
        pillLocation.setAttribute("aria-expanded", "false");
      }

      aplicarFiltrosOmnibox();
    });
  }

  // Selector de Ciudad en el Menú Lateral Móvil (Off-Canvas)
  const sideMenuCitySelect = document.getElementById("sideMenuCitySelect");
  const sideMenuCityBadge = document.getElementById("sideMenuCityBadge");
  if (sideMenuCitySelect) {
    sideMenuCitySelect.addEventListener("change", (e) => {
      const cityVal = e.target.value || "";
      filtroCiudadActivo = cityVal;

      if (sideMenuCityBadge) {
        sideMenuCityBadge.textContent = cityVal || "Todas";
      }

      // Sincronizar con la barra superior de comandos
      if (labelLocation) {
        labelLocation.textContent = cityVal ? (sideMenuCitySelect.options[sideMenuCitySelect.selectedIndex]?.text || cityVal) : "Todas las Ciudades";
      }
      if (pillLocation) {
        pillLocation.classList.toggle("active-filter", cityVal !== "");
      }
      if (dropdownLocation) {
        dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(item => {
          const itemCity = item.getAttribute("data-city") || "";
          item.classList.toggle("active", itemCity === cityVal);
        });
      }

      aplicarFiltrosOmnibox();

      // Cerrar el menú lateral para mostrar de inmediato la grilla filtrada
      const sideMenu = document.getElementById('sideMenu');
      const menuOverlay = document.getElementById('sideMenuOverlay') || document.getElementById('menuOverlay');
      if (sideMenu && menuOverlay) {
        sideMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }

      const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
      const nombreLimpio = cityVal ? cityVal : 'Colombia';
      mostrarNotificacionToast(esIngles ? `📍 Showing direct deals in ${nombreLimpio}` : `📍 Mostrando oportunidades en ${nombreLimpio}`, 'info');
    });
  }

  // Filtro Conmutador de Trato Directo
  const pillType = document.getElementById("cmdFilterType");
  if (pillType) {
    pillType.addEventListener("click", () => {
      filtroTratoDirectoActivo = !filtroTratoDirectoActivo;
      pillType.classList.toggle("active-filter", filtroTratoDirectoActivo);
      aplicarFiltrosOmnibox();
    });
  }

  // Menú Táctico Rápido con Animación Cinemática Hamburguesa a X (Estilo Desmulta)
  const btnMenu = document.getElementById("btnMenuTrigger");
  if (btnMenu) {
    btnMenu.addEventListener("click", () => {
      btnMenu.classList.toggle("is-active");
    });
  }

  // Cierre de Modal de Checkout
  const btnCloseModal = document.getElementById("btnCloseCheckoutModal") || document.getElementById("btnModalClose");
  if (btnCloseModal) btnCloseModal.addEventListener("click", cerrarModalCheckout);

  const btnCancelModal = document.getElementById("btnModalCancel");
  if (btnCancelModal) btnCancelModal.addEventListener("click", cerrarModalCheckout);

  const modalCheckout = document.getElementById("checkoutModal");
  if (modalCheckout) {
    modalCheckout.addEventListener("click", (e) => {
      if (e.target === modalCheckout) cerrarModalCheckout();
    });
  }

  // Conmutación de Pestañas en el Modal de Checkout
  const tabComprar = document.getElementById("tabBtnComprar");
  if (tabComprar) {
    tabComprar.addEventListener("click", () => cambiarPestanaCheckout('comprar'));
  }

  const tabTengoPin = document.getElementById("tabBtnTengoPin");
  if (tabTengoPin) {
    tabTengoPin.addEventListener("click", () => cambiarPestanaCheckout('tengo-pin'));
  }

  // Selección visual de tarjetas de producto en el modal
  const optionCards = document.querySelectorAll(".pricing-option-card");
  const groupCitySelect = document.getElementById("groupCitySelect"), groupEmailInput = document.getElementById("groupEmailInput");
  const btnPagar = document.getElementById("btnConfirmWompi");
  optionCards.forEach(card => {
    card.addEventListener("click", () => {
      optionCards.forEach(c => c.classList.remove("active-option"));
      card.classList.add("active-option");
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        const val = radio.value, isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
        if (groupCitySelect) groupCitySelect.style.display = (val === 'subscription_city') ? 'block' : 'none';
        if (groupEmailInput) groupEmailInput.style.display = (val === 'welcome_free') ? 'block' : 'none';
        if (btnPagar) {
          if (val === 'welcome_free') {
            btnPagar.innerHTML = `<i class="fa-solid fa-gift"></i> <span>${isEn ? 'Claim 1 Free Unlock ($0)' : 'Reclamar 1 Desbloqueo Gratis ($0)'}</span>`;
            btnPagar.className = 'btn-confirm-wompi btn-claim-freemium';
          } else {
            btnPagar.innerHTML = `<i class="fa-solid fa-lock"></i> <span>${isEn ? 'Proceed to Secure Checkout with Wompi' : 'Continuar al Pago Seguro con Wompi'}</span>`;
            btnPagar.className = 'btn-confirm-wompi';
          }
        }
      }
    });
  });

  // Limpieza de error en selector de ciudad al elegir opción
  const selectCityInput = document.getElementById("checkoutCitySelect");
  if (selectCityInput) {
    selectCityInput.addEventListener("change", () => {
      const cityErr = document.getElementById("checkoutCityError");
      if (cityErr) cityErr.style.display = "none";
    });
  }

  // Botón Confirmar Pago Wompi / Reclamar Regalo
  if (btnPagar) btnPagar.addEventListener("click", ejecutarPagoWompi);

  // Sanitización y limpieza de error en tiempo real para inputs numéricos
  const inputWaReal = document.getElementById("checkoutWhatsappInput");
  if (inputWaReal) {
    inputWaReal.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
      const errBox = document.getElementById("checkoutPhoneError"), wrapper = document.getElementById("checkoutInputWrapper");
      if (errBox) errBox.style.display = "none";
      if (wrapper) wrapper.classList.remove("input-error-shake");
    });
  }
  const inputRestoreWa = document.getElementById("restoreWhatsappInput");
  if (inputRestoreWa) inputRestoreWa.addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
  const inputRestorePin = document.getElementById("restorePinInput");
  if (inputRestorePin) inputRestorePin.addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''); });

  // Botón Restaurar Sesión por PIN
  const btnRestore = document.getElementById("btnRestoreSession");
  if (btnRestore) btnRestore.addEventListener("click", restaurarSesionConPin);

  // Autoservicio: Recuperación Automática por Referencia de Pago Wompi
  const btnToggleRec = document.getElementById("btnToggleAutoRecovery");
  if (btnToggleRec) {
    btnToggleRec.addEventListener("click", () => {
      const area = document.getElementById("recoveryContentArea"), icon = document.getElementById("recoveryToggleIcon");
      if (area) {
        const visible = area.classList.contains("is-open") || area.style.display === "block";
        area.style.display = visible ? "none" : "block";
        area.classList.toggle("is-open", !visible);
        area.classList.toggle("is-hidden", visible);
        if (icon) icon.classList.toggle("is-open", !visible);
      }
    });
  }
  const btnExecRec = document.getElementById("btnExecuteAutoRecovery");
  if (btnExecRec) btnExecRec.addEventListener("click", recuperarPinConReferencia);
  const btnMagic = document.getElementById("btnSendMagicLink");
  if (btnMagic) btnMagic.addEventListener("click", solicitarMagicLinkPorCorreo);
  const btnLogout = document.getElementById("btnLogoutSession"), btnSideLogout = document.getElementById("sideMenuLogoutBtn");
  if (btnLogout) btnLogout.addEventListener("click", cerrarSesionUsuario);
  if (btnSideLogout) btnSideLogout.addEventListener("click", (e) => { e.preventDefault(); cerrarSesionUsuario(); document.getElementById('sideMenu')?.classList.remove('active'); document.getElementById('sideMenuOverlay')?.classList.remove('active'); document.body.style.overflow = ''; });
  const btnBuyMore = document.getElementById("btnBuyMoreFromProfile");
  if (btnBuyMore) btnBuyMore.addEventListener("click", () => cambiarPestanaCheckout('comprar'));

  // Botón VIP del Header y Chip Móvil
  const btnVipHeader = document.getElementById("btnVipHeader");
  if (btnVipHeader) {
    btnVipHeader.addEventListener("mouseenter", preCargarWompi, { once: true });
    btnVipHeader.addEventListener("touchstart", preCargarWompi, { once: true, passive: true });
    btnVipHeader.addEventListener("click", () => abrirModalCheckout());
  }
  const btnMobileStatusChip = document.getElementById("btnMobileStatusChip");
  if (btnMobileStatusChip) {
    btnMobileStatusChip.addEventListener("mouseenter", preCargarWompi, { once: true });
    btnMobileStatusChip.addEventListener("touchstart", preCargarWompi, { once: true, passive: true });
    btnMobileStatusChip.addEventListener("click", () => abrirModalCheckout());
  }

  // MODAL LEGAL Y POLÍTICAS (LEY 1581)
  const btnTerminos = document.getElementById("btnOpenTerminos");
  const btnPrivacidad = document.getElementById("btnOpenPrivacidad");
  if (btnTerminos) {
    btnTerminos.addEventListener("click", () => {
      if (typeof abrirModalLegal === 'function') abrirModalLegal('terminos');
    });
  }
  if (btnPrivacidad) {
    btnPrivacidad.addEventListener("click", () => {
      if (typeof abrirModalLegal === 'function') abrirModalLegal('privacidad');
    });
  }

  // Conmutador Atómico y Persistencia de Modo Claro / Modo Oscuro AMOLED
  const btnTheme = document.getElementById("btnThemeToggle");
  const btnThemeMobile = document.getElementById("btnThemeToggleMobile");
  const temaInicial = document.documentElement.getAttribute("data-theme") || (function() {
    try { const local = localStorage.getItem("hunter_theme"); if (local) return local; } catch (e) {}
    return (typeof obtenerCookieSegura === 'function' ? obtenerCookieSegura('origgo_theme') : null) || "light";
  })();

  document.documentElement.setAttribute("data-theme", temaInicial);
  actualizarIconoTema(temaInicial);

  const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    if (typeof aplicarTema === 'function') {
      aplicarTema(newTheme);
    } else {
      ejecutarConTransicionSuave(() => {
        document.documentElement.setAttribute("data-theme", newTheme);
        actualizarIconoTema(newTheme);
      });
      try { localStorage.setItem("hunter_theme", newTheme); } catch (e) {}
    }
    if (typeof sincronizarPreferenciasEnServidor === 'function') sincronizarPreferenciasEnServidor(null, newTheme);
  };

  if (btnTheme) btnTheme.addEventListener("click", toggleTheme);
  if (btnThemeMobile) btnThemeMobile.addEventListener("click", toggleTheme);
  const sideMenuTheme = document.getElementById("sideMenuThemeToggle");
  if (sideMenuTheme) {
    sideMenuTheme.addEventListener("click", (e) => {
      e.preventDefault();
      toggleTheme();
    });
  }

  // Clic o toque en el logotipo principal: volver al inicio y restablecer catálogo
  const brandBadge = document.querySelector(".brand-badge");
  if (brandBadge) {
    const volverAlInicio = () => {
      brandBadge.classList.add("calibrating");
      setTimeout(() => brandBadge.classList.remove("calibrating"), 750);
      if (typeof restablecerTodosLosFiltros === "function") restablecerTodosLosFiltros();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    brandBadge.addEventListener("click", volverAlInicio);
    brandBadge.addEventListener("touchstart", volverAlInicio, { passive: true });
  }

  // Soporte de accesibilidad: Cerrar modal o ficha técnica con la tecla Escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cerrarModalCheckout();
      document.querySelectorAll(".card-slideup-overlay.active").forEach((overlay) => overlay.classList.remove("active"));
    }
  });

  if (typeof inicializarBarraOrdenamiento === 'function') inicializarBarraOrdenamiento();
  if (typeof inicializarFiltroHoy === 'function') inicializarFiltroHoy();
  if (typeof inicializarProteccionAntiImpresion === 'function') inicializarProteccionAntiImpresion();
  if (typeof inicializarPerroGuardian === 'function') inicializarPerroGuardian();
}

// ═════════════════════════════════════════════════════════════════════════
// 🚀 ARRANQUE DE LA APLICACIÓN AL CARGAR EL DOM (NON-BLOCKING STARTUP)
// ═════════════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  // 1. Inmediato (0ms): Registrar todos los event listeners de la interfaz
  configurarListeners();

  // 2. Inmediato (0ms): Activar micro-interacciones (Ripple, Parallax GPU, Háptica)
  inicializarEfectosPremium();

  // 3. Inmediato (0ms): Cargar catálogo inmobiliario sin esperar la red externa
  cargarDatos("./data/inmobiliario.json");

  // 4. Segundo plano asíncrono: Revalidar sesión persistente (JWT / PIN / Wompi)
  inicializarSesionUsuario().catch((err) => {
    registrarLogDesarrollo('warn', "[Sesión] Fallo en verificación de segundo plano:", err.message);
  });

  // 5. Registro de Service Worker para capacidades PWA
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").then(r => r.update().catch(() => {})).catch(err => registrarLogDesarrollo('warn', "[PWA] Error registrando Service Worker:", err));
    });
  }

  // 6. Sincronizar dinámicamente enlaces de contacto con el WhatsApp de config.js
  const waConfig = window.PORTAL_CONFIG?.contacto?.whatsapp;
  if (waConfig) {
    document.querySelectorAll('a[href*="wa.me/"]').forEach(a => { a.href = a.href.replace(/wa\.me\/\d+/, `wa.me/${waConfig}`); });
  }
});


/**
 * 👑 MÓDULO DE ONBOARDING Y BIENVENIDA VIP (modules/11-welcome.js)
 * Despliegue de modal celebratorio de lujo, matriz de privilegios y credenciales.
 * Estándar Ecosistema Desmulta UI/UX.
 */

/**
 * Despliega el modal de bienvenida y onboarding de beneficios estilo Google One / Apple Gold.
 * @param {object} planInfo - { tipo, nombre, ciudad, creditos }
 * @param {object} usuario - Datos de sesión del usuario
 */
function abrirModalBienvenidaVIP(planInfo, usuario) {
  const modal = document.getElementById("modalWelcomeSuccess");
  if (!modal) return;

  const elPill = document.getElementById("welcomeBadgePill");
  const elTitle = document.getElementById("welcomeModalTitle");
  const elSubtitle = document.getElementById("welcomeModalSubtitle");
  const elPhone = document.getElementById("welcomeUserPhone");
  const elPin = document.getElementById("welcomeUserPin");
  const elCopyPin = document.getElementById("btnCopyPin");
  const elList = document.getElementById("welcomeBenefitsList");
  const elCtaText = document.getElementById("welcomeCtaText");

  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const planTipo = planInfo?.tipo || usuario?.plan || 'single';
  const ciudad = planInfo?.ciudad || usuario?.planCity || (isEn ? 'your city' : 'tu ciudad');
  const pin = usuario?.pin || '';
  const phone = usuario?.phone ? `+57 ${usuario.phone}` : '+57 ••••••••••';

  if (elPhone) elPhone.textContent = phone;
  if (elPin) {
    if (pin) {
      elPin.textContent = pin;
    } else {
      elPin.innerHTML = isEn
        ? '<span class="pin-pending">Check your email or use <em>Restore PIN</em></span>'
        : '<span class="pin-pending">Revisa tu correo o usa <em>Recuperar PIN</em></span>';
    }
  }
  if (elCopyPin) {
    elCopyPin.classList.toggle('is-hidden', !pin);
  }

  let itemsHtml = '';

  if (planTipo === 'subscription_national' || usuario?.plan === 'national') {
    if (elPill) elPill.innerHTML = `<i class="fa-solid fa-crown"></i> ${isEn ? 'NATIONAL VIP PASS' : 'MEMBRESÍA NACIONAL VIP'}`;
    if (elTitle) elTitle.textContent = isEn ? 'Welcome to the National Elite Tier!' : '¡Bienvenido al Nivel Élite Nacional!';
    if (elSubtitle) elSubtitle.textContent = isEn ? 'You have unrestricted access to all direct property owners across Colombia.' : 'Tienes acceso total y sin restricciones a todos los propietarios directos de Colombia.';
    itemsHtml = isEn ? `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Unlimited Unlocks Across Colombia</strong><span class="benefit-desc">Bogotá, Medellín, Cali, Caribbean Coast, Coffee Triangle and all regions for 30 days.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Price-Drop & Arbitrage Live Radar</strong><span class="benefit-desc">Instant detection of urgent off-market opportunities before they reach agencies.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">0% Brokerage Commission</strong><span class="benefit-desc">Direct negotiation with verified owners with zero intermediate markups.</span></div></div>
    ` : `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Desbloqueo Ilimitado en Toda Colombia</strong><span class="benefit-desc">Bogotá, Medellín, Cali, Costa, Eje Cafetero y todas las ciudades por 30 días.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Radar de Rebajas de Precio & Arbitraje</strong><span class="benefit-desc">Detección de oportunidades urgentes con alto potencial antes que salgan al mercado.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">0% Comisión de Intermediarios</strong><span class="benefit-desc">Negociación de tú a tú con dueños directos sin sobrecostos de inmobiliaria.</span></div></div>
    `;
  } else if (planTipo === 'subscription_city' || usuario?.plan === 'city') {
    const ciudadEscapada = typeof escaparHtml === 'function' ? escaparHtml(ciudad) : ciudad;
    const ciudadMayusculaEscapada = typeof escaparHtml === 'function' ? escaparHtml(String(ciudad || '').toUpperCase()) : String(ciudad || '').toUpperCase();
    if (elPill) elPill.innerHTML = `<i class="fa-solid fa-crown"></i> ${isEn ? 'PRO CITY PASS' : 'PLAN PRO CIUDAD'} — ${ciudadMayusculaEscapada}`;
    if (elTitle) elTitle.textContent = isEn ? `Welcome to the ${ciudad} Pro Pass!` : `¡Bienvenido al Plan Pro ${ciudad}!`;
    if (elSubtitle) elSubtitle.textContent = isEn ? `Your territorial pass is active. Unlock all direct contacts in ${ciudad} without spending credits.` : `Tu membresía territorial está activa. Desbloquea todos los contactos de ${ciudad} sin gastar créditos.`;
    itemsHtml = isEn ? `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">30-Day Unlimited Access in ${ciudadEscapada}</strong><span class="benefit-desc">All verified direct owners in ${ciudadEscapada} without using credits.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">0% Real Estate Commission</strong><span class="benefit-desc">Save millions by dealing directly with the verified owner.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Real-Time Priority Alerts</strong><span class="benefit-desc">Instant alerts of direct listings in your coverage zone.</span></div></div>
    ` : `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Acceso Ilimitado 30 Días en ${ciudadEscapada}</strong><span class="benefit-desc">Todos los propietarios directos verificados en ${ciudadEscapada} sin consumir créditos.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">0% Comisión de Inmobiliaria</strong><span class="benefit-desc">Ahorra millones tratando de forma directa con el propietario verificado.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Alertas Prioritarias en Tiempo Real</strong><span class="benefit-desc">Capturas instantáneas de inmuebles directos en tu área de cobertura.</span></div></div>
    `;
  } else if (planTipo === 'pack_10_leads' || (usuario?.credits >= 10)) {
    if (elPill) elPill.innerHTML = `<i class="fa-solid fa-star"></i> ${isEn ? '10 CONTACTS PRO PACK' : 'BOLSA PRO 10 CONTACTOS'}`;
    if (elTitle) elTitle.textContent = isEn ? '10 Contacts Pack Ready!' : '¡Bolsa de 10 Contactos Lista!';
    if (elSubtitle) elSubtitle.textContent = isEn ? 'You secured the bundle with a 30% discount. Your credits never expire.' : 'Has asegurado el paquete con 30% de descuento. Tus créditos nunca vencen.';
    itemsHtml = isEn ? `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">10 Direct Owner Unlocks</strong><span class="benefit-desc">Use them whenever you find an ideal property across Colombia.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Non-Expiring Credits</strong><span class="benefit-desc">Your credits remain sealed to your PIN for life.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Mobile & Desktop Portability</strong><span class="benefit-desc">Access from any device using your phone number and PIN.</span></div></div>
    ` : `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">10 Desbloqueos de Propietario Directo</strong><span class="benefit-desc">Úsalos cuando encuentres el inmueble ideal en cualquier ciudad.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Créditos Sin Caducidad</strong><span class="benefit-desc">Tus créditos permanecen sellados con tu PIN de por vida.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Portabilidad Total en Móvil y PC</strong><span class="benefit-desc">Accede desde cualquier dispositivo ingresando tu celular y PIN.</span></div></div>
    `;
  } else {
    if (elPill) elPill.innerHTML = `<i class="fa-solid fa-bolt"></i> ${isEn ? 'SINGLE DIRECT UNLOCK' : 'DESBLOQUEO INDIVIDUAL'}`;
    if (elTitle) elTitle.textContent = isEn ? 'Direct Contact Activated!' : '¡Contacto Directo Activado!';
    if (elSubtitle) elSubtitle.textContent = isEn ? 'Your credit has been safely sealed to contact the owner.' : 'Tu crédito ha sido sellado con éxito para contactar al propietario.';
    itemsHtml = isEn ? `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Guaranteed Direct Contact</strong><span class="benefit-desc">Verified direct phone and WhatsApp without agency fees.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Reusable Access PIN</strong><span class="benefit-desc">Your PIN allows you to restore your unlocked deals anytime.</span></div></div>
    ` : `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Contacto Directo Garantizado</strong><span class="benefit-desc">Teléfono y WhatsApp verificado del propietario sin intermediarios.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">PIN Reutilizable</strong><span class="benefit-desc">Tu PIN te permite recuperar tu historial en cualquier momento.</span></div></div>
    `;
  }

  if (elList) elList.innerHTML = itemsHtml;
  if (elCtaText) {
    elCtaText.textContent = leadSeleccionado
      ? (isEn ? 'View Property Phone Number' : 'Ver Teléfono de Mi Inmueble')
      : (isEn ? 'Explore Direct Opportunities' : 'Explorar Oportunidades Directas');
  }

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

/**
 * Cierra el modal de bienvenida y beneficios VIP.
 */
function cerrarModalBienvenidaVIP() {
  const modal = document.getElementById("modalWelcomeSuccess");
  if (modal) modal.classList.remove("active");
  document.body.style.overflow = "";
}

/**
 * Despliega el modal de bienvenida y onboarding universal de Origgo.
 */
function abrirModalOnboarding() {
  const modal = document.getElementById("modalOnboardingWelcome");
  if (!modal) return;
  if (typeof aplicarTraduccionesAlDOM === 'function') {
    aplicarTraduccionesAlDOM();
  }
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

/**
 * Cierra el modal de bienvenida y onboarding universal.
 */
function cerrarModalOnboarding() {
  const modal = document.getElementById("modalOnboardingWelcome");
  if (modal) modal.classList.remove("active");
  document.body.style.overflow = "";
  try { localStorage.setItem('origgo_onboarding_seen', '1'); } catch (e) {}
}

// Inicialización de Listeners de Bienvenida y Onboarding
document.addEventListener("DOMContentLoaded", () => {
  const btnCloseWelcome = document.getElementById("btnWelcomeCloseIcon");
  if (btnCloseWelcome) {
    btnCloseWelcome.addEventListener("click", () => {
      cerrarModalBienvenidaVIP();
      if (leadSeleccionado && leadSeleccionado._desdeFicha) {
        const leadIdx = datosActuales?.leads ? datosActuales.leads.findIndex(l => l.id === leadSeleccionado.id) : -1;
        const indexToUse = leadIdx >= 0 ? leadIdx : leadSeleccionado._fichaIndex;
        if (typeof indexToUse === 'number' && typeof abrirFichaTecnica === 'function') {
          abrirFichaTecnica(indexToUse);
          const cardEl = document.querySelector(`.bento-card[data-index="${indexToUse}"]`);
          if (cardEl) cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }

  const btnCtaWelcome = document.getElementById("btnWelcomeCta");
  if (btnCtaWelcome) {
    btnCtaWelcome.addEventListener("click", () => {
      cerrarModalBienvenidaVIP();
      if (leadSeleccionado) {
        const leadIdx = datosActuales?.leads ? datosActuales.leads.findIndex(l => l.id === leadSeleccionado.id) : -1;
        const indexToUse = leadIdx >= 0 ? leadIdx : (typeof leadSeleccionado._fichaIndex === 'number' ? leadSeleccionado._fichaIndex : undefined);
        if (typeof indexToUse === 'number' && typeof abrirFichaTecnica === 'function') {
          abrirFichaTecnica(indexToUse);
          const cardEl = document.querySelector(`.bento-card[data-index="${indexToUse}"]`);
          if (cardEl) cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const slideupEl = document.getElementById(`slideup-${indexToUse}`);
          const phoneBox = slideupEl?.querySelector('.unlocked-phone-box');
          if (phoneBox) setTimeout(() => phoneBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
        }
        const yaDesbloqueado = sesionUsuario?.unlockedLeads && Array.isArray(sesionUsuario.unlockedLeads) && sesionUsuario.unlockedLeads.includes(leadSeleccionado.id);
        if (typeof ejecutarDesbloqueoLead === 'function' && !yaDesbloqueado) {
          ejecutarDesbloqueoLead(leadSeleccionado, indexToUse);
        }
      }
    });
  }

  const btnCopy = document.getElementById("btnCopyPin");
  if (btnCopy) {
    btnCopy.addEventListener("click", async () => {
      const pinCodeEl = document.getElementById("welcomeUserPin");
      const pin = pinCodeEl ? pinCodeEl.textContent.trim() : (sesionUsuario?.pin || '');
      if (pin && navigator.clipboard) {
        try {
          const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
          btnCopy.classList.add("copied");
          btnCopy.innerHTML = `<i class="fa-solid fa-check"></i> ${isEn ? 'Copied!' : '¡Copiado!'}`;
          setTimeout(() => {
            btnCopy.classList.remove("copied");
            btnCopy.innerHTML = `<i class="fa-solid fa-copy"></i> ${isEn ? 'Copy' : 'Copiar'}`;
          }, 2000);
        } catch (e) {
          registrarLogDesarrollo('warn', '[Clipboard] Error copiando PIN:', e);
        }
      }
    });
  }

  // Listeners para el Onboarding Universal
  const btnCloseOnboarding = document.getElementById("btnOnboardingClose");
  if (btnCloseOnboarding) {
    btnCloseOnboarding.addEventListener("click", cerrarModalOnboarding);
  }

  const btnCtaOnboarding = document.getElementById("btnOnboardingCta");
  if (btnCtaOnboarding) {
    btnCtaOnboarding.addEventListener("click", cerrarModalOnboarding);
  }

  const modalOnboarding = document.getElementById("modalOnboardingWelcome");
  if (modalOnboarding) {
    modalOnboarding.addEventListener("click", (e) => {
      if (e.target === modalOnboarding) cerrarModalOnboarding();
    });
  }

  const linkAbout = document.getElementById("sideMenuLinkAbout");
  if (linkAbout) {
    linkAbout.addEventListener("click", (e) => {
      e.preventDefault();
      const btnCloseMenu = document.getElementById('btnCloseSideMenu') || document.getElementById('btnCloseMenu');
      if (btnCloseMenu) btnCloseMenu.click();
      abrirModalOnboarding();
    });
  }

  const btnHeroAbout = document.getElementById("btnHeroOpenAbout");
  if (btnHeroAbout) {
    btnHeroAbout.addEventListener("click", (e) => {
      e.preventDefault();
      abrirModalOnboarding();
    });
  }

  // Despliegue automático y suave solo en la primera visita del usuario (nunca en cada recarga)
  try {
    const vistoPreviamente = localStorage.getItem('origgo_onboarding_seen');
    if (!vistoPreviamente) {
      setTimeout(() => {
        const recheck = localStorage.getItem('origgo_onboarding_seen');
        if (!recheck) {
          abrirModalOnboarding();
        }
      }, 1500);
    }
  } catch (e) {}
});

if (typeof window !== 'undefined') {
  window.abrirModalBienvenidaVIP = abrirModalBienvenidaVIP;
  window.cerrarModalBienvenidaVIP = cerrarModalBienvenidaVIP;
  window.abrirModalOnboarding = abrirModalOnboarding;
  window.cerrarModalOnboarding = cerrarModalOnboarding;
  window.mostrarOnboarding = abrirModalOnboarding;
}


/**
 * 🔔 MÓDULO DE ALERTAS WEB PUSH NATIVAS (modules/12-push.js)
 * Gestión de suscripción a notificaciones del navegador en tiempo real.
 * CERO variables expuestas en frontend (DevTools/F12 limpio) — Estándar Desmulta.
 */

/**
 * Convierte una cadena base64url a Uint8Array requerido por PushManager.
 * @param {string} base64String
 * @returns {Uint8Array}
 */
function base64UrlToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Inicia el proceso de suscripción o actualización de alertas Web Push segmentadas.
 * Consulta la clave pública dinámicamente al endpoint serverless sin quemar tokens en el cliente.
 * @param {string} [ciudadForzada] - Ciudad específica opcional
 */
async function activarNotificacionesPush(ciudadForzada) {
  const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (typeof mostrarNotificacionToast === 'function') {
      mostrarNotificacionToast(
        esIngles ? 'Your browser does not support native push notifications.' : 'Tu navegador no soporta notificaciones push nativas.',
        'error'
      );
    }
    return;
  }

  const btnBell = document.getElementById('btnPushSubscribe');
  const iconBell = btnBell ? btnBell.querySelector('i') : null;
  const originalIconClass = iconBell ? iconBell.className : 'fa-solid fa-bell';

  if (btnBell) {
    btnBell.classList.add('is-subscribing');
    if (iconBell) iconBell.className = 'fa-solid fa-circle-notch fa-spin';
  }

  try {
    // 1. Obtener criterios objetivos del selector, del parámetro o del almacenamiento
    const selectCiudad = document.getElementById('pushCitySelect');
    const selectOp = document.getElementById('pushOperationSelect');
    const checkDiscount = document.getElementById('pushDiscountOnly');

    let ciudadObjetivo = ciudadForzada;
    if (!ciudadObjetivo && selectCiudad && selectCiudad.value) {
      ciudadObjetivo = selectCiudad.value;
    }
    if (!ciudadObjetivo) {
      try {
        ciudadObjetivo = localStorage.getItem('origgo_push_city');
      } catch (_) {}
    }
    if (!ciudadObjetivo && window.filtroCiudadSeleccionada && window.filtroCiudadSeleccionada !== 'Colombia') {
      ciudadObjetivo = window.filtroCiudadSeleccionada;
    }
    if (!ciudadObjetivo) {
      ciudadObjetivo = 'Colombia';
    }

    const operacionObjetivo = selectOp && selectOp.value ? selectOp.value : (localStorage.getItem('origgo_push_operacion') || 'todas');
    const soloRebajas = checkDiscount ? checkDiscount.checked : (localStorage.getItem('origgo_push_discount') === 'true');

    // 2. Solicitar permiso al usuario si aún no está otorgado
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      if (typeof mostrarNotificacionToast === 'function') {
        mostrarNotificacionToast(
          esIngles ? 'Notification permission was denied or blocked.' : 'Permiso de notificaciones rechazado o bloqueado.',
          'error'
        );
      }
      return;
    }

    // 3. Obtener clave pública VAPID dinámicamente del backend con respaldo fail-safe
    const VAPID_KEY_FALLBACK = 'BOxsLRo4U5zEtBAu31sM199CSbxzOLhoFqE7V7tHJcVZ-kKTDUS8_F08emQ8Swzc0tQ4WCB7NvtmFLsVjC9Y7eQ';
    let publicKey = null;

    try {
      const respKey = await fetch('/api/notifications/vapid-public-key');
      if (respKey.ok) {
        const datosKey = await respKey.json();
        if (datosKey && datosKey.publicKey) {
          publicKey = String(datosKey.publicKey).trim();
        }
      }
    } catch (errKey) {
      console.warn('[Push] Error al consultar clave VAPID dinámica, usando fallback:', errKey);
    }

    if (!publicKey) {
      publicKey = VAPID_KEY_FALLBACK;
    }

    // 4. Registrar suscripción en el Service Worker
    const registro = await navigator.serviceWorker.ready;
    let suscripcion = await registro.pushManager.getSubscription();

    if (!suscripcion) {
      const convertedKey = base64UrlToUint8Array(publicKey);
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    // 5. Enviar suscripción con criterios segmentados al servidor para persistencia
    const respSub = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: suscripcion.toJSON(),
        ciudad: ciudadObjetivo,
        operacion: operacionObjetivo,
        soloRebajas: Boolean(soloRebajas),
        lang: typeof obtenerIdiomaActual === 'function' ? obtenerIdiomaActual() : (esIngles ? 'en' : 'es')
      })
    });

    if (!respSub.ok) {
      throw new Error(esIngles ? 'Failed to register subscription on server.' : 'Fallo al registrar la suscripción en el servidor.');
    }

    // 6. Guardar preferencias en almacenamiento local
    try {
      localStorage.setItem('origgo_push_city', ciudadObjetivo);
      localStorage.setItem('origgo_push_operacion', operacionObjetivo);
      localStorage.setItem('origgo_push_discount', soloRebajas ? 'true' : 'false');
    } catch (_) {}

    // 7. Feedback visual exitoso
    if (btnBell) {
      btnBell.classList.add('active-push');
      btnBell.title = esIngles 
        ? `Direct Listing Radar Active (${ciudadObjetivo})` 
        : `Radar de Oportunidades Activo (${ciudadObjetivo})`;
    }

    const linkSide = document.getElementById('sideMenuLinkPush');
    if (linkSide) {
      linkSide.innerHTML = `<i class="fa-solid fa-bell" style="color: var(--accent-emerald);"></i> ${esIngles ? `Live Radar (${ciudadObjetivo})` : `Radar en Vivo (${ciudadObjetivo})`}`;
    }

    // Cerrar modal de bienvenida si estuviera visible
    cerrarPushPromptModal(true);

    if (typeof mostrarNotificacionToast === 'function') {
      const textoCiudad = ciudadObjetivo === 'Colombia' 
        ? (esIngles ? 'all Colombia' : 'toda Colombia') 
        : ciudadObjetivo;
      mostrarNotificacionToast(
        esIngles
          ? `🔔 Radar active for ${textoCiudad}! We will notify your phone when new direct properties arrive.`
          : `🔔 ¡Radar activo para ${textoCiudad}! Te avisaremos en tu teléfono ante nuevos inmuebles directos.`,
        'success'
      );
    }
  } catch (err) {
    if (typeof mostrarNotificacionToast === 'function') {
      mostrarNotificacionToast(err.message || (esIngles ? 'Error activating radar alerts.' : 'Error al activar alertas.'), 'error');
    }
  } finally {
    if (btnBell) {
      btnBell.classList.remove('is-subscribing');
      if (iconBell) {
        iconBell.className = btnBell.classList.contains('active-push') ? 'fa-solid fa-bell' : originalIconClass;
      }
    }
  }
}

/**
 * Abre el modal sugestivo de radar de notificaciones push (Soft-Prompt).
 * Sincroniza la ciudad preferida en el selector.
 */
function abrirPushPromptModal() {
  const overlay = document.getElementById('modalPushPromptOverlay');
  if (!overlay) return;

  const selectCiudad = document.getElementById('pushCitySelect');
  if (selectCiudad) {
    let ciudadPrevia = null;
    try {
      ciudadPrevia = localStorage.getItem('origgo_push_city');
    } catch (_) {}

    // Si tiene Plan Pro Ciudad en su sesión activa, pre-seleccionar su ciudad
    if (!ciudadPrevia) {
      try {
        const sesion = JSON.parse(sessionStorage.getItem('origgo_session_data') || '{}');
        if (sesion.ciudadPro) ciudadPrevia = sesion.ciudadPro;
      } catch (_) {}
    }

    // Si está filtrando por una ciudad en el catálogo, pre-seleccionar
    if (!ciudadPrevia && window.filtroCiudadSeleccionada && window.filtroCiudadSeleccionada !== 'Colombia') {
      ciudadPrevia = window.filtroCiudadSeleccionada;
    }

    if (ciudadPrevia) {
      // Buscar coincidencia en opciones
      for (let i = 0; i < selectCiudad.options.length; i++) {
        if (selectCiudad.options[i].value.toLowerCase().includes(ciudadPrevia.toLowerCase()) ||
            ciudadPrevia.toLowerCase().includes(selectCiudad.options[i].value.toLowerCase())) {
          selectCiudad.selectedIndex = i;
          break;
        }
      }
    }
  }

  // Sincronizar selector de operación y filtro de rebajas
  const selectOp = document.getElementById('pushOperationSelect');
  if (selectOp) {
    const opPrevia = localStorage.getItem('origgo_push_operacion') || 'todas';
    selectOp.value = opPrevia;
  }

  const checkDiscount = document.getElementById('pushDiscountOnly');
  if (checkDiscount) {
    checkDiscount.checked = localStorage.getItem('origgo_push_discount') === 'true';
  }

  // Detección adaptativa para iPhone / iOS Safari
  const iosHint = document.getElementById('pushIosHint');
  if (iosHint) {
    const esIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const esStandalone = Boolean(window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));
    if (esIos && !esStandalone) {
      iosHint.style.display = 'flex';
    } else {
      iosHint.style.display = 'none';
    }
  }

  // Ajustar textos según estado del permiso
  const btnAccept = document.getElementById('btnPushPromptAccept');
  if (btnAccept && 'Notification' in window && Notification.permission === 'granted') {
    const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
    const spanText = btnAccept.querySelector('span');
    if (spanText) {
      spanText.textContent = esIngles ? 'Save Radar Preference' : 'Actualizar Preferencia de Zona';
    }
  }

  overlay.classList.add('active', 'open');
}

/**
 * Cierra el modal sugestivo de notificaciones push.
 * @param {boolean} guardarDescarte - Si es true, recuerda la decisión en la sesión actual.
 */
function cerrarPushPromptModal(guardarDescarte = true) {
  const overlay = document.getElementById('modalPushPromptOverlay');
  if (overlay) {
    overlay.classList.remove('active', 'open');
  }
  if (guardarDescarte) {
    try {
      sessionStorage.setItem('origgo_push_prompt_dismissed', 'true');
    } catch (_) {}
  }
}

/**
 * Evalúa automáticamente si se debe presentar la sugerencia de radar al entrar a la web.
 * Se dispara con un retardo amigable de 2.5 segundos para no interrumpir el render inicial.
 */
function evaluarSugerenciaPushAutomatica() {
  if (!('Notification' in window)) return;

  // Solo sugerir si el usuario aún no ha decidido (permiso 'default')
  if (Notification.permission === 'default') {
    let descartadoEnSesion = false;
    try {
      descartadoEnSesion = sessionStorage.getItem('origgo_push_prompt_dismissed') === 'true';
    } catch (_) {}

    if (!descartadoEnSesion) {
      setTimeout(() => {
        // Re-verificar por si el usuario ya interactuó con la campana
        if (Notification.permission === 'default') {
          abrirPushPromptModal();
        }
      }, 2500);
    }
  }
}

/**
 * Inicializa el botón de notificaciones y los listeners del modal en el DOM.
 */
function inicializarBotonPush() {
  const btnBell = document.getElementById('btnPushSubscribe');
  const linkSide = document.getElementById('sideMenuLinkPush');

  if (btnBell) {
    btnBell.addEventListener('click', () => {
      if ('Notification' in window && Notification.permission === 'granted') {
        abrirPushPromptModal();
      } else {
        activarNotificacionesPush();
      }
    });
  }

  if (linkSide) {
    linkSide.addEventListener('click', (e) => {
      e.preventDefault();
      const menu = document.getElementById('sideMenu');
      const overlay = document.getElementById('sideMenuOverlay');
      if (menu) menu.classList.remove('active', 'open');
      if (overlay) overlay.classList.remove('active', 'open');

      if ('Notification' in window && Notification.permission === 'granted') {
        abrirPushPromptModal();
      } else {
        activarNotificacionesPush();
      }
    });
  }

  // Listeners del modal interactivo Soft-Prompt
  const btnAccept = document.getElementById('btnPushPromptAccept');
  const btnLater = document.getElementById('btnPushPromptLater');
  const btnClose = document.getElementById('btnPushPromptClose');
  const promptOverlay = document.getElementById('modalPushPromptOverlay');

  if (btnAccept) {
    btnAccept.addEventListener('click', () => {
      activarNotificacionesPush();
    });
  }

  if (btnLater) {
    btnLater.addEventListener('click', () => {
      cerrarPushPromptModal(true);
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      cerrarPushPromptModal(true);
    });
  }

  if (promptOverlay) {
    promptOverlay.addEventListener('click', (e) => {
      if (e.target === promptOverlay) {
        cerrarPushPromptModal(true);
      }
    });
  }

  // Verificar si ya tiene permiso otorgado previamente
  if ('Notification' in window && Notification.permission === 'granted') {
    const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
    let ciudadPrevia = 'Colombia';
    try {
      ciudadPrevia = localStorage.getItem('origgo_push_city') || 'Colombia';
    } catch (_) {}

    if (btnBell) {
      btnBell.classList.add('active-push');
      btnBell.title = esIngles 
        ? `Direct Listing Radar Active (${ciudadPrevia})` 
        : `Radar de Oportunidades Activo (${ciudadPrevia})`;
    }
    if (linkSide) {
      linkSide.innerHTML = `<i class="fa-solid fa-bell" style="color: var(--accent-emerald);"></i> ${esIngles ? `Live Radar (${ciudadPrevia})` : `Radar en Vivo (${ciudadPrevia})`}`;
    }
  } else {
    // Si no tiene permiso, programar la invitación suave
    evaluarSugerenciaPushAutomatica();
  }
}

// Escuchar eventos de navegación profunda enviados desde el Service Worker
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (evento) => {
    if (evento.data && evento.data.tipo === 'ORIGGO_PUSH_CLICK') {
      const leadId = evento.data.leadId;
      if (leadId && typeof abrirFichaLead === 'function') {
        setTimeout(() => abrirFichaLead(leadId), 200);
      }
    }
  });
}

// Escuchar inicialización del DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarBotonPush);
} else {
  inicializarBotonPush();
}


/**
 * 🌐 MÓDULO DE INTERNACIONALIZACIÓN Y TRANSICIONES SUAVES (modules/13-i18n.js)
 * Sistema bilingüe sin parpadeos (ES / EN), conversión referencial USD
 * y mutaciones de interfaz aceleradas por GPU (View Transitions API W3C).
 * Estándar Ecosistema Desmulta UI/UX (< 500 líneas).
 */

const TASA_CAMBIO_USD_COP = 4100; // Tasa de cambio de referencia comercial

const DICCIONARIO_I18N = {
  es: {
    vip_btn_default: 'Créditos / Planes', vip_btn_title: 'Ver Créditos y Planes', lang_btn_label: 'Cambiar idioma', search_placeholder: 'Buscar por barrio, ciudad o palabra clave...', search_clear: 'Limpiar búsqueda',
    filter_all_cities: 'Todas las Ciudades', filter_colombia_all: 'Colombia (Todas)', filter_today: 'Captados Hoy', filter_today_title: 'Oportunidades captadas en las últimas 24 horas',
    sort_placeholder: 'Ordenar por', sort_recent: 'Más Recientes', sort_price_asc: 'Precio: Menor a Mayor', sort_price_desc: 'Precio: Mayor a Menor', sort_discount: 'Mayor Oportunidad', sort_m2_asc: 'Menor $/m²', sort_rebajas: 'Rebaja Reciente', filter_op_all: 'Todas las operaciones', filter_op_sale: 'En Venta', filter_op_rent: 'En Arriendo',
    hero_title: 'Inmuebles en venta <span class="editorial-italic">directo</span> de sus dueños',
    hero_subtitle: 'Sin intermediarios ni comisiones de inmobiliaria. Oportunidades y rebajas de urgencia detectadas hoy en Colombia antes de que lleguen a las agencias.',
    hero_badge_suffix: 'Sectores Monitoreados en Tiempo Real', hero_cta: 'Ver Inmuebles Directos Disponibles', hero_about_pill_text: '¿Qué es Origgo?',
    catalog_heading: 'Inmuebles Directos en Vivo', catalog_eyebrow: 'PORTAFOLIO VERIFICADO',
    catalog_count_suffix: 'oportunidades directas', catalog_count_single: 'oportunidad directa',
    marquee_direct_title: '0% Comisión', marquee_direct_sub: 'Trato directo',
    marquee_alerts_title: 'Alertas < 3 Min', marquee_alerts_sub: 'Tiempo real',
    marquee_arbitrage_title: 'Margen Arbitraje', marquee_arbitrage_sub: 'Bajo mediana',
    marquee_access_title: 'Acceso Abierto', marquee_access_sub: 'Avisos reales',
    catalog_empty_title: 'Sin oportunidades en esta zona', catalog_empty_desc: 'No se encontraron avisos directos con los filtros activos. Puedes explorar otras ciudades o restablecer.',
    catalog_btn_reset: 'Restablecer todos los filtros', card_view_details: 'Ver Detalles', card_listed_price: 'Precio Publicado',
    card_unlock_btn: 'Ver Contacto Directo', card_unlock_closed: 'Ver Cierre', card_unlocked_badge: 'Desbloqueado', card_view_ad: 'Ver Anuncio',
    card_whatsapp: 'WhatsApp', card_call: 'Llamar', card_reveal_contact: 'Revelar Contacto',
    card_time_now: '⚡ Justo ahora', card_time_ago_min: 'Hace {n} min', card_time_ago_hours: 'Hace {n} h', card_time_ago_days: 'Hace {n} d',
    card_usd_prefix: '≈ $', card_usd_suffix: 'USD',
    slideup_title: 'Detalles de la Propiedad', slideup_close_title: 'Cerrar Detalles',
    slideup_trust_badge: 'Trato Directo con el Propietario', slideup_trust_desc: 'Propiedad comercializada directamente por su dueño. Sin inmobiliarias ni comisiones intermedias, lista para negociar por llamada o WhatsApp.',
    slideup_unlocked_title: 'Datos de Contacto Desbloqueados', slideup_call_owner: 'Llamar al Propietario',
    slideup_direct_ad: 'Ver Anuncio Original', slideup_unlock_heading: 'Desbloquea el Contacto del Dueño',
    slideup_unlock_desc: 'Obtén de inmediato el número telefónico, enlace directo y WhatsApp del propietario para negociar sin intermediarios.',
    slideup_unlock_btn: 'Desbloquear con Créditos',
    modal_summary_property: 'Inmueble:', modal_summary_location: 'Ubicación:', modal_summary_price: 'Precio Publicado:', modal_summary_unit_value: 'Valor Unitario:',
    checkout_badge: 'Pasarela de Pago Segura Wompi', checkout_title: 'Desbloqueo de Propietarios Directos', checkout_subtitle: 'Sin intermediarios, comisiones de agencia ni mensualidades forzosas.',
    checkout_tab_buy: 'Comprar Planes', checkout_tab_restore: 'Restaurar Cuenta', checkout_tab_account: 'Mi Membresía', checkout_freemium_ribbon: '🎁 BIENVENIDA ($0)', checkout_opt_free_title: '1 Desbloqueo Gratis', checkout_opt_free_desc: 'Pruébalo sin pagar. 1 contacto directo de regalo ingresando tu WhatsApp y Correo.', checkout_btn_magic_link: 'Acceso Seguro sin PIN', checkout_label_email: 'Correo Electrónico (para Acceso Seguro):', checkout_help_email: 'Te enviaremos tu enlace de acceso seguro sin contraseñas ni PINs difíciles.',
    checkout_opt_single_title: 'Desbloqueo Individual', checkout_opt_single_desc: '1 Contacto verificado del propietario directo. Ideal para compra puntual.',
    checkout_opt_pack10_title: 'Bolsa 10 Contactos', checkout_opt_pack10_desc: '$3.500 por contacto. Los créditos no vencen y quedan asociados a tu PIN.',
    checkout_opt_city_title: 'Plan Pro Ciudad', checkout_opt_city_desc: 'Acceso ilimitado por 30 días a todos los propietarios directos de tu ciudad.',
    checkout_opt_nat_title: 'Plan Nacional VIP', checkout_opt_nat_desc: 'Acceso total en toda Colombia + Radar exclusivo de rebajas de precio.',
    checkout_popular_ribbon: '⭐ Más Popular (-30%)', checkout_month_suffix: '/ mes', checkout_city_select_default: '-- Selecciona tu ciudad --',
    checkout_label_city: 'Ciudad de Cobertura Ilimitada (Plan Pro):', checkout_city_help: 'Tu membresía desbloqueará sin límite todos los contactos directos de la ciudad elegida durante 30 días.',
    checkout_wa_alert_title: 'Atención: Ingresa tu WhatsApp REAL y activo', checkout_wa_alert_desc: 'Este número es tu identificador único de seguridad. Si ingresas un número falso o equivocado, no podrás acceder a tus créditos ni recuperar tu PIN. El sistema no realiza llamadas ni spam.',
    checkout_label_whatsapp: 'WhatsApp de Autenticación (10 dígitos):', checkout_ph_whatsapp: 'Ej: 300 123 4567', checkout_help_whatsapp: 'Tus créditos quedarán sellados con este celular para que los uses desde cualquier teléfono o PC.',
    checkout_btn_pay: 'Continuar al Pago Seguro con Wompi', checkout_btn_pay_default: 'Pagar con Wompi', checkout_btn_wompi_note: 'PSE, Nequi, Tarjetas Crédito y Débito', checkout_merchant_title: 'Operador de Cobro Oficial:', checkout_merchant_desc: 'Tu pago se procesa de forma segura a través de pasarela certificada y vigilada por la Superintendencia Financiera a nombre de nuestro comercio operador registrado Desmulta.', checkout_guarantee_wompi: 'Pasarela Segura Wompi (Vigilada SFC)', checkout_guarantee_instant: 'Activación Instantánea',
    checkout_restore_title: 'Restaura tu sesión con tu PIN o Referencia de Pago', checkout_btn_restore: 'Restaurar Mis Créditos', checkout_restore_intro: 'Si ya adquiriste créditos o un plan en otro navegador o dispositivo, ingresa tu número de WhatsApp y tu Código de Acceso Origgo (ej. HNT-7489).',
    checkout_restore_wa_label: 'WhatsApp Registrado:', checkout_restore_pin_label: 'Código de Acceso (PIN) o Ref. Wompi:', checkout_restore_pin_ph: 'Ej: HNT-7489 o Referencia de Pago', checkout_restore_pin_help: 'Ingresa tu PIN o pega la referencia de tu comprobante bancario para auto-acreditarte en vivo.',
    checkout_forgot_pin_btn: '¿Olvidaste tu Código? Restaurar por Correo', checkout_forgot_pin_desc: 'Ingresa el Correo Electrónico que utilizaste durante tu pago en Wompi. Te enviaremos instrucciones de recuperación si la cuenta existe.',
    checkout_email_label: 'Correo Electrónico de Compra:', checkout_email_ph: 'ejemplo@correo.com', checkout_btn_send_instructions: 'Enviar instrucciones',
    checkout_user_pin_protected: 'PIN protegido', checkout_user_balance_label: 'Saldo Disponible', checkout_user_benefits_btn: 'Ver Privilegios de mi Membresía', checkout_user_btn_plans: 'Planes & Recargas', checkout_user_btn_logout: 'Cerrar Sesión',
    welcome_badge: 'ACCESO VIP CONFIRMADO', welcome_title: '¡Bienvenido a Origgo!', welcome_subtitle: 'Tu acceso directo a propietarios de inmuebles sin intermediarios.',
    welcome_wa_label: 'WhatsApp Asociado', welcome_pin_label: 'Tu PIN Maestro de Acceso', welcome_copy_btn: 'Copiar', welcome_privileges_tag: 'Tus Privilegios Activos', welcome_footer_note: '100% Trato Directo • Sin Intermediarios • Sin Cargos Ocultos', welcome_pin_desc: 'Guarda tu PIN de 4 dígitos. Te servirá para restaurar tu sesión en cualquier dispositivo.', welcome_btn_explore: 'Comenzar a Explorar Oportunidades',
    push_badge: 'RADAR EN TIEMPO REAL', push_title: '¿Activar Alertas de Oportunidades Directas?', push_subtitle: 'Recibe una alerta en tu teléfono en el segundo exacto en que un propietario publique un inmueble sin comisiones inmobiliarias.',
    push_feature_1: 'Primicia total:', push_feature_1_desc: 'Entérate antes de que el inmueble llegue a portales o agencias con comisiones.', push_feature_2: 'Filtro por tu ciudad:', push_feature_2_desc: 'Avisos geolocalizados de tu zona de interés o inversión comercial.', push_feature_3: '100% libre de spam:', push_feature_3_desc: 'Solo señales cuando se confirme una oportunidad real negociada entre particulares.', push_btn_accept: 'Activar Radar en mi Teléfono', push_btn_later: 'Quizás más tarde / Explorar primero', push_city_label: 'Zona o ciudad de alertas:', push_city_all: '🇨🇴 Toda Colombia', push_btn_update: 'Actualizar Preferencia de Zona',
    push_ios_title: 'Para activar en iPhone:', push_ios_desc: ' Toca Compartir (⎋) en Safari y selecciona "Agregar al inicio" (+).', push_op_label: 'Tipo de negocio:', push_op_all: '🏷️ Todo (Venta y Arriendo)', push_op_sale: '🏡 Solo Venta', push_op_rent: '🔑 Solo Arriendo', push_discount_label: '📉 Solo alertarme si el propietario baja el precio o aplica rebaja urgente',
    nav_home: 'Inicio', nav_search: 'Buscar', nav_theme: 'Tema', nav_credits: 'Créditos', nav_menu: 'Menú', menu_lang_label: 'Idioma / Language', menu_city_label: 'Ciudad de Interés',
    menu_about: '¿Qué es Origgo?', menu_dashboard: 'Dashboard Principal', menu_direct_leads: 'Inmuebles Directos', menu_push: 'Activar Alertas en Vivo', menu_theme: 'Modo Claro / Oscuro', menu_vip: 'Desbloqueo VIP', menu_support: 'Soporte VIP WhatsApp', menu_terms: 'Términos & Exoneración', menu_logout: 'Cerrar Sesión',
    onboarding_badge: 'BIENVENIDO A ORIGGO', onboarding_title: 'Oportunidades directas, de persona a persona.',
    onboarding_subtitle: 'El punto de encuentro donde compradores e inversionistas tratan directamente con los dueños reales, sin intermediarios.',
    onboarding_p1_title: 'Encuentra antes que los demás', onboarding_p1_desc: 'Rastreamos el mercado todos los días para encontrar oportunidades recién publicadas por sus dueños, antes de que pasen a terceros.',
    onboarding_p2_title: 'Trato directo sin comisiones', onboarding_p2_desc: 'Hablas directamente con el propietario. Sin agencias intermediarias, sin comisiones de por medio y sin sobrecostos.',
    onboarding_p3_title: 'Tú tienes el control', onboarding_p3_desc: 'Explora libremente el catálogo. Cuando una oportunidad se ajuste a lo que buscas, desbloqueas el contacto en un solo toque.',
    onboarding_cta_btn: 'Comenzar a Explorar Oportunidades', onboarding_footer_note: '100% Trato Directo · Cero Comisiones de Agencia · Información Verificada',
    legal_header_tag: 'Transparencia y Confianza', legal_title: '¿Cómo Funciona Origgo?', legal_subtitle: 'Información clara para compradores y propietarios',
    legal_tab_how: 'Cómo Funciona', legal_tab_security: 'Seguridad', legal_tab_privacy: 'Tus Datos', legal_tab_guarantee: 'Garantía de Saldo', legal_btn_accept: 'Entendido',
    footer_bio: 'Plataforma de conexión directa con propietarios de inmuebles en Colombia. Sin intermediarios, sin comisiones de agencia y con oportunidades verificadas en tiempo real.',
    footer_tagline: 'Monitoreo continuo en principales ciudades y polos de inversión inmobiliaria.', footer_telegram: 'Canal de Telegram',
    footer_col_info: 'Información y Seguridad', footer_col_support: 'Soporte y Contacto', footer_no_agency: 'Sin comisiones ni intermediación', footer_wa_support: 'Atención directa por WhatsApp',
    footer_theme_label: 'Modo Visual', footer_copy: '© 2026 Origgo. Conexión directa entre compradores y propietarios sin intermediarios.',
    footer_disclaimer_title: 'Aviso de Confianza:', footer_disclaimer: 'Origgo es una herramienta para conectar compradores directamente con propietarios. No cobramos comisiones ni participamos en las negociaciones. Te recomendamos siempre revisar la documentación del inmueble antes de hacer acuerdos.',
    toast_default_title: 'Notificación Origgo', toast_action_required: 'Acción Requerida', toast_attention: 'Atención', toast_info: 'Información',
    toast_radar_active: '🔔 ¡Radar activado! Te avisaremos en tu teléfono cuando se capte un nuevo inmueble directo.',
    toast_radar_unsupported: 'Tu navegador no soporta notificaciones push nativas.', toast_radar_denied: 'Permiso de notificaciones rechazado o bloqueado.',
    stat_leads_total: 'Propietarios Directos', stat_ciudades: 'Ciudades Activas', stat_sectores: 'Sectores Monitoreados', catalog_freshness: 'Actualizado hace un momento'
  },
  en: {
    vip_btn_default: 'Credits / Plans', vip_btn_title: 'View Credits & Plans', lang_btn_label: 'Change language', search_placeholder: 'Search by neighborhood, city or keyword...', search_clear: 'Clear search',
    filter_all_cities: 'All Cities', filter_colombia_all: 'Colombia (All)', filter_today: 'Captured Today', filter_today_title: 'Deals captured in the last 24 hours',
    sort_placeholder: 'Sort by', sort_recent: 'Most Recent', sort_price_asc: 'Price: Low to High', sort_price_desc: 'Price: High to Low', sort_discount: 'Highest Arbitrage / Discount', sort_m2_asc: 'Lowest $/sqm', sort_rebajas: 'Recent Price Drop', filter_op_all: 'All Operations', filter_op_sale: 'For Sale', filter_op_rent: 'For Rent',
    hero_title: 'Properties for sale <span class="editorial-italic">directly</span> from owners',
    hero_subtitle: 'Zero middleman and zero agency commissions. Fresh off-market opportunities and urgent price drops detected today in Colombia.',
    hero_badge_suffix: 'Districts Monitored in Real Time', hero_cta: 'View Available Direct Properties', hero_about_pill_text: 'What is Origgo?',
    catalog_heading: 'Live Direct Listings', catalog_eyebrow: 'VERIFIED PORTFOLIO',
    catalog_count_suffix: 'direct opportunities', catalog_count_single: 'direct opportunity',
    marquee_direct_title: '0% Commission', marquee_direct_sub: 'Direct deal',
    marquee_alerts_title: 'Alerts < 3 Min', marquee_alerts_sub: 'Real time',
    marquee_arbitrage_title: 'High Arbitrage', marquee_arbitrage_sub: 'Below market',
    marquee_access_title: 'Open Access', marquee_access_sub: 'Verified leads',
    catalog_empty_title: 'No opportunities found in this area', catalog_empty_desc: 'No direct owner listings found with the active filters. You can explore other cities or reset filters.',
    catalog_btn_reset: 'Reset all filters', card_view_details: 'View Details', card_listed_price: 'Listed Price',
    card_unlock_btn: 'View Direct Contact', card_unlock_closed: 'View Closed', card_unlocked_badge: 'Unlocked', card_view_ad: 'View Listing',
    card_whatsapp: 'WhatsApp', card_call: 'Call', card_reveal_contact: 'Reveal Contact',
    card_time_now: '⚡ Just now', card_time_ago_min: '{n}m ago', card_time_ago_hours: '{n}h ago', card_time_ago_days: '{n}d ago',
    card_usd_prefix: '≈ $', card_usd_suffix: 'USD',
    slideup_title: 'Property Overview', slideup_close_title: 'Close Overview',
    slideup_trust_badge: 'Direct Deal with Owner', slideup_trust_desc: 'Property marketed directly by its legitimate owner. Zero brokerage markups and zero intermediate agents, ready for direct call or WhatsApp.',
    slideup_unlocked_title: 'Unlocked Contact Details', slideup_call_owner: 'Call Owner',
    slideup_direct_ad: 'View Original Listing', slideup_unlock_heading: 'Unlock Verified Owner Direct Contact',
    slideup_unlock_desc: 'Get immediate verified telephone, direct link, and WhatsApp of the owner to negotiate with no intermediaries.',
    slideup_unlock_btn: 'Unlock with Credits',
    modal_summary_property: 'Property:', modal_summary_location: 'Location:', modal_summary_price: 'Listed Price:', modal_summary_unit_value: 'Unit Value:',
    checkout_badge: 'Wompi Secure Payment Gateway', checkout_title: 'Direct Owner Contact Unlock', checkout_subtitle: 'No middlemen, zero broker commissions, and no recurring commitments.',
    checkout_tab_buy: 'Buy Passes', checkout_tab_restore: 'Restore Account', checkout_tab_account: 'My Membership', checkout_freemium_ribbon: '🎁 WELCOME GIFT ($0)', checkout_opt_free_title: '1 Free Unlock', checkout_opt_free_desc: 'Try it free. 1 direct contact gift by entering your WhatsApp and Email.', checkout_btn_magic_link: 'Direct Secure Access', checkout_label_email: 'Email (for Passwordless Secure Access):', checkout_help_email: 'We will send your instant access link with no passwords or complex PINs needed.',
    checkout_opt_single_title: 'Single Direct Unlock', checkout_opt_single_desc: '1 Verified direct owner contact. Ideal for a one-off negotiation.',
    checkout_opt_pack10_title: '10 Contacts Pro Pack', checkout_opt_pack10_desc: 'Only $3,500 each. Credits never expire and remain sealed to your secure PIN.',
    checkout_opt_city_title: 'Pro City Pass', checkout_opt_city_desc: 'Unlimited 30-day access to all direct owners in your chosen city.',
    checkout_opt_nat_title: 'National VIP Pass', checkout_opt_nat_desc: 'Full access across Colombia + Exclusive Price Drop radar.',
    checkout_popular_ribbon: '⭐ Most Popular (-30%)', checkout_month_suffix: '/ month', checkout_city_select_default: '-- Select your target city --',
    checkout_label_city: 'Unlimited Coverage City (Pro Pass):', checkout_city_help: 'Your pass unlocks all direct contacts in your chosen city for 30 full days.',
    checkout_wa_alert_title: 'Important: Enter your REAL active WhatsApp', checkout_wa_alert_desc: 'This number is your unique security key. If you enter an invalid number, you cannot access credits or restore your PIN. We never spam or place phone calls.',
    checkout_label_whatsapp: 'Authentication WhatsApp (10 digits):', checkout_ph_whatsapp: 'E.g., 300 123 4567', checkout_help_whatsapp: 'Your credits are cryptographically sealed to this phone number.',
    checkout_btn_pay: 'Proceed to Secure Payment with Wompi', checkout_btn_pay_default: 'Pay with Wompi', checkout_btn_wompi_note: 'PSE, Nequi, Credit & Debit Cards', checkout_merchant_title: 'Official Billing Merchant:', checkout_merchant_desc: 'Your payment is securely processed through an officially monitored payment gateway under our registered merchant Desmulta.', checkout_guarantee_wompi: 'Regulated Wompi Gateway (SFC Monitored)', checkout_guarantee_instant: 'Instant Activation',
    checkout_restore_title: 'Restore your session with PIN or Payment Reference', checkout_btn_restore: 'Restore My Credits', checkout_restore_intro: 'If you previously bought credits on another device, enter your WhatsApp and Origgo Access PIN (e.g. HNT-7489).',
    checkout_restore_wa_label: 'Registered WhatsApp:', checkout_restore_pin_label: 'Access PIN or Wompi Ref:', checkout_restore_pin_ph: 'E.g., HNT-7489 or Payment Reference', checkout_restore_pin_help: 'Enter your PIN or paste the bank reference code to auto-credit your balance.',
    checkout_forgot_pin_btn: 'Forgot your PIN? Restore via Email', checkout_forgot_pin_desc: 'Enter the Email used during your Wompi checkout. We will email your login link.',
    checkout_email_label: 'Checkout Email:', checkout_email_ph: 'user@example.com', checkout_btn_send_instructions: 'Send instructions',
    checkout_user_pin_protected: 'Protected PIN', checkout_user_balance_label: 'Available Balance', checkout_user_benefits_btn: 'View Membership Privileges', checkout_user_btn_plans: 'Plans & Top-Ups', checkout_user_btn_logout: 'Log Out',
    welcome_badge: 'VIP ACCESS CONFIRMED', welcome_title: 'Welcome to Origgo!', welcome_subtitle: 'Your direct pipeline to property owners without real estate agency fees.',
    welcome_wa_label: 'Linked WhatsApp', welcome_pin_label: 'Your Master Access PIN', welcome_copy_btn: 'Copy', welcome_privileges_tag: 'Your Active Privileges', welcome_footer_note: '100% Direct Deal • Zero Middlemen • Zero Hidden Fees', welcome_pin_desc: 'Keep your 4-digit PIN safe. You can use it to restore your access on any device.', welcome_btn_explore: 'Start Exploring Deals',
    push_badge: 'LIVE OPPORTUNITY RADAR', push_title: 'Enable Real-Time Direct Listing Alerts?', push_subtitle: 'Receive instant phone alerts the exact second an owner publishes an off-market property with zero brokerage commissions.',
    push_feature_1: 'Total head-start:', push_feature_1_desc: 'Catch fresh deals before they reach saturated portals or agency catalogs.', push_feature_2: 'Filter by city:', push_feature_2_desc: 'Geolocated alerts tailored to your investment or residential area.', push_feature_3: '100% spam-free:', push_feature_3_desc: 'Only genuine verified direct-owner listings and urgent discounts.', push_btn_accept: 'Activate Radar on Phone', push_btn_later: 'Maybe later / Explore first', push_city_label: 'Alerts target city or region:', push_city_all: '🇨🇴 All Colombia', push_btn_update: 'Save Radar Preference',
    push_ios_title: 'To activate on iPhone:', push_ios_desc: ' Tap Share (⎋) in Safari and tap "Add to Home Screen" (+).', push_op_label: 'Deal type:', push_op_all: '🏷️ All (Sale & Rent)', push_op_sale: '🏡 For Sale Only', push_op_rent: '🔑 For Rent Only', push_discount_label: '📉 Only alert me if the owner drops the price or applies an urgent discount',
    nav_home: 'Home', nav_search: 'Search', nav_theme: 'Theme', nav_credits: 'Credits', nav_menu: 'Menu', menu_lang_label: 'Language / Idioma', menu_city_label: 'Target City',
    menu_about: 'What is Origgo?', menu_dashboard: 'Main Dashboard', menu_direct_leads: 'Direct Properties', menu_push: 'Enable Live Radar Alerts', menu_theme: 'Light / Dark Mode', menu_vip: 'VIP Unlocks', menu_support: 'WhatsApp VIP Support', menu_terms: 'Terms & Disclaimers', menu_logout: 'Log Out',
    onboarding_badge: 'WELCOME TO ORIGGO', onboarding_title: 'Direct deals, person to person.',
    onboarding_subtitle: 'Where buyers and investors connect directly with verified owners, zero middlemen.',
    onboarding_p1_title: 'Discover first, before the crowd', onboarding_p1_desc: 'We monitor the market daily to catch deals freshly listed by their owners, before agencies step in.',
    onboarding_p2_title: 'Direct negotiations, 0% commission', onboarding_p2_desc: 'Deal directly with the owner. No brokerage fees, no middleman markups, and no fine print.',
    onboarding_p3_title: 'Full control in your hands', onboarding_p3_desc: 'Browse the portfolio freely. Whenever you spot a deal you like, unlock direct contact in one tap.',
    onboarding_cta_btn: 'Start Exploring Opportunities', onboarding_footer_note: '100% Direct Deals • Zero Agency Commission • Verified Records',
    legal_header_tag: 'Transparency & Trust', legal_title: 'How Origgo Works', legal_subtitle: 'Clear, transparent information for buyers and property owners',
    legal_tab_how: 'How It Works', legal_tab_security: 'Security', legal_tab_privacy: 'Your Data', legal_tab_guarantee: 'Balance Guarantee', legal_btn_accept: 'Understood',
    footer_bio: 'Direct connection platform with property owners in Colombia. Zero middleman, zero agency commissions, and real-time verified opportunities.',
    footer_tagline: 'Continuous monitoring across Colombia’s major investment hubs.', footer_telegram: 'Telegram Channel',
    footer_col_info: 'Information & Security', footer_col_support: 'Support & Contact', footer_no_agency: 'Zero agency fees and zero broker commissions', footer_wa_support: 'Direct WhatsApp support',
    footer_theme_label: 'Visual Theme', footer_copy: '© 2026 Origgo. Direct connection between buyers and owners with no intermediaries.',
    footer_disclaimer_title: 'Trust Notice:', footer_disclaimer: 'Origgo is a tool to connect buyers directly with property owners. We do not charge broker commissions nor take part in negotiations. We always recommend reviewing property title and documentation before agreements.',
    toast_default_title: 'Origgo Notification', toast_action_required: 'Action Required', toast_attention: 'Attention', toast_info: 'Information',
    toast_radar_active: '🔔 Radar activated! We will notify your phone when a new direct property is captured.', toast_radar_unsupported: 'Your browser does not support native push notifications.', toast_radar_denied: 'Notification permission was denied or blocked.', stat_leads_total: 'Direct Owners', stat_ciudades: 'Active Cities', stat_sectores: 'Sectors Monitored', catalog_freshness: 'Updated moments ago'
  }
};

const TEXTOS_LEGALES_ORIGGO_EN = {
  terminos: {
    titulo: 'How Origgo Works', subtitulo: 'Clear, transparent information for buyers and owners', badge: 'Transparency & Trust', icono: 'fa-solid fa-scale-balanced',
    html: '<div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-handshake"></i> 1. Direct Owner Connection</div><p>We connect buyers directly with property owners. Zero agency commissions or brokerage fees.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-bullseye"></i> 2. Fresh Direct Opportunities</div><p>Direct opportunities and urgent price cuts detected daily in Colombia before reaching agencies.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-user-shield"></i> 3. Personal & Commercial Use</div><p>Access to contacts is for your direct use. We safeguard data against spam.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-lock"></i> 4. Secure Payments with Wompi</div><p>Payments are securely processed via Wompi (regulated by SFC). Origgo never stores card or bank details.</p></div>'
  }, exoneracion: {
    titulo: 'Security & Direct Deals', subtitulo: 'Important recommendations for a safe, transparent transaction', badge: 'Security', icono: 'fa-solid fa-shield-halved',
    html: '<div class="legal-section legal-section-warning"><div class="legal-section-badge"><i class="fa-solid fa-circle-exclamation"></i> 1. Zero Brokerage Fees</div><p>Origgo <strong>is not a real estate agency and charges no commissions</strong>. You negotiate directly one-on-one with the property owner.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-magnifying-glass"></i> 2. Inspect Before Paying</div><p>We recommend visiting the property in person, meeting the owner, and requesting an official Title Certificate before transferring funds.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-comments"></i> 3. Direct Agreements</div><p>Listings are sourced from open public listings. Any final agreement or sale deed is strictly between you and the owner.</p></div>'
  }, privacidad: {
    titulo: 'Privacy & Your Data', subtitulo: 'Data protection under Law 1581 of 2012 and GDPR', badge: 'Protected Data', icono: 'fa-solid fa-user-shield',
    html: '<div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-lock"></i> 1. How We Use Phone & Email</div><p>Your WhatsApp and email are only used to deliver access codes, store credits and send receipts. <strong>Zero data selling and zero spam</strong>.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-globe"></i> 2. Cataloged Listings</div><p>Information is indexed from open listings published by owners across the web.</p></div><div class="legal-section legal-section-highlight"><div class="legal-section-badge"><i class="fa-brands fa-whatsapp"></i> 3. Owner Listing Delisting</div><p>If you are the owner of a published property and wish to remove it, message our WhatsApp support and we delist it immediately for free.</p></div>'
  }, reembolsos: {
    titulo: 'Balance Guarantee & Support', subtitulo: 'Your money and unlocked access are always protected', badge: 'Balance Guarantee', icono: 'fa-solid fa-rotate-left',
    html: '<div class="legal-section legal-section-highlight"><div class="legal-section-badge"><i class="fa-solid fa-key"></i> 1. Your Balance Never Expires</div><p>If you change devices or clear your browser, your credits remain safe. Restore them anytime via <strong>"Restore Account"</strong> with your WhatsApp.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-bolt"></i> 2. Instant Lead Reveal</div><p>Every time you unlock a lead, verified owner details appear immediately on your screen.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-brands fa-whatsapp"></i> 3. Priority Direct Support</div><p>If you had any issue with a payment or the system, contact us directly on WhatsApp for immediate credit resolution.</p></div>'
  }
};

/**
 * Retorna el idioma actualmente seleccionado ('es' o 'en').
 * @returns {'es'|'en'}
 */
function obtenerIdiomaActual() {
  try {
    const almacenado = localStorage.getItem('origgo_lang');
    if (almacenado === 'es' || almacenado === 'en') return almacenado;
  } catch (e) {}
  if (typeof obtenerCookieSegura === 'function') {
    const c = obtenerCookieSegura('origgo_lang');
    if (c === 'es' || c === 'en') return c;
    try {
      const p = JSON.parse(obtenerCookieSegura('origgo_prefs') || '{}');
      if (p.lang === 'es' || p.lang === 'en') return p.lang;
    } catch (_) {}
  }
  if (typeof navigator !== 'undefined' && navigator.language && navigator.language.startsWith('en')) return 'en';
  return 'es';
}

/**
 * Traduce una clave del diccionario con fallback seguro.
 * @param {string} clave
 * @param {string} [fallback]
 * @returns {string}
 */
function t(clave, fallback = '') {
  const lang = obtenerIdiomaActual();
  const dict = DICCIONARIO_I18N[lang] || DICCIONARIO_I18N.es;
  return dict[clave] !== undefined ? dict[clave] : (fallback || clave);
}

/**
 * Convierte un monto en COP a valor aproximado en USD de forma elegante.
 * @param {string|number} precioStr
 * @returns {string} Ej: "≈ $109,750 USD"
 */
function calcularReferenciaUSD(precioStr) {
  if (!precioStr) return '';
  const limpio = String(precioStr).replace(/[^0-9]/g, '');
  const valorCop = Number(limpio);
  if (isNaN(valorCop) || valorCop <= 0) return '';
  const usd = Math.round(valorCop / TASA_CAMBIO_USD_COP);
  const usdFormateado = usd.toLocaleString('en-US');
  const lang = obtenerIdiomaActual();
  return lang === 'en' ? `≈ $${usdFormateado} USD` : `~$${usdFormateado} USD`;
}

/**
 * Actualiza las insignias de referencia en USD en todas las tarjetas Bento.
 */
function sincronizarPreciosUsdEnDOM() {
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  document.querySelectorAll('.bento-card').forEach(card => {
    const priceMain = card.querySelector('.price-main');
    if (!priceMain) return;
    let elUsd = card.querySelector('.card-price-usd');
    const valorCop = priceMain.textContent.trim(), usdRef = calcularReferenciaUSD(valorCop);
    if (usdRef) {
      if (!elUsd) {
        elUsd = document.createElement('div');
        elUsd.className = 'card-price-usd';
        priceMain.parentNode.insertBefore(elUsd, priceMain.nextSibling);
      }
      elUsd.textContent = usdRef;
    }
  });
  const usdMap = { single_lead: '≈ $1.20 USD', pack_10_leads: '≈ $8.50 USD', subscription_city: '≈ $22 USD/mo', subscription_national: '≈ $36 USD/mo' };
  document.querySelectorAll('.pricing-option-card').forEach(card => {
    const pEl = card.querySelector('.option-price');
    if (!pEl) return;
    let badgeUsd = card.querySelector('.option-usd-ref');
    const prod = card.getAttribute('data-product'), refTxt = usdMap[prod];
    if (refTxt && isEn) {
      if (!badgeUsd) {
        badgeUsd = document.createElement('span');
        badgeUsd.className = 'option-usd-ref';
        pEl.appendChild(badgeUsd);
      }
      badgeUsd.textContent = ` (${refTxt})`;
    } else if (badgeUsd) { badgeUsd.remove(); }
  });
}

/**
 * Aplica exhaustivamente las traducciones sobre todos los elementos del DOM.
 */
function aplicarTraduccionesAlDOM() {
  const lang = obtenerIdiomaActual();
  const dict = DICCIONARIO_I18N[lang] || DICCIONARIO_I18N.es;
  
  // 1. Elementos con data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      if (key === 'hero_title') {
        el.innerHTML = dict[key];
      } else {
        el.textContent = dict[key];
      }
    }
  });

  const selCity = document.getElementById('checkoutCitySelect');
  if (selCity) {
    const optDef = selCity.querySelector('option[value=""]');
    if (optDef) optDef.textContent = dict.checkout_city_select_default || '-- Selecciona tu ciudad --';
  }

  // 2. Placeholders y tooltips
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { const k = el.getAttribute('data-i18n-ph'); if (dict[k]) el.setAttribute('placeholder', dict[k]); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { const k = el.getAttribute('data-i18n-title'); if (dict[k]) el.setAttribute('title', dict[k]); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { const k = el.getAttribute('data-i18n-aria'); if (dict[k]) el.setAttribute('aria-label', dict[k]); });

  // 3. Botón de ordenamiento
  const sortBtn = document.getElementById('cmdFilterSort');
  if (sortBtn) {
    const sortVal = typeof criterioOrdenActivo !== 'undefined' ? criterioOrdenActivo : '';
    const labelMap = { '': dict.sort_recent, 'reciente': dict.sort_recent, 'recientes': dict.sort_recent, 'precio_asc': dict.sort_price_asc, 'precio_desc': dict.sort_price_desc, 'descuento': dict.sort_discount, 'precio_m2_asc': dict.sort_m2_asc, 'rebajas': dict.sort_rebajas };
    const span = sortBtn.querySelector('#cmdFilterSortLabel') || sortBtn.querySelector('span');
    if (span) span.textContent = labelMap[sortVal] || dict.sort_recent || dict.sort_placeholder;
    document.querySelectorAll('#cmdSortDropdown .cmd-dropdown-item').forEach(item => {
      const sVal = item.getAttribute('data-sort'), itemSpan = item.querySelector('span');
      if (itemSpan && labelMap[sVal]) itemSpan.textContent = labelMap[sVal];
    });
  }

  // 4. Selector de Ciudad y Operación (Labels)
  const locLabel = document.getElementById('cmdFilterLocationLabel');
  if (locLabel && (typeof filtroCiudadActivo === 'undefined' || !filtroCiudadActivo)) locLabel.textContent = dict.filter_all_cities;
  const opLabel = document.getElementById('cmdFilterOperationLabel');
  if (opLabel) { const opMap = { '': dict.filter_op_all, 'venta': dict.filter_op_sale, 'arriendo': dict.filter_op_rent }; opLabel.textContent = opMap[typeof filtroOperacionActivo !== 'undefined' ? filtroOperacionActivo : ''] || dict.filter_op_all; }

  // 5. Botones de tarjetas bento
  document.querySelectorAll('.btn-specs-pill').forEach(btn => { btn.innerHTML = `${dict.card_view_details} <i class="fa-solid fa-chevron-up"></i>`; });
  document.querySelectorAll('.pricing-label').forEach(label => { label.textContent = dict.card_listed_price; });
  document.querySelectorAll('.btn-unlock-lead:not(.closed)').forEach(btn => { btn.innerHTML = `<i class="fa-solid fa-lock"></i> ${dict.card_unlock_btn}`; });
  document.querySelectorAll('.card-unlocked-badge').forEach(badge => { badge.innerHTML = `<i class="fa-solid fa-unlock"></i> ${dict.card_unlocked_badge}`; });
  document.querySelectorAll('.btn-view-ad-direct').forEach(btn => { btn.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i> ${dict.card_view_ad}`; });

  // 6. Precios referenciales USD en tarjetas
  sincronizarPreciosUsdEnDOM();

  // 7. Badge de sectores y contador de catálogo dinámicos
  const elBadgeSectoresHero = document.getElementById('badgeSectoresHero');
  if (elBadgeSectoresHero) {
    const m = (elBadgeSectoresHero.textContent || '').match(/\d+/);
    const n = m ? m[0] : '26';
    elBadgeSectoresHero.textContent = `${n} ${dict.hero_badge_suffix}`;
  }
  const countEl = document.getElementById('catalogCountText');
  if (countEl) {
    const m = (countEl.textContent || '').match(/\d+/);
    const n = m ? parseInt(m[0], 10) : 0;
    countEl.textContent = `${n} ${n === 1 ? dict.catalog_count_single : dict.catalog_count_suffix}`;
  }

  // 8. Sincronizar estado visual de los botones de idioma
  document.querySelectorAll('.lang-btn, .side-lang-btn').forEach(btn => {
    const targetLang = btn.getAttribute('data-lang');
    if (targetLang === lang) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
  });

  // 9. Atributo lang global en el HTML con inmunidad notranslate
  if (document.documentElement) {
    document.documentElement.lang = lang;
    document.documentElement.classList.add('notranslate');
    document.documentElement.setAttribute('translate', 'no');
  }

  // 10. Aviso anti-impresión localizado
  const printNotice = document.getElementById('printProtectionNotice');
  if (printNotice) {
    const isEn = lang === 'en';
    const b = printNotice.querySelector('.print-notice-badge'), t = printNotice.querySelector('.print-notice-title'), l = printNotice.querySelector('.print-notice-lead'), c = printNotice.querySelector('.print-notice-card');
    if (b) b.textContent = isEn ? 'ORIGGO PRIVACY & SECURITY' : 'SEGURIDAD Y PRIVACIDAD ORIGGO';
    if (t) t.textContent = isEn ? 'PROTECTED DOCUMENT — LAW 1581 OF 2012' : 'DOCUMENTO PROTEGIDO — LEY 1581 DE 2012';
    if (l) l.textContent = isEn ? 'Due to constitutional data protection (Habeas Data) and unauthorized brokerage prevention, printing or mass scraping of this catalog is strictly restricted.' : 'Por protección constitucional de datos personales de los propietarios (Habeas Data) y prevención de intermediación inmobiliaria no autorizada, la impresión, exportación a PDF o extracción masiva de este catálogo está estrictamente restringida.';
    if (c) c.innerHTML = isEn
      ? '<p><strong>Personal & Exclusive Use:</strong> Direct owner contact details may only be accessed individually by authenticated account holders.</p><p><strong>Active Forensic Traceability:</strong> Mass redistribution, commercial resale, or forwarding this directory to third-party brokers violates platform terms and Colombian Data Protection regulations.</p>'
      : '<p><strong>Uso Personal y Exclusivo:</strong> Los números telefónicos y datos de contacto directo de los inmuebles únicamente pueden ser consultados de forma individual por el titular de la cuenta autenticada.</p><p><strong>Trazabilidad Forense Activa:</strong> Cualquier redistribución masiva, comercialización o suministro de este directorio a terceras inmobiliarias o bases de datos externas vulnera las políticas de la plataforma y el Régimen General de Protección de Datos Personales de Colombia.</p>';
  }

  // 11. Sincronizar badge VIP según idioma
  if (typeof actualizarBadgeVip === 'function') actualizarBadgeVip();
}

/**
 * Conmuta el idioma de manera instantánea y atómica en el DOM (0ms de latencia, cero parpadeos).
 * @param {'es'|'en'} nuevoIdioma
 */
function cambiarIdioma(nuevoIdioma) {
  if (nuevoIdioma !== 'es' && nuevoIdioma !== 'en') return;
  const actual = obtenerIdiomaActual();
  if (actual === nuevoIdioma) return;

  try { localStorage.setItem('origgo_lang', nuevoIdioma); } catch (e) {}
  if (typeof sincronizarPreferenciasEnServidor === 'function') sincronizarPreferenciasEnServidor(nuevoIdioma, null);

  aplicarTraduccionesAlDOM();

  // Re-renderizar la grilla Bento para reflejar instantáneamente el nuevo idioma
  if (typeof datosActuales !== 'undefined' && datosActuales && typeof renderizarInterfaz === 'function') {
    renderizarInterfaz(datosActuales);
  }

  // Actualizar cualquier ficha técnica abierta
  traducirSlideupDrawer();

  // Actualizar badges y botones VIP
  if (typeof actualizarBadgeVip === 'function') actualizarBadgeVip();

  // Actualizar modales abiertos si están activos en pantalla
  if (typeof renderizarContenidoLegal === 'function') {
    const modalLegal = document.getElementById('modalLegalOverlay');
    if (modalLegal && modalLegal.classList.contains('active')) {
      const activeTab = typeof pestanaLegalActiva !== 'undefined' ? pestanaLegalActiva : 'terminos';
      renderizarContenidoLegal(activeTab);
    }
  }

  const checkoutModal = document.getElementById('checkoutModal');
  if (checkoutModal && checkoutModal.classList.contains('active') && typeof abrirModalCheckout === 'function') {
    abrirModalCheckout();
  }

  const welcomeModal = document.getElementById('modalWelcomeSuccess');
  if (welcomeModal && welcomeModal.classList.contains('active') && typeof abrirModalBienvenidaVIP === 'function') {
    abrirModalBienvenidaVIP(null, typeof sesionUsuario !== 'undefined' ? sesionUsuario : null);
  }

  window.dispatchEvent(new CustomEvent('origgo:languageChanged', { detail: { lang: nuevoIdioma } }));
}

/**
 * Traduce dinámicamente las especificaciones del Slide-up Drawer al abrirse o cambiar de idioma.
 */
function traducirSlideupDrawer() {
  const lang = obtenerIdiomaActual(), dict = DICCIONARIO_I18N[lang] || DICCIONARIO_I18N.es, isEn = lang === 'en';
  document.querySelectorAll('.card-slideup-overlay').forEach(overlay => {
    const card = overlay.closest('.bento-card');
    const isUnlocked = card?.classList.contains('card-unlocked');
    const cTitle = card?.querySelector('.card-title')?.textContent;
    const sTitle = overlay.querySelector('.slideup-title');
    if (sTitle) sTitle.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${isUnlocked && cTitle ? escaparHtml(cTitle) : dict.slideup_title}`;
  });
  document.querySelectorAll('.trust-badge').forEach(b => { b.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${dict.slideup_trust_badge}`; });
  document.querySelectorAll('.trust-desc').forEach(d => { d.textContent = dict.slideup_trust_desc; });
  document.querySelectorAll('.unlocked-phone-label').forEach(l => { l.innerHTML = `<i class="fa-solid fa-unlock"></i> ${dict.slideup_unlocked_title}`; });
  document.querySelectorAll('.next-steps-title').forEach(t => { t.innerHTML = `<i class="fa-solid fa-list-check"></i> ${isEn ? 'Next Steps to Close Deal' : 'Siguientes Pasos de Negociación'}`; });
  document.querySelectorAll('.slideup-next-steps').forEach(steps => {
    const list = steps.querySelector('.next-steps-list');
    if (list) {
      list.innerHTML = `<li class="next-step-item"><span class="next-step-num">1</span><span><strong>${isEn ? 'Contact:' : 'Contacto:'}</strong> ${isEn ? 'Send pre-formatted WhatsApp message or place direct phone call.' : 'Envía el mensaje de WhatsApp preparado o realiza llamada directa.'}</span></li><li class="next-step-item"><span class="next-step-num">2</span><span><strong>${isEn ? 'Tour:' : 'Visita:'}</strong> ${isEn ? 'Ask for additional media and arrange property walkthrough.' : 'Pide fotos adicionales y agenda visita presencial al inmueble.'}</span></li><li class="next-step-item"><span class="next-step-num">3</span><span><strong>${isEn ? 'Deal:' : 'Acuerdo:'}</strong> ${isEn ? 'Verify title certificate and negotiate with zero agency fees.' : 'Verifica el certificado de tradición y acuerda sin pagar comisión.'}</span></li>`;
    }
  });
  document.querySelectorAll('.slideup-cta-btn:not(.btn-whatsapp-direct):not(.cta-call):not(.cta-neutral)').forEach(btn => {
    btn.innerHTML = `<i class="fa-solid fa-unlock-keyhole"></i> ${dict.slideup_unlock_btn || (isEn ? 'Unlock Owner Contact' : 'Desbloquear Contacto del Dueño')}`;
  });
  document.querySelectorAll('.slideup-cta-btn.cta-call, .btn-call-direct').forEach(btn => { btn.innerHTML = `<i class="fa-solid fa-phone"></i> ${isEn ? 'Call' : 'Llamar'}`; });
  document.querySelectorAll('.slideup-cta-btn.cta-neutral, .btn-view-ad-direct').forEach(btn => { btn.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i> ${isEn ? 'View Listing' : 'Ver Anuncio'}`; });
  document.querySelectorAll('.slideup-cta-note:not(.slideup-cta-note-ok)').forEach(note => {
    note.innerHTML = `<i class="fa-solid fa-bolt"></i> ${isEn ? 'Instant access • Zero broker commissions' : 'Acceso al instante • Sin pagar comisiones'}`;
  });
  document.querySelectorAll('.slideup-cta-note-ok').forEach(note => {
    note.innerHTML = `<i class="fa-solid fa-check-double"></i> ${isEn ? 'Contact and direct link unlocked for your account' : 'Contacto y enlace directo desbloqueados para tu cuenta'}`;
  });
  const specKeyMap = [
    { match: /estrato|stratum|tier/i, icon: 'fa-layer-group', es: 'Estrato', en: 'Stratum' },
    { match: /área|area|superficie/i, icon: 'fa-ruler-combined', es: 'Área', en: 'Built Area' },
    { match: /hab|alcoba|bed/i, icon: 'fa-bed', es: 'Habitaciones', en: 'Bedrooms' },
    { match: /baño|bath/i, icon: 'fa-bath', es: 'Baños', en: 'Bathrooms' },
    { match: /parqueadero|garaje|parking/i, icon: 'fa-square-parking', es: 'Parqueaderos', en: 'Parking' },
    { match: /contacto|contact/i, icon: 'fa-user-shield', es: 'Contacto', en: 'Contact' },
    { match: /tipo|type/i, icon: 'fa-building', es: 'Tipo', en: 'Property Type' },
    { match: /ubicación|location/i, icon: 'fa-location-dot', es: 'Ubicación', en: 'Location' },
    { match: /operación|deal/i, icon: 'fa-handshake', es: 'Operación', en: 'Deal Type' }
  ];
  document.querySelectorAll('.slideup-spec-card').forEach(card => {
    const keyEl = card.querySelector('.slideup-spec-key'), valEl = card.querySelector('.slideup-spec-val');
    if (!keyEl || !valEl) return;
    const txtKey = keyEl.textContent.trim();
    for (const item of specKeyMap) {
      if (item.match.test(txtKey)) { keyEl.innerHTML = `<i class="fa-solid ${item.icon}"></i> ${isEn ? item.en : item.es}`; break; }
    }
    const txtVal = valEl.textContent.trim().toLowerCase();
    if (/contacto|contact/i.test(txtKey) || /propietario|owner|verificado|verified/i.test(txtVal)) {
      valEl.innerHTML = `<span class="verified-badge-wrap"><i class="fa-solid fa-circle-check verified-badge-icon"></i> ${isEn ? 'Verified Owner' : 'Propietario Verificado'}</span>`;
    } else if (isEn) {
      valEl.textContent = valEl.textContent
        .replace(/(\d+)\s*Residencial/gi, '$1 Residential')
        .replace(/\b1\s*alcobas?\b/gi, '1 Bedroom').replace(/(\d+)\s*alcobas?\b/gi, '$1 Bedrooms')
        .replace(/\b1\s*completos?\b/gi, '1 Full Bath').replace(/(\d+)\s*completos?\b/gi, '$1 Full Baths')
        .replace(/\b1\s*espacios?\b/gi, '1 Space').replace(/(\d+)\s*espacios?\b/gi, '$1 Spaces');
    }
  });
}

/**
 * Inicializa los escuchadores de los botones selectores de idioma.
 */
function inicializarSelectorIdiomas() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-btn, .side-lang-btn');
    if (btn) {
      e.preventDefault();
      const targetLang = btn.getAttribute('data-lang');
      if (targetLang) cambiarIdioma(targetLang);
      return;
    }
    if (e.target.closest('[data-action="abrir-ficha"]')) {
      setTimeout(() => { if (obtenerIdiomaActual() === 'en') traducirSlideupDrawer(); }, 40);
    }
  });
  const container = document.getElementById('bentoGridContainer');
  if (container && window.MutationObserver) {
    const observer = new MutationObserver(() => {
      sincronizarPreciosUsdEnDOM();
      if (obtenerIdiomaActual() === 'en') aplicarTraduccionesAlDOM();
    });
    observer.observe(container, { childList: true });
  }
  aplicarTraduccionesAlDOM();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializarSelectorIdiomas);
  else inicializarSelectorIdiomas();
}
if (typeof window !== 'undefined') { Object.assign(window, { obtenerIdiomaActual, cambiarIdioma, t, calcularReferenciaUSD, aplicarTraduccionesAlDOM, traducirSlideupDrawer, TEXTOS_LEGALES_ORIGGO_EN }); }
if (typeof module !== 'undefined' && module.exports) { module.exports = { DICCIONARIO_I18N, obtenerIdiomaActual, cambiarIdioma, t, calcularReferenciaUSD, aplicarTraduccionesAlDOM, traducirSlideupDrawer }; }


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


/**
 * 💡 MÓDULO DE BÚSQUEDA INTELIGENTE Y AUTOCOMPLETADO (modules/15-autocomplete.js)
 * Sugerencias contextuales en tiempo real, navegación táctil y por teclado,
 * accesibilidad ARIA completa y sanitización OWASP contra inyecciones XSS.
 * Estándar Ecosistema Desmulta DevSecOps (< 500 líneas).
 */

const SUGERENCIAS_TACTICAS_BASE = [
  // Ciudades y Sectores Estratégicos
  { texto: 'El Chicó, Bogotá', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Chico' },
  { texto: 'Rosales, Bogotá', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Rosales' },
  { texto: 'El Virrey, Bogotá', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Virrey' },
  { texto: 'El Poblado, Medellín', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Poblado' },
  { texto: 'Laureles, Medellín', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Laureles' },
  { texto: 'Pance, Cali', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Pance' },
  { texto: 'Ciudad Jardín, Cali', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Ciudad Jardin' },
  { texto: 'Bocagrande, Cartagena', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Bocagrande' },
  { texto: 'Ruitoque Condominio, Bucaramanga', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Ruitoque' },
  { texto: 'Cerritos, Pereira', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Cerritos' },

  // Tipologías Arquitectónicas
  { texto: 'Penthouse con terraza', categoria: 'tipologia', icono: 'fa-building', filtro: 'Penthouse' },
  { texto: 'Apartamento amoblado', categoria: 'tipologia', icono: 'fa-couch', filtro: 'Amoblado' },
  { texto: 'Casa campestre en condominio', categoria: 'tipologia', icono: 'fa-tree', filtro: 'Campestre' },
  { texto: 'Apartaestudio con balcón', categoria: 'tipologia', icono: 'fa-door-open', filtro: 'Apartaestudio' },
  { texto: 'Oficina ejecutiva', categoria: 'tipologia', icono: 'fa-briefcase', filtro: 'Oficina' },

  // Oportunidades y Operación
  { texto: 'Propiedades con rebaja reciente', categoria: 'oportunidad', icono: 'fa-tag', filtro: 'rebaja' },
  { texto: 'Trato directo con propietario', categoria: 'oportunidad', icono: 'fa-handshake', filtro: 'propietario' },
  { texto: 'Apartamentos en venta directa', categoria: 'operacion', icono: 'fa-house-chimney', filtro: 'venta' },
  { texto: 'Apartamentos en arriendo', categoria: 'operacion', icono: 'fa-key', filtro: 'arriendo' }
];

let indiceSeleccionadoAutocomplete = -1;
let sugerenciasActivas = [];
let temporizadorDebounce = null;

/**
 * Escapa caracteres HTML peligrosos protegiendo de forma determinista contra XSS (OWASP A03).
 * @param {string} str
 * @returns {string}
 */
function escaparHtmlSeguro(str) {
  if (typeof escaparHtml === 'function') return escaparHtml(str);
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Resalta de forma segura la coincidencia de texto protegiendo contra XSS (OWASP A03).
 * @param {string} texto
 * @param {string} consulta
 * @returns {string} HTML seguro con etiqueta <mark>
 */
function resaltarCoincidenciaSegura(texto, consulta) {
  if (!texto) return '';
  const textoEscapado = escaparHtmlSeguro(texto);
  if (!consulta || consulta.trim().length === 0) return textoEscapado;

  const normaConsulta = typeof normalizarTextoBusqueda === 'function'
    ? normalizarTextoBusqueda(consulta)
    : consulta.toLowerCase().trim();

  const normaTexto = typeof normalizarTextoBusqueda === 'function'
    ? normalizarTextoBusqueda(texto)
    : texto.toLowerCase().trim();

  const indice = normaTexto.indexOf(normaConsulta);
  if (indice === -1) return textoEscapado;

  const fin = indice + consulta.trim().length;
  const antes = escaparHtmlSeguro(texto.slice(0, indice));
  const coincidencia = escaparHtmlSeguro(texto.slice(indice, fin));
  const despues = escaparHtmlSeguro(texto.slice(fin));

  return `${antes}<strong class="autocomplete-highlight">${coincidencia}</strong>${despues}`;
}

/**
 * Obtiene o crea el contenedor de sugerencias en el DOM.
 * @returns {HTMLElement|null}
 */
function obtenerOCrearDropdownAutocomplete() {
  if (typeof document === 'undefined') return null;
  let dropdown = document.getElementById('omniboxAutocomplete');
  if (!dropdown) {
    const searchBox = document.querySelector('.cmd-search-box');
    if (!searchBox) return null;

    dropdown = document.createElement('div');
    dropdown.id = 'omniboxAutocomplete';
    dropdown.className = 'cmd-autocomplete-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Sugerencias de búsqueda inteligente');
    dropdown.hidden = true;
    searchBox.appendChild(dropdown);
  }
  return dropdown;
}

/**
 * Genera sugerencias relevantes combinando la base táctica con las oportunidades del catálogo activo.
 * @param {string} textoUsuario
 * @returns {Array<Object>}
 */
function calcularSugerencias(textoUsuario) {
  if (!textoUsuario || textoUsuario.trim().length < 1) return [];

  const consultaNorm = typeof normalizarTextoBusqueda === 'function'
    ? normalizarTextoBusqueda(textoUsuario)
    : textoUsuario.toLowerCase().trim();

  const resultados = [];
  const vistos = new Set();

  // 1. Coincidencias con sugerencias tácticas predefinidas
  for (const item of SUGERENCIAS_TACTICAS_BASE) {
    const textoNorm = typeof normalizarTextoBusqueda === 'function'
      ? normalizarTextoBusqueda(item.texto)
      : item.texto.toLowerCase();

    if (textoNorm.includes(consultaNorm)) {
      resultados.push(item);
      vistos.add(item.texto.toLowerCase());
    }
  }

  // 2. Coincidencias dinámicas con títulos y ubicaciones del catálogo activo
  if (typeof datosActuales !== 'undefined' && datosActuales && Array.isArray(datosActuales.leads)) {
    for (const lead of datosActuales.leads) {
      if (resultados.length >= 6) break;

      const titulo = lead.titulo || '';
      const ubicacion = lead.barrio || lead.ciudad || lead.ubicacion || '';
      const candTitulo = `${titulo} (${ubicacion})`.trim();

      const tituloNorm = typeof normalizarTextoBusqueda === 'function'
        ? normalizarTextoBusqueda(candTitulo)
        : candTitulo.toLowerCase();

      if (tituloNorm.includes(consultaNorm) && !vistos.has(candTitulo.toLowerCase())) {
        resultados.push({
          texto: candTitulo,
          categoria: 'inmueble',
          icono: 'fa-house',
          filtro: lead.titulo || ubicacion
        });
        vistos.add(candTitulo.toLowerCase());
      }
    }
  }

  return resultados.slice(0, 6);
}

/**
 * Renderiza las sugerencias calculadas en el menú desplegable accesible.
 * @param {Array<Object>} lista
 * @param {string} consultaOriginal
 */
function renderizarMenuAutocomplete(lista, consultaOriginal) {
  const dropdown = obtenerOCrearDropdownAutocomplete();
  const input = document.getElementById('omniboxSearch');
  if (!dropdown || !input) return;

  sugerenciasActivas = lista;
  indiceSeleccionadoAutocomplete = -1;

  if (lista.length === 0) {
    dropdown.hidden = true;
    dropdown.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    return;
  }

  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  let html = `<div class="cmd-autocomplete-header"><span><i class="fa-solid fa-wand-magic-sparkles"></i> ${isEn ? 'Smart Suggestions' : 'Sugerencias Inteligentes'}</span></div>`;

  html += lista.map((sug, idx) => {
    const textoResaltado = resaltarCoincidenciaSegura(sug.texto, consultaOriginal);
    return `
      <div
        class="cmd-autocomplete-item"
        id="autocomplete-opt-${idx}"
        role="option"
        aria-selected="false"
        data-index="${idx}"
        data-filtro="${typeof escaparHtml === 'function' ? escaparHtml(sug.filtro) : sug.filtro}"
      >
        <span class="cmd-autocomplete-item-icon"><i class="fa-solid ${sug.icono || 'fa-magnifying-glass'}"></i></span>
        <span class="cmd-autocomplete-item-text">${textoResaltado}</span>
        <span class="cmd-autocomplete-item-badge">${escaparHtml(sug.categoria)}</span>
      </div>
    `;
  }).join('');

  dropdown.innerHTML = html;
  dropdown.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

/**
 * Cierra y limpia el menú de autocompletado.
 */
function cerrarMenuAutocomplete() {
  const dropdown = document.getElementById('omniboxAutocomplete');
  const input = document.getElementById('omniboxSearch');
  if (dropdown) {
    dropdown.hidden = true;
    dropdown.innerHTML = '';
  }
  if (input) {
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  indiceSeleccionadoAutocomplete = -1;
  sugerenciasActivas = [];
}

/**
 * Aplica la sugerencia seleccionada al campo de búsqueda e interactúa con el filtro.
 * @param {Object} sugerencia
 */
function seleccionarSugerencia(sugerencia) {
  if (!sugerencia) return;
  const input = document.getElementById('omniboxSearch');
  const btnClear = document.getElementById('cmdSearchClear');

  if (input) {
    input.value = sugerencia.filtro || sugerencia.texto;
    if (btnClear) btnClear.classList.add('visible');
    textoBusquedaActivo = input.value;
  }

  cerrarMenuAutocomplete();

  if (typeof aplicarFiltrosOmnibox === 'function') {
    aplicarFiltrosOmnibox();
  }
}

/**
 * Actualiza la selección activa por teclado (W3C ARIA Combobox pattern).
 * @param {number} nuevoIndice
 */
function actualizarSeleccionTeclado(nuevoIndice) {
  const dropdown = document.getElementById('omniboxAutocomplete');
  const input = document.getElementById('omniboxSearch');
  if (!dropdown || sugerenciasActivas.length === 0) return;

  const items = dropdown.querySelectorAll('.cmd-autocomplete-item');
  items.forEach(it => {
    it.classList.remove('active');
    it.setAttribute('aria-selected', 'false');
  });

  if (nuevoIndice >= 0 && nuevoIndice < items.length) {
    indiceSeleccionadoAutocomplete = nuevoIndice;
    const itemActivo = items[nuevoIndice];
    itemActivo.classList.add('active');
    itemActivo.setAttribute('aria-selected', 'true');
    itemActivo.scrollIntoView({ block: 'nearest' });

    if (input) {
      input.setAttribute('aria-activedescendant', itemActivo.id);
    }
  } else {
    indiceSeleccionadoAutocomplete = -1;
    if (input) input.removeAttribute('aria-activedescendant');
  }
}

/**
 * Vincula los eventos del Omnibox para autocompletado inteligente.
 */
function inicializarBúsquedaInteligente() {
  if (typeof document === 'undefined') return;

  const input = document.getElementById('omniboxSearch');
  if (!input) return;

  // Atributos W3C ARIA en el input
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'omniboxAutocomplete');

  // 1. Entrada de texto con debounce optimizado (160ms)
  input.addEventListener('input', (e) => {
    const val = e.target.value;
    if (temporizadorDebounce) clearTimeout(temporizadorDebounce);

    if (!val || val.trim().length === 0) {
      cerrarMenuAutocomplete();
      return;
    }

    temporizadorDebounce = setTimeout(() => {
      try {
        const sugerencias = calcularSugerencias(val);
        renderizarMenuAutocomplete(sugerencias, val);
      } catch (err) {
        if (typeof reportarFalloCliente === 'function') {
          reportarFalloCliente({
            tipo: 'AUTOCOMPLETE_SEARCH_ERROR',
            mensaje: err.message,
            origen: 'modules/15-autocomplete.js'
          });
        }
      }
    }, 160);
  });

  // 2. Navegación por teclado (ArrowDown, ArrowUp, Enter, Escape)
  input.addEventListener('keydown', (e) => {
    if (sugerenciasActivas.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const prox = (indiceSeleccionadoAutocomplete + 1) % sugerenciasActivas.length;
      actualizarSeleccionTeclado(prox);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = indiceSeleccionadoAutocomplete <= 0
        ? sugerenciasActivas.length - 1
        : indiceSeleccionadoAutocomplete - 1;
      actualizarSeleccionTeclado(prev);
    } else if (e.key === 'Enter') {
      if (indiceSeleccionadoAutocomplete >= 0 && sugerenciasActivas[indiceSeleccionadoAutocomplete]) {
        e.preventDefault();
        seleccionarSugerencia(sugerenciasActivas[indiceSeleccionadoAutocomplete]);
      } else {
        cerrarMenuAutocomplete();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cerrarMenuAutocomplete();
    }
  });

  // 3. Selección táctil o por clic del ratón
  const dropdown = obtenerOCrearDropdownAutocomplete();
  if (dropdown) {
    dropdown.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.cmd-autocomplete-item');
      if (!itemEl) return;
      const idx = Number.parseInt(itemEl.getAttribute('data-index') || '-1', 10);
      if (idx >= 0 && sugerenciasActivas[idx]) {
        seleccionarSugerencia(sugerenciasActivas[idx]);
      }
    });
  }

  // 4. Cierre al hacer clic fuera del Omnibox
  window.addEventListener('click', (e) => {
    if (!e.target.closest('.cmd-search-box')) {
      cerrarMenuAutocomplete();
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarBúsquedaInteligente);
  } else {
    inicializarBúsquedaInteligente();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUGERENCIAS_TACTICAS_BASE,
    resaltarCoincidenciaSegura,
    calcularSugerencias,
    cerrarMenuAutocomplete,
    seleccionarSugerencia
  };
}
