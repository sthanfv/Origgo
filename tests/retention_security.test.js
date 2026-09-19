/**
 * 🧪 SUITE DE PRUEBAS DE SEGURIDAD Y RETENCIÓN DE CLIENTES (NODE NATIVE TEST)
 * Archivo: tests/retention_security.test.js
 * Estándar Ecosistema Desmulta (< 500 líneas).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../lib/db');
const { evaluarSegmentoUsuario, procesarLoteRetencion, CAMPAÑAS } = require('../lib/retention');
const authHandler = require('../api/auth');
const jwt = require('jsonwebtoken');

function mockReq(method, query = {}, body = {}) {
  return { method, query, body, headers: {} };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { res.statusCode = code; return res; },
    setHeader(k, v) { res.headers[k] = v; return res; },
    json(data) { res.body = data; return res; }
  };
  return res;
}

test('🛡️ MOTOR DE RETENCIÓN, SEGMENTACIÓN Y MAGIC TOKENS ANTI-ABUSO', async (t) => {

  await t.test('1. Debe evaluar correctamente el Segmento B (Plan Pro por vencer en 48h)', () => {
    const ahora = new Date('2026-09-19T12:00:00.000Z');
    const user = {
      phone: '3151002030',
      plan: 'pro_bogota',
      planCity: 'Bogotá',
      planExpiresAt: '2026-09-21T12:00:00.000Z'
    };
    const res = evaluarSegmentoUsuario(user, ahora);
    assert.ok(res);
    assert.equal(res.campaign, CAMPAÑAS.EXPIRING_SOON);
    assert.equal(res.horasRestantes, 48);
    assert.equal(res.creditsToGrant, 0);
  });

  await t.test('2. Debe evaluar correctamente el Segmento C (Plan Pro vencido hace 24h -> Rescate)', () => {
    const ahora = new Date('2026-09-19T12:00:00.000Z');
    const user = {
      phone: '3151002031',
      plan: 'pro_medellin',
      planCity: 'Medellín',
      planExpiresAt: '2026-09-18T12:00:00.000Z'
    };
    const res = evaluarSegmentoUsuario(user, ahora);
    assert.ok(res);
    assert.equal(res.campaign, CAMPAÑAS.EXPIRED_RESCUE);
    assert.equal(res.creditsToGrant, 2);
  });

  await t.test('3. Debe bloquear asignación de créditos en rescate si ya recibió bono en <45 días', () => {
    const ahora = new Date('2026-09-19T12:00:00.000Z');
    const user = {
      phone: '3151002032',
      plan: 'pro_bogota',
      planExpiresAt: '2026-09-18T12:00:00.000Z',
      lastRescueCreditAt: '2026-09-05T12:00:00.000Z' // hace 14 días
    };
    const res = evaluarSegmentoUsuario(user, ahora);
    assert.ok(res);
    assert.equal(res.creditsToGrant, 0, 'No debe otorgar créditos si ya abusó del beneficio');
  });

  await t.test('4. Debe descartar usuarios contactados en los últimos 15 días (Anti-Spam)', () => {
    const ahora = new Date('2026-09-19T12:00:00.000Z');
    const user = {
      phone: '3151002033',
      plan: 'pro_bogota',
      planExpiresAt: '2026-09-21T12:00:00.000Z',
      lastRetentionImpactAt: '2026-09-16T12:00:00.000Z' // hace 3 días
    };
    const res = evaluarSegmentoUsuario(user, ahora);
    assert.equal(res, null, 'Usuario debe ser ignorado por filtro anti-spam');
  });

  await t.test('5. Debe procesar lote, generar token y estampar lastRetentionImpactAt', async () => {
    const phone = '3151002034';
    await db.addCredits(phone, 1);
    await db.updateUser(phone, {
      plan: 'pro_bogota',
      planCity: 'Bogotá',
      planExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      lastRetentionImpactAt: null
    });

    const userSnap = await db.getUserByPhone(phone);
    const resultado = await procesarLoteRetencion([userSnap]);

    assert.equal(resultado.impactados, 1);
    assert.ok(resultado.acciones[0].token);

    const userDespues = await db.getUserByPhone(phone);
    assert.ok(userDespues.lastRetentionImpactAt);
  });

  await t.test('6. POST /api/auth (consume_retention) debe canjear token y emitir JWT', async () => {
    const phone = '3151002035';
    await db.updateUser(phone, { credits: 1, lastRescueCreditAt: null });

    const tokenData = await db.createRetentionToken(phone, {
      type: 'rescue_credits',
      creditsToGrant: 2,
      campaign: 'plan_expired_rescue'
    });

    const req = mockReq('POST', { action: 'consume_retention' }, { token: tokenData.token });
    const res = mockRes();
    await authHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.creditsGranted, 2);
    assert.equal(res.body.user.credits, 3);
    assert.ok(res.body.token, 'Debe emitir un JWT de sesión transitoria');

    const decoded = jwt.decode(res.body.token);
    assert.equal(decoded.phone, phone);
    assert.equal(decoded.type, 'retention_session');
  });

  await t.test('7. POST /api/auth (consume_retention) debe rechazar ataque de repetición con 410', async () => {
    const phone = '3151002036';
    await db.updateUser(phone, { credits: 1, lastRescueCreditAt: null });

    const tokenData = await db.createRetentionToken(phone, {
      type: 'rescue_credits',
      creditsToGrant: 2
    });

    // Primer consumo: OK
    const req1 = mockReq('POST', { action: 'consume_retention' }, { token: tokenData.token });
    const res1 = mockRes();
    await authHandler(req1, res1);
    assert.equal(res1.statusCode, 200);

    // Segundo consumo (Ataque): 410 Gone
    const req2 = mockReq('POST', { action: 'consume_retention' }, { token: tokenData.token });
    const res2 = mockRes();
    await authHandler(req2, res2);
    assert.equal(res2.statusCode, 410);
    assert.equal(res2.body.error, 'TOKEN_YA_USADO');
  });

});
