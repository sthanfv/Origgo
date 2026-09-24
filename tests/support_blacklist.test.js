/**
 * 🛡️ SUITE DE PRUEBAS AUTOMATIZADAS: CENTRO DE AUTO-SOPORTE Y DESINDEXACIÓN (NOTICE & TAKEDOWN)
 * tests/support_blacklist.test.js
 * 
 * Valida:
 * 1. Métodos del ledger: addBlacklistedLead, getBlacklistedLeadIds, isLeadBlacklisted.
 * 2. Endpoint POST /api/support/takedown: validación de inputs, extracción de ID y desindexación.
 * 3. Endpoint GET /api/support/blacklist: listado público con cabeceras de caché CDN.
 * 4. Guarda de seguridad en POST /api/leads/unlock: rechazo con HTTP 410 y cero créditos descontados.
 */

process.env.NODE_ENV = 'test';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../lib/db');
const { signJwt } = require('../lib/crypto');
const { resetRateLimiter } = require('../lib/rate-limiter');
const { takedown: takedownHandler, blacklist: blacklistHandler } = require('../api/support');
const unlockHandler = require('../api/leads/unlock');

function mockRes() {
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

describe('🎧 Centro de Auto-Soporte y Desindexación Automatizada (Notice & Takedown)', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('1. Ledger debe registrar y detectar un lead en lista negra', async () => {
    const testId = `takedown-unit-${Date.now()}`;
    const resAdd = await db.addBlacklistedLead(testId, {
      phone: '3001234567',
      reason: 'inmueble_arrendado'
    });

    assert.equal(resAdd.success, true);
    assert.equal(resAdd.leadId, testId);

    const isBlocked = await db.isLeadBlacklisted(testId);
    assert.equal(isBlocked, true, 'El lead debe reportarse como desindexado');

    const allIds = await db.getBlacklistedLeadIds();
    assert.ok(allIds.includes(testId), 'El ID debe figurar en la lista global');
  });

  it('2. POST /api/support/takedown debe procesar desindexaciones legítimas', async () => {
    const leadId = `fincaraiz-unit-${Date.now()}`;
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '186.84.10.21' },
      body: { leadId, phone: '3159998877', reason: 'ya_vendido' }
    };
    const res = mockRes();

    await takedownHandler(req, res);

    assert.equal(res.getStatusCode(), 200);
    assert.equal(res.getData()?.ok, true);
    assert.equal(res.getData()?.leadId, leadId);

    const isBlocked = await db.isLeadBlacklisted(leadId);
    assert.equal(isBlocked, true);
  });

  it('3. POST /api/support/takedown debe rechazar solicitudes sin identificador', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '186.84.10.15' },
      body: { phone: '3159998877', reason: 'ya_vendido' }
    };
    const res = mockRes();

    await takedownHandler(req, res);

    assert.equal(res.getStatusCode(), 400);
    assert.equal(res.getData()?.ok, false);
    assert.equal(res.getData()?.error, 'LEAD_ID_REQUERIDO');
  });

  it('4. GET /api/support/blacklist debe devolver la lista de IDs con cabeceras de caché', async () => {
    const req = {
      method: 'GET',
      headers: { 'x-forwarded-for': '186.84.10.15' }
    };
    const res = mockRes();

    await blacklistHandler(req, res);

    assert.equal(res.getStatusCode(), 200);
    assert.equal(res.getData()?.ok, true);
    assert.ok(Array.isArray(res.getData()?.ids));
    assert.ok(res.getHeaders()['cache-control']?.includes('max-age'));
  });

  it('5. POST /api/leads/unlock debe rechazar con HTTP 410 si el inmueble fue desindexado', async () => {
    const deadLeadId = `lead-bloqueado-410-${Date.now()}`;
    await db.addBlacklistedLead(deadLeadId, { phone: '3110001122', reason: 'vendido' });

    const jwtSecret = process.env.JWT_SECRET || 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232';
    const token = signJwt({ phone: '3119998877', credits: 5 }, jwtSecret);

    const req = {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: { leadId: deadLeadId }
    };
    const res = mockRes();

    await unlockHandler(req, res);

    assert.equal(res.getStatusCode(), 410, 'Debe devolver HTTP 410 Gone');
    assert.equal(res.getData()?.ok, false);
    assert.equal(res.getData()?.error, 'INMUEBLE_DESINDEXADO');
  });

  it('6. POST /api/support/takedown debe rechazar texto libre sin identificador con LEAD_ID_INVALIDO', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '186.84.10.26' },
      body: { leadId: 'Hola por favor bajen mi casa de la calle 45 no quiero que la publiquen mas', phone: '3159998877' }
    };
    const res = mockRes();

    await takedownHandler(req, res);

    assert.equal(res.getStatusCode(), 400);
    assert.equal(res.getData()?.ok, false);
    assert.equal(res.getData()?.error, 'LEAD_ID_INVALIDO');
  });

  it('7. POST /api/support/takedown debe extraer leadId desde URL con hash y parámetro', async () => {
    const targetLeadId = `lead-inm-hash-${Date.now()}`;
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '186.84.10.27' },
      body: { leadId: `https://origgo.online/#lead-modal?id=${targetLeadId}`, phone: '3001234567' }
    };
    const res = mockRes();

    await takedownHandler(req, res);

    assert.equal(res.getStatusCode(), 200);
    assert.equal(res.getData()?.ok, true);
    assert.equal(res.getData()?.leadId, targetLeadId);

    const isBlocked = await db.isLeadBlacklisted(targetLeadId);
    assert.equal(isBlocked, true);
  });

  it('8. POST /api/support/takedown debe extraer ID numérico desde URL de portal inmobiliario', async () => {
    const portalNum = '194209999';
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '186.84.10.28' },
      body: { leadId: `https://www.fincaraiz.com.co/inmueble/${portalNum}`, phone: '3001234567' }
    };
    const res = mockRes();

    await takedownHandler(req, res);

    assert.equal(res.getStatusCode(), 200);
    assert.equal(res.getData()?.ok, true);
    assert.equal(res.getData()?.leadId, portalNum);

    const isBlocked = await db.isLeadBlacklisted(portalNum);
    assert.equal(isBlocked, true);
  });

  it('9. POST /api/support/takedown debe truncar defensivamente razones de más de 500 palabras sin error', async () => {
    const targetLeadId = `lead-truncado-${Date.now()}`;
    const textoLargo = 'Texto de prueba '.repeat(100); // > 1500 caracteres
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '186.84.10.29' },
      body: { leadId: targetLeadId, phone: '3001234567', reason: textoLargo }
    };
    const res = mockRes();

    await takedownHandler(req, res);

    assert.equal(res.getStatusCode(), 200);
    assert.equal(res.getData()?.ok, true);
    assert.equal(res.getData()?.leadId, targetLeadId);

    const isBlocked = await db.isLeadBlacklisted(targetLeadId);
    assert.equal(isBlocked, true);
  });
});
