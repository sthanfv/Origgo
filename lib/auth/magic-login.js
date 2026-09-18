/**
 * 🔑 ENDPOINT DE CANJE DE MAGIC LINK (ACCESO SIN CONTRASEÑA)
 * POST /api/auth/magic-login
 * 
 * Valida de forma atómica un token de acceso rápido, lo invalida contra reuso
 * y emite una sesión persistente JWT de 30 días.
 */

const db = require('../db');
const { checkRateLimitAsync } = require('../rate-limiter');
const { magicLoginSchema, validateBody } = require('../validation');
const { aplicarCorsSeguro } = require('../cors');
const { signJwt } = require('../crypto');
const { requireEnv } = require('../env');

const JWT_SECRET = requireEnv('JWT_SECRET', {
  testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232'
});

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METODO_NO_PERMITIDO', message: 'Método no permitido.' });
  }

  // 🛡️ Rate Limiting Anti-Fuerza Bruta: Máximo 10 intentos de validación por minuto por IP
  const unMinutoMs = 60 * 1000;
  if (!(await checkRateLimitAsync(req, res, {
    prefix: 'magic_login_ip',
    maxRequests: 10,
    windowMs: unMinutoMs,
    error: 'LIMITE_EXCEDIDO',
    message: 'Demasiados intentos de acceso fallidos. Por favor espera un momento.'
  }))) {
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      return res.status(400).json({ ok: false, error: 'JSON_MALFORMADO', message: 'Cuerpo de petición inválido.' });
    }
  }

  // 🛡️ Validación estricta con Zod
  const validation = validateBody(magicLoginSchema, body);
  if (!validation.success) {
    return res.status(validation.status).json({
      ok: false,
      error: validation.error,
      message: validation.message,
      issues: validation.issues
    });
  }

  const { token, lang } = validation.data;
  const isEn = lang === 'en';

  try {
    // Consumir token de forma atómica en Firestore / MemoryStore
    const result = await db.consumeMagicToken(token);

    if (!result.success) {
      return res.status(401).json({
        ok: false,
        error: result.error || 'TOKEN_INVALIDO',
        message: result.message || (isEn ? 'Invalid or expired access link.' : 'El enlace de acceso es inválido o ya expiró.')
      });
    }

    const user = result.user;

    // Emisión de token JWT de 30 días para sesión persistente
    const sessionToken = signJwt({
      phone: user.phone,
      email: user.email || null,
      credits: user.credits,
      unlockedLeads: user.unlockedLeads || [],
      plan: user.plan || 'free',
      planCity: user.planCity || null,
      planExpiresAt: user.planExpiresAt || null,
      role: 'buyer'
    }, JWT_SECRET, 30);

    return res.status(200).json({
      ok: true,
      token: sessionToken,
      user: {
        phone: user.phone,
        email: user.email,
        credits: user.credits,
        plan: user.plan,
        planCity: user.planCity,
        planExpiresAt: user.planExpiresAt,
        unlockedLeads: user.unlockedLeads || [],
        pin: user.pin
      },
      message: isEn ? 'Sign in successful!' : '¡Sesión iniciada con éxito!'
    });
  } catch (err) {
    console.error('[magic-login] Error interno:', err);
    return res.status(500).json({
      ok: false,
      error: 'ERROR_INTERNO',
      message: isEn ? 'Internal server error validating access link.' : 'Error interno validando el enlace de acceso.'
    });
  }
};
