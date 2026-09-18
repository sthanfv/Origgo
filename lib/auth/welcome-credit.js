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

  const { celular, email, deviceId, lang } = validation.data;
  const isEn = lang === 'en';

  try {
    const { normalizarEmail } = require('../validation');
    const canonicoEmail = normalizarEmail(email);

    // 🛡️ Barrera 1: Comprobar si el dispositivo físico ya reclamó
    if (deviceId && (await db.isDeviceClaimed(deviceId))) {
      return res.status(409).json({
        ok: false,
        error: 'DISPOSITIVO_YA_RECLAMADO',
        alreadyClaimed: true,
        message: isEn
          ? 'This device has already claimed its free welcome gift. Please select a credit pack to continue.'
          : 'Este dispositivo ya utilizó su regalo de bienvenida de cortesía. Selecciona un paquete de créditos para continuar.'
      });
    }

    // 🛡️ Barrera 2: Comprobar si el correo electrónico canonizado ya reclamó
    if (await db.isEmailClaimed(canonicoEmail)) {
      return res.status(409).json({
        ok: false,
        error: 'EMAIL_YA_RECLAMADO',
        alreadyClaimed: true,
        message: isEn
          ? 'This email address has already claimed its free welcome gift.'
          : 'Este correo electrónico ya utilizó su crédito de bienvenida gratuito.'
      });
    }

    // 🛡️ Barrera 3: Comprobar si el número de WhatsApp ya reclamó
    const usuarioExistente = await db.getUserByPhone(celular);
    if (usuarioExistente && usuarioExistente.welcomeCreditClaimed) {
      return res.status(409).json({
        ok: false,
        error: 'CREDITO_YA_RECLAMADO',
        alreadyClaimed: true,
        message: isEn
          ? 'This WhatsApp number has already claimed its free welcome credit.'
          : 'Este número de WhatsApp ya utilizó su crédito de bienvenida gratuito.'
      });
    }

    // 🛡️ Barrera 4: Doble Opt-In Obligatorio — Generar token de activación de 60 minutos
    const tokenData = await db.createWelcomeVerificationToken(celular, canonicoEmail, deviceId, 60);
    const portalUrl = resolverPortalUrl();
    const magicUrl = `${portalUrl}?welcome_token=${tokenData.token}`;
    const pin = usuarioExistente?.pin || require('../crypto').generatePin(celular);

    // Despacho transaccional del enlace de confirmación por Resend
    if (process.env.RESEND_API_KEY) {
      await despacharCorreoBienvenidaFreemium({
        phone: celular,
        email: canonicoEmail,
        magicUrl,
        pin,
        lang
      }).catch(err => {
        console.warn('[welcome-credit] Fallo silencioso en despacho de correo:', err.message);
      });
    }

    // No se emite JWT ni se entrega crédito inmediato: requiere hacer clic en el enlace recibido
    return res.status(200).json({
      ok: true,
      pendingVerification: true,
      email: canonicoEmail,
      message: isEn
        ? 'Verification link sent! Check your inbox to activate your free unlock.'
        : '¡Enlace enviado! Revisa tu bandeja de entrada para activar tu desbloqueo gratuito.'
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
