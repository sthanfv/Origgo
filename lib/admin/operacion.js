/**
 * 🛠️ API del panel — operación: Cazador, Auditoría y Precios.
 *
 *   GET /api/admin/cazador    → estado del teléfono: último contacto (Upstash, cada ciclo),
 *                               última publicación y las 20 más recientes, inmuebles activos.
 *   GET /api/admin/auditoria  → últimas 100 acciones del panel (quién, qué, cuándo).
 *   GET /api/admin/precios    → precios vigentes y valores base.
 *   PUT /api/admin/precios    → guarda precios (validados), borra la caché pública y audita.
 *
 * Exige las 4 capas del panel (lib/admin/acceso.js).
 */
const { aplicarCorsSeguro } = require('../cors');
const db = require('../db');
const { exigirAdminCon2FA } = require('./acceso');
const { registrarAuditoria } = require('./auditoria');
const { esErrorDeCuota, leerMarca } = require('../cache');
const precios = require('../precios');
const { invalidarConfigPublica } = require('../configuracion-publica');

const MENSAJE_CUOTA =
  'Se agotó la cuota diaria gratuita de Firestore. Se restablece a las 2:00 a. m. (hora de Colombia).';

async function ultimos(nombre, campoOrden, limite) {
  const col = db.coleccion(nombre);
  const snap =
    typeof col.orderBy === 'function' ? await col.orderBy(campoOrden, 'desc').limit(limite).get() : await col.get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b[campoOrden] || 0) - (a[campoOrden] || 0))
    .slice(0, limite);
}

async function estadoCazador() {
  const ref = db.leadsRef;
  const [latido, estado, publicaciones, activos] = await Promise.all([
    leerMarca('cazador-latido'),
    db.coleccion('admin_estado').doc('cazador').get(),
    ultimos('admin_cazador_log', 'ms', 20),
    ref.firestore && typeof ref.where('activo', '==', true).count === 'function'
      ? ref.where('activo', '==', true).count().get().then((s) => s.data().count)
      : ref.get().then((s) => s.docs.filter((d) => d.data().activo !== false).length),
  ]);
  return {
    latido_ms: typeof latido === 'number' ? latido : null,
    ultima: estado.exists ? estado.data() : null,
    publicaciones,
    activos,
  };
}

async function handler(req, res) {
  aplicarCorsSeguro(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 'no-store');

  let admin;
  try {
    admin = await exigirAdminCon2FA(req, res);
  } catch (e) {
    return res.status(e.status || 401).json({ ok: false, error: e.message, codigo: e.codigo });
  }
  if (!db.leadsRef) return res.status(503).json({ ok: false, error: MENSAJE_CUOTA, codigo: 'CUOTA_AGOTADA' });

  const accion = (req.query && req.query.action) || '';
  try {
    if (accion === 'cazador' && req.method === 'GET') {
      return res.status(200).json({ ok: true, ...(await estadoCazador()) });
    }
    if (accion === 'auditoria' && req.method === 'GET') {
      return res.status(200).json({ ok: true, entradas: await ultimos('admin_auditoria', 'ts', 100) });
    }
    if (accion === 'precios' && req.method === 'GET') {
      return res.status(200).json({ ok: true, precios: await precios.obtenerPrecios(), base: precios.PRECIOS_BASE });
    }
    if (accion === 'precios' && req.method === 'PUT') {
      const antes = await precios.obtenerPrecios();
      const guardado = await precios.guardarPrecios(req.body || {}, admin.email);
      await invalidarConfigPublica();
      const detalle = {};
      for (const [id, nuevo] of Object.entries(guardado)) {
        detalle[id] = { antes: antes[id].montoCentavos, despues: nuevo.montoCentavos };
      }
      await registrarAuditoria({ accion: 'editar_precios', email: admin.email, detalle });
      return res.status(200).json({ ok: true, precios: await precios.obtenerPrecios() });
    }
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  } catch (err) {
    if (err && err.status === 400) return res.status(400).json({ ok: false, error: err.message });
    if (esErrorDeCuota(err) || (err && err.status === 503)) {
      return res.status(503).json({ ok: false, error: MENSAJE_CUOTA, codigo: 'CUOTA_AGOTADA' });
    }
    console.error('[admin:operacion] Error:', err.message);
    return res.status(500).json({ ok: false, error: 'Error interno del panel.' });
  }
}

module.exports = handler;
module.exports.estadoCazador = estadoCazador;
