/**
 * 🧪 SUITE DE PRUEBAS AUTOMATIZADAS: CONCILIACIÓN AUTOMÁTICA (VERCEL CRON FAIL-SAFE)
 * tests/reconciliation_cron.test.js
 * 
 * Valida de forma rigurosa:
 * 1. Protección estricta con Bearer Token (HTTP 401 ante accesos no autorizados).
 * 2. Comportamiento ante cola vacía de órdenes pendientes.
 * 3. Ventana temporal anti-carreras (omisión de órdenes < 2 minutos de antigüedad).
 * 4. Auto-acreditación atómica e idempotente cuando Wompi responde APPROVED.
 * 5. Actualización de orden a DECLINED/VOIDED ante transacciones rechazadas.
 * 6. Marcado de órdenes huérfanas (> 24 horas) a estado EXPIRED.
 * 7. Detección de fraude por alteración de montos hacia abajo.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../lib/db');
const cronHandler = require('../api/payments/reconcile-cron');

function crearMockRes() {
  let codigoEstado = 200;
  let headers = {};
  let payloadJson = null;
  let finalizado = false;

  const res = {
    setHeader(clave, valor) {
      headers[clave.toLowerCase()] = valor;
      return res;
    },
    status(codigo) {
      codigoEstado = codigo;
      return res;
    },
    json(datos) {
      payloadJson = datos;
      finalizado = true;
      return res;
    },
    end() {
      finalizado = true;
      return res;
    },
    get statusCode() {
      return codigoEstado;
    },
    get headers() {
      return headers;
    },
    get payload() {
      return payloadJson;
    },
    get ended() {
      return finalizado;
    }
  };

  return res;
}

describe('🔄 Conciliación Automática Wompi (Vercel Cron Fail-Safe)', () => {
  const fetchOriginal = global.fetch;
  const cronSecretTest = 'test_cron_secret_2026';

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.CRON_SECRET = cronSecretTest;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('1. Debe rechazar con HTTP 401 si falta el header Authorization o el token es incorrecto', async () => {
    // Petición sin header
    const reqSinAuth = {
      method: 'GET',
      headers: {}
    };
    const resSinAuth = crearMockRes();
    await cronHandler(reqSinAuth, resSinAuth);

    assert.equal(resSinAuth.statusCode, 401, 'Debe retornar 401 sin credenciales');
    assert.equal(resSinAuth.payload?.ok, false);
    assert.equal(resSinAuth.payload?.error, 'NO_AUTORIZADO');

    // Petición con token inválido
    const reqTokenFalso = {
      method: 'GET',
      headers: { authorization: 'Bearer token_invalido_malicioso' }
    };
    const resTokenFalso = crearMockRes();
    await cronHandler(reqTokenFalso, resTokenFalso);

    assert.equal(resTokenFalso.statusCode, 401, 'Debe retornar 401 con token incorrecto');
  });

  it('2. Debe responder HTTP 200 con reporte cuando no existen órdenes pendientes', async () => {
    const req = {
      method: 'GET',
      headers: { authorization: `Bearer ${cronSecretTest}` }
    };
    const res = crearMockRes();

    await cronHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload?.ok, true);
    assert.ok(typeof res.payload?.metricas === 'object');
  });

  it('3. Debe omitir órdenes pendientes con menos de 2 minutos de creación (ventana anti-carreras)', async () => {
    const refReciente = `HNT-3119001122-1CR-${Date.now()}-abc`;
    await db.savePendingOrder(refReciente, {
      reference: refReciente,
      celular: '3119001122',
      creditos: 1,
      amountInCents: 500000,
      status: 'PENDING',
      createdAt: new Date().toISOString() // Creada hace 0 segundos
    });

    const req = {
      method: 'GET',
      headers: { authorization: `Bearer ${cronSecretTest}` }
    };
    const res = crearMockRes();

    await cronHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.payload?.metricas?.omitidasPorRecientes >= 1, 'Debe omitir la orden reciente');

    // Verificar que la orden siga PENDING
    const orden = await db.getPendingOrder(refReciente);
    assert.equal(orden?.status, 'PENDING', 'La orden debe permanecer PENDING');
  });

  it('4. Debe auto-acreditar orden pendiente cuando la API de Wompi responde APPROVED', async () => {
    const refAprobada = `HNT-3118882233-1CR-${Date.now()}-xyz`;
    const fechaCincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    await db.savePendingOrder(refAprobada, {
      reference: refAprobada,
      celular: '3118882233',
      creditos: 1,
      amountInCents: 500000,
      status: 'PENDING',
      createdAt: fechaCincoMinAtras,
      email: 'comprador@origgo.online'
    });

    // Mock de fetch para simular API oficial de Wompi
    global.fetch = async (url) => {
      if (url.includes('transactions?reference=')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: `trx_mock_${Date.now()}`,
                reference: refAprobada,
                status: 'APPROVED',
                amount_in_cents: 500000,
                payment_method_type: 'PSE',
                customer_email: 'comprador@origgo.online'
              }
            ]
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${cronSecretTest}` }
    };
    const res = crearMockRes();

    await cronHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.payload?.metricas?.aprobadas >= 1, 'Debe registrar al menos 1 orden aprobada');

    // Verificar en ledger que la orden pasó a APPROVED
    const ordenActualizada = await db.getPendingOrder(refAprobada);
    assert.equal(ordenActualizada?.status, 'APPROVED', 'El estado de la orden debe ser APPROVED');
    assert.equal(ordenActualizada?.reconciledBy, 'cron', 'Debe marcar reconciledBy cron');

    // Verificar que el usuario recibió el crédito en su cuenta
    const usuario = await db.getUserByPhone('3118882233');
    assert.ok(usuario && usuario.credits >= 1, 'El usuario debe tener créditos acreditados');
  });

  it('5. Debe actualizar orden a DECLINED cuando Wompi responde que la transacción fue rechazada', async () => {
    const refRechazada = `HNT-3117774455-1CR-${Date.now()}-fail`;
    const fechaDiezMinAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    await db.savePendingOrder(refRechazada, {
      reference: refRechazada,
      celular: '3117774455',
      creditos: 1,
      amountInCents: 500000,
      status: 'PENDING',
      createdAt: fechaDiezMinAtras
    });

    global.fetch = async (url) => {
      if (url.includes('transactions?reference=')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: `trx_declined_${Date.now()}`,
                reference: refRechazada,
                status: 'DECLINED',
                amount_in_cents: 500000,
                payment_method_type: 'CARD'
              }
            ]
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const req = {
      method: 'GET',
      headers: { authorization: `Bearer ${cronSecretTest}` }
    };
    const res = crearMockRes();

    await cronHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.payload?.metricas?.rechazadas >= 1, 'Debe registrar orden rechazada');

    const ordenRechazada = await db.getPendingOrder(refRechazada);
    assert.equal(ordenRechazada?.status, 'DECLINED', 'La orden debe actualizarse a DECLINED');
  });

  it('6. Debe marcar como EXPIRED órdenes huérfanas con más de 24 horas de antigüedad', async () => {
    const refExpirada = `HNT-3116665544-1CR-${Date.now()}-old`;
    const fechaVeintiseisHorasAtras = new Date(Date.now() - 26 * 3600 * 1000).toISOString();

    await db.savePendingOrder(refExpirada, {
      reference: refExpirada,
      celular: '3116665544',
      creditos: 1,
      amountInCents: 500000,
      status: 'PENDING',
      createdAt: fechaVeintiseisHorasAtras
    });

    const req = {
      method: 'GET',
      headers: { authorization: `Bearer ${cronSecretTest}` }
    };
    const res = crearMockRes();

    await cronHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.payload?.metricas?.expiradas >= 1, 'Debe registrar orden expirada');

    const ordenExpirada = await db.getPendingOrder(refExpirada);
    assert.equal(ordenExpirada?.status, 'EXPIRED', 'La orden debe actualizarse a EXPIRED');
  });

  it('7. Debe detectar y bloquear transacción con monto discrepante hacia abajo (antifraude)', async () => {
    const refFraude = `HNT-3115556677-10CR-${Date.now()}-frd`;
    const fechaQuinceMinAtras = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // Orden de 10 créditos exige $35.000 COP (3.500.000 centavos)
    await db.savePendingOrder(refFraude, {
      reference: refFraude,
      celular: '3115556677',
      creditos: 10,
      amountInCents: 3500000,
      status: 'PENDING',
      createdAt: fechaQuinceMinAtras
    });

    // Simular que Wompi dice APPROVED pero con monto alterado ($1.000 COP = 100.000 centavos)
    global.fetch = async (url) => {
      if (url.includes('transactions?reference=')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: `trx_fraud_${Date.now()}`,
                reference: refFraude,
                status: 'APPROVED',
                amount_in_cents: 100000, // Menor que 3.500.000
                payment_method_type: 'PSE'
              }
            ]
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const req = {
      method: 'GET',
      headers: { authorization: `Bearer ${cronSecretTest}` }
    };
    const res = crearMockRes();

    await cronHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.payload?.metricas?.errores >= 1, 'Debe contabilizar error por fraude');

    const ordenSospechosa = await db.getPendingOrder(refFraude);
    assert.equal(ordenSospechosa?.status, 'FRAUD_SUSPECT', 'La orden debe marcarse FRAUD_SUSPECT');
  });
});
