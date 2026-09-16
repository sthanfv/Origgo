/**
 * 🛡️ SUITE DE PRUEBAS: DESAFÍO ANTI-FUERZA BRUTA INVISIBLE (PoW / Turnstile)
 * tests/anti_bruteforce.test.js
 * 
 * Valida de forma automatizada:
 * 1. Emisión determinista y firma HMAC de desafíos Proof-of-Work (PoW).
 * 2. Resolución matemática y verificación estricta de nonces SHA-256.
 * 3. Rechazo ante nonces insuficientes o matemáticamente erróneos.
 * 4. Detección y rechazo de firmas alteradas o retos adulterados.
 * 5. Protección ante retos expirados fuera de la ventana de vigencia.
 * 6. Mitigación de ataques de reproducción (Replay Attacks).
 * 7. Endpoint GET /api/auth/challenge emitiendo retos válidos.
 * 8. Bloqueo en POST /api/auth/session ante credenciales sin desafío (HTTP 403).
 * 9. Desbloqueo exitoso de sesión con PIN ante credenciales válidas y PoW resuelto.
 */

process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  generarDesafioPoW,
  verificarDesafioPoW,
  verificarDesafioSeguridad
} = require('../lib/challenge');
const { requireEnv } = require('../lib/env');

const JWT_SECRET = requireEnv('JWT_SECRET', {
  testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232'
});

// Helper de prueba para resolver el desafío PoW por fuerza bruta controlada
function resolverPoWLocal(challenge) {
  const dif = challenge.dificultad || 3;
  const prefijo = '0'.repeat(dif);
  let nonce = 0;
  while (nonce < 500000) {
    const hash = crypto.createHash('sha256').update(`${challenge.salt}:${nonce}`).digest('hex');
    if (hash.startsWith(prefijo)) {
      return nonce;
    }
    nonce++;
  }
  return 0;
}

describe('🛡️ Escudo Anti-Fuerza Bruta: Proof-of-Work Criptográfico y Sesión Segura', () => {
  it('generarDesafioPoW debe crear un desafío firmado con HMAC-SHA256 y parámetros temporales', () => {
    const desafio = generarDesafioPoW(JWT_SECRET, 3, 300);
    assert.ok(desafio.salt && desafio.salt.length === 32, 'Salt debe ser de 16 bytes (32 hex)');
    assert.equal(desafio.dificultad, 3);
    assert.ok(desafio.timestamp <= Date.now());
    assert.ok(desafio.expira > desafio.timestamp);
    assert.ok(desafio.signature && desafio.signature.length === 64, 'Firma HMAC de 32 bytes (64 hex)');
  });

  it('verificarDesafioPoW debe aprobar una solución matemática legítima', () => {
    const desafio = generarDesafioPoW(JWT_SECRET, 3, 300);
    const nonce = resolverPoWLocal(desafio);
    const params = { ...desafio, nonce };

    const resultado = verificarDesafioPoW(params, JWT_SECRET);
    assert.equal(resultado.valido, true, 'Solución válida debe ser aprobada');
  });

  it('verificarDesafioPoW debe rechazar si el nonce no satisface la dificultad requerida', () => {
    const desafio = generarDesafioPoW(JWT_SECRET, 4, 300);
    // Un nonce arbitrario no cumplirá 4 ceros hex casi con total certeza
    const params = { ...desafio, nonce: 12345 };

    const hash = crypto.createHash('sha256').update(`${desafio.salt}:12345`).digest('hex');
    if (!hash.startsWith('0000')) {
      const resultado = verificarDesafioPoW(params, JWT_SECRET);
      assert.equal(resultado.valido, false);
      assert.equal(resultado.razon, 'PRUEBA_MATEMATICA_INSUFICIENTE');
    }
  });

  it('verificarDesafioPoW debe rechazar firmas HMAC manipuladas', () => {
    const desafio = generarDesafioPoW(JWT_SECRET, 3, 300);
    const nonce = resolverPoWLocal(desafio);
    const sigAlterada = desafio.signature.slice(0, -1) + (desafio.signature.slice(-1) === 'a' ? 'b' : 'a');
    const params = { ...desafio, nonce, signature: sigAlterada };

    const resultado = verificarDesafioPoW(params, JWT_SECRET);
    assert.equal(resultado.valido, false);
    assert.equal(resultado.razon, 'FIRMA_DESAFIO_INVALIDA');
  });

  it('verificarDesafioPoW debe rechazar desafíos expirados en el tiempo', () => {
    const desafioExpirado = generarDesafioPoW(JWT_SECRET, 2, -10); // Expira en el pasado
    const nonce = resolverPoWLocal(desafioExpirado);
    const params = { ...desafioExpirado, nonce };

    const resultado = verificarDesafioPoW(params, JWT_SECRET);
    assert.equal(resultado.valido, false);
    assert.equal(resultado.razon, 'DESAFIO_EXPIRADO');
  });

  it('verificarDesafioPoW debe mitigar ataques de repetición (Replay Attacks)', () => {
    const desafio = generarDesafioPoW(JWT_SECRET, 3, 300);
    const nonce = resolverPoWLocal(desafio);
    const params = { ...desafio, nonce };

    const primerCanje = verificarDesafioPoW(params, JWT_SECRET);
    assert.equal(primerCanje.valido, true);

    const segundoCanje = verificarDesafioPoW(params, JWT_SECRET);
    assert.equal(segundoCanje.valido, false, 'No debe permitir reutilizar el mismo desafío');
    assert.equal(segundoCanje.razon, 'DESAFIO_YA_UTILIZADO');
  });

  it('GET /api/auth/challenge debe emitir un desafío de seguridad accesible', async () => {
    const challengeHandler = require('../lib/auth/challenge');
    let statusCode = 0;
    let resData = null;
    const req = { method: 'GET', headers: {} };
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { resData = d; return this; },
      setHeader() { return this; },
      end() { return this; }
    };

    await challengeHandler(req, res);
    assert.equal(statusCode, 200);
    assert.equal(resData.ok, true);
    assert.ok(resData.challenge && resData.challenge.salt);
  });

  it('POST /api/auth/session debe rechazar con HTTP 403 login con PIN que presente desafío inválido', async () => {
    const sessionHandler = require('../lib/auth/session');
    const db = require('../lib/db');

    const testPhone = '3199998811';
    await db.addCredits(testPhone, 2, '5678');

    const req = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        celular: testPhone,
        pin: '5678',
        securityChallenge: {
          salt: 'aabbccddeeff00112233445566778899',
          timestamp: Date.now(),
          expira: Date.now() + 300000,
          dificultad: 3,
          signature: '0000000000000000000000000000000000000000000000000000000000000000',
          nonce: 999
        }
      }
    };

    let statusCode = 0;
    let resData = null;
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { resData = d; return this; },
      setHeader() { return this; },
      end() { return this; }
    };

    await sessionHandler(req, res);
    assert.equal(statusCode, 403);
    assert.equal(resData.ok, false);
    assert.equal(resData.error, 'DESAFIO_SEGURIDAD_FALLIDO');
  });

  it('POST /api/auth/session debe autenticar exitosamente con credenciales y PoW resuelto', async () => {
    const sessionHandler = require('../lib/auth/session');
    const db = require('../lib/db');

    const testPhone = '3199998822';
    await db.addCredits(testPhone, 3, '4321');

    const desafio = generarDesafioPoW(JWT_SECRET, 3, 300);
    const nonce = resolverPoWLocal(desafio);

    const req = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        celular: testPhone,
        pin: '4321',
        securityChallenge: {
          ...desafio,
          nonce
        }
      }
    };

    let statusCode = 0;
    let resData = null;
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { resData = d; return this; },
      setHeader() { return this; },
      end() { return this; }
    };

    await sessionHandler(req, res);
    assert.equal(statusCode, 200);
    assert.equal(resData.ok, true);
    assert.ok(resData.token, 'Debe emitir token JWT');
    assert.equal(resData.user.phone, testPhone);
  });
});
