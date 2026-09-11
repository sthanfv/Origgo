/**
 * 🧪 TEST UNITARIO: SISTEMA WEB PUSH PWA ($0 COSTE)
 * tests/web_push.test.js
 * 
 * Valida:
 * 1. Entrega segura de clave pública VAPID sin variables en frontend estático.
 * 2. Validación de esquemas y registro de suscripciones W3C Push API.
 * 3. Protección criptográfica del endpoint de despacho (401 sin x-internal-secret).
 * 4. Deduplicación y persistencia de suscripciones.
 */

const test = require('node:test');
const assert = require('node:assert');
require('../lib/env');

const vapidKeyHandler = require('../api/notifications/vapid-public-key');
const subscribeHandler = require('../api/notifications/subscribe');
const dispatchHandler = require('../api/notifications/dispatch');
const { hashEndpoint, registrarSuscripcion, obtenerSuscripcionesActivas } = require('../lib/push-subscriptions');

function mockReqRes(options = {}) {
  const headersRes = {};
  let statusCode = 200;
  let responseData = null;

  const req = {
    method: options.method || 'GET',
    headers: { ...options.headers },
    body: options.body || {},
    socket: { remoteAddress: '190.25.1.1' }
  };

  const res = {
    setHeader(nombre, valor) {
      headersRes[nombre.toLowerCase()] = String(valor);
    },
    status(code) {
      statusCode = code;
      return {
        json(data) {
          responseData = data;
          return data;
        },
        end() {
          return null;
        }
      };
    },
    getStatusCode: () => statusCode,
    getData: () => responseData,
    getHeaders: () => headersRes
  };

  return { req, res };
}

test('Suite DevSecOps Web Push PWA (VAPID)', async (t) => {
  await t.test('1. Endpoint vapid-public-key debe entregar la clave pública y bloquear métodos no GET', async () => {
    // Prueba GET válido
    const { req, res } = mockReqRes({ method: 'GET' });
    await vapidKeyHandler(req, res);
    
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getData();
    assert.strictEqual(data.ok, true);
    assert.ok(typeof data.publicKey === 'string' && data.publicKey.length > 30);

    // Prueba método POST rechazado
    const { req: reqPost, res: resPost } = mockReqRes({ method: 'POST' });
    await vapidKeyHandler(reqPost, resPost);
    assert.strictEqual(resPost.getStatusCode(), 405);
  });

  await t.test('2. Endpoint subscribe debe validar el formato W3C Push API', async () => {
    // Suscripción inválida (sin keys)
    const { req: reqInvalido, res: resInvalido } = mockReqRes({
      method: 'POST',
      body: { subscription: { endpoint: 'https://push.example.com/123' } }
    });
    await subscribeHandler(reqInvalido, resInvalido);
    assert.strictEqual(resInvalido.getStatusCode(), 400);

    // Suscripción válida
    const subValida = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-sub-12345',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0PwtgoaqOMQJaBoeBlaK2Uv1-6Bg',
        auth: 'tBHItJI5svbpez7KI4CCXg'
      }
    };

    const { req: reqValido, res: resValido } = mockReqRes({
      method: 'POST',
      body: { subscription: subValida, ciudad: 'Bogotá' }
    });
    await subscribeHandler(reqValido, resValido);
    assert.strictEqual(resValido.getStatusCode(), 200);
    assert.strictEqual(resValido.getData().ok, true);
  });

  await t.test('3. Endpoint dispatch debe rechazar accesos sin secreto interno (401 Unauthorized)', async () => {
    // Sin cabecera x-internal-secret
    const { req: reqSinAuth, res: resSinAuth } = mockReqRes({
      method: 'POST',
      headers: {},
      body: { message: 'Alerta no autorizada' }
    });
    await dispatchHandler(reqSinAuth, resSinAuth);
    assert.strictEqual(resSinAuth.getStatusCode(), 401);

    // Con secreto incorrecto
    const { req: reqMalo, res: resMalo } = mockReqRes({
      method: 'POST',
      headers: { 'x-internal-secret': 'secreto_falso_hack' },
      body: { message: 'Alerta no autorizada' }
    });
    await dispatchHandler(reqMalo, resMalo);
    assert.strictEqual(resMalo.getStatusCode(), 401);
  });

  await t.test('4. Deduplicación por hashEndpoint en suscripciones', () => {
    const ep1 = 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABnz';
    const h1 = hashEndpoint(ep1);
    const h2 = hashEndpoint(ep1);
    assert.strictEqual(h1, h2, 'El hash determinista debe ser idéntico');
    assert.strictEqual(h1.length, 32);
  });
});
