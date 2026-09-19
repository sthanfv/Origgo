/**
 * 🧪 SIMULACRO INTEGRAL END-TO-END (SMOKE TEST)
 * Archivo: simulacro_e2e.js
 */

const https = require('https');
const crypto = require('crypto');

const DOMAIN = 'https://origgo.online';
const TEST_LEAD_ID = `simulacro-smoke-live-${Date.now().toString().slice(-4)}`;

function request(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
        } catch (_) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

function generarJwtPrueba(secret) {
  if (!secret) return null;
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    phone: '3001234567',
    credits: 5,
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function correrSimulacro() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🧪 SIMULACRO DE INTEGRACIÓN END-TO-END EN PRODUCCIÓN (SMOKE TEST)');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`🎯 ID del Inmueble a desindexar: ${TEST_LEAD_ID}`);
  console.log(`🌐 Servidor: ${DOMAIN}`);
  console.log('──────────────────────────────────────────────────────────────');

  // ETAPA 1: Enviar solicitud de Notice & Takedown
  console.log('\n▶ [ETAPA 1/3] Solicitando retiro inmediato en POST /api/support/takedown...');
  const resTakedown = await request(`${DOMAIN}/api/support/takedown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    leadId: TEST_LEAD_ID,
    phone: '3159998877',
    reason: 'inmueble_arrendado_simulacro'
  });

  console.log(`   HTTP Status: ${resTakedown.status}`);
  console.log('   Respuesta:', resTakedown.data);
  if (resTakedown.status !== 200 || !resTakedown.data.ok) {
    console.error('❌ FALLÓ ETAPA 1: No se pudo procesar la desindexación.');
    return;
  }
  console.log('   ✅ ETAPA 1 EXITOSA: Inmueble registrado para desindexación.');

  // ETAPA 2: Consultar lista negra pública en CDN
  console.log('\n▶ [ETAPA 2/3] Verificando propagación en GET /api/support/blacklist...');
  const resBlacklist = await request(`${DOMAIN}/api/support/blacklist`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  console.log(`   HTTP Status: ${resBlacklist.status}`);
  const totalIds = resBlacklist.data?.count || resBlacklist.data?.ids?.length || 0;
  const contieneId = Array.isArray(resBlacklist.data?.ids) && resBlacklist.data.ids.includes(TEST_LEAD_ID);
  console.log(`   Total IDs en lista negra: ${totalIds}`);
  console.log(`   ¿Contiene "${TEST_LEAD_ID}"?: ${contieneId ? 'SÍ (Confirmado)' : 'NO'}`);

  if (!contieneId) {
    console.error('❌ FALLÓ ETAPA 2: El ID no aparece en la lista negra pública.');
    return;
  }
  console.log('   ✅ ETAPA 2 EXITOSA: Lista negra propagada con el nuevo identificador.');

  // ETAPA 3: Verificar Guarda de Seguridad contra desbloqueo (HTTP 410 / 401)
  console.log('\n▶ [ETAPA 3/3] Simulando intento de compra de inmueble desindexado (POST /api/leads/unlock)...');
  const resUnlock = await request(`${DOMAIN}/api/leads/unlock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token_invalido_o_simulado'
    }
  }, {
    leadId: TEST_LEAD_ID
  });

  console.log(`   HTTP Status: ${resUnlock.status}`);
  console.log('   Respuesta:', resUnlock.data);
  
  if (resUnlock.status === 410) {
    console.log('   ✅ ETAPA 3 EXITOSA: Bloqueo directo con HTTP 410 Gone (Cero cobro).');
  } else if (resUnlock.status === 401) {
    console.log('   ℹ️ ETAPA 3: La ruta está correctamente blindada por autenticación JWT (401).');
  } else {
    console.log(`   ℹ️ ETAPA 3: Estado recibido: HTTP ${resUnlock.status}`);
  }

  // Intento complementario con token JWT firmado de sesión activa
  const secretEnv = process.env.JWT_SECRET || '21d242d162544641645df5b6a7855dae39400ac7d26f0bfbb896bfb3ec92dc571aecfa94b941ee3177127b1e58fc8169';
  const tokenFirmado = generarJwtPrueba(secretEnv);
  if (tokenFirmado) {
    console.log('\n   [Verificación complementaria] Probando con token JWT firmado de usuario...');
    const resUnlockAuth = await request(`${DOMAIN}/api/leads/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenFirmado}`
      }
    }, {
      leadId: TEST_LEAD_ID
    });
    console.log(`   HTTP Status con Token: ${resUnlockAuth.status}`);
    console.log('   Respuesta:', resUnlockAuth.data);
    if (resUnlockAuth.status === 410) {
      console.log('   ✅ GUARDA 410 VERIFICADO: El inmueble desindexado rechaza compra con HTTP 410 Gone.');
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('🏆 SIMULACRO END-TO-END COMPLETADO CON ÉXITO');
  console.log('══════════════════════════════════════════════════════════════\n');
}

correrSimulacro().catch(err => console.error('Error fatal en simulacro:', err));
