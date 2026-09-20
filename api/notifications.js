/**
 * 📲 ENDPOINT SERVERLESS UNIFICADO DE NOTIFICACIONES PUSH
 * Origgo Intelligence — Arquitectura Serverless Consolidada (Estándar Desmulta)
 * 
 * Enruta de forma resiliente según acción a:
 * - /api/notifications/vapid-public-key -> lib/notifications/subscribe.js (VAPID Key pública)
 * - /api/notifications/subscribe -> lib/notifications/subscribe.js (Registro de suscripción)
 * - /api/notifications/dispatch -> lib/notifications/dispatch.js (Despacho seguro de alertas)
 */

const { aplicarCorsSeguro } = require('../lib/cors');

let subscribeHandler = null;
let dispatchHandler = null;

async function handler(req, res) {
  // Manejo de CORS Institucional
  aplicarCorsSeguro(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const rawUrl = String(req.url || '');
    const urlPath = rawUrl.split('?')[0].toLowerCase();
    const queryAction = req.query && req.query.action ? String(req.query.action).toLowerCase() : '';

    const esDispatch = queryAction === 'dispatch' || urlPath.endsWith('/dispatch');
    const esVapidKey = queryAction === 'vapid-public-key' || urlPath.endsWith('/vapid-public-key') || urlPath.includes('vapid');

    if (esDispatch) {
      if (!dispatchHandler) {
        dispatchHandler = require('../lib/notifications/dispatch');
      }
      return await dispatchHandler(req, res);
    }

    // Por defecto (tanto vapid-public-key como subscribe) atiende subscribeHandler
    if (!subscribeHandler) {
      subscribeHandler = require('../lib/notifications/subscribe');
    }
    return await subscribeHandler(req, res);
  } catch (errorFatal) {
    console.error('Error fatal en /api/notifications handler:', errorFatal);
    if (!res.headersSent) {
      return res.status(500).json({
        ok: false,
        error: 'SERVERLESS_FUNCTION_ERROR',
        message: 'No se pudo procesar la solicitud de notificaciones.'
      });
    }
  }
}

// Métodos diferidos para tests unitarios
handler.obtenerSubscribe = () => {
  if (!subscribeHandler) subscribeHandler = require('../lib/notifications/subscribe');
  return subscribeHandler;
};

handler.obtenerDispatch = () => {
  if (!dispatchHandler) dispatchHandler = require('../lib/notifications/dispatch');
  return dispatchHandler;
};

module.exports = handler;
