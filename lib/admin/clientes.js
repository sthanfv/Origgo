/**
 * 👥 API del panel — Clientes (compradores de créditos y planes).
 *
 *   GET  /api/admin/clientes?q=…   → últimos 50 clientes, o búsqueda por celular o correo.
 *   GET  /api/admin/cliente?tel=…  → detalle del cliente + sus órdenes.
 *   POST /api/admin/cliente        → ajuste de soporte, con motivo obligatorio:
 *        { tel, accion: 'creditos', delta, motivo }            suma o resta créditos
 *        { tel, accion: 'plan', plan, ciudad?, dias?, motivo }  cambia o extiende el plan
 *
 * Nunca se entrega el PIN ni datos internos. Todo ajuste queda en la auditoría con quién,
 * cuánto y por qué (estándar: todo cambio de saldo tiene rastro). Exige las 4 capas del panel.
 */
const { aplicarCorsSeguro } = require('../cors');
const db = require('../db');
const { exigirAdminCon2FA } = require('./acceso');
const { registrarAuditoria } = require('./auditoria');
const { esErrorDeCuota } = require('../cache');

const MENSAJE_CUOTA =
  'Se agotó la cuota diaria gratuita de Firestore. Se restablece a las 2:00 a. m. (hora de Colombia).';
const PLANES = new Set(['free', 'city', 'national']);

/** Datos del cliente que ve el panel (sin PIN ni campos internos). */
function vistaCliente(id, c) {
  return {
    telefono: c.phone || id,
    email: c.email || null,
    creditos: Number(c.credits || 0),
    plan: c.plan || 'free',
    planCiudad: c.planCity || null,
    planVence: c.planExpiresAt || null,
    desbloqueados: Array.isArray(c.unlockedLeads) ? c.unlockedLeads.length : 0,
    creado: c.createdAt || null,
    actualizado: c.updatedAt || null,
  };
}

function vistaOrden(o) {
  return {
    referencia: o.reference,
    producto: o.productName || o.productType || o.tipo || '',
    montoCentavos: Number(o.amountInCents || 0),
    estado: o.status || 'PENDING',
    creada: o.createdAt || null,
    email: o.email || null,
  };
}

async function buscarClientes(q) {
  const ref = db.usersRef;
  const texto = String(q || '').trim().toLowerCase();
  if (texto.includes('@')) {
    const snap = await ref.where('email', '==', texto).limit(20).get();
    return snap.docs.map((d) => vistaCliente(d.id, d.data()));
  }
  const tel = db.cleanPhone(texto);
  if (tel) {
    const doc = await ref.doc(tel).get();
    return doc.exists ? [vistaCliente(tel, doc.data())] : [];
  }
  const snap =
    typeof ref.orderBy === 'function' ? await ref.orderBy('createdAt', 'desc').limit(50).get() : await ref.get();
  return snap.docs
    .map((d) => vistaCliente(d.id, d.data()))
    .sort((a, b) => String(b.creado || '').localeCompare(String(a.creado || '')))
    .slice(0, 50);
}

async function detalleCliente(tel) {
  const telefono = db.cleanPhone(tel);
  const doc = telefono ? await db.usersRef.doc(telefono).get() : null;
  if (!doc || !doc.exists) return null;
  const snap = await db.ordersRef.where('celular', '==', telefono).limit(30).get();
  const ordenes = snap.docs
    .map((d) => d.data())
    .filter((o) => o.reference)
    .map(vistaOrden)
    .sort((a, b) => String(b.creada || '').localeCompare(String(a.creada || '')));
  return { cliente: vistaCliente(telefono, doc.data()), ordenes };
}

async function handler(req, res) {
  aplicarCorsSeguro(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 'no-store');

  let admin;
  try {
    admin = await exigirAdminCon2FA(req, res, { reciente: req.method === 'POST' });
  } catch (e) {
    return res.status(e.status || 401).json({ ok: false, error: e.message, codigo: e.codigo });
  }
  if (!db.usersRef) return res.status(503).json({ ok: false, error: MENSAJE_CUOTA, codigo: 'CUOTA_AGOTADA' });

  const accion = (req.query && req.query.action) || 'clientes';
  try {
    if (accion === 'clientes' && req.method === 'GET') {
      return res.status(200).json({ ok: true, clientes: await buscarClientes(req.query.q) });
    }
    if (accion === 'cliente' && req.method === 'GET') {
      const detalle = await detalleCliente(req.query.tel);
      if (!detalle) return res.status(404).json({ ok: false, error: 'Cliente no encontrado.' });
      return res.status(200).json({ ok: true, ...detalle });
    }
    if (accion === 'cliente' && req.method === 'POST') {
      const b = req.body || {};
      const motivo = String(b.motivo || '').replace(/[<>]/g, '').trim().slice(0, 300);
      if (motivo.length < 3) return res.status(400).json({ ok: false, error: 'Escribe el motivo del ajuste.' });

      let cambios;
      if (b.accion === 'creditos') {
        const delta = Math.trunc(Number(b.delta));
        if (!delta || Math.abs(delta) > 1000) {
          return res.status(400).json({ ok: false, error: 'El ajuste debe ser un número entre -1000 y 1000, distinto de 0.' });
        }
        cambios = { delta };
      } else if (b.accion === 'plan') {
        if (!PLANES.has(b.plan)) return res.status(400).json({ ok: false, error: 'Plan no válido.' });
        const dias = Math.trunc(Number(b.dias) || 30);
        if (dias < 1 || dias > 366) return res.status(400).json({ ok: false, error: 'Los días deben estar entre 1 y 366.' });
        cambios = { plan: b.plan, ciudad: b.ciudad ? String(b.ciudad).slice(0, 60) : null, dias };
      } else {
        return res.status(400).json({ ok: false, error: 'Acción no válida (creditos o plan).' });
      }

      const cuenta = await db.ajustarCuentaAdmin(b.tel, cambios);
      await registrarAuditoria({
        accion: b.accion === 'creditos' ? 'ajuste_creditos' : 'cambio_plan',
        email: admin.email,
        detalle: { telefono: db.cleanPhone(b.tel), ...cambios, motivo, creditosFinales: cuenta.credits },
      });
      return res.status(200).json({ ok: true, cliente: vistaCliente(db.cleanPhone(b.tel), cuenta) });
    }
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  } catch (err) {
    if (err && err.status === 404) return res.status(404).json({ ok: false, error: err.message });
    if (esErrorDeCuota(err) || (err && err.status === 503)) {
      return res.status(503).json({ ok: false, error: MENSAJE_CUOTA, codigo: 'CUOTA_AGOTADA' });
    }
    console.error('[admin:clientes] Error:', err.message);
    return res.status(500).json({ ok: false, error: 'Error interno del panel.' });
  }
}

module.exports = handler;
module.exports.buscarClientes = buscarClientes;
module.exports.detalleCliente = detalleCliente;
