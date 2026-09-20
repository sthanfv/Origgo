/**
 * 🛡️ ENDPOINT SERVERLESS UNIFICADO DE AUTENTICACIÓN
 * Origgo Intelligence — Arquitectura Serverless Consolidada
 * 
 * Enruta según acción a:
 * - /api/auth/session -> lib/auth/session.js (Sesión, PIN, claims)
 * - /api/auth/challenge -> lib/auth/challenge.js (Desafíos PoW anti-bot)
 * - /api/auth/recover -> lib/auth/recover.js (Recuperación de PIN por email)
 */

const sessionHandler = require('../lib/auth/session');
const challengeHandler = require('../lib/auth/challenge');
const recoverHandler = require('../lib/auth/recover');

async function handler(req, res) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || (
    urlPath.endsWith('/challenge') ? 'challenge' :
    urlPath.endsWith('/recover') ? 'recover' :
    urlPath.endsWith('/session') ? 'session' : 'session'
  );

  if (action === 'challenge') {
    return challengeHandler(req, res);
  }
  if (action === 'recover') {
    return recoverHandler(req, res);
  }
  return sessionHandler(req, res);
}

handler.session = sessionHandler;
handler.challenge = challengeHandler;
handler.recover = recoverHandler;

module.exports = handler;
