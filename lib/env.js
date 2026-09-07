/**
 * Cargador resiliente de variables de entorno para scripts y funciones de API
 * Origgo Intelligence — Arquitectura de Configuración Única
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
            process.env[key] = val;
          }
        }
      });
      // Mapeo automático de alias para compatibilidad
      if (process.env.FIREBASE_API_KEY && !process.env.apiKey) process.env.apiKey = process.env.FIREBASE_API_KEY;
      if (process.env.FIREBASE_AUTH_DOMAIN && !process.env.authDomain) process.env.authDomain = process.env.FIREBASE_AUTH_DOMAIN;
      if (process.env.FIREBASE_PROJECT_ID && !process.env.projectId) process.env.projectId = process.env.FIREBASE_PROJECT_ID;
      if (process.env.FIREBASE_STORAGE_BUCKET && !process.env.storageBucket) process.env.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
      if (process.env.FIREBASE_MESSAGING_SENDER_ID && !process.env.messagingSenderId) process.env.messagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID;
      if (process.env.FIREBASE_APP_ID && !process.env.appId) process.env.appId = process.env.FIREBASE_APP_ID;
    } catch (e) {}
  }
}

loadEnv();

/**
 * Exige una variable de entorno.
 * En producción rechaza credenciales de prueba, EXCEPTO cuando
 * WOMPI_ENV=sandbox indica que el comercio opera deliberadamente en modo de pruebas.
 * Los fallbacks de test solo aplican con NODE_ENV=test.
 */
function requireEnv(name, options = {}) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    if (process.env.NODE_ENV === 'test' && options.testFallback) {
      return options.testFallback;
    }
    throw new Error(`CONFIGURACION_INSEGURA: falta ${name}`);
  }
  // Solo rechazar credenciales test_* cuando estamos en producción real
  // y el entorno de Wompi también es producción (no sandbox)
  const esProduccion = process.env.NODE_ENV === 'production';
  const wompiSandbox = (process.env.WOMPI_ENV || 'sandbox').toLowerCase() === 'sandbox';
  const esCredencialDePrueba = /test_|^prv_test_|^pub_test_/.test(value);

  if (esProduccion && esCredencialDePrueba && !wompiSandbox) {
    throw new Error(`CONFIGURACION_INSEGURA: ${name} usa credenciales de prueba en entorno de producción`);
  }
  return value;
}

module.exports = { loadEnv, requireEnv };
