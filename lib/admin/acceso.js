/**
 * 🛡️ Control de acceso completo al panel: identidad + rol + segundo factor.
 *
 * Una acción del panel solo se permite si se cumplen TODAS las capas:
 *   1. Token de Google válido (firma, proyecto, vencimiento).
 *   2. Correo verificado y en la lista blanca ADMIN_EMAILS.
 *   3. Custom claim `admin: true` en la cuenta de Firebase.
 *   4. Sesión de segundo factor (TOTP) vigente y ligada a ese mismo uid.
 */
const { verificarAdmin } = require('../admin-auth');
const { sesionValida } = require('./sesion');

/**
 * @param {import('http').IncomingMessage & {headers: Object}} req
 * @returns {Promise<{uid: string, email: string}>}
 * @throws {Error & {status: number, codigo?: string}}
 */
async function exigirAdminCon2FA(req) {
  const admin = await verificarAdmin(req);
  if (!sesionValida(req, admin.uid)) {
    const e = new Error('Falta verificar el segundo factor.');
    e.status = 401;
    e.codigo = '2FA_REQUERIDO';
    throw e;
  }
  return admin;
}

module.exports = { exigirAdminCon2FA };
