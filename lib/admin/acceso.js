/**
 * 🛡️ Control de acceso completo al panel: identidad + rol + segundo factor.
 *
 * Una acción del panel solo se permite si se cumplen TODAS las capas:
 *   1. Token de Google válido (firma, proyecto, vencimiento).
 *   2. Correo verificado y en la lista blanca ADMIN_EMAILS.
 *   3. Custom claim `admin: true` en la cuenta de Firebase.
 *   4. Sesión de segundo factor (TOTP) vigente, activa (menos de 15 min sin uso) y ligada a
 *      ese mismo uid. Cada acción válida renueva la ventana de inactividad (lib/admin/sesion.js).
 */
const { verificarAdmin } = require('../admin-auth');
const { estadoSesion, renovarSesion } = require('./sesion');

/**
 * @param {import('http').IncomingMessage & {headers: Object}} req
 * @param {import('http').ServerResponse} [res] Si se pasa, renueva la sesión por actividad.
 * @returns {Promise<{uid: string, email: string}>}
 * @throws {Error & {status: number, codigo?: string}}
 */
async function exigirAdminCon2FA(req, res) {
  const admin = await verificarAdmin(req);
  const estado = estadoSesion(req, admin.uid);
  if (!estado.valida) {
    const inactiva = estado.motivo === 'inactiva';
    const e = new Error(inactiva ? 'La sesión se cerró por inactividad.' : 'Falta verificar el segundo factor.');
    e.status = 401;
    e.codigo = inactiva ? 'SESION_INACTIVA' : '2FA_REQUERIDO';
    throw e;
  }
  renovarSesion(res, estado.datos);
  return admin;
}

module.exports = { exigirAdminCon2FA };
