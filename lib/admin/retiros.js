/**
 * 🛡️ API del panel — solicitudes de retiro (Habeas Data) y buscador de inmuebles.
 *
 *   GET  /api/admin/retiros            → últimas solicitudes (la más reciente primero).
 *   GET  /api/admin/buscar?q=...       → busca inmuebles por referencia, enlace, celular o texto.
 *   POST /api/admin/retiros            → resuelve una solicitud:
 *        { radicado, accion: 'retirar', ids: [...], nota? }  oculta y bloquea los inmuebles.
 *        { radicado, accion: 'rechazar', nota? }             revierte el retiro preventivo.
 *   POST /api/admin/reindexar { cursor? } → reconstruye el índice de búsqueda por tandas
 *        de 200 inmuebles (para los guardados antes del índice o tras rotar la clave).
 *
 * Todo exige Google + ADMIN_EMAILS + custom claim `admin` + segundo factor (lib/admin/acceso.js)
 * y queda en la auditoría.
 */
const { aplicarCorsSeguro } = require('../cors');
const db = require('../db');
const { exigirAdminCon2FA } = require('./acceso');
const { registrarAuditoria } = require('./auditoria');
const { esErrorDeCuota } = require('../cache');
const { buscarInmuebles } = require('../busqueda-inmuebles');
const { camposIndice } = require('../indice-busqueda');
const { decryptLeadContact, obtenerKeyRingLeads } = require('../crypto');
const retiros = require('../retiros');

const MENSAJE_CUOTA =
  'Se agotó la cuota diaria gratuita de Firestore. Se restablece a las 2:00 a. m. (hora de Colombia).';
const TANDA_REINDEXAR = 200;

function mismosCampos(a, b) {
  return JSON.stringify(a || null) === JSON.stringify(b || null);
}

/** Reconstruye el índice de una tanda. Solo escribe los documentos cuyo índice cambió. */
async function reindexarTanda(cursor) {
  const ref = db.leadsRef;
  let snap;
  if (typeof ref.orderBy === 'function' && ref.firestore) {
    const { FieldPath } = require('firebase-admin/firestore');
    let consulta = ref.orderBy(FieldPath.documentId()).limit(TANDA_REINDEXAR);
    if (cursor) consulta = consulta.startAfter(String(cursor));
    snap = await consulta.get();
  } else {
    snap = await ref.get(); // base en memoria (pruebas): todo en una tanda
  }

  const llaves = obtenerKeyRingLeads().keys;
  const cambios = [];
  for (const doc of snap.docs) {
    const datos = doc.data();
    const contacto = decryptLeadContact(datos.contacto_cifrado, llaves) || {};
    const campos = camposIndice({ ...datos, id: doc.id }, contacto);
    const iguales =
      mismosCampos(datos.indice_busqueda, campos.indice_busqueda) &&
      mismosCampos(datos.enlace_huella, campos.enlace_huella) &&
      mismosCampos(datos.telefono_huella, campos.telefono_huella);
    if (!iguales) cambios.push({ id: doc.id, campos });
  }

  if (ref.firestore && typeof ref.firestore.batch === 'function') {
    for (let i = 0; i < cambios.length; i += 400) {
      const lote = ref.firestore.batch();
      for (const c of cambios.slice(i, i + 400)) lote.set(ref.doc(c.id), c.campos, { merge: true });
      await lote.commit();
    }
  } else {
    for (const c of cambios) await ref.doc(c.id).set(c.campos, { merge: true });
  }

  const completo = !ref.firestore || snap.docs.length < TANDA_REINDEXAR;
  return {
    revisados: snap.docs.length,
    actualizados: cambios.length,
    siguiente: completo ? null : snap.docs[snap.docs.length - 1].id,
  };
}

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 'no-store');

  let admin;
  try {
    admin = await exigirAdminCon2FA(req, res);
  } catch (e) {
    return res.status(e.status || 401).json({ ok: false, error: e.message, codigo: e.codigo });
  }

  if (!db.leadsRef) return res.status(503).json({ ok: false, error: MENSAJE_CUOTA, codigo: 'CUOTA_AGOTADA' });
  const accion = (req.query && req.query.action) || 'retiros';
  const body = req.body || {};

  try {
    if (accion === 'buscar' && req.method === 'GET') {
      const r = await buscarInmuebles(req.query.q || '');
      return res.status(200).json({ ok: true, ...r });
    }

    if (accion === 'reindexar' && req.method === 'POST') {
      const r = await reindexarTanda(body.cursor || null);
      if (!r.siguiente) {
        await db.coleccion('admin_estado').doc('indice').set({ completo_ms: Date.now(), por: admin.email });
        await registrarAuditoria({ accion: 'reindexar_busqueda', email: admin.email, detalle: { ultimaTanda: r } });
      }
      return res.status(200).json({ ok: true, ...r });
    }

    if (accion === 'retiros' && req.method === 'GET') {
      return res.status(200).json({ ok: true, solicitudes: await retiros.listarSolicitudes() });
    }

    if (accion === 'retiros' && req.method === 'POST') {
      const { radicado, nota } = body;
      const solicitud = radicado ? await retiros.obtenerSolicitud(radicado) : null;
      if (!solicitud) return res.status(404).json({ ok: false, error: 'Solicitud no encontrada.' });
      const notaLimpia = String(nota || '').replace(/[<>]/g, '').slice(0, 500);
      const resolucion = { accion: body.accion, por: admin.email, ms: Date.now(), nota: notaLimpia || null };

      if (body.accion === 'retirar') {
        const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
        if (ids.length === 0) return res.status(400).json({ ok: false, error: 'Elige al menos un inmueble.' });
        const retirados = await retiros.retirarInmuebles(ids, { radicado, motivo: solicitud.motivo });
        const actualizada = {
          ...solicitud,
          estado: 'resuelta',
          retirados: Array.from(new Set([...(solicitud.retiro_preventivo || []), ...retirados])),
          resolucion,
        };
        await retiros.guardarSolicitud(actualizada);
        await registrarAuditoria({ accion: 'retiro_aprobado', email: admin.email, detalle: { radicado, ids: retirados } });
        return res.status(200).json({ ok: true, solicitud: actualizada });
      }

      if (body.accion === 'rechazar') {
        const preventivos = solicitud.retiro_preventivo || [];
        if (preventivos.length) await retiros.restaurarInmuebles(preventivos);
        const actualizada = { ...solicitud, estado: 'rechazada', restaurados: preventivos, resolucion };
        await retiros.guardarSolicitud(actualizada);
        await registrarAuditoria({ accion: 'retiro_rechazado', email: admin.email, detalle: { radicado, restaurados: preventivos } });
        return res.status(200).json({ ok: true, solicitud: actualizada });
      }

      return res.status(400).json({ ok: false, error: 'Acción no válida (retirar o rechazar).' });
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  } catch (err) {
    if (esErrorDeCuota(err) || (err && err.status === 503)) {
      return res.status(503).json({ ok: false, error: MENSAJE_CUOTA, codigo: 'CUOTA_AGOTADA' });
    }
    console.error('[admin:retiros] Error:', err.message);
    return res.status(500).json({ ok: false, error: 'Error interno del panel.' });
  }
};

module.exports.reindexarTanda = reindexarTanda;
