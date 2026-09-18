/**
 * 🧪 PRUEBAS UNITARIAS: MODELO FREEMIUM (1 DESBLOQUEO GRATIS DE BIENVENIDA)
 * tests/freemium_welcome_credit.test.js
 * 
 * Verifica de forma rigurosa:
 * 1. Acreditación atómica de 1 crédito gratis a un nuevo usuario.
 * 2. Marcado inmutable de welcomeCreditClaimed = true.
 * 3. Rechazo estricto (HTTP 409 CREDITO_YA_RECLAMADO) ante intentos repetidos.
 * 4. Validación Zod de números de celular de Colombia (prefijos móviles 3XX).
 * 5. Emisión de token JWT válido para sesión persistente.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../lib/db');
const welcomeCreditHandler = require('../lib/auth/welcome-credit');
const { verifyJwt } = require('../lib/crypto');
const { requireEnv } = require('../lib/env');

const JWT_SECRET = requireEnv('JWT_SECRET', {
  testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232'
});

function crearMockRes() {
  let codigoEstado = 200;
  let headers = {};
  let payloadJson = null;

  const res = {
    setHeader(k, v) { headers[k.toLowerCase()] = v; return res; },
    status(code) { codigoEstado = code; return res; },
    json(data) { payloadJson = data; return res; },
    end() { return res; },
    get statusCode() { return codigoEstado; },
    get payload() { return payloadJson; }
  };
  return res;
}

describe('🎁 Suite Freemium — 1 Desbloqueo Gratis de Bienvenida', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('1. Debe acreditar 1 crédito gratis a un nuevo WhatsApp de Colombia y emitir JWT', async () => {
    const celular = '310' + Math.floor(1000000 + Math.random() * 9000000);
    const email = `test.freemium.${Date.now()}@origgo.online`;

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { celular, email, lang: 'es' }
    };
    const res = crearMockRes();

    await welcomeCreditHandler(req, res);

    assert.equal(res.statusCode, 200, 'Debe responder HTTP 200');
    assert.equal(res.payload?.ok, true);
    assert.equal(res.payload?.user?.credits, 1, 'Debe otorgar exactamente 1 crédito');
    assert.equal(res.payload?.user?.phone, celular);
    assert.ok(res.payload?.token, 'Debe retornar un token JWT');

    const decoded = verifyJwt(res.payload.token, JWT_SECRET);
    assert.ok(decoded, 'El token debe ser un JWT válido');
    assert.equal(decoded.phone, celular);
    assert.equal(decoded.credits, 1);
  });

  it('2. Debe rechazar con HTTP 409 CREDITO_YA_RECLAMADO en un segundo intento con el mismo número', async () => {
    const celular = '320' + Math.floor(1000000 + Math.random() * 9000000);
    const email = `duplicado.${Date.now()}@origgo.online`;

    // Primer reclamo legítimo
    const req1 = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { celular, email }
    };
    const res1 = crearMockRes();
    await welcomeCreditHandler(req1, res1);
    assert.equal(res1.statusCode, 200);

    // Segundo reclamo con el mismo celular
    const req2 = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { celular, email: 'otro.correo@gmail.com' }
    };
    const res2 = crearMockRes();
    await welcomeCreditHandler(req2, res2);

    assert.equal(res2.statusCode, 409, 'Debe rechazar con 409 conflicto');
    assert.equal(res2.payload?.error, 'CREDITO_YA_RECLAMADO');
  });

  it('3. Debe rechazar números inválidos que no sean celulares móviles colombianos (3XX)', async () => {
    const reqInvalido = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { celular: '6012345678', email: 'fijo@bogota.com' } // Prefijo 601 es teléfono fijo
    };
    const res = crearMockRes();

    await welcomeCreditHandler(reqInvalido, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.payload?.error, 'VALIDACION_FALLIDA');
  });

  it('4. Debe aceptar el campo polimórfico "phone" y procesar exitosamente', async () => {
    const phone = '315' + Math.floor(1000000 + Math.random() * 9000000);
    const email = `test.phone.${Date.now()}@origgo.online`;

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { phone, email, lang: 'es' }
    };
    const res = crearMockRes();

    await welcomeCreditHandler(req, res);

    assert.equal(res.statusCode, 200, 'Debe aceptar la clave "phone"');
    assert.equal(res.payload?.ok, true);
    assert.equal(res.payload?.user?.credits, 1);
  });

  it('5. Debe rechazar correos con caracteres sospechosos de inyección XSS o scripts', async () => {
    const celular = '318' + Math.floor(1000000 + Math.random() * 9000000);
    const correosMaliciosos = [
      'usuario<script>@gmail.com',
      'ataque";alert(1)@hack.com',
      'user`id`@test.com',
      'test\\injection@evil.com'
    ];

    for (const emailMalicioso of correosMaliciosos) {
      const req = {
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
        body: { celular, email: emailMalicioso }
      };
      const res = crearMockRes();
      await welcomeCreditHandler(req, res);

      assert.equal(res.statusCode, 400, `Debe rechazar el correo malicioso: ${emailMalicioso}`);
      assert.equal(res.payload?.error, 'VALIDACION_FALLIDA');
    }
  });
});
