/**
 * 🛡️ MÓDULO DE IDEMPOTENCIA DISTRIBUIDA — UPSTASH REDIS & FAIL-SAFE MEMORY
 * lib/idempotency.js
 * 
 * Previene dobles cobros, duplicación de órdenes de pago y carreras de desbloqueo
 * ante clics repetidos o microcortes de red, utilizando bloqueos atómicos (NX)
 * y almacenamiento de resultados con TTL en Upstash Redis con degradación grácil a memoria.
 * Estándar DevSecOps Ecosistema Desmulta.
 */

const memStore = new Map();
const inFlightPromises = new Map();

// Limpieza periódica de memoria local cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memStore.entries()) {
    if (v.expiresAt && now > v.expiresAt) {
      memStore.delete(k);
    }
  }
}, 5 * 60 * 1000).unref?.();

/**
 * Reinicia el almacén en memoria (utilizado exclusivamente en pruebas unitarias).
 */
function resetIdempotencyStore() {
  memStore.clear();
  inFlightPromises.clear();
}

/**
 * Ejecuta un comando HTTP REST contra Upstash Redis con aborto por timeout estricto.
 * @param {Array<string|number>} commandArray - Vector de comando Redis (ej: ['GET', 'clave'])
 * @param {number} [timeoutMs=2000] - Tiempo máximo de espera en milisegundos
 * @returns {Promise<{ result: any } | null>}
 */
async function callRedisCommand(commandArray, timeoutMs = 2000) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken || typeof fetch === 'undefined') {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(redisUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${redisToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commandArray),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Intenta adquirir un bloqueo distribuido exclusivo para una clave de idempotencia.
 * @param {string} clave - Identificador único de la operación
 * @param {number} [lockTtlSegundos=30] - Tiempo de expiración del candado en segundos
 * @returns {Promise<boolean>} true si se adquirió el candado, false si ya estaba bloqueado
 */
async function adquirirBloqueo(clave, lockTtlSegundos = 30) {
  const redisLockKey = `idempotency:lock:${clave}`;

  const resRedis = await callRedisCommand(['SET', redisLockKey, 'LOCKED', 'EX', lockTtlSegundos, 'NX']);
  if (resRedis) {
    return resRedis.result === 'OK';
  }

  // Fallback Fail-Safe en memoria local
  const memKey = `lock:${clave}`;
  const now = Date.now();
  const entry = memStore.get(memKey);
  if (entry && now < entry.expiresAt) {
    return false;
  }

  memStore.set(memKey, { expiresAt: now + lockTtlSegundos * 1000 });
  return true;
}

/**
 * Libera de forma inmediata el bloqueo distribuido de una clave.
 * @param {string} clave
 */
async function liberarBloqueo(clave) {
  const redisLockKey = `idempotency:lock:${clave}`;
  await callRedisCommand(['DEL', redisLockKey]);
  memStore.delete(`lock:${clave}`);
}

/**
 * Verifica si existe un bloqueo activo para la clave indicada.
 * @param {string} clave
 * @returns {Promise<boolean>}
 */
async function verificarBloqueo(clave) {
  const redisLockKey = `idempotency:lock:${clave}`;
  const resRedis = await callRedisCommand(['GET', redisLockKey]);
  if (resRedis && resRedis.result !== null) {
    return true;
  }

  const memEntry = memStore.get(`lock:${clave}`);
  return Boolean(memEntry && Date.now() < memEntry.expiresAt);
}

/**
 * Almacena el resultado exitoso de una operación idempotente con TTL.
 * @param {string} clave - Identificador único
 * @param {object} resultado - Carga útil serializable de la respuesta
 * @param {number} [ttlSegundos=120] - Tiempo de retención en caché
 */
async function guardarResultadoIdempotente(clave, resultado, ttlSegundos = 120) {
  const redisResultKey = `idempotency:result:${clave}`;
  const redisLockKey = `idempotency:lock:${clave}`;
  const serialized = JSON.stringify(resultado);

  await callRedisCommand(['SET', redisResultKey, serialized, 'EX', ttlSegundos]);
  await callRedisCommand(['DEL', redisLockKey]);

  // Almacén en memoria local (Fail-Safe)
  memStore.set(`result:${clave}`, {
    data: resultado,
    expiresAt: Date.now() + ttlSegundos * 1000
  });
  memStore.delete(`lock:${clave}`);
}

/**
 * Recupera el resultado cacheado previamente para una clave idempotente.
 * @param {string} clave
 * @returns {Promise<object|null>}
 */
async function obtenerResultadoIdempotente(clave) {
  const redisResultKey = `idempotency:result:${clave}`;
  const resRedis = await callRedisCommand(['GET', redisResultKey]);
  if (resRedis && typeof resRedis.result === 'string') {
    try {
      return JSON.parse(resRedis.result);
    } catch (_) {}
  }

  const memEntry = memStore.get(`result:${clave}`);
  if (memEntry && Date.now() < memEntry.expiresAt) {
    return memEntry.data;
  }

  return null;
}

/**
 * Envoltorio de alta concurrencia que garantiza idempotencia distribuida y local.
 * Si múltiples peticiones concurrentes llegan con la misma clave, una sola ejecuta la acción
 * y las demás reciben de forma atómica el resultado idéntico con la marca `idempotent: true`.
 * 
 * @param {string} clave - Clave de idempotencia (ej: UUID v4 o referencia de orden)
 * @param {() => Promise<object>} operacionAsync - Función a ejecutar si se obtiene el candado
 * @param {object} [opciones={}]
 * @param {number} [opciones.ttlSegundos=120] - TTL en segundos para el resultado guardado
 * @param {number} [opciones.lockTtlSegundos=30] - TTL de protección contra caídas del líder
 * @param {number} [opciones.maxWaitMs=4000] - Tiempo máximo que esperan las peticiones concurrentes
 * @param {number} [opciones.pollIntervalMs=60] - Intervalo de sondeo en milisegundos
 * @returns {Promise<object>}
 */
async function ejecutarConIdempotencia(clave, operacionAsync, opciones = {}) {
  const ttlSegundos = opciones.ttlSegundos || 120;
  const lockTtlSegundos = opciones.lockTtlSegundos || 30;
  const maxWaitMs = opciones.maxWaitMs || 4000;
  const pollIntervalMs = opciones.pollIntervalMs || 60;

  // 1. Si el resultado ya existe en Redis o memoria local, devolverlo inmediatamente
  const cachedResult = await obtenerResultadoIdempotente(clave);
  if (cachedResult) {
    return { ...cachedResult, idempotent: true };
  }

  // 2. Si ya hay una promesa en vuelo en el mismo proceso, aguardar su resolución
  if (inFlightPromises.has(clave)) {
    const resVuelo = await inFlightPromises.get(clave);
    return { ...resVuelo, idempotent: true };
  }

  // 3. Intentar adquirir el candado distribuido
  const candadoAdquirido = await adquirirBloqueo(clave, lockTtlSegundos);

  if (candadoAdquirido) {
    let resolverPromesa;
    let rechazarPromesa;
    const promesaVuelo = new Promise((resolve, reject) => {
      resolverPromesa = resolve;
      rechazarPromesa = reject;
    });
    inFlightPromises.set(clave, promesaVuelo);

    try {
      const resultado = await operacionAsync();
      if (resultado && (resultado.esError || resultado.noCachear)) {
        await liberarBloqueo(clave);
      } else {
        await guardarResultadoIdempotente(clave, resultado, ttlSegundos);
      }
      resolverPromesa(resultado);
      return resultado;
    } catch (error) {
      await liberarBloqueo(clave);
      rechazarPromesa(error);
      throw error;
    } finally {
      inFlightPromises.delete(clave);
    }
  }

  // 4. Si el candado pertenece a otra instancia (concurrencia distribuida), esperar a que finalice
  const inicioEspera = Date.now();
  while (Date.now() - inicioEspera < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollIntervalMs));

    const resultadoEnEspera = await obtenerResultadoIdempotente(clave);
    if (resultadoEnEspera) {
      return { ...resultadoEnEspera, idempotent: true };
    }

    // Si el candado expiró o fue liberado sin resultado (ej: fallo del líder), reintentar adquisición
    const candadoAunActivo = await verificarBloqueo(clave);
    if (!candadoAunActivo) {
      const reintentoCandado = await adquirirBloqueo(clave, lockTtlSegundos);
      if (reintentoCandado) {
        const resultadoPrevio = await obtenerResultadoIdempotente(clave);
        if (resultadoPrevio) {
          await liberarBloqueo(clave);
          return { ...resultadoPrevio, idempotent: true };
        }
        try {
          const resultado = await operacionAsync();
          if (resultado && (resultado.esError || resultado.noCachear)) {
            await liberarBloqueo(clave);
          } else {
            await guardarResultadoIdempotente(clave, resultado, ttlSegundos);
          }
          return resultado;
        } catch (err) {
          await liberarBloqueo(clave);
          throw err;
        }
      }
    }
  }

  throw new Error('IDEMPOTENCIA_TIMEOUT: La operación concurrente excedió el tiempo límite de espera.');
}

module.exports = {
  adquirirBloqueo,
  liberarBloqueo,
  verificarBloqueo,
  guardarResultadoIdempotente,
  obtenerResultadoIdempotente,
  ejecutarConIdempotencia,
  resetIdempotencyStore
};
