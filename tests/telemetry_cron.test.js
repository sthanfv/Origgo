/**
 * 🧪 PRUEBAS UNITARIAS: VERCEL CRON DE TELEMETRÍA COMERCIAL
 * tests/telemetry_cron.test.js
 * 
 * Valida la autenticación criptográfica Bearer CRON_SECRET, métodos HTTP permitidos,
 * generación y despacho seguro del reporte diario del embudo sin exponer PII.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.DISABLE_FIRESTORE_FOR_TESTS = 'true';
require('../lib/env');

const cronHandler = require('../api/telemetry').cron;

function createMockReqRes({ method = 'GET', headers = {}, query = {} } = {}) {
  const req = {
    method,
    headers,
    query
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    }
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

describe('⚡ Vercel Cron de Telemetría Comercial (/api/telemetry/cron)', () => {
  const SECRET_TEST = 'test_cron_secret_2026';

  beforeEach(() => {
    process.env.CRON_SECRET = SECRET_TEST;
  });

  it('Rechaza peticiones con método no permitido (DELETE, PUT)', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({ method: 'DELETE' });
    await cronHandler(req, res);
    assert.strictEqual(getStatus(), 405);
    assert.strictEqual(getData().error, 'METODO_NO_PERMITIDO');
  });

  it('Rechaza peticiones no autorizadas sin cabecera Bearer', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      method: 'GET',
      headers: {}
    });
    await cronHandler(req, res);
    assert.strictEqual(getStatus(), 401);
    assert.strictEqual(getData().error, 'NO_AUTORIZADO');
  });

  it('Rechaza peticiones con token inválido', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      method: 'GET',
      headers: { authorization: 'Bearer token_invalido_123' }
    });
    await cronHandler(req, res);
    assert.strictEqual(getStatus(), 401);
    assert.strictEqual(getData().error, 'NO_AUTORIZADO');
  });

  it('Acepta peticiones válidas con Bearer CRON_SECRET y retorna resumen', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${SECRET_TEST}` },
      query: { dias: '1' }
    });
    await cronHandler(req, res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getData().ok, true);
    assert.strictEqual(getData().dias, 1);
    assert.strictEqual(typeof getData().telegramEnviado, 'boolean');
    assert.strictEqual(typeof getData().totalVisitas, 'number');
  });

  it('Aplica por defecto una ventana consolidada semanal de 7 días sin parámetro query', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      method: 'GET',
      headers: { authorization: `Bearer ${SECRET_TEST}` }
    });
    await cronHandler(req, res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getData().ok, true);
    assert.strictEqual(getData().dias, 7);
    assert.strictEqual(typeof getData().telegramEnviado, 'boolean');
    assert.strictEqual(typeof getData().totalVisitas, 'number');
  });
});
