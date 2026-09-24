/**
 * 🧪 SMOKE TEST: FLUJO COMPLETO FREEMIUM, DOBLE OPT-IN Y ANTI-ABUSO
 * tests/smoke_freemium_flow.test.js
 * 
 * Valida el ciclo de vida de bienvenida:
 * 1. Rechazo de correo temporal / desechable (Anti-Sybil).
 * 2. Rechazo de celular inválido (formato colombiano no móvil).
 * 3. Solicitud exitosa de bienvenida con celular y correo legítimos (Doble Opt-In).
 * 4. Activación exitosa mediante token legítimo (welcome-verify).
 * 5. Rechazo de reutilización de token ya quemado.
 * 6. Bloqueo de dispositivo que ya reclamó su crédito de cortesía.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../lib/db');
const welcomeCreditHandler = require('../lib/auth/welcome-credit');
const welcomeVerifyHandler = require('../lib/auth/welcome-verify');
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

describe('🛡️ Smoke Test: Flujo Freemium Doble Opt-In y Barreras de Seguridad', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('1. Debe rechazar correos temporales/desechables (Anti-Sybil)', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        celular: '3109876543',
        email: 'usuario.tramposo@tempmail.com',
        deviceId: 'dev_smoke_' + Math.random().toString(36).substring(2, 10),
        lang: 'es'
      }
    };
    const res = crearMockRes();

    await welcomeCreditHandler(req, res);
    assert.equal(res.statusCode, 400, 'Debe retornar HTTP 400 para correo temporal');
    assert.equal(res.payload?.ok, false);
    assert.match(res.payload?.message, /temporales/i);
  });

  it('2. Debe rechazar números de celular que no inicien con 3 o de longitud inválida', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        celular: '6012345678', // Teléfono fijo de Bogotá, no celular
        email: 'usuario.legitimo@gmail.com',
        deviceId: 'dev_smoke_' + Math.random().toString(36).substring(2, 10),
        lang: 'es'
      }
    };
    const res = crearMockRes();

    await welcomeCreditHandler(req, res);
    assert.equal(res.statusCode, 400, 'Debe retornar HTTP 400 para número no móvil');
    assert.equal(res.payload?.ok, false);
  });

  it('3. Debe aceptar solicitud legítima y devolver pendingVerification: true sin emitir JWT', async () => {
    const rand = Math.floor(1000000 + Math.random() * 9000000);
    const celular = '312' + rand;
    const email = `usuario.smoke.${rand}@origgo.online`;
    const deviceId = 'dev_smoke_legit_' + rand;

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { celular, email, deviceId, lang: 'es' }
    };
    const res = crearMockRes();

    await welcomeCreditHandler(req, res);
    assert.equal(res.statusCode, 200, 'Debe retornar HTTP 200');
    assert.equal(res.payload?.ok, true);
    assert.equal(res.payload?.pendingVerification, true, 'Debe quedar pendiente de verificación por email');
    assert.equal(res.payload?.token, undefined, 'NO debe emitir token JWT antes de verificar correo');
  });

  it('4. Debe activar el crédito atómico con token válido y emitir JWT firmado', async () => {
    const rand = Math.floor(1000000 + Math.random() * 9000000);
    const celular = '315' + rand;
    const email = `usuario.verify.${rand}@origgo.online`;
    const deviceId = 'dev_smoke_verify_' + rand;

    // Crear token en Firestore o memoria de prueba
    const tokenObj = await db.createWelcomeVerificationToken(celular, email, deviceId, 60);

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { token: tokenObj.token, lang: 'es' }
    };
    const res = crearMockRes();

    await welcomeVerifyHandler(req, res);
    assert.equal(res.statusCode, 200, 'Debe verificar con HTTP 200');
    assert.equal(res.payload?.ok, true);
    assert.equal(res.payload?.user?.credits, 1, 'Debe tener exactamente 1 crédito acreditado');
    assert.ok(res.payload?.token, 'Debe emitir JWT');

    const decoded = verifyJwt(res.payload.token, JWT_SECRET);
    assert.ok(decoded, 'JWT debe ser criptográficamente válido');
    assert.equal(decoded.phone, celular);
    assert.equal(decoded.credits, 1);
  });

  it('5. Debe rechazar la reutilización del mismo token de verificación', async () => {
    const rand = Math.floor(1000000 + Math.random() * 9000000);
    const celular = '316' + rand;
    const email = `usuario.burn.${rand}@origgo.online`;
    const deviceId = 'dev_smoke_burn_' + rand;

    const tokenObj = await db.createWelcomeVerificationToken(celular, email, deviceId, 60);

    // Primer uso (válido)
    const req1 = { method: 'POST', headers: { 'x-forwarded-for': '127.0.0.1' }, body: { token: tokenObj.token } };
    const res1 = crearMockRes();
    await welcomeVerifyHandler(req1, res1);
    assert.equal(res1.statusCode, 200);

    // Segundo uso (debe ser rechazado)
    const req2 = { method: 'POST', headers: { 'x-forwarded-for': '127.0.0.1' }, body: { token: tokenObj.token } };
    const res2 = crearMockRes();
    await welcomeVerifyHandler(req2, res2);
    assert.equal(res2.statusCode, 400, 'Token quemado debe retornar 400');
    assert.equal(res2.payload?.ok, false);
    assert.match(res2.payload?.error, /USADO|EXPIRADO|INVALIDO/);
  });

  it('6. Debe rechazar un nuevo reclamo si el dispositivo ya fue registrado', async () => {
    const rand = Math.floor(1000000 + Math.random() * 9000000);
    const celular1 = '317' + rand;
    const email1 = `dispositivo.claimed1.${rand}@origgo.online`;
    const deviceId = 'dev_smoke_double_' + rand;

    // Registrar y verificar el primer reclamo para ese deviceId
    const tokenObj = await db.createWelcomeVerificationToken(celular1, email1, deviceId, 60);
    const reqVer = { method: 'POST', headers: { 'x-forwarded-for': '127.0.0.1' }, body: { token: tokenObj.token } };
    await welcomeVerifyHandler(reqVer, crearMockRes());

    // Intentar reclamar de nuevo con el mismo deviceId y otro número
    const celular2 = '318' + rand;
    const email2 = `dispositivo.claimed2.${rand}@origgo.online`;
    const reqReclamo2 = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { celular: celular2, email: email2, deviceId, lang: 'es' }
    };
    const resReclamo2 = crearMockRes();

    await welcomeCreditHandler(reqReclamo2, resReclamo2);
    assert.equal(resReclamo2.statusCode, 409, 'Debe responder 409 conflicto si el deviceId ya reclamó');
    assert.equal(resReclamo2.payload?.alreadyClaimed, true);
  });

  it('7. Debe reconocer al usuario existente con créditos disponibles y entregar enlace HTTP 200 sin bloquear con 409', async () => {
    const rand = Math.floor(1000000 + Math.random() * 9000000);
    const celular = '319' + rand;
    const email = `usuario.existente.${rand}@origgo.online`;
    const deviceId = 'dev_smoke_existing_' + rand;

    // Crear usuario con 1 crédito previo
    await db.addCredits(celular, 1, 'HNT-9999', null, email);
    await db.updateUserPreferences(celular, { welcomeCreditClaimed: true });

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { celular, email, deviceId, lang: 'es' }
    };
    const res = crearMockRes();

    await welcomeCreditHandler(req, res);
    assert.equal(res.statusCode, 200, 'Debe retornar HTTP 200 para usuario con créditos');
    assert.equal(res.payload?.ok, true);
    assert.equal(res.payload?.existingAccountWithCredits, true);
    assert.equal(res.payload?.credits, 1);
  });
});
