/**
 * Cargador resiliente de variables de entorno para scripts y funciones de API
 * Origgo Intelligence — Arquitectura de Configuración Única
 */
const fs = require('fs');
const path = require('path');

const DEV_DEFAULTS = {
  LEADS_ENCRYPTION_KEY: 'cf5e87913d4cf975ab463ada86e9ce905b9d5306c5188af3f8a074159cbf9a2c',
  LEADS_KEY_VERSION: 'v1',
  JWT_SECRET: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232',
  WOMPI_ENV: 'sandbox',
  WOMPI_PUBLIC_KEY: 'pub_test_Q5yDA9xoKdePzhSGeVe9KStXTIIOxjwW',
  WOMPI_PRIVATE_KEY: 'prv_test_local_suite_sandbox_key',
  WOMPI_INTEGRITY_SECRET: 'test_integrity_local_suite',
  WOMPI_EVENTS_SECRET: 'test_events_local_suite',
  VAPID_PUBLIC_KEY: 'BHlbHeWf45vx23JfYRh3kfTiICAj_m8KqX1DXSD7PwPL3-J_VHzjOovg9eF_4hbydbUuMutXnGJa6hoOx5hCP6c',
  VAPID_PRIVATE_KEY: 'PMmZaXTD6YU5iPdqqGqsr_hlOxSvWzLkET8EADm_XkM',
  VAPID_SUBJECT: 'mailto:contacto@origgo.online',
  INGEST_SECRET_KEY: 'origgo_dev_secret_ingest_key_test_suite_2026'
};

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
    } catch (e) {}
  }

  // Si no estamos en producción forzada y no existen en entorno, usar valores seguros por defecto
  if (process.env.NODE_ENV !== 'production') {
    for (const [k, v] of Object.entries(DEV_DEFAULTS)) {
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  }

  // Mapeo automático de alias para compatibilidad
  if (process.env.FIREBASE_API_KEY && !process.env.apiKey) process.env.apiKey = process.env.FIREBASE_API_KEY;
  if (process.env.FIREBASE_AUTH_DOMAIN && !process.env.authDomain) process.env.authDomain = process.env.FIREBASE_AUTH_DOMAIN;
  if (process.env.FIREBASE_PROJECT_ID && !process.env.projectId) process.env.projectId = process.env.FIREBASE_PROJECT_ID;
  if (process.env.FIREBASE_STORAGE_BUCKET && !process.env.storageBucket) process.env.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (process.env.FIREBASE_MESSAGING_SENDER_ID && !process.env.messagingSenderId) process.env.messagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID;
  if (process.env.FIREBASE_APP_ID && !process.env.appId) process.env.appId = process.env.FIREBASE_APP_ID;
}

loadEnv();

/**
 * Exige una variable de entorno.
 * En producción rechaza credenciales de prueba, EXCEPTO cuando
 * WOMPI_ENV=sandbox indica que el comercio opera deliberadamente en modo de pruebas.
 * Los fallbacks de test solo aplican con NODE_ENV=test.
 */
function requireEnv(name, options = {}) {
  let value = (process.env[name] || '').trim();
  if (!value) {
    if (process.env.NODE_ENV === 'test' && options.testFallback) {
      return options.testFallback;
    }
    if (process.env.NODE_ENV !== 'production' && DEV_DEFAULTS[name]) {
      return DEV_DEFAULTS[name];
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
