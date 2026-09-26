/**
 * 🔐 Segundo factor (TOTP) del panel de administración.
 *
 *   GET  /api/admin/estado     → ¿la sesión ya pasó el segundo factor? Con `?latido=1` además
 *                                 renueva la ventana de inactividad (el panel lo llama mientras
 *                                 el administrador está activo aunque no haga otras peticiones).
 *   POST /api/admin/verificar  → valida el código de la app autenticadora (o uno de respaldo)
 *                                 y entrega la cookie de sesión de 8 horas.
 *   POST /api/admin/salir      → borra la cookie de sesión.
 *
 * Todas exigen primero el token de Google + ADMIN_EMAILS + custom claim `admin`.
 * Protecciones: máx. 5 intentos cada 15 minutos (Upstash), cada código TOTP y de respaldo
 * sirve una sola vez (Firestore) y todo queda en la auditoría.
 *
 * Variables: ADMIN_TOTP_SECRET (secreto Base32) y ADMIN_BACKUP_CODES (huellas SHA-256
 * separadas por coma). Se generan con `node scripts/admin-2fa-enrolar.js`.
 */
const { aplicarCorsSeguro } = require('../cors');
const { checkRateLimitAsync } = require('../rate-limiter');
const { verificarAdmin } = require('../admin-auth');
const { verificarTotp, hashCodigoRespaldo, pareceCodigoRespaldo } = require('./totp');
const {
  crearSesion,
  estadoSesion,
  renovarSesion,
  INACTIVIDAD_MS,
  cabeceraCookie,
  cabeceraBorrarCookie,
} = require('./sesion');
const { registrarAuditoria, marcarUsoUnico } = require('./auditoria');

function leerCuerpo(req) {
  let cuerpo = req.body;
  if (typeof cuerpo === 'string') {
    try {
      cuerpo = JSON.parse(cuerpo);
    } catch {
      cuerpo = {};
    }
  }
  return cuerpo || {};
}

/** Valida el código: TOTP (un solo uso por paso) o código de respaldo (un solo uso). */
async function validarCodigo(codigo) {
  const secreto = process.env.ADMIN_TOTP_SECRET;
  const paso = verificarTotp(secreto, codigo);
  if (paso !== null) {
    return (await marcarUsoUnico(`totp_${paso}`)) ? 'totp' : 'reutilizado';
  }
  if (pareceCodigoRespaldo(codigo)) {
    const huella = hashCodigoRespaldo(codigo);
    const validos = (process.env.ADMIN_BACKUP_CODES || '')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    if (validos.includes(huella)) {
      return (await marcarUsoUnico(`respaldo_${huella}`)) ? 'respaldo' : 'reutilizado';
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 'no-store');

  let admin;
  try {
    admin = await verificarAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({ ok: false, error: e.message });
  }

  const accion = (req.query && req.query.action) || '';

  if (accion === 'estado') {
    const estado = estadoSesion(req, admin.uid);
    if (estado.valida && req.query.latido) renovarSesion(res, estado.datos);
    return res.status(200).json({
      ok: true,
      email: admin.email,
      dosFactores: estado.valida,
      motivo: estado.valida ? null : estado.motivo,
      inactividadMs: INACTIVIDAD_MS,
      configurado: Boolean(process.env.ADMIN_TOTP_SECRET),
    });
  }

  if (accion === 'salir') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
    res.setHeader('Set-Cookie', cabeceraBorrarCookie());
    await registrarAuditoria({ accion: 'salida', email: admin.email });
    return res.status(200).json({ ok: true });
  }

  if (accion === 'verificar') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
    if (!process.env.ADMIN_TOTP_SECRET) {
      return res
        .status(503)
        .json({ ok: false, error: 'El segundo factor no está configurado (ADMIN_TOTP_SECRET).' });
    }
    const permitido = await checkRateLimitAsync(req, res, {
      prefix: 'admin_2fa',
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!permitido) return; // el limitador ya respondió 429

    const codigo = String(leerCuerpo(req).codigo || '').trim();
    let resultado = null;
    try {
      resultado = await validarCodigo(codigo);
    } catch (e) {
      console.error('[admin:2fa] Error validando código:', e.message);
      return res.status(503).json({ ok: false, error: 'No se pudo validar el código. Intenta de nuevo.' });
    }

    if (resultado === 'totp' || resultado === 'respaldo') {
      res.setHeader('Set-Cookie', cabeceraCookie(crearSesion(admin.uid)));
      await registrarAuditoria({ accion: 'ingreso_2fa', email: admin.email, detalle: { metodo: resultado } });
      return res.status(200).json({ ok: true, metodo: resultado });
    }

    await registrarAuditoria({
      accion: 'codigo_2fa_rechazado',
      email: admin.email,
      detalle: { motivo: resultado || 'incorrecto' },
    });
    const error =
      resultado === 'reutilizado'
        ? 'Ese código ya se usó. Espera el siguiente de la app.'
        : 'Código incorrecto.';
    return res.status(401).json({ ok: false, error });
  }

  return res.status(400).json({ ok: false, error: 'Acción no válida.' });
};
