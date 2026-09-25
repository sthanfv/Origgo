/**
 * 🍪 Sesión de segundo factor del panel de administración.
 *
 * Tras validar el código TOTP, el servidor entrega una cookie `HttpOnly; Secure; SameSite=Strict`
 * con un JWT de 8 horas ligado al uid de Google del administrador. El JavaScript de la página
 * no puede leerla (protege contra XSS) y no viaja a otros sitios (protege contra CSRF).
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

/**
 * Crea el token de sesión de segundo factor.
 * @param {string} uid uid de Google (Firebase) del administrador.
 * @param {number} [duracionH] Horas de validez (inyectable en pruebas).
 */
function crearSesion(uid, duracionH = DURACION_H) {
  return signJwt({ sub: uid, aud: AUDIENCIA }, secretoSesion(), duracionH / 24);
}

function leerCookie(req, nombre) {
  const cabecera = (req.headers && req.headers.cookie) || '';
  for (const parte of cabecera.split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) return decodeURIComponent(resto.join('='));
  }
  return '';
}

/** ¿La petición trae una sesión de segundo factor válida para este uid? */
function sesionValida(req, uid) {
  const datos = verifyJwt(leerCookie(req, COOKIE), secretoSesion());
  return Boolean(
    datos && datos.aud === AUDIENCIA && typeof datos.exp === 'number' && datos.sub === uid
  );
}

function cabeceraCookie(token) {
  return `${COOKIE}=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURACION_H * 3600}`;
}

function cabeceraBorrarCookie() {
  return `${COOKIE}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

module.exports = {
  COOKIE,
  crearSesion,
  sesionValida,
  cabeceraCookie,
  cabeceraBorrarCookie,
};
