#!/usr/bin/env node
/**
 * 👑 Asigna (o quita) el rol de administrador del panel mediante custom claims de Firebase.
 *
 * Se ejecuta SOLO en el PC del propietario (no en Vercel): usa firebase-admin/auth, que en
 * las funciones de Vercel no carga (ERR_REQUIRE_ESM), pero en Node local sí.
 *
 * Uso:
 *   node scripts/admin-rol.js              → da el rol a todos los correos de ADMIN_EMAILS
 *   node scripts/admin-rol.js --quitar <correo>  → quita el rol a ese correo
 *
 * Requisito: la cuenta debe haber entrado al menos una vez a /admin con Google (así existe
 * en Firebase Authentication). Después de asignar el rol, hay que salir y volver a entrar
 * al panel para que el token nuevo traiga el claim.
 */
require('dotenv').config();
require('../lib/db'); // inicializa firebase-admin con las credenciales del .env
const { getAuth } = require('firebase-admin/auth');

async function main() {
  const args = process.argv.slice(2);
  const auth = getAuth();

  if (args[0] === '--quitar') {
    const correo = (args[1] || '').trim().toLowerCase();
    if (!correo) throw new Error('Indica el correo: node scripts/admin-rol.js --quitar correo@ejemplo.com');
    const usuario = await auth.getUserByEmail(correo);
    const claims = { ...(usuario.customClaims || {}) };
    delete claims.admin;
    await auth.setCustomUserClaims(usuario.uid, claims);
    await auth.revokeRefreshTokens(usuario.uid);
    console.log(`✔ Rol de administrador retirado a ${correo} y sesiones revocadas.`);
    return;
  }

  const correos = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  if (correos.length === 0) throw new Error('ADMIN_EMAILS está vacío en el .env');

  for (const correo of correos) {
    try {
      const usuario = await auth.getUserByEmail(correo);
      await auth.setCustomUserClaims(usuario.uid, { ...(usuario.customClaims || {}), admin: true });
      console.log(`✔ ${correo} → rol de administrador asignado.`);
    } catch (e) {
      if (e && e.code === 'auth/user-not-found') {
        console.log(`✖ ${correo} todavía no existe en Firebase: entra una vez a /admin con Google y repite.`);
      } else {
        throw e;
      }
    }
  }
  console.log('Listo. Sal del panel y vuelve a entrar para que se aplique el rol.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  });
