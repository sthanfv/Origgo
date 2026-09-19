/**
 * 🧪 TEST UNITARIO: EMBUDO DE CONVERSIÓN Y TELEMETRÍA COMERCIAL (FUNNEL CRO)
 * tests/funnel_metrics.test.js
 * 
 * Valida la agregación atómica de eventos en el embudo, cálculo de KPIs y fugas,
 * validación estricta con Zod en api/telemetry/funnel y formato de reporte Telegram.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.DISABLE_FIRESTORE_FOR_TESTS = 'true';
require('../lib/env');

const funnelHandler = require('../api/telemetry/funnel');
const {
  ETAPAS_EMBUDO,
  registrarEventoEmbudo,
  obtenerMetricasEmbudo,
  generarReporteTelegramMarkdown,
  memoriaEmbudo
} = require('../lib/funnel');

// Helper mock para simular req y res en endpoints serverless
function createMockReqRes({ method = 'POST', body = {}, query = {}, headers = {}, ip = '127.0.0.1' } = {}) {
  const req = {
    method,
    url: '/api/telemetry/funnel',
    headers: {
      'x-forwarded-for': ip,
      'user-agent': 'TestRunner-Funnel/1.0',
      ...headers
    },
    query,
    body
  };

  let statusCode = 200;
  let responseData = null;
  let sentText = null;
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
    send: (txt) => {
      sentText = txt;
      return res;
    },
    end: () => res
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
    getText: () => sentText,
    getHeaders: () => headersSet
  };
}

describe('📊 Embudo de Conversión CRO: Lógica y Agregación Atómica (lib/funnel.js)', () => {
  beforeEach(() => {
    memoriaEmbudo.clear();
  });

  it('Debe registrar cada etapa del embudo correctamente en memoria volátil', async () => {
    // 1. Visita
    const rVisita = await registrarEventoEmbudo({ etapa: ETAPAS_EMBUDO.VISITA });
    assert.strictEqual(rVisita.ok, true);

    // 2. Interés con oportunidad y ciudad
    const rInteres = await registrarEventoEmbudo({
      etapa: ETAPAS_EMBUDO.INTERES,
      leadId: 'inmueble-chapinero-01',
      ciudad: 'Bogotá'
    });
    assert.strictEqual(rInteres.ok, true);

    // 3. Intento Freemium
    const rIntento = await registrarEventoEmbudo({
      etapa: ETAPAS_EMBUDO.INTENTO,
      tipo: 'freemium'
    });
    assert.strictEqual(rIntento.ok, true);

    // 4. Conversión Exitosa con pago
    const rConversion = await registrarEventoEmbudo({
      etapa: ETAPAS_EMBUDO.CONVERSION,
      tipo: 'pago',
      montoCop: 29000
    });
    assert.strictEqual(rConversion.ok, true);

    // Consultar métricas
    const metricas = await obtenerMetricasEmbudo({ dias: 1 });
    assert.strictEqual(metricas.visitas, 1);
    assert.strictEqual(metricas.interes, 1);
    assert.strictEqual(metricas.intentosTotal, 1);
    assert.strictEqual(metricas.intentosFreemium, 1);
    assert.strictEqual(metricas.conversionesTotal, 1);
    assert.strictEqual(metricas.conversionesPago, 1);
    assert.strictEqual(metricas.ingresosCop, 29000);
  });

  it('Debe calcular ratios de conversión y tasas de fuga con exactitud', async () => {
    // Simular 100 visitas, 40 intereses, 10 intentos y 5 conversiones
    for (let i = 0; i < 100; i++) await registrarEventoEmbudo({ etapa: ETAPAS_EMBUDO.VISITA });
    for (let i = 0; i < 40; i++) await registrarEventoEmbudo({ etapa: ETAPAS_EMBUDO.INTERES, leadId: 'lead-test', ciudad: 'Medellín' });
    for (let i = 0; i < 10; i++) await registrarEventoEmbudo({ etapa: ETAPAS_EMBUDO.INTENTO, tipo: 'freemium' });
    for (let i = 0; i < 5; i++) await registrarEventoEmbudo({ etapa: ETAPAS_EMBUDO.CONVERSION, tipo: 'freemium' });

    const metricas = await obtenerMetricasEmbudo({ dias: 1 });
    const r = metricas.ratios;

    assert.strictEqual(r.tasaInteresPct, 40); // 40 / 100
    assert.strictEqual(r.tasaIntentoPct, 25); // 10 / 40
    assert.strictEqual(r.tasaCierrePct, 50); // 5 / 10
    assert.strictEqual(r.tasaConversionGlobalPct, 5); // 5 / 100

    assert.strictEqual(r.fugaVisitaAInteresPct, 60); // 100 - 40
    assert.strictEqual(r.fugaInteresAIntentoPct, 75); // 100 - 25
    assert.strictEqual(r.fugaIntentoAConversionPct, 50); // 100 - 50
  });

  it('Debe generar el reporte ejecutivo en Markdown con formato limpio para Telegram', async () => {
    await registrarEventoEmbudo({ etapa: ETAPAS_EMBUDO.VISITA });
    await registrarEventoEmbudo({ etapa: ETAPAS_EMBUDO.INTERES, leadId: 'lead-cedritos-99', ciudad: 'Cali' });
    await registrarEventoEmbudo({ etapa: ETAPAS_EMBUDO.INTENTO, tipo: 'pago' });
    await registrarEventoEmbudo({ etapa: ETAPAS_EMBUDO.CONVERSION, tipo: 'pago', montoCop: 35000 });

    const metricas = await obtenerMetricasEmbudo({ dias: 1 });
    const reporte = generarReporteTelegramMarkdown(metricas);

    assert.ok(reporte.includes('ORIGGO — REPORTE EJECUTIVO DE CONVERSIÓN'));
    assert.ok(reporte.includes('Tráfico en Vitrina'));
    assert.ok(reporte.includes('Interés Activo'));
    assert.ok(reporte.includes('CONVERSIÓN FINAL GANADA'));
    assert.ok(reporte.includes('Diagnóstico de Embudo'));
  });

  it('Debe rechazar etapas inválidas en registrarEventoEmbudo', async () => {
    const res = await registrarEventoEmbudo({ etapa: 'etapa_inexistente_hack' });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.error, 'ETAPA_INVALIDA');
  });
});

describe('🛡️ Endpoint Serverless de Telemetría: api/telemetry/funnel.js', () => {
  beforeEach(() => {
    memoriaEmbudo.clear();
  });

  it('Debe responder 200 en preflight OPTIONS', async () => {
    const { req, res, getStatus } = createMockReqRes({ method: 'OPTIONS' });
    await funnelHandler(req, res);
    assert.strictEqual(getStatus(), 200);
  });

  it('Debe rechazar métodos no soportados como DELETE con HTTP 405', async () => {
    const { req, res, getStatus } = createMockReqRes({ method: 'DELETE' });
    await funnelHandler(req, res);
    assert.strictEqual(getStatus(), 405);
  });

  it('Debe rechazar un POST con JSON inválido o malformado', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      method: 'POST',
      body: '{ json_invalido_sin_cerrar: '
    });
    await funnelHandler(req, res);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData()?.error, 'JSON_MALFORMADO');
  });

  it('Debe rechazar un POST con etapa no autorizada por Zod con HTTP 400', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      method: 'POST',
      body: { etapa: 'clic_falso' }
    });
    await funnelHandler(req, res);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData()?.error, 'VALIDACION_FALLIDA');
  });

  it('Debe procesar un POST con evento válido y retornar HTTP 200 { ok: true }', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      method: 'POST',
      body: {
        etapa: 'interes_inmueble',
        leadId: 'inmueble-test-123',
        ciudad: 'Bogotá'
      }
    });
    await funnelHandler(req, res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getData()?.ok, true);
  });

  it('Debe procesar un GET de métricas y devolver consolidado de KPIs', async () => {
    const { req, res, getStatus, getData } = createMockReqRes({
      method: 'GET',
      query: { dias: '7' }
    });
    await funnelHandler(req, res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getData()?.ok, true);
    assert.strictEqual(getData()?.dias, 7);
    assert.ok(typeof getData()?.metricas === 'object');
  });

  it('Debe devolver el reporte en formato texto plano si se solicita format=markdown', async () => {
    const { req, res, getStatus, getText } = createMockReqRes({
      method: 'GET',
      query: { format: 'markdown', dias: '3' }
    });
    await funnelHandler(req, res);
    assert.strictEqual(getStatus(), 200);
    assert.ok(getText()?.includes('ORIGGO — REPORTE EJECUTIVO'));
  });
});
