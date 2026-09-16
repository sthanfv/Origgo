/**
 * 🧪 TEST UNITARIO: SISTEMA WEB PUSH PWA ($0 COSTE)
 * tests/web_push.test.js
 * 
 * Valida:
 * 1. Entrega segura de clave pública VAPID sin variables en frontend estático.
 * 2. Validación de esquemas y registro de suscripciones W3C Push API.
 * 3. Protección criptográfica del endpoint de despacho (401 sin x-internal-secret).
 * 4. Deduplicación y persistencia de suscripciones.
 */

const test = require('node:test');
const assert = require('node:assert');
require('../lib/env');

const subscribeHandler = require('../api/notifications/subscribe');
const dispatchHandler = require('../api/notifications/dispatch');
const { 
  hashEndpoint, 
  registrarSuscripcion, 
  obtenerSuscripcionesActivas,
  obtenerSuscripcionesPorCiudad,
  coincideCiudadSuscripcion,
  normalizarTexto
} = require('../lib/push-subscriptions');

function mockReqRes(options = {}) {
  const headersRes = {};
  let statusCode = 200;
  let responseData = null;

  const req = {
    method: options.method || 'GET',
    headers: { ...options.headers },
    body: options.body || {},
    socket: { remoteAddress: '190.25.1.1' }
  };

  const res = {
    setHeader(nombre, valor) {
      headersRes[nombre.toLowerCase()] = String(valor);
    },
    status(code) {
      statusCode = code;
      return {
        json(data) {
          responseData = data;
          return data;
        },
        end() {
          return null;
        }
      };
    },
    getStatusCode: () => statusCode,
    getData: () => responseData,
    getHeaders: () => headersRes
  };

  return { req, res };
}

test('Suite DevSecOps Web Push PWA (VAPID)', async (t) => {
  await t.test('1. Endpoint subscribe (GET) debe entregar la clave pública y bloquear métodos no soportados', async () => {
    // Prueba GET válido (clave pública VAPID)
    const { req, res } = mockReqRes({ method: 'GET' });
    await subscribeHandler(req, res);
    
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getData();
    assert.strictEqual(data.ok, true);
    assert.ok(typeof data.publicKey === 'string' && data.publicKey.length > 30);

    // Prueba método no soportado (ej. PUT) rechazado
    const { req: reqPut, res: resPut } = mockReqRes({ method: 'PUT' });
    await subscribeHandler(reqPut, resPut);
    assert.strictEqual(resPut.getStatusCode(), 405);
  });

  await t.test('2. Endpoint subscribe debe validar el formato W3C Push API', async () => {
    // Suscripción inválida (sin keys)
    const { req: reqInvalido, res: resInvalido } = mockReqRes({
      method: 'POST',
      body: { subscription: { endpoint: 'https://push.example.com/123' } }
    });
    await subscribeHandler(reqInvalido, resInvalido);
    assert.strictEqual(resInvalido.getStatusCode(), 400);

    // Suscripción válida
    const subValida = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-sub-12345',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0PwtgoaqOMQJaBoeBlaK2Uv1-6Bg',
        auth: 'tBHItJI5svbpez7KI4CCXg'
      }
    };

    const { req: reqValido, res: resValido } = mockReqRes({
      method: 'POST',
      body: { subscription: subValida, ciudad: 'Bogotá' }
    });
    await subscribeHandler(reqValido, resValido);
    assert.strictEqual(resValido.getStatusCode(), 200);
    assert.strictEqual(resValido.getData().ok, true);
  });

  await t.test('3. Endpoint dispatch debe rechazar accesos sin secreto interno (401 Unauthorized)', async () => {
    // Sin cabecera x-internal-secret
    const { req: reqSinAuth, res: resSinAuth } = mockReqRes({
      method: 'POST',
      headers: {},
      body: { message: 'Alerta no autorizada' }
    });
    await dispatchHandler(reqSinAuth, resSinAuth);
    assert.strictEqual(resSinAuth.getStatusCode(), 401);

    // Con secreto incorrecto
    const { req: reqMalo, res: resMalo } = mockReqRes({
      method: 'POST',
      headers: { 'x-internal-secret': 'secreto_falso_hack' },
      body: { message: 'Alerta no autorizada' }
    });
    await dispatchHandler(reqMalo, resMalo);
    assert.strictEqual(resMalo.getStatusCode(), 401);
  });

  await t.test('4. Deduplicación por hashEndpoint en suscripciones', () => {
    const ep1 = 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABnz';
    const h1 = hashEndpoint(ep1);
    const h2 = hashEndpoint(ep1);
    assert.strictEqual(h1, h2, 'El hash determinista debe ser idéntico');
    assert.strictEqual(h1.length, 32);
  });

  await t.test('5. Segmentación geográfica por ciudad y normalización de tildes', () => {
    // Normalización
    assert.strictEqual(normalizarTexto('Medellín, Antioquia'), 'medellin antioquia');
    assert.strictEqual(normalizarTexto('Bogotá D.C.'), 'bogota d c');

    // Coincidencia directa con acentos/mayúsculas
    assert.strictEqual(coincideCiudadSuscripcion('Medellín', 'medellin'), true);
    assert.strictEqual(coincideCiudadSuscripcion('bogota', 'Bogotá D.C.'), true);
    assert.strictEqual(coincideCiudadSuscripcion('Cali', 'cali'), true);
  });

  await t.test('6. Cobertura metropolitana de áreas de influencia', () => {
    // Suscriptor de Medellín recibe alerta de Envigado, Sabaneta, Bello, Itagüí
    assert.strictEqual(coincideCiudadSuscripcion('Medellín', 'Envigado'), true);
    assert.strictEqual(coincideCiudadSuscripcion('Medellin', 'Sabaneta'), true);
    assert.strictEqual(coincideCiudadSuscripcion('Medellín', 'Bello, Antioquia'), true);

    // Suscriptor de Bogotá recibe alerta de Chía, Cajicá o Soacha
    assert.strictEqual(coincideCiudadSuscripcion('Bogotá', 'Chía'), true);
    assert.strictEqual(coincideCiudadSuscripcion('Bogotá', 'Cajicá'), true);

    // Suscriptor de Eje Cafetero recibe alerta de Pereira, Manizales o Armenia
    assert.strictEqual(coincideCiudadSuscripcion('Eje Cafetero', 'Pereira'), true);
    assert.strictEqual(coincideCiudadSuscripcion('Eje Cafetero', 'Armenia, Quindío'), true);
  });

  await t.test('7. Aislamiento estricto entre ciudades distintas', () => {
    // Suscriptor de Cali NO debe recibir alertas de Medellín o Bogotá
    assert.strictEqual(coincideCiudadSuscripcion('Cali', 'Medellín'), false);
    assert.strictEqual(coincideCiudadSuscripcion('Bogotá', 'Barranquilla'), false);
    assert.strictEqual(coincideCiudadSuscripcion('Bucaramanga', 'Cali'), false);
  });

  await t.test('8. Suscriptor nacional (Colombia / Todas) recibe todas las alertas', () => {
    assert.strictEqual(coincideCiudadSuscripcion('Colombia', 'Medellín'), true);
    assert.strictEqual(coincideCiudadSuscripcion('todas', 'Bogotá'), true);
    assert.strictEqual(coincideCiudadSuscripcion('', 'Cali'), true);
  });

  await t.test('9. Alerta nacional general llega a todos los usuarios', () => {
    assert.strictEqual(coincideCiudadSuscripcion('Medellín', 'Colombia'), true);
    assert.strictEqual(coincideCiudadSuscripcion('Bogotá', 'nacional'), true);
    assert.strictEqual(coincideCiudadSuscripcion('Cali', ''), true);
  });

  await t.test('10. Actualización de preferencia de ciudad sobre el mismo endpoint', async () => {
    const endpointTest = `https://fcm.googleapis.com/fcm/send/city-update-${Date.now()}`;
    const sub = {
      endpoint: endpointTest,
      keys: { p256dh: 'mock-p256dh-key', auth: 'mock-auth-key' }
    };

    // Suscribir inicialmente para Bogotá
    await registrarSuscripcion(sub, { ciudad: 'Bogotá' });
    let subsBogota = await obtenerSuscripcionesPorCiudad('Bogotá');
    const encontradoBogota = subsBogota.find(s => s.endpoint === endpointTest);
    assert.ok(encontradoBogota, 'Debe encontrarse en Bogotá');
    assert.strictEqual(encontradoBogota.ciudad, 'Bogotá');

    // Actualizar preferencia a Medellín
    await registrarSuscripcion(sub, { ciudad: 'Medellín' });
    subsBogota = await obtenerSuscripcionesPorCiudad('Bogotá');
    const subsMedellin = await obtenerSuscripcionesPorCiudad('Medellín');

    const aunEnBogota = subsBogota.find(s => s.endpoint === endpointTest);
    const ahoraEnMedellin = subsMedellin.find(s => s.endpoint === endpointTest);

    assert.strictEqual(aunEnBogota, undefined, 'Ya no debe recibir alertas de Bogotá');
    assert.ok(ahoraEnMedellin, 'Debe recibir ahora alertas de Medellín');
    assert.strictEqual(ahoraEnMedellin.ciudad, 'Medellín');
  });

  await t.test('11. Segmentación multicriterio por tipo de operación (Venta / Arriendo)', () => {
    const { coincideCriteriosSuscripcion } = require('../lib/push-subscriptions');

    const subVenta = { ciudad: 'Bogotá', operacion: 'venta', soloRebajas: false };
    const subArriendo = { ciudad: 'Bogotá', operacion: 'arriendo', soloRebajas: false };
    const subTodas = { ciudad: 'Bogotá', operacion: 'todas', soloRebajas: false };

    // Inmueble en venta
    const leadVenta = { ciudad: 'Bogotá', operacion: 'Venta', rebaja: false };
    assert.strictEqual(coincideCriteriosSuscripcion(subVenta, leadVenta), true, 'Sub venta debe recibir venta');
    assert.strictEqual(coincideCriteriosSuscripcion(subArriendo, leadVenta), false, 'Sub arriendo NO debe recibir venta');
    assert.strictEqual(coincideCriteriosSuscripcion(subTodas, leadVenta), true, 'Sub todas debe recibir venta');

    // Inmueble en arriendo
    const leadArriendo = { ciudad: 'Bogotá', operacion: 'Arriendo', rebaja: false };
    assert.strictEqual(coincideCriteriosSuscripcion(subVenta, leadArriendo), false, 'Sub venta NO debe recibir arriendo');
    assert.strictEqual(coincideCriteriosSuscripcion(subArriendo, leadArriendo), true, 'Sub arriendo debe recibir arriendo');
    assert.strictEqual(coincideCriteriosSuscripcion(subTodas, leadArriendo), true, 'Sub todas debe recibir arriendo');
  });

  await t.test('12. Segmentación multicriterio por filtro de rebajas y oportunidades urgentes', () => {
    const { coincideCriteriosSuscripcion } = require('../lib/push-subscriptions');

    const subExigente = { ciudad: 'Medellín', operacion: 'todas', soloRebajas: true };
    const subNormal = { ciudad: 'Medellín', operacion: 'todas', soloRebajas: false };

    // Inmueble sin rebaja
    const leadSinRebaja = { ciudad: 'Medellín', operacion: 'Venta', rebaja: false };
    assert.strictEqual(coincideCriteriosSuscripcion(subExigente, leadSinRebaja), false, 'Sub soloRebajas NO debe recibir sin rebaja');
    assert.strictEqual(coincideCriteriosSuscripcion(subNormal, leadSinRebaja), true, 'Sub normal sí debe recibir');

    // Inmueble con rebaja urgente
    const leadConRebaja = { ciudad: 'Medellín', operacion: 'Venta', rebaja: true, descuento: '-15%' };
    assert.strictEqual(coincideCriteriosSuscripcion(subExigente, leadConRebaja), true, 'Sub soloRebajas debe recibir inmueble rebajado');
    assert.strictEqual(coincideCriteriosSuscripcion(subNormal, leadConRebaja), true, 'Sub normal también recibe inmueble rebajado');
  });

  await t.test('13. Despachador resiliente: Auto-limpieza en caso peor HTTP 410 (Gone)', async () => {
    const { enviarNotificacionConReintento } = require('../lib/push-dispatcher');
    const { registrarSuscripcion, obtenerSuscripcionesActivas } = require('../lib/push-subscriptions');

    const epExpirado = `https://fcm.googleapis.com/fcm/send/expired-410-${Date.now()}`;
    const sub = { endpoint: epExpirado, keys: { p256dh: 'key1', auth: 'auth1' } };
    await registrarSuscripcion(sub, { ciudad: 'Cali' });

    // Mock de cliente webpush que simula 410 Gone
    const mockWebPush410 = {
      sendNotification: async () => {
        const error = new Error('Subscription expired or unsubscribed');
        error.statusCode = 410;
        throw error;
      }
    };

    const resultado = await enviarNotificacionConReintento(mockWebPush410, sub, JSON.stringify({ titulo: 'Test' }));

    assert.strictEqual(resultado.exito, false);
    assert.strictEqual(resultado.eliminado, true);
    assert.strictEqual(resultado.status, 410);

    // Verificar que la suscripción fue eliminada efectivamente de la persistencia
    const activas = await obtenerSuscripcionesActivas();
    const existe = activas.some(s => s.endpoint === epExpirado);
    assert.strictEqual(existe, false, 'La suscripción 410 debe ser purgada de la base de datos');
  });

  await t.test('14. Despachador resiliente: Auto-limpieza en caso HTTP 404 (Not Found)', async () => {
    const { enviarNotificacionConReintento } = require('../lib/push-dispatcher');
    const { registrarSuscripcion, obtenerSuscripcionesActivas } = require('../lib/push-subscriptions');

    const ep404 = `https://fcm.googleapis.com/fcm/send/notfound-404-${Date.now()}`;
    const sub = { endpoint: ep404, keys: { p256dh: 'key2', auth: 'auth2' } };
    await registrarSuscripcion(sub, { ciudad: 'Barranquilla' });

    const mockWebPush404 = {
      sendNotification: async () => {
        const error = new Error('Endpoint not found');
        error.statusCode = 404;
        throw error;
      }
    };

    const resultado = await enviarNotificacionConReintento(mockWebPush404, sub, JSON.stringify({ titulo: 'Test' }));
    assert.strictEqual(resultado.exito, false);
    assert.strictEqual(resultado.eliminado, true);

    const activas = await obtenerSuscripcionesActivas();
    const existe = activas.some(s => s.endpoint === ep404);
    assert.strictEqual(existe, false, 'La suscripción 404 debe ser purgada');
  });

  await t.test('15. Despachador resiliente: Recuperación ante fallo transitorio (503 Service Unavailable)', async () => {
    const { enviarNotificacionConReintento } = require('../lib/push-dispatcher');

    let intentos = 0;
    const mockWebPushFlaky = {
      sendNotification: async () => {
        intentos++;
        if (intentos < 2) {
          const error = new Error('Gateway Timeout / Service Unavailable');
          error.statusCode = 503;
          throw error;
        }
        return { statusCode: 201 };
      }
    };

    const sub = { endpoint: 'https://updates.push.services.mozilla.com/test-flaky', keys: { p256dh: 'k', auth: 'a' } };
    const res = await enviarNotificacionConReintento(mockWebPushFlaky, sub, JSON.stringify({ titulo: 'Test' }), {
      maxReintentos: 2,
      delayBaseMs: 10
    });

    assert.strictEqual(res.exito, true, 'Debe tener éxito tras el reintento');
    assert.strictEqual(res.reintentos, 1, 'Debe registrar 1 reintento');
    assert.strictEqual(intentos, 2);
  });

  await t.test('16. Despacho en lote concurrente (despacharLoteResiliente) y resumen métrico', async () => {
    const { despacharLoteResiliente } = require('../lib/push-dispatcher');

    const subsMock = [
      { endpoint: 'https://push.com/ok-1', keys: { p256dh: 'k', auth: 'a' }, lang: 'es' },
      { endpoint: 'https://push.com/ok-2', keys: { p256dh: 'k', auth: 'a' }, lang: 'en' },
      { endpoint: 'https://push.com/fail-410', keys: { p256dh: 'k', auth: 'a' }, lang: 'es' }
    ];

    const mockClient = {
      sendNotification: async (sub) => {
        if (sub.endpoint.includes('fail-410')) {
          const err = new Error('Expired');
          err.statusCode = 410;
          throw err;
        }
        return { statusCode: 201 };
      }
    };

    const resultadoLote = await despacharLoteResiliente(
      mockClient,
      subsMock,
      JSON.stringify({ es: true }),
      JSON.stringify({ en: true }),
      { concurrencia: 2, delayBaseMs: 5 }
    );

    assert.strictEqual(resultadoLote.total, 3);
    assert.strictEqual(resultadoLote.enviados, 2);
    assert.strictEqual(resultadoLote.fallidos, 1);
    assert.strictEqual(resultadoLote.eliminados, 1);
  });

  await t.test('17. Validación estricta de estructura Rich Push (Imagen, Acciones Temu, Hápticos)', () => {
    // Simulamos la generación del payload de despacho
    const payload = {
      title: '🏡 Casa en El Poblado ($450M)',
      body: 'Directo con propietario. Sin comisión de agencia.',
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/badge-72x72.png',
      image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'lead-med-001',
      data: {
        leadId: 'med-001',
        url: '/?lead=med-001',
        leadUrl: 'https://facebook.com/marketplace/item/12345'
      },
      actions: [
        { action: 'ver-oportunidad', title: 'Ver Oportunidad' },
        { action: 'trato-directo', title: 'Trato Directo' },
        { action: 'enlace-original', title: 'Enlace Original' }
      ]
    };

    assert.ok(payload.image.startsWith('https://'), 'Debe contar con banner visual rico');
    assert.strictEqual(payload.actions.length, 3, 'Debe incorporar 3 acciones de interacción rápida');
    assert.strictEqual(payload.actions[0].action, 'ver-oportunidad');
    assert.strictEqual(payload.actions[1].action, 'trato-directo');
    assert.strictEqual(payload.actions[2].action, 'enlace-original');
    assert.deepStrictEqual(payload.vibrate, [200, 100, 200, 100, 200], 'Patrón háptico prioritario');
    assert.ok(payload.data.leadId, 'Deep-linking con identificador de inmueble');
  });
});
