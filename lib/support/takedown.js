/**
 * 🛡️ SOLICITUD DE RETIRO DE ANUNCIO (NOTICE & TAKEDOWN / HABEAS DATA — LEY 1581 DE 2012)
 * POST /api/support/takedown -> lib/support/takedown.js
 *
 * Quien pide el retiro debe identificar el inmueble con al menos UNA de estas opciones
 * (el texto libre como "borren mi casa" no permite saber cuál es):
 *   - referencia o enlace del anuncio en Origgo;
 *   - enlace del anuncio original (Finca Raíz, Metrocuadrado…);
 *   - celular que aparece en el anuncio;
 *   - o, en su defecto, ciudad + barrio o descripción (queda para revisión manual).
 * Y debe identificarse: nombre, correo para responder, relación con el inmueble y aceptar la
 * declaración de veracidad y el tratamiento de estos datos solo para atender la solicitud.
 *
 * Respuesta: radicado + fecha límite (15 días hábiles). Si la identificación es exacta, el
 * anuncio se oculta de inmediato (retiro preventivo) y el administrador lo confirma o lo
 * revierte desde el panel. Ver lib/retiros.js.
 */

const { checkRateLimitAsync } = require('../rate-limiter');
const { aplicarCorsSeguro } = require('../cors');
const { extraerIdentificadorInmueble, buscarExactas, buscarTexto } = require('../busqueda-inmuebles');
const { huellaTelefono, telefonoNormalizado } = require('../indice-busqueda');
const retiros = require('../retiros');

const RELACIONES = new Set(['propietario', 'apoderado', 'arrendatario', 'familiar', 'otro']);
const CORREO = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const ES_URL = /^https?:\/\//i;

/** Texto corto y sin etiquetas. */
function limpio(valor, max) {
  return String(valor || '')
    .replace(/[<>{}]/g, '')
    .trim()
    .slice(0, max);
}

function mensaje(lang, es, en) {
  return lang === 'en' ? en : es;
}

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METODO_NO_PERMITIDO', message: 'Método no permitido. Utilice POST.' });
  }

  // 🛡️ Límite: máx. 5 solicitudes de retiro por hora por IP
  if (!(await checkRateLimitAsync(req, res, { prefix: 'support_takedown', maxRequests: 5, windowMs: 60 * 60 * 1000 }))) {
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }
    body = body || {};

    const lang = (req.headers['accept-language'] || '').toLowerCase().startsWith('en') ? 'en' : 'es';

    // Identificación del inmueble (se aceptan también los nombres de campo del formulario anterior).
    const referencia = limpio(body.referencia || body.leadId || body.id || body.inmuebleId || body.url, 300);
    const enlaceOriginal = limpio(body.enlace || body.enlaceOriginal, 300);
    const telefono = telefonoNormalizado(limpio(body.telefono || body.phone || body.celular, 30));
    const ciudad = limpio(body.ciudad, 60);
    const barrio = limpio(body.barrio, 80);
    const descripcion = limpio(body.descripcion, 300);

    // Datos de quien pide el retiro y motivo.
    const nombre = limpio(body.nombre, 80);
    const correo = limpio(body.correo || body.email, 254).toLowerCase();
    const relacion = RELACIONES.has(body.relacion) ? body.relacion : 'otro';
    const motivo = limpio(body.motivo || body.reason || body.razon || 'solicitud_propietario', 300);
    const acepta = body.acepta === true;

    const hayAproximados = Boolean(ciudad && (barrio || descripcion));
    if (!referencia && !enlaceOriginal && !telefono && !hayAproximados) {
      return res.status(400).json({
        ok: false,
        error: 'LEAD_ID_REQUERIDO',
        message: mensaje(
          lang,
          'Indica cómo identificar el anuncio: su enlace o referencia, el enlace del anuncio original, el celular que aparece en él, o la ciudad y el barrio.',
          'Tell us how to identify the listing: its link or reference, the original listing link, the phone shown on it, or the city and neighborhood.'
        ),
      });
    }

    const identificadores = [];
    for (const texto of [referencia, enlaceOriginal]) {
      if (!texto) continue;
      const id = extraerIdentificadorInmueble(texto);
      if (id) identificadores.push(id);
    }
    // Solo se dio texto libre en la referencia, sin nada más que permita ubicar el anuncio.
    if (referencia && identificadores.length === 0 && !enlaceOriginal && !telefono && !hayAproximados) {
      return res.status(400).json({
        ok: false,
        error: 'LEAD_ID_INVALIDO',
        message: mensaje(
          lang,
          'No fue posible identificar el anuncio con ese texto. Pega el enlace del anuncio o su referencia (ej.: lead-inm-123).',
          'Could not identify the listing from that text. Paste the listing link or its reference (e.g., lead-inm-123).'
        ),
      });
    }

    if (nombre.length < 2 || !CORREO.test(correo) || !acepta) {
      return res.status(400).json({
        ok: false,
        error: 'DATOS_SOLICITANTE_REQUERIDOS',
        message: mensaje(
          lang,
          'Escribe tu nombre y un correo para responderte, y acepta la declaración.',
          'Enter your name and an email to reply to, and accept the declaration.'
        ),
      });
    }

    // Coincidencias exactas → retiro preventivo inmediato. Aproximadas → candidatos para revisión.
    const enlaceParaHuella = ES_URL.test(enlaceOriginal) ? enlaceOriginal : ES_URL.test(referencia) ? referencia : '';
    const exactas = await buscarExactas({ ids: identificadores, enlace: enlaceParaHuella, telefono });
    const candidatos =
      exactas.length === 0 && hayAproximados
        ? (await buscarTexto(`${ciudad} ${barrio} ${descripcion}`, 10)).map((c) => c.id)
        : [];

    const ahora = Date.now();
    const radicado = retiros.generarRadicado(ahora);
    // También se bloquean los identificadores del portal aunque el anuncio aún no esté en
    // Origgo: así el cazador no lo publica en el futuro.
    const aRetirar = [...exactas.map((e) => e.id), ...identificadores];
    const retirados = aRetirar.length ? await retiros.retirarInmuebles(aRetirar, { radicado, motivo }) : [];

    const solicitud = {
      radicado,
      estado: 'recibida',
      creada_ms: ahora,
      vence_ms: retiros.sumarDiasHabiles(ahora),
      solicitante: { nombre, correo, relacion },
      motivo,
      identificacion: {
        referencia: referencia || null,
        enlace_original: enlaceOriginal || null,
        telefono_huella: telefono ? huellaTelefono(telefono) : null,
        telefono_final: telefono ? telefono.slice(-2) : null,
        ciudad: ciudad || null,
        barrio: barrio || null,
        descripcion: descripcion || null,
      },
      coincidencias: exactas.map((e) => e.id),
      candidatos,
      retiro_preventivo: retirados,
      lang,
    };
    await retiros.guardarSolicitud(solicitud);

    const fechaLimite = new Date(solicitud.vence_ms).toISOString().slice(0, 10);
    return res.status(200).json({
      ok: true,
      radicado,
      vence: fechaLimite,
      retirados: retirados.length,
      leadId: retirados[0] || null,
      estado: retirados.length ? 'retirado_preventivamente' : 'en_revision',
      message: retirados.length
        ? mensaje(
            lang,
            `Solicitud ${radicado} recibida. Ocultamos el anuncio mientras la revisamos; te responderemos a más tardar el ${fechaLimite}.`,
            `Request ${radicado} received. The listing is hidden while we review it; we will reply by ${fechaLimite}.`
          )
        : mensaje(
            lang,
            `Solicitud ${radicado} recibida. La revisaremos para ubicar el anuncio y te responderemos a más tardar el ${fechaLimite}.`,
            `Request ${radicado} received. We will review it to locate the listing and reply by ${fechaLimite}.`
          ),
    });
  } catch (err) {
    console.error('[support/takedown] Error:', err.message);
    const status = err && err.status === 503 ? 503 : 500;
    return res.status(status).json({
      ok: false,
      error: status === 503 ? 'SERVICIO_NO_DISPONIBLE' : 'ERROR_SERVIDOR',
      message: 'No fue posible registrar la solicitud de retiro. Intenta de nuevo en unos minutos.',
    });
  }
};

module.exports.extraerIdentificadorInmueble = extraerIdentificadorInmueble;
