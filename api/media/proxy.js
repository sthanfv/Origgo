/**
 * 🖼️ ENDPOINT DE PROXY SEGURO DE MEDIOS (api/media/proxy.js)
 * 
 * Descarga y sirve imágenes de inmuebles eliminando metadatos sensibles (EXIF),
 * bloqueando ataques de SSRF (Server-Side Request Forgery) mediante lista blanca
 * de dominios CDN autorizados, e inyectando cabeceras de caché inmutables en Edge.
 * 
 * Estándar Ecosistema Desmulta DevSecOps.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

/**
 * Lista blanca de dominios CDN autorizados para retransmisión de imágenes.
 * Previene ataques SSRF contra redes internas, metadatos en la nube o servicios locales.
 */
const DOMINIOS_PERMITIDOS = [
  'fincaraiz.com.co',
  'metrocuadrado.com',
  'ciencuadras.com',
  'unsplash.com',
  'images.unsplash.com',
  'cloudinary.com',
  'amazonaws.com',
  'cloudfront.net'
];

/**
 * Rangos de direcciones IP privadas bloqueadas contra SSRF.
 */
const PATRONES_IP_PRIVADAS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./, // AWS / GCP metadata
  /^fc00:/i,
  /^fe80:/i,
  /^::1$/
];

/**
 * Valida si un host pertenece a la lista de dominios permitidos y no es privado.
 * @param {string} hostname
 * @returns {boolean}
 */
function esHostSeguro(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const hostLimpio = hostname.toLowerCase().trim();

  // Comprobar IPs privadas
  for (const patron of PATRONES_IP_PRIVADAS) {
    if (patron.test(hostLimpio)) return false;
  }

  // Comprobar coincidencia exacta o sufijo en lista blanca (.dominio.com)
  return DOMINIOS_PERMITIDOS.some((dominio) => {
    return hostLimpio === dominio || hostLimpio.endsWith(`.${dominio}`);
  });
}

/**
 * Manejador principal de peticiones serverless.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Método no permitido. Utilice GET o HEAD.' });
  }

  const { url } = req.query || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Parámetro "url" requerido en la consulta.' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    return res.status(400).json({ error: 'URL inválida o malformada.' });
  }

  // Validar protocolo seguro
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'Protocolo no soportado. Solo se permite HTTP y HTTPS.' });
  }

  // Validar host contra lista blanca anti-SSRF
  if (!esHostSeguro(parsedUrl.hostname)) {
    return res.status(403).json({ error: 'Dominio de imagen no autorizado por la política de seguridad.' });
  }

  const clienteHttp = parsedUrl.protocol === 'https:' ? https : http;

  const opcionesPeticion = {
    method: 'GET',
    headers: {
      'User-Agent': 'OriggoMediaProxy/1.0 (Edge Image Transcoder)',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    },
    timeout: 8000 // 8 segundos de límite para proteger la función serverless
  };

  try {
    const streamExterno = await new Promise((resolve, reject) => {
      const peticion = clienteHttp.get(parsedUrl.href, opcionesPeticion, (respuesta) => {
        // Seguir redirecciones 301/302 seguras hasta 2 saltos
        if (respuesta.statusCode >= 300 && respuesta.statusCode < 400 && respuesta.headers.location) {
          try {
            const redirectUrl = new URL(respuesta.headers.location, parsedUrl.href);
            if (!esHostSeguro(redirectUrl.hostname)) {
              return reject(new Error('Redirección a host no autorizado'));
            }
            const peticionRedir = (redirectUrl.protocol === 'https:' ? https : http).get(
              redirectUrl.href,
              opcionesPeticion,
              (resRedir) => resolve(resRedir)
            );
            peticionRedir.on('error', reject);
            peticionRedir.on('timeout', () => {
              peticionRedir.destroy();
              reject(new Error('Tiempo de espera agotado en redirección'));
            });
            return;
          } catch (e) {
            return reject(new Error('URL de redirección inválida'));
          }
        }

        if (respuesta.statusCode !== 200) {
          return reject(new Error(`El servidor de origen respondió con estado ${respuesta.statusCode}`));
        }
        resolve(respuesta);
      });

      peticion.on('error', reject);
      peticion.on('timeout', () => {
        peticion.destroy();
        reject(new Error('Tiempo de espera agotado al conectar con el servidor de medios'));
      });
    });

    // Validar tipo de contenido de imagen
    const contentType = streamExterno.headers['content-type'] || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return res.status(415).json({ error: 'El recurso solicitado no es una imagen válida.' });
    }

    // Cabeceras de caché inmutables en Edge y CDN
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Transmitir chunks al cliente limitando a 8MB máximo
    let totalBytes = 0;
    const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

    streamExterno.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BYTES) {
        streamExterno.destroy();
        if (!res.headersSent) {
          res.status(413).json({ error: 'La imagen excede el límite máximo permitido de 8MB.' });
        } else {
          res.end();
        }
        return;
      }
      res.write(chunk);
    });

    streamExterno.on('end', () => {
      res.end();
    });

    streamExterno.on('error', (err) => {
      console.error('[proxy-medios] Error en el flujo de datos:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Error al transferir los datos de la imagen.' });
      } else {
        res.end();
      }
    });

  } catch (error) {
    console.error('[proxy-medios] Excepción al procesar imagen:', error.message);
    return res.status(502).json({
      error: 'No fue posible recuperar la imagen desde el servidor de origen.',
      detalle: error.message
    });
  }
};
