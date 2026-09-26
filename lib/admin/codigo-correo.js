/**
 * ✉️ Segundo factor alternativo del panel: código de 6 dígitos por correo.
 *
 * Por qué: el propietario no tiene oficina y a veces entra desde equipos prestados con el
 * teléfono (donde está la app autenticadora) apagado o lejos. Lo estándar es tener más de una
 * forma de entrar: app (principal), códigos de respaldo y, como alternativa, un código por
 * correo (lo usan Vercel, Notion o Slack). Como el correo es un factor más débil, lleva
 * protecciones:
 *   - solo se envía al correo del administrador ya autenticado con Google (ADMIN_EMAILS);
 *   - se guarda solo su huella (HMAC), vence en 10 minutos y sirve una sola vez;
 *   - máximo 5 intentos por código y 3 envíos cada 15 minutos (lib/admin/dos-factores.js);
 *   - la sesión que abre dura como máximo 2 horas (no 8);
 *   - cada ingreso por correo envía un aviso al mismo correo y queda en la auditoría.
 */
const crypto = require('crypto');
const db = require('../db');
const { enviarCorreo } = require('../correo');

const COLECCION = 'admin_codigos_correo';
const VIGENCIA_MS = 10 * 60 * 1000;
const MAX_INTENTOS = 5;
const SESION_CORREO_H = 2;

function huella(uid, codigo) {
  const base = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET || 'solo-pruebas';
  return crypto.createHmac('sha256', base).update(`origgo-codigo-correo:${uid}:${codigo}`).digest('hex');
}

/** a•••@gmail.com */
function correoEnmascarado(email) {
  const [usuario, dominio] = String(email || '').split('@');
  if (!dominio) return '';
  return `${usuario.slice(0, 1)}•••@${dominio}`;
}

function plantilla(titulo, cuerpo) {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#07120f;color:#e8f3ef;border-radius:16px">
  <p style="color:#34d399;font-weight:bold;margin:0 0 8px">Origgo · Panel de administración</p>
  <h2 style="margin:0 0 16px">${titulo}</h2>${cuerpo}
  <p style="color:#9bb3ac;font-size:12px;margin-top:24px">Si no fuiste tú, entra al panel y cierra la sesión, y cambia la contraseña de tu cuenta de Google.</p></div>`;
}

/**
 * Genera un código nuevo (reemplaza al anterior) y lo envía al correo del administrador.
 * @returns {Promise<{ enviado: boolean, destino: string }>}
 */
async function enviarCodigo(admin, ahora = Date.now()) {
  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await db.coleccion(COLECCION).doc(admin.uid).set({
    hash: huella(admin.uid, codigo),
    expira_ms: ahora + VIGENCIA_MS,
    intentos: 0,
    creado_ms: ahora,
  });
  const enviado = await enviarCorreo({
    para: admin.email,
    asunto: `Tu código para entrar al panel de Origgo: ${codigo}`,
    html: plantilla(
      'Código de verificación',
      `<p style="font-size:34px;letter-spacing:8px;font-weight:bold;margin:8px 0;color:#34d399">${codigo}</p>
       <p>Vence en 10 minutos y sirve una sola vez.</p>`
    ),
  });
  return { enviado, destino: correoEnmascarado(admin.email) };
}

/**
 * Valida el código del correo.
 * @returns {Promise<'correo'|'incorrecto'|'vencido'|'bloqueado'>}
 */
async function validarCodigoCorreo(uid, codigo, ahora = Date.now()) {
  const ref = db.coleccion(COLECCION).doc(uid);
  const doc = await ref.get();
  if (!doc.exists) return 'vencido';
  const datos = doc.data();
  if (ahora > datos.expira_ms) return 'vencido';
  if ((datos.intentos || 0) >= MAX_INTENTOS) return 'bloqueado';

  const esperado = Buffer.from(datos.hash, 'hex');
  const recibido = Buffer.from(huella(uid, String(codigo || '').trim()), 'hex');
  if (esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido)) {
    // Un solo uso: se invalida antes de abrir la sesión.
    await ref.set({ ...datos, hash: '', expira_ms: 0, usado_ms: ahora });
    return 'correo';
  }
  await ref.set({ ...datos, intentos: (datos.intentos || 0) + 1 });
  return 'incorrecto';
}

const NOMBRE_METODO = { totp: 'app autenticadora', respaldo: 'código de respaldo', correo: 'código por correo' };

/**
 * Aviso de seguridad en CADA ingreso al panel (estándar: Google, bancos). Si no fuiste tú, lo
 * sabes de inmediato. Método: 'totp' | 'respaldo' | 'correo'.
 */
async function avisarIngreso(admin, req, metodo = 'correo') {
  const ip = String((req.headers && req.headers['x-forwarded-for']) || '')
    .split(',')[0]
    .trim()
    .replace(/\.\d+$/, '.x');
  const navegador = String((req.headers && req.headers['user-agent']) || 'desconocido').slice(0, 120);
  const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  await enviarCorreo({
    para: admin.email,
    asunto: `Nuevo ingreso al panel de Origgo (${NOMBRE_METODO[metodo] || metodo})`,
    html: plantilla(
      'Nuevo ingreso al panel',
      `<p>Método: <b>${NOMBRE_METODO[metodo] || metodo}</b></p>
       <p>Fecha: <b>${fecha}</b> (hora de Colombia)</p><p>IP aproximada: <b>${ip || 'desconocida'}</b></p>
       <p style="color:#9bb3ac;font-size:13px">Navegador: ${navegador.replace(/[<>]/g, '')}</p>`
    ),
  });
}

module.exports = {
  SESION_CORREO_H,
  MAX_INTENTOS,
  enviarCodigo,
  validarCodigoCorreo,
  avisarIngreso,
  correoEnmascarado,
};
