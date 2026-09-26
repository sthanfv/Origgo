/**
 * Pruebas del segundo factor del panel: TOTP (RFC 6238), códigos de respaldo, sesión con
 * cookie HttpOnly, control de acceso de 4 capas y el manejador /api/admin/{estado,verificar,salir}.
 *
 * Firestore y Google se sustituyen por dobles en memoria antes de cargar los módulos.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

process.env.JWT_SECRET = 'secreto-de-prueba-para-sesiones-0123456789';
process.env.ADMIN_EMAILS = 'admin@ejemplo.com';

const raiz = path.join(__dirname, '..');
const ruta = (rel) => require.resolve(path.join(raiz, rel));

// --- Dobles: identidad de Google y registro/usos únicos en memoria -----------------------
const usos = new Set();
const auditoria = [];
require.cache[ruta('lib/admin/auditoria.js')] = {
  id: ruta('lib/admin/auditoria.js'),
  filename: ruta('lib/admin/auditoria.js'),
  loaded: true,
  exports: {
    registrarAuditoria: async (e) => auditoria.push(e),
    marcarUsoUnico: async (clave) => (usos.has(clave) ? false : (usos.add(clave), true)),
  },
};
let identidad = { uid: 'uid-admin', email: 'admin@ejemplo.com' };
require.cache[ruta('lib/admin-auth.js')] = {
  id: ruta('lib/admin-auth.js'),
  filename: ruta('lib/admin-auth.js'),
  loaded: true,
  exports: {
    verificarAdmin: async (req) => {
      if (!req.headers.authorization) {
        const e = new Error('Falta el token de sesión.');
        e.status = 401;
        throw e;
      }
      return identidad;
    },
  },
};

const totp = require('../lib/admin/totp');
const sesion = require('../lib/admin/sesion');
const { exigirAdminCon2FA } = require('../lib/admin/acceso');
const dosFactores = require('../lib/admin/dos-factores');

// Secreto del RFC 6238 (ASCII "12345678901234567890") en Base32.
const SECRETO_RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

function respuesta() {
  return {
    codigoHttp: 0,
    cuerpo: null,
    cabeceras: {},
    status(c) {
      this.codigoHttp = c;
      return this;
    },
    json(d) {
      this.cuerpo = d;
      return this;
    },
    setHeader(k, v) {
      this.cabeceras[k.toLowerCase()] = v;
    },
    end() {
      return this;
    },
  };
}

function peticion({ accion, metodo = 'GET', cuerpo, cookie, ip = '10.0.0.1' }) {
  const headers = { authorization: 'Bearer token-google', 'x-forwarded-for': ip };
  if (cookie) headers.cookie = cookie;
  return { method: metodo, query: { action: accion }, headers, body: cuerpo, url: `/api/admin/${accion}` };
}

function cookieDe(res) {
  const set = res.cabeceras['set-cookie'] || '';
  return set.split(';')[0];
}

// --- TOTP --------------------------------------------------------------------------------
test('TOTP coincide con los vectores oficiales del RFC 6238 (SHA-1, 6 dígitos)', () => {
  const secreto = totp.base32Decodificar(SECRETO_RFC);
  const vectores = [
    [59, '287082'],
    [1111111109, '081804'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ];
  for (const [segundos, esperado] of vectores) {
    assert.strictEqual(totp.hotp(secreto, Math.floor(segundos / 30)), esperado);
    assert.strictEqual(totp.verificarTotp(SECRETO_RFC, esperado, segundos * 1000), Math.floor(segundos / 30));
  }
});

test('TOTP tolera ±30 s de desfase y rechaza códigos más viejos o con formato inválido', () => {
  const ahora = 1234567890 * 1000;
  const paso = totp.pasoActual(ahora);
  const secreto = totp.base32Decodificar(SECRETO_RFC);
  assert.notStrictEqual(totp.verificarTotp(SECRETO_RFC, totp.hotp(secreto, paso - 1), ahora), null);
  assert.notStrictEqual(totp.verificarTotp(SECRETO_RFC, totp.hotp(secreto, paso + 1), ahora), null);
  assert.strictEqual(totp.verificarTotp(SECRETO_RFC, totp.hotp(secreto, paso - 3), ahora), null);
  assert.strictEqual(totp.verificarTotp(SECRETO_RFC, '12345', ahora), null);
  assert.strictEqual(totp.verificarTotp(SECRETO_RFC, 'abcdef', ahora), null);
});

test('Base32 ida y vuelta, y secretos nuevos de 160 bits', () => {
  const s = totp.generarSecreto();
  assert.strictEqual(totp.base32Decodificar(s).length, 20);
  assert.strictEqual(totp.base32Codificar(totp.base32Decodificar(SECRETO_RFC)), SECRETO_RFC);
});

test('códigos de respaldo: formato, huella normalizada y detección', () => {
  const codigos = totp.generarCodigosRespaldo(8);
  assert.strictEqual(new Set(codigos).size, 8);
  for (const c of codigos) assert.match(c, /^[0-9A-F]{5}-[0-9A-F]{5}$/);
  const [c] = codigos;
  assert.strictEqual(totp.hashCodigoRespaldo(c), totp.hashCodigoRespaldo(c.toLowerCase().replace('-', ' ')));
  assert.ok(totp.pareceCodigoRespaldo(c));
  assert.ok(!totp.pareceCodigoRespaldo('123456'));
});

// --- Sesión ------------------------------------------------------------------------------
test('la sesión de 2FA solo vale para el mismo uid, sin alterar y sin vencer', () => {
  const token = sesion.crearSesion('uid-admin');
  const req = (t) => ({ headers: { cookie: `otra=1; ${sesion.COOKIE}=${t}` } });
  assert.ok(sesion.sesionValida(req(token), 'uid-admin'));
  assert.ok(!sesion.sesionValida(req(token), 'otro-uid'));
  assert.ok(!sesion.sesionValida(req(token.slice(0, -2) + 'xx'), 'uid-admin'));
  assert.ok(!sesion.sesionValida(req(sesion.crearSesion('uid-admin', -1)), 'uid-admin'));
  assert.ok(!sesion.sesionValida({ headers: {} }, 'uid-admin'));
});

test('un JWT de usuario de la vitrina no sirve como sesión del panel (separación de dominio)', () => {
  const { signJwt } = require('../lib/crypto');
  const tokenUsuario = signJwt({ sub: 'uid-admin', aud: 'origgo-admin-2fa' }, process.env.JWT_SECRET, 1);
  assert.ok(!sesion.sesionValida({ headers: { cookie: `${sesion.COOKIE}=${tokenUsuario}` } }, 'uid-admin'));
});

test('la cookie es HttpOnly, Secure, SameSite=Strict y limitada a /api/admin', () => {
  const c = sesion.cabeceraCookie('x');
  for (const parte of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/api/admin']) {
    assert.ok(c.includes(parte), parte);
  }
  assert.ok(!c.includes('Max-Age'), 'cookie de sesión: se borra al cerrar el navegador');
});

test('sesión: 15 min sin uso la cierran, el uso la renueva y 8 h es el máximo absoluto', () => {
  const ahora = Date.now();
  const minuto = 60 * 1000;
  const req = (t) => ({ headers: { cookie: `${sesion.COOKIE}=${t}` } });

  // Usada hace 14 min: sigue activa. Hace 16 min: cerrada por inactividad.
  const hace14 = sesion.crearSesion('uid-admin', 8, { ini: ahora - 14 * minuto, ahora: ahora - 14 * minuto });
  assert.equal(sesion.estadoSesion(req(hace14), 'uid-admin').valida, true);
  const hace16 = sesion.crearSesion('uid-admin', 8, { ini: ahora - 16 * minuto, ahora: ahora - 16 * minuto });
  assert.deepEqual(sesion.estadoSesion(req(hace16), 'uid-admin'), { valida: false, motivo: 'inactiva' });

  // La renovación (más de 1 min después) entrega una cookie nueva con el mismo inicio.
  let cabecera = '';
  const res = { setHeader: (_n, v) => (cabecera = v) };
  sesion.renovarSesion(res, sesion.estadoSesion(req(hace14), 'uid-admin').datos);
  const renovada = cabecera.split(';')[0].split('=').slice(1).join('=');
  const datos = sesion.estadoSesion(req(renovada), 'uid-admin').datos;
  assert.ok(datos.act >= ahora - 1000, 'actividad renovada');
  assert.equal(datos.ini, ahora - 14 * minuto, 'el inicio no cambia: el límite de 8 h no se extiende');

  // Iniciada hace 8 h 1 min, aunque se haya usado hace 1 min: vencida.
  const vieja = sesion.crearSesion('uid-admin', 8, { ini: ahora - 481 * minuto, ahora: ahora - minuto });
  assert.equal(sesion.estadoSesion(req(vieja), 'uid-admin').valida, false);
});

// --- Acceso de 4 capas -------------------------------------------------------------------
test('exigirAdminCon2FA: sin cookie pide 2FA; con cookie válida deja pasar', async () => {
  await assert.rejects(
    exigirAdminCon2FA({ headers: { authorization: 'Bearer t' } }),
    (e) => e.status === 401 && e.codigo === '2FA_REQUERIDO',
  );
  const cookie = `${sesion.COOKIE}=${sesion.crearSesion('uid-admin')}`;
  const admin = await exigirAdminCon2FA({ headers: { authorization: 'Bearer t', cookie } });
  assert.strictEqual(admin.email, 'admin@ejemplo.com');
});

// --- Manejador /api/admin/{estado,verificar,salir} ----------------------------------------
test('flujo completo: estado → código TOTP → cookie → estado verificado; el código no se reutiliza', async () => {
  process.env.NODE_ENV = 'test';
  process.env.ADMIN_TOTP_SECRET = SECRETO_RFC;
  const codigo = totp.hotp(totp.base32Decodificar(SECRETO_RFC), totp.pasoActual());

  let res = respuesta();
  await dosFactores(peticion({ accion: 'estado' }), res);
  assert.deepStrictEqual(
    [res.codigoHttp, res.cuerpo.dosFactores, res.cuerpo.configurado],
    [200, false, true],
  );

  res = respuesta();
  await dosFactores(peticion({ accion: 'verificar', metodo: 'POST', cuerpo: { codigo } }), res);
  assert.strictEqual(res.codigoHttp, 200);
  const cookie = cookieDe(res);
  assert.ok(cookie.startsWith(`${sesion.COOKIE}=`));

  res = respuesta();
  await dosFactores(peticion({ accion: 'estado', cookie }), res);
  assert.strictEqual(res.cuerpo.dosFactores, true);

  res = respuesta();
  await dosFactores(peticion({ accion: 'verificar', metodo: 'POST', cuerpo: { codigo } }), res);
  assert.strictEqual(res.codigoHttp, 401);
  assert.match(res.cuerpo.error, /ya se usó/);
});

test('código incorrecto → 401 y queda en la auditoría', async () => {
  process.env.ADMIN_TOTP_SECRET = SECRETO_RFC;
  const antes = auditoria.length;
  const res = respuesta();
  await dosFactores(peticion({ accion: 'verificar', metodo: 'POST', cuerpo: { codigo: '000000' } }), res);
  assert.strictEqual(res.codigoHttp, 401);
  assert.ok(auditoria.slice(antes).some((a) => a.accion === 'codigo_2fa_rechazado'));
});

test('código de respaldo: funciona una sola vez', async () => {
  process.env.ADMIN_TOTP_SECRET = SECRETO_RFC;
  const [codigo] = totp.generarCodigosRespaldo(1);
  process.env.ADMIN_BACKUP_CODES = `otra-huella,${totp.hashCodigoRespaldo(codigo)}`;
  let res = respuesta();
  await dosFactores(peticion({ accion: 'verificar', metodo: 'POST', cuerpo: { codigo } }), res);
  assert.deepStrictEqual([res.codigoHttp, res.cuerpo.metodo], [200, 'respaldo']);
  res = respuesta();
  await dosFactores(peticion({ accion: 'verificar', metodo: 'POST', cuerpo: { codigo } }), res);
  assert.strictEqual(res.codigoHttp, 401);
});

test('sin ADMIN_TOTP_SECRET el servidor rechaza con 503; salir borra la cookie', async () => {
  delete process.env.ADMIN_TOTP_SECRET;
  let res = respuesta();
  await dosFactores(peticion({ accion: 'verificar', metodo: 'POST', cuerpo: { codigo: '123456' } }), res);
  assert.strictEqual(res.codigoHttp, 503);
  res = respuesta();
  await dosFactores(peticion({ accion: 'salir', metodo: 'POST' }), res);
  assert.strictEqual(res.codigoHttp, 200);
  assert.match(res.cabeceras['set-cookie'], /Max-Age=0/);
});

test('sin token de Google no se puede ni consultar el estado', async () => {
  const res = respuesta();
  await dosFactores({ method: 'GET', query: { action: 'estado' }, headers: {} }, res);
  assert.strictEqual(res.codigoHttp, 401);
});

test('límite de intentos: el 6.º intento en 15 minutos se bloquea', async () => {
  process.env.ADMIN_TOTP_SECRET = SECRETO_RFC;
  const entornoPrevio = process.env.NODE_ENV;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.NODE_ENV = 'production-simulada';
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    const codigos = [];
    for (let i = 0; i < 6; i++) {
      const res = respuesta();
      await dosFactores(
        peticion({ accion: 'verificar', metodo: 'POST', cuerpo: { codigo: '000000' }, ip: '10.9.9.9' }),
        res,
      );
      codigos.push(res.codigoHttp);
    }
    assert.deepStrictEqual(codigos.slice(0, 5), [401, 401, 401, 401, 401]);
    assert.ok([429, 403].includes(codigos[5]), `se esperaba bloqueo, llegó ${codigos[5]}`);
  } finally {
    process.env.NODE_ENV = entornoPrevio;
    if (upstashUrl) process.env.UPSTASH_REDIS_REST_URL = upstashUrl;
    if (upstashToken) process.env.UPSTASH_REDIS_REST_TOKEN = upstashToken;
  }
});
