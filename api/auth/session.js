/**
 * 🔑 ENDPOINT DE GESTIÓN DE SESIONES Y RESTAURACIÓN POR PIN
 * POST /api/auth/session
 * 
 * Permite al usuario autenticarse con su WhatsApp + PIN (ej. "HNT-7492")
 * o reclamar su sesión inmediatamente después de pagar en Wompi.
 * Retorna un token JWT firmado de 30 días para navegación persistente.
 */

const db = require('../lib/db');
const { signJwt, verifyJwt } = require('../lib/crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Verificar validez de token existente
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ authenticated: false, error: 'Token no proporcionado' });
    }

    const payload = verifyJwt(token, JWT_SECRET);
    if (!payload) {
      return res.status(401).json({ authenticated: false, error: 'Token inválido o expirado' });
    }

    const user = await db.getUserByPhone(payload.phone, payload);
    if (!user) {
      return res.status(404).json({ authenticated: false, error: 'Usuario no encontrado' });
    }

    return res.status(200).json({
      authenticated: true,
      user: {
        phone: user.phone,
        credits: user.credits,
        pin: user.pin,
        plan: user.plan,
        planCity: user.planCity,
        planExpiresAt: user.planExpiresAt,
        unlockedLeads: user.unlockedLeads || []
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'JSON malformado' });
      }
    }
    body = body || {};

    const { action, celular, pin, reference } = body;

    // CASO 1: Reclamar sesión post-pago mediante referencia de orden
    if (action === 'claim_reference' && reference) {
      let celular = null;
      let creditosAAcreditar = 1;
      let planData = null;

      const order = await db.getPendingOrder(reference);
      if (order) {
        celular = order.celular;
        creditosAAcreditar = order.creditos !== undefined ? order.creditos : 0;
        if (order.tipo === 'suscripcion_ciudad') {
          planData = { plan: 'city', city: order.ciudad, days: 30 };
        } else if (order.tipo === 'suscripcion_nacional') {
          planData = { plan: 'national', days: 30 };
        }
      } else if (reference.startsWith('HNT-')) {
        const partes = reference.split('-');
        if (partes.length >= 2 && partes[1].length === 10 && /^\d+$/.test(partes[1])) {
          celular = partes[1];
        }
        if (partes.length >= 3) {
          const code = partes[2];
          if (code === '10CR') {
            creditosAAcreditar = 10;
          } else if (code.startsWith('VIPCIU')) {
            const cSlug = code.includes('_') ? code.split('_')[1] : null;
            planData = { plan: 'city', city: cSlug || 'Colombia', days: 30 };
            creditosAAcreditar = 0;
          } else if (code === 'VIPNAC') {
            planData = { plan: 'national', days: 30 };
            creditosAAcreditar = 0;
          } else {
            creditosAAcreditar = 1;
          }
        }
      }

      if (!celular) {
        return res.status(404).json({ error: 'Referencia de pago no encontrada' });
      }

      // Idempotencia contra doble reclamo de la misma referencia
      const primerReclamo = await db.recordTransaction(`claim_${reference}`, {
        reference,
        celular,
        claimedAt: new Date().toISOString()
      });

      let user = await db.getUserByPhone(celular);
      const userPin = user ? user.pin : null;

      if (primerReclamo) {
        user = await db.addCredits(celular, creditosAAcreditar, userPin, planData);
      } else if (!user) {
        user = await db.addCredits(celular, creditosAAcreditar, userPin, planData);
      }

      // Token JWT con estado criptográfico enriquecido (Stateless Signed Token)
      const token = signJwt({
        phone: user.phone,
        pin: user.pin,
        credits: user.credits,
        unlockedLeads: user.unlockedLeads || [],
        plan: user.plan || 'free',
        planCity: user.planCity || null,
        planExpiresAt: user.planExpiresAt || null,
        role: 'buyer'
      }, JWT_SECRET, 30);

      return res.status(200).json({
        ok: true,
        token,
        user: {
          phone: user.phone,
          credits: user.credits,
          pin: user.pin,
          plan: user.plan,
          planCity: user.planCity,
          planExpiresAt: user.planExpiresAt,
          unlockedLeads: user.unlockedLeads || []
        }
      });
    }

    // CASO 2: Inicio de sesión con WhatsApp + PIN
    const normPhone = db.cleanPhone(celular);
    if (!normPhone || !pin) {
      return res.status(400).json({ error: 'Debe ingresar su número de WhatsApp y su PIN de seguridad.' });
    }

    const user = await db.getUserByPin(normPhone, pin);
    if (!user) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas. Verifique el número de WhatsApp y el PIN.' 
      });
    }

    // Token JWT con estado criptográfico enriquecido
    const token = signJwt({
      phone: user.phone,
      pin: user.pin,
      credits: user.credits,
      unlockedLeads: user.unlockedLeads || [],
      plan: user.plan || 'free',
      planCity: user.planCity || null,
      planExpiresAt: user.planExpiresAt || null,
      role: 'buyer'
    }, JWT_SECRET, 30);

    return res.status(200).json({
      ok: true,
      token,
      user: {
        phone: user.phone,
        credits: user.credits,
        pin: user.pin,
        plan: user.plan,
        planCity: user.planCity,
        planExpiresAt: user.planExpiresAt,
        unlockedLeads: user.unlockedLeads || []
      }
    });
  } catch (err) {
    console.error('[session] Error interno:', err);
    return res.status(500).json({ error: 'Error interno en la autenticación' });
  }
};
