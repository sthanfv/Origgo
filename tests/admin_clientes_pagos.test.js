/**
 * 🧪 Panel — Clientes y Pagos (lib/admin/clientes.js, lib/admin/pagos.js).
 * Corre en modo memoria (sin credenciales de Firestore) y con Wompi simulado: no toca producción.
 */
process.env.NODE_ENV = 'test';
process.env.FIRESTORE_DESACTIVADO = '1';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../lib/db');
const { buscarClientes, detalleCliente } = require('../lib/admin/clientes');
const { listarOrdenes, totales, detallePago, conciliarConWompi } = require('../lib/admin/pagos');

const celularNuevo = () => '318' + Math.floor(1000000 + Math.random() * 9000000);

function wompiSimulado(transacciones) {
  return async () => ({ ok: true, status: 200, json: async () => ({ data: transacciones }) });
}

async function sembrarOrden(celular, extra = {}) {
  const reference = `HNT-${celular}-10CR-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  await db.savePendingOrder(reference, {
    reference,
    productName: '10 créditos',
    amountInCents: 3500000,
    celular,
    tipo: 'credito',
    creditos: 10,
    status: 'PENDING',
    idempotencyKey: `k-${reference}`,
    ...extra,
  });
  return reference;
}

describe('👥💳 Panel: clientes y pagos', () => {
  it('busca clientes por celular y correo, sin exponer el PIN', async () => {
    const tel = celularNuevo();
    await db.addCredits(tel, 3, 'HNT-1234', null, `c${tel}@example.com`);
    const porTel = await buscarClientes(tel);
    assert.equal(porTel.length, 1);
    assert.equal(porTel[0].creditos, 3);
    assert.ok(!('pin' in porTel[0]) && !JSON.stringify(porTel).includes('HNT-1234'));
    assert.equal((await buscarClientes(`C${tel}@EXAMPLE.com`))[0].telefono, tel);
  });

  it('ajusta créditos y plan de forma atómica; nunca deja saldo negativo ni crea cuentas', async () => {
    const tel = celularNuevo();
    await db.addCredits(tel, 2);
    assert.equal((await db.ajustarCuentaAdmin(tel, { delta: 5 })).credits, 7);
    assert.equal((await db.ajustarCuentaAdmin(tel, { delta: -50 })).credits, 0);
    const conPlan = await db.ajustarCuentaAdmin(tel, { plan: 'city', ciudad: 'Cali', dias: 15 });
    assert.equal(conPlan.plan, 'city');
    assert.equal(conPlan.planCity, 'Cali');
    assert.ok(Date.parse(conPlan.planExpiresAt) > Date.now() + 14 * 86400000);
    await assert.rejects(db.ajustarCuentaAdmin(celularNuevo(), { delta: 1 }), /Cliente no encontrado/);
  });

  it('lista órdenes sin los documentos auxiliares y el detalle del cliente trae sus órdenes', async () => {
    const tel = celularNuevo();
    await db.addCredits(tel, 0);
    const ref = await sembrarOrden(tel);
    const ordenes = await listarOrdenes();
    assert.ok(ordenes.some((o) => o.referencia === ref));
    assert.ok(ordenes.every((o) => o.referencia), 'sin documentos idem_');
    const detalle = await detalleCliente(tel);
    assert.deepEqual(detalle.ordenes.map((o) => o.referencia), [ref]);
    const t = totales([{ estado: 'APPROVED', montoCentavos: 500000, creada: new Date().toISOString() }, { estado: 'PENDING', montoCentavos: 1, creada: null }]);
    assert.deepEqual(t, { ventas30dCentavos: 500000, aprobadas30d: 1, pendientes: 1, sospechas: 0 });
  });

  it('conciliar con Wompi acredita una sola vez y marca la orden aprobada', async () => {
    const tel = celularNuevo();
    const ref = await sembrarOrden(tel);
    assert.equal((await detallePago(ref)).entrega.entregado, false);

    const wompi = wompiSimulado([{ id: `trx-${ref}`, status: 'APPROVED', amount_in_cents: 3500000 }]);
    const r1 = await conciliarConWompi(ref, { fetchImpl: wompi });
    assert.equal(r1.resultado, 'acreditado');
    const r2 = await conciliarConWompi(ref, { fetchImpl: wompi });
    assert.equal(r2.resultado, 'ya_entregado');

    assert.equal((await db.getUserByPhone(tel)).credits, 10, '10 créditos, no 20');
    const d = await detallePago(ref);
    assert.equal(d.orden.estado, 'APPROVED');
    assert.equal(d.entrega.entregado, true);
    assert.equal(d.entrega.origen, 'panel');
  });

  it('un monto menor al del producto queda como sospecha de fraude y no acredita', async () => {
    const tel = celularNuevo();
    const ref = await sembrarOrden(tel);
    const r = await conciliarConWompi(ref, { fetchImpl: wompiSimulado([{ id: 'x', status: 'APPROVED', amount_in_cents: 100 }]) });
    assert.equal(r.resultado, 'monto_discrepante');
    assert.equal((await detallePago(ref)).orden.estado, 'FRAUD_SUSPECT');
    assert.equal(await db.getUserByPhone(tel), null);
  });
});
