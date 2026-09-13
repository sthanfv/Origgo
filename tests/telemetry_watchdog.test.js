/**
 * 🧪 TEST UNITARIO: PERRO GUARDIÁN, OBSERVABILIDAD Y COLA DE REINTENTOS
 * tests/telemetry_watchdog.test.js
 * 
 * Valida la desinfección estricta de PII (JWT, tarjetas, celulares, PINs)
 * en el endpoint de telemetría y el comportamiento del Perro Guardián.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const telemetryHandler = require('../api/telemetry/report');

// Helper mock para simular req y res en endpoints serverless
function createMockReqRes({ method = 'POST', body = {}, ip = '127.0.0.1' } = {}) {
  const req = {
    method,
    url: '/api/telemetry/report',
    headers: {
      'x-forwarded-for': ip,
      'user-agent': 'TestRunner-Watchdog/1.0'
    },
    body
  };

  let statusCode = 200;
  let responseData = null;
  const headersSet = {};

  const res = {
    setHeader: (k, v) => { headersSet[k] = v; },
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    end: () => res
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

describe('🐕 Perro Guardián: Telemetría y Sanitización Serverless', () => {
  it('Debe rechazar métodos distintos a POST con HTTP 405', async () => {
    const { req, res, getStatus } = createMockReqRes({ method: 'GET' });
    await telemetryHandler(req, res);
    assert.strictEqual(getStatus(), 405);
  });

  it('Debe procesar un reporte válido y retornar HTTP 200 { ok: true }', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      method: 'POST',
      body: {
        tipo: 'FETCH_REINTENTOS_AGOTADOS',
        mensaje: 'Fallo al cargar recurso externo tras 3 intentos',
        origen: 'modules/03-api.js',
        stack: 'Error: timeout at fetchConReintentos'
      }
    });

    await telemetryHandler(req, res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getData().ok, true);
    assert.strictEqual(getData().recibido, true);
  });

  it('Debe desinfectar tokens JWT, números de tarjeta y teléfonos de los mensajes de error', async () => {
    let capturedLog = '';
    const originalWarn = console.warn;
    console.warn = (...args) => { capturedLog += args.join(' '); };

    try {
      const { req, res, getStatus } = createMockReqRes({
        method: 'POST',
        body: {
          tipo: 'SECURITY_INCIDENT',
          mensaje: 'Fallo con token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwaG9uZSI6IjU3MzAwMTIzNDU2NyJ9.abcdef123456 y tarjeta 4532-1234-5678-9010',
          origen: 'checkout_leak',
          stack: 'Contexto con celular 3105551234 y pin: 9412'
        }
      });

      await telemetryHandler(req, res);
      assert.strictEqual(getStatus(), 200);

      // Verificar que los datos confidenciales fueron ofuscados
      assert.doesNotMatch(capturedLog, /eyJhbGciOiJIUzI1Ni/);
      assert.match(capturedLog, /\[JWT_OFUSCADO\]/);
      assert.doesNotMatch(capturedLog, /4532-1234-5678-9010/);
      assert.match(capturedLog, /\[TARJETA_OFUSCADA\]/);
      assert.doesNotMatch(capturedLog, /3105551234/);
      assert.match(capturedLog, /\[TEL_OFUSCADO\]/);
      assert.match(capturedLog, /pin:\[PIN_OFUSCADO\]/i);
    } finally {
      console.warn = originalWarn;
    }
  });
});
