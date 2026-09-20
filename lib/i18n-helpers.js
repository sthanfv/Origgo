/**
 * 🌐 UTILIDADES Y AYUDAS DE INTERNACIONALIZACIÓN (I18N)
 * Origgo Intelligence — Módulo canónico para Backend y Pruebas
 * 
 * Provee normalización fonética, resolución de sinónimos inmobiliarios inglés-español,
 * conversión cambiaria de referencia a USD y localización de atributos de catálogo.
 */

const DICCIONARIO_TERMINOS = {
  apartment: ['apartamento', 'apto', 'departamento'],
  house: ['casa'],
  studio: ['apartaestudio', 'studio'],
  pool: ['piscina'],
  gym: ['gimnasio'],
  balcony: ['balcon', 'balcón'],
  terrace: ['terraza'],
  furnished: ['amoblado', 'amueblado'],
  view: ['vista'],
  security: ['vigilancia', 'seguridad'],
  elevator: ['ascensor'],
  storage: ['deposito', 'depósito'],
  rent: ['arriendo', 'alquiler'],
  sale: ['venta'],
  luxury: ['lujo', 'exclusivo'],
  investment: ['inversion', 'inversión'],
  remodeled: ['remodelado'],
  bedroom: ['habitacion', 'habitaciones', 'hab', 'alcoba', 'alcobas', 'cuarto', 'cuartos'],
  bathroom: ['bano', 'baño', 'banos', 'baños'],
  parking: ['garaje', 'garajes', 'parqueadero', 'parqueaderos', 'estacionamiento'],
  owner: ['propietario', 'dueno', 'dueño', 'directo']
};

const DICCIONARIO_I18N = {
  es: {
    directDeal: '🔥 Oportunidad Directa',
    priceDrop: '📉 Rebaja Activa'
  },
  en: {
    directDeal: '🔥 Direct Deal',
    priceDrop: '📉 Price Drop'
  }
};

/**
 * Normaliza una cadena de texto para comparaciones insensibles a mayúsculas y acentos.
 * @param {string} str
 * @returns {string}
 */
function normalizarTextoBusqueda(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Determina si el texto de un lead coincide con un término de búsqueda (soportando sinónimos en inglés).
 * @param {string} textoLead
 * @param {string} termino
 * @returns {boolean}
 */
function coincideBusquedaInteligente(textoLead, termino) {
  const normLead = normalizarTextoBusqueda(textoLead);
  const normTermino = normalizarTextoBusqueda(termino);
  if (!normLead || !normTermino) return false;

  if (normLead.includes(normTermino)) return true;

  const sinonimos = DICCIONARIO_TERMINOS[normTermino];
  if (Array.isArray(sinonimos)) {
    return sinonimos.some(s => normLead.includes(normalizarTextoBusqueda(s)));
  }

  return false;
}

/**
 * Traduce el badge de urgencia u oportunidad comercial.
 * @param {string} badge
 * @param {boolean} isEn
 * @returns {string}
 */
function traducirBadgeUrgencia(badge, isEn) {
  if (!isEn || !badge) return badge || '';
  if (badge.includes('Oportunidad Directa')) return '🔥 Direct Deal';
  if (badge.includes('Rebaja Activa')) return '📉 Price Drop';
  return badge;
}

/**
 * Traduce el título de la tarjeta inmobiliaria.
 * @param {string} titulo
 * @param {boolean} isEn
 * @returns {string}
 */
function traducirTituloCatalogo(titulo, isEn) {
  if (!isEn || !titulo) return titulo || '';
  return String(titulo)
    .replace('Apartamento en Venta', 'Apartment for Sale')
    .replace('Casa en Venta', 'House for Sale')
    .replace('Apartamento en Arriendo', 'Apartment for Rent')
    .replace('Casa en Arriendo', 'House for Rent');
}

/**
 * Traduce la línea de distribución de espacios (habitaciones, baños, garajes).
 * @param {string} dato
 * @param {boolean} isEn
 * @returns {string}
 */
function traducirDatoDistribucion(dato, isEn) {
  if (!isEn || !dato) return dato || '';
  return String(dato)
    .replace('3 Hab', '3 Beds')
    .replace('2 Hab', '2 Beds')
    .replace('1 Hab', '1 Bed')
    .replace('Hab', 'Beds')
    .replace('2 Baños', '2 Baths')
    .replace('3 Baños', '3 Baths')
    .replace('1 Baño', '1 Bath')
    .replace('Baños', 'Baths')
    .replace('Baño', 'Bath')
    .replace('Garajes', 'Parking')
    .replace('Garaje', 'Parking');
}

/**
 * Calcula el valor equivalente estimado en dólares estadounidenses (USD) usando tasa de referencia.
 * @param {string|number} precioCop
 * @returns {string}
 */
function calcularReferenciaUSD(precioCop) {
  if (!precioCop) return '';
  const num = typeof precioCop === 'number' ? precioCop : Number(String(precioCop).replace(/\D/g, ''));
  if (!num || num <= 0) return '';
  const usd = Math.round(num / 4100);
  return `${usd.toLocaleString('en-US')} USD`;
}

module.exports = {
  DICCIONARIO_TERMINOS,
  DICCIONARIO_I18N,
  normalizarTextoBusqueda,
  coincideBusquedaInteligente,
  traducirBadgeUrgencia,
  traducirTituloCatalogo,
  traducirDatoDistribucion,
  calcularReferenciaUSD
};
