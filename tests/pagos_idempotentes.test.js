/**
 * 🧪 PAGOS: ACREDITACIÓN ÚNICA Y FALLO CERRADO
 * tests/pagos_idempotentes.test.js
 *
 * Valida que:
 * 1. Un mismo pago se acredita una sola vez aunque lleguen webhook, reclamo y cron.
 * 2. Los registros anteriores al cambio (id de Wompi y claim_<ref>) cuentan como ya entregados.
 * 3. Si la base de datos falla, el webhook responde 503 (Wompi reintenta) y el pago NO queda
 *    marcado como procesado: el reintento sí acredita.
 * 4. Un aviso no aprobado no escribe nada.
 *
 * Corre en modo memoria (sin credenciales de Firestore): no toca producción.
 */
process.env.NODE_ENV = 'test';
process.env.FIRESTORE_DESACTIVADO = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const db = require('../lib/db');
const webhookHandler = require('../api/payments/webhook-wompi');

function crearRes() {
  return {
    statusCode: 200,
    data: null,
    setHeader() {},
    status(c) { this.statusCode = c; return this; },
    json(d) { this.data = d; return this; },
    end() { return this; }
  };
}

function celularAleatorio() {
  return '317' + Math.floor(1000000 + Math.random() * 9000000);
}

/** Evento de Wompi firmado como lo firma la pasarela. */
function eventoWompi({ id, reference, status = 'APPROVED', monto = 3500000 }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const secreto = process.env.WOMPI_EVENTS_SECRET || 'test_events_local_suite';
  const checksum = crypto.createHash('sha256').update(`${id}${status}${monto}${timestamp}${secreto}`).digest('hex');
  return {
    method: 'POST',
    body: {
      event: 'transaction.updated',
      data: { transaction: { id, reference, status, amount_in_cents: monto, payment_method_type: 'CARD' } },
      timestamp,
      signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum }
    }
  };
}

describe('💳 Pagos: acreditación única y fallo cerrado', () => {
  test('el mismo pago por webhook, reclamo y cron se acredita una sola vez', async () => {
    const celular = celularAleatorio();
    const reference = `HNT-${celular}-10CR-${Date.now()}-a1`;
    const base = { reference, celular, creditos: 10 };

    const r1 = await db.acreditarPagoUnaVez({ ...base, transactionId: 'trx-1', origen: 'webhook' });
    const r2 = await db.acreditarPagoUnaVez({ ...base, origen: 'reclamo' });
    const r3 = await db.acreditarPagoUnaVez({ ...base, transactionId: 'trx-1', origen: 'cron' });

    assert.equal(r1.duplicado, false);
    assert.equal(r2.duplicado, true);
    assert.equal(r3.duplicado, true);
    assert.equal((await db.getUserByPhone(celular)).credits, 10, '10 créditos, no 30');
  });

  test('los registros de antes del cambio cuentan como pago ya entregado', async () => {
    const celular = celularAleatorio();
    const reference = `HNT-${celular}-1CR-${Date.now()}-b2`;
    await db.recordTransaction(`claim_${reference}`, { reference });
    const r = await db.acreditarPagoUnaVez({ reference, celular, creditos: 1, origen: 'webhook' });
    assert.equal(r.duplicado, true);

    const reference2 = `HNT-${celular}-1CR-${Date.now()}-c3`;
    await db.recordTransaction('trx-legado', { reference: reference2 });
    const r2 = await db.acreditarPagoUnaVez({ reference: reference2, celular, creditos: 1, transactionId: 'trx-legado' });
    assert.equal(r2.duplicado, true);
    assert.equal(await db.getUserByPhone(celular), null, 'no se creó ni acreditó al usuario');
  });

  test('si la base falla, el webhook responde 503 y el reintento de Wompi sí acredita', async () => {
    const celular = celularAleatorio();
    const reference = `HNT-${celular}-10CR-${Date.now()}-d4`;
    const req = eventoWompi({ id: `trx-${Date.now()}`, reference });

    const original = db.acreditarPagoUnaVez;
    db.acreditarPagoUnaVez = async () => {
      const err = new Error('8 RESOURCE_EXHAUSTED: Quota exceeded.');
      err.code = 8;
      err.codigo = 'CUOTA_AGOTADA';
      err.status = 503;
      throw err;
    };
    const resFalla = crearRes();
    try {
      await webhookHandler(req, resFalla);
    } finally {
      db.acreditarPagoUnaVez = original;
    }
    assert.equal(resFalla.statusCode, 503, 'Wompi debe reintentar');
    assert.equal(await db.getUserByPhone(celular), null);

    const resReintento = crearRes();
    await webhookHandler(req, resReintento);
    assert.equal(resReintento.statusCode, 200);
    assert.equal(resReintento.data.user.credits, 10);

    const resDuplicado = crearRes();
    await webhookHandler(req, resDuplicado);
    assert.equal(resDuplicado.data.duplicate, true);
    assert.equal((await db.getUserByPhone(celular)).credits, 10);
  });

  test('un aviso no aprobado no escribe nada', async () => {
    const celular = celularAleatorio();
    const reference = `HNT-${celular}-10CR-${Date.now()}-e5`;
    const id = `trx-rechazada-${Date.now()}`;
    const res = crearRes();
    await webhookHandler(eventoWompi({ id, reference, status: 'DECLINED' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.status, 'DECLINED');
    assert.equal(await db.isTransactionProcessed(id), false);
    assert.equal(await db.getUserByPhone(celular), null);
  });
});
