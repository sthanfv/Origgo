/**
 * 📊 API del panel — pantalla de Resumen (GET /api/admin/resumen).
 *
 * Devuelve lo que un administrador necesita ver al entrar (patrón de paneles profesionales:
 * cifras + alertas accionables), con consultas baratas para la cuota gratuita:
 *   - Conteos REALES del catálogo con agregaciones `count()` (1 lectura por cada 1.000
 *     documentos), en vez de contar los 500 inmuebles que carga la tabla.
 *   - Solicitudes de retiro pendientes y las que vencen en ≤ 3 días.
 *   - Última publicación del cazador (documento `admin_estado/cazador`, lo escribe la ingesta).
 *   - Si el índice de búsqueda ya se reconstruyó (`admin_estado/indice`).
 *   - Pagos marcados como sospecha de fraude (monto menor al del producto).
 * Exige las 4 capas del panel (lib/admin/acceso.js).
 */
const { aplicarCorsSeguro } = require('../cors');
const db = require('../db');
const { exigirAdminCon2FA } = require('./acceso');
const { esErrorDeCuota } = require('../cache');
const retiros = require('../retiros');

const MENSAJE_CUOTA =
  'Se agotó la cuota diaria gratuita de Firestore. Se restablece a las 2:00 a. m. (hora de Colombia).';
const DIA_MS = 24 * 60 * 60 * 1000;
const CAZADOR_SIN_PUBLICAR_MS = 6 * 60 * 60 * 1000;

/** Conteo con agregación en Firestore; en la base de pruebas (memoria), contando en memoria. */
async function contar(consulta, filtro) {
  if (typeof consulta.count === 'function') {
    const snap = await consulta.count().get();
    return snap.data().count;
  }
  const snap = await consulta.get();
  return snap.docs.filter((d) => !filtro || filtro(d.data())).length;
}

async function leerEstado(nombre) {
  const doc = await db.coleccion('admin_estado').doc(nombre).get();
  return doc.exists ? doc.data() : null;
}

/** Calcula el resumen del panel. Exportado para pruebas. */
async function calcularResumen(ahora = Date.now()) {
  const ref = db.leadsRef;
  const esFirestore = Boolean(ref.firestore);
  const ordenes = db.ordersRef;
  const [total, visibles, destacados, cazador, indice, solicitudes, sospechas] = await Promise.all([
    contar(ref),
    esFirestore ? contar(ref.where('activo', '==', true)) : contar(ref, (d) => d.activo !== false),
    esFirestore ? contar(ref.where('destacado', '==', true)) : contar(ref, (d) => d.destacado === true),
    leerEstado('cazador'),
    leerEstado('indice'),
    retiros.listarSolicitudes(50),
    ordenes
      ? esFirestore
        ? contar(ordenes.where('status', '==', 'FRAUD_SUSPECT'))
        : contar(ordenes, (o) => o.status === 'FRAUD_SUSPECT')
      : 0,
  ]);

  const pendientes = solicitudes.filter((s) => s.estado === 'recibida');
  const porVencer = pendientes.filter((s) => s.vence_ms - ahora <= 3 * DIA_MS);

  const alertas = [];
  if (sospechas) {
    alertas.push({
      nivel: 'critica',
      seccion: 'pagos',
      texto: `${sospechas} pago${sospechas === 1 ? '' : 's'} con monto sospechoso (posible fraude) por revisar.`,
    });
  }
  const vencidas = pendientes.filter((s) => s.vence_ms < ahora);
  if (vencidas.length) {
    alertas.push({
      nivel: 'critica',
      seccion: 'retiros',
      texto: `${vencidas.length} solicitud${vencidas.length === 1 ? '' : 'es'} de retiro pasaron el plazo legal de 15 días hábiles.`,
    });
  } else if (porVencer.length) {
    alertas.push({
      nivel: 'aviso',
      seccion: 'retiros',
      texto: `${porVencer.length} solicitud${porVencer.length === 1 ? '' : 'es'} de retiro vence${porVencer.length === 1 ? '' : 'n'} en 3 días o menos.`,
    });
  } else if (pendientes.length) {
    alertas.push({
      nivel: 'info',
      seccion: 'retiros',
      texto: `${pendientes.length} solicitud${pendientes.length === 1 ? '' : 'es'} de retiro por revisar.`,
    });
  }
  if (!cazador || ahora - cazador.ultima_ms > CAZADOR_SIN_PUBLICAR_MS) {
    alertas.push({
      nivel: 'aviso',
      seccion: 'resumen',
      texto: cazador
        ? `El cazador no publica cambios hace ${Math.floor((ahora - cazador.ultima_ms) / 3600000)} h. Revisa el teléfono.`
        : 'Aún no hay registro de publicaciones del cazador.',
    });
  }
  if (!indice) {
    alertas.push({
      nivel: 'aviso',
      seccion: 'retiros',
      texto: 'Falta reconstruir el índice de búsqueda (Retiros → "Reindexar búsqueda"), una sola vez.',
    });
  }

  return {
    catalogo: { total, visibles, ocultos: Math.max(0, total - visibles), destacados },
    retiros: { pendientes: pendientes.length, porVencer: porVencer.length },
    cazador: cazador ? { ultima_ms: cazador.ultima_ms, procesados: cazador.procesados || 0 } : null,
    alertas,
  };
}

async function handler(req, res) {
  aplicarCorsSeguro(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 'no-store');

  try {
    await exigirAdminCon2FA(req, res);
  } catch (e) {
    return res.status(e.status || 401).json({ ok: false, error: e.message, codigo: e.codigo });
  }
  if (!db.leadsRef) return res.status(503).json({ ok: false, error: MENSAJE_CUOTA, codigo: 'CUOTA_AGOTADA' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método no permitido.' });

  try {
    return res.status(200).json({ ok: true, ...(await calcularResumen()) });
  } catch (err) {
    if (esErrorDeCuota(err) || (err && err.status === 503)) {
      return res.status(503).json({ ok: false, error: MENSAJE_CUOTA, codigo: 'CUOTA_AGOTADA' });
    }
    console.error('[admin:resumen] Error:', err.message);
    return res.status(500).json({ ok: false, error: 'Error interno del panel.' });
  }
}

module.exports = handler;
module.exports.calcularResumen = calcularResumen;
