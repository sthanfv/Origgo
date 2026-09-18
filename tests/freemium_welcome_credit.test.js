/**
 * 🧪 PRUEBAS UNITARIAS: MODELO FREEMIUM BLINDADO CONTRA ATAQUES SYBIL
 * tests/freemium_welcome_credit.test.js
 * 
 * Verifica de forma rigurosa las 3 barreras de defensa en profundidad:
 * 1. Doble Opt-In Obligatorio: Solicitud inicial devuelve pendingVerification = true sin emitir crédito inmediato ni JWT.
 * 2. Verificación y Acreditación Atómica: /api/auth/welcome-verify quema el token, entrega 1 crédito y emite JWT firmado.
 * 3. Prevención de Reutilización: Un token ya consumido es rechazado (TOKEN_YA_USADO).
 * 4. Barrera de Correo Canonizado: Rechazo de correos duplicados con alias o puntos.
 * 5. Filtro de Dominios Desechables: Rechazo de correos temporales (@tempmail.com, @yopmail.com, etc.).
 * 6. Barrera de Dispositivo (Hardware ID): Rechazo de intentos desde un deviceId que ya reclamó.
 * 7. Barrera de Celular Móvil (3XX): Rechazo de números fijos y aceptación polimórfica (celular/phone).
 * 8. Blindaje Anti-Inyección XSS: Rechazo de correos con caracteres sospechosos.
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

describe('🎁 Suite Freemium Anti-Sybil — 3 Barreras y Doble Opt-In', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('1. Debe solicitar confirmación (Doble Opt-In) sin otorgar crédito directo ni JWT', async () => {
    const celular = '310' + Math.floor(1000000 + Math.random() * 9000000);
    const email = `test.optin.${Date.now()}@origgo.online`;
    const deviceId = 'dev_fingerprint_' + Math.random().toString(36).substring(2, 15);

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { celular, email, deviceId, lang: 'es' }
    };
    const res = crearMockRes();

    await welcomeCreditHandler(req, res);

    assert.equal(res.statusCode, 200, 'Debe responder HTTP 200');
    assert.equal(res.payload?.ok, true);
    assert.equal(res.payload?.pendingVerification, true, 'Debe quedar pendiente de verificación');
    assert.equal(res.payload?.token, undefined, 'NO debe emitir token JWT antes de verificar correo');
  });

  it('2. Debe verificar token de correo, entregar 1 crédito, registrar dispositivo y emitir JWT', async () => {
    const celular = '311' + Math.floor(1000000 + Math.random() * 9000000);
    const email = `test.verify.${Date.now()}@origgo.online`;
    const deviceId = 'dev_fingerprint_ver_' + Math.random().toString(36).substring(2, 15);

    const tokenObj = await db.createWelcomeVerificationToken(celular, email, deviceId, 60);

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { token: tokenObj.token, lang: 'es' }
    };
    const res = crearMockRes();

    await welcomeVerifyHandler(req, res);

    assert.equal(res.statusCode, 200, 'Debe responder HTTP 200 tras verificar');
    assert.equal(res.payload?.ok, true);
    assert.equal(res.payload?.user?.credits, 1, 'Debe acreditar exactamente 1 crédito');
    assert.equal(res.payload?.user?.phone, celular);
    assert.ok(res.payload?.token, 'Debe retornar un token JWT de sesión');

    const decoded = verifyJwt(res.payload.token, JWT_SECRET);
    assert.ok(decoded, 'El token debe ser un JWT válido');
    assert.equal(decoded.phone, celular);
    assert.equal(decoded.credits, 1);

    const isDevClaimed = await db.isDeviceClaimed(deviceId);
    assert.equal(isDevClaimed, true, 'El deviceId debe estar marcado como reclamado');

    const isMailClaimed = await db.isEmailClaimed(email);
    assert.equal(isMailClaimed, true, 'El email debe estar marcado como reclamado');
  });

  it('3. Debe rechazar con HTTP 400 TOKEN_YA_USADO al intentar reutilizar el mismo enlace', async () => {
    const celular = '312' + Math.floor(1000000 + Math.random() * 9000000);
    const email = `test.reuse.${Date.now()}@origgo.online`;
    const deviceId = 'dev_fingerprint_reuse_' + Math.random().toString(36).substring(2, 15);

    const tokenObj = await db.createWelcomeVerificationToken(celular, email, deviceId, 60);

    const req1 = { method: 'POST', headers: { 'x-forwarded-for': '127.0.0.1' }, body: { token: tokenObj.token } };
    const res1 = crearMockRes();
    await welcomeVerifyHandler(req1, res1);
    assert.equal(res1.statusCode, 200);

    const req2 = { method: 'POST', headers: { 'x-forwarded-for': '127.0.0.1' }, body: { token: tokenObj.token } };
    const res2 = crearMockRes();
    await welcomeVerifyHandler(req2, res2);

    assert.equal(res2.statusCode, 400);
    assert.equal(res2.payload?.error, 'TOKEN_YA_USADO');
  });

  it('4. Barrera Device Fingerprint: Debe rechazar con HTTP 409 DISPOSITIVO_YA_RECLAMADO si el hardware ya reclamó', async () => {
    const celular1 = '313' + Math.floor(1000000 + Math.random() * 9000000);
    const celular2 = '314' + Math.floor(1000000 + Math.random() * 9000000);
    const deviceIdCompartido = 'hardware_id_fijo_' + Date.now();

    const tkn = await db.createWelcomeVerificationToken(celular1, `correo1.${Date.now()}@origgo.online`, deviceIdCompartido);
    const verifyRes = crearMockRes();
    await welcomeVerifyHandler({ method: 'POST', headers: { 'x-forwarded-for': '127.0.0.1' }, body: { token: tkn.token } }, verifyRes);
    assert.equal(verifyRes.statusCode, 200);

    const reqFraud = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { celular: celular2, email: `correo2.${Date.now()}@origgo.online`, deviceId: deviceIdCompartido }
    };
    const resFraud = crearMockRes();
    await welcomeCreditHandler(reqFraud, resFraud);

    assert.equal(resFraud.statusCode, 409, 'Debe rechazar con 409 conflicto');
    assert.equal(resFraud.payload?.error, 'DISPOSITIVO_YA_RECLAMADO');
  });

  it('5. Barrera Email Canonizado: Debe rechazar alias de Gmail (+algo o puntos) si el correo ya reclamó', async () => {
    const baseEmail = `usuario.prueba.${Date.now()}@gmail.com`;
    const aliasEmail = baseEmail.replace('@gmail.com', '+ataque123@gmail.com');
    const cel1 = '315' + Math.floor(1000000 + Math.random() * 9000000);
    const cel2 = '316' + Math.floor(1000000 + Math.random() * 9000000);

    const tkn = await db.createWelcomeVerificationToken(cel1, baseEmail, 'dev_1_' + Date.now());
    const verifyRes = crearMockRes();
    await welcomeVerifyHandler({ method: 'POST', headers: { 'x-forwarded-for': '127.0.0.1' }, body: { token: tkn.token } }, verifyRes);
    assert.equal(verifyRes.statusCode, 200);

    const reqAlias = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { celular: cel2, email: aliasEmail, deviceId: 'dev_2_' + Date.now() }
    };
    const resAlias = crearMockRes();
    await welcomeCreditHandler(reqAlias, resAlias);

    assert.equal(resAlias.statusCode, 409);
    assert.equal(resAlias.payload?.error, 'EMAIL_YA_RECLAMADO');
  });

  it('6. Barrera Filtro de Desechables: Debe rechazar dominios temporales (@tempmail, @yopmail, etc.)', async () => {
    const dominiosDesechables = [
      'spammer@tempmail.com',
      'fraud@yopmail.com',
      'fake@10minutemail.com',
      'burner@mailinator.com',
      'throwaway@guerrillamail.com'
    ];

    for (const correoTemporal of dominiosDesechables) {
      const celular = '317' + Math.floor(1000000 + Math.random() * 9000000);
      const req = {
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
        body: { celular, email: correoTemporal, deviceId: 'dev_temp_' + Math.random().toString(36).substring(2, 10) }
      };
      const res = crearMockRes();
      await welcomeCreditHandler(req, res);

      assert.equal(res.statusCode, 400, `Debe rechazar el correo temporal: ${correoTemporal}`);
      assert.equal(res.payload?.error, 'VALIDACION_FALLIDA');
    }
  });

  it('7. Debe rechazar números inválidos que no sean celulares móviles colombianos (3XX)', async () => {
    const reqInvalido = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { celular: '6012345678', email: 'fijo@bogota.com' }
    };
    const res = crearMockRes();

    await welcomeCreditHandler(reqInvalido, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.payload?.error, 'VALIDACION_FALLIDA');
  });

  it('8. Debe aceptar el campo polimórfico "phone" y procesar exitosamente', async () => {
    const phone = '318' + Math.floor(1000000 + Math.random() * 9000000);
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
    assert.equal(res.payload?.pendingVerification, true);
  });

  it('9. Debe rechazar correos con caracteres sospechosos de inyección XSS o scripts', async () => {
    const celular = '319' + Math.floor(1000000 + Math.random() * 9000000);
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
