/**
 * 🛡️ ENDPOINT DE DESINDEXACIÓN Y RETIRO DE INMUEBLE (NOTICE & TAKEDOWN)
 * POST /api/support/takedown -> lib/support/takedown.js
 * 
 * Permite a propietarios y titulares de datos públicos solicitar el retiro
 * y desindexación inmediata de su anuncio conforme a la Ley 1581 de 2012 (Habeas Data).
 * Estándar Ecosistema Desmulta.
 */

const db = require('../db');
const { invalidarCache } = require('../cache');
const { invalidarCatalogo } = require('../catalogo');
const { checkRateLimitAsync } = require('../rate-limiter');
const { aplicarCorsSeguro } = require('../cors');

/**
 * Extrae y sanea un identificador o URL legítima de inmueble a partir de entradas de usuario.
 * @param {string} input 
 * @returns {string|null} ID saneado o null si es texto basura sin identificador
 */
function extraerIdentificadorInmueble(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  if (str.length === 0) return null;

  // 1. Detección de parámetro en URL o fragmento (lead=, id=, leadId=)
  if (str.includes('lead=') || str.includes('leadId=') || str.includes('id=')) {
    const m = str.match(/(?:lead|id|leadId)=([^&#\s]+)/i);
    if (m && m[1]) return decodeURIComponent(m[1]).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  }

  // 2. Si es URL completa (FincaRaíz, Metrocuadrado, Origgo)
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const urlObj = new URL(str);
      const pLead = urlObj.searchParams.get('lead') || urlObj.searchParams.get('id');
      if (pLead) return pLead.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
      
      const pathMatch = urlObj.pathname.match(/([a-zA-Z]{0,4}\d{5,12}|lead-inm-[a-zA-Z0-9_-]+)/i);
      if (pathMatch) return pathMatch[1].slice(0, 80);

      const cleanPath = urlObj.pathname.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(-60);
      if (cleanPath.length >= 4) return cleanPath;
    } catch (_) {}
  }

  // 3. Patrón directo de ID Origgo o de portales (lead-inm-XXX, fr_XXX, HNT-XXX, MCXXXX)
  const idDirectoMatch = str.match(/(?:lead-inm-[a-zA-Z0-9_-]+|fr_\d+|hnt-[a-zA-Z0-9_-]+|mc\d{5,10})/i);
  if (idDirectoMatch) {
    return idDirectoMatch[0].slice(0, 80);
  }

  // 4. Si contiene un número de anuncio de 5 a 12 dígitos
  const numMatch = str.match(/\b(\d{5,12})\b/);
  if (numMatch) {
    return numMatch[1];
  }

  // 5. Si es un ID simple de 3 a 50 caracteres alfanuméricos sin espacios
  if (!str.includes(' ') && /^[a-zA-Z0-9_-]{3,50}$/.test(str)) {
    return str;
  }

  // Si es un texto libre sin ningún identificador reconocible ("Hola por favor..."), rechazar
  return null;
}

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METODO_NO_PERMITIDO', message: 'Método no permitido. Utilice POST.' });
  }

  // 🛡️ Rate Limiting: máx 10 solicitudes de retiro por 15 minutos por IP
  if (!(await checkRateLimitAsync(req, res, { prefix: 'support_takedown', maxRequests: 10, windowMs: 15 * 60 * 1000 }))) {
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }
    body = body || {};

    const lang = (req.headers['accept-language'] || '').toLowerCase().startsWith('en') ? 'en' : 'es';
    const rawInput = String(body.leadId || body.id || body.inmuebleId || body.url || '').trim();
    const rawPhone = String(body.phone || body.celular || body.telefono || '').trim().slice(0, 30);
    const rawReason = String(body.reason || body.razon || body.motivo || 'solicitud_propietario')
      .replace(/[<>{}]/g, '')
      .trim()
      .slice(0, 300);

    if (!rawInput) {
      return res.status(400).json({
        ok: false,
        error: 'LEAD_ID_REQUERIDO',
        message: lang === 'en'
          ? 'Property identifier or link is required.'
          : 'La referencia o enlace del inmueble es requerida.'
      });
    }

    // 🛡️ Extracción y validación defensiva del identificador (previene texto basura y desbordamiento)
    const leadIdLimpio = extraerIdentificadorInmueble(rawInput);

    if (!leadIdLimpio) {
      return res.status(400).json({
        ok: false,
        error: 'LEAD_ID_INVALIDO',
        message: lang === 'en'
          ? 'Could not detect a valid property ID or URL. Please provide the listing code (e.g., lead-inm-123) or direct link.'
          : 'No fue posible identificar el código o enlace del inmueble. Por favor ingrese el código del anuncio (ej: lead-inm-123) o el enlace directo.'
      });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

    // Registrar en Firestore / Almacenamiento Local
    await db.addBlacklistedLead(leadIdLimpio, {
      phone: rawPhone,
      reason: rawReason,
      ip: String(clientIp).split(',')[0].trim()
    });
    // El retiro debe verse de inmediato: se borran las copias en caché de la lista negra y del catálogo.
    await Promise.all([invalidarCache('lista-negra'), invalidarCatalogo()]);

    return res.status(200).json({
      ok: true,
      leadId: leadIdLimpio,
      message: lang === 'en'
        ? 'Listing successfully removed from search and future index runs.'
        : 'Inmueble retirado exitosamente del índice de búsqueda y monitoreo.'
    });
  } catch (err) {
    console.error('[support/takedown] Error:', err.message);
    return res.status(500).json({
      ok: false,
      error: 'ERROR_SERVIDOR',
      message: 'No fue posible procesar la solicitud de desindexación. Intente de nuevo.'
    });
  }
};
