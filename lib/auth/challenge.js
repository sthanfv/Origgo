/**
 * 🛡️ ENDPOINT DE EMISIÓN DE DESAFÍOS DE SEGURIDAD ANTI-BOT
 * GET /api/auth/challenge
 * 
 * Emite un reto criptográfico firmado de Proof-of-Work (PoW) y la clave pública
 * de Cloudflare Turnstile (si está configurada) para proteger la autenticación con PIN.
 */

const { generarDesafioPoW } = require('../challenge');
const { checkRateLimitAsync } = require('../rate-limiter');
const { aplicarCorsSeguro } = require('../cors');
const { requireEnv } = require('../env');

const JWT_SECRET = requireEnv('JWT_SECRET', {
  testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232'
});

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido. Utilice GET.' });
  }

  // 🛡️ Rate Limiting: máx 60 solicitudes de desafío por minuto por IP
  if (!(await checkRateLimitAsync(req, res, { prefix: 'auth_challenge', maxRequests: 60, windowMs: 60 * 1000 }))) {
    return;
  }

  try {
    const desafio = generarDesafioPoW(JWT_SECRET, 3, 300);
    const siteKeyTurnstile = process.env.TURNSTILE_SITE_KEY || null;

    return res.status(200).json({
      ok: true,
      challenge: desafio,
      turnstileSiteKey: siteKeyTurnstile
    });
  } catch (error) {
    console.error('[auth/challenge] Error al generar desafío:', error);
    return res.status(500).json({ ok: false, error: 'Error interno al generar desafío' });
  }
};
