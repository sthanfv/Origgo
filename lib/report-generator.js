/**
 * 📄 MOTOR DE GENERACIÓN DE DOSSIERS Y REPORTES TÉCNICOS (lib/report-generator.js)
 * Origgo Intelligence — Arquitectura DevSecOps
 * Genera fichas ejecutivas de inmuebles desbloqueados con formato optimizado para impresión/PDF
 * y despacho transaccional automático por Resend API ($0 coste).
 * Estándar Ecosistema Desmulta (< 500 líneas).
 */

const ESTILOS_DOSSIER = `
  body { margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background-color: #E4EEE7; color: #0A110E; }
  .dossier-wrap { max-width: 680px; margin: 30px auto; background: #FFFFFF; border: 1px solid #CBDAD0; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 36px -8px rgba(5,31,32,0.09); }
  .dossier-header { padding: 32px 40px 20px; text-align: center; border-bottom: 1px solid #EBF2ED; background: #FAFDFB; }
  .dossier-logo { font-size: 34px; font-weight: 800; color: #047857; margin: 0; letter-spacing: -1px; }
  .dossier-tagline { font-size: 11px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 2px; margin-top: 6px; }
  .dossier-body { padding: 32px 40px; }
  .badge-confidential { display: inline-block; background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 9999px; padding: 6px 18px; color: #B45309; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 20px; }
  .prop-title { font-size: 22px; font-weight: 800; color: #0A110E; margin: 0 0 8px; line-height: 1.3; }
  .prop-location { font-size: 14px; color: #4B6358; margin-bottom: 24px; }
  .prop-hero-img { width: 100%; height: 260px; object-fit: cover; border-radius: 14px; margin-bottom: 24px; border: 1px solid #D5E2D9; }
  .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .metric-card { background: #F2F7F4; border: 1px solid #D5E2D9; border-radius: 12px; padding: 14px; text-align: center; }
  .metric-label { font-size: 10px; font-weight: 800; color: #4B6358; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px; }
  .metric-val { font-size: 16px; font-weight: 800; color: #0A110E; }
  .contact-box { background: #F8FAF9; border: 2px solid #059669; border-radius: 16px; padding: 24px; margin-bottom: 24px; text-align: center; }
  .contact-title { font-size: 12px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; display: block; }
  .contact-phone { font-size: 26px; font-weight: 800; color: #064E3B; font-family: monospace; letter-spacing: 2px; margin-bottom: 12px; display: block; }
  .contact-btn { display: inline-block; background: #25D366; color: #FFFFFF; font-size: 13px; font-weight: 800; padding: 12px 28px; border-radius: 9999px; text-decoration: none; margin-right: 8px; }
  .ad-btn { display: inline-block; background: #059669; color: #FFFFFF; font-size: 13px; font-weight: 800; padding: 12px 28px; border-radius: 9999px; text-decoration: none; }
  .security-notice { background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 12px; padding: 16px; font-size: 12px; color: #991B1B; line-height: 1.5; margin-bottom: 24px; }
  .dossier-footer { padding: 20px 40px; background: #F2F7F4; border-top: 1px solid #E1EBE4; text-align: center; font-size: 11px; color: #6B7280; }
  @media print {
    body { background: #FFF !important; }
    .dossier-wrap { box-shadow: none !important; border: none !important; max-width: 100% !important; margin: 0 !important; }
    .contact-btn, .ad-btn { border: 1px solid #CBDAD0 !important; }
  }
`;

/**
 * Genera el documento HTML completo del Dossier de la propiedad.
 * @param {Object} params
 * @returns {string}
 */
function generarHtmlDossierPropiedad({ lead, contacto, datosRevelados, userPhone, lang = 'es' }) {
  const isEn = lang === 'en';
  const anio = new Date().getFullYear();
  const fechaHoy = new Date().toLocaleDateString(isEn ? 'en-US' : 'es-CO', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const titulo = datosRevelados?.tituloOriginal || lead?.titulo || (isEn ? 'Direct Property Dossier' : 'Ficha de Inmueble Directo');
  const ubicacion = datosRevelados?.ubicacionCompleta || lead?.ubicacion || (isEn ? 'Colombia' : 'Colombia');
  const precioCop = lead?.precio ? (typeof lead.precio === 'number' ? `$ ${lead.precio.toLocaleString('es-CO')} COP` : lead.precio) : 'Consultar';
  const precioUsd = lead?.precio_usd || '';
  const areaM2 = lead?.detalles?.['Área'] || lead?.dato_1 || 'N/A';
  const habs = lead?.detalles?.['Habitaciones'] || 'N/A';
  const banos = lead?.detalles?.['Baños'] || 'N/A';
  const parqueaderos = lead?.detalles?.['Parqueaderos'] || '0';
  const estrato = lead?.detalles?.['Estrato'] || 'N/A';
  const precioM2 = lead?.precio_m2 || 'N/A';
  const portalFuente = contacto?.portal || lead?.portal || 'Portal Inmobiliario';
  const telContacto = contacto?.telefono || (isEn ? 'Direct in listing' : 'Directo en anuncio');
  const waUrl = contacto?.whatsappUrl || '';
  const linkAnuncio = contacto?.enlace || '';
  const imgPortada = lead?.imagen || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';

  const t = isEn ? {
    sub: 'CONFIDENTIAL PROPERTY REPORT · DIRECT OWNER',
    badge: '🔒 VERIFIED DIRECT OWNER DOSSIER',
    price: 'Listed Price',
    usd: 'Estimated USD',
    specsTitle: 'Property Specifications',
    area: 'Built Area',
    rooms: 'Bedrooms',
    baths: 'Bathrooms',
    parking: 'Parking',
    stratum: 'Stratum',
    valM2: 'Value / m²',
    contactHeader: 'VERIFIED DIRECT OWNER CONTACT',
    contactSub: 'Negotiate without intermediary broker fees (0% Agency Commission)',
    btnWa: 'Chat on WhatsApp',
    btnAd: 'View Original Source',
    checklistTitle: '🛡️ Recommended Direct Closing Protocol',
    check1: '1. Request a Certificate of Title & Freedom (Certificado de Tradición y Libertad) issued within the last 30 days.',
    check2: '2. Verify that the owner on title matches the seller ID before transferring escrow funds.',
    check3: '3. Schedule an on-site physical tour of the property and inspect structural finishes.',
    footer: `Confidential dossier delivered to user line +57 ${userPhone || ''} · Generated on ${fechaHoy}.`
  } : {
    sub: 'REPORTE CONFIDENCIAL DE PROPIEDAD · PROPIETARIO DIRECTO',
    badge: '🔒 DOSSIER EXCLUSIVO DE PROPIETARIO DIRECTO',
    price: 'Precio Publicado',
    usd: 'Aproximado USD',
    specsTitle: 'Especificaciones del Inmueble',
    area: 'Área Construida',
    rooms: 'Habitaciones',
    baths: 'Baños',
    parking: 'Parqueaderos',
    stratum: 'Estrato',
    valM2: 'Valor / m²',
    contactHeader: 'CONTACTO DIRECTO VERIFICADO DEL PROPIETARIO',
    contactSub: 'Negocia de persona a persona sin comisiones de agencia (0% Intermediación)',
    btnWa: 'Abrir Chat de WhatsApp',
    btnAd: 'Ver Anuncio Original',
    checklistTitle: '🛡️ Protocolo de Seguridad para Cierre Directo',
    check1: '1. Solicita el Certificado de Tradición y Libertad con vigencia no mayor a 30 días.',
    check2: '2. Confirma que la identidad del vendedor coincida con el titular de dominio en la matrícula.',
    check3: '3. Agenda una visita presencial para validar el estado físico y acabados del inmueble.',
    footer: `Dossier confidencial emitido para la línea +57 ${userPhone || ''} · Generado el ${fechaHoy}.`
  };

  return `<!DOCTYPE html><html lang="${isEn ? 'en' : 'es'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titulo} — Origgo Dossier</title><style>${ESTILOS_DOSSIER}</style></head>
<body>
  <div class="dossier-wrap">
    <div class="dossier-header">
      <h1 class="dossier-logo">Origgo</h1>
      <p class="dossier-tagline">${t.sub}</p>
    </div>
    <div class="dossier-body">
      <div style="text-align:center;"><span class="badge-confidential">${t.badge}</span></div>
      <h2 class="prop-title">${titulo}</h2>
      <p class="prop-location">📍 ${ubicacion} · <em>Fuente: ${portalFuente}</em></p>
      <img src="${imgPortada}" alt="${titulo}" class="prop-hero-img" />

      <div class="metrics-grid">
        <div class="metric-card"><span class="metric-label">${t.price}</span><span class="metric-val" style="color:#047857;">${precioCop}</span></div>
        <div class="metric-card"><span class="metric-label">${t.area}</span><span class="metric-val">${areaM2}</span></div>
        <div class="metric-card"><span class="metric-label">${t.valM2}</span><span class="metric-val">${precioM2}</span></div>
        <div class="metric-card"><span class="metric-label">${t.rooms}</span><span class="metric-val">${habs}</span></div>
        <div class="metric-card"><span class="metric-label">${t.baths}</span><span class="metric-val">${banos}</span></div>
        <div class="metric-card"><span class="metric-label">${t.parking} / ${t.stratum}</span><span class="metric-val">${parqueaderos} · Est. ${estrato}</span></div>
      </div>

      <div class="contact-box">
        <span class="contact-title">${t.contactHeader}</span>
        <span class="contact-phone">${telContacto}</span>
        <p style="font-size:12px;color:#4B6358;margin:0 0 16px;">${t.contactSub}</p>
        <div>
          ${waUrl ? `<a href="${waUrl}" target="_blank" class="contact-btn">💬 ${t.btnWa}</a>` : ''}
          ${linkAnuncio ? `<a href="${linkAnuncio}" target="_blank" class="ad-btn">🔗 ${t.btnAd}</a>` : ''}
        </div>
      </div>

      <div class="security-notice">
        <strong style="display:block;margin-bottom:6px;">${t.checklistTitle}</strong>
        <p style="margin:2px 0;">${t.check1}</p>
        <p style="margin:2px 0;">${t.check2}</p>
        <p style="margin:2px 0;">${t.check3}</p>
      </div>
    </div>
    <div class="dossier-footer">
      <p style="margin:0 0 4px;">${t.footer}</p>
      <p style="margin:0;">&copy; ${anio} Origgo Intelligence (<a href="https://origgo.online" style="color:#059669;text-decoration:none;">origgo.online</a>)</p>
    </div>
  </div>
</body></html>`;
}

/**
 * Despacha de forma autónoma el Dossier de la propiedad al correo electrónico del comprador vía Resend API.
 * @param {Object} params
 * @returns {Promise<boolean>}
 */
async function despacharReporteDossierEmail({ email, lead, contacto, datosRevelados, userPhone, lang = 'es' }) {
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!resendApiKey || !email) return false;

  try {
    const isEn = lang === 'en';
    const remitente = (process.env.RESEND_FROM_EMAIL || 'Origgo Dossiers <seguridad@resend.dev>').trim();
    const titulo = datosRevelados?.tituloOriginal || lead?.titulo || (isEn ? 'Property' : 'Inmueble');
    const htmlBody = generarHtmlDossierPropiedad({ lead, contacto, datosRevelados, userPhone, lang });

    const subject = isEn
      ? `🏢 [Confidential Dossier] Direct Owner & Property Specs: ${titulo}`
      : `🏢 [Dossier Confidencial] Ficha Técnica y Dueño Directo: ${titulo}`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: remitente,
        to: [email],
        subject,
        html: htmlBody
      })
    });

    return res.ok;
  } catch (err) {
    console.warn('[dossier-service] Aviso en despacho de dossier:', err.message);
    return false;
  }
}

module.exports = {
  generarHtmlDossierPropiedad,
  despacharReporteDossierEmail
};
