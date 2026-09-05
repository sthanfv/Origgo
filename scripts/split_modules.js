const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT_DIR, 'app.js'), 'utf8');
const lines = code.split('\n');

const modulesDir = path.join(ROOT_DIR, 'modules');
if (!fs.existsSync(modulesDir)) fs.mkdirSync(modulesDir, { recursive: true });

// Limpiar si hay archivos previos
fs.readdirSync(modulesDir).forEach(f => fs.unlinkSync(path.join(modulesDir, f)));

function getSlice(start1Indexed, end1Indexed) {
  return lines.slice(start1Indexed - 1, end1Indexed).join('\n');
}

// 01-state.js
const mod01 = [
  '/**',
  ' * 🧠 MÓDULO DE ESTADO Y SESIÓN (modules/01-state.js)',
  ' * Gestión de estado global, persistencia en localStorage, sesión JWT, balance y membresías.',
  ' * Estándar Ecosistema Desmulta DevSecOps.',
  ' */',
  '',
  getSlice(1, 45),
  '',
  getSlice(669, 831),
  '',
  getSlice(1352, 1432)
].join('\n');

// 02-toast.js
const mod02 = [
  '/**',
  ' * 🔔 MÓDULO DE NOTIFICACIONES TOAST (modules/02-toast.js)',
  ' * Notificaciones flotantes luxury glassmorphism con ambient glow, micro-barra y swipe gestures.',
  ' * Estándar Ecosistema Desmulta UI/UX.',
  ' */',
  '',
  getSlice(832, 1052)
].join('\n');

// 03-api.js
const mod03 = [
  '/**',
  ' * 🌐 MÓDULO DE RED Y CLIENTE API (modules/03-api.js)',
  ' * Comunicación HTTP centralizada, inyección de x-trace-id y carga de datasets.',
  ' * Estándar Ecosistema Desmulta DevSecOps.',
  ' */',
  '',
  'function generarTraceId() {',
  "  return 'hnt_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);",
  '}',
  '',
  getSlice(185, 215)
].join('\n');

// 04-filters.js
const mod04 = [
  '/**',
  ' * 🔍 MÓDULO DE BÚSQUEDA Y FILTROS (modules/04-filters.js)',
  ' * Normalización de búsqueda fonética/inteligente, omnibox y sincronización de ciudades.',
  ' * Estándar Ecosistema Desmulta.',
  ' */',
  '',
  getSlice(1691, 1864)
].join('\n');

// 05-carousel.js
const mod05 = [
  '/**',
  ' * 🎠 MÓDULO DE CARRUSELES Y FICHA TÉCNICA (modules/05-carousel.js)',
  ' * Carruseles fotográficos táctiles, navegación y drawer slide-up de detalles.',
  ' * Estándar Ecosistema Desmulta UI/UX.',
  ' */',
  '',
  getSlice(46, 144)
].join('\n');

// 06-cards.js
const mod06 = [
  '/**',
  ' * 🃏 MÓDULO DE RENDERIZADO BENTO GRID (modules/06-cards.js)',
  ' * Renderizado de oportunidades, skeletons, badges ejecutivos y formateo de precios.',
  ' * Estándar Ecosistema Desmulta UI/UX.',
  ' */',
  '',
  getSlice(2310, 2338),
  '',
  getSlice(164, 184),
  '',
  getSlice(216, 638)
].join('\n');

// 07-unlock.js
const mod07 = [
  '/**',
  ' * 🔓 MÓDULO DE DESBLOQUEO DE CONTACTOS (modules/07-unlock.js)',
  ' * Desbloqueo atómico de propietarios, actualización de tarjeta en DOM y enlace a WhatsApp.',
  ' * Estándar Ecosistema Desmulta Seguridad.',
  ' */',
  '',
  getSlice(1433, 1690)
].join('\n');

// 08-checkout.js
const mod08 = [
  '/**',
  ' * 💳 MÓDULO DE CHECKOUT Y PASARELA WOMPI (modules/08-checkout.js)',
  ' * Modal de compra, selector de planes, orquestación del widget Wompi y verificación de firmas.',
  ' * Estándar Ecosistema Desmulta Finanzas.',
  ' */',
  '',
  getSlice(145, 163),
  '',
  getSlice(1053, 1351)
].join('\n');

// 09-ui-effects.js
const mod09 = [
  '/**',
  ' * ✨ MÓDULO DE EFECTOS UI Y MICRO-INTERACCIONES (modules/09-ui-effects.js)',
  ' * Háptica táctil, ondas ripple, scroll reveal, parallax GPU y menú lateral off-canvas.',
  ' * Estándar Ecosistema Desmulta Frontend.',
  ' */',
  '',
  getSlice(639, 668),
  '',
  getSlice(2339, 2374),
  '',
  getSlice(2386, 2559)
].join('\n');

// 10-listeners.js
const mod10 = [
  '/**',
  ' * 🎯 MÓDULO DE LISTENERS Y EVENTOS (modules/10-listeners.js)',
  ' * Vinculación de eventos del DOM, atajos de teclado y orquestación de la UI.',
  ' * Estándar Ecosistema Desmulta.',
  ' */',
  '',
  getSlice(2375, 2385),
  '',
  getSlice(1865, 2309)
].join('\n');

const modulesMap = {
  '01-state.js': mod01,
  '02-toast.js': mod02,
  '03-api.js': mod03,
  '04-filters.js': mod04,
  '05-carousel.js': mod05,
  '06-cards.js': mod06,
  '07-unlock.js': mod07,
  '08-checkout.js': mod08,
  '09-ui-effects.js': mod09,
  '10-listeners.js': mod10
};

for (const [filename, content] of Object.entries(modulesMap)) {
  const filePath = path.join(modulesDir, filename);
  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('Resultados de generación y chequeo de sintaxis:');
let allOk = true;
for (const filename of Object.keys(modulesMap)) {
  const filePath = path.join(modulesDir, filename);
  const l = fs.readFileSync(filePath, 'utf8').split('\n').length;
  try {
    execSync('node --check ' + filePath);
    console.log(`✅ ${filename}: ${l} líneas — Sintaxis Válida`);
  } catch (err) {
    allOk = false;
    console.error(`❌ ${filename}: ${l} líneas — Error de Sintaxis`);
    console.error(err.message);
  }
}

if (!allOk) {
  process.exit(1);
} else {
  console.log('🎉 ¡Todos los módulos JS son 100% válidos y modulares!');
}
