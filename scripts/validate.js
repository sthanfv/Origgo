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

console.log('\n🔍 [VALIDACIÓN 1/5] Sintaxis de Scripts JavaScript...');
const jsFiles = ['app.js', 'sw.js', 'config.js', 'scripts/build.js'];
for (const relPath of jsFiles) {
  const fullPath = path.join(ROOT_DIR, relPath);
  try {
    execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
    assert(true, `${relPath} sintaxis válida`);
  } catch (e) {
    assert(false, `${relPath} error de sintaxis: ${e.message}`);
  }
}

console.log('\n🎨 [VALIDACIÓN 2/5] Integridad y Compilación de Hojas de Estilos (CSS)...');
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
    '--accent-emerald'
  ];

  for (const sel of selectoresCriticos) {
    assert(minCss.includes(sel), `Selector crítico "${sel}" presente`);
  }

  // 3. Regla específica del radar SVG para prevenir desbordamientos visuales
  const regexSvg = /\.brand-iso-svg\{width:100%;height:100%;display:block\}/;
  assert(regexSvg.test(minCss), 'Regla .brand-iso-svg acotada y protegida contra desbordamiento');
}

console.log('\n📄 [VALIDACIÓN 3/5] Integridad de Marcado HTML y Referencias de Recursos...');
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

console.log('\n📦 [VALIDACIÓN 4/5] Contratos de Datos JSON...');
const jsonPath = path.join(ROOT_DIR, 'data', 'inmobiliario.json');
assert(fs.existsSync(jsonPath), 'data/inmobiliario.json existe');

if (fs.existsSync(jsonPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert(Array.isArray(data.leads), 'dataset.leads es un arreglo');
    assert(data.leads.length > 0, `leads contiene ${data.leads.length} oportunidades`);
    assert(typeof data.config === 'object', 'dataset.config es un objeto válido');
    
    // Validar sanidad del primer lead
    const primerLead = data.leads[0];
    assert(!!primerLead.titulo, 'Lead tiene título');
    assert(primerLead.precio !== undefined, 'Lead tiene precio');
    assert(Array.isArray(primerLead.imagenes) && primerLead.imagenes.length > 0, 'Lead tiene galería fotográfica válida');
  } catch (e) {
    assert(false, `data/inmobiliario.json no es JSON válido: ${e.message}`);
  }
}

console.log('\n🛡️ [VALIDACIÓN 5/5] Auditoría de Seguridad Zero-Trust...');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert(!html.includes('ghp_'), 'Cero tokens de GitHub expuestos en HTML');
  assert(!html.includes('sk_live'), 'Cero llaves privadas Wompi expuestas en HTML');
}

console.log('\n------------------------------------------------------------');
if (errores === 0) {
  console.log('🏆 [VALIDACIÓN] ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE! (0 errores)\n');
  process.exit(0);
} else {
  console.error(`💥 [VALIDACIÓN] FALLO: Se encontraron ${errores} error(es). Abortando despliegue.\n`);
  process.exit(1);
}
