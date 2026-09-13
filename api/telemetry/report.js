/**
 * 🐕 PERRO GUARDIÁN: TELEMETRÍA Y OBSERVABILIDAD SERVERLESS (api/telemetry/report.js)
 * Endpoint de recepción de errores no controlados y anomalías del cliente web.
 * 
 * Principio DevSecOps: CERO credenciales o PII en logs (PCI-DSS / Ley 1581 / Habeas Data).
 * Rate limit estricto con Upstash Redis para prevenir saturación por flooding.
 */

const { checkRateLimitAsync, getClientIp } = require('../../lib/rate-limiter');
const { aplicarCorsSeguro } = require('../../lib/cors');

/**
 * Sanitiza cualquier información confidencial (PII, tarjetas, tokens JWT, celulares)
 * antes de registrar el informe en los logs del servidor.
 * @param {string} texto
 * @returns {string}
 */
function desinfectarCadena(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto
    // Ofuscar tokens JWT
    .replace(/ey[A-Za-z0-9-_=]{10,}\.[A-Za-z0-9-_=]{10,}\.?[A-Za-z0-9-_.+/=]*/g, '[JWT_OFUSCADO]')
    // Ofuscar números de tarjeta de crédito (13 a 19 dígitos continuos o separados por guión/espacio)
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[TARJETA_OFUSCADA]')
    // Ofuscar teléfonos celulares colombianos
    .replace(/\b(?:\+?57\s*)?(3\d{2})[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g, '[TEL_OFUSCADO]')
    // Ofuscar PINs de 4 dígitos precedidos de palabras clave
    .replace(/(pin|clave|password|pass|secreto)[\s:=]+(\d{4,8})/gi, '$1:[PIN_OFUSCADO]');
}

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Rate Limiting: Máximo 20 reportes por minuto por IP para evitar ataques DoS/spam
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

    // Registro estructurado para telemetría en Vercel Logs / Logflare a $0 coste
    console.warn('🐕 [PERRO_GUARDIAN_WEB]', JSON.stringify(reporteSanitizado));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, recibido: true });
  } catch (err) {
    console.error('[telemetry] Error procesando reporte:', err.message);
    return res.status(500).json({ ok: false, error: 'Error interno registrando telemetría' });
  }
};
