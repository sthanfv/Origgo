/**
 * 🚀 DESPACHADOR RESILIENTE DE NOTIFICACIONES WEB PUSH
 * lib/push-dispatcher.js
 * 
 * Gestiona el envío concurrente de alertas Web Push con:
 * - Control de concurrencia por lotes para evitar saturación de red.
 * - Reintentos con backoff exponencial y jitter ante caídas transitorias de red o 5xx.
 * - Detección y auto-limpieza inmediata de suscripciones expiradas (HTTP 410 Gone / 404).
 * - Protección Zero-Crash Fail-Safe para serverless.
 */

const { eliminarSuscripcion } = require('./push-subscriptions');

/**
 * Determina si un error retornado por el servicio Push (FCM / Mozilla) es transitorio y merece reintento.
 * @param {any} err
 * @returns {boolean}
 */
function esErrorTransitorio(err) {
  if (!err) return false;
  const statusCode = err.statusCode || err.status;
  if (statusCode >= 500 && statusCode < 600) return true;
  if (statusCode === 429) return true; // Rate limiting temporal del servicio de push
  const msg = String(err.message || err.code || '').toLowerCase();
  return /econnreset|etimedout|eai_again|socket hang up|network error|enotfound/.test(msg);
}

/**
 * Determina si una suscripción ya no existe o fue revocada en el navegador cliente.
 * @param {any} err
 * @returns {boolean}
 */
function esSuscripcionExpirada(err) {
  if (!err) return false;
  const statusCode = err.statusCode || err.status;
  if (statusCode === 410 || statusCode === 404) return true;
  const msg = String(err.message || '').toLowerCase();
  return /expired|unsubscribed|not registered|invalid endpoint/.test(msg);
}

/**
 * Envía una notificación Web Push individual con reintentos exponenciales y auto-limpieza.
 * @param {object} webpushClient - Instancia configurada de web-push
 * @param {object} sub - Objeto de suscripción { endpoint, keys: { p256dh, auth } }
 * @param {string} payload - Payload JSON en string
 * @param {object} [opciones]
 * @returns {Promise<{ exito: boolean, reintentos: number, eliminado: boolean, status: number, error?: string }>}
 */
async function enviarNotificacionConReintento(webpushClient, sub, payload, opciones = {}) {
  const maxReintentos = typeof opciones.maxReintentos === 'number' ? opciones.maxReintentos : 3;
  const ttl = typeof opciones.TTL === 'number' ? opciones.TTL : 3600;
  const delayBaseMs = typeof opciones.delayBaseMs === 'number' ? opciones.delayBaseMs : 60;

  let intento = 0;
  let reintentosRealizados = 0;

  while (intento <= maxReintentos) {
    try {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: sub.keys
      };
      await webpushClient.sendNotification(pushSubscription, payload, { TTL: ttl });
      return {
        exito: true,
        reintentos: reintentosRealizados,
        eliminado: false,
        status: 200
      };
    } catch (err) {
      const statusCode = err.statusCode || err.status || 500;

      // 1. Caso de suscripción revocada o caducada (410 Gone / 404 Not Found)
      if (esSuscripcionExpirada(err)) {
        try {
          await eliminarSuscripcion(sub.endpoint);
        } catch (_) {}
        return {
          exito: false,
          reintentos: reintentosRealizados,
          eliminado: true,
          status: statusCode,
          error: 'SUBSCRIPTION_EXPIRED'
        };
      }

      // 2. Caso de error transitorio de red: reintentar con backoff exponencial
      if (esErrorTransitorio(err) && intento < maxReintentos) {
        reintentosRealizados++;
        intento++;
        const esperaJitter = delayBaseMs * Math.pow(2, intento) + Math.floor(Math.random() * 20);
        await new Promise(resolve => setTimeout(resolve, esperaJitter));
        continue;
      }

      // 3. Fallo terminal no recuperable o reintentos agotados
      return {
        exito: false,
        reintentos: reintentosRealizados,
        eliminado: false,
        status: statusCode,
        error: err.message || 'PUSH_DELIVERY_FAILED'
      };
    }
  }

  return {
    exito: false,
    reintentos: reintentosRealizados,
    eliminado: false,
    status: 500,
    error: 'MAX_RETRIES_EXCEEDED'
  };
}

/**
 * Despacha un conjunto de notificaciones concurrentemente mediante un pool de trabajadores.
 * @param {object} webpushClient
 * @param {Array<object>} suscripciones
 * @param {string} payloadEs
 * @param {string} payloadEn
 * @param {object} [opciones]
 * @returns {Promise<{ total: number, enviados: number, reintentados: number, fallidos: number, eliminados: number, detalles: Array<object> }>}
 */
async function despacharLoteResiliente(webpushClient, suscripciones = [], payloadEs, payloadEn, opciones = {}) {
  const concurrencia = Math.max(1, Math.min(opciones.concurrencia || 25, 50));
  const resultados = {
    total: suscripciones.length,
    enviados: 0,
    reintentados: 0,
    fallidos: 0,
    eliminados: 0,
    detalles: []
  };

  if (suscripciones.length === 0) {
    return resultados;
  }

  let indiceActual = 0;

  async function ejecutarTrabajador() {
    while (indiceActual < suscripciones.length) {
      const idx = indiceActual++;
      const sub = suscripciones[idx];
      const payload = sub.lang === 'en' ? payloadEn : payloadEs;

      const res = await enviarNotificacionConReintento(webpushClient, sub, payload, opciones);

      if (res.exito) {
        resultados.enviados++;
        if (res.reintentos > 0) {
          resultados.reintentados++;
        }
      } else {
        resultados.fallidos++;
        if (res.eliminado) {
          resultados.eliminados++;
        }
      }

      resultados.detalles.push({
        endpoint: sub.endpoint,
        exito: res.exito,
        status: res.status,
        reintentos: res.reintentos,
        eliminado: res.eliminado
      });
    }
  }

  const trabajadores = [];
  const totalTrabajadores = Math.min(concurrencia, suscripciones.length);
  for (let i = 0; i < totalTrabajadores; i++) {
    trabajadores.push(ejecutarTrabajador());
  }

  await Promise.all(trabajadores);
  return resultados;
}

module.exports = {
  enviarNotificacionConReintento,
  despacharLoteResiliente,
  esErrorTransitorio,
  esSuscripcionExpirada
};
