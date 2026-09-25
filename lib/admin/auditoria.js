/**
 * 📜 Registro de auditoría del panel de administración (Firestore `admin_auditoria`)
 * y marcas de uso único (Firestore `admin_usos_unicos`).
 *
 * Cada acción sensible (ingreso, código fallido, ocultar, editar, borrar, configuración)
 * deja un rastro con quién, qué y cuándo. Un fallo al registrar nunca bloquea la acción.
 */
const db = require('../db');

function firestore() {
  const ref = db.leadsRef;
  return ref && ref.firestore ? ref.firestore : null;
}

/**
 * Registra una entrada de auditoría.
 * @param {{accion: string, email?: string, detalle?: Object}} entrada
 */
async function registrarAuditoria(entrada) {
  try {
    const fs = firestore();
    if (!fs) return;
    await fs.collection('admin_auditoria').add({ ...entrada, ts: Date.now() });
  } catch (e) {
    console.error('[admin:auditoria] No se pudo registrar:', e.message);
  }
}

/**
 * Marca una clave como usada una sola vez (creación atómica en Firestore).
 * @param {string} clave Identificador (ej. paso TOTP o huella de código de respaldo).
 * @returns {Promise<boolean>} true si era la primera vez; false si ya se había usado.
 * @throws {Error} Si la base de datos no está disponible (el llamador debe rechazar el código).
 */
async function marcarUsoUnico(clave) {
  const fs = firestore();
  if (!fs) throw new Error('Base de datos no disponible');
  try {
    await fs.collection('admin_usos_unicos').doc(clave).create({ ts: Date.now() });
    return true;
  } catch (e) {
    // gRPC 6 = ALREADY_EXISTS
    if (e && (e.code === 6 || /already exists/i.test(e.message || ''))) return false;
    throw e;
  }
}

module.exports = { registrarAuditoria, marcarUsoUnico };
