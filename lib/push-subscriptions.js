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
 * Normaliza texto eliminando acentos, puntuación y mayúsculas.
 * @param {string} str
 * @returns {string}
 */
function normalizarTexto(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Agrupaciones metropolitanas clave de Colombia para máxima precisión de entrega.
 */
const REGIONES_METROPOLITANAS = [
  {
    clave: 'medellin',
    alias: ['medellin', 'antioquia', 'valle de aburra', 'envigado', 'sabaneta', 'bello', 'itagui', 'la estrella', 'rionegro']
  },
  {
    clave: 'bogota',
    alias: ['bogota', 'cundinamarca', 'chia', 'cajica', 'soacha', 'cota', 'la calera', 'zipaquira', 'facatativa']
  },
  {
    clave: 'cali',
    alias: ['cali', 'valle del cauca', 'valle', 'jamundi', 'yumbo', 'palmira']
  },
  {
    clave: 'barranquilla',
    alias: ['barranquilla', 'atlantico', 'soledad', 'puerto colombia', 'malambo']
  },
  {
    clave: 'bucaramanga',
    alias: ['bucaramanga', 'santander', 'floridablanca', 'giron', 'piedecuesta']
  },
  {
    clave: 'cartagena',
    alias: ['cartagena', 'bolivar', 'turbaco']
  },
  {
    clave: 'eje cafetero',
    alias: ['eje cafetero', 'pereira', 'manizales', 'armenia', 'dosquebradas', 'risaralda', 'quindio', 'caldas']
  }
];

/**
 * Evalúa si la ciudad de una suscripción coincide con la ciudad de una alerta.
 * @param {string} ciudadSuscripcion - Preferencia elegida por el usuario
 * @param {string} ciudadAlerta - Ciudad o ubicación del nuevo inmueble
 * @returns {boolean}
 */
function coincideCiudadSuscripcion(ciudadSuscripcion, ciudadAlerta) {
  const normSub = normalizarTexto(ciudadSuscripcion);
  const normAlerta = normalizarTexto(ciudadAlerta);

  // 1. Alerta general para toda Colombia o sin ciudad específica: llega a todos
  if (!normAlerta || normAlerta === 'colombia' || normAlerta === 'todas' || normAlerta === 'all' || normAlerta === 'nacional') {
    return true;
  }

  // 2. Suscriptor configurado para recibir alertas de toda Colombia: recibe todo
  if (!normSub || normSub === 'colombia' || normSub === 'todas' || normSub === 'all' || normSub === 'nacional') {
    return true;
  }

  // 3. Coincidencia directa por inclusión de subcadenas
  if (normSub.includes(normAlerta) || normAlerta.includes(normSub)) {
    return true;
  }

  // 4. Verificación por región metropolitana (ej. Alerta en "Envigado" llega a suscriptor de "Medellín")
  for (const region of REGIONES_METROPOLITANAS) {
    const subEnRegion = region.alias.some(a => normSub.includes(a) || a.includes(normSub));
    const alertaEnRegion = region.alias.some(a => normAlerta.includes(a) || a.includes(normAlerta));
    if (subEnRegion && alertaEnRegion) {
      return true;
    }
  }

  return false;
}

/**
 * Evalúa si una suscripción satisface múltiples criterios de una alerta (Ciudad, Operación, Rebajas).
 * @param {object} sub - Datos de la suscripción
 * @param {object} alerta - Criterios de la oportunidad emitida
 * @returns {boolean}
 */
function coincideCriteriosSuscripcion(sub, alerta = {}) {
  if (!sub) return false;

  // 1. Validación de ubicación geográfica
  const coincideCiudad = coincideCiudadSuscripcion(sub.ciudad, alerta.ciudad || alerta.city);
  if (!coincideCiudad) return false;

  // 2. Validación de tipo de operación (Venta / Arriendo / Todas)
  const opSub = normalizarTexto(sub.operacion || 'todas');
  const opAlerta = normalizarTexto(alerta.operacion || alerta.operation || 'todas');

  if (opSub && opSub !== 'todas' && opSub !== 'all' && opAlerta && opAlerta !== 'todas' && opAlerta !== 'all') {
    if (opSub !== opAlerta) {
      return false;
    }
  }

  // 3. Validación de filtro de oportunidad exclusiva con rebaja/descuento
  if (sub.soloRebajas) {
    const esRebaja = Boolean(
      alerta.esRebaja || 
      alerta.rebaja || 
      (alerta.title && /rebaja|descuento|ganga|urgente|oportunidad/i.test(alerta.title)) ||
      (alerta.message && /rebaja|descuento|ganga|urgente/i.test(alerta.message))
    );
    if (!esRebaja) {
      return false;
    }
  }

  return true;
}

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
 * Elimina una suscripción de forma permanente cuando el navegador revoca permisos (HTTP 410 Gone / 404).
 * @param {string} endpoint
 * @returns {Promise<boolean>}
 */
async function eliminarSuscripcion(endpoint) {
  if (!endpoint) return false;
  const subId = hashEndpoint(endpoint);

  // 1. Purgar de memoria volátil
  memorySubscriptions.delete(subId);

  // 2. Purgar de archivo local
  try {
    if (fs.existsSync(LOCAL_SUBSCRIPTIONS_FILE)) {
      const subs = cargarSuscripcionesLocales();
      const filtradas = subs.filter(s => hashEndpoint(s.endpoint) !== subId);
      fs.writeFileSync(LOCAL_SUBSCRIPTIONS_FILE, JSON.stringify(filtradas, null, 2), 'utf8');
    }
  } catch (_) {}

  // 3. Purgar de Firestore si está configurado
  const db = typeof getFirestoreInstance === 'function' ? getFirestoreInstance() : null;
  if (db) {
    try {
      await db.collection('push_subscriptions').doc(subId).delete();
      return true;
    } catch (_) {}
  }

  return true;
}

/**
 * Registra o actualiza una suscripción Web Push con segmentación multicriterio.
 * @param {object} subscription - { endpoint, keys: { p256dh, auth } }
 * @param {object} [metadata] - { ciudad, operacion, soloRebajas, userAgent, lang }
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
    ciudad: metadata.ciudad ? String(metadata.ciudad).substring(0, 60).trim() : 'Colombia',
    operacion: metadata.operacion ? String(metadata.operacion).toLowerCase().substring(0, 20).trim() : 'todas',
    soloRebajas: Boolean(metadata.soloRebajas),
    lang: metadata.lang === 'en' ? 'en' : 'es',
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

/**
 * Obtiene las suscripciones activas segmentadas por criterios múltiples (ciudad, operación, rebajas).
 * @param {object} criterios - { ciudad, operacion, esRebaja, title }
 * @returns {Promise<Array<object>>}
 */
async function obtenerSuscripcionesFiltradas(criterios = {}) {
  const todas = await obtenerSuscripcionesActivas();
  return todas.filter(s => coincideCriteriosSuscripcion(s, criterios));
}

/**
 * Obtiene las suscripciones activas segmentadas por ciudad de interés (Compatibilidad hacia atrás).
 * @param {string} ciudadAlerta
 * @returns {Promise<Array<object>>}
 */
async function obtenerSuscripcionesPorCiudad(ciudadAlerta) {
  return obtenerSuscripcionesFiltradas({ ciudad: ciudadAlerta });
}

module.exports = {
  registrarSuscripcion,
  eliminarSuscripcion,
  obtenerSuscripcionesActivas,
  obtenerSuscripcionesPorCiudad,
  obtenerSuscripcionesFiltradas,
  coincideCiudadSuscripcion,
  coincideCriteriosSuscripcion,
  normalizarTexto,
  hashEndpoint
};
