/**
 * 🧪 TEST UNITARIO: PAGINACIÓN Y CARGA PROGRESIVA POR LOTES (BATCHING)
 * tests/leads_pagination.test.js
 * 
 * Valida el endpoint serverless /api/leads/list, particionamiento en lotes (15 items),
 * filtros serverless por ciudad y operación, y manejo de límites en dispositivos móviles.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const listHandler = require('../api/leads/list');

function createMockReqRes({ method = 'GET', query = {}, url = '/api/leads/list', ip = '127.0.0.1' } = {}) {
  const req = {
    method,
    url,
    query,
    headers: {
      'x-forwarded-for': ip,
      'host': 'origgo.online'
    }
  };

  let statusCode = 200;
  let responseData = null;
  const headersSet = {};

  const res = {
    setHeader: (k, v) => { headersSet[k] = v; },
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    end: () => res
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData, getHeaders: () => headersSet };
}

describe('📦 Paginación y Carga Progresiva por Lotes (/api/leads/list)', () => {
  it('Debe rechazar métodos HTTP distintos a GET con código 405', async () => {
    const { req, res, getStatus } = createMockReqRes({ method: 'POST' });
    await listHandler(req, res);
    assert.strictEqual(getStatus(), 405);
  });

  it('Debe entregar el primer lote de 15 inmuebles por defecto (page=1, limit=15)', async () => {
    const { req, res, getStatus, getData, getHeaders } = createMockReqRes({
      query: { page: 1, limit: 15 }
    });

    await listHandler(req, res);
    assert.strictEqual(getStatus(), 200);

    const data = getData();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.page, 1);
    assert.strictEqual(data.limit, 15);
    assert.strictEqual(data.total, 60);
    assert.strictEqual(data.totalPages, 4);
    assert.strictEqual(data.hayMas, true);
    assert.strictEqual(data.leads.length, 15);
    assert.ok(data.config && data.config.titulo_modulo);

    // Cabeceras de caché CDN presentes
    const headers = getHeaders();
    assert.match(headers['Cache-Control'], /public/);
    assert.match(headers['Cache-Control'], /s-maxage/);
  });

  it('Debe entregar el segundo lote (page=2) con elementos no repetidos respecto a la página 1', async () => {
    const resP1 = createMockReqRes({ query: { page: 1, limit: 15 } });
    await listHandler(resP1.req, resP1.res);
    const leadsP1 = resP1.getData().leads;

    const resP2 = createMockReqRes({ query: { page: 2, limit: 15 } });
    await listHandler(resP2.req, resP2.res);
    const leadsP2 = resP2.getData().leads;

    assert.strictEqual(leadsP2.length, 15);
    // Verificar que los IDs del lote 2 no se intersectan con el lote 1
    const idsP1 = new Set(leadsP1.map(l => l.id));
    for (const lead of leadsP2) {
      assert.strictEqual(idsP1.has(lead.id), false, `Lead ${lead.id} duplicado entre lotes`);
    }
  });

  it('Debe filtrar correctamente por ciudad (ej. Medellín)', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      query: { city: 'Medellin', limit: 30 }
    });

    await listHandler(req, res);
    assert.strictEqual(getStatus(), 200);

    const data = getData();
    assert.strictEqual(data.ok, true);
    assert.ok(data.leads.length > 0);
    for (const lead of data.leads) {
      const u = (lead.ciudad || lead.ubicacion || '').toLowerCase();
      assert.ok(u.includes('medell') || u.includes('antioquia') || u.includes('envigado') || u.includes('sabaneta') || u.includes('bello'), `Lead ${lead.id} en ${u} no corresponde a Medellín`);
    }
  });

  it('Debe manejar páginas más allá del total devolviendo arreglo vacío y hayMas=false', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      query: { page: 99, limit: 15 }
    });

    await listHandler(req, res);
    assert.strictEqual(getStatus(), 200);

    const data = getData();
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.leads.length, 0);
    assert.strictEqual(data.hayMas, false);
  });

  it('Debe entregar metadatos agregados de ciudades y responder en menos de 150ms', async () => {
    const inicio = performance.now();
    const { req, res, getStatus, getData } = createMockReqRes({
      query: { page: 1, limit: 15 }
    });

    await listHandler(req, res);
    const duracionMs = performance.now() - inicio;

    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.ok(data.ciudades && typeof data.ciudades === 'object');
    assert.ok(Object.keys(data.ciudades).length > 0);
    assert.ok(duracionMs < 150, `Tiempo de respuesta ${duracionMs.toFixed(2)}ms excede el límite de 150ms`);
  });

  it('Debe soportar ordenamiento pre-indexado por precio_menor y m2_menor', async () => {
    const { req, res, getData } = createMockReqRes({
      query: { page: 1, limit: 15, sort: 'precio_menor' }
    });
    await listHandler(req, res);
    const leads = getData().leads;
    assert.strictEqual(leads.length, 15);
    for (let i = 0; i < leads.length - 1; i++) {
      const p1 = parseInt(String(leads[i].precio).replace(/\D/g, ''), 10) || 0;
      const p2 = parseInt(String(leads[i + 1].precio).replace(/\D/g, ''), 10) || 0;
      assert.ok(p1 <= p2, `Orden de precio inconsistente: ${p1} > ${p2}`);
    }
  });
});

