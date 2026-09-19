/**
 * 🛡️ ENDPOINT SERVERLESS UNIFICADO DE AUTENTICACIÓN
 * Origgo Intelligence — Arquitectura Serverless Consolidada
 * 
 * Enruta según acción a:
 * - /api/auth/session -> lib/auth/session.js (Sesión, PIN, claims)
 * - /api/auth/challenge -> lib/auth/challenge.js (Desafíos PoW anti-bot)
 * - /api/auth/recover -> lib/auth/recover.js (Recuperación de PIN por email)
 * - /api/auth/welcome-credit -> lib/auth/welcome-credit.js (Crédito freemium)
 * - /api/auth/welcome-verify -> lib/auth/welcome-verify.js (Verificación OTP freemium)
 * - /api/auth/magic-link -> lib/auth/magic-link.js (Solicitud Magic Link)
 * - /api/auth/magic-login -> lib/auth/magic-login.js (Canje Magic Link)
 * - /api/auth?action=consume_retention -> Canje de tokens de retención y emisión de JWT
 */

const jwt = require('jsonwebtoken');
const db = require('../lib/db');
const { requireEnv } = require('../lib/env');
const { aplicarCorsSeguro } = require('../lib/cors');
const sessionHandler = require('../lib/auth/session');
const challengeHandler = require('../lib/auth/challenge');
const recoverHandler = require('../lib/auth/recover');
const welcomeCreditHandler = require('../lib/auth/welcome-credit');
const welcomeVerifyHandler = require('../lib/auth/welcome-verify');
const magicLinkHandler = require('../lib/auth/magic-link');
const magicLoginHandler = require('../lib/auth/magic-login');

const JWT_SECRET = requireEnv('JWT_SECRET', {
  testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232'
});

async function handler(req, res) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }

  const action = req.query?.action || (body && body.action) || (
    urlPath.endsWith('/challenge') ? 'challenge' :
    urlPath.endsWith('/recover') ? 'recover' :
    urlPath.endsWith('/welcome-credit') ? 'welcome-credit' :
    urlPath.endsWith('/welcome_credit') ? 'welcome-credit' :
    urlPath.endsWith('/welcome-verify') ? 'welcome-verify' :
    urlPath.endsWith('/welcome_verify') ? 'welcome-verify' :
    urlPath.endsWith('/magic-link') ? 'magic-link' :
    urlPath.endsWith('/magic_link') ? 'magic-link' :
    urlPath.endsWith('/magic-login') ? 'magic-login' :
    urlPath.endsWith('/magic_login') ? 'magic-login' :
    urlPath.endsWith('/consume-retention') ? 'consume_retention' :
    urlPath.endsWith('/consume_retention') ? 'consume_retention' :
    urlPath.endsWith('/session') ? 'session' : 'session'
  );

  // -------------------------------------------------------------
  // 🎁 CANJE SEGURO DE BENEFICIO / MAGIC LINK DE RETENCIÓN
  // -------------------------------------------------------------
  if (action === 'consume_retention' || action === 'consume-retention') {
    aplicarCorsSeguro(req, res);
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'METODO_NO_PERMITIDO', message: 'Utilice POST para canjear beneficios.' });
    }

    const rawToken = String(body?.token || req.query?.token || '').trim();
    if (!rawToken) {
      return res.status(400).json({ ok: false, error: 'TOKEN_REQUERIDO', message: 'Token de retención no proporcionado.' });
    }

    const resultado = await db.consumeRetentionToken(rawToken);

    if (!resultado.success) {
      const statusCode = (resultado.error === 'TOKEN_EXPIRADO' || resultado.error === 'TOKEN_YA_USADO') ? 410 : 400;
      return res.status(statusCode).json({
        ok: false,
        error: resultado.error,
        message: resultado.message
      });
    }

    const user = resultado.user;

    // Generar JWT firmado de sesión transitoria
    const tokenJwt = jwt.sign(
      {
        phone: user.phone,
        plan: user.plan,
        planCity: user.planCity,
        planExpiresAt: user.planExpiresAt,
        type: 'retention_session'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      ok: true,
      message: resultado.creditsGranted > 0 
        ? `¡Beneficio activado! Hemos agregado ${resultado.creditsGranted} créditos a tu saldo.`
        : 'Sesión restaurada correctamente para renovación.',
      type: resultado.type,
      campaign: resultado.campaign,
      creditsGranted: resultado.creditsGranted,
      token: tokenJwt,
      user: {
        phone: user.phone,
        credits: user.credits,
        plan: user.plan,
        planCity: user.planCity,
        planExpiresAt: user.planExpiresAt
      }
    });
  }

  if (action === 'challenge') {
    return challengeHandler(req, res);
  }
  if (action === 'recover') {
    return recoverHandler(req, res);
  }
  if (action === 'welcome-credit' || action === 'welcome_credit') {
    return welcomeCreditHandler(req, res);
  }
  if (action === 'welcome-verify' || action === 'welcome_verify') {
    return welcomeVerifyHandler(req, res);
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
handler.welcomeVerify = welcomeVerifyHandler;
handler.magicLink = magicLinkHandler;
handler.magicLogin = magicLoginHandler;

module.exports = handler;
