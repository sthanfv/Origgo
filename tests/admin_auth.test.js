/**
 * Pruebas de la verificación de administrador del panel (lib/admin-auth.js).
 * Se genera un par de llaves RSA propio y se firman ID tokens de prueba con el mismo
 * formato que emite Firebase, inyectando la llave pública como "certificado".
 */
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const path = require('node:path');

const { verificarAdmin, verificarIdTokenFirebase } = require('../lib/admin-auth');

const PROYECTO = 'proyecto-prueba';
const KID = 'kid-prueba';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PUBLICA_PEM = publicKey.export({ type: 'spki', format: 'pem' });
const ahora = Math.floor(Date.now() / 1000);

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function firmar(datos = {}, cabecera = {}) {
  const h = b64url({ alg: 'RS256', kid: KID, typ: 'JWT', ...cabecera });
  const p = b64url({
    aud: PROYECTO,
    iss: `https://securetoken.google.com/${PROYECTO}`,
    sub: 'uid-123',
    iat: ahora - 10,
    auth_time: ahora - 10,
    exp: ahora + 3600,
    email: 'admin@ejemplo.com',
    email_verified: true,
    ...datos,
  });
  const firma = crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url');
  return `${h}.${p}.${firma}`;
}

const opciones = {
  proyecto: PROYECTO,
  obtenerCertificados: async () => ({ [KID]: PUBLICA_PEM }),
  ahora,
};

function req(token) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} };
}

test.beforeEach(() => {
  process.env.ADMIN_EMAILS = 'admin@ejemplo.com, otro@ejemplo.com';
});

test('acepta un token válido de un administrador autorizado', async () => {
  const admin = await verificarAdmin(req(firmar()), opciones);
  assert.deepStrictEqual(admin, { uid: 'uid-123', email: 'admin@ejemplo.com' });
});

test('rechaza la firma alterada', async () => {
  const t = firmar();
  const alterado = t.slice(0, -4) + (t.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  await assert.rejects(verificarIdTokenFirebase(alterado, opciones), /firma/);
});

test('rechaza un token de otro proyecto (aud) o emisor (iss)', async () => {
  await assert.rejects(verificarIdTokenFirebase(firmar({ aud: 'otro' }), opciones), /aud/);
  await assert.rejects(verificarIdTokenFirebase(firmar({ iss: 'https://malo' }), opciones), /iss/);
});

test('rechaza tokens vencidos o emitidos en el futuro', async () => {
  await assert.rejects(verificarIdTokenFirebase(firmar({ exp: ahora - 120 }), opciones), /exp/);
  await assert.rejects(verificarIdTokenFirebase(firmar({ iat: ahora + 600 }), opciones), /iat/);
});

test('rechaza kid desconocido, algoritmo distinto y formato roto', async () => {
  await assert.rejects(verificarIdTokenFirebase(firmar({}, { kid: 'otro' }), opciones), /kid/);
  await assert.rejects(verificarIdTokenFirebase(firmar({}, { alg: 'HS256' }), opciones), /algoritmo/);
  await assert.rejects(verificarIdTokenFirebase('no.es-un.jwt!', opciones), /formato|algoritmo/);
});

test('403 si el correo no está en ADMIN_EMAILS o no está verificado', async () => {
  await assert.rejects(verificarAdmin(req(firmar({ email: 'intruso@ejemplo.com' })), opciones), (e) => e.status === 403);
  await assert.rejects(verificarAdmin(req(firmar({ email_verified: false })), opciones), (e) => e.status === 403);
});

test('401 sin token o con token inválido; 503 sin administradores configurados', async () => {
  await assert.rejects(verificarAdmin(req(''), opciones), (e) => e.status === 401);
  await assert.rejects(verificarAdmin(req('basura'), opciones), (e) => e.status === 401);
  process.env.ADMIN_EMAILS = '';
  await assert.rejects(verificarAdmin(req(firmar()), opciones), (e) => e.status === 503);
});

test('no depende de firebase-admin/auth (evita ERR_REQUIRE_ESM en Vercel)', () => {
  const fs = require('node:fs');
  const fuente = fs.readFileSync(path.join(__dirname, '..', 'lib', 'admin-auth.js'), 'utf8');
  assert.ok(!/require\(['"]firebase-admin\/auth['"]\)/.test(fuente));
});
