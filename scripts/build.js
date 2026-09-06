/**
 * ⚡ BUILD SCRIPT — HUNTER PRO INTELLIGENCE SHOWCASE
 * Compilación modular, concatenación determinista, minificación segura
 * y validación de sintaxis de estilos y scripts.
 * Estándar Ecosistema Desmulta DevSecOps.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const STYLES_DIR = path.join(ROOT_DIR, 'styles');
const MODULES_DIR = path.join(ROOT_DIR, 'modules');
const CSS_FILE = path.join(ROOT_DIR, 'style.css');
const CSS_MIN_FILE = path.join(ROOT_DIR, 'style.min.css');
const JS_FILE = path.join(ROOT_DIR, 'app.js');
const JS_MIN_FILE = path.join(ROOT_DIR, 'app.min.js');

console.log('🚀 [BUILD] Iniciando proceso de compilación y ensamblado modular...');

// ═════════════════════════════════════════════════════════════════════════
// 1. ENSAMBLADO Y MINIFICACIÓN DE ESTILOS CSS
// ═════════════════════════════════════════════════════════════════════════
if (fs.existsSync(STYLES_DIR)) {
  const cssFiles = fs.readdirSync(STYLES_DIR)
    .filter(f => f.endsWith('.css'))
    .sort();

  console.log(`📦 [BUILD] Ensamblando ${cssFiles.length} módulos CSS desde styles/...`);
  let assembledCss = '';
  for (const f of cssFiles) {
    const filePath = path.join(STYLES_DIR, f);
    const content = fs.readFileSync(filePath, 'utf8');
    assembledCss += (assembledCss ? '\n' : '') + content;
  }

  fs.writeFileSync(CSS_FILE, assembledCss, 'utf8');
  console.log(`✅ [BUILD] style.css actualizado desde submódulos (${assembledCss.length} bytes).`);
}

if (!fs.existsSync(CSS_FILE)) {
  console.error('❌ [BUILD] ERROR: style.css no existe.');
  process.exit(1);
}

const rawCss = fs.readFileSync(CSS_FILE, 'utf8');

// Comprobación de integridad básica
const openBraces = (rawCss.match(/\{/g) || []).length;
const closeBraces = (rawCss.match(/\}/g) || []).length;
if (openBraces === 0 || openBraces !== closeBraces) {
  console.error(`❌ [BUILD] ERROR: Desbalance de llaves en style.css ({: ${openBraces}, }: ${closeBraces})`);
  process.exit(1);
}

// Minificación segura y determinista sin regex destructiva
function minificarCss(src) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/\r\n|\r/g, '\n');
  out = out.replace(/[ \t]+/g, ' ');
  out = out.replace(/\s*\{\s*/g, '{');
  out = out.replace(/\s*\}\s*/g, '}');
  out = out.replace(/\s*;\s*/g, ';');
  out = out.replace(/\s*,\s*/g, ',');
  out = out.replace(/\s*>\s*/g, '>');
  out = out.replace(/\s*~\s*/g, '~');
  out = out.replace(/:\s+/g, ':');
  out = out.replace(/;\}/g, '}');
  return out.trim();
}

const minCss = minificarCss(rawCss);

// Validación de integridad post-minificación
const minOpenBraces = (minCss.match(/\{/g) || []).length;
const minCloseBraces = (minCss.match(/\}/g) || []).length;
if (minOpenBraces !== openBraces || minCloseBraces !== closeBraces) {
  console.error(`❌ [BUILD] ERROR: Corrupción detectada en minificación ({: ${minOpenBraces} vs ${openBraces})`);
  process.exit(1);
}

// Validar que selectores críticos no se hayan perdido
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
  '.hunter-toast'
];

for (const selector of selectoresCriticos) {
  if (!minCss.includes(selector)) {
    console.error(`❌ [BUILD] ERROR: Selector crítico "${selector}" no encontrado en el CSS compilado.`);
    process.exit(1);
  }
}

fs.writeFileSync(CSS_MIN_FILE, minCss, 'utf8');
const ahorroCss = Math.round((1 - minCss.length / rawCss.length) * 100);
console.log(`✅ [BUILD] style.min.css generado: ${minCss.length} bytes (-${ahorroCss}% de peso).`);

// ═════════════════════════════════════════════════════════════════════════
// 2. ENSAMBLADO Y VALIDACIÓN DE MÓDULOS JAVASCRIPT
// ═════════════════════════════════════════════════════════════════════════
if (fs.existsSync(MODULES_DIR)) {
  const jsFiles = fs.readdirSync(MODULES_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();

  console.log(`📦 [BUILD] Validando y ensamblando ${jsFiles.length} módulos JS desde modules/...`);
  let assembledJs = '';

  for (const f of jsFiles) {
    const filePath = path.join(MODULES_DIR, f);
    try {
      execSync(`node --check "${filePath}"`);
    } catch (e) {
      console.error(`❌ [BUILD] Error de sintaxis en módulo ${f}:`, e.message);
      process.exit(1);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    assembledJs += (assembledJs ? '\n\n' : '') + content;
  }

  fs.writeFileSync(JS_FILE, assembledJs, 'utf8');
  console.log(`✅ [BUILD] app.js actualizado desde submódulos (${assembledJs.length} bytes).`);

  // Minificación básica y segura de JS (eliminación de comentarios y espacios)
  function minificarJs(src) {
    let out = src.replace(/\/\*[\s\S]*?\*\//g, '');
    out = out.replace(/^\s*\/\/.*$/gm, '');
    out = out.replace(/\r\n|\r/g, '\n');
    out = out.replace(/\n\s*\n+/g, '\n');
    return out.trim();
  }

  const minJs = minificarJs(assembledJs);
  fs.writeFileSync(JS_MIN_FILE, minJs, 'utf8');
  const ahorroJs = Math.round((1 - minJs.length / assembledJs.length) * 100);
  console.log(`✅ [BUILD] app.min.js generado: ${minJs.length} bytes (-${ahorroJs}% de peso).`);
}

// 3. Comprobación de sintaxis en archivo compilado
try {
  execSync('node --check ' + JS_FILE);
  console.log('✅ [BUILD] Sintaxis de app.js verificada con éxito.');
} catch (e) {
  console.error('❌ [BUILD] ERROR de sintaxis en app.js compilado:', e.message);
  process.exit(1);
}

console.log('🎉 [BUILD] Compilación y ensamblado completados con éxito.');
