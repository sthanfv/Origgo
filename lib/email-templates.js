/**
 * 📧 PLANTILLAS INSTITUCIONALES DE CORREO ELECTRÓNICO (MODO CLARO ORIGGO)
 * Origgo Intelligence — Arquitectura DevSecOps
 * 
 * Reglas de diseño:
 *  1. Compatible con Gmail, Apple Mail, Outlook y clientes web sin colapsos.
 *  2. Paleta institucional: Salvia Lino Porcelana (#E4EEE7, #FFFFFF) y Esmeralda (#059669, #0a9f68).
 *  3. Cero enlaces azules automáticos en números celulares.
 *  4. Un único botón principal de llamada a la acción (CTA) para evitar duplicidades.
 *  5. Enlaces canónicos estrictos a https://origgo.online/.
 */

/**
 * Genera la plantilla institucional de restauración para usuarios con créditos o plan activo.
 * @param {object} params
 * @param {string} params.phone
 * @param {string} params.email
 * @param {string} params.recoveryUrl
 * @param {number} [params.credits]
 * @param {string} [params.plan]
 * @param {string} [params.planCity]
 * @returns {string} HTML completo del correo
 */
function generarPlantillaRestauracion({ phone, email, recoveryUrl, credits, plan, planCity }) {
  const anio = new Date().getFullYear();
  const urlDestino = recoveryUrl || 'https://origgo.online';

  let badgeMembresia = '👑 ACCESO VIP AUTORIZADO';
  let detalleSaldo = 'Saldo disponible: <strong>Acceso Activo</strong>';

  if (plan === 'national') {
    badgeMembresia = '👑 MEMBRESÍA VIP NACIONAL';
    detalleSaldo = 'Plan activo: <strong>Nacional (Acceso Total Ilimitado)</strong>';
  } else if (plan === 'city') {
    badgeMembresia = `👑 MEMBRESÍA VIP ${String(planCity || 'CIUDAD').toUpperCase()}`;
    detalleSaldo = `Plan activo: <strong>Pro ${planCity || 'Ciudad'} (Acceso Ilimitado)</strong>`;
  } else if (typeof credits === 'number' && credits > 0) {
    detalleSaldo = `Saldo disponible: <strong>⚡ ${credits} ${credits === 1 ? 'Crédito' : 'Créditos'}</strong>`;
  }

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es" xml:lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>Acceso Confidencial Origgo</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #E4EEE7 !important; }
    a[x-apple-data-detectors], .x-gmail-data-detectors, .x-gmail-data-detectors *, .aBn {
      border-bottom: 0 !important; cursor: default !important; color: #0A110E !important; text-decoration: none !important;
    }
    .phone-link-clean, .phone-link-clean span { color: #0A110E !important; text-decoration: none !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #E4EEE7; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0A110E;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #E4EEE7; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border: 1px solid #CBDAD0; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 36px -8px rgba(5, 31, 32, 0.09);">
          <tr>
            <td height="5" style="background: linear-gradient(90deg, #047857 0%, #059669 35%, #10B981 70%, #D97706 100%);"></td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 24px 40px; text-align: center; border-bottom: 1px solid #EBF2ED;">
              <h1 style="margin: 0; font-size: 38px; font-weight: 800; letter-spacing: -1.2px; color: #047857; line-height: 1;">Origgo</h1>
              <p style="margin: 10px 0 0 0; font-size: 11px; font-weight: 700; letter-spacing: 2.2px; color: #059669; text-transform: uppercase;">
                TERMINAL CENTRAL • SEGURIDAD Y ACCESOS
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 34px 40px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                <tr>
                  <td style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 9999px; padding: 6px 18px; text-align: center;">
                    <span style="color: #B45309; font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase;">
                      ${badgeMembresia}
                    </span>
                  </td>
                </tr>
              </table>

              <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 800; color: #0A110E; line-height: 1.3; text-align: center;">
                Restauración de Credenciales
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #2E3B35; text-align: center;">
                Se ha procesado una solicitud formal de autenticación para la plataforma Origgo. Usa tu enlace temporal de restauración para acceder a tu sesión sin exponer tu PIN maestro.
              </p>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F2F7F4; border: 1px solid #D5E2D9; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <span style="display: block; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; color: #4B6358; text-transform: uppercase; margin-bottom: 4px;">
                      LÍNEA MÓVIL REGISTRADA
                    </span>
                    <span style="font-size: 19px; font-weight: 700; color: #0A110E; letter-spacing: 0.5px;">+57 ${phone}</span>
                    <span style="display: block; font-size: 12px; color: #047857; margin-top: 6px;">
                      ${detalleSaldo}
                    </span>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${urlDestino}" target="_blank" style="background-color: #059669; color: #FFFFFF; font-size: 14px; font-weight: 800; letter-spacing: 0.8px; padding: 16px 36px; border-radius: 9999px; text-decoration: none; display: inline-block; text-transform: uppercase; box-shadow: 0 6px 18px rgba(5, 150, 105, 0.25);">
                      RESTAURAR MI ACCESO SEGURO &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 22px 0; font-size: 12px; color: #4B6358; text-align: center; line-height: 1.5;">
                Este enlace expira en 15 minutos por seguridad. Si no solicitaste esta restauración, ignora este mensaje.
              </p>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0; font-size: 11.5px; line-height: 1.5; color: #4B5563;">
                      🛡️ <strong style="color: #991B1B;">Protocolo Anti-Fraude:</strong> Este enlace es personal e intransferible. El equipo de Origgo jamás solicitará tu PIN por correo o WhatsApp.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #F2F7F4; border-top: 1px solid #E1EBE4; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #4B5563;">
                Mensaje generado por el Núcleo de Seguridad Central de Origgo para <strong style="color: #0A110E;">${email}</strong>.
              </p>
              <p style="margin: 0; font-size: 10.5px; color: #6B7280;">
                &copy; ${anio} Origgo Intelligence (<a href="https://origgo.online" style="color: #059669; text-decoration: none;">origgo.online</a>) — Todos los derechos reservados.
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

/**
 * Genera la plantilla de aviso formal para usuarios registrados pero sin créditos activos.
 * @param {object} params
 * @param {string} params.phone
 * @param {string} params.email
 * @param {string} params.checkoutUrl
 * @returns {string} HTML completo del correo
 */
function generarPlantillaSinCreditos({ phone, email, checkoutUrl }) {
  const anio = new Date().getFullYear();
  const urlDestino = checkoutUrl || 'https://origgo.online';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es" xml:lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>Estado de Cuenta Origgo</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #E4EEE7 !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #E4EEE7; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0A110E;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #E4EEE7; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border: 1px solid #CBDAD0; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 36px -8px rgba(5, 31, 32, 0.09);">
          <tr>
            <td height="5" style="background: linear-gradient(90deg, #F59E0B 0%, #D97706 50%, #B45309 100%);"></td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 24px 40px; text-align: center; border-bottom: 1px solid #EBF2ED;">
              <h1 style="margin: 0; font-size: 38px; font-weight: 800; letter-spacing: -1.2px; color: #047857; line-height: 1;">Origgo</h1>
              <p style="margin: 10px 0 0 0; font-size: 11px; font-weight: 700; letter-spacing: 2.2px; color: #059669; text-transform: uppercase;">
                TERMINAL CENTRAL • ESTADO DE CUENTA
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 34px 40px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
                <tr>
                  <td style="background-color: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 9999px; padding: 6px 18px; text-align: center;">
                    <span style="color: #475569; font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase;">
                      ⚡ SALDO ACTUAL: 0 CRÉDITOS
                    </span>
                  </td>
                </tr>
              </table>

              <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #0A110E; line-height: 1.3; text-align: center;">
                Línea Registrada sin Créditos Activos
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #2E3B35; text-align: center;">
                Tu número móvil <strong style="color: #0A110E;">+57 ${phone}</strong> está registrado en el ledger de Origgo, pero actualmente <strong>no cuenta con créditos de desbloqueo ni suscripción activa</strong>.
              </p>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAF9; border: 1.5px dashed #CBDAD0; border-radius: 14px; margin-bottom: 26px;">
                <tr>
                  <td style="padding: 20px;">
                    <span style="display: block; font-size: 12px; font-weight: 800; color: #047857; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px;">
                      OPCIONES DISPONIBLES PARA TU LÍNEA:
                    </span>
                    <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #374640; line-height: 1.7;">
                      <li><strong>Paquetes de Créditos:</strong> Desde 1 hasta 10 desbloqueos directos.</li>
                      <li><strong>Plan Ciudad (30 días):</strong> Contacto ilimitado con propietarios en tu zona.</li>
                      <li><strong>Plan Nacional (30 días):</strong> Acceso ilimitado a todo el catálogo del país.</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${urlDestino}" target="_blank" style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #FFFFFF; font-size: 14px; font-weight: 800; letter-spacing: 0.8px; padding: 16px 36px; border-radius: 9999px; text-decoration: none; display: inline-block; text-transform: uppercase; box-shadow: 0 6px 18px rgba(5, 150, 105, 0.25);">
                      ACTIVAR CRÉDITOS O PLAN PRO &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; color: #64748B; text-align: center; line-height: 1.5;">
                Una vez acreditado tu saldo, podrás desbloquear de inmediato los teléfonos y enlaces directos de WhatsApp de los propietarios sin pagar comisiones a inmobiliarias.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #F2F7F4; border-top: 1px solid #E1EBE4; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #4B5563;">
                Mensaje generado automáticamente para <strong style="color: #0A110E;">${email}</strong>.
              </p>
              <p style="margin: 0; font-size: 10.5px; color: #6B7280;">
                &copy; ${anio} Origgo Intelligence (<a href="https://origgo.online" style="color: #059669; text-decoration: none;">origgo.online</a>) — Todos los derechos reservados.
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

/**
 * Genera la plantilla institucional de recibo de pago y entrega de PIN maestro con Magic Link.
 * @param {object} params
 * @param {string} params.phone
 * @param {string} params.email
 * @param {string} params.reference
 * @param {string} [params.productName]
 * @param {number} params.amountInCents
 * @param {string} params.pin
 * @param {number} [params.credits]
 * @param {string} [params.plan]
 * @param {string} [params.planCity]
 * @param {string} params.magicUrl
 * @returns {string} HTML completo del correo
 */
function generarPlantillaConfirmacionPago({ phone, email, reference, productName, amountInCents, pin, credits, plan, planCity, magicUrl }) {
  const anio = new Date().getFullYear();
  const urlDestino = magicUrl || 'https://origgo.online';
  const montoCop = `$ ${Math.round((amountInCents || 0) / 100).toLocaleString('es-CO')} COP`;

  let detalleBeneficio = `Saldo disponible: <strong>⚡ ${credits || 0} Créditos directos</strong>`;
  let badgeTitulo = '🎉 PAGO EXITOSO Y ACREDITADO';

  if (plan === 'national') {
    badgeTitulo = '👑 MEMBRESÍA VIP NACIONAL ACTIVA';
    detalleBeneficio = 'Plan activo: <strong>Nacional (30 días ilimitados en todo Colombia)</strong>';
  } else if (plan === 'city') {
    badgeTitulo = `👑 MEMBRESÍA PRO ${String(planCity || 'CIUDAD').toUpperCase()} ACTIVA`;
    detalleBeneficio = `Plan activo: <strong>Pro ${planCity || 'Ciudad'} (30 días ilimitados)</strong>`;
  }

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es" xml:lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>Comprobante de Pago y Acceso Origgo</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #E4EEE7 !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #E4EEE7; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0A110E;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #E4EEE7; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border: 1px solid #CBDAD0; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 36px -8px rgba(5, 31, 32, 0.09);">
          <tr>
            <td height="5" style="background: linear-gradient(90deg, #047857 0%, #059669 35%, #10B981 70%, #059669 100%);"></td>
          </tr>
          <tr>
            <td style="padding: 36px 40px 20px 40px; text-align: center; border-bottom: 1px solid #EBF2ED;">
              <h1 style="margin: 0; font-size: 38px; font-weight: 800; letter-spacing: -1.2px; color: #047857; line-height: 1;">Origgo</h1>
              <p style="margin: 8px 0 0 0; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #059669; text-transform: uppercase;">
                COMPROBANTE OFICIAL DE PAGO Y ACCESO DIRECTO
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 18px auto;">
                <tr>
                  <td style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 9999px; padding: 6px 18px; text-align: center;">
                    <span style="color: #065F46; font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase;">
                      ${badgeTitulo}
                    </span>
                  </td>
                </tr>
              </table>

              <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 800; color: #0A110E; line-height: 1.3; text-align: center;">
                ¡Tu acceso está listo y activado!
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #2E3B35; text-align: center;">
                Hemos confirmado tu pago de forma segura a través de Wompi. Ya puedes consultar y contactar a propietarios directos sin intermediarios.
              </p>

              <!-- Caja del PIN Maestro -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAF9; border: 2px solid #059669; border-radius: 14px; margin-bottom: 24px; text-align: center;">
                <tr>
                  <td style="padding: 20px;">
                    <span style="display: block; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #047857; text-transform: uppercase; margin-bottom: 6px;">
                      TU CÓDIGO DE ACCESO (PIN)
                    </span>
                    <span style="font-family: 'SFMono-Regular', Consolas, Menlo, monospace; font-size: 28px; font-weight: 800; color: #064E3B; letter-spacing: 3px;">
                      ${pin}
                    </span>
                    <span style="display: block; font-size: 11px; color: #4B6358; margin-top: 6px;">
                      Guarda este código para ingresar o restaurar tu cuenta en cualquier dispositivo.
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Detalle de la Orden -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F2F7F4; border: 1px solid #D5E2D9; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size: 12px; color: #4B6358; padding-bottom: 8px;"><strong>Referencia Wompi:</strong></td>
                        <td align="right" style="font-size: 12px; color: #0A110E; padding-bottom: 8px; font-family: monospace;">${reference}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 12px; color: #4B6358; padding-bottom: 8px;"><strong>Producto:</strong></td>
                        <td align="right" style="font-size: 12px; color: #0A110E; padding-bottom: 8px;">${productName || 'Desbloqueo Origgo'}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 12px; color: #4B6358; padding-bottom: 8px;"><strong>Total Pagado:</strong></td>
                        <td align="right" style="font-size: 13px; font-weight: 800; color: #047857; padding-bottom: 8px;">${montoCop}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 12px; color: #4B6358; padding-bottom: 8px;"><strong>Línea WhatsApp:</strong></td>
                        <td align="right" style="font-size: 12px; color: #0A110E; padding-bottom: 8px;">+57 ${phone}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 12px; color: #4B6358;"><strong>Estado:</strong></td>
                        <td align="right" style="font-size: 12px; color: #059669;">${detalleBeneficio}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Botón Mágico de Acceso en 1 Clic -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${urlDestino}" target="_blank" style="background-color: #059669; color: #FFFFFF; font-size: 14px; font-weight: 800; letter-spacing: 0.8px; padding: 16px 36px; border-radius: 9999px; text-decoration: none; display: inline-block; text-transform: uppercase; box-shadow: 0 6px 18px rgba(5, 150, 105, 0.25);">
                      INGRESAR A MI CUENTA EN 1 CLIC &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; color: #64748B; text-align: center; line-height: 1.5;">
                También puedes ingresar en cualquier momento en <a href="https://origgo.online" style="color: #059669; font-weight: 700; text-decoration: none;">origgo.online</a> pulsando <em>Restaurar Cuenta</em> con tu celular y tu PIN.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #F2F7F4; border-top: 1px solid #E1EBE4; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #4B5563;">
                Recibo generado para <strong style="color: #0A110E;">${email}</strong> por la pasarela oficial Wompi.
              </p>
              <p style="margin: 0; font-size: 10.5px; color: #6B7280;">
                &copy; ${anio} Origgo Intelligence (<a href="https://origgo.online" style="color: #059669; text-decoration: none;">origgo.online</a>) — Todos los derechos reservados.
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

/**
 * Despacha de forma autónoma el comprobante oficial de pago y Magic Link mediante Resend API.
 * @param {object} params
 * @param {string} params.phone
 * @param {string} params.email
 * @param {string} params.reference
 * @param {string} [params.productName]
 * @param {number} params.amountInCents
 * @param {string} params.pin
 * @param {number} [params.credits]
 * @param {string} [params.plan]
 * @param {string} [params.planCity]
 * @returns {Promise<boolean>}
 */
async function despacharCorreoConfirmacion({ phone, email, reference, productName, amountInCents, pin, credits, plan, planCity }) {
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!resendApiKey || !email) return false;

  try {
    const portalUrl = (process.env.APP_URL || 'https://origgo.online').trim();
    const { signJwt } = require('./crypto');
    const { requireEnv } = require('./env');
    const jwtSecret = requireEnv('JWT_SECRET', {
      testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232'
    });

    const magicToken = signJwt({
      purpose: 'recover_session',
      phone,
      email,
      role: 'buyer'
    }, jwtSecret, 30);
    const magicUrl = `${portalUrl}?recovery_token=${magicToken}`;
    const remitente = (process.env.RESEND_FROM_EMAIL || 'Origgo Seguridad Interna <seguridad@resend.dev>').trim();

    const htmlBody = generarPlantillaConfirmacionPago({
      phone,
      email,
      reference,
      productName,
      amountInCents,
      pin,
      credits,
      plan,
      planCity,
      magicUrl
    });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: remitente,
        to: [email],
        subject: `🎉 Pago confirmado · Tu Código de Acceso y Comprobante [Ref: ${reference}]`,
        html: htmlBody
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('[email-service] Error despachando confirmación:', err.message);
    return false;
  }
}

module.exports = {
  generarPlantillaRestauracion,
  generarPlantillaSinCreditos,
  generarPlantillaConfirmacionPago,
  despacharCorreoConfirmacion
};
