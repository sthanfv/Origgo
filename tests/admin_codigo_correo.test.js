/**
 * 🧪 Segundo factor por correo del panel (lib/admin/codigo-correo.js).
 * Modo memoria y correo simulado (NODE_ENV=test): no toca producción ni envía correos.
 */
process.env.NODE_ENV = 'test';
process.env.FIRESTORE_DESACTIVADO = '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-codigo-correo';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const cc = require('../lib/admin/codigo-correo');
const { leerUltimoCorreoDePrueba } = require('../lib/correo');
const sesion = require('../lib/admin/sesion');

const admin = () => ({ uid: `uid-${Date.now()}-${Math.random()}`, email: 'fabian@example.com' });
const codigoDelCorreo = () => leerUltimoCorreoDePrueba().asunto.match(/(\d{6})$/)[1];

test('envía el código al correo del administrador y lo muestra enmascarado', async () => {
  const a = admin();
  const r = await cc.enviarCodigo(a);
  assert.deepEqual(r, { enviado: true, destino: 'f•••@example.com' });
  assert.equal(leerUltimoCorreoDePrueba().para, 'fabian@example.com');
  assert.match(codigoDelCorreo(), /^\d{6}$/);
});

test('el código sirve una sola vez', async () => {
  const a = admin();
  await cc.enviarCodigo(a);
  const codigo = codigoDelCorreo();
  assert.equal(await cc.validarCodigoCorreo(a.uid, codigo), 'correo');
  assert.equal(await cc.validarCodigoCorreo(a.uid, codigo), 'vencido');
});

test('vence a los 10 minutos', async () => {
  const a = admin();
  const ahora = Date.now();
  await cc.enviarCodigo(a, ahora);
  assert.equal(await cc.validarCodigoCorreo(a.uid, codigoDelCorreo(), ahora + 11 * 60 * 1000), 'vencido');
});

test('5 intentos fallidos bloquean el código (aunque luego se escriba bien)', async () => {
  const a = admin();
  await cc.enviarCodigo(a);
  const bueno = codigoDelCorreo();
  const malo = bueno === '000000' ? '111111' : '000000';
  for (let i = 0; i < cc.MAX_INTENTOS; i++) assert.equal(await cc.validarCodigoCorreo(a.uid, malo), 'incorrecto');
  assert.equal(await cc.validarCodigoCorreo(a.uid, bueno), 'bloqueado');
});

test('la sesión abierta por correo dura como máximo 2 horas', () => {
  const ahora = Date.now();
  const token = sesion.crearSesion('uid-x', cc.SESION_CORREO_H, { ini: ahora - 2 * 3600 * 1000 - 60000, ahora: ahora - 60000 });
  const req = { headers: { cookie: `${sesion.COOKIE}=${token}` } };
  assert.equal(sesion.estadoSesion(req, 'uid-x', ahora).valida, false);
});
