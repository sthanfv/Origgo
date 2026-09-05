/**
 * ⚡ CONSULTA DE SALDO, CRÉDITOS Y LEADS DESBLOQUEADOS
 * GET /api/user/balance
 * 
 * Retorna el balance de créditos, plan activo y el listado de IDs de inmuebles
 * ya desbloqueados por el usuario para renderizado instantáneo en el frontend.
 */

const db = require('../lib/db');
const { verifyJwt } = require('../lib/crypto');
const { checkRateLimit } = require('../lib/rate-limiter');
const { aplicarCorsSeguro } = require('../lib/cors');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('CONFIGURACION_INSEGURA: JWT_SECRET es obligatorio en producción.');
}

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232' : '');

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 🛡️ Rate Limiting: máx 60 consultas de saldo por minuto
  if (!checkRateLimit(req, res, { prefix: 'user_balance', maxRequests: 60, windowMs: 60 * 1000 })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido. Utilice GET.' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const session = verifyJwt(token, JWT_SECRET);
    if (!session || !session.phone) {
      return res.status(401).json({ error: 'Sesión expirada' });
    }

    const user = await db.getUserByPhone(session.phone);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.status(200).json({
      ok: true,
      phone: user.phone,
      credits: user.credits,
      pin: user.pin,
      plan: user.plan,
      planCity: user.planCity,
      planExpiresAt: user.planExpiresAt,
      unlockedLeads: user.unlockedLeads || []
    });
  } catch (error) {
    console.error('[balance] Error:', error);
    return res.status(500).json({ error: 'Error consultando balance de usuario' });
  }
};
