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
const db = require('../lib/db');
const { generatePin } = require('../lib/crypto');

module.exports = async function handler(req, res) {
  // CORS y métodos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

  // 3. Reconstruir y validar la firma criptográfica dinámica de Wompi
  let concatenatedValues = '';
  for (const prop of event.signature.properties) {
    const parts = prop.split('.');
    let val = event.data;
    for (const part of parts) {
      if (val === undefined || val === null) break;
      val = val[part];
    }
    if (val !== undefined && val !== null) {
      concatenatedValues += String(val);
    }
  }

  const eventsSecret = process.env.WOMPI_EVENTS_SECRET || 'test_events_secret_hunter_2026';
  concatenatedValues += String(event.timestamp) + eventsSecret;

  const expectedSignature = crypto.createHash('sha256').update(concatenatedValues).digest('hex');
  const receivedSig = String(event.signature.checksum || '');

  // 🛡️ Comparación en tiempo constante (timingSafeEqual)
  const bufReceived = Buffer.from(receivedSig);
  const bufExpected = Buffer.from(expectedSignature);

  const signaturesMatch =
    bufReceived.length === bufExpected.length &&
    crypto.timingSafeEqual(bufReceived, bufExpected);

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

  // Extracción determinista de celular desde la referencia HNT-[celular]-[timestamp]-[entropy]
  if (!celular && reference && reference.startsWith('HNT-')) {
    const partes = reference.split('-');
    if (partes.length >= 2 && partes[1].length === 10 && /^\d+$/.test(partes[1])) {
      celular = partes[1];
    }
  }

  if (pendingOrder) {
    creditosAAcreditar = pendingOrder.creditos || 0;
    if (pendingOrder.tipo === 'suscripcion_ciudad') {
      planData = { plan: 'city', city: pendingOrder.ciudad, days: 30 };
    } else if (pendingOrder.tipo === 'suscripcion_nacional') {
      planData = { plan: 'national', days: 30 };
    }
  } else {
    // Si la lambda no compartió el /tmp de create-order, inferir por monto de transacción
    const monto = transaction.amount_in_cents || 0;
    if (monto === 500000) creditosAAcreditar = 1;
    else if (monto === 3500000) creditosAAcreditar = 10;
    else if (monto === 8900000) planData = { plan: 'city', days: 30 };
    else if (monto === 14900000) planData = { plan: 'national', days: 30 };
    else creditosAAcreditar = 1;

    if (!celular) {
      celular = transaction.customer_email || transaction.reference;
    }
  }

  // 7. Generar PIN de usuario si es nuevo y acreditar saldo
  const existingUser = await db.getUserByPhone(celular);
  const pin = existingUser ? existingUser.pin : generatePin();

  const usuarioActualizado = await db.addCredits(celular, creditosAAcreditar, pin, planData);
  console.log(`✅ [webhook-wompi] Acreditación exitosa para ${celular}: +${creditosAAcreditar} créditos. Saldo actual: ${usuarioActualizado.credits}. PIN: ${pin}`);

  return res.status(200).json({
    ok: true,
    message: 'Pago procesado y créditos acreditados exitosamente.',
    user: {
      phone: usuarioActualizado.phone,
      credits: usuarioActualizado.credits,
      pin: usuarioActualizado.pin,
      plan: usuarioActualizado.plan
    }
  });
};
