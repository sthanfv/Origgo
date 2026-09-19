/**
 * 📊 ENDPOINT DE TELEMETRÍA COMERCIAL Y EMBUDO CRO (api/telemetry/funnel.js)
 * Recepción serverless de eventos del embudo de ventas y consulta de métricas.
 * 
 * Principios DevSecOps:
 * 1. Privacidad por Diseño (Cero PII): No se aceptan datos personales en eventos.
 * 2. Validación Estricta con Zod: Rechazo de cargas útiles adulteradas o malformadas.
 * 3. Rate Limiting Distribuido: Prevención de inundación DoS mediante Upstash Redis / memoria.
 * 4. Control de Acceso Criptográfico: Consultas GET protegidas mediante secreto interno.
 * 5. Notificación Silenciosa a Telegram: Despacho automatizado para el fundador.
 */

const { checkRateLimitAsync } = require('../../lib/rate-limiter');
const { aplicarCorsSeguro } = require('../../lib/cors');
const { funnelEventSchema, validateBody } = require('../../lib/validation');
const {
  registrarEventoEmbudo,
  obtenerMetricasEmbudo,
  generarReporteTelegramMarkdown,
  despacharReporteTelegram
} = require('../../lib/funnel');

/**
 * Valida si la solicitud GET cuenta con autorización suficiente.
 * @param {import('http').IncomingMessage} req
 * @returns {boolean}
 */
function esSolicitudAutorizada(req) {
  const secretoServidor = process.env.INTERNAL_CRON_SECRET ||
    process.env.ADMIN_SECRET ||
    process.env.FUNNEL_REPORT_SECRET ||
    process.env.CRON_SECRET;

  // En entornos de desarrollo o pruebas sin secreto configurado, se permite acceso local
  if (!secretoServidor && process.env.NODE_ENV !== 'production') {
    return true;
  }

  if (!secretoServidor) {
    return false;
  }

  // 1. Cabecera x-internal-secret
  const headerSecret = req.headers['x-internal-secret'];
  if (headerSecret && headerSecret === secretoServidor) {
    return true;
  }

  // 2. Cabecera Authorization: Bearer <secret>
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === secretoServidor) {
      return true;
    }
  }

  // 3. Parámetro query ?secret=<secret>
  const querySecret = req.query?.secret;
  if (querySecret && querySecret === secretoServidor) {
    return true;
  }

  return false;
}

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MANEJADOR POST: Ingesta de Eventos del Embudo (Client Telemetry)
  // ═════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST') {
    // Rate limit: hasta 60 eventos por minuto por IP para admitir navegación fluida
    if (!(await checkRateLimitAsync(req, res, { prefix: 'funnel_ev', maxRequests: 60, windowMs: 60 * 1000 }))) {
      return;
    }

    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (_) {
        return res.status(400).json({ error: 'JSON_MALFORMADO', message: 'El cuerpo de la solicitud no es JSON válido.' });
      }
    }

    const validacion = validateBody(funnelEventSchema, payload);
    if (!validacion.success) {
      return res.status(validacion.status || 400).json({
        error: validacion.error,
        message: validacion.message,
        issues: validacion.issues
      });
    }

    const resultado = await registrarEventoEmbudo(validacion.data);
    if (!resultado.ok) {
      return res.status(500).json({ error: 'FALLO_REGISTRO_EMBUDO', message: resultado.error || 'No se pudo registrar el evento.' });
    }

    return res.status(200).json({ ok: true });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MANEJADOR GET: Consulta Ejecutiva de Métricas y Despacho a Telegram
  // ═════════════════════════════════════════════════════════════════════════
  if (req.method === 'GET') {
    // Rate limit: máx 15 consultas por minuto para evitar sobrecarga en Firestore
    if (!(await checkRateLimitAsync(req, res, { prefix: 'funnel_query', maxRequests: 15, windowMs: 60 * 1000 }))) {
      return;
    }

    if (!esSolicitudAutorizada(req)) {
      return res.status(401).json({
        error: 'NO_AUTORIZADO',
        message: 'Se requiere token de autorización para consultar las métricas comerciales del embudo.'
      });
    }

    const diasParam = parseInt(req.query?.dias, 10);
    const dias = (!isNaN(diasParam) && diasParam >= 1 && diasParam <= 30) ? diasParam : 7;
    const sendTelegram = req.query?.send_telegram === 'true' || req.query?.telegram === '1';
    const formatoMarkdown = req.query?.format === 'markdown';

    try {
      const metricas = await obtenerMetricasEmbudo({ dias });

      // Responder formato Markdown directo si fue solicitado
      if (formatoMarkdown) {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        return res.status(200).send(generarReporteTelegramMarkdown(metricas));
      }

      let telegramDespachado = false;
      if (sendTelegram) {
        telegramDespachado = await despacharReporteTelegram(metricas);
      }

      return res.status(200).json({
        ok: true,
        dias,
        telegramDespachado: sendTelegram ? telegramDespachado : undefined,
        metricas
      });
    } catch (err) {
      return res.status(500).json({
        error: 'ERROR_CONSULTA_EMBUDO',
        message: 'Ocurrió un error al calcular las métricas del embudo.'
      });
    }
  }

  // Método no permitido
  return res.status(405).json({
    error: 'METODO_NO_PERMITIDO',
    message: 'Método no permitido. Utilice POST para registrar eventos o GET para consultar métricas.'
  });
};
