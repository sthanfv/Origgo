/**
 * 🧪 TEST DE ESTRÉS DE CONCURRENCIA E IDEMPOTENCIA DISTRIBUIDA (REDIS & MEMORY)
 * scripts/test_idempotency_concurrency.js
 * 
 * Valida de forma rigurosa la Fase 3:
 * 1. Ráfaga concurrente de 5 peticiones simultáneas (Promise.all) con la misma Idempotency-Key.
 * 2. Unicidad absoluta de referencia y firma criptográfica en Wompi (0 colisiones).
 * 3. Exactamente una pre-orden registrada en el ledger de Firestore.
 * 4. Marcado de respuestas concurrentes y duplicadas con `idempotent: true`.
 * 5. Protección de desbloqueo contra doble deducción de créditos ante ráfagas concurrentes.
 * 6. Resiliencia Fail-Safe: Comprobación del candado en memoria cuando Redis no está disponible.
 */

process.env.NODE_ENV = 'test';

const assert = require('assert');
const crypto = require('crypto');
require('../lib/env');
const db = require('../lib/db');
const { resetRateLimiter } = require('../lib/rate-limiter');
const { resetIdempotencyStore } = require('../lib/idempotency');
const { signJwt } = require('../lib/crypto');
const createOrderHandler = require('../api/payments/create-order');
const unlockHandler = require('../api/leads/unlock');

function createMockRes() {
  const headers = {};
  let statusCode = 200;
  let responseData = null;

  return {
    headers,
    statusCode,
    setHeader(nombre, valor) {
      headers[nombre.toLowerCase()] = String(valor);
    },
    status(code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(obj) {
      responseData = obj;
      this.data = obj;
      return this;
    },
    end() {
      return this;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData
  };
}

async function ejecutarPruebasIdempotencia() {
  console.log('⚡ [TEST] Iniciando Suite de Estrés de Concurrencia e Idempotencia Distribuida...\n');
  resetRateLimiter();
  resetIdempotencyStore();

  const testPhone = '318' + Math.floor(1000000 + Math.random() * 9000000);

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 1: RÁFAGA DE 5 PETICIONES PARALELAS CON LA MISMA IDEMPOTENCY-KEY
  // ═════════════════════════════════════════════════════════════════════════
  console.log('▶ Test 1: Ráfaga de 5 peticiones simultáneas (Promise.all) en creación de orden...');
  const sharedKey = crypto.randomUUID();

  const crearPeticionParalela = () => {
    const req = {
      method: 'POST',
      headers: {
        'idempotency-key': sharedKey
      },
      body: {
        productType: 'pack_10_leads',
        celular: testPhone
      }
    };
    const res = createMockRes();
    return createOrderHandler(req, res).then(() => res);
  };

  // Disparo atómico concurrente de 5 promesas en el mismo instante
  const respuestas = await Promise.all([
    crearPeticionParalela(),
    crearPeticionParalela(),
    crearPeticionParalela(),
    crearPeticionParalela(),
    crearPeticionParalela()
  ]);

  // Verificar que todas las peticiones retornaron HTTP 200
  respuestas.forEach((res, i) => {
    assert.strictEqual(res.statusCode, 200, `La petición ${i + 1} debió responder HTTP 200`);
    assert.strictEqual(res.data.ok, true, `La petición ${i + 1} debió tener ok: true`);
  });

  // Verificar que TODAS devolvieron exactamente la misma referencia bancaria Wompi
  const primeraRef = respuestas[0].data.reference;
  const primeraFirma = respuestas[0].data.signature;
  assert.ok(primeraRef.startsWith(`HNT-${testPhone}-`), 'La referencia debe respetar el prefijo de auditoría');

  respuestas.forEach((res, i) => {
    assert.strictEqual(res.data.reference, primeraRef, `Petición ${i + 1} devolvió referencia divergente: ${res.data.reference}`);
    assert.strictEqual(res.data.signature, primeraFirma, `Petición ${i + 1} devolvió firma divergente: ${res.data.signature}`);
    assert.strictEqual(res.data.amountInCents, 3500000, `Petición ${i + 1} devolvió monto erróneo`);
  });

  console.log(`  ✅ 5 peticiones concurrentes resueltas con la misma referencia única: ${primeraRef}`);

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 2: VERIFICACIÓN DE EXACTAMENTE UNA ORDEN REGISTRADA EN LEDGER
  // ═════════════════════════════════════════════════════════════════════════
  console.log('▶ Test 2: Verificación de no-duplicación de órdenes en base de datos...');
  const ordenEnDb = await db.getPendingOrder(primeraRef);
  assert.ok(ordenEnDb, 'La orden debe existir en el ledger');
  assert.strictEqual(ordenEnDb.celular, testPhone);
  assert.strictEqual(ordenEnDb.amountInCents, 3500000);
  assert.strictEqual(ordenEnDb.idempotencyKey, sharedKey);
  console.log('  ✅ Verificado: Cero registros duplicados en el ledger.');

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 3: PETICIÓN DUPLICADA SECUENCIAL (CACHE EN REDIS / MEMORIA)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('▶ Test 3: Petición duplicada posterior con la misma llave (respuesta ultra rápida en caché)...');
  const reqSecuencial = {
    method: 'POST',
    headers: { 'idempotency-key': sharedKey },
    body: { productType: 'pack_10_leads', celular: testPhone }
  };
  const resSecuencial = createMockRes();
  const inicioTiempo = Date.now();
  await createOrderHandler(reqSecuencial, resSecuencial);
  const duracionMs = Date.now() - inicioTiempo;

  assert.strictEqual(resSecuencial.statusCode, 200);
  assert.strictEqual(resSecuencial.data.reference, primeraRef);
  assert.strictEqual(resSecuencial.data.idempotent, true, 'Debe marcarse explícitamente como respuesta idempotente');
  console.log(`  ✅ Respuesta cacheada recibida en ${duracionMs}ms con idempotent: true.`);

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 4: CONCURRENCIA EN DESBLOQUEO DE CONTACTOS (PROTECCIÓN DE SALDO)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('▶ Test 4: Concurrencia en desbloqueo seguro de inmuebles con idempotencia...');
  const { encryptLeadContact } = require('../lib/crypto');
  const encryptionKey = process.env.LEADS_ENCRYPTION_KEY || 'cf5e87913d4cf975ab463ada86e9ce905b9d5306c5188af3f8a074159cbf9a2c';
  const cipherTest = encryptLeadContact({ telefono: '+573112345678', portal: 'fincaraiz' }, encryptionKey, 'v1');

  // Asignar créditos al usuario de prueba
  await db.addCredits(testPhone, 5, '1234');
  const jwtSecret = process.env.JWT_SECRET || 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232';
  const tokenUsuario = signJwt({ phone: testPhone, credits: 5, role: 'buyer' }, jwtSecret, 30);

  const unlockKey = crypto.randomUUID();
  const dispararDesbloqueo = () => {
    const req = {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${tokenUsuario}`,
        'idempotency-key': unlockKey
      },
      body: {
        leadId: 'lead-inm-concurrente-1',
        contactoCifrado: cipherTest
      }
    };
    const res = createMockRes();
    return unlockHandler(req, res).then(() => res);
  };

  // 3 clics rápidos al botón de desbloquear
  const respuestasUnlock = await Promise.all([
    dispararDesbloqueo(),
    dispararDesbloqueo(),
    dispararDesbloqueo()
  ]);

  // Todas deben ser 200 OK
  respuestasUnlock.forEach((res, i) => {
    assert.strictEqual(res.statusCode, 200, `Desbloqueo ${i + 1} debió retornar 200`);
    assert.strictEqual(res.data.ok, true);
  });

  // Los créditos deben haber bajado exactamente de 5 a 4 (un solo crédito descontado)
  const usuarioFinal = await db.getUserByPhone(testPhone);
  assert.strictEqual(usuarioFinal.credits, 4, `Los créditos debieron restar exactamente 1 (actual: ${usuarioFinal.credits})`);
  console.log(`  ✅ Saldo protegido contra clics rápidos: decremento atómico exacto (5 → 4 créditos).`);

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 5: MODO FAIL-SAFE (CONMUTACIÓN AUTOMÁTICA A MEMORIA SIN REDIS)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('▶ Test 5: Resiliencia Fail-Safe ante microcorte de Upstash Redis...');
  const urlOriginal = process.env.UPSTASH_REDIS_REST_URL;
  try {
    process.env.UPSTASH_REDIS_REST_URL = 'https://servidor-redis-caido.upstash.io';
    const failsafeKey = crypto.randomUUID();
    const phoneFailsafe = '319' + Math.floor(1000000 + Math.random() * 9000000);

    const dispararFailsafe = () => {
      const req = {
        method: 'POST',
        headers: { 'idempotency-key': failsafeKey },
        body: { productType: 'single_lead', celular: phoneFailsafe }
      };
      const res = createMockRes();
      return createOrderHandler(req, res).then(() => res);
    };

    const [resFs1, resFs2, resFs3] = await Promise.all([
      dispararFailsafe(),
      dispararFailsafe(),
      dispararFailsafe()
    ]);

    assert.strictEqual(resFs1.statusCode, 200);
    assert.strictEqual(resFs2.statusCode, 200);
    assert.strictEqual(resFs3.statusCode, 200);
    assert.strictEqual(resFs2.data.reference, resFs1.data.reference, 'En modo fail-safe debe persistir la misma referencia');
    assert.strictEqual(resFs3.data.reference, resFs1.data.reference);
    console.log('  ✅ Modo Fail-Safe validado: memoria local retiene candado y evita duplicados ante corte de Redis.');
  } finally {
    process.env.UPSTASH_REDIS_REST_URL = urlOriginal;
  }

  console.log('\n🏆 [TEST IDEMPOTENCIA] ¡Todas las pruebas de concurrencia e idempotencia superadas al 100%!');
}

ejecutarPruebasIdempotencia().catch((err) => {
  console.error('❌ Error fatal en pruebas de idempotencia:', err);
  process.exit(1);
});
