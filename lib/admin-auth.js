/**
 * 🔐 Verificación de administrador del panel de Origgo.
 *
 * El acceso al panel es con Google (Firebase Authentication). El navegador envía el
 * ID token de Firebase en la cabecera `Authorization: Bearer <token>`. Aquí se verifica
 * ese token con el SDK de administrador y se comprueba que el correo esté en la lista
 * blanca `ADMIN_EMAILS` del .env (correos separados por coma). No hay contraseñas que
 * filtrar: solo las cuentas autorizadas pueden entrar.
 */
require('./db'); // Garantiza que firebase-admin esté inicializado (app por defecto).
const { getAuth } = require('firebase-admin/auth');

/** Lista blanca de correos con acceso al panel (desde ADMIN_EMAILS). */
function correosAdministradores() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Verifica al administrador a partir del ID token de Google.
 * @param {import('http').IncomingMessage & {headers: Object}} req
 * @returns {Promise<{uid: string, email: string}>} Datos del administrador.
 * @throws {Error & {status: number}} 401 sin token/ inválido, 403 sin permiso, 503 sin config.
 */
async function verificarAdmin(req) {
  const cabecera = req.headers.authorization || req.headers.Authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : '';
  if (!token) {
    const e = new Error('Falta el token de sesión.');
    e.status = 401;
    throw e;
  }

  const permitidos = correosAdministradores();
  if (permitidos.length === 0) {
    const e = new Error('El panel no tiene administradores configurados (ADMIN_EMAILS).');
    e.status = 503;
    throw e;
  }

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch {
    const e = new Error('Sesión inválida o expirada.');
    e.status = 401;
    throw e;
  }

  const email = (decoded.email || '').toLowerCase();
  if (!decoded.email_verified || !permitidos.includes(email)) {
    const e = new Error('Tu cuenta no tiene acceso al panel.');
    e.status = 403;
    throw e;
  }

  return { uid: decoded.uid, email };
}

module.exports = { verificarAdmin, correosAdministradores };
