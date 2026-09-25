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
 */
const leadsHandler = require('../lib/admin/leads');
const configHandler = require('../lib/admin/config');

async function handler(req, res) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || (urlPath.endsWith('/config') ? 'config' : 'leads');

  if (action === 'config') {
    return configHandler(req, res);
  }
  return leadsHandler(req, res);
}

module.exports = handler;
