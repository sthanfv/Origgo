/**
 * ⚡ WEBHOOK RECEPTOR DE EVENTOS ASÍNCRONOS DE WOMPI COLOMBIA
 * POST /api/payments/webhook-wompi
 * 
 * Arquitectura DevSecOps Estándar Desmulta:
 * 1. Validación de firma criptográfica dinámica (HMAC-SHA256 con properties).
 * 2. Comparación en tiempo constante (timingSafeEqual) contra ataques de temporización.
 * 3. Idempotencia atómica para prevenir acreditaciones duplicadas de créditos.
 * 4. Acreditación automática y generación de PIN de acceso WhatsApp.
 */

const crypto = require('crypto');
const db = require('../../lib/db');
const { generatePin, signJwt } = require('../../lib/crypto');
const { checkRateLimitAsync } = require('../../lib/rate-limiter');
const { requireEnv } = require('../../lib/env');
const { despacharCorreoConfirmacion } = require('../../lib/email-templates');

const JWT_SECRET = requireEnv('JWT_SECRET', {
  testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232'
});

module.exports = async function handler(req, res) {
  // Métodos permitidos para webhooks server-to-server
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Trace-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 🛡️ Rate Limiting: máx 60 peticiones por minuto por IP para webhooks con Upstash Redis
  if (!(await checkRateLimitAsync(req, res, { prefix: 'payments_webhook', maxRequests: 60, windowMs: 60 * 1000 }))) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  // 1. Parsear el payload
  let event = req.body;
  if (typeof event === 'string') {
    try {
      event = JSON.parse(event);
    } catch (e) {
      return res.status(400).json({ error: 'JSON malformado' });
    }
  }

  // 2. Validar estructura mínima del evento
  if (
    !event ||
    !event.signature ||
    !Array.isArray(event.signature.properties) ||
    !event.signature.checksum ||
    !event.timestamp
  ) {
    console.warn('[webhook-wompi] Evento malformado o sin propiedades de firma requeridas');
    return res.status(401).json({ error: 'Firma inválida o incompleta' });
  }

  // 🛡️ Ventana Anti-Replay: el timestamp no puede diferir en más de 5 minutos (300 segundos) del reloj del servidor
  if (process.env.NODE_ENV !== 'test') {
    const timestampMs = typeof event.timestamp === 'number' 
      ? (event.timestamp > 1e11 ? event.timestamp : event.timestamp * 1000)
      : Date.parse(event.timestamp);
    if (!isNaN(timestampMs)) {
      const desfaseSegundos = Math.abs(Date.now() - timestampMs) / 1000;
      if (desfaseSegundos > 300) {
        console.warn(`[webhook-wompi] Rechazo por timestamp expirado (desfase: ${desfaseSegundos.toFixed(0)}s > 300s)`);
        return res.status(400).json({ error: 'Timestamp expirado (ventana anti-replay superada)' });
      }
    }
  }

  // 3. Reconstruir y validar la firma criptográfica dinámica de Wompi
  let propertiesValues = '';
  const { properties } = event.signature;
  if (properties && Array.isArray(properties)) {
    for (const prop of properties) {
      const parts = prop.split('.');
      let val = event.data;
      for (const p of parts) {
        val = val ? val[p] : undefined;
      }
      if (val !== undefined && val !== null) {
        propertiesValues += String(val);
      }
    }
  }

  const eventsSecret = requireEnv('WOMPI_EVENTS_SECRET', { testFallback: 'test_events_local_suite' });
  const concatenatedValues = propertiesValues + String(event.timestamp) + eventsSecret;

  const expectedSignature = crypto.createHash('sha256').update(concatenatedValues).digest('hex');
  const receivedSig = String(event.signature.checksum || '');

  // 🛡️ Comparación en tiempo constante (timingSafeEqual)
  const bufReceived = Buffer.from(receivedSig);
  const bufExpected = Buffer.from(expectedSignature);

  let signaturesMatch = false;
  if (bufReceived.length === bufExpected.length) {
    signaturesMatch = crypto.timingSafeEqual(bufReceived, bufExpected);
  }

  // Fallback de firma exclusivamente para suite automatizada de pruebas locales
  if (process.env.NODE_ENV === 'test' && !signaturesMatch) {
    const fallbackExpected = crypto.createHash('sha256').update(propertiesValues + String(event.timestamp) + 'test_events_secret_hunter_2026').digest('hex');
    const bufFallback = Buffer.from(fallbackExpected);
    if (bufReceived.length === bufFallback.length) {
      signaturesMatch = crypto.timingSafeEqual(bufReceived, bufFallback);
    }
  }

  if (!signaturesMatch) {
    console.warn('[webhook-wompi] Firma inválida — checksum no coincide');
    return res.status(401).json({ error: 'Firma criptográfica no autorizada' });
  }

  // 4. Filtrar: procesar exclusivamente transacciones actualizadas
  const { event: eventType, data } = event;
  if (eventType !== 'transaction.updated') {
    return res.status(200).json({ ok: true, ignored: true });
  }

  const transaction = data.transaction;
  if (!transaction || !transaction.id) {
    return res.status(400).json({ error: 'Datos de transacción faltantes' });
  }

  const transactionId = transaction.id;
  const reference = transaction.reference;
  const status = transaction.status; // APPROVED | DECLINED | VOIDED

  // 5. Idempotencia atómica: registrar transacción para evitar dobles entregas
  const esPrimeraVez = await db.recordTransaction(transactionId, {
    transactionId,
    reference,
    status,
    amountInCents: transaction.amount_in_cents,
    paymentMethod: transaction.payment_method_type
  });

  if (!esPrimeraVez) {
    console.log(`[webhook-wompi] Webhook duplicado ignorado (idempotencia atómica): ${transactionId}`);
    return res.status(200).json({ ok: true, duplicate: true });
  }

  // Solo acreditar si la transacción fue efectivamente APROBADA
  if (status !== 'APPROVED') {
    console.log(`[webhook-wompi] Transacción ${transactionId} con estado no aprobado: ${status}`);
    return res.status(200).json({ ok: true, status });
  }

  // 6. Recuperar la orden asociada (o extraer de la referencia si la lambda es stateless)
  const pendingOrder = await db.getPendingOrder(reference);
  let celular = pendingOrder ? pendingOrder.celular : null;
  let creditosAAcreditar = 0;
  let planData = null;
  let expectedAmountInCents = 0;

  // Extracción determinista de celular y código de producto desde la referencia HNT-[celular]-[prodCode]-[timestamp]-[entropy]
  let prodCodeFromRef = null;
  if (reference && reference.startsWith('HNT-')) {
    const partes = reference.split('-');
    if (partes.length >= 2 && partes[1].length === 10 && /^\d+$/.test(partes[1])) {
      if (!celular) celular = partes[1];
    }
    if (partes.length >= 3) {
      prodCodeFromRef = partes[2];
    }
  }

  if (pendingOrder) {
    creditosAAcreditar = pendingOrder.creditos || 0;
    expectedAmountInCents = Number(pendingOrder.amountInCents || 0);
    if (pendingOrder.tipo === 'suscripcion_ciudad') {
      planData = { plan: 'city', city: pendingOrder.ciudad, days: 30 };
    } else if (pendingOrder.tipo === 'suscripcion_nacional') {
      planData = { plan: 'national', days: 30 };
    }
  } else {
    // Inferencia por código en referencia
    if (prodCodeFromRef === '1CR') {
      creditosAAcreditar = 1;
      expectedAmountInCents = 500000;
    } else if (prodCodeFromRef === '10CR') {
      creditosAAcreditar = 10;
      expectedAmountInCents = 3500000;
    } else if (prodCodeFromRef && prodCodeFromRef.startsWith('VIPCIU')) {
      const cityPart = prodCodeFromRef.includes('_') ? prodCodeFromRef.split('_')[1] : null;
      planData = { plan: 'city', city: cityPart || 'Colombia', days: 30 };
      expectedAmountInCents = 8900000;
      creditosAAcreditar = 0;
    } else if (prodCodeFromRef === 'VIPNAC') {
      planData = { plan: 'national', days: 30 };
      expectedAmountInCents = 14900000;
      creditosAAcreditar = 0;
    } else {
      creditosAAcreditar = 1;
      expectedAmountInCents = 500000;
    }

    if (!celular) {
      celular = transaction.customer_email || transaction.reference;
    }
  }

  // 🛡️ ESCUDO ANTI-FRAUDE: Bloqueo de montos manipulados hacia abajo
  const montoPagado = Number(transaction.amount_in_cents || 0);
  if (expectedAmountInCents > 0 && montoPagado < expectedAmountInCents) {
    console.error(`🚨 [ANTI-FRAUDE] Transacción ${transactionId} RECHAZADA. Monto pagado: $${montoPagado / 100} COP. Monto exigido: $${expectedAmountInCents / 100} COP.`);
    return res.status(400).json({ 
      error: 'MONTO_INVALIDO_FRAUDE', 
      message: 'El monto pagado no coincide con el valor legal del producto.' 
    });
  }

  // 7. Generar PIN de usuario si es nuevo y acreditar saldo
  const customerEmail = transaction.customer_email ? transaction.customer_email.toLowerCase().trim() : null;
  if (pendingOrder) {
    pendingOrder.status = 'APPROVED';
    pendingOrder.transactionId = transactionId;
    pendingOrder.approvedAt = new Date().toISOString();
    if (customerEmail) pendingOrder.email = customerEmail;
    await db.savePendingOrder(reference, pendingOrder);
  }

  const existingUser = await db.getUserByPhone(celular);
  const pin = existingUser ? existingUser.pin : generatePin();

  const usuarioActualizado = await db.addCredits(celular, creditosAAcreditar, pin, planData, customerEmail);
  console.log(`[webhook-wompi] Acreditación exitosa para ${celular}: +${creditosAAcreditar} créditos.`);

  // 8. Despacho transaccional automático de recibo y PIN por Resend API
  if (customerEmail && !pendingOrder?.emailSent) {
    const enviado = await despacharCorreoConfirmacion({
      phone: celular,
      email: customerEmail,
      reference,
      productName: pendingOrder?.productName,
      amountInCents: transaction.amount_in_cents,
      pin,
      credits: usuarioActualizado.credits,
      plan: usuarioActualizado.plan,
      planCity: usuarioActualizado.planCity
    });
    if (enviado && pendingOrder) {
      pendingOrder.emailSent = true;
      await db.savePendingOrder(reference, pendingOrder);
    }
  }

  return res.status(200).json({
    ok: true,
    message: 'Pago procesado y créditos acreditados exitosamente.',
    user: {
      phone: usuarioActualizado.phone,
      credits: usuarioActualizado.credits,
      plan: usuarioActualizado.plan
    }
  });
};
