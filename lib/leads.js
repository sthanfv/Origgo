const fs = require('fs');
const path = require('path');

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

function limpiarCacheLeads() {
  cacheLeads = null;
}

module.exports = {
  obtenerLeadPorId,
  limpiarCacheLeads
};
