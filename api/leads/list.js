/**
 * 📦 ENDPOINT DE PAGINACIÓN Y CARGA PROGRESIVA POR LOTES DEL CATÁLOGO
 * GET /api/leads/list
 * 
 * Entrega el catálogo de oportunidades inmobiliarias en lotes optimizados (15-20 items)
 * para máxima eficiencia de datos en dispositivos móviles y conexiones de baja velocidad.
 * Incluye filtrado serverless, ordenamiento y cabeceras de caché CDN para Vercel Edge.
 */

const fs = require('fs');
const path = require('path');
const { aplicarCorsSeguro } = require('../../lib/cors');
const { checkRateLimitAsync } = require('../../lib/rate-limiter');

let cacheDataset = null;
let mtimeCache = 0;

/**
 * Carga y almacena en caché en memoria el archivo inmobiliario.json con detección de cambios en disco.
 * @returns {Object}
 */
function obtenerDatasetCatalogo() {
  const rutaCatalogo = path.join(__dirname, '..', '..', 'data', 'inmobiliario.json');
  if (!fs.existsSync(rutaCatalogo)) {
    throw new Error('Archivo de catálogo no encontrado');
  }

  const stat = fs.statSync(rutaCatalogo);
  if (!cacheDataset || stat.mtimeMs > mtimeCache) {
    const raw = fs.readFileSync(rutaCatalogo, 'utf8');
    cacheDataset = JSON.parse(raw);
    mtimeCache = stat.mtimeMs;
  }
  return cacheDataset;
}

/**
 * Normaliza texto para comparaciones tolerantes a acentos y mayúsculas.
 * @param {string} str
 * @returns {string}
 */
function normalizar(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Extrae el valor numérico en m² desde el campo de superficie.
 * @param {string} sup
 * @returns {number}
 */
function extraerMetrosCuadrados(sup) {
  if (!sup) return 0;
  const match = String(sup).match(/(\d+([\.,]\d+)?)/);
  if (!match) return 0;
  return parseFloat(match[1].replace(',', '.')) || 0;
}

/**
 * Extrae el valor numérico del precio en COP.
 * @param {string} precio
 * @returns {number}
 */
function extraerPrecioCop(precio) {
  if (!precio) return 0;
  const limpio = String(precio).replace(/[^\d]/g, '');
  return parseInt(limpio, 10) || 0;
}

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Método no permitido. Utilice GET.' });
  }

  // Rate Limiter: 60 consultas por minuto por IP para prevenir scraping masivo
  if (!(await checkRateLimitAsync(req, res, { prefix: 'leads_list', maxRequests: 60, windowMs: 60 * 1000 }))) {
    return;
  }

  try {
    let leadsRaw = [];
    let origenDatos = 'local_file';

    // 1. Intentar consultar leads en vivo desde Google Cloud Firestore
    try {
      const db = require('../../lib/db');
      const ref = db.leadsRef;
      if (ref) {
        const snapshot = await ref
          .where('activo', '==', true)
          .orderBy('timestamp_ms', 'desc')
          .limit(300)
          .get();

        if (!snapshot.empty) {
          snapshot.forEach((doc) => {
            const data = doc.data();
            // Omitir contacto cifrado en listado público por seguridad
            const { contacto_cifrado: _omitido, ...leadPublico } = data;
            leadsRaw.push({ ...leadPublico, id: doc.id });
          });
          if (leadsRaw.length > 0) {
            origenDatos = 'firestore';
          }
        }
      }
    } catch (errFs) {
      console.warn('[leads:list] Firestore no disponible, usando dataset local:', errFs.message);
    }

    // 2. Si Firestore no devolvió datos, recurrir al archivo local sincronizado
    let datasetConfig = {};
    if (leadsRaw.length === 0) {
      try {
        const dataset = obtenerDatasetCatalogo();
        leadsRaw = Array.isArray(dataset.leads) ? [...dataset.leads] : [];
        datasetConfig = dataset.config || {};
      } catch (errDisk) {
        console.warn('[leads:list] Error leyendo dataset local:', errDisk.message);
      }
    }

    // Deduplicación idempotente preventiva de leads
    const vistosIds = new Set();
    const vistosFirmas = new Set();
    let leads = leadsRaw.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const id = String(item.id || '').trim();
      if (id) {
        if (vistosIds.has(id)) return false;
        vistosIds.add(id);
      }
      const firma = `${normalizar(item.titulo || '')}_${normalizar(item.precio || '')}_${normalizar(item.ciudad || item.ubicacion || '')}`;
      if (firma.length > 5) {
        if (vistosFirmas.has(firma)) return false;
        vistosFirmas.add(firma);
      }
      return true;
    });

    // Extracción segura de parámetros de búsqueda y paginación
    let urlObj = null;
    try {
      urlObj = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
    } catch (_) {
      urlObj = { searchParams: new Map() };
    }

    const query = req.query || {};
    const page = Math.max(1, parseInt(query.page || urlObj.searchParams.get?.('page') || '1', 10) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(query.limit || urlObj.searchParams.get?.('limit') || '15', 10) || 15));
    const ciudadFiltro = normalizar(query.city || urlObj.searchParams.get?.('city') || '');
    const operacionFiltro = normalizar(query.operation || urlObj.searchParams.get?.('operation') || '');
    const busquedaFiltro = normalizar(query.search || urlObj.searchParams.get?.('search') || '');
    const ordenCriterio = String(query.sort || urlObj.searchParams.get?.('sort') || 'recientes').toLowerCase();

    // 1. Filtrado por Ciudad
    if (ciudadFiltro) {
      leads = leads.filter((item) => {
        const c = normalizar(item.ciudad || item.ubicacion || '');
        return c.includes(ciudadFiltro) || ciudadFiltro.includes(c);
      });
    }

    // 2. Filtrado por Operación (Venta / Arriendo)
    if (operacionFiltro) {
      leads = leads.filter((item) => {
        const op = normalizar(item.tipo_operacion || '');
        const tit = normalizar(item.titulo || '');
        if (operacionFiltro === 'venta') {
          return op === 'venta' || (!op.includes('arriend') && !tit.includes('arriendo') && !tit.includes('alquiler'));
        }
        if (operacionFiltro === 'arriendo' || operacionFiltro === 'alquiler') {
          return op.includes('arriend') || op.includes('alquiler') || tit.includes('arriendo') || tit.includes('alquiler');
        }
        return true;
      });
    }

    // 3. Filtrado por Texto / Búsqueda Inteligente
    if (busquedaFiltro) {
      const tokens = busquedaFiltro.split(/\s+/).filter((t) => t.length > 0);
      leads = leads.filter((item) => {
        const textoCompleto = normalizar(`${item.titulo || ''} ${item.ubicacion || ''} ${item.sector || ''} ${item.descripcion || ''}`);
        return tokens.every((tok) => textoCompleto.includes(tok));
      });
    }

    // 4. Ordenamiento
    if (ordenCriterio === 'm2_menor') {
      leads.sort((a, b) => {
        const m2A = extraerMetrosCuadrados(a.superficie_m2);
        const m2B = extraerMetrosCuadrados(b.superficie_m2);
        const pA = extraerPrecioCop(a.precio);
        const pB = extraerPrecioCop(b.precio);
        const ratioA = m2A > 0 ? pA / m2A : Infinity;
        const ratioB = m2B > 0 ? pB / m2B : Infinity;
        return ratioA - ratioB;
      });
    } else if (ordenCriterio === 'rebaja_mayor') {
      leads.sort((a, b) => {
        const rebajaA = parseFloat(String(a.porcentaje_rebaja || 0).replace(/[^\d.]/g, '')) || 0;
        const rebajaB = parseFloat(String(b.porcentaje_rebaja || 0).replace(/[^\d.]/g, '')) || 0;
        return rebajaB - rebajaA;
      });
    } else if (ordenCriterio === 'precio_menor') {
      leads.sort((a, b) => extraerPrecioCop(a.precio) - extraerPrecioCop(b.precio));
    } else if (ordenCriterio === 'precio_mayor') {
      leads.sort((a, b) => extraerPrecioCop(b.precio) - extraerPrecioCop(a.precio));
    } else {
      // Por defecto: Más recientes (cronológico inverso por timestamp o índice)
      leads.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    // 5. Paginación y Partición por Lotes (Batching)
    const total = leads.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const lotePaginado = leads.slice(startIndex, endIndex);

    // Cabeceras de caché Edge para respuesta instantánea en Vercel CDN
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

    return res.status(200).json({
      ok: true,
      page,
      limit,
      total,
      totalPages,
      hayMas: page < totalPages,
      config: datasetConfig || {},
      fuente: origenDatos,
      leads: lotePaginado
    });
  } catch (err) {
    console.error('[leads:list] Error obteniendo lote de catálogo:', err.message);
    return res.status(500).json({ ok: false, error: 'Error interno obteniendo catálogo paginado' });
  }
};
