/**
 * ⚡ CONSULTA DE SALDO, CRÉDITOS Y LEADS DESBLOQUEADOS
 * GET /api/user/balance
 * 
 * Retorna el balance de créditos, plan activo y el listado de IDs de inmuebles
 * ya desbloqueados por el usuario para renderizado instantáneo en el frontend.
 */

const db = require('../lib/db');
const { verifyJwt } = require('../lib/crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

    const user = await db.getUserByPhone(session.phone, session);
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
