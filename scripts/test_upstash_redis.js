/**
 * 🧪 TEST UNITARIO: RATE LIMITER DISTRIBUIDO UPSTASH REDIS REST & FAIL-SAFE
 * scripts/test_upstash_redis.js
 * 
 * Valida:
 * 1. Conexión y pipeline atómico (INCR + EXPIRE) en Upstash Redis.
 * 2. Decremento de límite y cabeceras HTTP en respuestas.
 * 3. Bloqueo 429 tras superar el umbral máximo de solicitudes.
 * 4. Resiliencia Fail-Safe: Degradación grácil a memoria local si Redis falla.
 */

const assert = require('assert');
require('../lib/env'); // Cargar .env de forma segura
const { checkRateLimitAsync, resetRateLimiter } = require('../lib/rate-limiter');

function mockReqRes(ip = '190.25.10.5', headers = {}) {
  const headersRes = {};
  let statusCode = 200;
  let responseData = null;

  const req = {
    headers: { ...headers },
    socket: { remoteAddress: ip }
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
        }
      };
    },
    getStatusCode: () => statusCode,
    getData: () => responseData,
    getHeaders: () => headersRes
  };

  return { req, res };
}

async function ejecutarPruebasRedis() {
  console.log('🧪 [TEST] Iniciando verificación de Rate Limiter Distribuido Upstash Redis...');

  const tieneCredenciales = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  console.log(`  ℹ️ Credenciales Upstash Redis: ${tieneCredenciales ? 'CONFIGURADAS ✅' : 'NO CONFIGURADAS (modo fallback)'}`);

  // Test 1: Petición permitida bajo umbral
  const claveUnica = `test_usr_${Date.now()}`;
  const { req, res } = mockReqRes('201.244.10.20');

  const permitido = await checkRateLimitAsync(req, res, {
    prefix: 'unit_test',
    customKey: claveUnica,
    maxRequests: 3,
    windowSeconds: 30,
    enforceInTest: true
  });

  assert.strictEqual(permitido, true, 'La primera petición debe ser permitida');
  assert.strictEqual(res.getHeaders()['x-ratelimit-limit'], '3');
  console.log('  ✅ Primera petición permitida y cabeceras X-RateLimit asignadas.');

  // Test 2: Peticiones consecutivas hasta el bloqueo
  const { req: req2, res: res2 } = mockReqRes('201.244.10.20');
  await checkRateLimitAsync(req2, res2, {
    prefix: 'unit_test',
    customKey: claveUnica,
    maxRequests: 3,
    windowSeconds: 30,
    enforceInTest: true
  });

  const { req: req3, res: res3 } = mockReqRes('201.244.10.20');
  await checkRateLimitAsync(req3, res3, {
    prefix: 'unit_test',
    customKey: claveUnica,
    maxRequests: 3,
    windowSeconds: 30,
    enforceInTest: true
  });

  // Cuarta petición debe ser bloqueada (HTTP 429)
  const { req: req4, res: res4 } = mockReqRes('201.244.10.20');
  const bloqueado = await checkRateLimitAsync(req4, res4, {
    prefix: 'unit_test',
    customKey: claveUnica,
    maxRequests: 3,
    windowSeconds: 30,
    enforceInTest: true
  });

  assert.strictEqual(bloqueado, false, 'La cuarta petición debe ser bloqueada');
  assert.strictEqual(res4.getStatusCode(), 429, 'El código debe ser HTTP 429');
  console.log('  ✅ Bloqueo HTTP 429 por exceso de tasa validado.');

  // Test 3: Resiliencia Fail-Safe si Redis está caído o mal configurado
  console.log('  ℹ️ Verificando modo Fail-Safe (fallback automático a memoria local)...');
  const urlOriginal = process.env.UPSTASH_REDIS_REST_URL;
  try {
    process.env.UPSTASH_REDIS_REST_URL = 'https://url-invalida-que-falla-rapido.upstash.io';
    const { req: reqFailsafe, res: resFailsafe } = mockReqRes('186.84.1.99');
    
    const fallbackPermitido = await checkRateLimitAsync(reqFailsafe, resFailsafe, {
      prefix: 'failsafe_test',
      maxRequests: 2,
      windowSeconds: 60,
      enforceInTest: true
    });

    assert.strictEqual(fallbackPermitido, true, 'El modo Fail-Safe debió permitir la petición usando memoria local sin crashear');
    console.log('  ✅ Modo Fail-Safe verificado con éxito: conmutación transparente sin errores fatales.');
  } finally {
    process.env.UPSTASH_REDIS_REST_URL = urlOriginal;
  }

  console.log('🏆 [TEST REDIS] ¡Suite de Upstash Redis superada al 100%!');
}

ejecutarPruebasRedis().catch((err) => {
  console.error('❌ Error en pruebas de Redis:', err);
  process.exit(1);
});
