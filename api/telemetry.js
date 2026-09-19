/**
 * 🐕 ENDPOINT SERVERLESS UNIFICADO DE TELEMETRÍA, EMBUDO Y CRON
 * Origgo Intelligence — Arquitectura Serverless Consolidada (Hobby Plan Safe)
 * 
 * Enruta según acción a:
 * - /api/telemetry/report -> lib/telemetry/report.js (Perro Guardián, errores)
 * - /api/telemetry/funnel -> lib/telemetry/funnel.js (Eventos embudo comercial)
 * - /api/telemetry/cron -> lib/telemetry/cron.js (Vercel Cron diario)
 */

const reportHandler = require('../lib/telemetry/report');
const funnelHandler = require('../lib/telemetry/funnel');
const cronHandler = require('../lib/telemetry/cron');

async function handler(req, res) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || (
    urlPath.endsWith('/cron') ? 'cron' :
    urlPath.endsWith('/funnel') ? 'funnel' :
    urlPath.endsWith('/report') ? 'report' : 'report'
  );

  if (action === 'cron') return cronHandler(req, res);
  if (action === 'funnel') return funnelHandler(req, res);
  return reportHandler(req, res);
}

handler.report = reportHandler;
handler.funnel = funnelHandler;
handler.cron = cronHandler;

module.exports = handler;
