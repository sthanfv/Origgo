/**
 * 🏘️ Catálogo público: lectura desde Firestore + caché compartida.
 *
 * Firestore es la fuente de la verdad; la vitrina lee una copia en caché (lib/cache.js)
 * que se renueva cada 15 minutos o cuando el panel cambia algo (invalidarCatalogo).
 */
const { obtenerConCache, invalidarCache } = require('./cache');

const CACHE_CATALOGO = 'catalogo-publico';

/**
 * Lee de Firestore los inmuebles activos, sin datos de contacto.
 * Lanza error si Firestore no está disponible (incluido el modo en memoria de lib/db.js
 * cuando se agota la cuota), para que la caché sirva su copia de respaldo en lugar de
 * guardar un catálogo vacío.
 * @returns {Promise<Object[]>}
 */
async function cargarCatalogoFirestore() {
  const db = require('./db');
  const ref = db.leadsRef;
  if (!ref || !ref.firestore) throw new Error('FIRESTORE_NO_DISPONIBLE');
  const snapshot = await ref.where('activo', '==', true).orderBy('timestamp_ms', 'desc').limit(300).get();
  const leads = [];
  snapshot.forEach((doc) => {
    // El contacto cifrado nunca sale en el listado público (igual que antes de la caché).
    const { contacto_cifrado: _c, ...publico } = doc.data();
    void _c;
    leads.push({ ...publico, id: doc.id });
  });
  return leads;
}

/** Hace que la próxima visita traiga el catálogo fresco (tras cambios en el panel). */
function invalidarCatalogo() {
  return invalidarCache(CACHE_CATALOGO);
}

/**
 * Desactiva inmuebles que salieron del catálogo (vendidos, retirados por su dueño o
 * desplazados por el límite). Lo pide el cazador por el canal de ingesta.
 * @param {string[]} ids
 * @returns {Promise<number>} Cantidad desactivada.
 */
async function desactivarLeads(ids) {
  const db = require('./db');
  const ref = db.leadsRef;
  if (!ref || !Array.isArray(ids) || ids.length === 0) return 0;
  const ahora = new Date().toISOString();
  if (ref.firestore && typeof ref.firestore.batch === 'function') {
    const batch = ref.firestore.batch();
    for (const id of ids) batch.set(ref.doc(String(id)), { activo: false, updatedAt: ahora }, { merge: true });
    await batch.commit();
  } else {
    for (const id of ids) await ref.doc(String(id)).set({ activo: false, updatedAt: ahora }, { merge: true });
  }
  return ids.length;
}

/**
 * Alinea Firestore con el catálogo real del cazador (solo en su primera publicación por cambios):
 * desactiva cualquier inmueble activo que no esté en `idsVigentes`. Lee los activos una vez.
 * @param {string[]} idsVigentes
 * @returns {Promise<number>} Cantidad desactivada.
 */
async function reconciliarActivos(idsVigentes) {
  const db = require('./db');
  const ref = db.leadsRef;
  if (!ref || !ref.firestore || !Array.isArray(idsVigentes)) return 0;
  const vigentes = new Set(idsVigentes.map(String));
  const snap = await ref.where('activo', '==', true).select('activo').get();
  const sobrantes = [];
  snap.forEach((doc) => {
    if (!vigentes.has(doc.id)) sobrantes.push(doc.id);
  });
  for (let i = 0; i < sobrantes.length; i += 400) await desactivarLeads(sobrantes.slice(i, i + 400));
  return sobrantes.length;
}

module.exports = {
  obtenerConCache,
  CACHE_CATALOGO,
  cargarCatalogoFirestore,
  invalidarCatalogo,
  desactivarLeads,
  reconciliarActivos,
};
