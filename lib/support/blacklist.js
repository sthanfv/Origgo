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

module.exports = async function handler(req, res) {
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
    const ids = await db.getBlacklistedLeadIds();

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
