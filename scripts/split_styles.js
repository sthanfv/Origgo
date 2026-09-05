const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT_DIR, 'style.css'), 'utf8');
const lines = css.split('\n');

const stylesDir = path.join(ROOT_DIR, 'styles');
if (!fs.existsSync(stylesDir)) fs.mkdirSync(stylesDir, { recursive: true });

// Limpiar si hay archivos previos
fs.readdirSync(stylesDir).forEach(f => fs.unlinkSync(path.join(stylesDir, f)));

function getSlice(start1Indexed, end1Indexed) {
  return lines.slice(start1Indexed - 1, end1Indexed).join('\n');
}

const modules = {
  '01-tokens.css': getSlice(1, 274),
  '02-base.css': getSlice(275, 640),
  '03-header.css': getSlice(641, 870),
  '04-command-bar.css': getSlice(871, 1220),
  '05-hero.css': getSlice(1221, 1540),
  '06-bento-grid.css': getSlice(1541, 1775),
  '07-cards.css': getSlice(1776, 2143),
  '08-slideup.css': getSlice(2144, 2492),
  '09-checkout-modal.css': getSlice(2493, 2850),
  '10-checkout-plans.css': getSlice(2851, 3225),
  '11-mobile.css': getSlice(3226, 3700),
  '12-sidebar.css': getSlice(3701, 3950),
  '13-footer.css': getSlice(3951, 4272),
  '14-toast.css': getSlice(4273, lines.length)
};

let concatenated = '';
for (const [filename, content] of Object.entries(modules)) {
  const filePath = path.join(stylesDir, filename);
  fs.writeFileSync(filePath, content, 'utf8');
  concatenated += (concatenated ? '\n' : '') + content;
}

console.log('Resultados de modularización CSS (Objetivo < 500 líneas):');
for (const filename of Object.keys(modules)) {
  const filePath = path.join(stylesDir, filename);
  const l = fs.readFileSync(filePath, 'utf8').split('\n').length;
  console.log(` - ${filename}: ${l} líneas`);
}

console.log('¿Concatenación idéntica al original?:', css === concatenated);
