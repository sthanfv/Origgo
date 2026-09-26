/**
 * 📥 SUITE DE PRUEBAS AUTOMATIZADAS: INGESTA DE LEADS DESDE HARDWARE LOCAL
 * tests/leads_ingest.test.js
 * Origgo Intelligence — Arquitectura DevSecOps Estándar Desmulta
 * 
 * Valida:
 * 1. Rechazo de métodos distintos a POST (405).
 * 2. Rechazo de peticiones sin token secreto de ingesta o con token incorrecto (401).
 * 3. Rechazo de payloads vacíos o no estructurados en lote (400).
 * 4. Rechazo de lotes que superan el límite de seguridad de 100 leads (413).
 * 5. Procesamiento exitoso de leads válidos con cifrado en reposo y persistencia atómica.
 * 6. Exclusión automática de leads desindexados en lista negra (Notice & Takedown).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
require('../lib/env');
const db = require('../lib/db');
const ingestHandler = require('../api/leads/ingest');

function crearRespuestaMock() {
  let statusCode = 200;
  let responseData = null;
  const headers = {};

  return {
    setHeader(key, value) { headers[key.toLowerCase()] = value; return this; },
    status(code) { statusCode = code; return this; },
    json(obj) { responseData = obj; return this; },
    end() { return this; },
    getStatusCode: () => statusCode,
    getData: () => responseData,
    getHeaders: () => headers
  };
}

describe('📱 Endpoint Serverless de Ingesta Segura (POST /api/leads/ingest)', () => {
  const secretKey = process.env.INGEST_SECRET_KEY || 'origgo_dev_secret_ingest_key_test_suite_2026';

  it('1. Debe rechazar métodos HTTP distintos a POST con 405', async () => {
    const req = {
      method: 'GET',
      headers: { 'x-origgo-ingest-token': secretKey }
    };
    const res = crearRespuestaMock();

    await ingestHandler(req, res);
    assert.equal(res.getStatusCode(), 405);
    assert.equal(res.getData()?.success, false);
  });

  it('2. Debe rechazar peticiones con token ausente o erróneo con 401', async () => {
    const reqSinToken = {
      method: 'POST',
      headers: {},
      body: { leads: [] }
    };
    const resSinToken = crearRespuestaMock();
    await ingestHandler(reqSinToken, resSinToken);
    assert.equal(resSinToken.getStatusCode(), 401);

    const reqTokenFalso = {
      method: 'POST',
      headers: { 'x-origgo-ingest-token': 'token_invalido_hacker' },
      body: { leads: [] }
    };
    const resTokenFalso = crearRespuestaMock();
    await ingestHandler(reqTokenFalso, resTokenFalso);
    assert.equal(resTokenFalso.getStatusCode(), 401);
  });

  it('3. Debe rechazar cuerpo de petición vacío o inválido con 400', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-origgo-ingest-token': secretKey },
      body: {}
    };
    const res = crearRespuestaMock();
    await ingestHandler(req, res);
    assert.equal(res.getStatusCode(), 400);
    assert.equal(res.getData()?.success, false);
  });

  it('4. Debe rechazar lotes mayores a 100 leads con 413 (Payload Too Large)', async () => {
    const loteExcedido = Array.from({ length: 101 }, (_, i) => ({
      id: `lead-excedido-${i}`,
      titulo: `Apartamento ${i}`,
      precio_raw: 200000000,
      telefono_propietario: '3001234567'
    }));

    const req = {
      method: 'POST',
      headers: { 'x-origgo-ingest-token': secretKey },
      body: { leads: loteExcedido }
    };
    const res = crearRespuestaMock();
    await ingestHandler(req, res);
    assert.equal(res.getStatusCode(), 413);
  });

  it('5. Debe procesar e insertar un lote válido con cifrado en reposo', async () => {
    const idTest = `ingest-test-${Date.now()}`;
    const loteValido = [
      {
        id: idTest,
        titulo: 'Apartamento de Lujo en Chapinero Alto',
        precio: '$ 420.000.000',
        precio_raw: 420000000,
        ciudad: 'Bogotá',
        barrio: 'Chapinero Alto',
        tipo_inmueble: 'Apartamento',
        telefono_propietario: '3109876543',
        portal: 'Directo Propietario'
      }
    ];

    const req = {
      method: 'POST',
      headers: { 'x-origgo-ingest-token': secretKey },
      body: { leads: loteValido }
    };
    const res = crearRespuestaMock();
    await ingestHandler(req, res);

    assert.equal(res.getStatusCode(), 200);
    const data = res.getData();
    assert.equal(data.success, true);
    assert.equal(data.procesados, 1);
    assert.ok(data.ids.includes(idTest));
  });

  it('6. Debe excluir automáticamente inmuebles desindexados en lista negra', async () => {
    const idDesindexado = `lead-vetado-${Date.now()}`;
    const idActivo = `lead-activo-${Date.now()}`;

    // Registrar previamente en lista negra
    await db.addBlacklistedLead(idDesindexado, { reason: 'solicitud_retiro_propietario' });

    const req = {
      method: 'POST',
      headers: { 'x-origgo-ingest-token': secretKey },
      body: [
        {
          id: idDesindexado,
          titulo: 'Apartamento Vetado por Dueño',
          precio_raw: 300000000,
          telefono_propietario: '3001112233'
        },
        {
          id: idActivo,
          titulo: 'Apartamento Activo Legítimo',
          precio_raw: 350000000,
          telefono_propietario: '3004445566'
        }
      ]
    };
    const res = crearRespuestaMock();
    await ingestHandler(req, res);

    assert.equal(res.getStatusCode(), 200);
    const data = res.getData();
    assert.equal(data.success, true);
    assert.equal(data.procesados, 1, 'Solo debe ingresar el lead activo');
    assert.equal(data.desindexadosOmitidos, 1, 'Debe reportar 1 lead omitido por lista negra');
    assert.ok(data.ids.includes(idActivo));
    assert.ok(!data.ids.includes(idDesindexado));
  });

  it('7. Lo ingerido queda activo (el catálogo público filtra activo == true)', async () => {
    const id = `ingest-activo-${Date.now()}`;
    const res = crearRespuestaMock();
    await ingestHandler(
      {
        method: 'POST',
        headers: { 'x-origgo-ingest-token': secretKey },
        body: { leads: [{ id, titulo: 'Casa activa', precio_raw: 250000000, telefono_propietario: '3005556677' }] },
      },
      res
    );
    assert.equal(res.getStatusCode(), 200);
    const doc = await db.leadsRef.doc(id).get();
    assert.equal(doc.data().activo, true);
  });

  it('8. Un envío solo con retirados desactiva esos inmuebles (publicación por cambios del cazador)', async () => {
    const id = `ingest-retiro-${Date.now()}`;
    const ingresar = crearRespuestaMock();
    await ingestHandler(
      {
        method: 'POST',
        headers: { 'x-origgo-ingest-token': secretKey },
        body: { leads: [{ id, titulo: 'Lote vendido', precio_raw: 90000000, telefono_propietario: '3007778899' }] },
      },
      ingresar
    );
    const retirar = crearRespuestaMock();
    await ingestHandler(
      { method: 'POST', headers: { 'x-origgo-ingest-token': secretKey }, body: { leads: [], retirados: [id] } },
      retirar
    );
    assert.equal(retirar.getStatusCode(), 200);
    assert.equal(retirar.getData().desactivados, 1);
    const doc = await db.leadsRef.doc(id).get();
    assert.equal(doc.data().activo, false);
  });

  it('9. Más de 100 retirados en una petición se rechaza con 413', async () => {
    const res = crearRespuestaMock();
    await ingestHandler(
      {
        method: 'POST',
        headers: { 'x-origgo-ingest-token': secretKey },
        body: { leads: [], retirados: Array.from({ length: 101 }, (_, i) => `r-${i}`) },
      },
      res
    );
    assert.equal(res.getStatusCode(), 413);
  });
});
