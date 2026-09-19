/**
 * 🛡️ ENDPOINT SERVERLESS UNIFICADO DE AUTO-SOPORTE Y DESINDEXACIÓN
 * Origgo Intelligence — Arquitectura Serverless Consolidada (Hobby Plan Safe)
 * 
 * Enruta según acción a:
 * - /api/support/takedown -> lib/support/takedown.js (Notice & Takedown)
 * - /api/support/blacklist -> lib/support/blacklist.js (Lista negra pública para scraper)
 */

const takedownHandler = require('../lib/support/takedown');
const blacklistHandler = require('../lib/support/blacklist');

async function handler(req, res) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || (
    urlPath.endsWith('/takedown') ? 'takedown' :
    urlPath.endsWith('/blacklist') ? 'blacklist' : 'blacklist'
  );

  if (action === 'takedown') {
    return takedownHandler(req, res);
  }
  return blacklistHandler(req, res);
}

handler.takedown = takedownHandler;
handler.blacklist = blacklistHandler;

module.exports = handler;
