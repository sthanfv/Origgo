/**
 * 🔓 ENDPOINT DE DESBLOQUEO SEGURO DE CONTACTOS FSBO
 * POST /api/leads/unlock
 * 
 * Verifica el balance de créditos del usuario o plan VIP,
 * descuenta 1 crédito de forma atómica (si no ha sido desbloqueado previamente),
 * y descifra en memoria el teléfono y enlace real utilizando AES-256-GCM.
 */

const db = require('../lib/db');
const { signJwt, verifyJwt, decryptLeadContact } = require('../lib/crypto');
const { checkRateLimit } = require('../lib/rate-limiter');
const { aplicarCorsSeguro } = require('../lib/cors');
const { unlockLeadSchema, validateBody } = require('../lib/validation');

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.LEADS_ENCRYPTION_KEY)) {
  throw new Error('CONFIGURACION_INSEGURA: JWT_SECRET y LEADS_ENCRYPTION_KEY son obligatorios en producción.');
}

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232' : '');
const LEADS_ENCRYPTION_KEY = process.env.LEADS_ENCRYPTION_KEY || (process.env.NODE_ENV === 'test' ? 'cf5e87913d4cf975ab463ada86e9ce905b9d5306c5188af3f8a074159cbf9a2c' : '');

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 🛡️ Rate Limiting: máx 30 desbloqueos por minuto por IP
  if (!checkRateLimit(req, res, { prefix: 'leads_unlock', maxRequests: 30, windowMs: 60 * 1000 })) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utilice POST.' });
  }

  try {
    // 1. Validar autenticación por JWT
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return res.status(401).json({ 
        error: 'No autenticado. Por favor adquiere créditos o ingresa tu PIN.' 
      });
    }

    const session = verifyJwt(token, JWT_SECRET);
    if (!session || !session.phone) {
      return res.status(401).json({ 
        error: 'Sesión expirada o inválida. Inicia sesión nuevamente con tu WhatsApp y PIN.' 
      });
    }

    // 2. Parsear el cuerpo
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'JSON malformado' });
      }
    }

    // 🛡️ Validación estricta con Zod
    const validation = validateBody(unlockLeadSchema, body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: validation.message,
        issues: validation.issues 
      });
    }

    const { leadId, contactoCifrado, leadCity } = validation.data;

    // 3. Ejecutar desbloqueo en el ledger con rehidratación stateless desde sesión
    const resultado = await db.unlockLead(session.phone, leadId, session, leadCity);

    if (!resultado.success) {
      if (resultado.error === 'PLAN_CIUDAD_DIFERENTE') {
        return res.status(403).json({
          ok: false,
          error: 'PLAN_CIUDAD_DIFERENTE',
          message: resultado.message || 'Tu Plan Pro Ciudad no cubre este municipio. Requiere créditos individuales.',
          credits: resultado.credits || 0
        });
      }
      if (resultado.error === 'SALDO_INSUFICIENTE') {
        return res.status(402).json({
          ok: false,
          error: 'SALDO_INSUFICIENTE',
          message: 'No tienes créditos suficientes. Adquiere un pase individual o una bolsa con descuento.',
          credits: resultado.credits
        });
      }
      return res.status(400).json({ ok: false, error: resultado.error });
    }

    // 4. Descifrar el contacto en memoria con AES-256-GCM (probando llaves activas)
    let contactoDescifrado = null;
    if (contactoCifrado) {
      const keysToTry = [
        LEADS_ENCRYPTION_KEY,
        process.env.NODE_ENV !== 'production' ? '92eb1c43f7a6599258f0e16cbe7a24524bc9fc91f048680bd9dd7242969ee637' : null,
        process.env.NODE_ENV !== 'production' ? 'cf5e87913d4cf975ab463ada86e9ce905b9d5306c5188af3f8a074159cbf9a2c' : null
      ].filter(Boolean);

      for (const k of keysToTry) {
        try {
          contactoDescifrado = decryptLeadContact(contactoCifrado, k);
          if (contactoDescifrado) break;
        } catch (e) {}
      }
    }

    // 5. Normalizar teléfono y enlace original del inmueble
    const rawTel = contactoDescifrado?.telefono || '';
    const telLimpio = rawTel.replace(/\D/g, '');
    const esCelularValido = !rawTel.includes('...') && telLimpio.length >= 10 && (telLimpio.startsWith('573') || telLimpio.startsWith('3'));

    let whatsappUrl = null;
    let telLlamar = null;
    let telefonoDisplay = rawTel;

    if (esCelularValido) {
      const waNum = telLimpio.startsWith('57') ? telLimpio : `57${telLimpio}`;
      const cel10 = telLimpio.startsWith('57') ? telLimpio.substring(2) : telLimpio;
      telefonoDisplay = `+57 ${cel10.substring(0, 3)} ${cel10.substring(3, 6)} ${cel10.substring(6)}`;
      telLlamar = `+${waNum}`;
      const mensajeWa = encodeURIComponent(`Hola, vi tu propiedad en Hunter Pro y me interesa comunicarme directamente con el propietario.`);
      whatsappUrl = `https://wa.me/${waNum}?text=${mensajeWa}`;
    } else if (rawTel) {
      telefonoDisplay = rawTel.includes('...') ? `${rawTel} (Enlace Directo)` : rawTel;
    } else {
      telefonoDisplay = 'Disponible en Anuncio Original';
    }

    const enlace = contactoDescifrado?.enlace || 'https://www.fincaraiz.com.co';
    const portal = (contactoDescifrado?.portal || 'fincaraiz').toUpperCase();

    // 6. Emitir nuevo JWT firmado con el estado actualizado (Stateless Signed Token)
    const userPayload = resultado.user || {};
    const newToken = signJwt({
      phone: session.phone,
      pin: userPayload.pin || session.pin,
      credits: resultado.credits,
      unlockedLeads: resultado.unlockedLeads || [],
      plan: userPayload.plan || session.plan || 'free',
      planCity: userPayload.planCity || session.planCity || null,
      planExpiresAt: userPayload.planExpiresAt || session.planExpiresAt || null,
      role: 'buyer'
    }, JWT_SECRET, 30);

    return res.status(200).json({
      ok: true,
      leadId,
      alreadyUnlocked: resultado.alreadyUnlocked,
      creditsRemaining: resultado.credits,
      unlockedLeads: resultado.unlockedLeads,
      token: newToken,
      planBenefit: Boolean(resultado.planBenefit),
      contacto: {
        telefono: rawTel || telefonoDisplay,
        telefonoDisplay: telefonoDisplay || rawTel,
        telLlamar,
        esCelularValido,
        whatsappUrl,
        enlace,
        portal
      }
    });
  } catch (error) {
    console.error('[unlock] Error en desbloqueo:', error);
    return res.status(500).json({ error: 'Error procesando el desbloqueo del inmueble.' });
  }
};
