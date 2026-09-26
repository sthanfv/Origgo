/**
 * 🌐 Configuración pública que la web lee del panel: textos de la vitrina (`config/showcase`) y
 * precios (`config/precios`, lib/precios.js). Viaja dentro de la respuesta del catálogo
 * (api/leads/list.js), así la web no hace peticiones extra.
 *
 * Caché de 1 h compartida; el panel la borra al guardar la vitrina o los precios, así los
 * cambios se ven en minutos (lo que tarde la caché del CDN, máx. 2 min).
 */
const db = require('./db');
const { obtenerConCache, invalidarCache } = require('./cache');
const { obtenerPrecios, preciosPublicos, combinar, CACHE_PRECIOS } = require('./precios');

const CACHE_CONFIG_PUBLICA = 'config-publica';
const CAMPOS_VITRINA = ['counterLabel', 'counterValue', 'heroTitulo', 'heroSubtitulo'];

async function cargar() {
  const doc = await db.coleccion('config').doc('showcase').get();
  const datos = doc.exists ? doc.data() : {};
  const vitrina = {};
  for (const campo of CAMPOS_VITRINA) {
    if (typeof datos[campo] === 'string' && datos[campo].trim()) vitrina[campo] = datos[campo].trim().slice(0, 200);
  }
  return { vitrina, precios: preciosPublicos(await obtenerPrecios()) };
}

/** @returns {Promise<{ vitrina: Object, precios: Object }>} */
async function obtenerConfigPublica() {
  try {
    const { valor } = await obtenerConCache(CACHE_CONFIG_PUBLICA, 60 * 60, cargar);
    return valor;
  } catch (err) {
    console.warn('[config-publica] Se usan valores base:', err.message);
    return { vitrina: {}, precios: preciosPublicos(combinar(null)) };
  }
}

/** Borra las copias en caché tras un cambio en el panel. */
async function invalidarConfigPublica() {
  await Promise.all([invalidarCache(CACHE_CONFIG_PUBLICA), invalidarCache(CACHE_PRECIOS)]);
}

module.exports = { obtenerConfigPublica, invalidarConfigPublica, CAMPOS_VITRINA };
