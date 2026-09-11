/**
 * 💳 ENDPOINT CREACIÓN DE ÓRDENES Y FIRMA DE INTEGRIDAD WOMPI
 * POST /api/payments/create-order
 * 
 * Genera la referencia criptográfica única y la firma HMAC-SHA256
 * requerida por el Widget Oficial de Wompi para autorizar pagos en Colombia.
 */

const crypto = require('crypto');
const db = require('../../lib/db');
const { checkRateLimitAsync } = require('../../lib/rate-limiter');
const { aplicarCorsSeguro } = require('../../lib/cors');
const { createOrderSchema, validateBody } = require('../../lib/validation');
const { verifyJwt } = require('../../lib/crypto');
const { requireEnv } = require('../../lib/env');

const JWT_SECRET = requireEnv('JWT_SECRET', {
  testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232'
});

// Diccionario oficial de productos y precios en centavos de peso (COP)
const PRODUCT_CATALOG = {
  single_lead: {
    nombre: 'Desbloqueo de Contacto Individual',
    montoCentavos: 500000, // $5.000 COP
    creditos: 1,
    tipo: 'credito'
  },
  pack_10_leads: {
    nombre: 'Bolsa de 10 Contactos Directos (-30% Desc.)',
    montoCentavos: 3500000, // $35.000 COP
    creditos: 10,
    tipo: 'credito'
  },
  subscription_city: {
    nombre: 'Plan Pro Ciudad — Acceso Ilimitado 30 Días',
    montoCentavos: 8900000, // $89.000 COP
    creditos: 0,
    tipo: 'suscripcion_ciudad'
  },
  subscription_national: {
    nombre: 'Plan Nacional VIP — Radar Total y Rebajas',
    montoCentavos: 14900000, // $149.000 COP
    creditos: 0,
    tipo: 'suscripcion_nacional'
  }
};

module.exports = async function handler(req, res) {
  // Configuración de cabeceras CORS seguras según whitelist
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utilice POST.' });
  }

  // 🛡️ Rate Limiting Anti-DDoS: Máximo 12 solicitudes de orden por minuto por IP con Upstash Redis
  if (!(await checkRateLimitAsync(req, res, { prefix: 'create_order', maxRequests: 12, windowMs: 60 * 1000 }))) {
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Cuerpo de solicitud JSON inválido.' });
      }
    }

    // 🛡️ Validación estricta con Zod
    const validation = validateBody(createOrderSchema, body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: validation.message,
        issues: validation.issues 
      });
    }

    const { productType, celular: normPhone, ciudad } = validation.data;

    const headers = req.headers || {};
    const idempotencyKey = String(headers['idempotency-key'] || '').trim();
    if (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      return res.status(400).json({ ok: false, error: 'IDEMPOTENCY_KEY_REQUERIDA' });
    }

    const ordenIdempotente = await db.getPendingOrderByIdempotencyKey(idempotencyKey);
    if (ordenIdempotente) {
      const publicKeyCached = requireEnv('WOMPI_PUBLIC_KEY', { testFallback: 'pub_test_local_suite' });
      const integritySecretCached = requireEnv('WOMPI_INTEGRITY_SECRET', { testFallback: 'test_integrity_local_suite' });
      const integrityChainCached = `${ordenIdempotente.reference}${ordenIdempotente.amountInCents}${ordenIdempotente.currency || 'COP'}${integritySecretCached}`;
      const signatureCached = crypto.createHash('sha256').update(integrityChainCached).digest('hex');
      return res.status(200).json({
        ok: true,
        reference: ordenIdempotente.reference,
        amountInCents: ordenIdempotente.amountInCents,
        currency: ordenIdempotente.currency || 'COP',
        signature: signatureCached,
        publicKey: publicKeyCached,
        productName: ordenIdempotente.productName,
        idempotent: true
      });
    }

    const bearer = (headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const sesionActual = bearer ? verifyJwt(bearer, JWT_SECRET) : null;
    if (sesionActual?.phone && sesionActual.phone !== normPhone) {
      return res.status(403).json({
        ok: false,
        error: 'CELULAR_NO_COINCIDE_CON_SESION',
        message: 'El número de WhatsApp no coincide con la sesión activa.'
      });
    }
    const cuentaExistente = await db.getUserByPhone(normPhone);

    const producto = PRODUCT_CATALOG[productType];
    if (!producto) {
      return res.status(400).json({ 
        error: 'Tipo de producto inválido.',
        productosValidos: Object.keys(PRODUCT_CATALOG)
      });
    }

    const ciudadLimpia = ciudad ? ciudad.trim() : null;
    let prodCode = '1CR';
    if (productType === 'single_lead') prodCode = '1CR';
    else if (productType === 'pack_10_leads') prodCode = '10CR';
    else if (productType === 'subscription_city') {
      const slug = ciudadLimpia 
        ? ciudadLimpia.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '').substring(0, 8) 
        : 'CIU';
      prodCode = `VIPCIU_${slug}`;
    } else if (productType === 'subscription_national') {
      prodCode = 'VIPNAC';
    }

    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const reference = `HNT-${normPhone}-${prodCode}-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;
    const amountInCents = producto.montoCentavos;
    const currency = 'COP';

    // Llaves oficiales de Wompi Sandbox del comercio
    const publicKey = requireEnv('WOMPI_PUBLIC_KEY', { testFallback: 'pub_test_local_suite' });
    const integritySecret = requireEnv('WOMPI_INTEGRITY_SECRET', { testFallback: 'test_integrity_local_suite' });

    // Cálculo estricto de firma de integridad Wompi:
    // SHA256(reference + amountInCents + currency + integritySecret)
    const integrityChain = `${reference}${amountInCents}${currency}${integritySecret}`;
    const signature = crypto.createHash('sha256').update(integrityChain).digest('hex');

    // Registrar pre-orden en el ledger para conciliación posterior
    await db.savePendingOrder(reference, {
      reference,
      productType,
      productName: producto.nombre,
      amountInCents,
      currency,
      celular: normPhone,
      ciudad: ciudadLimpia,
      tipo: producto.tipo,
      creditos: producto.creditos,
      status: 'PENDING',
      accountExistedAtOrderCreation: Boolean(cuentaExistente),
      idempotencyKey
    });

    return res.status(200).json({
      ok: true,
      reference,
      amountInCents,
      currency,
      signature,
      publicKey,
      productName: producto.nombre
    });
  } catch (error) {
    console.error('[create-order] Error interno:', error);
    return res.status(500).json({ error: 'Error interno al generar la orden de pago.' });
  }
};
