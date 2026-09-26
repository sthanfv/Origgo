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

module.exports = { obtenerConCache, CACHE_CATALOGO, cargarCatalogoFirestore, invalidarCatalogo };
