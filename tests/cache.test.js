/**
 * Pruebas de lib/cache.js: la caché que protege la cuota gratuita de Firestore.
 * Se desactiva Upstash (sin variables) para probar solo la lógica en memoria.
 */
const test = require('node:test');
const assert = require('node:assert');

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { obtenerConCache, invalidarCache, esErrorDeCuota, limpiarCacheMemoria } = require('../lib/cache');

test.beforeEach(() => limpiarCacheMemoria());

test('la segunda lectura sale de memoria: Firestore se consulta una sola vez', async () => {
  let lecturas = 0;
  const cargar = async () => {
    lecturas++;
    return [{ id: 'a' }, { id: 'b' }];
  };
  const r1 = await obtenerConCache('prueba', 900, cargar);
  const r2 = await obtenerConCache('prueba', 900, cargar);
  assert.strictEqual(lecturas, 1);
  assert.deepStrictEqual([r1.origen, r2.origen], ['fuente', 'memoria']);
  assert.strictEqual(r2.valor.length, 2);
});

test('muchas visitas simultáneas con la caché vacía provocan UNA sola lectura', async () => {
  let lecturas = 0;
  const cargar = () =>
    new Promise((ok) => {
      lecturas++;
      setTimeout(() => ok(['x']), 20);
    });
  const resultados = await Promise.all(Array.from({ length: 20 }, () => obtenerConCache('paralelo', 900, cargar)));
  assert.strictEqual(lecturas, 1);
  assert.ok(resultados.every((r) => r.valor[0] === 'x'));
});

test('si Firestore falla (cuota agotada) se sirve la última copia buena marcada como obsoleta', async () => {
  await obtenerConCache('respaldo', 900, async () => ['copia-buena'], { memoriaSeg: 0 });
  const err = Object.assign(new Error('8 RESOURCE_EXHAUSTED: Quota exceeded.'), { code: 8 });
  const r = await obtenerConCache('respaldo', 900, async () => {
    throw err;
  });
  assert.deepStrictEqual(r, { valor: ['copia-buena'], origen: 'respaldo', obsoleto: true });
});

test('sin copia previa, el error de la fuente se propaga (y la lista vacía NO se cachea)', async () => {
  await assert.rejects(
    obtenerConCache('sin-copia', 900, async () => {
      throw new Error('FIRESTORE_NO_DISPONIBLE');
    }),
    /FIRESTORE_NO_DISPONIBLE/,
  );
  // Tras el fallo la fuente queda en pausa; invalidar (p. ej. un cambio del panel) permite reintentar ya.
  await invalidarCache('sin-copia');
  let lecturas = 0;
  const r = await obtenerConCache('sin-copia', 900, async () => {
    lecturas++;
    return ['ok'];
  });
  assert.strictEqual(lecturas, 1);
  assert.deepStrictEqual(r.valor, ['ok']);
});

test('invalidar la caché obliga a leer datos frescos (cambios del panel o retiros)', async () => {
  let version = 1;
  const cargar = async () => [`v${version}`];
  assert.deepStrictEqual((await obtenerConCache('inv', 900, cargar)).valor, ['v1']);
  version = 2;
  assert.deepStrictEqual((await obtenerConCache('inv', 900, cargar)).valor, ['v1']);
  await invalidarCache('inv');
  assert.deepStrictEqual((await obtenerConCache('inv', 900, cargar)).valor, ['v2']);
});

test('detecta los errores de cuota de Firestore', () => {
  assert.ok(esErrorDeCuota({ code: 8, message: 'x' }));
  assert.ok(esErrorDeCuota(new Error('8 RESOURCE_EXHAUSTED: Quota exceeded.')));
  assert.ok(!esErrorDeCuota(new Error('PERMISSION_DENIED')));
  assert.ok(!esErrorDeCuota(null));
});

test('el catálogo y la lista negra rechazan el modo en memoria de lib/db.js', async () => {
  const db = require('../lib/db');
  const descriptor = Object.getOwnPropertyDescriptor(db, 'leadsRef');
  Object.defineProperty(db, 'leadsRef', { get: () => ({ where() {} }), configurable: true });
  try {
    const { cargarCatalogoFirestore } = require('../lib/catalogo');
    await assert.rejects(cargarCatalogoFirestore(), /FIRESTORE_NO_DISPONIBLE/);
  } finally {
    Object.defineProperty(db, 'leadsRef', descriptor);
  }
});

test('tras un fallo de cuota no se reintenta la fuente durante la pausa (sin demoras inútiles)', async () => {
  let intentos = 0;
  const fallar = async () => {
    intentos++;
    throw Object.assign(new Error('8 RESOURCE_EXHAUSTED: Quota exceeded.'), { code: 8 });
  };
  await assert.rejects(obtenerConCache('pausa', 900, fallar));
  await assert.rejects(obtenerConCache('pausa', 900, fallar), /FUENTE_EN_PAUSA/);
  await assert.rejects(obtenerConCache('pausa', 900, fallar), /FUENTE_EN_PAUSA/);
  assert.strictEqual(intentos, 1, 'solo el primer intento llega a Firestore');
});
