/**
 * ⚡ TAREA PROGRAMADA DE TELEMETRÍA COMERCIAL (VERCEL CRON)
 * GET /api/telemetry/cron -> lib/telemetry/cron.js
 * 
 * Principios DevSecOps:
 * 1. Control Criptográfico: Validación Bearer CRON_SECRET en tiempo constante.
 * 2. Cero PII: El reporte solo contiene métricas agregadas anónimas.
 * 3. Notificación Ejecutiva: Despacho a Telegram para monitoreo del fundador.
 * 4. Resiliencia: Manejo seguro de errores sin comprometer la estabilidad serverless.
 */

const crypto = require('crypto');
const {
  obtenerMetricasEmbudo,
  despacharReporteTelegram
} = require('../funnel');

function validarAutenticacionCron(req) {
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_CRON_SECRET;
  const authHeader = (req.headers && req.headers.authorization) || '';
  const tokenRecibido = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (process.env.NODE_ENV === 'test') {
    if (!cronSecret && tokenRecibido === 'test_cron_secret_2026') {
      return true;
    }
  }

  if (!cronSecret && process.env.NODE_ENV !== 'production') {
    return true;
  }

  if (!cronSecret || !tokenRecibido) {
    return false;
  }

  const bufRecibido = Buffer.from(tokenRecibido);
  const bufEsperado = Buffer.from(cronSecret);

  if (bufRecibido.length !== bufEsperado.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufRecibido, bufEsperado);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      error: 'METODO_NO_PERMITIDO',
      message: 'Método no permitido. Vercel Cron envía peticiones GET.'
    });
  }

  if (!validarAutenticacionCron(req)) {
    return res.status(401).json({
      error: 'NO_AUTORIZADO',
      message: 'Cabecera de autorización Bearer CRON_SECRET no válida.'
    });
  }

  try {
    const diasParam = parseInt(req.query?.dias, 10);
    const dias = (!isNaN(diasParam) && diasParam >= 1 && diasParam <= 30) ? diasParam : 7;

    const metricas = await obtenerMetricasEmbudo({ dias });
    const telegramEnviado = await despacharReporteTelegram(metricas);

    return res.status(200).json({
      ok: true,
      mensaje: `Reporte de embudo (${dias} días) procesado.`,
      dias,
      telegramEnviado,
      totalVisitas: metricas.visitas,
      totalConversiones: metricas.conversionesTotal
    });
  } catch (error) {
    console.error('[CRON TELEMETRÍA] Error al generar reporte diario:', error.message);
    return res.status(500).json({
      error: 'ERROR_CRON_TELEMETRIA',
      message: 'Fallo al procesar el reporte diario del embudo.'
    });
  }
};
