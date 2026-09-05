/**
 * 💳 ENDPOINT CREACIÓN DE ÓRDENES Y FIRMA DE INTEGRIDAD WOMPI
 * POST /api/payments/create-order
 * 
 * Genera la referencia criptográfica única y la firma HMAC-SHA256
 * requerida por el Widget Oficial de Wompi para autorizar pagos en Colombia.
 */

const crypto = require('crypto');
const db = require('../lib/db');

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
  // Configuración de cabeceras CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utilice POST.' });
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
    body = body || {};

    const { productType, celular, ciudad } = body;

    const producto = PRODUCT_CATALOG[productType];
    if (!producto) {
      return res.status(400).json({ 
        error: 'Tipo de producto inválido.',
        productosValidos: Object.keys(PRODUCT_CATALOG)
      });
    }

    if (productType === 'subscription_city') {
      if (!ciudad || typeof ciudad !== 'string' || !ciudad.trim()) {
        return res.status(400).json({ 
          error: 'Debe seleccionar una ciudad para activar el Plan Pro Ciudad.' 
        });
      }
    }

    const normPhone = db.cleanPhone(celular);
    if (!normPhone || normPhone.length < 10) {
      return res.status(400).json({ 
        error: 'Debe ingresar un número de celular de WhatsApp válido (10 dígitos).' 
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
    const publicKey = process.env.WOMPI_PUBLIC_KEY || 'pub_test_PQAm6bJXtS4ScbCpBU058xY0vlTPFXfA';
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || 'test_integrity_2g8NUSOa7paHZDObHhpPlnIRszyxGfIq';

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
      status: 'PENDING'
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
