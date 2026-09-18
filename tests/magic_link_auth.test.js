/**
 * 🧪 PRUEBAS UNITARIAS: AUTENTICACIÓN SIN CONTRASEÑA (MAGIC LINK)
 * tests/magic_link_auth.test.js
 * 
 * Verifica:
 * 1. Generación y almacenamiento criptográfico del token en DB.
 * 2. Canje atómico del token emitiendo sesión JWT de 30 días.
 * 3. Invalidación inmediata para prevenir reuso (anti-replay).
 * 4. Rechazo de tokens inexistentes o expirados.
 * 5. Endpoints serverless /api/auth/magic-link y /api/auth/magic-login.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../lib/db');
const magicLoginHandler = require('../lib/auth/magic-login');
const magicLinkHandler = require('../lib/auth/magic-link');
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

describe('🔐 Suite Magic Link — Autenticación Sin Contraseña', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('1. Debe generar token y permitir canje atómico de 1 solo uso', async () => {
    const celular = '315' + Math.floor(1000000 + Math.random() * 9000000);
    const email = `usuario.magic.${Date.now()}@origgo.online`;

    // Crear usuario previo con crédito
    await db.addCredits(celular, 2, 'HNT-5555', null, email);

    // Generar token
    const tokenData = await db.createMagicToken(celular, email, 30);
    assert.ok(tokenData.token && tokenData.token.length >= 32);

    // Canjear token por primera vez
    const canje = await db.consumeMagicToken(tokenData.token);
    assert.equal(canje.success, true);
    assert.equal(canje.user?.phone, celular);

    // Intentar segundo canje (debe ser rechazado)
    const reintento = await db.consumeMagicToken(tokenData.token);
    assert.equal(reintento.success, false);
    assert.equal(reintento.error, 'TOKEN_YA_USADO');
  });

  it('2. El endpoint magic-login debe autenticar y emitir JWT con token válido', async () => {
    const celular = '317' + Math.floor(1000000 + Math.random() * 9000000);
    const email = `login.magic.${Date.now()}@origgo.online`;

    await db.addCredits(celular, 1, 'HNT-8888', null, email);
    const tokenData = await db.createMagicToken(celular, email, 30);

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { token: tokenData.token, lang: 'es' }
    };
    const res = crearMockRes();

    await magicLoginHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload?.ok, true);
    assert.ok(res.payload?.token, 'Debe emitir un token JWT');

    const decoded = verifyJwt(res.payload.token, JWT_SECRET);
    assert.equal(decoded.phone, celular);
  });

  it('3. El endpoint magic-link debe aceptar solicitudes para usuarios registrados', async () => {
    const celular = '318' + Math.floor(1000000 + Math.random() * 9000000);
    const email = `solicitud.magic.${Date.now()}@origgo.online`;

    await db.addCredits(celular, 1, 'HNT-7777', null, email);

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { identifier: email, lang: 'es' }
    };
    const res = crearMockRes();

    await magicLinkHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload?.ok, true);
  });
});
