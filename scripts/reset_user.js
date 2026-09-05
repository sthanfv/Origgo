/**
 * 🛠️ SCRIPT DE RESETEO Y LIMPIEZA DE USUARIOS DE PRUEBA (FIRESTORE)
 * Hunter Pro Intelligence — Entorno de Desarrollo y QA
 * 
 * Uso:
 *   node scripts/reset_user.js 3113114357
 * 
 * Opciones:
 *   --reset   (Por defecto) Deja al usuario con 0 créditos, plan free y sin leads desbloqueados
 *   --delete  Elimina por completo el documento del usuario y sus órdenes asociadas
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// Cargar variables de entorno si existen
try {
  require('dotenv').config();
} catch (e) {}

// Inicializar Firebase Admin SDK
if (!getApps().length) {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const parsed = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : process.env.FIREBASE_SERVICE_ACCOUNT;
      credential = cert(parsed);
    } catch (e) {}
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const jsonStr = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      credential = cert(JSON.parse(jsonStr));
    } catch (e) {}
  } else {
    try {
      const serviceAccount = require('../service-account.json');
      credential = cert(serviceAccount);
    } catch (e) {}
  }

  initializeApp({
    credential,
    projectId: 'hunter-pro-showcase'
  });
}

const db = getFirestore();

function cleanPhone(phone) {
  if (!phone) return '';
  const num = String(phone).replace(/\D/g, '');
  return num.startsWith('57') && num.length === 12 ? num.substring(2) : num;
}

async function ejecutarLimpieza() {
  const args = process.argv.slice(2);
  const rawPhone = args.find(a => !a.startsWith('--')) || '3113114357';
  const modeDelete = args.includes('--delete');
  const normPhone = cleanPhone(rawPhone);

  if (!normPhone) {
    console.error('❌ Error: Debe especificar un número de teléfono válido.');
    process.exit(1);
  }

  console.log(`\n🔍 Buscando registros para el usuario: ${normPhone} (${modeDelete ? 'MODO BORRADO TOTAL' : 'MODO REINICIO A CERO'})...`);

  const userDocRef = db.collection('users').doc(normPhone);
  const userSnapshot = await userDocRef.get();

  if (!userSnapshot.exists) {
    console.log(`ℹ️ El usuario ${normPhone} no existe actualmente en la colección 'users'.`);
  } else {
    const userData = userSnapshot.data();
    console.log(`📋 Datos actuales del usuario:`, {
      phone: userData.phone,
      pin: userData.pin,
      credits: userData.credits,
      plan: userData.plan,
      planCity: userData.planCity,
      leadsDesbloqueados: userData.unlockedLeads ? userData.unlockedLeads.length : 0
    });

    if (modeDelete) {
      await userDocRef.delete();
      console.log(`🗑️ Documento users/${normPhone} ELIMINADO de Firestore.`);
    } else {
      await userDocRef.set({
        phone: normPhone,
        pin: userData.pin || `HNT-${normPhone.slice(-4)}`,
        credits: 0,
        plan: 'free',
        planCity: null,
        planExpiresAt: null,
        unlockedLeads: [],
        updatedAt: new Date().toISOString(),
        resetAt: new Date().toISOString()
      }, { merge: false });
      console.log(`✨ Usuario ${normPhone} REINICIADO a 0 créditos, plan free y sin leads.`);
    }
  }

  // Limpiar órdenes asociadas a este número de teléfono
  console.log(`🔎 Buscando órdenes asociadas en la colección 'orders'...`);
  const ordersSnapshot = await db.collection('orders').get();
  let ordenesAfectadas = 0;

  for (const doc of ordersSnapshot.docs) {
    const o = doc.data();
    const orderPhone = cleanPhone(o.celular || o.phone || o.customerPhone);
    if (orderPhone === normPhone) {
      if (modeDelete) {
        await doc.ref.delete();
      } else {
        await doc.ref.update({ status: 'RESET_ARCHIVED' });
      }
      ordenesAfectadas++;
    }
  }

  console.log(`📦 Órdenes de prueba actualizadas/eliminadas: ${ordenesAfectadas}`);
  console.log(`\n✅ Proceso finalizado con éxito.`);
  console.log(`💡 Recuerda ejecutar en la consola del navegador: localStorage.clear() para limpiar la sesión local.\n`);
}

ejecutarLimpieza().catch(err => {
  console.error('❌ Error ejecutando limpieza en Firestore:', err);
  process.exit(1);
});
