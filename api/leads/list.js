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
let indiceMemoria = null;

/**
 * Carga y almacena en caché en memoria el archivo inmobiliario.json con detección de cambios en disco,
 * pre-indexación por ciudad, operación y ordenamiento para responder en tiempo ultrarrápido (< 50ms).
 * @returns {{ dataset: Object, indice: Object }}
 */
function obtenerDatasetEIndices() {
  const rutaCatalogo = path.join(__dirname, '..', '..', 'data', 'inmobiliario.json');
  if (!fs.existsSync(rutaCatalogo)) {
    throw new Error('Archivo de catálogo no encontrado');
  }

  const stat = fs.statSync(rutaCatalogo);
  if (!cacheDataset || stat.mtimeMs > mtimeCache) {
    const raw = fs.readFileSync(rutaCatalogo, 'utf8');
    cacheDataset = JSON.parse(raw);
    mtimeCache = stat.mtimeMs;

    // Deduplicación idempotente en una sola pasada al cargar
    const leadsRaw = Array.isArray(cacheDataset.leads) ? cacheDataset.leads : [];
    const vistosIds = new Set();
    const vistosFirmas = new Set();
    const leadsUnicos = leadsRaw.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const id = String(item.id || '').trim();
      if (id) {
        if (vistosIds.has(id)) return false;
        vistosIds.add(id);
      }
      const firma = `${normalizar(item.titulo || '')}_${normalizar(item.precio || '')}_${normalizar(item.ciudad || item.ubicacion || '')}_${normalizar(item.dato_1 || '')}`;
      if (firma.length > 5) {
        if (vistosFirmas.has(firma)) return false;
        vistosFirmas.add(firma);
      }
      return true;
    });

    // 1. Conteo y resumen de ciudades agregadas para el selector de la interfaz
    const resumenCiudades = {};
    leadsUnicos.forEach((item) => {
      let c = (item.ciudad || item.ubicacion || '').trim();
      if (!c) return;
      if (c.includes(',')) c = c.split(',').pop().trim();
      const cNorm = c.charAt(0).toUpperCase() + c.slice(1);
      resumenCiudades[cNorm] = (resumenCiudades[cNorm] || 0) + 1;
    });

    // 2. Pre-clasificación por criterios de ordenamiento para resolución O(1)
    const porRecientes = [...leadsUnicos].sort((a, b) => (b.timestamp_ms || b.timestamp || 0) - (a.timestamp_ms || a.timestamp || 0));
    const porPrecioMenor = [...leadsUnicos].sort((a, b) => extraerPrecioCop(a.precio) - extraerPrecioCop(b.precio));
    const porPrecioMayor = [...leadsUnicos].sort((a, b) => extraerPrecioCop(b.precio) - extraerPrecioCop(a.precio));
    const porM2Menor = [...leadsUnicos].sort((a, b) => {
      const mA = extraerMetrosCuadrados(a.superficie_m2 || a.dato_1);
      const mB = extraerMetrosCuadrados(b.superficie_m2 || b.dato_1);
      const rA = mA > 0 ? extraerPrecioCop(a.precio) / mA : Infinity;
      const rB = mB > 0 ? extraerPrecioCop(b.precio) / mB : Infinity;
      return rA - rB;
    });
    const porRebaja = [...leadsUnicos].sort((a, b) => {
      const rA = parseFloat(String(a.porcentaje_rebaja || a.rebaja || 0).replace(/[^\d.]/g, '')) || 0;
      const rB = parseFloat(String(b.porcentaje_rebaja || b.rebaja || 0).replace(/[^\d.]/g, '')) || 0;
      return rB - rA;
    });

    indiceMemoria = {
      leadsBase: leadsUnicos,
      resumenCiudades,
      preordenados: {
        recientes: porRecientes,
        precio_menor: porPrecioMenor,
        precio_mayor: porPrecioMayor,
        m2_menor: porM2Menor,
        rebaja_mayor: porRebaja
      }
    };
  }

  return { dataset: cacheDataset, indice: indiceMemoria };
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
    const { dataset, indice } = obtenerDatasetEIndices();

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

    // Selección de base pre-ordenada si no hay búsqueda compleja
    const fuenteBase = (indice.preordenados[ordenCriterio] || indice.preordenados.recientes);
    let leads = fuenteBase;

    // 1. Filtrado por Ciudad (tolerancia a acentos y subcadenas)
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

    // 3. Filtrado por Texto / Búsqueda Inteligente (Omnibox)
    if (busquedaFiltro) {
      const tokens = busquedaFiltro.split(/\s+/).filter((t) => t.length > 0);
      leads = leads.filter((item) => {
        const textoCompleto = normalizar(`${item.titulo || ''} ${item.ubicacion || ''} ${item.sector || ''} ${item.barrio || ''} ${item.descripcion || ''}`);
        return tokens.every((tok) => textoCompleto.includes(tok));
      });
    }

    // 4. Si se aplicaron filtros y no era un conjunto pre-ordenado trivial, garantizar ordenamiento
    if ((ciudadFiltro || operacionFiltro || busquedaFiltro) && ordenCriterio !== 'recientes') {
      if (ordenCriterio === 'm2_menor') {
        leads.sort((a, b) => {
          const mA = extraerMetrosCuadrados(a.superficie_m2 || a.dato_1);
          const mB = extraerMetrosCuadrados(b.superficie_m2 || b.dato_1);
          const rA = mA > 0 ? extraerPrecioCop(a.precio) / mA : Infinity;
          const rB = mB > 0 ? extraerPrecioCop(b.precio) / mB : Infinity;
          return rA - rB;
        });
      } else if (ordenCriterio === 'rebaja_mayor') {
        leads.sort((a, b) => {
          const rA = parseFloat(String(a.porcentaje_rebaja || a.rebaja || 0).replace(/[^\d.]/g, '')) || 0;
          const rB = parseFloat(String(b.porcentaje_rebaja || b.rebaja || 0).replace(/[^\d.]/g, '')) || 0;
          return rB - rA;
        });
      } else if (ordenCriterio === 'precio_menor') {
        leads.sort((a, b) => extraerPrecioCop(a.precio) - extraerPrecioCop(b.precio));
      } else if (ordenCriterio === 'precio_mayor') {
        leads.sort((a, b) => extraerPrecioCop(b.precio) - extraerPrecioCop(a.precio));
      }
    }

    // 5. Partición por Lotes (Paginación Serverless)
    const total = leads.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const lotePaginado = leads.slice(startIndex, endIndex);

    // Cabeceras de caché Edge para respuesta ultrarrápida (< 150ms) en Vercel CDN
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

    return res.status(200).json({
      ok: true,
      page,
      limit,
      total,
      totalPages,
      hayMas: page < totalPages,
      config: dataset.config || {},
      ciudades: indice.resumenCiudades,
      leads: lotePaginado
    });
  } catch (err) {
    console.error('[leads:list] Error obteniendo lote de catálogo:', err.message);
    return res.status(500).json({ ok: false, error: 'Error interno obteniendo catálogo paginado' });
  }
};
