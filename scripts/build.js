/**
 * ⚡ BUILD SCRIPT — HUNTER PRO INTELLIGENCE SHOWCASE
 * Compilación, minificación segura y validación integral antes de despliegue.
 * Estándar Ecosistema Desmulta DevSecOps.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CSS_FILE = path.join(ROOT_DIR, 'style.css');
const CSS_MIN_FILE = path.join(ROOT_DIR, 'style.min.css');

console.log('🚀 [BUILD] Iniciando proceso de compilación y validación...');

// 1. Validar que style.css existe y está íntegro
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

console.log(`✅ [BUILD] style.css verificado (${rawCss.length} bytes, ${openBraces} bloques).`);

// 2. Minificación segura y determinista sin regex destructiva
function minificarCss(src) {
  // Eliminar comentarios de bloque
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Normalizar saltos de línea y espacios múltiples
  out = out.replace(/\r\n|\r/g, '\n');
  out = out.replace(/[ \t]+/g, ' ');
  // Eliminar espacios alrededor de llaves, puntos y comas de forma explícita
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

// 3. Validación de integridad post-minificación
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
  '--accent-emerald'
];

for (const selector of selectoresCriticos) {
  if (!minCss.includes(selector)) {
    console.error(`❌ [BUILD] ERROR: Selector crítico "${selector}" no encontrado en el CSS compilado.`);
    process.exit(1);
  }
}

// 4. Escribir archivo compilado
fs.writeFileSync(CSS_MIN_FILE, minCss, 'utf8');
const ahorro = Math.round((1 - minCss.length / rawCss.length) * 100);
console.log(`✅ [BUILD] style.min.css generado exitosamente: ${minCss.length} bytes (-${ahorro}% de peso).`);
console.log('🎉 [BUILD] Compilación completada con éxito.');
