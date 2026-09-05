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
  } else {
    try {
      const serviceAccount = require('../../service-account.json');
      credential = cert(serviceAccount);
    } catch (e) {
      console.warn('[db] Advertencia: No se encontró service-account.json local. Usando credenciales por defecto.', e.message);
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

async function getUserByPhone(phone) {
  const normPhone = cleanPhone(phone);
  if (!normPhone) return null;

  const doc = await usersRef.doc(normPhone).get();
  if (!doc.exists) {
    return null;
  }
  
  return doc.data();
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

  // 3. Coincidencia solo por los 4 dígitos (ej. el usuario ingresó "4357" o "HNT4357")
  const digitsInput = normInput.replace(/^HNT/, '');
  const digitsUserPin = normUserPin.replace(/^HNT/, '');
  if (digitsInput && digitsUserPin && digitsInput === digitsUserPin) {
    return user;
  }

  // 4. Fallback de resiliencia: si coincide con los últimos 4 dígitos del celular
  const phoneClean = cleanPhone(phone);
  if (phoneClean && digitsInput && digitsInput === phoneClean.slice(-4)) {
    return user;
  }

  return null;
}

async function addCredits(phone, creditsToAdd = 0, pin = null, planData = null) {
  const normPhone = cleanPhone(phone);
  if (!normPhone) throw new Error('Número de teléfono inválido');

  const userRef = usersRef.doc(normPhone);
  
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
      const days = planData.days || 30;
      existing.planExpiresAt = new Date(Date.now() + days * 86400 * 1000).toISOString();
    }

    existing.updatedAt = new Date().toISOString();
    t.set(userRef, existing);
    return existing;
  });
}

async function unlockLead(phone, leadId, sessionData = null, leadCity = null) {
  const normPhone = cleanPhone(phone);
  if (!normPhone || !leadId) {
    return { success: false, error: 'DATOS_INVALIDOS' };
  }

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
}

async function isTransactionProcessed(transactionId) {
  if (!transactionId) return false;
  const doc = await transactionsRef.doc(transactionId).get();
  return doc.exists;
}

async function recordTransaction(transactionId, data) {
  if (!transactionId) return false;
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
}

async function savePendingOrder(reference, orderData) {
  await ordersRef.doc(reference).set({
    ...orderData,
    createdAt: new Date().toISOString()
  });
}

async function getPendingOrder(reference) {
  const doc = await ordersRef.doc(reference).get();
  return doc.exists ? doc.data() : null;
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
