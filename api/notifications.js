/**
 * 📲 ENDPOINT SERVERLESS UNIFICADO DE NOTIFICACIONES PUSH
 * Origgo Intelligence — Arquitectura Serverless Consolidada
 * 
 * Enruta según acción a:
 * - /api/notifications/subscribe -> lib/notifications/subscribe.js (Suscripción y VAPID Key)
 * - /api/notifications/vapid-public-key -> lib/notifications/subscribe.js (VAPID Key)
 * - /api/notifications/dispatch -> lib/notifications/dispatch.js (Despacho seguro de alertas)
 */

const subscribeHandler = require('../lib/notifications/subscribe');
const dispatchHandler = require('../lib/notifications/dispatch');

async function handler(req, res) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || (
    urlPath.endsWith('/dispatch') ? 'dispatch' :
    urlPath.endsWith('/vapid-public-key') ? 'vapid-public-key' :
    urlPath.endsWith('/subscribe') ? 'subscribe' : 'subscribe'
  );

  if (action === 'dispatch') {
    return dispatchHandler(req, res);
  }
  return subscribeHandler(req, res);
}

handler.subscribe = subscribeHandler;
handler.dispatch = dispatchHandler;

module.exports = handler;
