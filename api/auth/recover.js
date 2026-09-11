/**
 * 🔐 ENDPOINT DE RECUPERACIÓN DE ACCESO POR CORREO ELECTRÓNICO (PRODUCCIÓN)
 * Origgo Intelligence — Arquitectura DevSecOps
 * 
 * Flujo:
 * 1. Rate limiting estricto (máx 3 solicitudes/min por IP).
 * 2. Validación de formato de correo electrónico.
 * 3. Consulta estricta en base de datos (Firestore / Almacén Persistente).
 *    - Si no existe: Retorna respuesta genérica para evitar enumeración de cuentas.
 * 4. Despacho mediante Resend API con plantilla institucional.
 * 5. Remitente interno institucional (Origgo Seguridad Interna).
 * 6. Errores de infraestructura encapsulados sin filtrar detalles al cliente.
 */

const db = require('../../lib/db');
const crypto = require('crypto');
const { checkRateLimitAsync } = require('../../lib/rate-limiter');
const { recoverPinSchema, validateBody } = require('../../lib/validation');
const { aplicarCorsSeguro } = require('../../lib/cors');
const { signJwt } = require('../../lib/crypto');
const { requireEnv } = require('../../lib/env');
const { generarPlantillaRestauracion, generarPlantillaSinCreditos } = require('../../lib/email-templates');

const JWT_SECRET = requireEnv('JWT_SECRET', {
  testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232'
});

function resolverPortalUrlSeguro() {
  const fallback = 'https://origgo.online';
  const candidate = (process.env.APP_URL || fallback).trim();
  try {
    const url = new URL(candidate);
    if (url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return url.origin;
    }
  } catch (e) {}
  return fallback;
}

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 🛡️ Rate Limiting estricto: Máximo 3 solicitudes de recuperación por día (24h) por IP con Upstash Redis
  const unDiaMs = 24 * 60 * 60 * 1000;
  if (!(await checkRateLimitAsync(req, res, { 
    prefix: 'recover_pin_ip', 
    maxRequests: 3, 
    windowMs: unDiaMs,
    error: 'LIMITE_DIARIO_EXCEDIDO',
    message: 'Has alcanzado el límite máximo de 3 solicitudes de recuperación de PIN por día desde esta red o dispositivo. Por seguridad, intenta de nuevo en 24 horas o contacta a soporte.'
  }))) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METODO_NO_PERMITIDO', message: 'Método no permitido.' });
  }

  // 🛡️ Validación estricta con Zod
  const validation = validateBody(recoverPinSchema, req.body);
  if (!validation.success) {
    return res.status(validation.status).json({
      ok: false,
      error: validation.error,
      message: validation.message,
      issues: validation.issues
    });
  }

  const normEmail = validation.data.email;

  // 🛡️ Rate Limiting estricto por Correo: Máximo 3 solicitudes de recuperación por día para la misma cuenta con Upstash Redis
  if (!(await checkRateLimitAsync(req, res, { 
    prefix: 'recover_pin_email', 
    customKey: normEmail,
    maxRequests: 3, 
    windowMs: unDiaMs,
    error: 'LIMITE_DIARIO_EXCEDIDO',
    message: 'Has alcanzado el límite máximo de 3 solicitudes de recuperación de PIN por día para esta cuenta. Esta medida protege contra abusos y spam.'
  }))) {
    return;
  }

  const respuestaGenerica = {
    ok: true,
    message: 'Si existe una cuenta asociada, enviaremos instrucciones de recuperación.'
  };

  try {
    // 1. Buscar en la base de datos real
    let user = await db.getUserByEmail(normEmail);

    // 2. Si no se encontró directamente en usuarios, buscar órdenes pendientes o aprobadas
    if (!user && db.getPendingOrderByEmail) {
      const order = await db.getPendingOrderByEmail(normEmail);
      if (order && order.celular) {
        user = await db.getUserByPhone(order.celular);
        if (user) {
          user.email = normEmail;
        }
      }
    }

    if (!user || !user.pin) {
      return res.status(202).json(respuestaGenerica);
    }

    // 4. Validar configuración del proveedor Resend
    const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
    if (!resendApiKey) {
      console.error('[recover] RESEND_API_KEY no configurada');
      return res.status(202).json(respuestaGenerica);
    }

    // 5. Configurar remitente interno institucional (nunca onboarding@resend.dev)
    const remitenteInterno = (process.env.RESEND_FROM_EMAIL || 'Origgo Seguridad Interna <seguridad@resend.dev>').trim();

    // 6. Evaluar saldo de créditos y vigencia de membresía
    const tienePlanActivo = (user.plan === 'national' || user.plan === 'city') &&
      user.planExpiresAt &&
      new Date(user.planExpiresAt).getTime() > Date.now();
    const tieneCreditos = Number(user.credits || 0) > 0;

    const portalUrl = resolverPortalUrlSeguro();
    const horaDespacho = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });
    const refAleatoria = Math.floor(1000 + Math.random() * 9000);
    let asuntoEmail = '';
    let htmlBody = '';

    if (tienePlanActivo || tieneCreditos) {
      // 7a. Usuario con saldo o plan activo: generar token JWT y enlace de restauración seguro
      const recoveryUrl = new URL(portalUrl);
      const recoveryToken = signJwt({
        purpose: 'recover_session',
        phone: user.phone,
        email: normEmail,
        nonce: crypto.randomUUID(),
        role: 'recovery'
      }, JWT_SECRET, 15 / (24 * 60));
      recoveryUrl.searchParams.set('recovery_token', recoveryToken);

      asuntoEmail = `Restauración de acceso Origgo · [Ref: ${refAleatoria}-${horaDespacho}]`;
      htmlBody = generarPlantillaRestauracion({
        phone: user.phone,
        email: normEmail,
        recoveryUrl: recoveryUrl.href,
        credits: Number(user.credits || 0),
        plan: user.plan,
        planCity: user.planCity
      });
    } else {
      // 7b. Usuario registrado sin créditos ni plan: aviso formal con enlace para recargar
      const checkoutUrl = new URL(portalUrl);
      checkoutUrl.searchParams.set('modal', 'checkout');
      if (user.phone) {
        checkoutUrl.searchParams.set('phone', user.phone);
      }

      asuntoEmail = `Estado de cuenta Origgo · Saldo actual: 0 créditos [Ref: ${refAleatoria}-${horaDespacho}]`;
      htmlBody = generarPlantillaSinCreditos({
        phone: user.phone,
        email: normEmail,
        checkoutUrl: checkoutUrl.href
      });
    }

    // 8. Enviar a través de la API oficial de Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: remitenteInterno,
        to: normEmail,
        subject: asuntoEmail,
        html: htmlBody
      })
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('[recover] Error reportado por Resend API:', resendResponse.status, errorText.slice(0, 200));
    }

    return res.status(202).json(respuestaGenerica);

  } catch (error) {
    console.error('[recover] Error no controlado en recuperación:', error);
    return res.status(202).json(respuestaGenerica);
  }
};
