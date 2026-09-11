/**
 * 🔑 ENDPOINT SERVERLESS: CLAVE PÚBLICA VAPID PARA WEB PUSH
 * api/notifications/vapid-public-key.js
 * 
 * Permite al frontend obtener la clave pública VAPID dinámicamente
 * sin exponer variables en el código estático del navegador (DevTools / F12 limpio).
 */

require('../../lib/env');
const { checkRateLimit } = require('../../lib/rate-limiter');
const { aplicarCorsSeguro } = require('../../lib/cors');

module.exports = async function handler(req, res) {
  // Aplicar CORS seguro
  aplicarCorsSeguro(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  // Rate limit para prevenir abusos
  if (!checkRateLimit(req, res, { prefix: 'vapid_pubkey', maxRequests: 60, windowMs: 60 * 1000 })) {
    return;
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(503).json({
      ok: false,
      error: 'NOT_CONFIGURED',
      message: 'El servicio de notificaciones no tiene llaves VAPID configuradas.'
    });
  }

  // Cabeceras de caché: pública, 1 hora para evitar peticiones repetitivas
  if (typeof res.setHeader === 'function') {
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  }

  return res.status(200).json({
    ok: true,
    publicKey: String(publicKey).trim()
  });
};
