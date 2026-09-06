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

try {
  if (!getApps().length) {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const rawSa = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
        ? process.env.FIREBASE_SERVICE_ACCOUNT.trim()
        : '';
      
      if (typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'object') {
        try {
          credential = cert(process.env.FIREBASE_SERVICE_ACCOUNT);
        } catch (e) {
          console.warn('[db] Error cargando objeto FIREBASE_SERVICE_ACCOUNT:', e.message);
        }
      } else if (rawSa.startsWith('{')) {
        try {
          const parsed = JSON.parse(rawSa);
          const normalized = {
            projectId: parsed.project_id || parsed.projectId || 'hunter-pro-showcase',
            clientEmail: parsed.client_email || parsed.clientEmail || parsed.correo_cliente || 'firebase-adminsdk-fbsvc@hunter-pro-showcase.iam.gserviceaccount.com',
            privateKey: (parsed.private_key || parsed.clave_privada || '').replace(/\\n/g, '\n')
          };
          if (normalized.privateKey && normalized.clientEmail) {
            credential = cert(normalized);
          } else {
            credential = cert(parsed);
          }
          console.log('[db] Conexión autenticada a Firebase Firestore establecida con éxito.');
        } catch (e) {
          console.warn('[db] Error parseando JSON en FIREBASE_SERVICE_ACCOUNT:', e.message);
        }
      } else if (rawSa.startsWith('-----BEGIN')) {
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@hunter-pro-showcase.iam.gserviceaccount.com';
        const projectId = process.env.FIREBASE_PROJECT_ID || 'hunter-pro-showcase';
        if (clientEmail) {
          try {
            credential = cert({
              projectId,
              clientEmail,
              privateKey: rawSa.replace(/\\n/g, '\n')
            });
            console.log('[db] Conexión autenticada a Firebase Firestore (hunter-pro-showcase) establecida con éxito.');
          } catch (e) {
            console.warn('[db] Error inicializando credencial desde PEM:', e.message);
          }
        } else {
          console.info('[db] FIREBASE_SERVICE_ACCOUNT requiere el correo de la cuenta de servicio.');
        }
      } else {
        // Intentar decodificar como Base64
        try {
          const decoded = Buffer.from(rawSa, 'base64').toString('utf8');
          if (decoded.trim().startsWith('{')) {
            credential = cert(JSON.parse(decoded));
          }
        } catch (e) {
          console.warn('[db] Formato no reconocido para FIREBASE_SERVICE_ACCOUNT. Usando almacenamiento seguro en memoria.');
        }
      }
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      try {
        const serviceAccountJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
        credential = cert(JSON.parse(serviceAccountJson));
      } catch (e) {
        console.warn('[db] Error decodificando FIREBASE_SERVICE_ACCOUNT_BASE64:', e.message);
      }
    } else if (process.env.NODE_ENV !== 'production') {
      try {
        const serviceAccount = require('../../service-account.json');
        credential = cert(serviceAccount);
      } catch (e) {
        // En desarrollo sin archivo local
      }
    }

    if (credential) {
      initializeApp({
        credential: credential,
        projectId: 'hunter-pro-showcase'
      });
    }
  }

  if (getApps().length) {
    db = getFirestore();
    usersRef = db.collection('users');
    transactionsRef = db.collection('transactions');
    ordersRef = db.collection('orders');
  }
} catch (e) {
  console.warn('[db] Firebase no configurado o sin credenciales activas:', e.message);
}

// Almacenamiento seguro en memoria para pruebas locales y fallback sin credenciales
if (!db) {
  const LOCAL_DB_PATH = path.join(__dirname, '../../data/local_db.json');

  function cargarAlmacenLocal() {
    try {
      if (fs.existsSync(LOCAL_DB_PATH)) {
        const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          users: new Map(Object.entries(parsed.users || {})),
          transactions: new Map(Object.entries(parsed.transactions || {})),
          orders: new Map(Object.entries(parsed.orders || {}))
        };
      }
    } catch (e) {
      console.warn('[db] Error leyendo local_db.json:', e.message);
    }
    return {
      users: new Map(),
      transactions: new Map(),
      orders: new Map()
    };
  }

  const memoryStore = cargarAlmacenLocal();

  function guardarAlmacenLocal() {
    try {
      const obj = {
        users: Object.fromEntries(memoryStore.users),
        transactions: Object.fromEntries(memoryStore.transactions),
        orders: Object.fromEntries(memoryStore.orders)
      };
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {
      // Ignorar en entornos de sólo lectura
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
          async set(data) {
            store.set(String(id), JSON.parse(JSON.stringify(data)));
            guardarAlmacenLocal();
          }
        };
      },
      where(field, op, expectedVal) {
        return {
          limit(n) {
            return {
              async get() {
                const results = [];
                for (const item of store.values()) {
                  if (op === '==' && item[field] === expectedVal) {
                    results.push({ data: () => JSON.parse(JSON.stringify(item)) });
                    if (results.length >= n) break;
                  }
                }
                return {
                  empty: results.length === 0,
                  docs: results
                };
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
        set(docRef, data) {
          docRef.set(data);
        }
      };
      return await updateFunction(transaction);
    }
  };

  usersRef = createMemoryCollection('users');
  transactionsRef = createMemoryCollection('transactions');
  ordersRef = createMemoryCollection('orders');
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
      user.unlockedLeads.push(leadId);
      user.updatedAt = new Date().toISOString();
      t.set(userRef, user);
      return {
        success: true,
        alreadyUnlocked: false,
        credits: Number(user.credits || 0),
        unlockedLeads: user.unlockedLeads,
        planBenefit: true,
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

module.exports = {
  getUserByPhone,
  getUserByPin,
  getUserByEmail,
  addCredits,
  unlockLead,
  isTransactionProcessed,
  recordTransaction,
  savePendingOrder,
  getPendingOrder,
  getPendingOrderByEmail,
  getPendingOrderByIdempotencyKey,
  cleanPhone
};
