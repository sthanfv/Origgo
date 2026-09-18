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
const welcomeCreditHandler = require('../lib/auth/welcome-credit');
const magicLinkHandler = require('../lib/auth/magic-link');
const magicLoginHandler = require('../lib/auth/magic-login');

async function handler(req, res) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || (
    urlPath.endsWith('/challenge') ? 'challenge' :
    urlPath.endsWith('/recover') ? 'recover' :
    urlPath.endsWith('/welcome-credit') ? 'welcome-credit' :
    urlPath.endsWith('/welcome_credit') ? 'welcome-credit' :
    urlPath.endsWith('/magic-link') ? 'magic-link' :
    urlPath.endsWith('/magic_link') ? 'magic-link' :
    urlPath.endsWith('/magic-login') ? 'magic-login' :
    urlPath.endsWith('/magic_login') ? 'magic-login' :
    urlPath.endsWith('/session') ? 'session' : 'session'
  );

  if (action === 'challenge') {
    return challengeHandler(req, res);
  }
  if (action === 'recover') {
    return recoverHandler(req, res);
  }
  if (action === 'welcome-credit' || action === 'welcome_credit') {
    return welcomeCreditHandler(req, res);
  }
  if (action === 'magic-link' || action === 'magic_link') {
    return magicLinkHandler(req, res);
  }
  if (action === 'magic-login' || action === 'magic_login') {
    return magicLoginHandler(req, res);
  }
  return sessionHandler(req, res);
}

handler.session = sessionHandler;
handler.challenge = challengeHandler;
handler.recover = recoverHandler;
handler.welcomeCredit = welcomeCreditHandler;
handler.magicLink = magicLinkHandler;
handler.magicLogin = magicLoginHandler;

module.exports = handler;
