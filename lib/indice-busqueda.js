/**
 * 🔎 Índice de búsqueda de inmuebles en Firestore (sin buscadores de pago).
 *
 * Firestore no busca texto libre. El estándar gratuito es guardar, junto a cada documento,
 * campos preparados para consultas exactas:
 *   - `indice_busqueda`: palabras normalizadas (sin tildes, minúsculas) de ciudad, barrio,
 *     tipo, operación, portal, título y referencia → consulta `array-contains`.
 *   - `enlace_huella`: SHA-256 del enlace del anuncio original normalizado → consulta `==`.
 *   - `telefono_huella`: HMAC-SHA256 del celular (índice ciego): permite encontrar los
 *     anuncios de un número sin guardar el número en claro. Es el mismo principio de las
 *     huellas de cédula de Desmulta.
 *
 * Lo usan la ingesta (al guardar cada inmueble), el formulario público de retiro y el
 * buscador del panel. La clave del índice ciego se deriva de la clave de cifrado de leads:
 * si esa clave se rota, hay que reconstruir el índice desde el panel ("Reindexar").
 */
const crypto = require('crypto');
const { obtenerKeyRingLeads, normalizePhone } = require('./crypto');

const PALABRAS_VACIAS = new Set([
  'a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'lo', 'los', 'para', 'por', 'se', 'un',
  'una', 'y', 'o', 'mi', 'su', 'que', 'es',
]);
const MAX_TOKENS = 40;

/** Minúsculas, sin tildes y solo letras/números separados por espacios. */
function normalizarTexto(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Palabras útiles para buscar (sin palabras vacías ni sueltas de una letra). */
function tokenizar(texto) {
  return normalizarTexto(texto)
    .split(' ')
    .filter((t) => t.length >= 2 && !PALABRAS_VACIAS.has(t));
}

/** Palabras clave de un inmueble para `indice_busqueda`. */
function tokensInmueble(lead) {
  const partes = [
    lead.ciudad,
    lead.barrio,
    lead.ubicacion,
    lead.tipo_inmueble,
    lead.tipo_operacion,
    lead.portal,
    lead.titulo,
  ];
  const tokens = new Set();
  for (const p of partes) for (const t of tokenizar(p)) tokens.add(t);
  // La referencia completa y su número (lead-inm-3001 → "lead-inm-3001" y "3001").
  if (lead.id) {
    tokens.add(String(lead.id).toLowerCase());
    const numero = String(lead.id).match(/(\d{3,})$/);
    if (numero) tokens.add(numero[1]);
  }
  return Array.from(tokens).slice(0, MAX_TOKENS);
}

/** Enlace comparable: sin protocolo, sin "www.", sin parámetros ni barra final. */
function normalizarEnlace(url) {
  try {
    const u = new URL(String(url).trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const ruta = u.pathname.replace(/\/+$/, '').toLowerCase();
    return host + ruta;
  } catch (_) {
    return '';
  }
}

function huellaEnlace(url) {
  const n = normalizarEnlace(url);
  return n ? crypto.createHash('sha256').update(n).digest('hex').slice(0, 40) : '';
}

let claveIndice = null;
/** Clave propia del índice ciego, derivada de la clave de leads (una clave por propósito). */
function obtenerClaveIndice() {
  if (!claveIndice) {
    const { keys, activeKid } = obtenerKeyRingLeads();
    const maestra = Buffer.from(keys[activeKid], 'hex');
    claveIndice = crypto.createHmac('sha256', maestra).update('origgo:indice-telefono:v1').digest();
  }
  return claveIndice;
}

/** Celular colombiano a 10 dígitos o '' si no parece un número válido. */
function telefonoNormalizado(telefono) {
  const n = normalizePhone(telefono);
  return /^\d{10}$/.test(n) ? n : '';
}

function huellaTelefono(telefono) {
  const n = telefonoNormalizado(telefono);
  return n ? crypto.createHmac('sha256', obtenerClaveIndice()).update(n).digest('hex').slice(0, 40) : '';
}

/**
 * Campos de índice para guardar junto al inmueble.
 * @param {Object} lead - Datos públicos del inmueble.
 * @param {{ telefono?: string, enlace?: string }} [contacto] - Contacto en claro (solo en memoria).
 */
function camposIndice(lead, contacto = {}) {
  const campos = { indice_busqueda: tokensInmueble(lead) };
  const enlace = huellaEnlace(contacto.enlace || lead.enlace || '');
  const telefono = huellaTelefono(contacto.telefono || '');
  if (enlace) campos.enlace_huella = enlace;
  if (telefono) campos.telefono_huella = telefono;
  return campos;
}

/** Solo para pruebas: olvida la clave derivada (p. ej. tras cambiar variables de entorno). */
function reiniciarClaveIndice() {
  claveIndice = null;
}

module.exports = {
  normalizarTexto,
  tokenizar,
  tokensInmueble,
  normalizarEnlace,
  huellaEnlace,
  huellaTelefono,
  telefonoNormalizado,
  camposIndice,
  reiniciarClaveIndice,
};
