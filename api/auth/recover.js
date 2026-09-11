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

const JWT_SECRET = requireEnv('JWT_SECRET', {
  testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232'
});

function resolverPortalUrlSeguro() {
  const fallback = 'https://origgo.vercel.app';
  const candidate = (process.env.APP_URL || fallback).trim();
  try {
    const url = new URL(candidate);
    if (url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return url.origin;
    }
  } catch (e) {}
  return fallback;
}

/**
 * Genera el cuerpo HTML de ultra prestigio y lujo arquitectónico para el correo electrónico.
 * Diseñado en MODO CLARO oficial de Origgo (Salvia Lino Porcelana y Esmeralda de Prestigio).
 * Compatible con todos los clientes de correo (Gmail, Apple Mail, Outlook, web) evitando colapsos.
 */
function generarPlantillaLujo({ phone, email, recoveryUrl }) {
  const anio = new Date().getFullYear();
  const urlDestino = recoveryUrl || 'https://origgo.vercel.app';
  const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es" xml:lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Acceso Confidencial Origgo</title>
  <!--[if !mso]><!-->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <!--<![endif]-->
  <style type="text/css">
    /* Reset canónico y prevención de sobreescritura de clientes */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #E4EEE7 !important; }
    
    /* 🛡️ CERO COLOR AZUL EN NÚMEROS DE TELÉFONO O ENLACES AUTOMÁTICOS DE GMAIL / APPLE */
    a[x-apple-data-detectors],
    .x-gmail-data-detectors,
    .x-gmail-data-detectors *,
    .aBn {
      border-bottom: 0 !important;
      cursor: default !important;
      color: #0A110E !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }
    .phone-link-clean,
    .phone-link-clean span {
      color: #0A110E !important;
      text-decoration: none !important;
      -webkit-text-fill-color: #0A110E !important;
    }
    
    /* Forzar modo claro institucional de Origgo */
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background-color: #E4EEE7 !important; }
      .card-wrap { background-color: #FFFFFF !important; color: #0A110E !important; }
      .text-main { color: #0A110E !important; }
      .text-muted { color: #2E3B35 !important; }
      .phone-link-clean, .phone-link-clean span { color: #0A110E !important; }
    }
  </style>
</head>
<body class="email-bg" style="margin: 0; padding: 0; background-color: #E4EEE7; font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0A110E;">
  
  <!-- PREHEADER INVISIBLE ANTI-COLAPSO (Evita que Gmail muestre citas o texto recortado) -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #E4EEE7; opacity: 0;">
    Tu acceso confidencial Origgo está listo. Abre este mensaje para restaurar tus credenciales de la terminal.
    &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy;
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #E4EEE7; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- TARJETA PRINCIPAL BLANCO ARQUITECTÓNICO ORIGGO -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="card-wrap" style="max-width: 580px; background-color: #FFFFFF; border: 1px solid #CBDAD0; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 36px -8px rgba(5, 31, 32, 0.09);">
          
          <!-- LÍNEA SUPERIOR DE PRESTIGIO ESMERALDA Y ORO -->
          <tr>
            <td height="5" style="background: linear-gradient(90deg, #047857 0%, #059669 35%, #10B981 70%, #D97706 100%);"></td>
          </tr>

          <!-- CABECERA INSTITUCIONAL ORIGGO (PALABRA CENTRAL EN TIPOGRAFÍA LUFGA OFICIAL) -->
          <tr>
            <td style="padding: 40px 40px 24px 40px; text-align: center; border-bottom: 1px solid #EBF2ED;">
              
              <!-- PALABRA ORIGGO CENTRADA Y ELEGANTE (TIPOGRAFÍA LUFGA / PLUS JAKARTA SANS) -->
              <h1 style="margin: 0; padding: 0; font-family: 'Lufga', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 40px; font-weight: 800; letter-spacing: -1.2px; color: #047857; line-height: 1; text-align: center;">
                Origgo
              </h1>

              <!-- SUBTÍTULO EDITORIAL INSTITUCIONAL -->
              <p style="margin: 10px 0 0 0; font-family: 'Lufga', 'Plus Jakarta Sans', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2.2px; color: #059669; text-transform: uppercase;">
                TERMINAL CENTRAL • SEGURIDAD Y ACCESOS
              </p>
            </td>
          </tr>

          <!-- CUERPO PRINCIPAL DEL CORREO -->
          <tr>
            <td style="padding: 34px 40px;">
              
              <!-- BADGE VIP EN ORO PURO (Cero diamantes azules) -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 22px auto;">
                <tr>
                  <td style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 9999px; padding: 6px 16px; text-align: center;">
                    <span style="color: #B45309; font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; font-family: 'Lufga', 'Plus Jakarta Sans', sans-serif; display: inline-block;">
                      <span style="color: #D97706; margin-right: 5px; font-size: 13px;">👑</span> ACCESO VIP AUTORIZADO
                    </span>
                  </td>
                </tr>
              </table>

              <!-- TÍTULO DE RESTAURACIÓN -->
              <h2 class="text-main" style="margin: 0 0 10px 0; font-family: 'Lufga', 'Plus Jakarta Sans', -apple-system, sans-serif; font-size: 22px; font-weight: 800; color: #0A110E; line-height: 1.3; text-align: center;">
                Restauración de Credenciales
              </h2>
              
              <p class="text-muted" style="margin: 0 0 28px 0; font-family: 'Inter', -apple-system, sans-serif; font-size: 14px; line-height: 1.6; color: #2E3B35; text-align: center;">
                Se ha procesado una solicitud formal de autenticación para la plataforma Origgo. Usa el enlace temporal de restauración para volver a tu cuenta sin exponer tu PIN permanente.
              </p>

              <!-- PANEL WHATSAPP VINCULADO (CERO AZUL, NÚMEROS LIMPIOS SIN MONOSPACE TOSCO) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F2F7F4; border: 1px solid #D5E2D9; border-radius: 12px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <span style="display: block; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; color: #4B6358; text-transform: uppercase; margin-bottom: 6px; font-family: 'Lufga', 'Plus Jakarta Sans', sans-serif;">
                      LÍNEA MÓVIL REGISTRADA
                    </span>
                    <!-- Envoltorio blindado contra enlaces automáticos azules de Gmail e iOS -->
                    <a href="tel:+57${cleanPhone}" class="phone-link-clean" style="color: #0A110E !important; text-decoration: none !important; pointer-events: none; font-family: 'Lufga', 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif; font-size: 19px; font-weight: 700; letter-spacing: 0.5px; display: inline-block;">
                      <span style="color: #0A110E !important; text-decoration: none !important; font-family: inherit;">+57 ${phone}</span>
                    </a>
                  </td>
                </tr>
              </table>

              <!-- PANEL DE ENLACE TEMPORAL DE RESTAURACIÓN -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: linear-gradient(180deg, #F4F9F6 0%, #EBF4EE 100%); border: 1.5px solid #059669; border-radius: 16px; margin-bottom: 26px; box-shadow: 0 8px 20px rgba(5, 150, 105, 0.08);">
                <tr>
                  <td style="padding: 26px 20px; text-align: center;">
                    <span style="display: block; font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #047857; text-transform: uppercase; margin-bottom: 14px; font-family: 'Lufga', 'Plus Jakarta Sans', sans-serif;">
                      ENLACE TEMPORAL DE RESTAURACIÓN
                    </span>
                    
                    <div style="background-color: #FFFFFF; border: 1.5px solid #10B981; border-radius: 12px; padding: 14px 28px; display: inline-block; margin: 0 auto; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.1);">
                      <a href="${urlDestino}" target="_blank" style="font-size: 14px; font-weight: 800; letter-spacing: 1px; color: #047857; font-family: 'Lufga', 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif; display: inline-block; line-height: 1.4; text-decoration: none; text-transform: uppercase;">
                        Restaurar mi acceso seguro
                      </a>
                    </div>
                    
                    <span style="display: block; font-size: 12px; color: #374640; margin-top: 14px; font-family: 'Inter', sans-serif;">
                      Este enlace expira en 15 minutos. Si no solicitaste esta restauración, ignora este mensaje.
                    </span>
                  </td>
                </tr>
              </table>

              <!-- BOTÓN DE ACCIÓN INSTITUCIONAL DIRECTO -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 26px;">
                <tr>
                  <td align="center">
                    <a href="${urlDestino}" target="_blank" style="background-color: #059669; color: #FFFFFF; font-family: 'Lufga', 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 1px; padding: 15px 32px; border-radius: 9999px; text-decoration: none; display: inline-block; text-transform: uppercase; box-shadow: 0 6px 18px rgba(5, 150, 105, 0.25);">
                      RESTAURAR MI TERMINAL ORIGGO &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- AVISO DE PROTOCOLO DE SEGURIDAD ANTI-FRAUDE -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <p style="margin: 0; font-family: 'Inter', sans-serif; font-size: 12px; line-height: 1.5; color: #4B5563;">
                      🛡️ <strong style="color: #991B1B;">Protocolo Anti-Fraude:</strong> Este enlace es personal y temporal. El equipo de Origgo jamás te solicitará tu PIN por correo, WhatsApp o llamada telefónica.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- PIE DE PÁGINA INSTITUCIONAL -->
          <tr>
            <td style="padding: 24px 40px; background-color: #F2F7F4; border-top: 1px solid #E1EBE4; text-align: center;">
              <p style="margin: 0 0 6px 0; font-family: 'Inter', sans-serif; font-size: 11px; color: #4B5563;">
                Mensaje generado por el Núcleo de Seguridad Central de Origgo para <strong style="color: #0A110E;">${email}</strong>.
              </p>
              <p style="margin: 0; font-family: 'Inter', sans-serif; font-size: 10.5px; color: #6B7280;">
                &copy; ${anio} Origgo Intelligence — Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

    // 6. Determinar URL pública del portal para el botón de acceso directo
    const portalUrl = resolverPortalUrlSeguro();
    const recoveryUrl = new URL(portalUrl);
    const recoveryToken = signJwt({
      purpose: 'recover_session',
      phone: user.phone,
      email: normEmail,
      nonce: crypto.randomUUID(),
      role: 'recovery'
    }, JWT_SECRET, 15 / (24 * 60));
    recoveryUrl.searchParams.set('recovery_token', recoveryToken);

    // 7. Generar plantilla HTML de ultra prestigio y lujo arquitectónico (Modo Claro Origgo)
    const htmlBody = generarPlantillaLujo({
      phone: user.phone,
      email: normEmail,
      recoveryUrl: recoveryUrl.href
    });

    const horaDespacho = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });
    const refAleatoria = Math.floor(1000 + Math.random() * 9000);
    const asuntoEmail = `Restauración de acceso Origgo · [Ref: ${refAleatoria}-${horaDespacho}]`;

    // 9. Enviar a través de la API oficial de Resend
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
