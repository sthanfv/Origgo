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
    ejecutarConTransicionSuave(() => {
      renderizarInterfaz(datosActuales);
    });
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

/**
 * Extrae de forma reactiva y única todas las ciudades presentes en el dataset activo
 * y reconstruye tanto el menú desplegable táctico (desktop) como el selector off-canvas (móvil).
 * Si la base de datos incorpora nuevas oportunidades (ej. Cúcuta, Ibagué, etc.), se integran de inmediato.
 * @param {Array} leads
 */
function sincronizarDropdownCiudades(leads) {
  if (!Array.isArray(leads) || leads.length === 0) return;

  const conteoPorCiudad = {};
  leads.forEach(l => {
    let c = (l.ciudad || l.ubicacion || "").trim();
    if (!c) return;
    if (c.includes(",")) {
      const partes = c.split(",");
      c = partes[partes.length - 1].trim();
    }
    const cNorm = c.charAt(0).toUpperCase() + c.slice(1);
    conteoPorCiudad[cNorm] = (conteoPorCiudad[cNorm] || 0) + 1;
  });

  const ciudadesOrdenadas = Object.keys(conteoPorCiudad).sort((a, b) => a.localeCompare(b, "es"));

  // 1. Dropdown Desktop en la Barra de Comandos
  const dropdown = document.getElementById("cmdLocationDropdown");
  if (dropdown) {
    let html = `
      <div class="cmd-dropdown-item ${filtroCiudadActivo === "" ? "active" : ""}" data-city="">
        <i class="fa-solid fa-earth-americas"></i>
        <span>Colombia (Todas)</span>
        <i class="fa-solid fa-check item-check"></i>
      </div>
    `;

    ciudadesOrdenadas.forEach(ciudad => {
      const cLow = ciudad.toLowerCase();
      let icon = "fa-solid fa-location-dot";
      if (cLow.includes("bogot")) icon = "fa-solid fa-city";
      else if (cLow.includes("medell") || cLow.includes("antioquia") || cLow.includes("envigado")) icon = "fa-solid fa-mountain-city";
      else if (cLow.includes("cali")) icon = "fa-solid fa-tree-city";
      else if (cLow.includes("barranquilla")) icon = "fa-solid fa-anchor";
      else if (cLow.includes("cartagena") || cLow.includes("santa marta")) icon = "fa-solid fa-umbrella-beach";
      else if (cLow.includes("bucaramanga") || cLow.includes("floridablanca")) icon = "fa-solid fa-building";
      else if (cLow.includes("pereira") || cLow.includes("armenia") || cLow.includes("manizales")) icon = "fa-solid fa-mug-hot";
      else if (cLow.includes("cucuta") || cLow.includes("cúcuta")) icon = "fa-solid fa-landmark";
      else if (cLow.includes("ibagu")) icon = "fa-solid fa-music";

      const esActivo = filtroCiudadActivo && filtroCiudadActivo.toLowerCase() === ciudad.toLowerCase();
      const cant = conteoPorCiudad[ciudad];

      html += `
        <div class="cmd-dropdown-item ${esActivo ? "active" : ""}" data-city="${escaparHtml(ciudad)}">
          <i class="${icon}"></i>
          <span>${escaparHtml(ciudad)}</span>
          <span class="city-lead-count city-count-badge">(${cant})</span>
          <i class="fa-solid fa-check item-check"></i>
        </div>
      `;
    });

    dropdown.innerHTML = html;
  }

  // 2. Selector Móvil en el Menú Lateral Off-Canvas
  const sideSelect = document.getElementById("sideMenuCitySelect");
  if (sideSelect) {
    let selHtml = `<option value="">Todas las Ciudades</option>`;
    ciudadesOrdenadas.forEach(ciudad => {
      const sel = filtroCiudadActivo && filtroCiudadActivo.toLowerCase() === ciudad.toLowerCase() ? "selected" : "";
      selHtml += `<option value="${escaparHtml(ciudad)}" ${sel}>${escaparHtml(ciudad)} (${conteoPorCiudad[ciudad]})</option>`;
    });
    sideSelect.innerHTML = selHtml;
  }
}

/**
 * Filtra y ordena los leads del catálogo según los criterios activos:
 * - Búsqueda semántica/fonética en Omnibox
 * - Filtro por Ciudad
 * - Ordenamiento por menor $/m², rebajas recientes o más recientes
 * @param {Array} leads
 * @returns {Array}
 */
function filtrarYOrdenarLeads(leads) {
  if (!Array.isArray(leads)) return [];

  const filtrados = leads.filter((item) => {
    // A. Filtro por Ciudad
    if (filtroCiudadActivo) {
      const ciudadesObjetivo = filtroCiudadActivo.split("|").map(normalizarTextoBusqueda);
      const itemCiudadNorm = normalizarTextoBusqueda(item.ciudad || "");
      const itemUbicNorm = normalizarTextoBusqueda(item.ubicacion || "");
      const itemTituloNorm = normalizarTextoBusqueda(item.titulo || "");
      const itemBarrioNorm = normalizarTextoBusqueda(item.barrio || "");
      const coincideCiudad = ciudadesObjetivo.some((c) =>
        itemCiudadNorm.includes(c) || itemUbicNorm.includes(c) || itemTituloNorm.includes(c) || itemBarrioNorm.includes(c)
      );
      if (!coincideCiudad) return false;
    }

    // B. Filtro por Texto Libre (Omnibox)
    if (textoBusquedaActivo) {
      const itemSearchText = normalizarTextoBusqueda(
        `${item.titulo || ''} ${item.ciudad || ''} ${item.ubicacion || ''} ${item.barrio || ''} ${item.precio || ''} ${item.detalles ? Object.values(item.detalles).join(' ') : ''}`
      );
      if (!coincideBusquedaInteligente(itemSearchText, textoBusquedaActivo)) return false;
    }

    return true;
  });

  // C. Ordenamiento Dinámico
  if (criterioOrdenActivo === 'precio_m2_asc') {
    filtrados.sort((a, b) => {
      const m2A = Number(String(a.precio_m2 || '').replace(/\D/g, '')) || Infinity;
      const m2B = Number(String(b.precio_m2 || '').replace(/\D/g, '')) || Infinity;
      return m2A - m2B;
    });
  } else if (criterioOrdenActivo === 'rebajas') {
    filtrados.sort((a, b) => {
      const rebA = Boolean(a.rebaja && a.rebaja.trim() !== '') ? 1 : 0;
      const rebB = Boolean(b.rebaja && b.rebaja.trim() !== '') ? 1 : 0;
      return rebB - rebA;
    });
  } else if (criterioOrdenActivo === 'precio_asc') {
    filtrados.sort((a, b) => (a.precio_raw || 0) - (b.precio_raw || 0));
  } else if (criterioOrdenActivo === 'precio_desc') {
    filtrados.sort((a, b) => (b.precio_raw || 0) - (a.precio_raw || 0));
  }

  return filtrados;
}

/**
 * Inicializa el selector táctico de ordenamiento en la Barra de Comandos.
 */
function inicializarBarraOrdenamiento() {
  const pillSort = document.getElementById("cmdFilterSort");
  const dropdownSort = document.getElementById("cmdSortDropdown");
  const labelSort = document.getElementById("cmdFilterSortLabel");

  if (!pillSort || !dropdownSort) return;

  pillSort.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdownSort.classList.toggle("show");
    pillSort.classList.toggle("open", isOpen);
    pillSort.setAttribute("aria-expanded", String(isOpen));
  });

  dropdownSort.addEventListener("click", (e) => {
    const item = e.target.closest(".cmd-dropdown-item");
    if (!item) return;
    e.stopPropagation();
    const sortValue = item.getAttribute("data-sort") || "recientes";
    criterioOrdenActivo = sortValue;

    dropdownSort.querySelectorAll(".cmd-dropdown-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");

    const spanText = item.querySelector("span") ? item.querySelector("span").textContent : "Más Recientes";
    if (labelSort) labelSort.textContent = spanText;

    pillSort.classList.toggle("active-filter", sortValue !== "recientes");
    dropdownSort.classList.remove("show");
    pillSort.classList.remove("open");
    pillSort.setAttribute("aria-expanded", "false");

    aplicarFiltrosOmnibox();
  });

  window.addEventListener("click", (e) => {
    if (dropdownSort && dropdownSort.classList.contains("show")) {
      if (!pillSort.contains(e.target) && !dropdownSort.contains(e.target)) {
        dropdownSort.classList.remove("show");
        pillSort.classList.remove("open");
        pillSort.setAttribute("aria-expanded", "false");
      }
    }
  });
}
