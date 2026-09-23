/**
 * 🎁 ENDPOINT DE ACTIVACIÓN FREEMIUM (DOBLE OPT-IN POR CORREO)
 * POST /api/auth/welcome-verify
 * 
 * Valida de forma atómica el token de un solo uso recibido por correo electrónico,
 * quema el token, registra el dispositivo en claimed_devices, el correo en claimed_emails,
 * acredita 1 crédito de regalo en Firestore y emite un JWT firmado de 30 días.
 */

const db = require('../db');
const { checkRateLimitAsync } = require('../rate-limiter');
const { welcomeVerifySchema, validateBody } = require('../validation');
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

  // 🛡️ Rate Limiting: Máximo 10 intentos de verificación por 15 minutos por IP
  const quinceMinutosMs = 15 * 60 * 1000;
  if (!(await checkRateLimitAsync(req, res, {
    prefix: 'welcome_verify_ip',
    maxRequests: 10,
    windowMs: quinceMinutosMs,
    error: 'LIMITE_EXCEDIDO',
    message: 'Has alcanzado el límite de intentos de verificación permitidos. Intenta más tarde.'
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
  const validation = validateBody(welcomeVerifySchema, body);
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
    // 🛡️ Consumo atómico del token de activación en Firestore
    const result = await db.consumeWelcomeVerificationToken(token);

    if (!result || (!result.success && !result.ok)) {
      const status = result?.alreadyClaimed ? 409 : 400;
      return res.status(status).json({
        ok: false,
        error: result.error || 'ACTIVACION_FALLIDA',
        alreadyClaimed: Boolean(result.alreadyClaimed),
        message: result.message || (isEn ? 'Could not activate welcome gift.' : 'No fue posible activar el regalo de bienvenida.')
      });
    }

    const user = result.user;

    // Emisión del JWT de 30 días
    const jwtToken = signJwt({
      phone: user.phone,
      email: user.email,
      credits: user.credits,
      unlockedLeads: user.unlockedLeads || [],
      plan: user.plan || 'free',
      planCity: user.planCity || null,
      planExpiresAt: user.planExpiresAt || null,
      role: 'buyer'
    }, JWT_SECRET, 30);

    // Registro atómico en el embudo de conversión
    try {
      const { registrarEventoEmbudo, ETAPAS_EMBUDO } = require('../funnel');
      await registrarEventoEmbudo({
        etapa: ETAPAS_EMBUDO.CONVERSION,
        tipo: 'freemium',
        plan: 'welcome_free'
      });
    } catch (_) {}

    return res.status(200).json({
      ok: true,
      token: jwtToken,
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
      message: isEn
        ? 'Welcome gift activated! 1 direct unlock credit has been added to your account.'
        : '¡Regalo de bienvenida activado! Se ha acreditado 1 desbloqueo directo en tu cuenta.'
    });
  } catch (err) {
    console.error('[welcome-verify] Error interno:', err);
    return res.status(500).json({
      ok: false,
      error: 'ERROR_INTERNO',
      message: isEn ? 'Internal server error verifying welcome token.' : 'Error interno verificando el enlace de bienvenida.'
    });
  }
};
