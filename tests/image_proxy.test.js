/**
 * 🧪 TEST UNITARIO: PROXY DE MEDIOS Y PROTECCIÓN ANTI-SSRF
 * tests/image_proxy.test.js
 * 
 * Valida que el proxy de medios rechace URLs malformadas, protocolos inseguros,
 * intentos de Server-Side Request Forgery (SSRF) hacia IPs privadas y hosts no autorizados.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const proxyHandler = require('../api/media/proxy');

function createMockReq(method = 'GET', query = {}) {
  return {
    method,
    query,
    headers: {}
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    json(obj) {
      this.headersSent = true;
      this.body = obj;
      return this;
    },
    write(chunk) {
      // Mock para streaming
    },
    end() {
      this.headersSent = true;
    }
  };
  return res;
}

describe('Proxy de Medios y Protección Anti-SSRF (api/media/proxy.js)', () => {
  it('Debe rechazar métodos HTTP distintos de GET y HEAD con 405', async () => {
    const req = createMockReq('POST', { url: 'https://images.unsplash.com/photo-1' });
    const res = createMockRes();

    await proxyHandler(req, res);
    assert.strictEqual(res.statusCode, 405);
    assert.ok(res.body.error.includes('Método no permitido'));
  });

  it('Debe rechazar peticiones sin el parámetro url con 400', async () => {
    const req = createMockReq('GET', {});
    const res = createMockRes();

    await proxyHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.body.error.includes('requerido'));
  });

  it('Debe rechazar URLs con protocolos inseguros como file: o gopher:', async () => {
    const req = createMockReq('GET', { url: 'file:///etc/passwd' });
    const res = createMockRes();

    await proxyHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.body.error.includes('Protocolo no soportado'));
  });

  it('Debe bloquear intentos de SSRF hacia localhost y direcciones IP privadas con 403', async () => {
    const ipsPeligrosas = [
      'http://localhost:3000/admin',
      'http://127.0.0.1:8080/metrics',
      'http://192.168.1.1/router',
      'http://10.0.0.1/secrets',
      'http://169.254.169.254/latest/meta-data/' // AWS metadata
    ];

    for (const urlPeligrosa of ipsPeligrosas) {
      const req = createMockReq('GET', { url: urlPeligrosa });
      const res = createMockRes();

      await proxyHandler(req, res);
      assert.strictEqual(res.statusCode, 403, `Debe bloquear ${urlPeligrosa}`);
      assert.ok(res.body.error.includes('no autorizado'));
    }
  });

  it('Debe bloquear dominios no incluidos en la lista blanca con 403', async () => {
    const req = createMockReq('GET', { url: 'https://malicious-site.com/exploit.jpg' });
    const res = createMockRes();

    await proxyHandler(req, res);
    assert.strictEqual(res.statusCode, 403);
    assert.ok(res.body.error.includes('no autorizado'));
  });
});
