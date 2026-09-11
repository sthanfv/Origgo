/**
 * 📲 SCRIPT DE PRUEBA DE DESPACHO WEB PUSH NATIVO
 * scripts/test_dispatch_push.js
 * 
 * Permite emitir una notificación Push de prueba en vivo a todos
 * los dispositivos suscritos registrados en la base de datos de Origgo.
 */

require('../lib/env');
const webpush = require('web-push');
const { obtenerSuscripcionesActivas } = require('../lib/push-subscriptions');

async function dispararPrueba() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:contacto@origgo.online';

  if (!publicKey || !privateKey) {
    console.error('❌ ERROR: Faltan variables VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY en .env');
    process.exit(1);
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const subs = await obtenerSuscripcionesActivas();
  console.log(`📡 Suscripciones activas encontradas en el sistema: ${subs.length}`);

  if (subs.length === 0) {
    console.log('ℹ️ No hay navegadores o teléfonos suscritos todavía.');
    console.log('👉 Entra a https://origgo.online en tu teléfono, abre el menú y pulsa "🔔 Activar Alertas en Vivo".');
    return;
  }

  const payload = JSON.stringify({
    title: '🔥 Ganga Detectada — Origgo',
    body: 'Apartamento directo en El Salado, Ibagué por $130M (-22% bajo avalúo). Toca para ver.',
    icon: './apple-touch-icon.png',
    badge: './favicon-32x32.png',
    data: { url: './' }
  });

  let enviados = 0;
  let errores = 0;

  for (const s of subs) {
    try {
      await webpush.sendNotification({
        endpoint: s.endpoint,
        keys: s.keys
      }, payload, { TTL: 3600 });
      console.log(`  ✅ Notificación enviada con éxito a endpoint: ${s.endpoint.slice(0, 40)}...`);
      enviados++;
    } catch (err) {
      console.warn(`  ⚠️ Fallo en envío a ${s.endpoint.slice(0, 40)}: ${err.statusCode || err.message}`);
      errores++;
    }
  }

  console.log(`\n🎉 Despacho finalizado: ${enviados} enviadas con éxito, ${errores} fallidas.`);
}

dispararPrueba().catch(e => console.error(e));
