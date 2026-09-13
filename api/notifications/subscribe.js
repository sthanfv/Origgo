/**
 * 📲 ENDPOINT SERVERLESS: WEB PUSH (CLAVE VAPID Y SUSCRIPCIONES)
 * api/notifications/subscribe.js
 * 
 * - GET: Entrega dinámica de clave pública VAPID (sin variables expuestas en frontend).
 * - POST: Registro seguro de suscripción Web Push W3C en ledger.
 * Estándar Ecosistema Desmulta DevSecOps.
 */

require('../../lib/env');
const { checkRateLimitAsync } = require('../../lib/rate-limiter');
const { aplicarCorsSeguro } = require('../../lib/cors');
const { registrarSuscripcion } = require('../../lib/push-subscriptions');

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. GET: Entrega dinámica de la clave pública VAPID
  if (req.method === 'GET') {
    if (!(await checkRateLimitAsync(req, res, { prefix: 'vapid_pubkey', maxRequests: 60, windowMs: 60 * 1000 }))) {
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

    if (typeof res.setHeader === 'function') {
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    }

    return res.status(200).json({
      ok: true,
      publicKey: publicKey.trim()
    });
  }

  // 2. POST: Registro de la suscripción push
  if (req.method === 'POST') {
    if (!(await checkRateLimitAsync(req, res, { prefix: 'push_sub', maxRequests: 20, windowMs: 60 * 1000 }))) {
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
  }

  return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
};
