/**
 * 🍪 Sesión de segundo factor del panel de administración.
 *
 * Tras validar el código TOTP, el servidor entrega una cookie `HttpOnly; Secure; SameSite=Strict`
 * con un JWT ligado al uid de Google del administrador. El JavaScript de la página no puede
 * leerla (protege contra XSS) y no viaja a otros sitios (protege contra CSRF).
 *
 * Vencimiento (OWASP Session Management / NIST 800-63B), exigido por el SERVIDOR:
 *   - Inactividad: 15 minutos sin peticiones cierran la sesión (`act` = última actividad).
 *     Cada petición válida la renueva (como máximo una vez por minuto, para no reescribir
 *     la cookie en cada llamada).
 *   - Absoluto: 8 horas desde que se verificó el código (`ini`), aunque haya actividad.
 *   - Cookie de sesión (sin Max-Age): se borra al cerrar el navegador.
 *
 * La clave de firma se deriva de JWT_SECRET con una etiqueta propia (separación de dominio):
 * un token de sesión de usuario de la vitrina nunca sirve como sesión del panel, ni al revés.
 */
const crypto = require('crypto');
const { signJwt, verifyJwt } = require('../crypto');

const COOKIE = 'origgo_admin_2fa';
const AUDIENCIA = 'origgo-admin-2fa';
const DURACION_H = 8;

function secretoSesion() {
  const base = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET;
  if (!base) throw new Error('JWT_SECRET no configurado');
  return crypto.createHmac('sha256', base).update('origgo-admin-2fa-v1').digest('hex');
}

const INACTIVIDAD_MS = 15 * 60 * 1000;
const RENOVAR_CADA_MS = 60 * 1000;

/**
 * Crea el token de sesión de segundo factor.
 * @param {string} uid uid de Google (Firebase) del administrador.
 * @param {number} [duracionH] Horas de validez absoluta (inyectable en pruebas).
 * @param {{ ini?: number, ahora?: number }} [tiempos] Inicio de la sesión y "ahora" (pruebas y renovación).
 */
function crearSesion(uid, duracionH = DURACION_H, { ini, ahora = Date.now() } = {}) {
  const inicio = ini || ahora;
  const restanteDias = (inicio + duracionH * 3600 * 1000 - ahora) / 86400000;
  return signJwt({ sub: uid, aud: AUDIENCIA, ini: inicio, act: ahora, dur: duracionH }, secretoSesion(), restanteDias);
}

function leerCookie(req, nombre) {
  const cabecera = (req.headers && req.headers.cookie) || '';
  for (const parte of cabecera.split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) return decodeURIComponent(resto.join('='));
  }
  return '';
}

/**
 * Estado de la sesión de segundo factor para este uid.
 * @returns {{ valida: boolean, motivo?: 'ausente'|'inactiva', datos?: Object }}
 */
function estadoSesion(req, uid, ahora = Date.now()) {
  const datos = verifyJwt(leerCookie(req, COOKIE), secretoSesion());
  if (!datos || datos.aud !== AUDIENCIA || typeof datos.exp !== 'number' || datos.sub !== uid) {
    return { valida: false, motivo: 'ausente' };
  }
  // Tokens anteriores al control de inactividad (sin `act`): se pide el código otra vez.
  if (typeof datos.act !== 'number' || typeof datos.ini !== 'number') return { valida: false, motivo: 'ausente' };
  // Límite absoluto explícito (además del vencimiento del JWT): 8 h desde el código, o menos si
  // la sesión se abrió con un método más débil (código por correo: 2 h).
  const duracionH = typeof datos.dur === 'number' ? Math.min(datos.dur, DURACION_H) : DURACION_H;
  if (ahora - datos.ini > duracionH * 3600 * 1000) return { valida: false, motivo: 'ausente' };
  if (ahora - datos.act > INACTIVIDAD_MS) return { valida: false, motivo: 'inactiva' };
  return { valida: true, datos, restanteMs: INACTIVIDAD_MS - (ahora - datos.act) };
}

/** ¿La petición trae una sesión de segundo factor válida (y activa) para este uid? */
function sesionValida(req, uid) {
  return estadoSesion(req, uid).valida;
}

/**
 * Renueva la última actividad (ventana deslizante) si pasó más de un minuto.
 * Mantiene el inicio original: el límite absoluto de 8 h no se extiende.
 */
function renovarSesion(res, datos, ahora = Date.now()) {
  if (!res || typeof res.setHeader !== 'function' || ahora - datos.act < RENOVAR_CADA_MS) return;
  const duracionH = typeof datos.dur === 'number' ? Math.min(datos.dur, DURACION_H) : DURACION_H;
  res.setHeader('Set-Cookie', cabeceraCookie(crearSesion(datos.sub, duracionH, { ini: datos.ini, ahora })));
}

function cabeceraCookie(token) {
  // Sin Max-Age: cookie de sesión, se borra al cerrar el navegador (el JWT además vence solo).
  return `${COOKIE}=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict`;
}

function cabeceraBorrarCookie() {
  return `${COOKIE}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

module.exports = {
  COOKIE,
  INACTIVIDAD_MS,
  crearSesion,
  estadoSesion,
  sesionValida,
  renovarSesion,
  cabeceraCookie,
  cabeceraBorrarCookie,
};
