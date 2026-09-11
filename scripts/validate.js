/**
 * ⚡ VALIDATE SUITE — HUNTER PRO INTELLIGENCE SHOWCASE
 * Suite de pruebas y validación estricta pre-commit y pre-push en 8 FASES.
 * Inspirado en la arquitectura DevSecOps del Ecosistema Desmulta.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
let errores = 0;

function assert(condicion, mensaje) {
  if (condicion) {
    console.log(`  ✅ ${mensaje}`);
  } else {
    console.error(`  ❌ ERROR: ${mensaje}`);
    errores++;
  }
}

async function ejecutarValidacionCompleta() {
  console.log('🏛️ INICIANDO SUITE DEVSECOPS DE 8 FASES (ESTÁNDAR ECOSISTEMA DESMULTA)\n');

  // ═════════════════════════════════════════════════════════════════════════
  // 1. SINTAXIS JAVASCRIPT Y ENDPOINTS SERVERLESS
  // ═════════════════════════════════════════════════════════════════════════
  console.log('🔍 [VALIDACIÓN 1/8] Sintaxis de Scripts JavaScript y Endpoints Serverless...');
  const jsFiles = [
    'app.js',
    'app.min.js',
    'sw.js',
    'config.js',
    'lib/crypto.js',
    'lib/db.js',
    'lib/rate-limiter.js',
    'lib/validation.js',
    'lib/env.js',
    'lib/leads.js',
    'lib/cors.js',
    'lib/push-subscriptions.js',
    'api/payments/create-order.js',
    'api/payments/webhook-wompi.js',
    'api/auth/session.js',
    'api/auth/recover.js',
    'api/leads/unlock.js',
    'api/user/balance.js',
    'api/media/proxy.js',
    'api/notifications/vapid-public-key.js',
    'api/notifications/subscribe.js',
    'api/notifications/dispatch.js',
    'api/security/honeypot.js'
  ];

  // Añadir también los módulos individuales de modules/
  const modulesDir = path.join(ROOT_DIR, 'modules');
  if (fs.existsSync(modulesDir)) {
    fs.readdirSync(modulesDir).filter(f => f.endsWith('.js')).forEach(f => {
      jsFiles.push(path.join('modules', f));
    });
  }

  for (const relPath of jsFiles) {
    const fullPath = path.join(ROOT_DIR, relPath);
    if (!fs.existsSync(fullPath)) continue;
    try {
      execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
      assert(true, `${relPath} sintaxis válida`);
    } catch (e) {
      assert(false, `${relPath} error de sintaxis: ${e.message}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 2. INTEGRIDAD Y BALANCE DE ESTILOS CSS
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n🎨 [VALIDACIÓN 2/8] Integridad y Compilación de Hojas de Estilos (CSS)...');
  const cssPath = path.join(ROOT_DIR, 'style.css');
  const cssMinPath = path.join(ROOT_DIR, 'style.min.css');

  assert(fs.existsSync(cssPath), 'style.css existe');
  assert(fs.existsSync(cssMinPath), 'style.min.css compilado existe');

  if (fs.existsSync(cssPath) && fs.existsSync(cssMinPath)) {
    const minCss = fs.readFileSync(cssMinPath, 'utf8');

    // Balance de llaves
    const openBraces = (minCss.match(/\{/g) || []).length;
    const closeBraces = (minCss.match(/\}/g) || []).length;
    assert(openBraces > 0 && openBraces === closeBraces, `Balance de llaves en CSS minificado (${openBraces} bloques)`);

    // Selectores críticos
    const selectoresCriticos = [
      '.brand-iso-svg',
      '.brand-logo-container',
      '.site-header',
      '.bento-card',
      '.carousel-track',
      ':root',
      '[data-theme="light"]',
      '--bg-main',
      '--accent-emerald',
      '.checkout-modal-card',
      '.btn-confirm-wompi',
      '.pricing-option-card',
      '.btn-whatsapp-direct',
      '.btn-push-subscribe',
      '.hunter-toast',
      '.hunter-toast-glow',
      '.hunter-toast-progress-bar'
    ];

    for (const sel of selectoresCriticos) {
      assert(minCss.includes(sel), `Selector crítico "${sel}" presente`);
    }

    const regexSvg = /\.brand-iso-svg\{width:100%;height:100%;display:block\}/;
    assert(regexSvg.test(minCss), 'Regla .brand-iso-svg acotada y protegida contra desbordamiento');
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 3. MARCADO HTML, CABECERAS OWASP Y RECURSOS FÍSICOS
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n📄 [VALIDACIÓN 3/8] Marcado HTML, Cabeceras de Seguridad OWASP y Recursos Físicos...');
  const htmlPath = path.join(ROOT_DIR, 'index.html');
  const vercelPath = path.join(ROOT_DIR, 'vercel.json');

  assert(fs.existsSync(htmlPath), 'index.html existe');
  assert(fs.existsSync(vercelPath), 'vercel.json existe');

  if (fs.existsSync(vercelPath)) {
    try {
      const vercelCfg = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
      assert(Array.isArray(vercelCfg.headers) && vercelCfg.headers.length > 0, 'vercel.json contiene cabeceras de seguridad');
      const allHeaderKeys = vercelCfg.headers.flatMap(h => h.headers.map(item => item.key));
      assert(allHeaderKeys.includes('Strict-Transport-Security'), 'Cabecera HSTS configurada');
      assert(allHeaderKeys.includes('X-Content-Type-Options'), 'Cabecera X-Content-Type-Options configurada');
      assert(allHeaderKeys.includes('X-Frame-Options'), 'Cabecera X-Frame-Options DENY configurada');
    } catch (e) {
      assert(false, `Error leyendo vercel.json: ${e.message}`);
    }
  }

  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    assert(html.includes('<!DOCTYPE html>'), 'DOCTYPE declarado');
    assert(html.includes('<meta name="viewport"'), 'Meta viewport presente');
    assert(html.includes('style.min.css'), 'style.min.css enlazado en el head');
    assert(html.includes('<script defer src="./app.js'), 'app.js enlazado con defer');
    assert(html.includes('checkoutModal'), 'Modal de checkout y ledger presente en DOM');
    assert(html.includes('checkout.wompi.co/widget.js'), 'Widget de pasarela Wompi enlazado');
    assert(html.includes('id="btnPushSubscribe"'), 'Botón de alertas Web Push PWA presente en DOM');

    const recursosLocales = [
      'style.min.css',
      'app.js',
      'config.js',
      'manifest.json',
      'favicon.svg',
      'favicon.ico',
      'robots.txt',
      'sitemap.xml',
      'llms.txt',
      'google390e0a55723f2003.html'
    ];

    for (const rec of recursosLocales) {
      assert(fs.existsSync(path.join(ROOT_DIR, rec)), `Recurso físico "${rec}" existe en disco`);
    }
  }

  try {
    execSync(`node "${path.join(ROOT_DIR, 'scripts', 'test_security_hardening.js')}"`, { stdio: 'pipe' });
    assert(true, 'Servidor local bloquea fuentes, secretos, sourcemaps y dependencias privadas');
  } catch (e) {
    assert(false, `Fallo en test de hardening HTTP local: ${e.message}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 4. CONTRATOS DE DATOS JSON Y CIFRADO AES-256
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n📦 [VALIDACIÓN 4/8] Contratos de Datos JSON y Cifrado AES-256...');
  const jsonPath = path.join(ROOT_DIR, 'data', 'inmobiliario.json');
  assert(fs.existsSync(jsonPath), 'data/inmobiliario.json existe');

  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      assert(Array.isArray(data.leads), 'dataset.leads es un arreglo');
      assert(data.leads.length > 0, `leads contiene ${data.leads.length} oportunidades`);
      assert(typeof data.config === 'object', 'dataset.config es un objeto válido');

      const primerLead = data.leads[0];
      assert(!!primerLead.titulo, 'Lead tiene título');
      assert(primerLead.precio !== undefined, 'Lead tiene precio');
      assert(Array.isArray(primerLead.imagenes) && primerLead.imagenes.length > 0, 'Lead tiene galería fotográfica');
      assert(!!primerLead.contacto_cifrado && primerLead.contacto_cifrado.includes(':'), 'Lead tiene contacto_cifrado AES-256 válido (iv:tag:cipher)');
      assert(primerLead.telefono_bloqueado && primerLead.telefono_bloqueado.includes('•••'), 'Teléfono público permanece protegido/ofuscado');
    } catch (e) {
      assert(false, `data/inmobiliario.json no es JSON válido: ${e.message}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 5. SUITE AUTOMATIZADA WOMPI Y LEDGER
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n💳 [VALIDACIÓN 5/8] Suite Automatizada de Integración Wompi, Ledger y Validación Zod...');
  try {
    execSync(`node "${path.join(ROOT_DIR, 'scripts', 'test_ledger_wompi.js')}"`, { stdio: 'pipe' });
    assert(true, 'Pruebas unitarias de pasarela Wompi, antifraude, idempotencia y ledger pasadas al 100%');
  } catch (e) {
    assert(false, `Fallo en suite de pruebas de Wompi: ${e.message}`);
  }

  try {
    execSync(`node "${path.join(ROOT_DIR, 'scripts', 'test_validation_ratelimit.js')}"`, { stdio: 'pipe' });
    assert(true, 'Pruebas unitarias de esquemas Zod y Rate Limiting diario pasadas al 100%');
  } catch (e) {
    assert(false, `Fallo en suite de validación Zod y rate limiting: ${e.message}`);
  }

  try {
    execSync(`node "${path.join(ROOT_DIR, 'scripts', 'test_upstash_redis.js')}"`, { stdio: 'pipe' });
    assert(true, 'Pruebas unitarias de Upstash Redis distribuido y Fail-Safe pasadas al 100%');
  } catch (e) {
    assert(false, `Fallo en test de Upstash Redis: ${e.message}`);
  }

  try {
    execSync(`node --test "${path.join(ROOT_DIR, 'tests', 'image_proxy.test.js')}"`, { stdio: 'pipe' });
    assert(true, 'Pruebas unitarias de proxy de medios y anti-SSRF pasadas al 100%');
  } catch (e) {
    assert(false, `Fallo en test de proxy de medios: ${e.message}`);
  }

  try {
    execSync(`node --test "${path.join(ROOT_DIR, 'tests', 'whatsapp_template.test.js')}"`, { stdio: 'pipe' });
    assert(true, 'Pruebas unitarias de plantilla WhatsApp de alta conversión pasadas al 100%');
  } catch (e) {
    assert(false, `Fallo en test de plantilla WhatsApp: ${e.message}`);
  }

  try {
    execSync(`node --test "${path.join(ROOT_DIR, 'tests', 'filters_sorting.test.js')}"`, { stdio: 'pipe' });
    assert(true, 'Pruebas unitarias de ordenamiento táctico por $/m² y rebajas pasadas al 100%');
  } catch (e) {
    assert(false, `Fallo en test de ordenamiento táctico: ${e.message}`);
  }

  try {
    execSync(`node --test "${path.join(ROOT_DIR, 'tests', 'web_push.test.js')}"`, { stdio: 'pipe' });
    assert(true, 'Pruebas unitarias de Web Push VAPID y suscripciones PWA pasadas al 100%');
  } catch (e) {
    assert(false, `Fallo en test de Web Push VAPID: ${e.message}`);
  }

  try {
    execSync(`node --test "${path.join(ROOT_DIR, 'tests', 'r2_integration.test.js')}"`, { stdio: 'pipe' });
    assert(true, 'Pruebas unitarias de Cloudflare R2 y carga en tiempo real pasadas al 100%');
  } catch (e) {
    assert(false, `Fallo en test de Cloudflare R2: ${e.message}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 6. AUDITORÍA ANTIFRAUDE Y RECONCILIACIÓN SERVERLESS
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n🛡️ [VALIDACIÓN 6/8] Auditoría Antifraude en Reclamo de Referencias (claim_reference)...');
  try {
    if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
      process.env.JWT_SECRET = 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232';
    }
    const sessionHandler = require('../api/auth/session');
    let resStatus = 0;
    let resPayload = null;

    const mockReq = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        action: 'claim_reference',
        reference: 'INVALID-REFERENCE-3119998888',
        phone: '3119998888'
      }
    };

    const mockRes = {
      setHeader: () => {},
      status: (code) => {
        resStatus = code;
        return mockRes;
      },
      json: (data) => {
        resPayload = data;
        return mockRes;
      },
      end: () => {}
    };

    await sessionHandler(mockReq, mockRes);
    const fueRechazado = (resStatus === 401 || resStatus === 403 || resStatus === 404 || resStatus === 400);
    assert(fueRechazado, `Reclamo de referencia fraudulenta rechazado con HTTP ${resStatus} (${resPayload?.error || 'OK'})`);
  } catch (err) {
    assert(false, `Error en prueba antifraude: ${err.message}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 7. AUDITORÍA DE PIN ESTRICTO (BYPASS ERRADICADO)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n🔐 [VALIDACIÓN 7/8] Auditoría de Seguridad: Erradicación Total de Bypass de PIN...');
  try {
    const db = require(path.join(ROOT_DIR, 'lib', 'db'));
    const testPhone = '3119998877';
    const secretPin = '9412';
    const fakePinBypass = '8877'; // Últimos 4 dígitos del celular

    // Registrar o actualizar usuario con PIN secreto
    await db.addCredits(testPhone, 1, secretPin);
    const user = await db.getUserByPhone(testPhone);

    assert(user.pin === secretPin, `PIN registrado en ledger coincide con secreto seguro (${user.pin})`);
    assert(user.pin !== fakePinBypass, 'PIN del usuario no coincide con el número de celular');

    // Comprobar que en el código de lib/db.js NO exista ningún fallback a slice(-4)
    const dbCode = fs.readFileSync(path.join(ROOT_DIR, 'lib', 'db.js'), 'utf8');
    const tieneBypass = dbCode.includes('slice(-4)') || dbCode.includes('phoneClean.slice');
    assert(!tieneBypass, 'Verificación estricta: Cero fallbacks de autenticación por últimos dígitos en db.js');
  } catch (err) {
    assert(false, `Error en auditoría de PIN: ${err.message}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 8. AUDITORÍA DE MODULARIDAD ARQUITECTÓNICA (< 500 LÍNEAS POR MÓDULO)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n📐 [VALIDACIÓN 8/8] Auditoría de Modularidad Arquitectónica (Estándar Desmulta < 500 líneas)...');
  const foldersToAudit = [
    { dir: path.join(ROOT_DIR, 'modules'), ext: '.js', nombre: 'Módulos JS' },
    { dir: path.join(ROOT_DIR, 'styles'), ext: '.css', nombre: 'Módulos CSS' }
  ];

  for (const { dir, ext, nombre } of foldersToAudit) {
    if (!fs.existsSync(dir)) {
      assert(false, `Directorio ${dir} no existe`);
      continue;
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith(ext));
    assert(files.length > 0, `${nombre} contiene ${files.length} submódulos desacoplados`);

    for (const f of files) {
      const filePath = path.join(dir, f);
      const lineas = fs.readFileSync(filePath, 'utf8').split('\n').length;
      const esModular = lineas <= 500;
      assert(esModular, `${f}: ${lineas} líneas (Límite máximo: 500)`);
    }
  }

  // Verificación Zero-Trust de secretos expuestos
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    assert(!html.includes('ghp_'), 'Cero tokens de GitHub expuestos');
    assert(!html.includes('sk_live'), 'Cero llaves privadas Wompi expuestas en HTML');
    assert(!html.includes('prv_live'), 'Cero credenciales privadas expuestas');
  }

  // ═════════════════════════════════════════════════════════════════════════
  // RESUMEN FINAL
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n------------------------------------------------------------');
  if (errores === 0) {
    console.log('🏆 [VALIDACIÓN] ¡LAS 8 FASES DEVSECOPS PASARON CON ÉXITO AL 100%! (0 errores)\n');
    process.exit(0);
  } else {
    console.error(`💥 [VALIDACIÓN] FALLO: Se encontraron ${errores} error(es). Abortando despliegue.\n`);
    process.exit(1);
  }
}

ejecutarValidacionCompleta().catch(err => {
  console.error('💥 Error inesperado en suite de validación:', err);
  process.exit(1);
});
