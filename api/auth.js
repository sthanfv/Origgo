/**
 * 🛡️ ENDPOINT SERVERLESS UNIFICADO DE AUTENTICACIÓN
 * Origgo Intelligence — Arquitectura Serverless Consolidada
 * 
 * Enruta según acción o ruta a:
 * - /api/auth/session        -> lib/auth/session.js (Sesión, PIN, claims)
 * - /api/auth/challenge      -> lib/auth/challenge.js (Desafíos PoW anti-bot)
 * - /api/auth/recover        -> lib/auth/recover.js (Recuperación de PIN por email)
 * - /api/auth/welcome-credit -> lib/auth/welcome-credit.js (Solicitud de regalo bienvenida)
 * - /api/auth/welcome-verify -> lib/auth/welcome-verify.js (Verificación de Magic Link)
 * - /api/user/balance        -> lib/auth/balance.js (Saldo, plan y preferencias; reenlace en vercel.json)
 */

const sessionHandler = require('../lib/auth/session');
const challengeHandler = require('../lib/auth/challenge');
const recoverHandler = require('../lib/auth/recover');
const welcomeCreditHandler = require('../lib/auth/welcome-credit');
const welcomeVerifyHandler = require('../lib/auth/welcome-verify');
const balanceHandler = require('../lib/auth/balance');

async function handler(req, res) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.action || req.query?.action || (
    urlPath.endsWith('/challenge') ? 'challenge' :
    urlPath.endsWith('/recover') ? 'recover' :
    urlPath.endsWith('/welcome-credit') ? 'welcome-credit' :
    urlPath.endsWith('/welcome-verify') ? 'welcome-verify' :
    urlPath.endsWith('/session') ? 'session' : 'session'
  );

  if (action === 'challenge') {
    return challengeHandler(req, res);
  }
  if (action === 'recover') {
    return recoverHandler(req, res);
  }
  if (action === 'welcome-credit') {
    return welcomeCreditHandler(req, res);
  }
  if (action === 'welcome-verify') {
    return welcomeVerifyHandler(req, res);
  }
  if (action === 'balance') {
    return balanceHandler(req, res);
  }
  return sessionHandler(req, res);
}

handler.session = sessionHandler;
handler.challenge = challengeHandler;
handler.recover = recoverHandler;
handler.welcomeCredit = welcomeCreditHandler;
handler.welcomeVerify = welcomeVerifyHandler;
handler.balance = balanceHandler;

module.exports = handler;
