/**
 * 🧪 Regresiones de la auditoría de seguridad del 2026-09-26 (docs/AUDITORIA_SEGURIDAD_2026-09-26.md).
 * Modo memoria y sin credenciales externas: no toca producción.
 */
process.env.NODE_ENV = 'test';
process.env.FIRESTORE_DESACTIVADO = '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../lib/db');
const { signJwt } = require('../lib/crypto');
const { resetRateLimiter } = require('../lib/rate-limiter');
const sessionHandler = require('../lib/auth/session');

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

async function canjear(token) {
  const res = crearRes();
  await sessionHandler(
    { method: 'POST', headers: { 'x-forwarded-for': `10.9.0.${Math.floor(Math.random() * 250)}` }, body: { action: 'recover_token', recoveryToken: token } },
    res
  );
  return res;
}

describe('🔐 Auditoría de seguridad: regresiones', () => {
  it('H-01: un enlace de recuperación sirve UNA sola vez', async () => {
    resetRateLimiter();
    const tel = '317' + Math.floor(1000000 + Math.random() * 9000000);
    await db.addCredits(tel, 2, null, null, `r${tel}@example.com`);
    const token = signJwt(
      { purpose: 'recover_session', phone: tel, email: `r${tel}@example.com`, nonce: crypto.randomUUID() },
      process.env.JWT_SECRET,
      1
    );
    const primero = await canjear(token);
    assert.equal(primero.statusCode, 200);
    assert.ok(primero.data.token);
    const segundo = await canjear(token);
    assert.equal(segundo.statusCode, 401, 'el mismo enlace no abre una segunda sesión');
  });

  it('H-01: un enlace sin nonce (formato antiguo, reutilizable) se rechaza', async () => {
    resetRateLimiter();
    const tel = '317' + Math.floor(1000000 + Math.random() * 9000000);
    await db.addCredits(tel, 1);
    const viejo = signJwt({ purpose: 'recover_session', phone: tel }, process.env.JWT_SECRET, 30);
    assert.equal((await canjear(viejo)).statusCode, 401);
  });

  it('H-04: la política de seguridad prohíbe scripts en línea y marcos de otros sitios', () => {
    const v = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
    const csp = v.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));
    assert.ok(!scriptSrc.includes("'unsafe-inline'"), 'script-src sin unsafe-inline');
    assert.ok(!scriptSrc.includes("'unsafe-eval'"), 'script-src sin unsafe-eval');
    for (const d of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'"]) assert.ok(csp.includes(d), d);
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.ok(!/<script>(?![\s\S]*?src=)/.test(html.replace(/<script[^>]*src=[^>]*><\/script>/g, '')), 'index.html sin scripts en línea');
  });

  it('H-03: cerrar sesión borra todo dato personal del navegador', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'auth.ts'), 'utf8');
    for (const clave of ['origgo_auth_jwt_token', 'origgo_unlocked_leads_map', 'origgo_user_credits_v1', 'origgo_auth_email', 'origgo_auth_phone']) {
      assert.ok(src.includes(`'${clave}'`), `cerrarSesionLocal borra ${clave}`);
    }
  });

  it('H-05: los enlaces externos solo aceptan http(s)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'url-segura.ts'), 'utf8');
    // Se evalúa la función compilando su cuerpo (sin dependencias).
    const cuerpo = src.replace(/export function/, 'function').replace(/: string \| null \| undefined/, '').replace(/\): string/, ')');
    const urlSegura = new Function(`${cuerpo}; return urlSegura;`)();
    assert.equal(urlSegura('javascript:alert(1)'), '');
    assert.equal(urlSegura('data:text/html,<script>alert(1)</script>'), '');
    assert.equal(urlSegura('https://www.fincaraiz.com.co/inmueble/1'), 'https://www.fincaraiz.com.co/inmueble/1');
  });
});
