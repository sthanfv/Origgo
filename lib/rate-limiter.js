/**
 * 🛡️ RATE LIMITER EN MEMORIA — HUNTER PRO INTELLIGENCE
 * Protección contra ataques de fuerza bruta al PIN, scraping y saturación DDoS.
 * Estándar DevSecOps Ecosistema Desmulta.
 */

const requestStore = new Map();

// Limpieza periódica de memoria cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestStore.entries()) {
    if (now > entry.resetTime) {
      requestStore.delete(key);
    }
  }
}, 10 * 60 * 1000).unref?.();

/**
 * Reinicia la memoria del rate limiter (útil para pruebas unitarias).
 */
function resetRateLimiter() {
  requestStore.clear();
}

/**
 * Obtiene la dirección IP real del cliente considerando proxies de Vercel/Cloudflare.
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
function getClientIp(req) {
  if (!req) return '127.0.0.1';
  const headers = req.headers || {};
  const trustProxy = process.env.VERCEL === '1' || process.env.TRUST_PROXY === '1';
  if (trustProxy) {
    const forwarded = headers['x-forwarded-for'] || headers['x-vercel-forwarded-for'];
    if (forwarded) {
      return String(forwarded).split(',')[0].trim();
    }
    if (headers['x-real-ip']) {
      return String(headers['x-real-ip']).trim();
    }
  }
  return String(req.socket?.remoteAddress || '127.0.0.1');
}

/**
 * Aplica limitación de tasa basada en ventana de tiempo fija con contador.
 * 
 * @param {object} req - Solicitud HTTP
 * @param {object} res - Respuesta HTTP
 * @param {object} opciones
 * @param {string} [opciones.prefix='global'] - Prefijo de namespace
 * @param {number} [opciones.maxRequests=20] - Máximo de peticiones permitidas
 * @param {number} [opciones.windowMs=60000] - Ventana de tiempo en milisegundos (default 1 min)
 * @param {string} [opciones.customKey] - Clave personalizada adicional (ej. celular)
 * @param {boolean} [opciones.enforceInTest=false] - Forzar rate limit incluso en pruebas unitarias
 * @returns {boolean} true si la petición está permitida, false si fue bloqueada (HTTP 429)
 */
function checkRateLimit(req, res, opciones = {}) {
  // Manejo de firma alternativa: checkRateLimit(req, 'prefijo', opciones)
  if (typeof res === 'string') {
    opciones = { prefix: res, ...(opciones || {}) };
    res = null;
  }

  // En entorno de testing unitario, no bloquear salvo que el test lo pida explícitamente
  if (process.env.NODE_ENV === 'test' && !opciones.enforceInTest) {
    return true;
  }

  const prefix = opciones.prefix || 'global';
  const max = opciones.maxRequests || 20;
  const windowMs = opciones.windowMs || (opciones.windowSeconds ? opciones.windowSeconds * 1000 : 60 * 1000);
  const ip = getClientIp(req);
  const key = `${prefix}:${opciones.customKey || ip}`;

  const now = Date.now();
  let entry = requestStore.get(key);

  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + windowMs
    };
    requestStore.set(key, entry);
  } else {
    entry.count++;
  }

  const remaining = Math.max(0, max - entry.count);
  const secondsToReset = Math.ceil((entry.resetTime - now) / 1000);

  if (res && typeof res.setHeader === 'function') {
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(secondsToReset));
  }

  if (entry.count > max) {
    if (res && typeof res.status === 'function') {
      if (typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', String(secondsToReset));
      }
      res.status(429).json({
        ok: false,
        error: opciones.error || 'TOO_MANY_REQUESTS',
        message: opciones.message || opciones.customMessage || `Límite de peticiones excedido. Por favor intenta de nuevo en ${secondsToReset} segundos.`,
        retryAfterSeconds: secondsToReset
      });
    }
    return false;
  }

  return true;
}

module.exports = {
  getClientIp,
  checkRateLimit,
  resetRateLimiter
};
