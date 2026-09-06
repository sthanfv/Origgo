/**
 * 🛡️ MÓDULO DE CONTROL DE ACCESO CORS CENTRALIZADO
 * Hunter Pro Intelligence / Origgo — Estándar Ecosistema Desmulta DevSecOps
 * 
 * Restringe el acceso de origen cruzado exclusivamente a los dominios oficiales
 * autorizados, mitigando ataques de falsificación de peticiones y robo de sesiones JWT.
 */

const DOMINIOS_PERMITIDOS = new Set([
  'https://hunter-pro.vercel.app',
  'https://origgo.vercel.app',
  'https://origgo-co.vercel.app',
  'https://origgo.online',
  'https://www.origgo.online',
  'http://localhost:5000',
  'http://localhost:3000',
  'http://127.0.0.1:5000'
]);

/**
 * Configura las cabeceras CORS seguras según la lista blanca.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
function aplicarCorsSeguro(req, res) {
  const origin = req.headers && req.headers.origin;

  if (origin && DOMINIOS_PERMITIDOS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Trace-Id');
}

module.exports = {
  aplicarCorsSeguro,
  DOMINIOS_PERMITIDOS
};
