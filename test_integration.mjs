import crypto from 'crypto';
import fs from 'fs';

async function resolverPoW(challenge) {
  const dif = parseInt(challenge.dificultad, 10) || 3;
  const prefijo = '0'.repeat(dif);
  const salt = challenge.salt;
  let nonce = 0;
  while (nonce < 1000000) {
    const hash = crypto.createHash('sha256').update(`${salt}:${nonce}`).digest('hex');
    if (hash.startsWith(prefijo)) {
      return nonce;
    }
    nonce++;
  }
  return 0;
}

async function run() {
  console.log('🧪 Iniciando prueba de integración end-to-end (Frontend Vite -> Backend)...');

  // 1. Obtener reto PoW
  console.log('1. Solicitando desafío PoW a http://127.0.0.1:3000/api/auth/challenge...');
  const resChal = await fetch('http://127.0.0.1:3000/api/auth/challenge');
  const jsonChal = await resChal.json();
  if (!jsonChal.ok || !jsonChal.challenge) {
    throw new Error('Fallo al obtener desafío: ' + JSON.stringify(jsonChal));
  }
  console.log('✓ Desafío recibido:', jsonChal.challenge.salt);

  // 2. Resolver PoW
  const nonce = await resolverPoW(jsonChal.challenge);
  console.log(`✓ PoW resuelto con nonce: ${nonce}`);

  // Preparar usuario de prueba en base de datos
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const db = require('./lib/db.js');
  await db.addCredits('3001234567', 10, '7492');

  // 3. Login con PIN
  console.log('2. Iniciando sesión con celular 3001234567 y PIN 7492...');
  const resLogin = await fetch('http://127.0.0.1:3000/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'login',
      celular: '3001234567',
      pin: '7492',
      securityChallenge: {
        ...jsonChal.challenge,
        nonce
      }
    })
  });
  const jsonLogin = await resLogin.json();
  if (!jsonLogin.ok || !jsonLogin.token) {
    throw new Error('Fallo en login: ' + JSON.stringify(jsonLogin));
  }
  console.log('✓ Login exitoso! Token JWT recibido.');
  console.log('  Usuario:', jsonLogin.user.phone, '| Créditos iniciales:', jsonLogin.user.credits, '| Plan:', jsonLogin.user.plan);

  // 4. Obtener primer lead para desbloquear
  console.log('3. Consultando catálogo http://127.0.0.1:3000/data/inmobiliario.json...');
  const resCat = await fetch('http://127.0.0.1:3000/data/inmobiliario.json');
  const jsonCat = await resCat.json();
  const primerLead = jsonCat.leads[0];
  console.log(`✓ Lead seleccionado: [${primerLead.id}] ${primerLead.titulo}`);

  // 5. Desbloquear contacto vía AES-256-GCM
  console.log('4. Ejecutando desbloqueo en http://127.0.0.1:3000/api/leads/unlock...');
  const resUnlock = await fetch('http://127.0.0.1:3000/api/leads/unlock', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jsonLogin.token}`,
      'Idempotency-Key': crypto.randomUUID()
    },
    body: JSON.stringify({
      leadId: primerLead.id,
      contactoCifrado: primerLead.contacto_cifrado,
      leadCity: primerLead.ciudad,
      lang: 'es'
    })
  });
  const jsonUnlock = await resUnlock.json();
  if (!jsonUnlock.ok || !jsonUnlock.contacto) {
    throw new Error('Fallo en desbloqueo: ' + JSON.stringify(jsonUnlock));
  }

  console.log('✓ ¡Contacto descifrado con éxito en memoria por el backend!');
  console.log('  Teléfono descifrado:', jsonUnlock.contacto.telefonoDisplay || jsonUnlock.contacto.telefono);
  console.log('  Portal fuente:', jsonUnlock.contacto.portal);
  console.log('  Enlace directo:', jsonUnlock.contacto.enlace);
  console.log('  Título revelado:', jsonUnlock.datosRevelados?.tituloOriginal);
  console.log('  Nuevo balance de créditos:', jsonUnlock.creditsRemaining ?? jsonUnlock.nuevoBalance);

  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE INTEGRACIÓN PASARON AL 100%!');
}

run().catch((e) => {
  console.error('❌ Error en prueba de integración:', e.message);
  process.exit(1);
});
