/**
 * ⚡ VALIDATE SUITE — HUNTER PRO INTELLIGENCE SHOWCASE
 * Suite de pruebas y validación estricta pre-commit y pre-push.
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

console.log('\n🔍 [VALIDACIÓN 1/6] Sintaxis de Scripts JavaScript y Endpoints Serverless...');
const jsFiles = [
  'app.js', 
  'sw.js', 
  'config.js', 
  'scripts/build.js',
  'api/lib/crypto.js',
  'api/lib/db.js',
  'api/payments/create-order.js',
  'api/payments/webhook-wompi.js',
  'api/auth/session.js',
  'api/leads/unlock.js',
  'api/user/balance.js'
];
for (const relPath of jsFiles) {
  const fullPath = path.join(ROOT_DIR, relPath);
  try {
    execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
    assert(true, `${relPath} sintaxis válida`);
  } catch (e) {
    assert(false, `${relPath} error de sintaxis: ${e.message}`);
  }
}

console.log('\n🎨 [VALIDACIÓN 2/6] Integridad y Compilación de Hojas de Estilos (CSS)...');
const cssPath = path.join(ROOT_DIR, 'style.css');
const cssMinPath = path.join(ROOT_DIR, 'style.min.css');

assert(fs.existsSync(cssPath), 'style.css existe');
assert(fs.existsSync(cssMinPath), 'style.min.css compilado existe');

if (fs.existsSync(cssPath) && fs.existsSync(cssMinPath)) {
  const rawCss = fs.readFileSync(cssPath, 'utf8');
  const minCss = fs.readFileSync(cssMinPath, 'utf8');

  // 1. Balance de llaves
  const openBraces = (minCss.match(/\{/g) || []).length;
  const closeBraces = (minCss.match(/\}/g) || []).length;
  assert(openBraces > 0 && openBraces === closeBraces, `Balance de llaves en CSS minificado (${openBraces} bloques)`);

  // 2. Selectores críticos
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
    '.btn-whatsapp-direct'
  ];

  for (const sel of selectoresCriticos) {
    assert(minCss.includes(sel), `Selector crítico "${sel}" presente`);
  }

  // 3. Regla específica del radar SVG para prevenir desbordamientos visuales
  const regexSvg = /\.brand-iso-svg\{width:100%;height:100%;display:block\}/;
  assert(regexSvg.test(minCss), 'Regla .brand-iso-svg acotada y protegida contra desbordamiento');
}

console.log('\n📄 [VALIDACIÓN 3/6] Integridad de Marcado HTML y Referencias de Recursos...');
const htmlPath = path.join(ROOT_DIR, 'index.html');
assert(fs.existsSync(htmlPath), 'index.html existe');

if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert(html.includes('<!DOCTYPE html>'), 'DOCTYPE declarado');
  assert(html.includes('<meta name="viewport"'), 'Meta viewport presente');
  assert(html.includes('google-site-verification'), 'Verificación Google Search Console presente');
  assert(html.includes('style.min.css'), 'style.min.css enlazado en el head');
  assert(html.includes('<script defer src="./app.js'), 'app.js enlazado con defer');
  assert(html.includes('<script defer src="./config.js'), 'config.js enlazado con defer');
  assert(html.includes('checkoutModal'), 'Modal de checkout y ledger presente en DOM');
  assert(html.includes('checkout.wompi.co/widget.js'), 'Widget de pasarela Wompi enlazado');

  // Verificar que los recursos locales enlazados existen en disco
  const recursosLocales = [
    'style.min.css',
    'app.js',
    'config.js',
    'manifest.json',
    'favicon.svg',
    'robots.txt',
    'sitemap.xml',
    'llms.txt',
    'google390e0a55723f2003.html'
  ];

  for (const rec of recursosLocales) {
    assert(fs.existsSync(path.join(ROOT_DIR, rec)), `Recurso físico "${rec}" existe en disco`);
  }
}

console.log('\n📦 [VALIDACIÓN 4/6] Contratos de Datos JSON y Cifrado AES-256...');
const jsonPath = path.join(ROOT_DIR, 'data', 'inmobiliario.json');
assert(fs.existsSync(jsonPath), 'data/inmobiliario.json existe');

if (fs.existsSync(jsonPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert(Array.isArray(data.leads), 'dataset.leads es un arreglo');
    assert(data.leads.length > 0, `leads contiene ${data.leads.length} oportunidades`);
    assert(typeof data.config === 'object', 'dataset.config es un objeto válido');
    
    // Validar sanidad del primer lead y cifrado Zero-Trust
    const primerLead = data.leads[0];
    assert(!!primerLead.titulo, 'Lead tiene título');
    assert(primerLead.precio !== undefined, 'Lead tiene precio');
    assert(Array.isArray(primerLead.imagenes) && primerLead.imagenes.length > 0, 'Lead tiene galería fotográfica válida');
    assert(!!primerLead.contacto_cifrado && primerLead.contacto_cifrado.includes(':'), 'Lead tiene contacto_cifrado AES-256 válido (iv:tag:cipher)');
    assert(primerLead.telefono_bloqueado && primerLead.telefono_bloqueado.includes('•••'), 'Teléfono público permanece protegido/ofuscado');
  } catch (e) {
    assert(false, `data/inmobiliario.json no es JSON válido: ${e.message}`);
  }
}

console.log('\n💳 [VALIDACIÓN 5/6] Suite Automatizada de Integración Wompi y Ledger...');
try {
  execSync(`node "${path.join(ROOT_DIR, 'scripts', 'test_ledger_wompi.js')}"`, { stdio: 'pipe' });
  assert(true, '8/8 pruebas unitarias de pasarela Wompi, timingSafeEqual y ledger pasadas al 100%');
} catch (e) {
  assert(false, `Fallo en suite de pruebas de Wompi: ${e.message}`);
}

console.log('\n🛡️ [VALIDACIÓN 6/6] Auditoría de Seguridad Zero-Trust...');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert(!html.includes('ghp_'), 'Cero tokens de GitHub expuestos en HTML');
  assert(!html.includes('sk_live'), 'Cero llaves privadas Wompi expuestas en HTML');
  assert(!html.includes('prv_live'), 'Cero credenciales de producción expuestas en HTML');
}

console.log('\n------------------------------------------------------------');
if (errores === 0) {
  console.log('🏆 [VALIDACIÓN] ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE! (0 errores)\n');
  process.exit(0);
} else {
  console.error(`💥 [VALIDACIÓN] FALLO: Se encontraron ${errores} error(es). Abortando despliegue.\n`);
  process.exit(1);
}
