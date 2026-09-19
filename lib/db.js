const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { generatePin } = require('./crypto');

// Inicialización resiliente de Firebase Admin SDK
let db = null;
let usersRef = null;
let transactionsRef = null;
let ordersRef = null;
let magicTokensRef = null;
let claimedDevicesRef = null;
let claimedEmailsRef = null;
let welcomeTokensRef = null;
let blacklistedLeadsRef = null;
let retentionTokensRef = null;

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
  if (!getApps().length) {
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
    usersRef = db.collection('users');
    transactionsRef = db.collection('transactions');
    ordersRef = db.collection('orders');
    magicTokensRef = db.collection('magic_tokens');
    claimedDevicesRef = db.collection('claimed_devices');
    claimedEmailsRef = db.collection('claimed_emails');
    welcomeTokensRef = db.collection('welcome_tokens');
    blacklistedLeadsRef = db.collection('blacklisted_leads');
    retentionTokensRef = db.collection('retention_tokens');
  }
} catch (e) {
  console.warn('[db] Firebase no configurado o sin credenciales activas:', e.message);
}

// Almacenamiento seguro local y fallback resiliente para entornos serverless y tests
if (!db) {
  function resolverRutaAlmacenLocal() {
    if (process.env.LOCAL_DB_PATH) return process.env.LOCAL_DB_PATH;
    // En Vercel / AWS Lambda el sistema de archivos raíz es de solo lectura; /tmp es el único directorio con permisos de escritura
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
          magic_tokens: new Map(Object.entries(parsed.magic_tokens || {})),
          claimed_devices: new Map(Object.entries(parsed.claimed_devices || {})),
          claimed_emails: new Map(Object.entries(parsed.claimed_emails || {})),
          welcome_tokens: new Map(Object.entries(parsed.welcome_tokens || {})),
          blacklisted_leads: new Map(Object.entries(parsed.blacklisted_leads || {})),
          retention_tokens: new Map(Object.entries(parsed.retention_tokens || {}))
        };
      }
    } catch (e) {
      console.warn('[db] Error leyendo local_db.json:', e.message);
    }
    return {
      users: new Map(),
      transactions: new Map(),
      orders: new Map(),
      magic_tokens: new Map(),
      claimed_devices: new Map(),
      claimed_emails: new Map(),
      welcome_tokens: new Map(),
      blacklisted_leads: new Map(),
      retention_tokens: new Map()
    };
  }

  const memoryStore = cargarAlmacenLocal();

  function guardarAlmacenLocal() {
    try {
      const obj = {
        users: Object.fromEntries(memoryStore.users),
        transactions: Object.fromEntries(memoryStore.transactions),
        orders: Object.fromEntries(memoryStore.orders),
        magic_tokens: Object.fromEntries(memoryStore.magic_tokens || new Map()),
        claimed_devices: Object.fromEntries(memoryStore.claimed_devices || new Map()),
        claimed_emails: Object.fromEntries(memoryStore.claimed_emails || new Map()),
        welcome_tokens: Object.fromEntries(memoryStore.welcome_tokens || new Map()),
        blacklisted_leads: Object.fromEntries(memoryStore.blacklisted_leads || new Map()),
        retention_tokens: Object.fromEntries(memoryStore.retention_tokens || new Map())
      };
      const dir = path.dirname(LOCAL_DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {
      // Ignorar silenciosamente en entornos de solo lectura sin permisos
    }
  }

  function createMemoryCollection(collectionName) {
    const store = memoryStore[collectionName];
    return {
      doc(id) {
        return {
          id: String(id),
          async get() {
            const val = store.get(String(id));
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
      async get() {
        return {
          docs: Array.from(store.keys()).map(k => ({
            id: k,
            data: () => JSON.parse(JSON.stringify(store.get(k)))
          }))
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

  db = {
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

  usersRef = createMemoryCollection('users');
  transactionsRef = createMemoryCollection('transactions');
  ordersRef = createMemoryCollection('orders');
  magicTokensRef = createMemoryCollection('magic_tokens');
  claimedDevicesRef = createMemoryCollection('claimed_devices');
  claimedEmailsRef = createMemoryCollection('claimed_emails');
  welcomeTokensRef = createMemoryCollection('welcome_tokens');
  blacklistedLeadsRef = createMemoryCollection('blacklisted_leads');
  retentionTokensRef = createMemoryCollection('retention_tokens');
}

function cleanPhone(phone) {
  if (!phone) return '';
  const num = String(phone).replace(/\D/g, '');
  return num.startsWith('57') && num.length === 12 ? num.substring(2) : num;
}

/**
 * Ejecuta una operación asíncrona de base de datos con reintentos exponenciales y jitter aleatorio.
 * Proporciona resiliencia ante cortes momentáneos de red, cuellos de botella y picos de tráfico.
 * 
 * @template T
 * @param {() => Promise<T>} operacion - Función asíncrona a ejecutar
 * @param {number} [maxIntentos=3] - Número máximo de intentos antes de fallar
 * @returns {Promise<T>}
 */
async function withRetry(operacion, maxIntentos = 3) {
  let delay = 200;
  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      return await operacion();
    } catch (err) {
      if (intento === maxIntentos) throw err;
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

async function addCredits(phone, creditsToAdd = 0, pin = null, planData = null, email = null) {
  const normPhone = cleanPhone(phone);
  if (!normPhone) throw new Error('Número de teléfono inválido');

  const userRef = usersRef.doc(normPhone);
  
  return await withRetry(async () => {
    return await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
    let existing;
    if (doc.exists) {
      existing = doc.data();
    } else {
      existing = {
        phone: normPhone,
        pin: pin || generatePin(normPhone),
        credits: 0,
        plan: 'free',
        planCity: null,
        planExpiresAt: null,
        unlockedLeads: [],
        createdAt: new Date().toISOString()
      };
    }

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
    t.set(userRef, existing);
    return existing;
  });
  });
}

async function unlockLead(phone, leadId, sessionData = null, leadCity = null) {
  const normPhone = cleanPhone(phone);
  if (!normPhone || !leadId) {
    return { success: false, error: 'DATOS_INVALIDOS' };
  }

  const userRef = usersRef.doc(normPhone);

  return await withRetry(async () => {
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
  const docRef = transactionsRef.doc(transactionId);
  return await withRetry(async () => {
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
 * Actualiza campos permitidos del documento de usuario (planes, timestamps, etc.)
 * @param {string} phone 
 * @param {object} updates 
 * @returns {Promise<object|null>}
 */
async function updateUser(phone, updates = {}) {
  const normPhone = cleanPhone(phone);
  if (!normPhone || !usersRef) return null;
  return await withRetry(async () => {
    const userRef = usersRef.doc(normPhone);
    const doc = await userRef.get();
    if (!doc.exists) return null;
    const finalUpdates = { ...updates, updatedAt: new Date().toISOString() };
    await userRef.set(finalUpdates, { merge: true });
    return { ...doc.data(), ...finalUpdates };
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
 * Verifica si un identificador de dispositivo (Device Fingerprint) ya utilizó el crédito freemium.
 * 
 * @param {string} deviceId
 * @returns {Promise<boolean>}
 */
async function isDeviceClaimed(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') return false;
  try {
    const doc = await claimedDevicesRef.doc(String(deviceId).trim()).get();
    return Boolean(doc && doc.exists);
  } catch (_) {
    return false;
  }
}

/**
 * Verifica si una dirección de correo (canonizada) ya utilizó el crédito freemium.
 * 
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function isEmailClaimed(email) {
  if (!email || typeof email !== 'string') return false;
  const { normalizarEmail } = require('./validation');
  const canonico = normalizarEmail(email);
  if (!canonico) return false;
  try {
    const doc = await claimedEmailsRef.doc(canonico).get();
    return Boolean(doc && doc.exists);
  } catch (_) {
    return false;
  }
}

/**
 * Genera y almacena un token criptográfico de activación de bienvenida (Doble Opt-In).
 * 
 * @param {string} phone
 * @param {string} email
 * @param {string} [deviceId]
 * @param {number} [ttlMinutes=60]
 * @returns {Promise<{ token: string, expiresAt: string }>}
 */
async function createWelcomeVerificationToken(phone, email, deviceId = null, ttlMinutes = 60) {
  const { normalizarEmail } = require('./validation');
  const normPhone = cleanPhone(phone);
  const normEmail = email ? normalizarEmail(email) : null;
  const tokenBytes = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlMinutes * 60 * 1000).toISOString();

  const tokenData = {
    token: tokenBytes,
    phone: normPhone,
    email: normEmail,
    deviceId: deviceId ? String(deviceId).trim() : null,
    createdAt: createdAt.toISOString(),
    expiresAt,
    used: false,
    usedAt: null
  };

  await withRetry(async () => {
    await welcomeTokensRef.doc(tokenBytes).set(tokenData);
  });

  return { token: tokenBytes, expiresAt };
}

/**
 * Valida y consume de forma atómica un token de activación de bienvenida.
 * Quema el token, registra el dispositivo en claimed_devices, el correo en claimed_emails
 * y acredita 1 crédito de regalo al usuario en una única transacción de Firestore.
 * 
 * @param {string} token
 * @returns {Promise<{ success: boolean, user?: object, error?: string, message?: string, alreadyClaimed?: boolean }>}
 */
async function consumeWelcomeVerificationToken(token) {
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'TOKEN_INVALIDO', message: 'Token de activación inválido.' };
  }

  const tokenRef = welcomeTokensRef.doc(token.trim());

  return await withRetry(async () => {
    return await db.runTransaction(async (t) => {
      const tokenDoc = await t.get(tokenRef);
      if (!tokenDoc.exists) {
        return { success: false, error: 'TOKEN_NO_ENCONTRADO', message: 'El enlace de activación no es válido o ha expirado.' };
      }

      const tokenData = tokenDoc.data();
      if (tokenData.used) {
        return { success: false, error: 'TOKEN_YA_USADO', message: 'Este enlace de activación ya fue utilizado previamente.' };
      }

      if (new Date() > new Date(tokenData.expiresAt)) {
        return { success: false, error: 'TOKEN_EXPIRADO', message: 'El enlace de activación ha expirado. Solicita uno nuevo.' };
      }

      // Verificación de Device Fingerprint en Firestore
      if (tokenData.deviceId) {
        const devDoc = await t.get(claimedDevicesRef.doc(tokenData.deviceId));
        if (devDoc.exists) {
          return {
            success: false,
            alreadyClaimed: true,
            error: 'DISPOSITIVO_YA_RECLAMADO',
            message: 'Este dispositivo ya utilizó su regalo de bienvenida de cortesía.'
          };
        }
      }

      // Verificación de Email Canonizado en Firestore
      if (tokenData.email) {
        const emailDoc = await t.get(claimedEmailsRef.doc(tokenData.email));
        if (emailDoc.exists) {
          return {
            success: false,
            alreadyClaimed: true,
            error: 'EMAIL_YA_RECLAMADO',
            message: 'Este correo electrónico ya utilizó su crédito gratuito de bienvenida.'
          };
        }
      }

      // Verificación del usuario por teléfono
      const userRef = usersRef.doc(tokenData.phone);
      const userDoc = await t.get(userRef);
      let user;

      if (userDoc.exists) {
        user = userDoc.data();
        if (user.welcomeCreditClaimed) {
          return {
            success: false,
            alreadyClaimed: true,
            error: 'CREDITO_YA_RECLAMADO',
            message: 'Este número de WhatsApp ya utilizó su crédito gratuito de bienvenida.'
          };
        }
        user.credits = Number(user.credits || 0) + 1;
        user.welcomeCreditClaimed = true;
        user.welcomeCreditAt = new Date().toISOString();
        if (tokenData.email && !user.email) user.email = tokenData.email;
        user.updatedAt = new Date().toISOString();
      } else {
        user = {
          phone: tokenData.phone,
          pin: generatePin(tokenData.phone),
          credits: 1,
          welcomeCreditClaimed: true,
          welcomeCreditAt: new Date().toISOString(),
          email: tokenData.email,
          plan: 'free',
          planCity: null,
          planExpiresAt: null,
          unlockedLeads: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      // Quemar token de activación
      t.set(tokenRef, { ...tokenData, used: true, usedAt: new Date().toISOString() });

      // Registrar dispositivo en lista de reclamados
      if (tokenData.deviceId) {
        t.set(claimedDevicesRef.doc(tokenData.deviceId), {
          phone: tokenData.phone,
          email: tokenData.email,
          claimedAt: new Date().toISOString()
        });
      }

      // Registrar email canonizado en lista de reclamados
      if (tokenData.email) {
        t.set(claimedEmailsRef.doc(tokenData.email), {
          phone: tokenData.phone,
          claimedAt: new Date().toISOString()
        });
      }

      // Guardar usuario con crédito acreditado
      t.set(userRef, user);

      return {
        success: true,
        user
      };
    });
  });
}

/**
 * Acredita de forma atómica 1 crédito de bienvenida gratuito a un número nuevo de WhatsApp.
 * Protegido contra concurrencia mediante transacciones en Firestore / MemoryStore.
 * Integra validación de Device Fingerprint y Email Canonizado.
 * 
 * @param {string} phone - Celular del usuario (10 dígitos)
 * @param {string} email - Correo del usuario
 * @param {string} [deviceId] - Identificador de hardware del navegador
 * @returns {Promise<{ success: boolean, user?: object, error?: string, message?: string, alreadyClaimed?: boolean }>}
 */
async function claimWelcomeCredit(phone, email, deviceId = null) {
  const { normalizarEmail } = require('./validation');
  const normPhone = cleanPhone(phone);
  const normEmail = email ? normalizarEmail(email) : null;
  const cleanDeviceId = deviceId ? String(deviceId).trim() : null;
  if (!normPhone) return { success: false, error: 'NUMERO_INVALIDO', message: 'Número de WhatsApp inválido.' };

  const userRef = usersRef.doc(normPhone);

  return await withRetry(async () => {
    return await db.runTransaction(async (t) => {
      // 1. Validar si el dispositivo ya reclamó
      if (cleanDeviceId) {
        const devDoc = await t.get(claimedDevicesRef.doc(cleanDeviceId));
        if (devDoc.exists) {
          return {
            success: false,
            alreadyClaimed: true,
            error: 'DISPOSITIVO_YA_RECLAMADO',
            message: 'Este dispositivo ya utilizó su regalo de bienvenida de cortesía.'
          };
        }
      }

      // 2. Validar si el correo canonizado ya reclamó
      if (normEmail) {
        const emailDoc = await t.get(claimedEmailsRef.doc(normEmail));
        if (emailDoc.exists) {
          return {
            success: false,
            alreadyClaimed: true,
            error: 'EMAIL_YA_RECLAMADO',
            message: 'Este correo electrónico ya utilizó su crédito gratuito de bienvenida.'
          };
        }
      }

      // 3. Validar si el celular ya reclamó
      const doc = await t.get(userRef);
      let user;

      if (doc.exists) {
        user = doc.data();
        if (user.welcomeCreditClaimed) {
          return {
            success: false,
            alreadyClaimed: true,
            error: 'CREDITO_YA_RECLAMADO',
            message: 'Este número de WhatsApp ya utilizó su crédito gratuito de bienvenida.'
          };
        }
        user.credits = Number(user.credits || 0) + 1;
        user.welcomeCreditClaimed = true;
        user.welcomeCreditAt = new Date().toISOString();
        if (normEmail && !user.email) user.email = normEmail;
        user.updatedAt = new Date().toISOString();
      } else {
        user = {
          phone: normPhone,
          pin: generatePin(normPhone),
          credits: 1,
          welcomeCreditClaimed: true,
          welcomeCreditAt: new Date().toISOString(),
          email: normEmail,
          plan: 'free',
          planCity: null,
          planExpiresAt: null,
          unlockedLeads: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      // Marcar dispositivo si se proporcionó
      if (cleanDeviceId) {
        t.set(claimedDevicesRef.doc(cleanDeviceId), {
          phone: normPhone,
          email: normEmail,
          claimedAt: new Date().toISOString()
        });
      }

      // Marcar email canonizado si se proporcionó
      if (normEmail) {
        t.set(claimedEmailsRef.doc(normEmail), {
          phone: normPhone,
          claimedAt: new Date().toISOString()
        });
      }

      t.set(userRef, user);
      return {
        success: true,
        user
      };
    });
  });
}

/**
 * Genera y almacena un token criptográfico de un solo uso para inicio de sesión sin contraseña.
 * 
 * @param {string} phone
 * @param {string} email
 * @param {number} [ttlMinutes=30]
 * @returns {Promise<{ token: string, expiresAt: string }>}
 */
async function createMagicToken(phone, email, ttlMinutes = 30) {
  const normPhone = cleanPhone(phone);
  const normEmail = email ? String(email).toLowerCase().trim() : null;
  const tokenBytes = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlMinutes * 60 * 1000).toISOString();

  const tokenData = {
    token: tokenBytes,
    phone: normPhone,
    email: normEmail,
    createdAt: createdAt.toISOString(),
    expiresAt,
    used: false,
    usedAt: null
  };

  await withRetry(async () => {
    await magicTokensRef.doc(tokenBytes).set(tokenData);
  });

  return { token: tokenBytes, expiresAt };
}

/**
 * Consume un token de acceso rápido de forma atómica.
 * Invalida el token para que no pueda ser reutilizado en el futuro.
 * 
 * @param {string} token
 * @returns {Promise<{ success: boolean, user?: object, error?: string, message?: string }>}
 */
async function consumeMagicToken(token) {
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'TOKEN_INVALIDO', message: 'Token de acceso no proporcionado.' };
  }

  const tokenRef = magicTokensRef.doc(token.trim());

  return await withRetry(async () => {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(tokenRef);
      if (!snap.exists) {
        return { success: false, error: 'TOKEN_NO_ENCONTRADO', message: 'El enlace de acceso no existe o ya caducó.' };
      }

      const tokenDoc = snap.data();
      if (tokenDoc.used) {
        return { success: false, error: 'TOKEN_YA_USADO', message: 'Este enlace de acceso ya fue utilizado previamente.' };
      }

      if (new Date() > new Date(tokenDoc.expiresAt)) {
        return { success: false, error: 'TOKEN_EXPIRADO', message: 'El enlace de acceso ha expirado. Solicita uno nuevo.' };
      }

      // Marcar token como consumido de forma inmutable
      tokenDoc.used = true;
      tokenDoc.usedAt = new Date().toISOString();
      t.set(tokenRef, tokenDoc);

      // Obtener datos del usuario
      const userDoc = await usersRef.doc(tokenDoc.phone).get();
      if (!userDoc.exists) {
        return { success: false, error: 'USUARIO_NO_ENCONTRADO', message: 'Usuario no encontrado.' };
      }

      return {
        success: true,
        user: userDoc.data()
      };
    });
  });
}

/**
 * Comprueba si un identificador de hardware / device fingerprint ya reclamó un regalo freemium.
 * 
 * @param {string} deviceId
 * @returns {Promise<boolean>}
 */
async function isDeviceClaimed(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') return false;
  const cleanId = String(deviceId).trim();
  if (!cleanId) return false;

  return await withRetry(async () => {
    const doc = await claimedDevicesRef.doc(cleanId).get();
    return doc.exists;
  });
}

/**
 * Comprueba si un correo electrónico canonizado ya reclamó un regalo freemium.
 * 
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function isEmailClaimed(email) {
  if (!email || typeof email !== 'string') return false;
  const { normalizarEmail } = require('./validation');
  const canonico = normalizarEmail(email);
  if (!canonico) return false;

  return await withRetry(async () => {
    const doc = await claimedEmailsRef.doc(canonico).get();
    return doc.exists;
  });
}

/**
 * Genera y persiste un token de activación de bienvenida para Doble Opt-In por correo.
 * 
 * @param {string} phone
 * @param {string} email
 * @param {string} [deviceId]
 * @param {number} [ttlMinutes=60]
 * @returns {Promise<{ token: string, expiresAt: string }>}
 */
async function createWelcomeVerificationToken(phone, email, deviceId = null, ttlMinutes = 60) {
  const { normalizarEmail } = require('./validation');
  const normPhone = cleanPhone(phone);
  const normEmail = email ? normalizarEmail(email) : null;
  const cleanDeviceId = deviceId ? String(deviceId).trim() : null;
  const tokenBytes = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlMinutes * 60 * 1000).toISOString();

  const tokenData = {
    token: tokenBytes,
    phone: normPhone,
    email: normEmail,
    deviceId: cleanDeviceId,
    createdAt: createdAt.toISOString(),
    expiresAt,
    used: false,
    usedAt: null
  };

  await withRetry(async () => {
    await welcomeTokensRef.doc(tokenBytes).set(tokenData);
  });

  return { token: tokenBytes, expiresAt };
}

/**
 * Consume un token de activación de bienvenida en transacción atómica.
 * Otorga 1 crédito de regalo, emite el PIN de respaldo y registra el dispositivo y correo para blindar contra Sybil.
 * 
 * @param {string} token
 * @returns {Promise<{ success: boolean, user?: object, error?: string, message?: string, alreadyClaimed?: boolean }>}
 */
async function consumeWelcomeVerificationToken(token) {
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'TOKEN_INVALIDO', message: 'Token de activación no proporcionado.' };
  }

  const tokenRef = welcomeTokensRef.doc(token.trim());

  return await withRetry(async () => {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(tokenRef);
      if (!snap.exists) {
        return { success: false, error: 'TOKEN_NO_ENCONTRADO', message: 'El enlace de activación no existe o ya caducó.' };
      }

      const tokenDoc = snap.data();
      if (tokenDoc.used) {
        return { success: false, error: 'TOKEN_YA_USADO', message: 'Este enlace de activación ya fue utilizado previamente.' };
      }

      if (new Date() > new Date(tokenDoc.expiresAt)) {
        return { success: false, error: 'TOKEN_EXPIRADO', message: 'El enlace de activación ha expirado. Solicita uno nuevo.' };
      }

      // Validar si el dispositivo ya fue registrado como reclamado
      if (tokenDoc.deviceId) {
        const devDoc = await t.get(claimedDevicesRef.doc(tokenDoc.deviceId));
        if (devDoc.exists) {
          return {
            success: false,
            alreadyClaimed: true,
            error: 'DISPOSITIVO_YA_RECLAMADO',
            message: 'Este dispositivo ya utilizó su regalo de bienvenida de cortesía.'
          };
        }
      }

      // Validar si el correo canonizado ya fue registrado
      if (tokenDoc.email) {
        const emailDoc = await t.get(claimedEmailsRef.doc(tokenDoc.email));
        if (emailDoc.exists) {
          return {
            success: false,
            alreadyClaimed: true,
            error: 'EMAIL_YA_RECLAMADO',
            message: 'Este correo electrónico ya utilizó su crédito gratuito de bienvenida.'
          };
        }
      }

      // Validar si el número de WhatsApp ya reclamó
      const userRef = usersRef.doc(tokenDoc.phone);
      const userSnap = await t.get(userRef);
      let user;

      if (userSnap.exists) {
        user = userSnap.data();
        if (user.welcomeCreditClaimed) {
          return {
            success: false,
            alreadyClaimed: true,
            error: 'CREDITO_YA_RECLAMADO',
            message: 'Este número de WhatsApp ya utilizó su crédito gratuito de bienvenida.'
          };
        }
        user.credits = Number(user.credits || 0) + 1;
        user.welcomeCreditClaimed = true;
        user.welcomeCreditAt = new Date().toISOString();
        if (tokenDoc.email && !user.email) user.email = tokenDoc.email;
        user.updatedAt = new Date().toISOString();
      } else {
        user = {
          phone: tokenDoc.phone,
          pin: generatePin(tokenDoc.phone),
          credits: 1,
          welcomeCreditClaimed: true,
          welcomeCreditAt: new Date().toISOString(),
          email: tokenDoc.email,
          plan: 'free',
          planCity: null,
          planExpiresAt: null,
          unlockedLeads: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      // Inhabilitar token
      tokenDoc.used = true;
      tokenDoc.usedAt = new Date().toISOString();
      t.set(tokenRef, tokenDoc);

      // Registrar dispositivo en claimed_devices
      if (tokenDoc.deviceId) {
        t.set(claimedDevicesRef.doc(tokenDoc.deviceId), {
          phone: tokenDoc.phone,
          email: tokenDoc.email,
          claimedAt: new Date().toISOString()
        });
      }

      // Registrar correo en claimed_emails
      if (tokenDoc.email) {
        t.set(claimedEmailsRef.doc(tokenDoc.email), {
          phone: tokenDoc.phone,
          claimedAt: new Date().toISOString()
        });
      }

      t.set(userRef, user);

      return {
        success: true,
        user
      };
    });
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

  return withRetry(async () => {
    await blacklistedLeadsRef.doc(idLimpio).set(registro, { merge: true });
    return { success: true, leadId: idLimpio };
  });
}

/**
 * Consulta la lista de todos los IDs de inmuebles desindexados.
 * @returns {Promise<string[]>}
 */
async function getBlacklistedLeadIds() {
  return withRetry(async () => {
    const snap = await blacklistedLeadsRef.get();
    return snap.docs.map(d => d.id);
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
  return withRetry(async () => {
    const doc = await blacklistedLeadsRef.doc(idLimpio).get();
    return doc.exists;
  });
}

/**
 * Crea un token criptográfico de retención / rescate / renovación.
 * @param {string} phone Teléfono del usuario
 * @param {object} opciones { type: 'rescue_credits'|'renewal_prompt'|'low_balance', creditsToGrant: number, ttlHours: number, campaign: string }
 * @returns {Promise<{ token: string, expiresAt: string, type: string }>}
 */
async function createRetentionToken(phone, opciones = {}) {
  const normPhone = cleanPhone(phone);
  if (!normPhone) throw new Error('Teléfono inválido para token de retención');

  const tokenBytes = crypto.randomBytes(32).toString('hex');
  const ttlHours = Number(opciones.ttlHours || 72); // Por defecto 72 horas (3 días)
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

  const tokenData = {
    token: tokenBytes,
    phone: normPhone,
    type: opciones.type || 'rescue_credits',
    creditsToGrant: Number(opciones.creditsToGrant || 0),
    campaign: opciones.campaign || 'general_retention',
    metadata: opciones.metadata || {},
    createdAt: createdAt.toISOString(),
    expiresAt,
    used: false,
    usedAt: null
  };

  await withRetry(async () => {
    await retentionTokensRef.doc(tokenBytes).set(tokenData);
  });

  return { token: tokenBytes, expiresAt, type: tokenData.type };
}

/**
 * Consume atómicamente un token de retención / rescate.
 * Si otorga créditos, valida que el usuario no haya abusado del beneficio en los últimos 45 días.
 * @param {string} token
 * @returns {Promise<{ success: boolean, user?: object, creditsGranted?: number, error?: string, message?: string }>}
 */
async function consumeRetentionToken(token) {
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'TOKEN_INVALIDO', message: 'Token de retención no proporcionado.' };
  }

  const cleanToken = token.trim();
  const tokenRef = retentionTokensRef.doc(cleanToken);

  return await withRetry(async () => {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(tokenRef);
      if (!snap.exists) {
        return { success: false, error: 'TOKEN_NO_ENCONTRADO', message: 'El enlace de retención no existe o ya caducó.' };
      }

      const tokenDoc = snap.data();

      // 1. Validar si ya fue usado
      if (tokenDoc.used) {
        return { success: false, error: 'TOKEN_YA_USADO', message: 'Este enlace de beneficio ya fue utilizado previamente.' };
      }

      // 2. Validar expiración temporal (TTL)
      if (new Date() > new Date(tokenDoc.expiresAt)) {
        return { success: false, error: 'TOKEN_EXPIRADO', message: 'El enlace de beneficio ha caducado.' };
      }

      // 3. Obtener el usuario asociado
      const userRef = usersRef.doc(tokenDoc.phone);
      const userSnap = await t.get(userRef);

      if (!userSnap.exists) {
        return { success: false, error: 'USUARIO_NO_ENCONTRADO', message: 'La cuenta asociada al beneficio no existe.' };
      }

      const user = userSnap.data();
      const creditsToGrant = Number(tokenDoc.creditsToGrant || 0);

      // 4. Si el token otorga créditos de rescate, validar regla anti-abuso de 45 días
      if (tokenDoc.type === 'rescue_credits' && creditsToGrant > 0) {
        if (user.lastRescueCreditAt) {
          const ultimoRescate = new Date(user.lastRescueCreditAt).getTime();
          const diasDesdeUltimo = (Date.now() - ultimoRescate) / (1000 * 60 * 60 * 24);
          if (diasDesdeUltimo < 45) {
            return {
              success: false,
              error: 'RESCATE_YA_UTILIZADO_RECIENTEMENTE',
              message: 'Ya se utilizó un beneficio de reactivación recientemente en esta cuenta.'
            };
          }
        }
        // Aplicar créditos y estampar marca de tiempo de rescate
        user.credits = Number(user.credits || 0) + creditsToGrant;
        user.lastRescueCreditAt = new Date().toISOString();
      }

      user.updatedAt = new Date().toISOString();

      // 5. Inhabilitar token atómicamente
      tokenDoc.used = true;
      tokenDoc.usedAt = new Date().toISOString();

      t.set(tokenRef, tokenDoc);
      t.set(userRef, user);

      return {
        success: true,
        user,
        creditsGranted: creditsToGrant,
        type: tokenDoc.type,
        campaign: tokenDoc.campaign
      };
    });
  });
}

module.exports = {
  getUserByPhone,
  getUserByPin,
  getUserByEmail,
  updateUserPreferences,
  updateUser,
  addCredits,
  unlockLead,
  isTransactionProcessed,
  recordTransaction,
  savePendingOrder,
  getPendingOrder,
  getPendingOrderByEmail,
  getPendingOrderByIdempotencyKey,
  getPendingOrders,
  updateOrderStatus,
  claimWelcomeCredit,
  createMagicToken,
  consumeMagicToken,
  isDeviceClaimed,
  isEmailClaimed,
  createWelcomeVerificationToken,
  consumeWelcomeVerificationToken,
  cleanPhone,
  addBlacklistedLead,
  getBlacklistedLeadIds,
  isLeadBlacklisted,
  createRetentionToken,
  consumeRetentionToken,
  getFirestoreInstance: () => db
};



