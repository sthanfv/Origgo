/**
 * 📡 ENDPOINT SERVERLESS: DESPACHO MASIVO DE ALERTAS WEB PUSH
 * api/notifications/dispatch.js
 * 
 * Envía notificaciones Push nativas a los dispositivos móviles y navegadores suscritos.
 * Protegido estrictamente con secreto interno (x-internal-secret).
 */

require('../../lib/env');
const webpush = require('web-push');
const crypto = require('crypto');
const { aplicarCorsSeguro } = require('../../lib/cors');
const { obtenerSuscripcionesActivas } = require('../../lib/push-subscriptions');

// Configuración de VAPID
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:contacto@origgo.online';

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

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

  if (!publicKey || !privateKey) {
    return res.status(503).json({ ok: false, error: 'VAPID_NOT_CONFIGURED', message: 'Faltan credenciales VAPID en el servidor.' });
  }

  try {
    const body = req.body || {};
    const urlDestino = body.url || (body.leadId ? `./?lead=${body.leadId}` : './');
    const titleEs = body.title || '🔥 Nueva Oportunidad Directa — Origgo';
    const bodyEs = body.message || body.body || 'Nuevo inmueble comercializado directamente por su dueño sin comisiones.';
    const titleEn = body.titleEn || '🔥 New Direct Opportunity — Origgo';
    const bodyEn = body.messageEn || body.bodyEn || 'New verified property listed directly by its owner with zero commission.';

    const payloadEs = JSON.stringify({
      title: titleEs,
      body: bodyEs,
      icon: body.icon || './apple-touch-icon.png',
      badge: body.badge || './favicon-32x32.png',
      image: body.image || undefined,
      data: { url: urlDestino, leadId: body.leadId || null, ciudad: body.ciudad || 'Colombia', lang: 'es' }
    });

    const payloadEn = JSON.stringify({
      title: titleEn,
      body: bodyEn,
      icon: body.icon || './apple-touch-icon.png',
      badge: body.badge || './favicon-32x32.png',
      image: body.image || undefined,
      data: { url: urlDestino, leadId: body.leadId || null, ciudad: body.ciudad || 'Colombia', lang: 'en' }
    });

    const suscripcionesTodas = await obtenerSuscripcionesActivas();
    // Segmentación por ciudad si se especifica en el despacho
    const suscripciones = body.ciudad && body.ciudad !== 'Colombia'
      ? suscripcionesTodas.filter(s => !s.ciudad || s.ciudad === 'Colombia' || s.ciudad.toLowerCase() === body.ciudad.toLowerCase())
      : suscripcionesTodas;

    if (suscripciones.length === 0) {
      return res.status(200).json({ ok: true, message: 'No hay dispositivos suscritos para este criterio.', enviados: 0 });
    }

    let enviados = 0;
    let fallidos = 0;

    const promesasEnvio = suscripciones.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: sub.keys
        };
        const payloadFinal = sub.lang === 'en' ? payloadEn : payloadEs;
        await webpush.sendNotification(pushSubscription, payloadFinal, { TTL: 3600 });
        enviados++;
      } catch (err) {
        fallidos++;
      }
    });

    await Promise.all(promesasEnvio);

    return res.status(200).json({
      ok: true,
      totalDestinatarios: suscripciones.length,
      enviados,
      fallidos
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'DISPATCH_ERROR', message: error.message });
  }
};
