/**
 * 🔐 ENDPOINT DE SOLICITUD DE MAGIC LINK (ACCESO SIN CONTRASEÑA POR EMAIL)
 * POST /api/auth/magic-link
 * 
 * Permite al usuario solicitar un enlace de acceso de 1 solo uso a su correo electrónico.
 * Protegido contra enumeración de cuentas y ataques de fuerza bruta.
 */

const db = require('../db');
const { checkRateLimitAsync } = require('../rate-limiter');
const { magicLinkRequestSchema, validateBody } = require('../validation');
const { aplicarCorsSeguro } = require('../cors');
const { despacharCorreoMagicLink } = require('../email-templates');

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

  // 🛡️ Rate Limiting: Máximo 5 solicitudes de enlace de acceso seguro por hora por IP
  const unaHoraMs = 60 * 60 * 1000;
  if (!(await checkRateLimitAsync(req, res, {
    prefix: 'magic_link_ip',
    maxRequests: 5,
    windowMs: unaHoraMs,
    error: 'LIMITE_EXCEDIDO',
    message: 'Has solicitado demasiados enlaces de acceso recientemente. Por favor espera antes de intentar nuevamente.'
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
  const validation = validateBody(magicLinkRequestSchema, body);
  if (!validation.success) {
    return res.status(validation.status).json({
      ok: false,
      error: validation.error,
      message: validation.message,
      issues: validation.issues
    });
  }

  const { identifier, lang } = validation.data;
  const isEn = lang === 'en';
  const cleanId = identifier.trim().toLowerCase();

  const respuestaGenerica = {
    ok: true,
    message: isEn
      ? 'If an associated account exists, a secure sign-in link has been sent to your email.'
      : 'Si existe una cuenta asociada, hemos enviado un enlace de acceso seguro a tu correo electrónico.'
  };

  try {
    // Buscar usuario por correo o por teléfono
    let user = null;
    if (cleanId.includes('@')) {
      user = await db.getUserByEmail(cleanId);
    } else {
      user = await db.getUserByPhone(cleanId);
    }

    // Si el usuario existe y tiene un correo asociado registrado
    if (user && user.email) {
      // 🛡️ Rate Limiting por cuenta: Máximo 3 enlaces por hora para el mismo correo
      if (!(await checkRateLimitAsync(req, res, {
        prefix: 'magic_link_acc',
        customKey: user.email.toLowerCase().trim(),
        maxRequests: 3,
        windowMs: unaHoraMs,
        error: 'LIMITE_EXCEDIDO',
        message: 'Límite de solicitudes alcanzado para esta cuenta. Revisa tu bandeja de entrada o intenta más tarde.'
      }))) {
        return;
      }

      const portalUrl = resolverPortalUrl();
      const magicTokenData = await db.createMagicToken(user.phone, user.email, 30); // 30 minutos de vigencia
      const magicUrl = `${portalUrl}?magic_token=${magicTokenData.token}`;

      if (process.env.RESEND_API_KEY) {
        despacharCorreoMagicLink({
          phone: user.phone,
          email: user.email,
          magicUrl,
          lang
        }).catch(err => {
          console.warn('[magic-link] Error despachando correo:', err.message);
        });
      }
    }

    return res.status(200).json(respuestaGenerica);
  } catch (err) {
    console.error('[magic-link] Error interno:', err);
    return res.status(500).json({
      ok: false,
      error: 'ERROR_INTERNO',
      message: isEn ? 'Internal error processing access link.' : 'Error interno al procesar el enlace de acceso.'
    });
  }
};
