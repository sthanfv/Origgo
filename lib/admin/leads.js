/**
 * 🗂️ API del panel de administración — catálogo de inmuebles.
 *
 * Firestore es la fuente de la verdad (colección `leads`). Este endpoint permite
 * administrar el catálogo desde el panel, sin depender de archivos subidos por commit.
 *
 *   GET     → lista TODOS los inmuebles (incluye los ocultos, `activo: false`).
 *   PATCH   → actualiza un inmueble: ocultar/mostrar, destacar, ordenar o editar campos.
 *   DELETE  → elimina un inmueble.
 *
 * Todo exige una sesión de administrador (Google) verificada. Nunca se expone el contacto.
 */
const { aplicarCorsSeguro } = require('../cors');
const db = require('../db');
const { verificarAdmin } = require('../admin-auth');

/** Campos que el administrador puede editar a mano (lista blanca; jamás el contacto). */
const CAMPOS_EDITABLES = new Set([
  'activo',
  'destacado',
  'orden',
  'titulo',
  'titulo_en',
  'precio',
  'precio_raw',
  'ciudad',
  'barrio',
  'ubicacion',
  'tipo_operacion',
  'tipo_inmueble',
  'imagen',
  'enlace',
  'rebaja',
  'urgencia',
  'detalles',
]);

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // El panel nunca se cachea.
  res.setHeader('Cache-Control', 'no-store');

  let admin;
  try {
    admin = await verificarAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({ ok: false, error: e.message });
  }

  const ref = db.leadsRef;
  if (!ref) return res.status(503).json({ ok: false, error: 'Base de datos no disponible.' });

  try {
    if (req.method === 'GET') {
      const snap = await ref.orderBy('timestamp_ms', 'desc').limit(500).get();
      const leads = [];
      snap.forEach((doc) => {
        // El contacto nunca sale del servidor, ni siquiera hacia el panel.
        const { contacto_cifrado, telefono_bloqueado, ...resto } = doc.data();
        void contacto_cifrado;
        void telefono_bloqueado;
        leads.push({ ...resto, id: doc.id });
      });
      return res.status(200).json({ ok: true, total: leads.length, leads });
    }

    if (req.method === 'PATCH') {
      const { id, cambios } = req.body || {};
      if (!id || !cambios || typeof cambios !== 'object') {
        return res.status(400).json({ ok: false, error: 'Faltan id o cambios.' });
      }
      const limpio = {};
      for (const [clave, valor] of Object.entries(cambios)) {
        if (CAMPOS_EDITABLES.has(clave)) limpio[clave] = valor;
      }
      if (Object.keys(limpio).length === 0) {
        return res.status(400).json({ ok: false, error: 'Ningún campo editable en la solicitud.' });
      }
      limpio.editado_por = admin.email;
      limpio.editado_ms = Date.now();
      await ref.doc(String(id)).set(limpio, { merge: true });
      return res.status(200).json({ ok: true, id, actualizado: Object.keys(limpio) });
    }

    if (req.method === 'DELETE') {
      const id = (req.query && req.query.id) || (req.body && req.body.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Falta el id.' });
      await ref.doc(String(id)).delete();
      return res.status(200).json({ ok: true, id, eliminado: true });
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  } catch (err) {
    console.error('[admin:leads] Error:', err.message);
    return res.status(500).json({ ok: false, error: 'Error interno del panel.' });
  }
};
