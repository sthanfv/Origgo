/**
 * 📦 GESTOR DE SUSCRIPCIONES WEB PUSH (PERSISTENCIA Y DEDUPLICACIÓN)
 * lib/push-subscriptions.js
 * 
 * Almacena suscripciones push de navegadores con soporte híbrido:
 * - Firestore (si está configurado)
 * - Fallback local persistente en data/push_subscriptions.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getFirestoreInstance } = require('./db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOCAL_SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'push_subscriptions.json');

// Memoria volátil para serverless
const memorySubscriptions = new Map();

/**
 * Genera un ID determinista a partir de la URL del endpoint.
 * @param {string} endpoint
 * @returns {string}
 */
function hashEndpoint(endpoint) {
  return crypto.createHash('sha256').update(String(endpoint)).digest('hex').substring(0, 32);
}

/**
 * Carga suscripciones locales del archivo si existe.
 * @returns {Array<object>}
 */
function cargarSuscripcionesLocales() {
  try {
    if (!fs.existsSync(LOCAL_SUBSCRIPTIONS_FILE)) return [];
    const raw = fs.readFileSync(LOCAL_SUBSCRIPTIONS_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch (_) {
    return [];
  }
}

/**
 * Guarda suscripción en almacenamiento local o memoria.
 * @param {object} subData
 */
function guardarSuscripcionLocal(subData) {
  const subId = hashEndpoint(subData.endpoint);
  memorySubscriptions.set(subId, subData);

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const subs = cargarSuscripcionesLocales();
    const idx = subs.findIndex(s => hashEndpoint(s.endpoint) === subId);
    if (idx >= 0) {
      subs[idx] = subData;
    } else {
      subs.push(subData);
    }
    fs.writeFileSync(LOCAL_SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2), 'utf8');
  } catch (_) {
    // En entornos Serverless con disco de solo lectura, la memoria volátil retiene el dato
  }
}

/**
 * Registra o actualiza una suscripción Web Push.
 * @param {object} subscription - { endpoint, keys: { p256dh, auth } }
 * @param {object} [metadata] - { ciudad, userAgent }
 * @returns {Promise<boolean>}
 */
async function registrarSuscripcion(subscription, metadata = {}) {
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return false;
  }

  const subId = hashEndpoint(subscription.endpoint);
  const ahora = new Date().toISOString();
  const subData = {
    id: subId,
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    },
    ciudad: metadata.ciudad || 'Colombia',
    actualizadoEl: ahora,
    activo: true
  };

  const db = typeof getFirestoreInstance === 'function' ? getFirestoreInstance() : null;
  if (db) {
    try {
      await db.collection('push_subscriptions').doc(subId).set(subData, { merge: true });
      return true;
    } catch (_) {
      // Fallback a almacenamiento local si Firestore falla
    }
  }

  guardarSuscripcionLocal(subData);
  return true;
}

/**
 * Obtiene todas las suscripciones activas.
 * @returns {Promise<Array<object>>}
 */
async function obtenerSuscripcionesActivas() {
  const db = typeof getFirestoreInstance === 'function' ? getFirestoreInstance() : null;
  if (db) {
    try {
      const snap = await db.collection('push_subscriptions').where('activo', '==', true).get();
      if (!snap.empty) {
        return snap.docs.map(doc => doc.data());
      }
    } catch (_) {}
  }

  const locales = cargarSuscripcionesLocales();
  if (locales.length > 0) return locales;

  return Array.from(memorySubscriptions.values());
}

module.exports = {
  registrarSuscripcion,
  obtenerSuscripcionesActivas,
  hashEndpoint
};
