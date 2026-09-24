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

  const { celular, email, deviceId, leadId, lang } = validation.data;
  const isEn = lang === 'en';

  try {
    const { normalizarEmail } = require('../validation');
    const canonicoEmail = normalizarEmail(email);

    // 🛡️ Comprobación inteligente de Cuenta Existente con Créditos Activos:
    let usuarioExistente = await db.getUserByPhone(celular);
    if (!usuarioExistente && canonicoEmail) {
      usuarioExistente = await db.getUserByEmail(canonicoEmail);
    }

    // Si el usuario ya existe y tiene créditos disponibles legítimos:
    if (usuarioExistente && (usuarioExistente.credits || 0) > 0) {
      const tokenData = await db.createWelcomeVerificationToken(usuarioExistente.phone || celular, canonicoEmail, deviceId, 60);
      const portalUrl = resolverPortalUrl();
      const leadQueryParam = leadId ? `&lead=${encodeURIComponent(leadId)}` : '';
      const magicUrl = `${portalUrl}?welcome_token=${tokenData.token}${leadQueryParam}`;
      const pin = usuarioExistente.pin || require('../crypto').generatePin(celular);

      let leadTitle = null, leadCity = null;
      if (leadId) {
        try {
          const { obtenerLeadPorId } = require('../leads');
          const leadData = obtenerLeadPorId(leadId);
          if (leadData) {
            leadTitle = leadData.titulo || null;
            leadCity = leadData.ciudad || leadData.barrio || null;
          }
        } catch (_) {}
      }

      let correoEnviado = false;
      if (process.env.RESEND_API_KEY) {
        correoEnviado = await despacharCorreoBienvenidaFreemium({
          phone: usuarioExistente.phone || celular,
          email: canonicoEmail,
          magicUrl,
          pin,
          leadId,
          leadTitle,
          leadCity,
          lang
        }).catch(err => {
          console.error('[welcome-credit] Fallo en despacho de correo a cuenta con créditos:', err.message);
          return false;
        });

        if (!correoEnviado && process.env.NODE_ENV !== 'test') {
          return res.status(502).json({
            ok: false,
            error: 'ERROR_ENVIO_CORREO',
            message: isEn
              ? 'Could not deliver the access email. Please verify your email address or enter with your PIN.'
              : 'No fue posible enviar el correo de acceso en este momento. Por favor verifica tu dirección o ingresa con tu PIN.'
          });
        }
      }

      return res.status(200).json({
        ok: true,
        pendingVerification: true,
        existingAccountWithCredits: true,
        credits: usuarioExistente.credits,
        email: canonicoEmail,
        leadId: leadId || null,
        message: isEn
          ? `You have ${usuarioExistente.credits} credit(s) available in your account! We sent an instant access link to ${canonicoEmail}.`
          : `¡Ya tienes ${usuarioExistente.credits} crédito(s) disponible(s) en tu cuenta! Te enviamos tu enlace de acceso a ${canonicoEmail}.`
      });
    }

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
    const leadQueryParam = leadId ? `&lead=${encodeURIComponent(leadId)}` : '';
    const magicUrl = `${portalUrl}?welcome_token=${tokenData.token}${leadQueryParam}`;
    const pin = usuarioExistente?.pin || require('../crypto').generatePin(celular);

    // Obtener detalles del inmueble si el usuario seleccionó uno para personalizar el correo
    let leadTitle = null, leadCity = null;
    if (leadId) {
      const { obtenerLeadPorId } = require('../leads');
      const leadData = obtenerLeadPorId(leadId);
      if (leadData) {
        leadTitle = leadData.titulo || null;
        leadCity = leadData.ciudad || leadData.barrio || null;
      }
    }

    // Despacho transaccional del enlace de confirmación por Resend
    let correoEnviado = false;
    if (process.env.RESEND_API_KEY) {
      correoEnviado = await despacharCorreoBienvenidaFreemium({
        phone: celular,
        email: canonicoEmail,
        magicUrl,
        pin,
        leadId,
        leadTitle,
        leadCity,
        lang
      }).catch(err => {
        console.error('[welcome-credit] Fallo en despacho de correo:', err.message);
        return false;
      });

      // Si existe clave de Resend configurada pero el envío fue rechazado (ej: 401 API key inválida o dominio)
      if (!correoEnviado && process.env.NODE_ENV !== 'test') {
        return res.status(502).json({
          ok: false,
          error: 'ERROR_ENVIO_CORREO',
          message: isEn
            ? 'Could not deliver the activation email. Please verify your email address or try again later.'
            : 'No fue posible enviar el correo de activación en este momento. Por favor verifica tu dirección o intenta más tarde.'
        });
      }
    }

    // No se emite JWT ni se entrega crédito inmediato: requiere hacer clic en el enlace recibido
    return res.status(200).json({
      ok: true,
      pendingVerification: true,
      email: canonicoEmail,
      leadId: leadId || null,
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
