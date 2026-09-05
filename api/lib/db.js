const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const { generatePin } = require('./crypto');

// Inicialización de Firebase Admin SDK
if (!getApps().length) {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const parsed = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : process.env.FIREBASE_SERVICE_ACCOUNT;
      credential = cert(parsed);
    } catch (e) {
      console.warn('[db] Error parseando FIREBASE_SERVICE_ACCOUNT:', e.message);
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
      // En desarrollo sin archivo local se usan credenciales por defecto del entorno
    }
  }

  initializeApp({
    credential: credential,
    projectId: 'hunter-pro-showcase'
  });
}

const db = getFirestore();
const usersRef = db.collection('users');
const transactionsRef = db.collection('transactions');
const ordersRef = db.collection('orders');

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
  if (!normPhone) return null;

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

async function addCredits(phone, creditsToAdd = 0, pin = null, planData = null) {
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

async function savePendingOrder(reference, orderData) {
  return await withRetry(async () => {
    await ordersRef.doc(reference).set({
      ...orderData,
      createdAt: new Date().toISOString()
    });
  });
}

async function getPendingOrder(reference) {
  return await withRetry(async () => {
    const doc = await ordersRef.doc(reference).get();
    return doc.exists ? doc.data() : null;
  });
}

module.exports = {
  getUserByPhone,
  getUserByPin,
  addCredits,
  unlockLead,
  isTransactionProcessed,
  recordTransaction,
  savePendingOrder,
  getPendingOrder,
  cleanPhone
};
