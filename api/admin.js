/**
 * 🗂️ ENDPOINT SERVERLESS UNIFICADO DEL PANEL DE ADMINISTRACIÓN
 * Origgo Intelligence — Arquitectura Serverless Consolidada (Hobby Plan: máx. 12 funciones)
 *
 * Enruta según acción a:
 * - /api/admin/leads  -> lib/admin/leads.js  (catálogo en Firestore: listar, ocultar, editar, borrar)
 * - /api/admin/config -> lib/admin/config.js (configuración de la vitrina)
 *
 * Las rutas /api/admin/leads y /api/admin/config llegan aquí por reglas de reenlace en vercel.json.
 * Ambos manejadores exigen sesión de administrador (Google) verificada.
 *
 * Los manejadores se cargan al primer uso y un fallo de carga se reporta con un código corto
 * (sin rutas ni datos internos) en vez de tumbar la función completa.
 */
let leadsHandler = null;
let configHandler = null;
let errorCarga = null;

function cargarManejadores() {
  if (leadsHandler || errorCarga) return;
  try {
    leadsHandler = require('../lib/admin/leads');
    configHandler = require('../lib/admin/config');
  } catch (e) {
    const faltante = /Cannot find module '([^']+)'/.exec(e && e.message ? e.message : '');
    errorCarga = {
      codigo: (e && (e.code || e.name)) || 'ERROR_CARGA',
      modulo: faltante ? faltante[1].split(/[\\/]node_modules[\\/]/).pop() : undefined,
    };
    console.error('[admin] No se pudieron cargar los manejadores del panel:', e);
  }
}

async function handler(req, res) {
  cargarManejadores();
  if (errorCarga) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ ok: false, error: 'Panel no disponible.', ...errorCarga });
  }

  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || (urlPath.endsWith('/config') ? 'config' : 'leads');

  if (action === 'config') {
    return configHandler(req, res);
  }
  return leadsHandler(req, res);
}

module.exports = handler;
