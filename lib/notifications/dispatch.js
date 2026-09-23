/**
 * 📡 ENDPOINT SERVERLESS: DESPACHO MASIVO DE ALERTAS WEB PUSH
 * api/notifications/dispatch.js
 * 
 * Envía notificaciones Push nativas a los dispositivos móviles y navegadores suscritos.
 * Protegido estrictamente con secreto interno (x-internal-secret).
 */

require('../env');
const webpush = require('web-push');
const crypto = require('crypto');
const { aplicarCorsSeguro } = require('../cors');
const { obtenerSuscripcionesFiltradas } = require('../push-subscriptions');
const { despacharLoteResiliente } = require('../push-dispatcher');

/**
 * Normaliza claves VAPID a formato Base64 URL-safe (sin '=' y con '-' y '_')
 * @param {string} key
 * @returns {string}
 */
function normalizarClaveVapid(key) {
  if (!key || typeof key !== 'string') return '';
  let limpia = key.trim();
  if ((limpia.startsWith('"') && limpia.endsWith('"')) || (limpia.startsWith("'") && limpia.endsWith("'"))) {
    limpia = limpia.slice(1, -1).trim();
  }
  return limpia
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

let vapidInicializado = false;

function asegurarVapidConfigurado() {
  if (vapidInicializado) return true;
  const rawPublic = process.env.VAPID_PUBLIC_KEY;
  const rawPrivate = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:contacto@origgo.online';

  if (!rawPublic || !rawPrivate) return false;

  const cleanPublic = normalizarClaveVapid(rawPublic);
  const cleanPrivate = normalizarClaveVapid(rawPrivate);

  try {
    webpush.setVapidDetails(subject, cleanPublic, cleanPrivate);
    vapidInicializado = true;
    return true;
  } catch (err) {
    console.warn('[vapid] Error inicializando detalles VAPID:', err.message);
    return false;
  }
}

// Intentar inicializar de forma segura si las variables están disponibles
asegurarVapidConfigurado();

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  // 🛡️ Autenticación de servidor a servidor vía cabecera segura
  const internalSecret = process.env.INTERNAL_API_SECRET || 'origgo_internal_secret_d4e8f1a2c3b5';
  const headerSecret = req.headers['x-internal-secret'] || '';

  const bufReceived = Buffer.from(String(headerSecret));
  const bufExpected = Buffer.from(String(internalSecret));
  const secretValido = bufReceived.length === bufExpected.length && crypto.timingSafeEqual(bufReceived, bufExpected);

  if (!secretValido) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'Acceso no autorizado.' });
  }

  if (!asegurarVapidConfigurado()) {
    return res.status(503).json({ ok: false, error: 'VAPID_NOT_CONFIGURED', message: 'Faltan credenciales VAPID válidas en el servidor.' });
  }

  try {
    const body = req.body || {};
    const urlDestino = body.url || (body.leadId ? `./?lead=${body.leadId}` : './');
    const leadId = body.leadId ? String(body.leadId) : null;
    const titleEs = body.title || '🔥 Nueva Oportunidad Directa — Origgo';
    const bodyEs = body.message || body.body || 'Nuevo inmueble comercializado directamente por su dueño sin comisiones.';
    const operacion = body.operacion || body.operation || 'todas';

    // Generación contextual inteligente en inglés si no se provee explícitamente
    const esRebaja = Boolean(body.title?.includes('Rebaja') || body.esRebaja);
    const ciudadFmt = body.ciudad && body.ciudad !== 'Colombia' ? ` in ${body.ciudad}` : '';
    const titleEn = body.titleEn || (esRebaja ? `📉 Price Drop${ciudadFmt} — Origgo` : `🔥 Direct Opportunity${ciudadFmt} — Origgo`);
    const bodyEn = body.messageEn || body.bodyEn || (esRebaja 
      ? 'Verified direct property with price reduction. Zero commission.' 
      : 'New verified property listed directly by its owner with zero commission.');

    // 🎨 Formato Rich Push enriquecido para máxima tasa de conversión
    const tagNotificacion = leadId ? `origgo-lead-${leadId}` : 'origgo-alert-general';
    const vibracionRadar = [200, 100, 200, 100, 250];

    const accionesEs = [
      { action: 'explore', title: '🔍 Ver Oportunidad' }
    ];
    const accionesEn = [
      { action: 'explore', title: '🔍 View Deal' }
    ];

    if (body.whatsappUrl || body.telefono) {
      accionesEs.push({ action: 'whatsapp', title: '💬 Trato Directo' });
      accionesEn.push({ action: 'whatsapp', title: '💬 Direct Chat' });
    }

    if (body.externalUrl) {
      accionesEs.push({ action: 'external', title: '🌐 Enlace Original' });
      accionesEn.push({ action: 'external', title: '🌐 Original Link' });
    }

    const payloadEs = JSON.stringify({
      title: titleEs,
      body: bodyEs,
      icon: body.icon || './apple-touch-icon.png',
      badge: body.badge || './favicon-32x32.png',
      image: body.image || undefined,
      vibrate: vibracionRadar,
      tag: tagNotificacion,
      renotify: true,
      requireInteraction: Boolean(body.requireInteraction || esRebaja),
      actions: accionesEs,
      data: {
        url: urlDestino,
        leadId,
        ciudad: body.ciudad || 'Colombia',
        operacion,
        whatsappUrl: body.whatsappUrl || null,
        externalUrl: body.externalUrl || null,
        lang: 'es'
      }
    });

    const payloadEn = JSON.stringify({
      title: titleEn,
      body: bodyEn,
      icon: body.icon || './apple-touch-icon.png',
      badge: body.badge || './favicon-32x32.png',
      image: body.image || undefined,
      vibrate: vibracionRadar,
      tag: tagNotificacion,
      renotify: true,
      requireInteraction: Boolean(body.requireInteraction || esRebaja),
      actions: accionesEn,
      data: {
        url: urlDestino,
        leadId,
        ciudad: body.ciudad || 'Colombia',
        operacion,
        whatsappUrl: body.whatsappUrl || null,
        externalUrl: body.externalUrl || null,
        lang: 'en'
      }
    });

    // 🎯 Segmentación multicriterio inteligente (Ciudad, Operación y Rebajas)
    const ciudadFiltro = body.ciudad || body.city || 'Colombia';
    const criteriosFiltro = {
      ciudad: ciudadFiltro,
      operacion,
      esRebaja,
      title: body.title
    };

    const suscripciones = await obtenerSuscripcionesFiltradas(criteriosFiltro);

    if (suscripciones.length === 0) {
      return res.status(200).json({
        ok: true,
        message: 'No hay dispositivos suscritos para estos criterios.',
        ciudadFiltrada: ciudadFiltro,
        operacionFiltrada: operacion,
        enviados: 0
      });
    }

    // 🚀 Despacho concurrente con reintentos exponenciales y auto-limpieza de 410/404
    const resultadoDespacho = await despacharLoteResiliente(webpush, suscripciones, payloadEs, payloadEn, {
      concurrencia: body.concurrencia || 25,
      maxReintentos: body.maxReintentos || 3,
      TTL: body.ttl || 3600
    });

    return res.status(200).json({
      ok: true,
      totalDestinatarios: suscripciones.length,
      ciudadFiltrada: ciudadFiltro,
      operacionFiltrada: operacion,
      enviados: resultadoDespacho.enviados,
      reintentados: resultadoDespacho.reintentados,
      fallidos: resultadoDespacho.fallidos,
      eliminadosPorExpiracion: resultadoDespacho.eliminados
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'DISPATCH_ERROR', message: error.message });
  }
};
