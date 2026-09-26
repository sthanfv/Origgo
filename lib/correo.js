/**
 * ✉️ Envío de correos transaccionales con Resend (plan gratuito: 3.000 correos al mes).
 *
 * Variables: RESEND_API_KEY (obligatoria para enviar) y RESEND_FROM_EMAIL (remitente
 * verificado; por defecto "Origgo <seguridad@origgo.online>").
 * En pruebas (NODE_ENV=test) nunca envía: guarda el último correo en `ultimoCorreoDePrueba`.
 */

let ultimoCorreoDePrueba = null;

/**
 * @param {{ para: string, asunto: string, html: string }} correo
 * @returns {Promise<boolean>} true si Resend lo aceptó.
 */
async function enviarCorreo({ para, asunto, html }) {
  if (process.env.NODE_ENV === 'test') {
    ultimoCorreoDePrueba = { para, asunto, html };
    return true;
  }
  const llave = (process.env.RESEND_API_KEY || '').trim();
  if (!llave) {
    console.warn('[correo] RESEND_API_KEY no configurada: no se envió el correo.');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: (process.env.RESEND_FROM_EMAIL || 'Origgo <seguridad@origgo.online>').trim(),
        to: [para],
        subject: asunto,
        html,
      }),
    });
    if (!res.ok) console.warn('[correo] Resend respondió', res.status);
    return res.ok;
  } catch (err) {
    console.warn('[correo] Error enviando:', err.message);
    return false;
  }
}

module.exports = {
  enviarCorreo,
  /** Solo pruebas. */
  leerUltimoCorreoDePrueba: () => ultimoCorreoDePrueba,
};
