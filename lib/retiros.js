/**
 * 🛡️ Solicitudes de retiro de anuncios (Habeas Data — Ley 1581 de 2012).
 *
 * Cada solicitud queda en Firestore `solicitudes_retiro` con un radicado (ej. HD-20260925-7KQ2),
 * un estado y el plazo legal de respuesta: 15 días hábiles para reclamos (art. 15).
 *
 * Estados: `recibida` → (`resuelta` | `rechazada`).
 * Retiro preventivo: si la solicitud identifica el anuncio de forma exacta (referencia, enlace
 * original o celular), se oculta de inmediato mientras el administrador la revisa (estándar de
 * "notice and takedown"). Si solo trae datos aproximados, no se oculta nada: el panel muestra
 * los candidatos para que el administrador decida.
 *
 * Minimización de datos: del celular del anuncio solo se guarda la huella y los 2 últimos
 * dígitos (para reconocerlo en el panel); no se guarda la IP.
 */
const crypto = require('crypto');
const db = require('./db');
const { invalidarCache } = require('./cache');
const { invalidarCatalogo, desactivarLeads } = require('./catalogo');

const COLECCION = 'solicitudes_retiro';
const DIAS_HABILES_PLAZO = 15;
const MAX_RETIROS_POR_SOLICITUD = 20;
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para dictarlo sin errores

function coleccion() {
  return db.coleccion(COLECCION);
}

/** Radicado legible y no adivinable: HD-AAAAMMDD-XXXX (hora de Colombia). */
function generarRadicado(ahora = Date.now()) {
  const fecha = new Date(ahora - 5 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
  const bytes = crypto.randomBytes(4);
  const sufijo = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
  return `HD-${fecha}-${sufijo}`;
}

/**
 * Fecha límite sumando días hábiles (lunes a viernes). No descuenta festivos: así el plazo
 * nunca queda más largo que el legal.
 */
function sumarDiasHabiles(desdeMs, dias = DIAS_HABILES_PLAZO) {
  const f = new Date(desdeMs);
  let contados = 0;
  while (contados < dias) {
    f.setUTCDate(f.getUTCDate() + 1);
    const dia = f.getUTCDay();
    if (dia !== 0 && dia !== 6) contados++;
  }
  return f.getTime();
}

/** Oculta inmuebles y los agrega a la lista negra (el cazador deja de publicarlos). */
async function retirarInmuebles(ids, { radicado, motivo }) {
  const unicos = Array.from(new Set(ids.map(String))).slice(0, MAX_RETIROS_POR_SOLICITUD);
  for (const id of unicos) await db.addBlacklistedLead(id, { reason: motivo, radicado });
  await desactivarLeads(unicos);
  await Promise.all([invalidarCache('lista-negra'), invalidarCatalogo()]);
  return unicos;
}

/** Deshace un retiro (solicitud rechazada): sale de la lista negra y vuelve a mostrarse. */
async function restaurarInmuebles(ids) {
  const ref = db.leadsRef;
  for (const id of ids) {
    await db.removeBlacklistedLead(id);
    const doc = await ref.doc(String(id)).get();
    if (doc.exists) await ref.doc(String(id)).set({ activo: true, updatedAt: new Date().toISOString() }, { merge: true });
  }
  await Promise.all([invalidarCache('lista-negra'), invalidarCatalogo()]);
}

async function guardarSolicitud(solicitud) {
  await coleccion().doc(solicitud.radicado).set(solicitud);
  return solicitud;
}

async function obtenerSolicitud(radicado) {
  const doc = await coleccion().doc(String(radicado)).get();
  return doc.exists ? doc.data() : null;
}

/** Últimas solicitudes, las más recientes primero. */
async function listarSolicitudes(limite = 100) {
  const col = coleccion();
  const snap = typeof col.orderBy === 'function' ? await col.orderBy('creada_ms', 'desc').limit(limite).get() : await col.get();
  const lista = snap.docs.map((d) => d.data());
  return lista.sort((a, b) => (b.creada_ms || 0) - (a.creada_ms || 0)).slice(0, limite);
}

module.exports = {
  COLECCION,
  DIAS_HABILES_PLAZO,
  MAX_RETIROS_POR_SOLICITUD,
  generarRadicado,
  sumarDiasHabiles,
  retirarInmuebles,
  restaurarInmuebles,
  guardarSolicitud,
  obtenerSolicitud,
  listarSolicitudes,
};
