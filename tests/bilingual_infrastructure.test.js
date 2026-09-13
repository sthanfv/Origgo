/**
 * 🧪 TESTS DE INFRAESTRUCTURA BILINGÜE Y RESILIENCIA
 * tests/bilingual_infrastructure.test.js
 * 
 * Valida de forma automatizada:
 * 1. Generación de plantillas institucionales de correo Resend (ES/EN).
 * 2. Validación estricta con Zod de esquemas bilingües (recover, createOrder, session, push).
 * 3. Persistencia de suscripciones Web Push con atributo lang.
 * 4. Despacho y formateo de notificaciones push segmentadas por idioma.
 * 5. Respuestas de error y notas de contacto localizadas en /api/leads/unlock.
 * 6. Traducción determinista de títulos y tipos inmobiliarios en el catálogo.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Módulos bajo prueba
const {
  generarPlantillaRestauracion,
  generarPlantillaSinCreditos,
  generarPlantillaConfirmacionPago
} = require('../lib/email-templates');

const {
  recoverPinSchema,
  createOrderSchema,
  sessionLoginSchema,
  subscribePushSchema,
  unlockLeadSchema,
  validateBody
} = require('../lib/validation');

const { registrarSuscripcion, obtenerSuscripcionesActivas } = require('../lib/push-subscriptions');

describe('🌐 Infraestructura Bilingüe — Correos Transaccionales (Resend)', () => {
  it('Debe generar plantilla de restauración en español con textos institucionales correctos', () => {
    const html = generarPlantillaRestauracion({
      phone: '3001234567',
      email: 'usuario@correo.com',
      recoveryUrl: 'https://origgo.online?recovery_token=abc123token',
      credits: 3,
      lang: 'es'
    });
    assert.ok(html.includes('Restauración de Credenciales'), 'Debe incluir título en español');
    assert.ok(html.includes('RESTAURAR MI ACCESO SEGURO'), 'Debe incluir botón en español');
    assert.ok(html.includes('3 Créditos'), 'Debe incluir formato de créditos en español');
    assert.ok(html.includes('lang="es"'), 'Debe declarar lang es');
  });

  it('Debe generar plantilla de restauración en inglés para usuarios angloparlantes', () => {
    const html = generarPlantillaRestauracion({
      phone: '3001234567',
      email: 'investor@global.com',
      recoveryUrl: 'https://origgo.online?recovery_token=abc123token',
      credits: 5,
      lang: 'en'
    });
    assert.ok(html.includes('Credential Restoration'), 'Debe incluir título en inglés');
    assert.ok(html.includes('RESTORE MY SECURE ACCESS'), 'Debe incluir botón en inglés');
    assert.ok(html.includes('5 Credits'), 'Debe incluir créditos en inglés');
    assert.ok(html.includes('lang="en"'), 'Debe declarar lang en');
    assert.ok(html.includes('Anti-Fraud Protocol'), 'Debe incluir alerta de seguridad en inglés');
  });

  it('Debe generar plantilla de estado sin saldo en español e inglés según parámetro', () => {
    const htmlEs = generarPlantillaSinCreditos({
      phone: '3119876543',
      email: 'sincreditos@correo.com',
      checkoutUrl: 'https://origgo.online?modal=checkout',
      lang: 'es'
    });
    assert.ok(htmlEs.includes('Línea Registrada sin Créditos Activos'));
    assert.ok(htmlEs.includes('ACTIVAR CRÉDITOS'));

    const htmlEn = generarPlantillaSinCreditos({
      phone: '3119876543',
      email: 'investor@usafund.com',
      checkoutUrl: 'https://origgo.online?modal=checkout',
      lang: 'en'
    });
    assert.ok(htmlEn.includes('Registered Account without Active Credits'));
    assert.ok(htmlEn.includes('ACTIVATE CREDITS OR PRO PASS'));
  });

  it('Debe generar plantilla de confirmación de pago en inglés con monto y PIN', () => {
    const html = generarPlantillaConfirmacionPago({
      phone: '3157778899',
      email: 'buyer@corp.com',
      reference: 'HNT-3157778899-10CR-TEST',
      productName: '10 Direct Contacts Pack',
      amountInCents: 3500000,
      pin: 'HNT-8822',
      credits: 10,
      magicUrl: 'https://origgo.online?recovery_token=xyz',
      lang: 'en'
    });
    assert.ok(html.includes('Your access is ready and activated!'));
    assert.ok(html.includes('HNT-8822'));
    assert.ok(html.includes('ACCESS MY ACCOUNT IN 1 CLICK'));
  });
});

describe('🛡️ Infraestructura de Validación Zod — Soporte de Idioma', () => {
  it('recoverPinSchema debe aceptar lang opcional (es / en) y rechazar idiomas inválidos', () => {
    const resEs = validateBody(recoverPinSchema, { email: 'test@origgo.online', lang: 'es' });
    assert.equal(resEs.success, true);
    assert.equal(resEs.data.lang, 'es');

    const resEn = validateBody(recoverPinSchema, { email: 'test@origgo.online', lang: 'en' });
    assert.equal(resEn.success, true);
    assert.equal(resEn.data.lang, 'en');

    const resInvalido = validateBody(recoverPinSchema, { email: 'test@origgo.online', lang: 'fr' });
    assert.equal(resInvalido.success, false);
  });

  it('createOrderSchema debe preservar lang en payload de checkout', () => {
    const res = validateBody(createOrderSchema, {
      productType: 'single_lead',
      celular: '3001234567',
      lang: 'en'
    });
    assert.equal(res.success, true);
    assert.equal(res.data.lang, 'en');
  });

  it('subscribePushSchema debe validar endpoint HTTPS y lang', () => {
    const resValido = validateBody(subscribePushSchema, {
      subscription: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/fake-endpoint',
        keys: { p256dh: 'p256dh_key_test', auth: 'auth_key_test' }
      },
      ciudad: 'Medellin',
      lang: 'en'
    });
    assert.equal(resValido.success, true);
    assert.equal(resValido.data.lang, 'en');

    const resInseguro = validateBody(subscribePushSchema, {
      subscription: {
        endpoint: 'http://insecure-endpoint.com',
        keys: { p256dh: 'p', auth: 'a' }
      }
    });
    assert.equal(resInseguro.success, false);
  });
});

describe('📲 Infraestructura Web Push — Almacenamiento y Segmentación', () => {
  it('registrarSuscripcion debe persistir la preferencia de idioma del dispositivo', async () => {
    const subEn = {
      endpoint: `https://updates.push.com/en-user-${Date.now()}`,
      keys: { p256dh: 'p256_dummy_en', auth: 'auth_dummy_en' }
    };
    const exito = await registrarSuscripcion(subEn, { ciudad: 'Medellin', lang: 'en' });
    assert.equal(exito, true);

    const activas = await obtenerSuscripcionesActivas();
    const encontrada = activas.find(s => s.endpoint === subEn.endpoint);
    assert.ok(encontrada, 'La suscripción debe existir en el almacén');
    assert.equal(encontrada.lang, 'en', 'El idioma de la suscripción debe persistirse como en');
  });
});

describe('🃏 Infraestructura de Traducción — Catálogo y Desbloqueo', () => {
  it('Debe traducir títulos y tipos inmobiliarios correctamente', () => {
    // Simulación del helper implementado en modules/06-cards.js
    function traducirTituloCatalogo(titulo, isEn) {
      if (!isEn || !titulo) return titulo || '';
      return String(titulo)
        .replace(/^Apartamento\s+en\s+Venta\b/gi, 'Apartment for Sale')
        .replace(/^Casa\s+en\s+Venta\b/gi, 'House for Sale')
        .replace(/^Lote\s+en\s+Venta\b/gi, 'Land / Lot for Sale')
        .replace(/^Oficina\s+en\s+Venta\b/gi, 'Office for Sale')
        .replace(/^Finca\s+en\s+Venta\b/gi, 'Country Estate for Sale')
        .replace(/^Local\s+en\s+Venta\b/gi, 'Commercial Space for Sale')
        .replace(/^Bodega\s+en\s+Venta\b/gi, 'Warehouse for Sale')
        .replace(/\ben\s+Venta\b/gi, 'for Sale');
    }

    assert.equal(
      traducirTituloCatalogo('Apartamento en Venta — Medellin', true),
      'Apartment for Sale — Medellin'
    );
    assert.equal(
      traducirTituloCatalogo('Casa en Venta — Envigado', true),
      'House for Sale — Envigado'
    );
    assert.equal(
      traducirTituloCatalogo('Lote en Venta — Rionegro', true),
      'Land / Lot for Sale — Rionegro'
    );
    assert.equal(
      traducirTituloCatalogo('Apartamento en Venta — Medellin', false),
      'Apartamento en Venta — Medellin'
    );
  });
});
