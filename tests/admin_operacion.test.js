/**
 * 🧪 Panel — etapa 3: precios editables, configuración pública y estado del cazador.
 * Modo memoria (sin credenciales de Firestore): no toca producción.
 */
process.env.NODE_ENV = 'test';
process.env.FIRESTORE_DESACTIVADO = '1';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const db = require('../lib/db');
const precios = require('../lib/precios');
const { obtenerConfigPublica, invalidarConfigPublica } = require('../lib/configuracion-publica');
const { estadoCazador } = require('../lib/admin/operacion');
const createOrderHandler = require('../api/payments/create-order');
const { resetRateLimiter } = require('../lib/rate-limiter');

function crearRes() {
  return {
    statusCode: 200,
    data: null,
    setHeader() {},
    status(c) { this.statusCode = c; return this; },
    json(d) { this.data = d; return this; },
    end() { return this; },
  };
}

async function restaurarPrecios() {
  await db.coleccion('config').doc('precios').set({});
  await invalidarConfigPublica();
}

describe('🛠️ Panel: precios, configuración pública y cazador', () => {
  after(restaurarPrecios);

  it('rechaza precios fuera de rango y datos sin sentido', () => {
    assert.throws(() => precios.validarCambios({ single_lead: { montoCentavos: 50 } }), /Precio no válido/);
    assert.throws(() => precios.validarCambios({ pack_10_leads: { montoCentavos: 3500000, creditos: 0 } }), /Créditos/);
    assert.throws(() => precios.validarCambios({ subscription_city: { montoCentavos: 8900000, dias: 0 } }), /Días/);
    assert.throws(() => precios.validarCambios({}), /No hay cambios/);
  });

  it('un precio guardado en el panel es el que cobra la orden nueva y el que ve la web', async () => {
    await precios.guardarPrecios({ pack_10_leads: { montoCentavos: 4000000, creditos: 12 } }, 'admin@example.com');
    await invalidarConfigPublica();

    resetRateLimiter();
    const res = crearRes();
    await createOrderHandler(
      {
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
        body: { productType: 'pack_10_leads', celular: '319' + Math.floor(1000000 + Math.random() * 9000000) },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.amountInCents, 4000000, 'la orden usa el precio del panel');
    const orden = await db.getPendingOrder(res.data.reference);
    assert.equal(orden.creditos, 12);

    const publica = await obtenerConfigPublica();
    assert.equal(publica.precios.pack_10_leads.montoCentavos, 4000000);
    assert.equal(publica.precios.single_lead.montoCentavos, 500000, 'lo no editado conserva el valor base');
    assert.ok(!('codigo' in publica.precios.pack_10_leads), 'sin campos internos');
  });

  it('sin documento de precios se usan los valores base', async () => {
    await restaurarPrecios();
    const p = await precios.obtenerPrecios();
    assert.equal(p.subscription_national.montoCentavos, 14900000);
    assert.equal(precios.productoPorCodigo(p, 'VIPCIU_cali').tipo, 'suscripcion_ciudad');
    assert.deepEqual(precios.beneficio(p.subscription_city, 'cali').planData, { plan: 'city', city: 'cali', days: 30 });
  });

  it('el estado del cazador muestra la última publicación y el historial', async () => {
    const ahora = Date.now();
    await db.coleccion('admin_estado').doc('cazador').set({ ultima_ms: ahora, procesados: 4 });
    await db.coleccion('admin_cazador_log').add({ ms: ahora, procesados: 4, desactivados: 1, reconciliados: 0 });
    const e = await estadoCazador();
    assert.equal(e.ultima.procesados, 4);
    assert.ok(e.publicaciones.length >= 1);
    assert.equal(e.publicaciones[0].ms, ahora);
    assert.equal(typeof e.activos, 'number');
  });
});
