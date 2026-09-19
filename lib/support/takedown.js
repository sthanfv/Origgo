/**
 * 🛡️ ENDPOINT DE DESINDEXACIÓN Y RETIRO DE INMUEBLE (NOTICE & TAKEDOWN)
 * POST /api/support/takedown -> lib/support/takedown.js
 * 
 * Permite a propietarios y titulares de datos públicos solicitar el retiro
 * y desindexación inmediata de su anuncio conforme a la Ley 1581 de 2012 (Habeas Data).
 * Estándar Ecosistema Desmulta.
 */

const db = require('../db');
const { checkRateLimitAsync } = require('../rate-limiter');
const { aplicarCorsSeguro } = require('../cors');

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
    const rawLeadId = String(body.leadId || body.id || body.inmuebleId || '').trim();
    const rawPhone = String(body.phone || body.celular || body.telefono || '').trim();
    const rawReason = String(body.reason || body.razon || body.motivo || 'solicitud_propietario').trim();

    if (!rawLeadId) {
      return res.status(400).json({
        ok: false,
        error: 'LEAD_ID_REQUERIDO',
        message: lang === 'en' ? 'Property identifier or link is required.' : 'El ID o enlace del inmueble es requerido.'
      });
    }

    // Extraer identificador si el usuario envió una URL completa
    let leadIdLimpio = rawLeadId;
    if (leadIdLimpio.includes('lead=')) {
      const match = leadIdLimpio.match(/lead=([^&]+)/);
      if (match) leadIdLimpio = decodeURIComponent(match[1]);
    } else if (leadIdLimpio.startsWith('http')) {
      try {
        const urlObj = new URL(leadIdLimpio);
        const pLead = urlObj.searchParams.get('lead');
        if (pLead) leadIdLimpio = pLead;
        else leadIdLimpio = urlObj.pathname.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(-60);
      } catch (_) {
        leadIdLimpio = leadIdLimpio.slice(-60);
      }
    }
    leadIdLimpio = leadIdLimpio.slice(0, 100);

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

    // Registrar en Firestore / Almacenamiento Local
    await db.addBlacklistedLead(leadIdLimpio, {
      phone: rawPhone,
      reason: rawReason,
      ip: String(clientIp).split(',')[0].trim()
    });

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
