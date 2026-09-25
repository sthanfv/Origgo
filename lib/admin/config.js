/**
 * ⚙️ API del panel de administración — configuración de la vitrina.
 *
 * Guarda en Firestore (`config/showcase`) los textos y valores editables de la portada,
 * como la etiqueta y el número del contador. Fuente de la verdad en la base de datos.
 *
 *   GET → lee la configuración actual.
 *   PUT → guarda cambios (solo campos de la lista blanca).
 *
 * Exige Google + ADMIN_EMAILS + custom claim `admin` + segundo factor (TOTP) vigente.
 */
const { aplicarCorsSeguro } = require('../cors');
const db = require('../db');
const { exigirAdminCon2FA } = require('./acceso');
const { registrarAuditoria } = require('./auditoria');

/** Campos de configuración editables desde el panel. */
const CAMPOS_CONFIG = new Set(['counterLabel', 'counterValue', 'heroTitulo', 'heroSubtitulo']);

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 'no-store');

  let admin;
  try {
    admin = await exigirAdminCon2FA(req);
  } catch (e) {
    return res.status(e.status || 401).json({ ok: false, error: e.message, codigo: e.codigo });
  }

  const ref = db.leadsRef;
  if (!ref) return res.status(503).json({ ok: false, error: 'Base de datos no disponible.' });
  const docRef = ref.firestore.collection('config').doc('showcase');

  try {
    if (req.method === 'GET') {
      const doc = await docRef.get();
      return res.status(200).json({ ok: true, config: doc.exists ? doc.data() : {} });
    }

    if (req.method === 'PUT') {
      const cambios = req.body || {};
      const limpio = {};
      for (const [clave, valor] of Object.entries(cambios)) {
        if (CAMPOS_CONFIG.has(clave)) limpio[clave] = valor;
      }
      if (Object.keys(limpio).length === 0) {
        return res.status(400).json({ ok: false, error: 'Ningún campo válido en la solicitud.' });
      }
      await docRef.set(limpio, { merge: true });
      await registrarAuditoria({ accion: 'editar_vitrina', email: admin.email, detalle: { campos: Object.keys(limpio) } });
      return res.status(200).json({ ok: true, actualizado: Object.keys(limpio) });
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  } catch (err) {
    console.error('[admin:config] Error:', err.message);
    return res.status(500).json({ ok: false, error: 'Error interno del panel.' });
  }
};
