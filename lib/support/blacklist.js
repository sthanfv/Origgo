/**
 * 📋 ENDPOINT DE CONSULTA DE LISTA NEGRA DE DESINDEXACIÓN
 * GET /api/support/blacklist -> lib/support/blacklist.js
 * 
 * Expone la lista de identificadores retirados para que el motor de extracción
 * y compilación en el celular Samsung Galaxy J7 excluya leads desindexados
 * antes de generar y sincronizar el catálogo con Cloudflare R2.
 * Estándar Ecosistema Desmulta.
 */

const db = require('../db');
const { checkRateLimitAsync } = require('../rate-limiter');
const { aplicarCorsSeguro } = require('../cors');
const { obtenerConCache, guardarMarca } = require('../cache');

// Último contacto del cazador (panel → Cazador). Se escribe como máximo una vez por minuto por
// instancia, en Upstash (no gasta cuota de Firestore). Es solo un indicador de estado.
let ultimoLatidoGuardado = 0;

/** Nombre de la caché de la lista negra (se invalida al registrar un retiro, ver takedown.js). */
const CACHE_LISTA_NEGRA = 'lista-negra';

/**
 * Lee la lista negra de Firestore. Si lib/db.js está en modo memoria (cuota agotada), lanza
 * error: una lista vacía en caché haría que el cazador republicara anuncios retirados.
 */
async function cargarListaNegra() {
  if (!db.leadsRef || !db.leadsRef.firestore) throw new Error('FIRESTORE_NO_DISPONIBLE');
  const ids = await db.getBlacklistedLeadIds();
  // Si la cuota se agotó DURANTE la lectura, lib/db.js pasa a memoria y devuelve esa lista:
  // no debe guardarse en caché como si fuera la real.
  if (!db.leadsRef || !db.leadsRef.firestore) throw new Error('FIRESTORE_NO_DISPONIBLE');
  return ids;
}

/**
 * Pruebas y desarrollo (sin credenciales): la base en memoria es la fuente legítima, sin caché.
 * Producción: caché de 30 min; si Firestore falla se usa la última copia buena (respaldo).
 */
async function obtenerIdsListaNegra() {
  const estado = db.estadoAlmacenamiento ? db.estadoAlmacenamiento() : { memoria: false };
  if (estado.memoria && estado.razon === 'sin_credenciales_firestore') {
    return db.getBlacklistedLeadIds();
  }
  // La copia solo cambia cuando alguien pide un retiro, y ese evento la borra (takedown.js):
  // el vencimiento es solo una red de seguridad. Con 30 min, releer ~970 documentos 48 veces al
  // día agotó la cuota gratuita el 2026-09-25 (~46.500 de 50.000 lecturas diarias).
  const { valor } = await obtenerConCache(CACHE_LISTA_NEGRA, 24 * 60 * 60, cargarListaNegra);
  return valor;
}

async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METODO_NO_PERMITIDO', message: 'Método no permitido. Utilice GET.' });
  }

  // 🛡️ Rate Limiting: máx 60 consultas por minuto por IP
  if (!(await checkRateLimitAsync(req, res, { prefix: 'support_blacklist', maxRequests: 60, windowMs: 60 * 1000 }))) {
    return;
  }

  try {
    // [2026-09-25] El cazador consulta cada 3 minutos; antes cada consulta leía la colección
    // completa en Firestore. Ahora se lee como máximo una vez al día (o al registrar un retiro).
    const ids = await obtenerIdsListaNegra();

    if (/HunterPro-Scraper-J7/i.test(String(req.headers['user-agent'] || '')) && Date.now() - ultimoLatidoGuardado > 60000) {
      ultimoLatidoGuardado = Date.now();
      guardarMarca('cazador-latido', Date.now()).catch(() => {});
    }

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      ok: true,
      count: ids.length,
      ids
    });
  } catch (err) {
    console.error('[support/blacklist] Error:', err.message);
    return res.status(500).json({
      ok: false,
      error: 'ERROR_SERVIDOR',
      message: 'No fue posible consultar la lista negra de desindexación.'
    });
  }
};

module.exports = handler;
module.exports.CACHE_LISTA_NEGRA = CACHE_LISTA_NEGRA;
module.exports.obtenerIdsListaNegra = obtenerIdsListaNegra;
