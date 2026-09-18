/**
 * 🎁 ENDPOINT DE CRÉDITO DE BIENVENIDA FREEMIUM (1 DESBLOQUEO GRATIS)
 * POST /api/auth/welcome-credit
 * 
 * Permite a nuevos compradores comprobar la autenticidad del servicio obteniendo
 * 1 crédito de regalo ($0 COP) al registrar su WhatsApp y correo electrónico.
 * 
 * Garantías DevSecOps:
 * 1. Transacción atómica en Firestore para prevenir concurrencia y doble cobro.
 * 2. Validación Zod estricta de prefijos móviles colombianos (3XX).
 * 3. Rate limiting por IP contra barridos automatizados.
 * 4. Inicio de sesión instantáneo (JWT firmado de 30 días) sin fricción en el DOM.
 * 5. Despacho transaccional del enlace Magic Link y PIN maestro por Resend API.
 */

const db = require('../db');
const { checkRateLimitAsync } = require('../rate-limiter');
const { welcomeCreditSchema, validateBody } = require('../validation');
const { aplicarCorsSeguro } = require('../cors');
const { signJwt } = require('../crypto');
const { requireEnv } = require('../env');
const { despacharCorreoBienvenidaFreemium } = require('../email-templates');

const JWT_SECRET = requireEnv('JWT_SECRET', {
  testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232'
});

function resolverPortalUrl() {
  const candidate = (process.env.APP_URL || '').trim();
  try {
    if (candidate) {
      const url = new URL(candidate);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return url.origin;
      }
    }
  } catch (_) {}
  return 'https://origgo.online';
}

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METODO_NO_PERMITIDO', message: 'Método no permitido.' });
  }

  // 🛡️ Rate Limiting: Máximo 5 reclamos de regalo por hora por IP
  const unaHoraMs = 60 * 60 * 1000;
  if (!(await checkRateLimitAsync(req, res, {
    prefix: 'welcome_credit_ip',
    maxRequests: 5,
    windowMs: unaHoraMs,
    error: 'LIMITE_EXCEDIDO',
    message: 'Has alcanzado el límite de intentos de regalo permitidos por hora desde tu red. Intenta más tarde.'
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
  const validation = validateBody(welcomeCreditSchema, body);
  if (!validation.success) {
    return res.status(validation.status).json({
      ok: false,
      error: validation.error,
      message: validation.message,
      issues: validation.issues
    });
  }

  const { celular, email, lang } = validation.data;
  const isEn = lang === 'en';

  try {
    // 🛡️ Transacción Atómica en Base de Datos (Firestore / MemoryStore)
    const result = await db.claimWelcomeCredit(celular, email);

    if (!result.success) {
      if (result.alreadyClaimed) {
        return res.status(409).json({
          ok: false,
          error: 'CREDITO_YA_RECLAMADO',
          message: isEn
            ? 'This WhatsApp number has already claimed its free welcome credit.'
            : 'Este número de WhatsApp ya utilizó su crédito de bienvenida gratuito.'
        });
      }
      return res.status(400).json({
        ok: false,
        error: result.error || 'ERROR_RECLAMO',
        message: result.message || 'No fue posible activar el crédito de bienvenida.'
      });
    }

    const user = result.user;

    // Emisión de token JWT de 30 días para sesión inmediata sin fricción
    const token = signJwt({
      phone: user.phone,
      email: user.email || email,
      credits: user.credits,
      unlockedLeads: user.unlockedLeads || [],
      plan: user.plan || 'free',
      planCity: user.planCity || null,
      planExpiresAt: user.planExpiresAt || null,
      role: 'buyer'
    }, JWT_SECRET, 30);

    // Generar Magic Token para respaldo por correo
    const portalUrl = resolverPortalUrl();
    let magicUrl = `${portalUrl}?auth=success`;
    try {
      const magicTokenData = await db.createMagicToken(user.phone, user.email, 60 * 24 * 7);
      magicUrl = `${portalUrl}?magic_token=${magicTokenData.token}`;
    } catch (e) {
      console.warn('[welcome-credit] Error creando magic token:', e.message);
    }

    // Despacho asíncrono del correo de bienvenida con Magic Link y PIN vía Resend
    if (user.email && process.env.RESEND_API_KEY) {
      despacharCorreoBienvenidaFreemium({
        phone: user.phone,
        email: user.email,
        magicUrl,
        pin: user.pin,
        lang
      }).catch(err => {
        console.warn('[welcome-credit] Fallo silencioso en despacho de correo:', err.message);
      });
    }

    return res.status(200).json({
      ok: true,
      token,
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
        ? 'Welcome credit activated! You now have 1 free unlock ready to use.'
        : '¡Crédito de bienvenida activado! Tienes 1 desbloqueo directo listo para usar.'
    });
  } catch (err) {
    console.error('[welcome-credit] Error interno:', err);
    return res.status(500).json({
      ok: false,
      error: 'ERROR_INTERNO',
      message: isEn ? 'Internal server error processing welcome credit.' : 'Error interno procesando el crédito de bienvenida.'
    });
  }
};
