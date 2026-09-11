/**
 * 📲 ENDPOINT SERVERLESS: REGISTRO DE SUSCRIPCIÓN WEB PUSH
 * api/notifications/subscribe.js
 * 
 * Recibe y almacena la suscripción del navegador para notificaciones de gangas.
 * Valida formato de endpoints y claves criptográficas del estándar W3C Push API.
 */

require('../../lib/env');
const { checkRateLimit } = require('../../lib/rate-limiter');
const { aplicarCorsSeguro } = require('../../lib/cors');
const { registrarSuscripcion } = require('../../lib/push-subscriptions');

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  // Rate limit para prevenir spam de suscripciones
  if (!checkRateLimit(req, res, { prefix: 'push_sub', maxRequests: 20, windowMs: 60 * 1000 })) {
    return;
  }

  try {
    const body = req.body || {};
    const subscription = body.subscription;

    if (!subscription || typeof subscription !== 'object') {
      return res.status(400).json({ ok: false, error: 'MISSING_SUBSCRIPTION', message: 'Se requiere objeto subscription.' });
    }

    const { endpoint, keys } = subscription;
    if (!endpoint || typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
      return res.status(400).json({ ok: false, error: 'INVALID_ENDPOINT', message: 'El endpoint debe ser una URL HTTPS válida.' });
    }

    if (!keys || typeof keys !== 'object' || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ ok: false, error: 'INVALID_KEYS', message: 'Se requieren claves p256dh y auth.' });
    }

    const metadata = {
      ciudad: typeof body.ciudad === 'string' ? body.ciudad.substring(0, 50) : 'Colombia',
      userAgent: req.headers['user-agent'] || ''
    };

    const exito = await registrarSuscripcion(subscription, metadata);

    if (exito) {
      return res.status(200).json({
        ok: true,
        message: 'Dispositivo suscrito exitosamente a las alertas de Origgo.'
      });
    }

    return res.status(500).json({ ok: false, error: 'STORAGE_ERROR', message: 'No se pudo registrar la suscripción.' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR', message: error.message });
  }
};
