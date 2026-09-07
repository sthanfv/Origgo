/**
 * 🔏 SCRIPT DE FIRMADO DE INTEGRIDAD HMAC-SHA256 PARA ARCHIVOS DE DATOS
 * Origgo Intelligence — Garantía de Autenticidad del Scraper
 *
 * Uso (después de que el scraper genere los JSON):
 *   node scripts/sign-data.js
 *
 * Genera un archivo .sig por cada JSON en data/ con la firma HMAC-SHA256.
 * La verificación se hace exclusivamente en el backend (api/leads/unlock)
 * para que la llave secreta NUNCA se exponga al navegador.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      }
    }
  });
}

const SECRET = process.env.LEADS_ENCRYPTION_KEY;
if (!SECRET) {
  console.error('❌ LEADS_ENCRYPTION_KEY no configurada. No se puede firmar.');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATASETS = ['inmobiliario.json', 'vehiculos.json'];

let firmados = 0;

for (const archivo of DATASETS) {
  const rutaJson = path.join(DATA_DIR, archivo);
  if (!fs.existsSync(rutaJson)) {
    console.warn(`⚠️ ${archivo} no existe, se omite.`);
    continue;
  }

  const contenido = fs.readFileSync(rutaJson, 'utf8');

  // Generar firma HMAC-SHA256 del contenido completo del JSON
  const firma = crypto
    .createHmac('sha256', SECRET)
    .update(contenido)
    .digest('hex');

  // Guardar firma en archivo .sig separado
  const rutaSig = rutaJson + '.sig';
  fs.writeFileSync(rutaSig, firma, 'utf8');

  console.log(`✅ ${archivo} → firmado (${firma.substring(0, 16)}...)`);
  firmados++;
}

if (firmados > 0) {
  console.log(`\n🔏 ${firmados} archivo(s) firmado(s) con HMAC-SHA256.`);
} else {
  console.warn('⚠️ Ningún archivo fue firmado.');
}
