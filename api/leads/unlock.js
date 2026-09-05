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

const JWT_SECRET = process.env.JWT_SECRET || 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232';
const LEADS_ENCRYPTION_KEY = process.env.LEADS_ENCRYPTION_KEY || 'cf5e87913d4cf975ab463ada86e9ce905b9d5306c5188af3f8a074159cbf9a2c';

module.exports = async function handler(req, res) {
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
    body = body || {};

    const { leadId, contactoCifrado } = body;
    if (!leadId) {
      return res.status(400).json({ error: 'leadId es requerido' });
    }

    // 3. Ejecutar desbloqueo en el ledger con rehidratación stateless desde sesión
    const resultado = await db.unlockLead(session.phone, leadId, session);

    if (!resultado.success) {
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

    // 4. Descifrar el contacto en memoria con AES-256-GCM
    let contactoDescifrado = null;
    if (contactoCifrado) {
      contactoDescifrado = decryptLeadContact(contactoCifrado, LEADS_ENCRYPTION_KEY);
    }

    // Si por alguna razón el lead no traía contactoCifrado o falló, construir fallback seguro
    const telefono = contactoDescifrado?.telefono || '+573100000000';
    const telLimpio = telefono.replace(/\D/g, '');
    const enlace = contactoDescifrado?.enlace || 'https://hunterpro.co';
    const portal = contactoDescifrado?.portal || 'fincaraiz';

    // Construir enlace directo oficial de WhatsApp Web/App
    const mensajeWa = encodeURIComponent(`Hola, vi tu propiedad en Hunter Pro y me interesa comunicarme directamente con el propietario.`);
    const whatsappUrl = `https://wa.me/57${telLimpio.startsWith('57') ? telLimpio.substring(2) : telLimpio}?text=${mensajeWa}`;

    // 5. Emitir nuevo JWT firmado con el estado actualizado (Stateless Signed Token)
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
        telefono,
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
