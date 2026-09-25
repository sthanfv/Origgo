/**
 * 🔐 Verificación de administrador del panel de Origgo.
 *
 * El acceso al panel es con Google (Firebase Authentication). El navegador envía el
 * ID token de Firebase en la cabecera `Authorization: Bearer <token>`. Aquí se verifica
 * ese token y se comprueba que el correo esté en la lista blanca `ADMIN_EMAILS` del .env
 * (correos separados por coma). No hay contraseñas que filtrar.
 *
 * Por qué no se usa `firebase-admin/auth`: arrastra `jose` 6 (solo ESM) vía `jwks-rsa`, y en
 * las funciones de Vercel eso falla al cargar con `ERR_REQUIRE_ESM` (la función entera se cae).
 * Se sigue el método que documenta Firebase para verificar ID tokens con cualquier librería:
 * firma RS256 contra los certificados públicos de Google + comprobación de `aud`, `iss`,
 * `exp`, `iat`, `auth_time` y `sub`. Solo usa `crypto` nativo de Node.
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
const crypto = require('crypto');

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
/** Tolerancia de reloj entre servidores, en segundos. */
const TOLERANCIA_S = 30;

let cacheCertificados = { certs: null, expira: 0 };

/** Proyecto de Firebase contra el que se validan los tokens. */
function proyectoFirebase() {
  return process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
}

/** Lista blanca de correos con acceso al panel (desde ADMIN_EMAILS). */
function correosAdministradores() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

/** Descarga (y guarda según su Cache-Control) los certificados públicos de Google. */
async function certificadosGoogle() {
  if (cacheCertificados.certs && Date.now() < cacheCertificados.expira) {
    return cacheCertificados.certs;
  }
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error(`certificados de Google HTTP ${res.status}`);
  const certs = await res.json();
  const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  cacheCertificados = {
    certs,
    expira: Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : 60 * 60 * 1000),
  };
  return certs;
}

function decodificarSegmento(segmento) {
  return JSON.parse(Buffer.from(segmento, 'base64url').toString('utf8'));
}

/**
 * Verifica un ID token de Firebase.
 * @param {string} token JWT emitido por Firebase Authentication.
 * @param {{ proyecto?: string, obtenerCertificados?: () => Promise<Record<string,string>>, ahora?: number }} [opciones]
 *   Inyectables para pruebas.
 * @returns {Promise<{uid: string, email: string, email_verified: boolean}>}
 * @throws {Error} Si el token no es válido (el mensaje indica qué comprobación falló).
 */
async function verificarIdTokenFirebase(token, opciones = {}) {
  const proyecto = opciones.proyecto || proyectoFirebase();
  if (!proyecto) throw new Error('FIREBASE_PROJECT_ID no configurado');
  const obtener = opciones.obtenerCertificados || certificadosGoogle;
  const ahora = opciones.ahora || Math.floor(Date.now() / 1000);

  const partes = String(token).split('.');
  if (partes.length !== 3) throw new Error('formato');
  let cabecera;
  let datos;
  try {
    cabecera = decodificarSegmento(partes[0]);
    datos = decodificarSegmento(partes[1]);
  } catch {
    throw new Error('formato');
  }
  if (cabecera.alg !== 'RS256' || !cabecera.kid) throw new Error('algoritmo');

  const certs = await obtener();
  const cert = certs[cabecera.kid];
  if (!cert) throw new Error('kid');

  const firmaValida = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${partes[0]}.${partes[1]}`),
    crypto.createPublicKey(cert),
    Buffer.from(partes[2], 'base64url')
  );
  if (!firmaValida) throw new Error('firma');

  if (datos.aud !== proyecto) throw new Error('aud');
  if (datos.iss !== `https://securetoken.google.com/${proyecto}`) throw new Error('iss');
  if (typeof datos.exp !== 'number' || datos.exp + TOLERANCIA_S <= ahora) throw new Error('exp');
  if (typeof datos.iat !== 'number' || datos.iat - TOLERANCIA_S > ahora) throw new Error('iat');
  if (typeof datos.auth_time === 'number' && datos.auth_time - TOLERANCIA_S > ahora) {
    throw new Error('auth_time');
  }
  if (typeof datos.sub !== 'string' || !datos.sub || datos.sub.length > 128) {
    throw new Error('sub');
  }

  return { uid: datos.sub, email: datos.email || '', email_verified: datos.email_verified === true };
}

/**
 * Verifica al administrador a partir del ID token de Google.
 * @param {import('http').IncomingMessage & {headers: Object}} req
 * @param {Parameters<typeof verificarIdTokenFirebase>[1]} [opciones] Inyectables para pruebas.
 * @returns {Promise<{uid: string, email: string}>} Datos del administrador.
 * @throws {Error & {status: number}} 401 sin token o inválido, 403 sin permiso, 503 sin config.
 */
async function verificarAdmin(req, opciones) {
  const cabecera = req.headers.authorization || req.headers.Authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : '';
  if (!token) {
    const e = new Error('Falta el token de sesión.');
    e.status = 401;
    throw e;
  }

  const permitidos = correosAdministradores();
  if (permitidos.length === 0) {
    const e = new Error('El panel no tiene administradores configurados (ADMIN_EMAILS).');
    e.status = 503;
    throw e;
  }

  let decoded;
  try {
    decoded = await verificarIdTokenFirebase(token, opciones);
  } catch {
    const e = new Error('Sesión inválida o expirada.');
    e.status = 401;
    throw e;
  }

  const email = decoded.email.toLowerCase();
  if (!decoded.email_verified || !permitidos.includes(email)) {
    const e = new Error('Tu cuenta no tiene acceso al panel.');
    e.status = 403;
    throw e;
  }

  return { uid: decoded.uid, email };
}

module.exports = { verificarAdmin, verificarIdTokenFirebase, correosAdministradores };
