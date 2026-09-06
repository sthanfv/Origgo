/**
 * 🧪 SUITE DE PRUEBAS UNITARIAS: VALIDACIÓN ESTRICTA (ZOD) Y RATE LIMITING DIARIO
 * Estándar Ecosistema Desmulta — Cobertura DevSecOps
 */

const assert = require('assert');
const { 
  phoneSchema, 
  emailSchema, 
  pinSchema, 
  recoverPinSchema, 
  createOrderSchema, 
  unlockLeadSchema, 
  validateBody 
} = require('../api/lib/validation');
const { checkRateLimit, resetRateLimiter } = require('../api/lib/rate-limiter');

function mockReqRes(ip, body = {}) {
  let statusCode = 200;
  let responseData = null;

  const req = {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    setHeader() {
      return this;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData
  };

  return { req, res };
}

async function ejecutarPruebas() {
  console.log('🧪 [TEST] Iniciando Suite de Validación Zod y Rate Limiting...');

  // 1. Prueba de Esquema Telefónico (10 dígitos en Colombia, iniciando con 3)
  console.log('▶ Test 1: Validación estricta de Celular...');
  assert.strictEqual(phoneSchema.parse('300 123 4567'), '3001234567');
  assert.strictEqual(phoneSchema.parse('+57 315-711-9602'), '3157119602');
  assert.throws(() => phoneSchema.parse('2001234567'), /móvil válido de Colombia/);
  assert.throws(() => phoneSchema.parse('300123'), /exactamente 10 dígitos/);
  assert.throws(() => phoneSchema.parse('abcdefghij'), /exactamente 10 dígitos/);
  console.log('  ✅ Validación telefónica móvil confirmada.');

  // 2. Prueba de Esquema de Correo Electrónico
  console.log('▶ Test 2: Validación estricta de Correo Electrónico...');
  assert.strictEqual(emailSchema.parse('  USUARIO@DOMINIO.COM '), 'usuario@dominio.com');
  assert.throws(() => emailSchema.parse('correo-invalido'), /dirección de correo electrónico válida/);
  assert.throws(() => emailSchema.parse(''), /dirección de correo electrónico válida/);
  console.log('  ✅ Validación y normalización de correo confirmada.');

  // 3. Prueba de Esquema de PIN de Seguridad
  console.log('▶ Test 3: Validación de PIN (HNT-XXXX, HNTXXXX, XXXX)...');
  assert.strictEqual(pinSchema.parse('hnt-7489'), 'HNT-7489');
  assert.strictEqual(pinSchema.parse('hnt7489'), 'HNT7489');
  assert.strictEqual(pinSchema.parse('7489'), '7489');
  assert.throws(() => pinSchema.parse('12'), /formato del PIN es inválido/);
  assert.throws(() => pinSchema.parse('ABCDEFGH'), /formato del PIN es inválido/);
  console.log('  ✅ Tolerancia de formatos de PIN confirmada.');

  // 4. Prueba de Esquema de Creación de Órdenes
  console.log('▶ Test 4: Validación de Creación de Órdenes (Wompi)...');
  const ordenValida = validateBody(createOrderSchema, {
    productType: 'pack_10_leads',
    celular: '3157119602'
  });
  assert.strictEqual(ordenValida.success, true);
  assert.strictEqual(ordenValida.data.celular, '3157119602');

  const ordenInvalida = validateBody(createOrderSchema, {
    productType: 'subscription_city',
    celular: '3157119602'
    // Falta ciudad requerida para este plan
  });
  assert.strictEqual(ordenInvalida.success, false);
  assert.ok(ordenInvalida.message.includes('ciudad'));
  console.log('  ✅ Validación condicional de producto y ciudad confirmada.');

  // 5. Prueba de Desbloqueo de Leads
  console.log('▶ Test 5: Validación de Desbloqueo de Leads...');
  const unlockInvalido = validateBody(unlockLeadSchema, { leadId: '' });
  assert.strictEqual(unlockInvalido.success, false);

  const unlockValido = validateBody(unlockLeadSchema, { leadId: 'lead-bogota-001' });
  assert.strictEqual(unlockValido.success, true);
  console.log('  ✅ Validación de identificadores de lead confirmada.');

  // 6. Prueba de Rate Limiting Diario (3 solicitudes máx por 24 horas)
  console.log('▶ Test 6: Rate Limiting Diario de Recuperación de PIN (3 máx por 24h)...');
  resetRateLimiter();

  const ipTest = '192.168.1.50';
  const emailTest = 'comprador@empresa.com';

  // Tres peticiones permitidas
  for (let i = 1; i <= 3; i++) {
    const { req, res } = mockReqRes(ipTest);
    const permitido = checkRateLimit(req, res, {
      prefix: 'recover_pin_ip',
      maxRequests: 3,
      windowMs: 24 * 60 * 60 * 1000,
      message: 'Límite de recuperaciones alcanzado (máximo 3 por día).'
    });
    assert.strictEqual(permitido, true, `Petición ${i} debió ser permitida`);
  }

  // Cuarta petición debe ser bloqueada con HTTP 429
  const { req: req4, res: res4 } = mockReqRes(ipTest);
  const bloqueado = checkRateLimit(req4, res4, {
    prefix: 'recover_pin_ip',
    maxRequests: 3,
    windowMs: 24 * 60 * 60 * 1000,
    message: 'Límite de recuperaciones alcanzado (máximo 3 por día).'
  });
  assert.strictEqual(bloqueado, false, 'La cuarta petición debió ser bloqueada');
  assert.strictEqual(res4.getStatusCode(), 429, 'El código debe ser HTTP 429');
  assert.ok(res4.getData().message.includes('máximo 3 por día'));
  console.log('  ✅ Límite estricto de 3 peticiones por día verificado.');

  // IP diferente no debe verse afectada
  const { req: reqOtraIp, res: resOtraIp } = mockReqRes('192.168.1.99');
  const permitidoOtraIp = checkRateLimit(reqOtraIp, resOtraIp, {
    prefix: 'recover_pin_ip',
    maxRequests: 3,
    windowMs: 24 * 60 * 60 * 1000
  });
  assert.strictEqual(permitidoOtraIp, true, 'Otra IP no debe verse bloqueada');
  console.log('  ✅ Aislamiento por IP verificado.');

  console.log('🏆 [TEST SUITE] ¡Todas las pruebas unitarias pasaron al 100%!');
}

ejecutarPruebas().catch(err => {
  console.error('❌ Fallo en pruebas:', err);
  process.exit(1);
});
