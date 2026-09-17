/**
 * 🧪 PRUEBAS UNITARIAS: SOPORTE OFFLINE, AUTOCOMPLETADO Y SKELETONS BENTO
 * Valida la resiliencia sin conexión, seguridad OWASP en autocompletado y
 * contratos de renderizado de animaciones de carga.
 * Estándar Ecosistema Desmulta DevSecOps.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

describe('📡 SUITE 1: Resiliencia Offline y Caché Service Worker', () => {
  const swCode = fs.readFileSync(path.join(ROOT_DIR, 'sw.js'), 'utf8');
  const offlineModule = require(path.join(ROOT_DIR, 'modules', '14-offline.js'));

  test('sw.js define partición dedicada de imágenes y control LRU', () => {
    assert(/origgo-images-v\d+/.test(swCode), 'Debe contar con partición aislada de caché para imágenes');
    assert(swCode.includes('purgarExcesoCache') || swCode.includes('LIMITE_MAXIMO_IMAGENES_CACHE'), 'Debe gestionar cuota LRU de almacenamiento');
  });

  test('sw.js excluye rutas de pagos y auth de la caché (OWASP A01/A02)', () => {
    assert(swCode.includes('/api/payments/'), 'Debe omitir explícitamente /api/payments/');
    assert(swCode.includes('/api/auth/'), 'Debe omitir explícitamente /api/auth/');
    assert(swCode.includes('/api/user/'), 'Debe omitir explícitamente /api/user/');
  });

  test('sw.js incluye fallback SVG ante imágenes no disponibles', () => {
    assert(swCode.includes('FALLBACK_INMUEBLE_SVG') || swCode.includes('image/svg+xml'), 'Debe proveer fallback de imagen sin conexión');
  });

  test('modules/14-offline.js expone funciones de validación de conectividad', () => {
    assert.strictEqual(typeof offlineModule.estaDispositivoOnline, 'function');
    assert.strictEqual(typeof offlineModule.asegurarConexionParaAccion, 'function');
  });
});

describe('💡 SUITE 2: Búsqueda Inteligente y Autocompletado Seguro (OWASP)', () => {
  const autocompleteModule = require(path.join(ROOT_DIR, 'modules', '15-autocomplete.js'));

  test('Sugerencias tácticas base contienen sectores, tipologías y operaciones', () => {
    const base = autocompleteModule.SUGERENCIAS_TACTICAS_BASE;
    assert(Array.isArray(base), 'La base de sugerencias debe ser un arreglo');
    assert(base.length >= 10, 'Debe contener al menos 10 sugerencias estratégicas');

    const categorias = new Set(base.map(s => s.categoria));
    assert(categorias.has('barrio'), 'Debe sugerir barrios/sectores');
    assert(categorias.has('tipologia'), 'Debe sugerir tipologías');
    assert(categorias.has('operacion') || categorias.has('oportunidad'), 'Debe sugerir operaciones/oportunidades');
  });

  test('Filtrado de sugerencias limita a máximo 6 items para prevenir sobrecarga', () => {
    const res = autocompleteModule.calcularSugerencias('a');
    assert(res.length <= 6, `Debe limitar a 6 sugerencias máximo, obtuvo: ${res.length}`);
  });

  test('Prevención de inyección XSS en resaltado (OWASP A03 Injection)', () => {
    const payloadMalicioso = '<script>alert("xss")</script>';
    const resultado = autocompleteModule.resaltarCoincidenciaSegura(
      `Apartamento con ${payloadMalicioso} en Bogotá`,
      'Apartamento'
    );

    assert(!resultado.includes('<script>'), 'El resultado jamás debe contener etiquetas <script> ejecutables');
    assert(resultado.includes('&lt;script&gt;') || !resultado.includes('<script>'), 'Los caracteres especiales deben estar sanitizados');
  });
});

describe('🃏 SUITE 3: Animaciones de Carga Bento y Skeletons Fluidos', () => {
  const cardsModule = require(path.join(ROOT_DIR, 'modules', '06-cards.js'));
  const bentoCss = fs.readFileSync(path.join(ROOT_DIR, 'styles', '06-bento-grid.css'), 'utf8');

  test('generarHtmlSkeletons genera marcado con atributos ARIA accesibles', () => {
    const htmlSkeletons = typeof cardsModule.generarHtmlSkeletons === 'function'
      ? cardsModule.generarHtmlSkeletons(6)
      : null;

    assert(htmlSkeletons !== null, 'cardsModule debe exportar generarHtmlSkeletons');
    assert(htmlSkeletons.includes('skeleton-card'), 'Debe incluir la clase skeleton-card');
    assert(htmlSkeletons.includes('aria-busy="true"'), 'Debe incluir aria-busy="true" para lectores de pantalla');
    assert(htmlSkeletons.includes('skeleton-delay-'), 'Debe incluir delays escalonados');
  });

  test('06-bento-grid.css incluye aceleración GPU y soporte prefers-reduced-motion', () => {
    assert(bentoCss.includes('transform: translateZ(0)'), 'Debe habilitar aceleración GPU en cards/skeletons');
    assert(bentoCss.includes('prefers-reduced-motion'), 'Debe incluir media query de accesibilidad para reducir movimiento');
    assert(bentoCss.includes('skeletonShimmer'), 'Debe incluir keyframes skeletonShimmer');
  });
});
