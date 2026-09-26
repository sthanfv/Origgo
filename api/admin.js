/**
 * 🗂️ ENDPOINT SERVERLESS UNIFICADO DEL PANEL DE ADMINISTRACIÓN
 * Origgo Intelligence — Arquitectura Serverless Consolidada (Hobby Plan: máx. 12 funciones)
 *
 * Enruta según acción a:
 * - /api/admin/leads  -> lib/admin/leads.js  (catálogo en Firestore: listar, ocultar, editar, borrar)
 * - /api/admin/config -> lib/admin/config.js (configuración de la vitrina)
 * - /api/admin/estado | /verificar | /salir -> lib/admin/dos-factores.js (segundo factor TOTP)
 * - /api/admin/retiros | /buscar | /reindexar -> lib/admin/retiros.js (Habeas Data y buscador)
 * - /api/admin/resumen -> lib/admin/resumen.js (cifras reales y alertas de la pantalla de inicio)
 * - /api/admin/clientes | /cliente -> lib/admin/clientes.js (cuentas, créditos y planes)
 * - /api/admin/pagos | /pago -> lib/admin/pagos.js (órdenes de Wompi y conciliación)
 *
 * Las rutas /api/admin/<acción> llegan aquí por la regla de reenlace de vercel.json.
 * Capas de seguridad: Google + ADMIN_EMAILS + custom claim `admin` + TOTP (ver lib/admin/acceso.js).
 *
 * Los manejadores se cargan al primer uso y un fallo de carga se reporta con un código corto
 * (sin rutas ni datos internos) en vez de tumbar la función completa.
 */
let leadsHandler = null;
let configHandler = null;
let dosFactoresHandler = null;
let retirosHandler = null;
let resumenHandler = null;
let clientesHandler = null;
let pagosHandler = null;
let errorCarga = null;

function cargarManejadores() {
  if (leadsHandler || errorCarga) return;
  try {
    leadsHandler = require('../lib/admin/leads');
    configHandler = require('../lib/admin/config');
    dosFactoresHandler = require('../lib/admin/dos-factores');
    retirosHandler = require('../lib/admin/retiros');
    resumenHandler = require('../lib/admin/resumen');
    clientesHandler = require('../lib/admin/clientes');
    pagosHandler = require('../lib/admin/pagos');
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
  const action = req.query?.action || urlPath.split('/')[3] || 'leads';

  if (action === 'config') {
    return configHandler(req, res);
  }
  if (action === 'estado' || action === 'verificar' || action === 'salir' || action === 'codigo-correo') {
    req.query = { ...(req.query || {}), action };
    return dosFactoresHandler(req, res);
  }
  if (action === 'resumen') {
    return resumenHandler(req, res);
  }
  if (action === 'clientes' || action === 'cliente') {
    req.query = { ...(req.query || {}), action };
    return clientesHandler(req, res);
  }
  if (action === 'pagos' || action === 'pago') {
    req.query = { ...(req.query || {}), action };
    return pagosHandler(req, res);
  }
  if (action === 'retiros' || action === 'buscar' || action === 'reindexar') {
    req.query = { ...(req.query || {}), action };
    return retirosHandler(req, res);
  }
  return leadsHandler(req, res);
}

module.exports = handler;
