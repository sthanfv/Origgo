/**
 * 💳 API del panel — Pagos (órdenes de Wompi).
 *
 *   GET  /api/admin/pagos?estado=…&q=…  → últimas 100 órdenes (o una referencia) + totales:
 *        ventas aprobadas de los últimos 30 días, pendientes y sospechas de fraude.
 *   GET  /api/admin/pago?ref=…          → orden + ¿se entregó? (registro `pago_<ref>`).
 *   POST /api/admin/pago { ref }        → "Conciliar con Wompi": consulta la transacción real
 *        en Wompi y, si está APROBADA y el monto cuadra, acredita UNA sola vez
 *        (db.acreditarPagoUnaVez, misma llave que el webhook, el reclamo y el cron).
 *
 * Exige las 4 capas del panel y deja rastro en la auditoría.
 */
const { aplicarCorsSeguro } = require('../cors');
const db = require('../db');
const { exigirAdminCon2FA } = require('./acceso');
const { registrarAuditoria } = require('./auditoria');
const { esErrorDeCuota } = require('../cache');
const { requireEnv } = require('../env');
const { resolverBeneficioOrden } = require('../../api/payments/reconcile-cron');

const MENSAJE_CUOTA =
  'Se agotó la cuota diaria gratuita de Firestore. Se restablece a las 2:00 a. m. (hora de Colombia).';
const ESTADOS = new Set(['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'EXPIRED', 'FRAUD_SUSPECT']);
const TREINTA_DIAS_MS = 30 * 24 * 3600 * 1000;

function vistaOrden(o) {
  return {
    referencia: o.reference,
    producto: o.productName || o.productType || o.tipo || '',
    montoCentavos: Number(o.amountInCents || 0),
    estado: o.status || 'PENDING',
    telefono: o.celular || null,
    email: o.email || null,
    creada: o.createdAt || null,
    transaccion: o.transactionId || null,
  };
}

/** Órdenes reales (se descartan los documentos auxiliares de idempotencia `idem_…`). */
async function listarOrdenes({ estado, q } = {}) {
  const ref = db.ordersRef;
  const texto = String(q || '').trim();
  if (texto) {
    const doc = await ref.doc(texto).get();
    return doc.exists && doc.data().reference ? [vistaOrden(doc.data())] : [];
  }
  const snap =
    typeof ref.orderBy === 'function' ? await ref.orderBy('createdAt', 'desc').limit(100).get() : await ref.get();
  return snap.docs
    .map((d) => d.data())
    .filter((o) => o.reference)
    .map(vistaOrden)
    .filter((o) => !estado || o.estado === estado)
    .sort((a, b) => String(b.creada || '').localeCompare(String(a.creada || '')))
    .slice(0, 100);
}

function totales(ordenes, ahora = Date.now()) {
  const recientes = ordenes.filter((o) => o.creada && ahora - Date.parse(o.creada) <= TREINTA_DIAS_MS);
  const aprobadas = recientes.filter((o) => o.estado === 'APPROVED');
  return {
    ventas30dCentavos: aprobadas.reduce((s, o) => s + o.montoCentavos, 0),
    aprobadas30d: aprobadas.length,
    pendientes: ordenes.filter((o) => o.estado === 'PENDING').length,
    sospechas: ordenes.filter((o) => o.estado === 'FRAUD_SUSPECT').length,
  };
}

async function detallePago(ref) {
  const doc = await db.ordersRef.doc(String(ref)).get();
  if (!doc.exists || !doc.data().reference) return null;
  const orden = doc.data();
  const registro = await db.transactionsRef.doc(`pago_${orden.reference}`).get();
  const entregado = registro.exists ? registro.data() : null;
  return {
    orden: vistaOrden(orden),
    entrega: entregado
      ? { entregado: true, origen: entregado.origen || null, fecha: entregado.processedAt || null, creditos: entregado.creditos || 0, plan: entregado.plan || null }
      : { entregado: false },
  };
}

/** Consulta la transacción en Wompi y acredita una sola vez si corresponde. */
async function conciliarConWompi(referencia, { fetchImpl = fetch } = {}) {
  const doc = await db.ordersRef.doc(String(referencia)).get();
  if (!doc.exists || !doc.data().reference) throw Object.assign(new Error('Orden no encontrada'), { status: 404 });
  const orden = doc.data();

  const isProd = (process.env.WOMPI_PUBLIC_KEY || '').startsWith('pub_prod_');
  const base = isProd ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
  const privateKey = requireEnv('WOMPI_PRIVATE_KEY', { testFallback: 'prv_test_local_suite' });
  const res = await fetchImpl(`${base}/transactions?reference=${encodeURIComponent(orden.reference)}`, {
    headers: { Authorization: `Bearer ${privateKey}` },
  });
  if (!res.ok) throw Object.assign(new Error(`Wompi respondió ${res.status}`), { status: 502 });
  const json = await res.json();
  const lista = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
  const aprobada = lista.find((t) => t.status === 'APPROVED');

  if (!aprobada) {
    const ultima = lista[lista.length - 1];
    const estadoWompi = ultima ? ultima.status : 'SIN_TRANSACCION';
    if (ultima && (estadoWompi === 'DECLINED' || estadoWompi === 'VOIDED' || estadoWompi === 'ERROR')) {
      await db.updateOrderStatus(orden.reference, estadoWompi === 'ERROR' ? 'DECLINED' : estadoWompi, {
        reconciledBy: 'panel',
        reconciledAt: new Date().toISOString(),
      });
    }
    return { resultado: 'no_aprobada', estadoWompi };
  }

  const { creditos, planData, expectedAmount } = resolverBeneficioOrden(orden);
  const pagado = Number(aprobada.amount_in_cents || 0);
  if (expectedAmount > 0 && pagado < expectedAmount) {
    await db.updateOrderStatus(orden.reference, 'FRAUD_SUSPECT', { montoPagado: pagado, expectedAmount, reconciledBy: 'panel' });
    return { resultado: 'monto_discrepante', pagado, esperado: expectedAmount };
  }
  const email = aprobada.customer_email ? String(aprobada.customer_email).toLowerCase().trim() : orden.email || null;
  const { duplicado } = await db.acreditarPagoUnaVez({
    reference: orden.reference,
    transactionId: aprobada.id,
    celular: orden.celular,
    creditos,
    planData,
    email,
    origen: 'panel',
    datos: { amountInCents: pagado, paymentMethod: aprobada.payment_method_type || null },
  });
  await db.updateOrderStatus(orden.reference, 'APPROVED', {
    transactionId: aprobada.id,
    reconciledBy: 'panel',
    reconciledAt: new Date().toISOString(),
  });
  return { resultado: duplicado ? 'ya_entregado' : 'acreditado', creditos, plan: planData ? planData.plan : null };
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
  if (!db.ordersRef) return res.status(503).json({ ok: false, error: MENSAJE_CUOTA, codigo: 'CUOTA_AGOTADA' });

  const accion = (req.query && req.query.action) || 'pagos';
  try {
    if (accion === 'pagos' && req.method === 'GET') {
      const estado = ESTADOS.has(req.query.estado) ? req.query.estado : null;
      const todas = await listarOrdenes({ q: req.query.q });
      return res.status(200).json({
        ok: true,
        totales: totales(todas),
        ordenes: estado ? todas.filter((o) => o.estado === estado) : todas,
      });
    }
    if (accion === 'pago' && req.method === 'GET') {
      const detalle = await detallePago(req.query.ref);
      if (!detalle) return res.status(404).json({ ok: false, error: 'Orden no encontrada.' });
      return res.status(200).json({ ok: true, ...detalle });
    }
    if (accion === 'pago' && req.method === 'POST') {
      const ref = String((req.body || {}).ref || '');
      const r = await conciliarConWompi(ref);
      await registrarAuditoria({ accion: 'conciliar_pago', email: admin.email, detalle: { referencia: ref, ...r } });
      return res.status(200).json({ ok: true, ...r, ...(await detallePago(ref)) });
    }
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  } catch (err) {
    if (err && (err.status === 404 || err.status === 502)) return res.status(err.status).json({ ok: false, error: err.message });
    if (esErrorDeCuota(err) || (err && err.status === 503)) {
      return res.status(503).json({ ok: false, error: MENSAJE_CUOTA, codigo: 'CUOTA_AGOTADA' });
    }
    console.error('[admin:pagos] Error:', err.message);
    return res.status(500).json({ ok: false, error: 'Error interno del panel.' });
  }
}

module.exports = handler;
module.exports.listarOrdenes = listarOrdenes;
module.exports.totales = totales;
module.exports.detallePago = detallePago;
module.exports.conciliarConWompi = conciliarConWompi;
