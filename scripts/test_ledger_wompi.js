/**
 * 🧪 TEST UNITARIO DE INTEGRACIÓN — WOMPI, LEDGER DE CRÉDITOS Y AES-256
 * Hunter Pro Intelligence — Suite Automatizada DevSecOps
 */

const assert = require('assert');
const crypto = require('crypto');
const db = require('../api/lib/db');
const { 
  encryptLeadContact, 
  decryptLeadContact, 
  signJwt, 
  verifyJwt, 
  generatePin 
} = require('../api/lib/crypto');

const webhookHandler = require('../api/payments/webhook-wompi');
const createOrderHandler = require('../api/payments/create-order');
const unlockHandler = require('../api/leads/unlock');
const sessionHandler = require('../api/auth/session');

// Mock simple de req y res para probar handlers de Vercel en Node local
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    setHeader(key, val) { this.headers[key] = val; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.data = obj; return this; },
    end() { return this; }
  };
  return res;
}

async function runTests() {
  console.log('🧪 [TEST] Iniciando Suite de Verificación de Pagos y Criptografía...\n');

  const encryptionKey = process.env.LEADS_ENCRYPTION_KEY || 'cf5e87913d4cf975ab463ada86e9ce905b9d5306c5188af3f8a074159cbf9a2c';
  const jwtSecret = process.env.JWT_SECRET || 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232';

  // TEST 1: Cifrado y Descifrado AES-256-GCM
  console.log('▶ Test 1: Cifrado y descifrado simétrico AES-256-GCM...');
  const contactoOriginal = {
    telefono: '+573145678901',
    enlace: 'https://fincaraiz.com.co/inmueble/999999',
    portal: 'fincaraiz'
  };
  const cipherText = encryptLeadContact(contactoOriginal, encryptionKey);
  assert.ok(cipherText.includes(':'), 'El texto cifrado debe tener formato iv:tag:cipher');
  
  const decrypted = decryptLeadContact(cipherText, encryptionKey);
  assert.strictEqual(decrypted.telefono, contactoOriginal.telefono);
  assert.strictEqual(decrypted.enlace, contactoOriginal.enlace);
  assert.strictEqual(decrypted.portal, contactoOriginal.portal);
  console.log('  ✅ Cifrado/Descifrado AES-256-GCM verificado con éxito.');

  // TEST 2: Firma y Verificación de JWT con timingSafeEqual
  console.log('▶ Test 2: Token JWT firmado y verificado...');
  const token = signJwt({ phone: '3001234567', role: 'buyer' }, jwtSecret, 30);
  assert.ok(token && token.split('.').length === 3, 'El token debe tener 3 partes separadas por punto');

  const verified = verifyJwt(token, jwtSecret);
  assert.strictEqual(verified.phone, '3001234567');
  
  // Alterar un carácter de la firma
  const tokenCorrupto = token.slice(0, -2) + 'XX';
  const rejected = verifyJwt(tokenCorrupto, jwtSecret);
  assert.strictEqual(rejected, null, 'Un token alterado debe ser rechazado');
  console.log('  ✅ JWT firmado, validado y protección contra alteración verificada.');

  // TEST 3: Crear Orden con Firma Wompi de Integridad
  console.log('▶ Test 3: Generación de orden de pago con firma de integridad SHA-256...');
  const testCelular = '315' + Math.floor(1000000 + Math.random() * 9000000);
  const mockReqOrder = {
    method: 'POST',
    body: {
      productType: 'pack_10_leads',
      celular: testCelular
    }
  };
  const mockResOrder = createMockRes();
  await createOrderHandler(mockReqOrder, mockResOrder);

  assert.strictEqual(mockResOrder.statusCode, 200);
  assert.ok(mockResOrder.data.reference.startsWith('HNT-'));
  assert.strictEqual(mockResOrder.data.amountInCents, 3500000);
  assert.ok(mockResOrder.data.signature.length === 64, 'La firma debe ser SHA256 (64 hex)');
  console.log('  ✅ Orden generada con referencia: ' + mockResOrder.data.reference);

  // TEST 4: Simulación de Webhook Wompi con Firma HMAC Dinámica
  console.log('▶ Test 4: Procesamiento de Webhook Wompi con validación de firma...');
  const testRef = mockResOrder.data.reference;
  const transactionId = 'trx-test-' + Date.now();
  const timestamp = Math.floor(Date.now() / 1000);
  const eventsSecret = process.env.WOMPI_EVENTS_SECRET || 'test_events_secret_hunter_2026';

  const rawData = {
    transaction: {
      id: transactionId,
      reference: testRef,
      amount_in_cents: 3500000,
      status: 'APPROVED',
      payment_method_type: 'CARD'
    }
  };

  // Cadena concatenada en el orden exacto de properties + timestamp + secret
  const concatChain = `${transactionId}${status = 'APPROVED'}${3500000}${timestamp}${eventsSecret}`;
  const checksum = crypto.createHash('sha256').update(concatChain).digest('hex');

  const webhookPayload = {
    event: 'transaction.updated',
    data: rawData,
    timestamp: timestamp,
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum: checksum
    }
  };

  const mockReqWeb = {
    method: 'POST',
    body: webhookPayload
  };
  const mockResWeb = createMockRes();
  await webhookHandler(mockReqWeb, mockResWeb);

  assert.strictEqual(mockResWeb.statusCode, 200);
  assert.strictEqual(mockResWeb.data.ok, true);
  assert.strictEqual(mockResWeb.data.user.credits, 10);
  const userPin = mockResWeb.data.user.pin;
  console.log(`  ✅ Webhook Wompi acreditó 10 créditos a ${testCelular}. PIN asignado: ${userPin}`);

  // TEST 5: Idempotencia en Webhook — El mismo evento no debe sumar créditos dos veces
  console.log('▶ Test 5: Idempotencia de Webhook contra doble acreditación...');
  const mockResWebDuplicate = createMockRes();
  await webhookHandler(mockReqWeb, mockResWebDuplicate);
  assert.strictEqual(mockResWebDuplicate.data.duplicate, true, 'El webhook duplicado debe ser ignorado');

  const userAfterDup = await db.getUserByPhone(testCelular);
  assert.strictEqual(userAfterDup.credits, 10, 'Los créditos deben seguir en 10 (no 20)');
  console.log('  ✅ Idempotencia atómica confirmada: saldo protegido contra reintentos de red.');

  // TEST 6: Inicio de Sesión con WhatsApp y PIN
  console.log('▶ Test 6: Autenticación con WhatsApp + PIN...');
  const mockReqLogin = {
    method: 'POST',
    body: {
      celular: testCelular,
      pin: userPin
    }
  };
  const mockResLogin = createMockRes();
  await sessionHandler(mockReqLogin, mockResLogin);

  assert.strictEqual(mockResLogin.statusCode, 200);
  assert.ok(mockResLogin.data.token, 'Debe retornar un token JWT');
  const userToken = mockResLogin.data.token;
  console.log('  ✅ Autenticación exitosa. Token JWT generado.');

  // TEST 7: Desbloqueo de Inmueble y Descuento de 1 Crédito
  console.log('▶ Test 7: Desbloqueo de Inmueble con deducción de 1 crédito...');
  const mockReqUnlock = {
    method: 'POST',
    headers: {
      authorization: `Bearer ${userToken}`
    },
    body: {
      leadId: 'lead-inm-99',
      contactoCifrado: cipherText
    }
  };
  const mockResUnlock = createMockRes();
  await unlockHandler(mockReqUnlock, mockResUnlock);

  assert.strictEqual(mockResUnlock.statusCode, 200);
  assert.strictEqual(mockResUnlock.data.ok, true);
  assert.strictEqual(mockResUnlock.data.alreadyUnlocked, false);
  assert.strictEqual(mockResUnlock.data.creditsRemaining, 9);
  assert.strictEqual(mockResUnlock.data.contacto.telefono, contactoOriginal.telefono);
  console.log('  ✅ Inmueble desbloqueado: saldo bajó de 10 a 9. Teléfono descifrado en memoria.');

  // TEST 8: Segundo clic sobre el mismo inmueble (Cero Doble Cobro)
  console.log('▶ Test 8: Segundo intento de desbloqueo sobre el mismo inmueble...');
  const mockResUnlock2 = createMockRes();
  await unlockHandler(mockReqUnlock, mockResUnlock2);

  assert.strictEqual(mockResUnlock2.statusCode, 200);
  assert.strictEqual(mockResUnlock2.data.alreadyUnlocked, true);
  assert.strictEqual(mockResUnlock2.data.creditsRemaining, 9, 'El saldo NO debe volver a restar');
  console.log('  ✅ Cero doble cobro verificado: el contacto ya desbloqueado se entrega a costo 0.');

  console.log('\n🏆 [TEST SUITE] ¡Todos los 8 tests de integración pasaron al 100%!');
}

runTests().catch((err) => {
  console.error('\n❌ ERROR EN PRUEBAS:', err);
  process.exit(1);
});
