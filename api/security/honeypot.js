/**
 * 🍯 HONEYPOT ACTIVO DE AUTODEFENSA PERIMETRAL (api/security/honeypot.js)
 * Intercepta tráfico malicioso y banea automáticamente la IP en Upstash Redis por 24h.
 * Estándar DevSecOps Ecosistema Desmulta. CERO intervención manual.
 */

const { getClientIp, banearIp } = require('../../lib/rate-limiter');

module.exports = async function handler(req, res) {
  const ip = getClientIp(req);
  const pathSolicitado = req.url || 'trampa';
  const method = req.method || 'GET';

  // Registrar baneo inmediato de 24 horas (86400 segundos) en Redis
  await banearIp(ip, 86400, `SCANNER_BOT:${method}:${pathSolicitado}`);

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(403).json({
    ok: false,
    error: 'IP_BLOCKED',
    message: 'Violación de directivas perimetrales. Dirección IP aislada automáticamente por 24 horas.'
  });
};
