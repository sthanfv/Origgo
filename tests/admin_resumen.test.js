/**
 * 🧪 Pantalla de Resumen del panel (lib/admin/resumen.js): conteos reales y alertas.
 * Corre en modo memoria (sin credenciales de Firestore): no toca producción.
 */
process.env.NODE_ENV = 'test';
process.env.FIRESTORE_DESACTIVADO = '1';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../lib/db');
const retiros = require('../lib/retiros');
const { calcularResumen } = require('../lib/admin/resumen');

test('resumen: cuenta el catálogo y alerta retiros por vencer, cazador quieto e índice pendiente', async () => {
  const antes = await calcularResumen();
  const sufijo = `${Date.now()}`;
  await db.leadsRef.doc(`res-a-${sufijo}`).set({ activo: true, destacado: true });
  await db.leadsRef.doc(`res-b-${sufijo}`).set({ activo: false });

  const ahora = Date.now();
  await retiros.guardarSolicitud({
    radicado: `HD-TEST-${sufijo}`,
    estado: 'recibida',
    creada_ms: ahora,
    vence_ms: ahora + 2 * 24 * 3600 * 1000, // vence en 2 días
    solicitante: { nombre: 'Ana', correo: 'ana@example.com', relacion: 'propietario' },
  });
  await db.coleccion('admin_estado').doc('cazador').set({ ultima_ms: ahora - 7 * 3600 * 1000, procesados: 3 });

  const r = await calcularResumen(ahora);
  assert.equal(r.catalogo.total, antes.catalogo.total + 2);
  assert.equal(r.catalogo.visibles, antes.catalogo.visibles + 1);
  assert.equal(r.catalogo.destacados, antes.catalogo.destacados + 1);
  assert.ok(r.retiros.porVencer >= 1);
  const textos = r.alertas.map((a) => a.texto).join(' | ');
  assert.match(textos, /vence/);
  assert.match(textos, /no publica cambios hace 7 h/);

  await db.coleccion('admin_estado').doc('cazador').set({ ultima_ms: ahora, procesados: 1 });
  await db.coleccion('admin_estado').doc('indice').set({ completo_ms: ahora });
  const r2 = await calcularResumen(ahora);
  assert.ok(!r2.alertas.some((a) => /cazador|índice/.test(a.texto)), 'sin alertas de cazador ni índice');
});
