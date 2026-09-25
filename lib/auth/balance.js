/**
 * ⚡ CONSULTA DE SALDO, CRÉDITOS Y LEADS DESBLOQUEADOS (lib)
 *
 * Se sirve a través de /api/auth?action=balance (consolidado para respetar el límite de
 * 12 funciones del plan Hobby de Vercel). El frontend sigue llamando a /api/user/balance
 * gracias a una regla de reenlace en vercel.json.
 *
 * Retorna el balance de créditos, plan activo y los IDs de inmuebles desbloqueados.
 */
const db = require('../db');
const { verifyJwt } = require('../crypto');
const { checkRateLimitAsync } = require('../rate-limiter');
const { aplicarCorsSeguro } = require('../cors');
const { requireEnv } = require('../env');

const JWT_SECRET = requireEnv('JWT_SECRET', {
  testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232',
});

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 🛡️ Rate Limiting: máx 60 consultas de saldo por minuto con Upstash Redis
  if (
    !(await checkRateLimitAsync(req, res, {
      prefix: 'user_balance',
      maxRequests: 60,
      windowMs: 60 * 1000,
    }))
  ) {
    return;
  }

  if (req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utilice GET o PATCH.' });
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

    // Caso 1: Actualización atómica de preferencias de usuario (PATCH o POST)
    if (req.method === 'PATCH' || req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (_) {
          void _;
        }
      }
      body = body || {};

      const { preferredLang, preferredTheme } = body;
      const updatedUser = await db.updateUserPreferences(session.phone, {
        preferredLang,
        preferredTheme,
      });
      if (!updatedUser) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      return res.status(200).json({
        ok: true,
        phone: updatedUser.phone,
        preferredLang: updatedUser.preferredLang || 'es',
        preferredTheme: updatedUser.preferredTheme || 'dark',
      });
    }

    // Caso 2: Consulta estándar de balance y perfil (GET)
    const user = await db.getUserByPhone(session.phone);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.status(200).json({
      ok: true,
      phone: user.phone,
      credits: user.credits,
      plan: user.plan,
      planCity: user.planCity,
      planExpiresAt: user.planExpiresAt,
      unlockedLeads: user.unlockedLeads || [],
      preferredLang: user.preferredLang || 'es',
      preferredTheme: user.preferredTheme || 'dark',
    });
  } catch (error) {
    console.error('[balance] Error:', error);
    return res.status(500).json({ error: 'Error procesando balance o preferencias de usuario' });
  }
};
