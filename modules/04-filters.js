/**
 * 🔍 MÓDULO DE BÚSQUEDA Y FILTROS (modules/04-filters.js)
 * Normalización de búsqueda fonética/inteligente, omnibox y sincronización de ciudades.
 * Estándar Ecosistema Desmulta.
 */

/**
 * Normaliza una cadena de texto para búsqueda flexible y tolerante a la escritura:
 * - Convierte a minúsculas
 * - Remueve diacríticos y acentos (á->a, é->e, í->i, ó->o, ú->u, ü->u)
 * - Mapea 'ñ' a 'n' para permitir que búsquedas sin eñe (dueno -> dueño) coincidan
 * - Sustituye caracteres de puntuación por espacios
 * - Colapsa espacios redundantes
 * @param {string} str
 * @returns {string}
 */
function normalizarTextoBusqueda(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[.,;:()\-–—_'"/\\#+!¿?¡]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Diccionario de sinónimos, abreviaturas y variantes léxicas en Colombia
 * para búsquedas inmobiliarias y vehiculares de alta precisión.
 */
const DICCIONARIO_TERMINOS = {
  // Tipología Inmobiliaria
  "apto": ["apartamento", "departamento", "apto"],
  "aptos": ["apartamento", "departamento", "apto"],
  "apartamento": ["apartamento", "apto"],
  "apartamentos": ["apartamento", "apto"],
  "ph": ["penthouse", "duplex", "ph"],
  "penthouse": ["penthouse", "ph", "duplex"],
  "duplex": ["duplex", "penthouse"],
  "casa": ["casa", "quinta", "campestre", "chalet"],
  "casas": ["casa", "quinta", "campestre"],
  "lote": ["lote", "terreno", "campestre"],
  "campestre": ["campestre", "quinta", "casa", "lote"],
  "quinta": ["quinta", "campestre", "casa"],
  // Distribución y Ambientes
  "alcoba": ["habitacion", "habitaciones", "hab", "alcoba", "alcobas", "cuarto"],
  "alcobas": ["habitacion", "habitaciones", "hab", "alcoba", "alcobas", "cuarto"],
  "habitacion": ["habitacion", "habitaciones", "hab", "alcoba", "alcobas", "cuarto"],
  "habitaciones": ["habitacion", "habitaciones", "hab", "alcoba", "alcobas", "cuarto"],
  "hab": ["habitacion", "habitaciones", "hab", "alcoba", "alcobas"],
  "cuarto": ["habitacion", "habitaciones", "hab", "alcoba", "alcobas"],
  "bano": ["bano", "banos", "ducha"],
  "banos": ["bano", "banos", "ducha"],
  "garaje": ["garaje", "garajes", "parqueadero", "parqueaderos", "parq", "cochera"],
  "garajes": ["garaje", "garajes", "parqueadero", "parqueaderos", "parq"],
  "parqueadero": ["garaje", "garajes", "parqueadero", "parqueaderos", "parq"],
  "parqueaderos": ["garaje", "garajes", "parqueadero", "parqueaderos", "parq"],
  "parq": ["garaje", "garajes", "parqueadero", "parqueaderos"],
  // Trato Directo y Oportunidad
  "dueno": ["propietario", "particular", "directo", "dueno", "fsbo"],
  "dueño": ["propietario", "particular", "directo", "dueno", "fsbo"],
  "propietario": ["propietario", "particular", "directo", "dueno"],
  "particular": ["propietario", "particular", "directo", "dueno"],
  "directo": ["directo", "dueno", "propietario", "particular"],
  "rebaja": ["rebaja", "descuento", "ganga", "barato", "negociable", "oportunidad"],
  "descuento": ["rebaja", "descuento", "ganga", "arbitraje"],
  "ganga": ["rebaja", "ganga", "oportunidad", "arbitraje"],
  "viaje": ["viaje", "motivo", "urgente"],
  "urgente": ["urgente", "viaje", "motivo", "urgeme", "oportunidad"],
  "arbitraje": ["arbitraje", "descuento", "mediana", "ganga"],
  // Vehículos
  "carro": ["vehiculo", "auto", "camioneta", "sedan", "suv", "carro"],
  "auto": ["vehiculo", "carro", "camioneta", "sedan", "suv"],
  "vehiculo": ["vehiculo", "carro", "camioneta", "auto"],
  "camioneta": ["camioneta", "suv", "pickup", "pick-up", "4x4"],
  "suv": ["suv", "camioneta", "4x4"],
  "pickup": ["pickup", "pick-up", "camioneta", "4x4", "utilitaria"],
  "sedan": ["sedan", "deportivo", "carro", "auto"],
  "4x4": ["4x4", "camioneta", "suv", "pickup"],
  // Ciudades / Sectores
  "bogota": ["bogota", "rosales", "chico", "cundinamarca"],
  "medellin": ["medellin", "poblado", "laureles", "san lucas", "antioquia"],
  "cali": ["cali", "pance", "valle del lili", "valle"],
  "cartagena": ["cartagena", "bocagrande", "bolivar"],
  "pereira": ["pereira", "cerritos", "risaralda", "eje cafetero"],
  "bucaramanga": ["bucaramanga", "floridablanca", "ruitoque", "santander"],
  "floridablanca": ["floridablanca", "bucaramanga", "ruitoque"]
};

/**
 * Evalúa si una tarjeta coincide con la búsqueda del usuario:
 * - Divide la consulta en tokens
 * - Verifica coincidencia directa, sinónimos y prefijos de raíz
 * - Aplica límites de seguridad (máximo 80 caracteres)
 * @param {string} textoTarjetaNormalizado
 * @param {string} busquedaUsuario
 * @returns {boolean}
 */
function coincideBusquedaInteligente(textoTarjetaNormalizado, busquedaUsuario) {
  if (!busquedaUsuario) return true;
  const queryLimpia = normalizarTextoBusqueda(busquedaUsuario.slice(0, 80));
  if (!queryLimpia) return true;

  const tokens = queryLimpia.split(" ").filter(t => t.length > 0);
  if (tokens.length === 0) return true;

  return tokens.every(token => {
    // 1. Coincidencia directa como subcadena
    if (textoTarjetaNormalizado.includes(token)) return true;

    // 2. Coincidencia por sinónimos o variantes léxicas
    const sinonimos = DICCIONARIO_TERMINOS[token];
    if (sinonimos && sinonimos.some(s => textoTarjetaNormalizado.includes(s))) {
      return true;
    }

    // 3. Tolerancia por prefijo (palabra parcial de al menos 4 caracteres)
    if (token.length >= 4) {
      const raiz = token.slice(0, token.length - 1);
      if (textoTarjetaNormalizado.includes(raiz)) return true;
    }

    return false;
  });
}

/**
 * Aplica los filtros combinados (Omnibox de búsqueda libre inteligente, Ciudad y Trato Directo)
 * sobre la grilla de oportunidades Bento.
 */
function aplicarFiltrosOmnibox() {
  paginaActual = 1;
  limiteVisible = 6;
  if (datosActuales) {
    renderizarInterfaz(datosActuales);
  }
}

/**
 * Restablece todos los filtros del Omnibox a su estado por defecto.
 */
function restablecerTodosLosFiltros() {
  textoBusquedaActivo = "";
  filtroCiudadActivo = "";
  filtroTratoDirectoActivo = false;

  const omnibox = document.getElementById("omniboxSearch");
  if (omnibox) omnibox.value = "";

  const btnClear = document.getElementById("cmdSearchClear");
  if (btnClear) btnClear.classList.remove("visible");

  const labelLocation = document.getElementById("cmdFilterLocationLabel");
  if (labelLocation) labelLocation.textContent = "Colombia (Todas)";

  const pillLocation = document.getElementById("cmdFilterLocation");
  if (pillLocation) {
    pillLocation.classList.remove("active-filter", "open");
    pillLocation.setAttribute("aria-expanded", "false");
  }

  const dropdown = document.getElementById("cmdLocationDropdown");
  if (dropdown) {
    dropdown.classList.remove("show");
    dropdown.querySelectorAll(".cmd-dropdown-item").forEach(item => {
      if (item.getAttribute("data-city") === "") {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });
  }

  const pillType = document.getElementById("cmdFilterType");
  if (pillType) pillType.classList.remove("active-filter");

  aplicarFiltrosOmnibox();
}
