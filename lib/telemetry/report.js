/**
 * 🐕 PERRO GUARDIÁN: TELEMETRÍA Y OBSERVABILIDAD SERVERLESS (lib/telemetry/report.js)
 * Endpoint de recepción de errores no controlados y anomalías del cliente web.
 * 
 * Principio DevSecOps: CERO credenciales o PII en logs (PCI-DSS / Ley 1581 / Habeas Data).
 * Rate limit estricto con Upstash Redis para prevenir saturación por flooding.
 */

const { checkRateLimitAsync, getClientIp } = require('../rate-limiter');
const { aplicarCorsSeguro } = require('../cors');

/**
 * Sanitiza cualquier información confidencial (PII, tarjetas, tokens JWT, celulares)
 * antes de registrar el informe en los logs del servidor.
 * @param {string} texto
 * @returns {string}
 */
function desinfectarCadena(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto
    .replace(/ey[A-Za-z0-9-_=]{10,}\.[A-Za-z0-9-_=]{10,}\.?[A-Za-z0-9-_.+/=]*/g, '[JWT_OFUSCADO]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[TARJETA_OFUSCADA]')
    .replace(/\b(?:\+?57\s*)?(3\d{2})[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g, '[TEL_OFUSCADO]')
    .replace(/(pin|clave|password|pass|secreto)[\s:=]+(\d{4,8})/gi, '$1:[PIN_OFUSCADO]');
}

const alertaReciente = new Map();

async function despacharAlertaExternaConReintentos(reporte) {
  if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_TELEGRAM_IN_TESTS) {
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_PRIVADO || process.env.TELEGRAM_CANAL_ID;
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;

  if (!webhookUrl && (!botToken || !chatId)) {
    return;
  }

  const ahora = Date.now();
  const ultimaVez = alertaReciente.get(reporte.tipo) || 0;
  if (ahora - ultimaVez < 30000) {
    return;
  }
  alertaReciente.set(reporte.tipo, ahora);

  const textoTelegram =
    `🚨 *ALERTA PERRO GUARDIÁN*\n` +
    `📌 *Tipo:* \`${reporte.tipo}\`\n` +
    `📍 *Origen:* ${reporte.origen}\n` +
    `💬 *Mensaje:* ${reporte.mensaje}\n` +
    `🌐 *URL:* ${reporte.url || 'N/A'}\n` +
    `⏰ *Hora:* ${reporte.timestampServidor}`;

  let delay = 300;
  for (let intento = 1; intento <= 2; intento++) {
    try {
      if (botToken && chatId) {
        const urlTelegram = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);

        const resTelegram = await fetch(urlTelegram, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: textoTelegram,
            parse_mode: 'Markdown'
          }),
          signal: controller.signal
        });
        clearTimeout(timer);

        if (resTelegram.ok) return;
      }

      if (webhookUrl) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);

        const resWebhook = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚨 **[PERRO GUARDIÁN]** \`${reporte.tipo}\`: ${reporte.mensaje}`
          }),
          signal: controller.signal
        });
        clearTimeout(timer);

        if (resWebhook.ok) return;
      }
    } catch (err) {
      if (intento === 2) {
        console.warn('[telemetry:alert] Reintentos agotados para alerta externa:', err.message);
        return;
      }
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
}

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!(await checkRateLimitAsync(req, res, { prefix: 'telemetry_err', maxRequests: 20, windowMs: 60 * 1000 }))) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utilice POST.' });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        return res.status(400).json({ error: 'JSON malformado' });
      }
    }

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Cuerpo de reporte inválido' });
    }

    const ip = getClientIp(req);
    const ahora = new Date().toISOString();

    const reporteSanitizado = {
      tipo: String(payload.tipo || 'ERROR_DESCONOCIDO').slice(0, 50),
      mensaje: desinfectarCadena(String(payload.mensaje || '')).slice(0, 500),
      origen: String(payload.origen || 'cliente_web').slice(0, 80),
      url: desinfectarCadena(String(payload.url || '')).slice(0, 300),
      stack: desinfectarCadena(String(payload.stack || '')).slice(0, 1500),
      timestampCliente: payload.timestamp || null,
      timestampServidor: ahora,
      ipCliente: ip ? `${ip.slice(0, 7)}...` : 'anon'
    };

    console.warn('🐕 [PERRO_GUARDIAN_WEB]', JSON.stringify(reporteSanitizado));

    despacharAlertaExternaConReintentos(reporteSanitizado).catch((err) => {
      console.warn('[telemetry:alert] Error no crítico en despacho:', err.message);
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, recibido: true });
  } catch (err) {
    console.error('[telemetry] Error procesando reporte:', err.message);
    return res.status(500).json({ ok: false, error: 'Error interno registrando telemetría' });
  }
};
