const fs = require('fs');
const path = require('path');
const db = require('./db');

const DATASETS = [
  'inmobiliario.json',
  'vehiculos.json'
];

let cacheLeads = null;

function cargarIndiceLeads() {
  const indice = new Map();
  const dataDir = path.join(__dirname, '..', 'data');

  for (const fileName of DATASETS) {
    const fullPath = path.join(dataDir, fileName);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const dataset = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const leads = Array.isArray(dataset.leads) ? dataset.leads : [];
      for (const lead of leads) {
        if (lead && lead.id) {
          indice.set(String(lead.id), { ...lead, dataset: fileName });
        }
      }
    } catch (err) {
      console.warn(`[leads] No se pudo indexar ${fileName}:`, err.message);
    }
  }

  return indice;
}

function obtenerLeadPorId(leadId) {
  if (!cacheLeads) {
    cacheLeads = cargarIndiceLeads();
  }
  return cacheLeads.get(String(leadId || '').trim()) || null;
}

/**
 * Obtiene un lead consultando primero la base de datos (Firestore o local_db.json)
 * como fuente de verdad, con fallback transparente al catálogo estático en disco.
 * 
 * @param {string} leadId - Identificador del lead
 * @returns {Promise<object|null>}
 */
async function obtenerLeadPorIdAsync(leadId) {
  const idLimpio = String(leadId || '').trim();
  if (!idLimpio) return null;

  // 1. Buscar en la Base de Datos (Firestore o local_db.json)
  try {
    if (db.leadsRef) {
      const doc = await db.leadsRef.doc(idLimpio).get();
      if (doc && doc.exists) {
        return { ...doc.data(), id: idLimpio };
      }
    }
  } catch (err) {
    console.warn('[leads] Fallo al consultar BD para lead:', err.message);
  }

  // 2. Fallback al catálogo estático si no estaba en la BD
  return obtenerLeadPorId(idLimpio);
}

function limpiarCacheLeads() {
  cacheLeads = null;
}

module.exports = {
  obtenerLeadPorId,
  obtenerLeadPorIdAsync,
  limpiarCacheLeads
};
