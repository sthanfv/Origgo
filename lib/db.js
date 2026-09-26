const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');
const { generatePin } = require('./crypto');

// Inicialización resiliente de Firebase Admin SDK
let db = null;
let usersRef = null;
let transactionsRef = null;
let ordersRef = null;
let blacklistedLeadsRef = null;
let leadsRef = null;
let claimedDevicesRef = null;
let claimedEmailsRef = null;
let welcomeTokensRef = null;
let memoryStore = null;
let guardarAlmacenLocal = () => {};

/**
 * Normaliza la clave privada de Firebase eliminando comillas envolventes
 * y traduciendo saltos de línea escapados (\\n) a saltos de línea reales.
 * @param {string} key
 * @returns {string}
 */
function normalizarClavePrivadaFirebase(key) {
  if (!key || typeof key !== 'string') return '';
  let limpia = key.trim();
  if ((limpia.startsWith('"') && limpia.endsWith('"')) || (limpia.startsWith("'") && limpia.endsWith("'"))) {
    limpia = limpia.slice(1, -1);
  }
  return limpia.replace(/\\n/g, '\n').trim();
}

try {
  // Las pruebas NUNCA tocan producción: con FIRESTORE_DESACTIVADO=1 (lo fija scripts/validate.js)
  // no se cargan credenciales y todo queda en memoria. [2026-09-25] Antes, `npm test` usaba
  // service-account.json, escribía usuarios de prueba en Firestore real y gastaba su cuota.
  if (!getApps().length && process.env.FIRESTORE_DESACTIVADO !== '1') {
    let credential = null;
    let targetProjectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || null;

    // 1. Prioridad: Variables individuales de Vercel (FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL)
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      const privateKey = normalizarClavePrivadaFirebase(process.env.FIREBASE_PRIVATE_KEY);
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL.trim();
      const projectId = targetProjectId || 'hunter-pro-showcase';
      try {
        credential = cert({
          projectId,
          clientEmail,
          privateKey
        });
        targetProjectId = projectId;
        console.log(`[db] Conexión autenticada a Firebase Firestore (${projectId}) vía variables individuales.`);
      } catch (e) {
        console.warn('[db] Error con variables individuales de Firebase:', e.message);
      }
    }

    // 2. Variable FIREBASE_SERVICE_ACCOUNT (JSON string, objeto, PEM o Base64)
    if (!credential && process.env.FIREBASE_SERVICE_ACCOUNT) {
      const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT;
      
      if (typeof rawSa === 'object' && rawSa !== null) {
        try {
          credential = cert(rawSa);
          targetProjectId = rawSa.project_id || targetProjectId;
          console.log('[db] Conexión a Firebase Firestore vía objeto FIREBASE_SERVICE_ACCOUNT.');
        } catch (e) {
          console.warn('[db] Error cargando objeto FIREBASE_SERVICE_ACCOUNT:', e.message);
        }
      } else if (typeof rawSa === 'string') {
        const trimmed = rawSa.trim();
        if (trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed);
            const normalized = {
              projectId: parsed.project_id || parsed.projectId || targetProjectId || 'hunter-pro-showcase',
              clientEmail: parsed.client_email || parsed.clientEmail || parsed.correo_cliente || 'firebase-adminsdk-fbsvc@hunter-pro-showcase.iam.gserviceaccount.com',
              privateKey: normalizarClavePrivadaFirebase(parsed.private_key || parsed.clave_privada || '')
            };
            if (normalized.privateKey && normalized.clientEmail) {
              credential = cert(normalized);
              targetProjectId = normalized.projectId;
            } else {
              credential = cert(parsed);
              targetProjectId = parsed.project_id || targetProjectId;
            }
            console.log(`[db] Conexión autenticada a Firebase Firestore (${targetProjectId || 'autodetectado'}) establecida con éxito.`);
          } catch (e) {
            console.warn('[db] Error parseando JSON en FIREBASE_SERVICE_ACCOUNT:', e.message);
          }
        } else if (trimmed.startsWith('-----BEGIN')) {
          const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@hunter-pro-showcase.iam.gserviceaccount.com';
          const projectId = targetProjectId || 'hunter-pro-showcase';
          try {
            credential = cert({
              projectId,
              clientEmail,
              privateKey: normalizarClavePrivadaFirebase(trimmed)
            });
            targetProjectId = projectId;
            console.log(`[db] Conexión autenticada a Firebase Firestore (${projectId}) vía clave PEM.`);
          } catch (e) {
            console.warn('[db] Error inicializando credencial desde PEM:', e.message);
          }
        } else {
          // Intentar decodificar como Base64
          try {
            const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
            if (decoded.trim().startsWith('{')) {
              const parsed = JSON.parse(decoded);
              if (parsed.private_key) {
                parsed.private_key = normalizarClavePrivadaFirebase(parsed.private_key);
              }
              credential = cert(parsed);
              targetProjectId = parsed.project_id || targetProjectId;
              console.log('[db] Conexión autenticada a Firebase Firestore vía Base64 decodificado.');
            }
          } catch (e) {
            console.warn('[db] Formato no reconocido para FIREBASE_SERVICE_ACCOUNT. Usando almacenamiento seguro.');
          }
        }
      }
    }

    // 3. FIREBASE_SERVICE_ACCOUNT_BASE64 explícito
    if (!credential && process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      try {
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64.trim(), 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        if (parsed.private_key) {
          parsed.private_key = normalizarClavePrivadaFirebase(parsed.private_key);
        }
        credential = cert(parsed);
        targetProjectId = parsed.project_id || targetProjectId;
        console.log('[db] Conexión autenticada a Firebase Firestore vía FIREBASE_SERVICE_ACCOUNT_BASE64.');
      } catch (e) {
        console.warn('[db] Error decodificando FIREBASE_SERVICE_ACCOUNT_BASE64:', e.message);
      }
    }

    // 4. Archivo local service-account.json en desarrollo
    if (!credential && process.env.NODE_ENV !== 'production') {
      try {
        const localSaPath = path.join(__dirname, '../service-account.json');
        if (fs.existsSync(localSaPath)) {
          const serviceAccount = require(localSaPath);
          credential = cert(serviceAccount);
          targetProjectId = serviceAccount.project_id || targetProjectId;
        }
      } catch (e) {
        // En desarrollo sin archivo local
      }
    }

    if (credential) {
      initializeApp({
        credential,
        projectId: targetProjectId || 'hunter-pro-showcase'
      });
    }
  }

  if (getApps().length) {
    db = getFirestore();
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (_) {}
    usersRef = db.collection('users');
    transactionsRef = db.collection('transactions');
    ordersRef = db.collection('orders');
    blacklistedLeadsRef = db.collection('blacklisted_leads');
    leadsRef = db.collection('leads');
    claimedDevicesRef = db.collection('claimed_devices');
    claimedEmailsRef = db.collection('claimed_emails');
    welcomeTokensRef = db.collection('welcome_tokens');
  }
} catch (e) {
  console.warn('[db] Firebase no configurado o sin credenciales activas:', e.message);
}

// Almacenamiento seguro local y fallback resiliente para entornos serverless, cuotas agotadas y tests
function resolverRutaAlmacenLocal() {
  if (process.env.LOCAL_DB_PATH) return process.env.LOCAL_DB_PATH;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION) {
    return path.join('/tmp', 'origgo_local_db.json');
  }
  const dataDir = path.join(__dirname, '../data');
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'local_db.json');
  } catch (_) {
    return path.join('/tmp', 'origgo_local_db.json');
  }
}

const LOCAL_DB_PATH = resolverRutaAlmacenLocal();

function cargarAlmacenLocal() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        users: new Map(Object.entries(parsed.users || {})),
        transactions: new Map(Object.entries(parsed.transactions || {})),
        orders: new Map(Object.entries(parsed.orders || {})),
        blacklisted_leads: new Map(Object.entries(parsed.blacklisted_leads || {})),
        leads: new Map(Object.entries(parsed.leads || {})),
        claimed_devices: new Map(Object.entries(parsed.claimed_devices || {})),
        claimed_emails: new Map(Object.entries(parsed.claimed_emails || {})),
        welcome_tokens: new Map(Object.entries(parsed.welcome_tokens || {}))
      };
    }
  } catch (e) {
    console.warn('[db] Error leyendo local_db.json:', e.message);
  }
  return {
    users: new Map(),
    transactions: new Map(),
    orders: new Map(),
    blacklisted_leads: new Map(),
    leads: new Map(),
    claimed_devices: new Map(),
    claimed_emails: new Map(),
    welcome_tokens: new Map()
  };
}

memoryStore = cargarAlmacenLocal();

guardarAlmacenLocal = function() {
  try {
    const obj = {
      users: Object.fromEntries(memoryStore.users),
      transactions: Object.fromEntries(memoryStore.transactions),
      orders: Object.fromEntries(memoryStore.orders),
      blacklisted_leads: Object.fromEntries(memoryStore.blacklisted_leads),
      leads: Object.fromEntries(memoryStore.leads),
      claimed_devices: Object.fromEntries(memoryStore.claimed_devices),
      claimed_emails: Object.fromEntries(memoryStore.claimed_emails),
      welcome_tokens: Object.fromEntries(memoryStore.welcome_tokens)
    };
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    // Ignorar silenciosamente en entornos de solo lectura sin permisos
  }
};

function createMemoryCollection(collectionName) {
  const store = memoryStore[collectionName];
  return {
    async get() {
      if (fs.existsSync(LOCAL_DB_PATH)) {
        try {
          const discObj = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
          if (discObj && discObj[collectionName]) {
            for (const [k, v] of Object.entries(discObj[collectionName])) {
              store.set(String(k), v);
            }
          }
        } catch (_) {}
      }
      return {
        empty: store.size === 0,
        docs: Array.from(store.entries()).map(([id, data]) => ({
          id: String(id),
          data: () => JSON.parse(JSON.stringify(data))
        }))
      };
    },
    doc(id) {
      return {
        id: String(id),
        async get() {
          let val = store.get(String(id));
          if (!val && fs.existsSync(LOCAL_DB_PATH)) {
            try {
              const discObj = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
              if (discObj && discObj[collectionName] && discObj[collectionName][String(id)]) {
                val = discObj[collectionName][String(id)];
                store.set(String(id), val);
              }
            } catch (_) {}
          }
          return {
            exists: Boolean(val),
            data: () => (val ? JSON.parse(JSON.stringify(val)) : null)
          };
        },
        async set(data, options = {}) {
          let finalData;
          if (options && options.merge) {
            const existing = store.get(String(id)) || {};
            finalData = { ...existing, ...JSON.parse(JSON.stringify(data)) };
          } else {
            finalData = JSON.parse(JSON.stringify(data));
          }
          store.set(String(id), finalData);
          guardarAlmacenLocal();
        }
      };
    },
    where(field, op, expectedVal) {
      const obtenerFiltrados = (limite = Infinity) => {
        const results = [];
        for (const item of store.values()) {
          if (op === '==' && item[field] === expectedVal) {
            results.push({ data: () => JSON.parse(JSON.stringify(item)) });
            if (results.length >= limite) break;
          }
        }
        return {
          empty: results.length === 0,
          docs: results
        };
      };

      return {
        async get() {
          return obtenerFiltrados();
        },
        limit(n) {
          return {
            async get() {
              return obtenerFiltrados(n);
            }
          };
        }
      };
    }
  };
}

const memoryDb = {
  collection(name) {
    if (!memoryStore[name]) {
      memoryStore[name] = new Map();
    }
    return createMemoryCollection(name);
  },
  batch() {
    const ops = [];
    return {
      set(docRef, data, options) {
        ops.push(() => docRef.set(data, options));
      },
      async commit() {
        for (const op of ops) {
          await op();
        }
      }
    };
  },
  async runTransaction(updateFunction) {
    const transaction = {
      async get(docRef) {
        return await docRef.get();
      },
      set(docRef, data, options) {
        docRef.set(data, options);
      }
    };
    return await updateFunction(transaction);
  }
};

const memoryUsersRef = createMemoryCollection('users');
const memoryTransactionsRef = createMemoryCollection('transactions');
const memoryOrdersRef = createMemoryCollection('orders');
const memoryBlacklistedLeadsRef = createMemoryCollection('blacklisted_leads');
const memoryLeadsRef = createMemoryCollection('leads');
const memoryClaimedDevicesRef = createMemoryCollection('claimed_devices');
const memoryClaimedEmailsRef = createMemoryCollection('claimed_emails');
const memoryWelcomeTokensRef = createMemoryCollection('welcome_tokens');

// Modo memoria: SOLO para desarrollo y pruebas sin credenciales de Firestore
// (o con FIRESTORE_DESACTIVADO=1). En producción nunca se activa: si Firestore falla
// (cuota agotada, red, tiempo de espera) la operación lanza un error y la API responde
// 503, en vez de guardar pagos o créditos en una memoria temporal que se pierde.
let modoMemoria = false;
let razonModoMemoria = null;

function activarModoMemoria(razon) {
  if (modoMemoria) return;
  modoMemoria = true;
  razonModoMemoria = razon;
  console.warn(`[db] Sin Firestore: se usa almacenamiento local en memoria (${razon}).`);
  usersRef = memoryUsersRef;
  transactionsRef = memoryTransactionsRef;
  ordersRef = memoryOrdersRef;
  blacklistedLeadsRef = memoryBlacklistedLeadsRef;
  leadsRef = memoryLeadsRef;
  claimedDevicesRef = memoryClaimedDevicesRef;
  claimedEmailsRef = memoryClaimedEmailsRef;
  welcomeTokensRef = memoryWelcomeTokensRef;
  db = memoryDb;
}

if (!db) {
  activarModoMemoria('sin_credenciales_firestore');
}

function cleanPhone(phone) {
  if (!phone) return '';
  const num = String(phone).replace(/\D/g, '');
  return num.startsWith('57') && num.length === 12 ? num.substring(2) : num;
}

/** ¿El error es de cuota diaria agotada de Firestore? (no incluye tiempos de espera) */
function esErrorCuotaFirestore(err) {
  if (!err) return false;
  const texto = `${err.message || ''} ${err.details || ''}`;
  return err.code === 8 || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(texto);
}

// Margen para el arranque en frío de Vercel (3,5 s daba falsos fallos).
const TIEMPO_ESPERA_FIRESTORE_MS = 8000;

function ejecutarConTimeout(promesa, ms = TIEMPO_ESPERA_FIRESTORE_MS, mensaje = 'DEADLINE_EXCEEDED') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(mensaje);
      err.code = 4;
      reject(err);
    }, ms);
  });
  return Promise.race([promesa, timeout]).finally(() => clearTimeout(timer));
}

/** Marca el error para que las APIs respondan 503 (el cliente o Wompi reintentan). */
function marcarErrorAlmacenamiento(err) {
  err.codigo = esErrorCuotaFirestore(err) ? 'CUOTA_AGOTADA' : 'FIRESTORE_NO_DISPONIBLE';
  err.status = 503;
  return err;
}

/**
 * Ejecuta una operación de base de datos con reintentos exponenciales y jitter.
 * Si la cuota está agotada falla de inmediato (reintentar no sirve hasta las 2:00 a. m.);
 * si Firestore no responde, reintenta y al final lanza el error marcado con status 503.
 * Nunca cambia a la memoria temporal: un pago guardado ahí se perdería.
 *
 * @template T
 * @param {() => Promise<T>} operacion - Función asíncrona a ejecutar
 * @param {number} [maxIntentos=3] - Intentos máximos (1 para escrituras que no son idempotentes)
 * @returns {Promise<T>}
 */
async function withRetry(operacion, maxIntentos = 3) {
  if (modoMemoria) return await operacion();
  let delay = 200;
  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      return await ejecutarConTimeout(operacion());
    } catch (err) {
      if (esErrorCuotaFirestore(err) || intento === maxIntentos) throw marcarErrorAlmacenamiento(err);
      const jitter = Math.floor(Math.random() * 150);
      console.warn(`[db:retry] Intento ${intento} fallido (${err.message}). Reintentando en ${delay + jitter}ms...`);
      await new Promise((r) => setTimeout(r, delay + jitter));
      delay *= 2;
    }
  }
}

async function getUserByPhone(phone) {
  const normPhone = cleanPhone(phone);
  if (!normPhone || !usersRef) return null;

  return await withRetry(async () => {
    const doc = await usersRef.doc(normPhone).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data();
  });
}

function normalizarPinSeguro(p) {
  if (!p) return '';
  return String(p).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function getUserByPin(phone, pin) {
  const user = await getUserByPhone(phone);
  if (!user) return null;
  
  const rawInput = String(pin || '').trim().toUpperCase();
  const userPin = String(user.pin || '').trim().toUpperCase();

  // 1. Coincidencia idéntica directa (ej. "HNT-4357" === "HNT-4357")
  if (rawInput === userPin) {
    return user;
  }

  // 2. Coincidencia alfanumérica sin guiones ni espacios (ej. "HNT4357" === "HNT4357")
  const normInput = normalizarPinSeguro(rawInput);
  const normUserPin = normalizarPinSeguro(userPin);
  if (normInput && normInput === normUserPin) {
    return user;
  }

  // 3. Coincidencia solo por los 4 dígitos (ej. el usuario ingresó "4357" y su PIN es "HNT-4357")
  const digitsInput = normInput.replace(/^HNT/, '');
  const digitsUserPin = normUserPin.replace(/^HNT/, '');
  if (digitsInput && digitsUserPin && digitsInput === digitsUserPin) {
    return user;
  }

  // 🛡️ SEGURIDAD ZERO-TRUST: Se eliminó el bypass que permitía autenticar con los últimos
  // 4 dígitos del celular. El PIN debe ser estrictamente el secreto emitido por el sistema.
  return null;
}

/**
 * Calcula la fecha y hora exacta de vencimiento de un ciclo de membresía (mes calendario).
 * Si el mes tiene 31 días (ej. diciembre, marzo, mayo), preserva los 31 días completos sin robar tiempo.
 * Se corta exactamente a la misma hora y minuto en que se activó la compra (reloj servidor UTC).
 * @param {Date|string|number} [fechaInicio=new Date()]
 * @param {number} [meses=1]
 * @returns {string} Fecha de expiración en formato ISO 8601 UTC
 */
function calcularExpiracionMesCalendario(fechaInicio = new Date(), meses = 1) {
  const d = new Date(fechaInicio);
  const diaOriginal = d.getDate();
  d.setMonth(d.getMonth() + meses);
  // Si el mes destino tiene menos días (ej. 31 de enero -> último día de febrero)
  if (d.getDate() !== diaOriginal) {
    d.setDate(0);
  }
  return d.toISOString();
}

async function getUserByEmail(email) {
  if (!email || typeof email !== 'string' || !usersRef) return null;
  const normEmail = email.toLowerCase().trim();
  
  return await withRetry(async () => {
    // Buscar directamente en la colección de usuarios por correo
    const snapshot = await usersRef.where('email', '==', normEmail).limit(1).get();
    if (!snapshot.empty) {
      return snapshot.docs[0].data();
    }
    // Si no está directamente, verificar si existe una orden con este correo para vincularlo
    if (ordersRef) {
      const orderSnap = await ordersRef.where('email', '==', normEmail).limit(1).get();
      if (!orderSnap.empty) {
        const order = orderSnap.docs[0].data();
        if (order && order.celular) {
          const normCel = cleanPhone(order.celular);
          const userDoc = await usersRef.doc(normCel).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userData.email = normEmail;
            await usersRef.doc(normCel).set(userData);
            return userData;
          }
        }
      }
    }
    return null;
  });
}

/**
 * Aplica una acreditación (créditos, PIN, correo y plan) sobre los datos del usuario.
 * Función pura: la usan addCredits y acreditarPagoUnaVez dentro de su transacción.
 */
function aplicarAcreditacion(actual, normPhone, creditsToAdd = 0, pin = null, planData = null, email = null) {
  const existing = actual || {
    phone: normPhone,
    pin: pin || generatePin(normPhone),
    credits: 0,
    plan: 'free',
    planCity: null,
    planExpiresAt: null,
    unlockedLeads: [],
    createdAt: new Date().toISOString()
  };

  existing.credits = Math.max(0, Number(existing.credits || 0) + Number(creditsToAdd));
  if (pin) existing.pin = pin;
  if (email) existing.email = email.toLowerCase().trim();

  if (planData && planData.plan) {
    existing.plan = planData.plan;
    if (planData.city) existing.planCity = planData.city;
    // Cálculo antifraude de mes calendario preservando 31 días y hora exacta de compra
    if (typeof planData.days === 'number' && planData.days !== 30) {
      existing.planExpiresAt = new Date(Date.now() + planData.days * 86400 * 1000).toISOString();
    } else {
      existing.planExpiresAt = calcularExpiracionMesCalendario(Date.now(), 1);
    }
  }

  existing.updatedAt = new Date().toISOString();
  return existing;
}

async function addCredits(phone, creditsToAdd = 0, pin = null, planData = null, email = null) {
  const normPhone = cleanPhone(phone);
  if (!normPhone) throw new Error('Número de teléfono inválido');

  // Un solo intento: sumar créditos no es idempotente y un reintento tras un tiempo
  // de espera podría acreditar dos veces. Para pagos se usa acreditarPagoUnaVez.
  return await withRetry(async () => {
    const userRef = usersRef.doc(normPhone);
    return await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
      const existing = aplicarAcreditacion(doc.exists ? doc.data() : null, normPhone, creditsToAdd, pin, planData, email);
      t.set(userRef, existing);
      return existing;
    });
  }, 1);
}

/**
 * Entrega lo comprado en un pago UNA sola vez, de forma atómica (estándar de pasarelas:
 * la llave de idempotencia y el saldo se escriben en la misma transacción).
 *
 * El webhook de Wompi, el reclamo del usuario al volver del pago y el cron de conciliación
 * comparten la misma llave (`pago_<referencia>`), así que un pago nunca se acredita dos
 * veces aunque los tres lleguen a la vez, y si algo falla no queda marcado como procesado
 * (el siguiente reintento sí acredita). También respeta los registros anteriores a este
 * cambio (id de transacción de Wompi y `claim_<referencia>`).
 *
 * @param {Object} pago
 * @param {string} pago.reference - Referencia de la orden (HNT-...)
 * @param {string} pago.celular
 * @param {string|null} [pago.transactionId] - Id de la transacción en Wompi
 * @param {number} [pago.creditos]
 * @param {string|null} [pago.pin]
 * @param {Object|null} [pago.planData]
 * @param {string|null} [pago.email]
 * @param {string} [pago.origen] - 'webhook' | 'reclamo' | 'cron'
 * @param {Object} [pago.datos] - Datos extra para el registro (monto, medio de pago...)
 * @returns {Promise<{ duplicado: boolean, usuario: Object|null }>}
 */
async function acreditarPagoUnaVez({ reference, celular, transactionId = null, creditos = 0, pin = null, planData = null, email = null, origen = 'desconocido', datos = {} }) {
  const normPhone = cleanPhone(celular);
  if (!normPhone) throw new Error('Número de teléfono inválido');
  if (!reference) throw new Error('Referencia de pago requerida');

  return await withRetry(async () => {
    const registroRef = transactionsRef.doc(`pago_${reference}`);
    const legadoRefs = [transactionsRef.doc(`claim_${reference}`)];
    if (transactionId) legadoRefs.push(transactionsRef.doc(String(transactionId)));
    const userRef = usersRef.doc(normPhone);

    return await db.runTransaction(async (t) => {
      // Firestore exige todas las lecturas antes de cualquier escritura.
      const registro = await t.get(registroRef);
      const legados = [];
      for (const ref of legadoRefs) legados.push(await t.get(ref));
      const userDoc = await t.get(userRef);
      const actual = userDoc.exists ? userDoc.data() : null;

      if (registro.exists || legados.some((d) => d.exists)) {
        return { duplicado: true, usuario: actual };
      }

      const usuario = aplicarAcreditacion(actual, normPhone, creditos, pin, planData, email);
      t.set(userRef, usuario);
      t.set(registroRef, {
        ...datos,
        reference,
        transactionId: transactionId || null,
        celular: normPhone,
        creditos: Number(creditos) || 0,
        plan: (planData && planData.plan) || null,
        origen,
        processedAt: new Date().toISOString()
      });
      return { duplicado: false, usuario };
    });
  });
}

async function unlockLead(phone, leadId, sessionData = null, leadCity = null) {
  const normPhone = cleanPhone(phone);
  if (!normPhone || !leadId) {
    return { success: false, error: 'DATOS_INVALIDOS' };
  }

  return await withRetry(async () => {
    const userRef = usersRef.doc(normPhone);
    return await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
    let user;

    if (!doc.exists) {
      return { success: false, error: 'USUARIO_NO_REGISTRADO' };
    }
    user = doc.data();

    user.unlockedLeads = Array.isArray(user.unlockedLeads) ? user.unlockedLeads : [];

    if (user.unlockedLeads.includes(leadId)) {
      return {
        success: true,
        alreadyUnlocked: true,
        credits: Number(user.credits || 0),
        unlockedLeads: user.unlockedLeads,
        user
      };
    }

    const isPlanDateValid = Boolean(user.planExpiresAt && new Date(user.planExpiresAt) > new Date());
    let hasPlanCoverage = false;

    if (isPlanDateValid) {
      if (user.plan === 'national') {
        hasPlanCoverage = true;
      } else if (user.plan === 'city') {
        if (!leadCity || !user.planCity) {
          hasPlanCoverage = true;
        } else {
          const normLeadCity = String(leadCity).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          const normUserCity = String(user.planCity).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          hasPlanCoverage = normLeadCity.includes(normUserCity) || normUserCity.includes(normLeadCity);
        }
      }
    }

    if (hasPlanCoverage) {
      // 🛡️ Política de Uso Justo (Fair Usage Policy): Máx 35 desbloqueos nuevos por día calendario
      const MAX_DESBLOQUEOS_DIARIOS_PLAN = 35;
      const fechaHoy = new Date().toISOString().slice(0, 10);
      if (!user.dailyPlanUnlocks || user.dailyPlanUnlocks.date !== fechaHoy) {
        user.dailyPlanUnlocks = { date: fechaHoy, count: 0 };
      }

      if (user.dailyPlanUnlocks.count >= MAX_DESBLOQUEOS_DIARIOS_PLAN) {
        return {
          success: false,
          error: 'CUOTA_DIARIA_EXCEDIDA',
          message: 'Has alcanzado la cuota de uso justo de 35 contactos diarios. Por seguridad y prevención de intermediación masiva, tu cuota se reiniciará mañana a las 00:00.',
          credits: Number(user.credits || 0),
          unlockedLeads: user.unlockedLeads,
          user
        };
      }

      user.dailyPlanUnlocks.count += 1;
      user.unlockedLeads.push(leadId);
      user.updatedAt = new Date().toISOString();
      t.set(userRef, user);
      return {
        success: true,
        alreadyUnlocked: false,
        credits: Number(user.credits || 0),
        unlockedLeads: user.unlockedLeads,
        planBenefit: true,
        dailyUnlocksRemaining: Math.max(0, MAX_DESBLOQUEOS_DIARIOS_PLAN - user.dailyPlanUnlocks.count),
        user
      };
    }

    const currentCredits = Number(user.credits || 0);
    if (currentCredits < 1) {
      if (user.plan === 'city' && isPlanDateValid && leadCity && user.planCity) {
        return {
          success: false,
          error: 'PLAN_CIUDAD_DIFERENTE',
          message: `Tu Plan Pro cubre ${user.planCity}. Este inmueble es de ${leadCity}. Adquiere créditos individuales para desbloquearlo.`,
          credits: 0,
          unlockedLeads: user.unlockedLeads,
          user
        };
      }
      return {
        success: false,
        error: 'SALDO_INSUFICIENTE',
        credits: currentCredits,
        unlockedLeads: user.unlockedLeads,
        user
      };
    }

    user.credits = currentCredits - 1;
    user.unlockedLeads.push(leadId);
    user.updatedAt = new Date().toISOString();
    t.set(userRef, user);

    return {
      success: true,
      alreadyUnlocked: false,
      credits: user.credits,
      unlockedLeads: user.unlockedLeads,
      user
    };
  });
  });
}

async function isTransactionProcessed(transactionId) {
  if (!transactionId) return false;
  return await withRetry(async () => {
    const doc = await transactionsRef.doc(transactionId).get();
    return doc.exists;
  });
}

async function recordTransaction(transactionId, data) {
  if (!transactionId) return false;
  return await withRetry(async () => {
    const docRef = transactionsRef.doc(transactionId);
    return await db.runTransaction(async (t) => {
      const doc = await t.get(docRef);
      if (doc.exists) {
        return false;
      }
      t.set(docRef, {
        ...data,
        processedAt: new Date().toISOString()
      });
      return true;
    });
  });
}

async function getPendingOrder(reference) {
  return await withRetry(async () => {
    const doc = await ordersRef.doc(reference).get();
    return doc.exists ? doc.data() : null;
  });
}

async function getPendingOrderByEmail(email) {
  if (!email || typeof email !== 'string' || !ordersRef) return null;
  const normEmail = email.toLowerCase().trim();
  return await withRetry(async () => {
    const snapshot = await ordersRef.where('email', '==', normEmail).limit(1).get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  });
}

async function getPendingOrderByIdempotencyKey(key) {
  if (!key || !ordersRef) return null;
  return await withRetry(async () => {
    const alias = await ordersRef.doc(`idem_${key}`).get();
    if (!alias.exists) return null;
    const reference = alias.data()?.reference;
    if (!reference) return null;
    return getPendingOrder(reference);
  });
}

async function savePendingOrder(reference, orderData) {
  return await withRetry(async () => {
    const payload = {
      ...orderData,
      createdAt: orderData.createdAt || new Date().toISOString()
    };
    await ordersRef.doc(reference).set(payload);
    if (orderData.idempotencyKey) {
      await ordersRef.doc(`idem_${orderData.idempotencyKey}`).set({
        reference,
        createdAt: payload.createdAt
      });
    }
  });
}

async function updateUserPreferences(phone, { preferredLang, preferredTheme } = {}) {
  const normPhone = cleanPhone(phone);
  if (!normPhone || !usersRef) return null;

  return await withRetry(async () => {
    const userRef = usersRef.doc(normPhone);
    const doc = await userRef.get();
    if (!doc.exists) return null;

    const data = doc.data();
    const updates = {};
    if (preferredLang && (preferredLang === 'es' || preferredLang === 'en')) {
      updates.preferredLang = preferredLang;
    }
    if (preferredTheme && (preferredTheme === 'dark' || preferredTheme === 'light')) {
      updates.preferredTheme = preferredTheme;
    }
    if (Object.keys(updates).length === 0) return data;

    updates.updatedAt = new Date().toISOString();
    await userRef.set(updates, { merge: true });
    return { ...data, ...updates };
  });
}

/**
 * Recupera órdenes pendientes de pago con un límite máximo de resultados.
 * Permite conciliar estados PENDING que requieren verificación server-to-server con Wompi.
 * 
 * @param {number} [limitCount=25] - Número máximo de órdenes a recuperar
 * @returns {Promise<Array<Object>>} Lista de órdenes pendientes
 */
async function getPendingOrders(limitCount = 25) {
  if (!ordersRef) return [];
  return await withRetry(async () => {
    const snapshot = await ordersRef.where('status', '==', 'PENDING').limit(limitCount).get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
  });
}

/**
 * Actualiza el estado de una orden y fusiona metadatos adicionales (ej. fecha de conciliación, ID de transacción).
 * 
 * @param {string} reference - Referencia única de la orden (ej. HNT-3001234567-...)
 * @param {string} status - Nuevo estado ('APPROVED' | 'DECLINED' | 'VOIDED' | 'EXPIRED')
 * @param {Object} [extraData={}] - Metadatos adicionales para fusionar
 * @returns {Promise<Object|null>} Orden actualizada o null si no existe
 */
async function updateOrderStatus(reference, status, extraData = {}) {
  if (!reference || !ordersRef) return null;
  return await withRetry(async () => {
    const orderDoc = ordersRef.doc(reference);
    const snap = await orderDoc.get();
    if (!snap.exists) return null;
    const current = snap.data();
    const updated = {
      ...current,
      ...extraData,
      status,
      updatedAt: new Date().toISOString()
    };
    await orderDoc.set(updated, { merge: true });
    return updated;
  });
}

/**
 * Agrega un lead a la lista negra de desindexación por solicitud de propietario o titular.
 * @param {string} leadId
 * @param {object} data
 * @returns {Promise<{ success: boolean, leadId: string }>}
 */
async function addBlacklistedLead(leadId, data = {}) {
  if (!leadId || typeof leadId !== 'string') throw new Error('leadId inválido');
  const idLimpio = leadId.trim();
  const registro = {
    leadId: idLimpio,
    phone: cleanPhone(data.phone || ''),
    reason: (data.reason || data.razon || 'solicitud_propietario').slice(0, 100),
    ip: data.ip || null,
    createdAt: new Date().toISOString()
  };

  // Siempre asegurar disponibilidad inmediata en memoria local
  if (memoryStore && memoryStore.blacklisted_leads) {
    memoryStore.blacklisted_leads.set(idLimpio, registro);
    if (typeof guardarAlmacenLocal === 'function') guardarAlmacenLocal();
  }

  return withRetry(async () => {
    if (blacklistedLeadsRef && !modoMemoria) {
      await blacklistedLeadsRef.doc(idLimpio).set(registro, { merge: true });
    }
    return { success: true, leadId: idLimpio };
  });
}

/**
 * Consulta la lista de todos los IDs de inmuebles desindexados.
 * @returns {Promise<string[]>}
 */
async function getBlacklistedLeadIds() {
  const memoryIds = memoryStore?.blacklisted_leads ? Array.from(memoryStore.blacklisted_leads.keys()) : [];
  if (modoMemoria || !blacklistedLeadsRef) {
    return memoryIds;
  }
  return withRetry(async () => {
    if (blacklistedLeadsRef && !modoMemoria) {
      const snap = await blacklistedLeadsRef.get();
      const firestoreIds = snap.docs.map(d => d.id);
      return Array.from(new Set([...memoryIds, ...firestoreIds]));
    }
    return memoryIds;
  });
}

/**
 * Verifica si un inmueble específico está desindexado / retirado.
 * @param {string} leadId
 * @returns {Promise<boolean>}
 */
async function isLeadBlacklisted(leadId) {
  if (!leadId || typeof leadId !== 'string') return false;
  const idLimpio = leadId.trim();

  // Consulta ultrarrápida O(1) en memoria local
  if (memoryStore && memoryStore.blacklisted_leads && memoryStore.blacklisted_leads.has(idLimpio)) {
    return true;
  }

  if (modoMemoria || !blacklistedLeadsRef) {
    return false;
  }

  return withRetry(async () => {
    if (blacklistedLeadsRef && !modoMemoria) {
      const doc = await blacklistedLeadsRef.doc(idLimpio).get();
      if (doc.exists) {
        if (memoryStore && memoryStore.blacklisted_leads) {
          memoryStore.blacklisted_leads.set(idLimpio, doc.data());
        }
        return true;
      }
      return false;
    }
    return memoryStore?.blacklisted_leads ? memoryStore.blacklisted_leads.has(idLimpio) : false;
  });
}

function limpiarObjetoParaFirestore(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const limpio = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      limpio[k] = v;
    }
  }
  return limpio;
}

/**
 * Inserta o actualiza un lote de leads en la colección 'leads' (Firestore o almacenamiento seguro local).
 * Opera con idempotencia mediante el id de cada lead y soporta reintentos con backoff.
 * 
 * @param {Array<object>} leads - Lote de leads a persistir
 * @returns {Promise<{ success: boolean, count: number, ids: string[] }>}
 */
async function upsertLeadsBatch(leads) {
  if (!Array.isArray(leads) || leads.length === 0) {
    return { success: true, count: 0, ids: [] };
  }

  const ids = [];
  const ahora = new Date().toISOString();

  // 1. Intentar persistencia prioritaria en Firebase Firestore
  if (db && typeof db.batch === 'function' && leadsRef) {
    try {
      const batch = db.batch();
      for (const lead of leads) {
        if (!lead || !lead.id) continue;
        const idLimpio = String(lead.id).trim();
        const docRef = leadsRef.doc(idLimpio);
        const registro = limpiarObjetoParaFirestore({
          ...lead,
          id: idLimpio,
          updatedAt: ahora
        });
        batch.set(docRef, registro, { merge: true });
        ids.push(idLimpio);
      }
      await batch.commit();
      return { success: true, count: ids.length, ids, storage: 'firestore' };
    } catch (firestoreError) {
      console.warn('[db:upsertLeadsBatch] Firestore no completó el batch, conmutando a fallback seguro:', firestoreError.message);
    }
  }

  // 2. Fallback resiliente en memoria / local_db.json (Zero-Crash)
  if (leadsRef) {
    for (const lead of leads) {
      if (!lead || !lead.id) continue;
      const idLimpio = String(lead.id).trim();
      const docRef = leadsRef.doc(idLimpio);
      const existenteSnap = await docRef.get().catch(() => null);
      const existente = (existenteSnap && existenteSnap.exists) ? (existenteSnap.data() || {}) : {};
      const registro = {
        ...existente,
        ...lead,
        id: idLimpio,
        updatedAt: ahora,
        createdAt: existente.createdAt || lead.createdAt || ahora
      };
      await docRef.set(registro, { merge: true });
      if (!ids.includes(idLimpio)) ids.push(idLimpio);
    }
    return { success: true, count: ids.length, ids, storage: 'local_fallback' };
  }

  return { success: true, count: 0, ids: [] };
}

/**
 * Verifica si un deviceId ya reclamó el regalo de cortesía.
 * @param {string} deviceId
 * @returns {Promise<boolean>}
 */
async function isDeviceClaimed(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') return false;
  const devLimpio = deviceId.trim();
  if (claimedDevicesRef) {
    try {
      const snap = await claimedDevicesRef.doc(devLimpio).get();
      return snap.exists;
    } catch (_) {}
  }
  return memoryStore?.claimed_devices ? memoryStore.claimed_devices.has(devLimpio) : false;
}

/**
 * Verifica si un correo electrónico ya reclamó el regalo de cortesía.
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function isEmailClaimed(email) {
  if (!email || typeof email !== 'string') return false;
  const emailLimpio = email.trim().toLowerCase();
  if (claimedEmailsRef) {
    try {
      const snap = await claimedEmailsRef.doc(emailLimpio).get();
      return snap.exists;
    } catch (_) {}
  }
  return memoryStore?.claimed_emails ? memoryStore.claimed_emails.has(emailLimpio) : false;
}

/**
 * Crea un token de un solo uso para verificar el correo y activar el regalo de bienvenida.
 * @param {string} celular
 * @param {string} email
 * @param {string} deviceId
 * @param {number} [minutosValidez=60]
 * @returns {Promise<{ token: string, expira: number }>}
 */
async function createWelcomeVerificationToken(celular, email, deviceId, minutosValidez = 60) {
  const crypto = require('crypto');
  const token = crypto.randomBytes(24).toString('hex');
  const expira = Date.now() + minutosValidez * 60 * 1000;
  const registro = {
    token,
    celular: cleanPhone(celular),
    email: (email || '').trim().toLowerCase(),
    deviceId: deviceId || null,
    expira,
    usado: false,
    createdAt: Date.now()
  };

  if (welcomeTokensRef) {
    try {
      await welcomeTokensRef.doc(token).set(registro);
      return { token, expira };
    } catch (_) {}
  }

  if (memoryStore?.welcome_tokens) {
    memoryStore.welcome_tokens.set(token, registro);
    if (typeof guardarAlmacenLocal === 'function') guardarAlmacenLocal();
  }
  return { token, expira };
}

/**
 * Quema el token de verificación, marca el dispositivo y correo como reclamados,
 * y acredita 1 crédito de regalo en Firestore para el usuario.
 * @param {string} token
 * @returns {Promise<{ ok: boolean, user?: Object, token?: string, error?: string }>}
 */
async function verifyAndBurnWelcomeToken(token) {
  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'TOKEN_INVALIDO' };
  }

  const tokenLimpio = token.trim();
  let tokenDoc = null;

  if (welcomeTokensRef) {
    try {
      const snap = await welcomeTokensRef.doc(tokenLimpio).get();
      if (snap.exists) {
        tokenDoc = snap.data();
      }
    } catch (_) {}
  }

  if (!tokenDoc && memoryStore?.welcome_tokens) {
    tokenDoc = memoryStore.welcome_tokens.get(tokenLimpio);
  }

  if (!tokenDoc) {
    return { ok: false, success: false, error: 'TOKEN_INVALIDO' };
  }

  if (tokenDoc.usado) {
    return { ok: false, success: false, error: 'TOKEN_YA_USADO' };
  }

  if (tokenDoc.expira && tokenDoc.expira < Date.now()) {
    return { ok: false, success: false, error: 'TOKEN_EXPIRADO' };
  }

  // 1. Quemar token
  const quemado = { ...tokenDoc, usado: true, burnedAt: Date.now() };
  if (welcomeTokensRef) {
    try {
      await welcomeTokensRef.doc(tokenLimpio).set(quemado, { merge: true });
    } catch (_) {}
  }
  if (memoryStore?.welcome_tokens) {
    memoryStore.welcome_tokens.set(tokenLimpio, quemado);
  }

  // 2. Marcar deviceId como reclamado
  if (tokenDoc.deviceId) {
    const devLimpio = tokenDoc.deviceId.trim();
    if (claimedDevicesRef) {
      try {
        await claimedDevicesRef.doc(devLimpio).set({
          claimedAt: Date.now(),
          celular: tokenDoc.celular,
          email: tokenDoc.email
        });
      } catch (_) {}
    }
    if (memoryStore?.claimed_devices) {
      memoryStore.claimed_devices.set(devLimpio, { claimedAt: Date.now() });
    }
  }

  // 3. Marcar email como reclamado
  if (tokenDoc.email) {
    const mailLimpio = tokenDoc.email.trim().toLowerCase();
    if (claimedEmailsRef) {
      try {
        await claimedEmailsRef.doc(mailLimpio).set({
          claimedAt: Date.now(),
          celular: tokenDoc.celular
        });
      } catch (_) {}
    }
    if (memoryStore?.claimed_emails) {
      memoryStore.claimed_emails.set(mailLimpio, { claimedAt: Date.now() });
    }
  }

  // 4. Acreditar 1 crédito al usuario en base de datos si no ha reclamado previamente
  const celular = tokenDoc.celular;
  const userActual = await getUserByPhone(celular);
  let userActualizado = userActual;

  if (!userActual || !userActual.welcomeCreditClaimed) {
    userActualizado = await addCredits(celular, 1, userActual?.pin || null);
    if (userActualizado) {
      await updateUserPreferences(celular, { welcomeCreditClaimed: true });
      userActualizado.welcomeCreditClaimed = true;
    }
  }

  if (tokenDoc.email && userActualizado) {
    await updateUserPreferences(celular, { email: tokenDoc.email });
    userActualizado.email = tokenDoc.email;
  }

  if (typeof guardarAlmacenLocal === 'function') guardarAlmacenLocal();

  return {
    ok: true,
    success: true,
    user: {
      phone: celular,
      credits: userActualizado?.credits ?? (userActual?.credits || 1),
      email: tokenDoc.email || userActualizado?.email,
      plan: userActualizado?.plan || 'free',
      pin: userActualizado?.pin || userActual?.pin,
      unlockedLeads: userActualizado?.unlockedLeads || userActual?.unlockedLeads || [],
      verified: true
    }
  };
}

module.exports = {
  getUserByPhone,
  getUserByPin,
  getUserByEmail,
  updateUserPreferences,
  addCredits,
  acreditarPagoUnaVez,
  unlockLead,
  isTransactionProcessed,
  recordTransaction,
  savePendingOrder,
  getPendingOrder,
  getPendingOrderByEmail,
  getPendingOrderByIdempotencyKey,
  getPendingOrders,
  updateOrderStatus,
  addBlacklistedLead,
  getBlacklistedLeadIds,
  isLeadBlacklisted,
  upsertLeadsBatch,
  isDeviceClaimed,
  isEmailClaimed,
  createWelcomeVerificationToken,
  verifyAndBurnWelcomeToken,
  consumeWelcomeVerificationToken: verifyAndBurnWelcomeToken,
  get leadsRef() { return leadsRef; },
  /** ¿Se usa la base en memoria y por qué? ('sin_credenciales_firestore' en pruebas/desarrollo, otra razón = fallo de Firestore en producción) */
  estadoAlmacenamiento() { return { memoria: modoMemoria, razon: razonModoMemoria }; },
  cleanPhone
};


