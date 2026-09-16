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
  "apto": ["apartamento", "departamento", "apto"], "aptos": ["apartamento", "apto"], "apartamento": ["apartamento", "apto"], "apartamentos": ["apartamento", "apto"],
  "ph": ["penthouse", "duplex", "ph"], "penthouse": ["penthouse", "ph", "duplex"], "duplex": ["duplex", "penthouse"],
  "casa": ["casa", "quinta", "campestre", "chalet"], "casas": ["casa", "quinta", "campestre"], "lote": ["lote", "terreno", "campestre"], "campestre": ["campestre", "quinta", "casa", "lote"],
  "alcoba": ["habitacion", "habitaciones", "hab", "alcoba", "cuarto"], "alcobas": ["habitacion", "hab", "alcoba"], "habitacion": ["habitacion", "hab", "alcoba", "cuarto"], "habitaciones": ["habitacion", "hab", "alcoba"],
  "hab": ["habitacion", "hab", "alcoba"], "cuarto": ["habitacion", "hab", "alcoba"], "bano": ["bano", "banos", "ducha"], "banos": ["bano", "banos", "ducha"],
  "garaje": ["garaje", "garajes", "parqueadero", "parq"], "garajes": ["garaje", "parqueadero", "parq"], "parqueadero": ["garaje", "parqueadero", "parq"], "parqueaderos": ["garaje", "parqueadero", "parq"], "parq": ["garaje", "parqueadero"],
  "dueno": ["propietario", "particular", "directo", "dueno", "fsbo"], "dueño": ["propietario", "particular", "directo", "dueno", "fsbo"], "propietario": ["propietario", "particular", "directo", "dueno"], "particular": ["propietario", "particular", "directo", "dueno"], "directo": ["directo", "dueno", "propietario", "particular"],
  "rebaja": ["rebaja", "descuento", "ganga", "barato", "oportunidad"], "descuento": ["rebaja", "descuento", "ganga", "arbitraje"], "ganga": ["rebaja", "ganga", "oportunidad", "arbitraje"], "viaje": ["viaje", "motivo", "urgente"], "urgente": ["urgente", "viaje", "motivo", "oportunidad"], "arbitraje": ["arbitraje", "descuento", "ganga"],
  "carro": ["vehiculo", "auto", "camioneta", "sedan", "suv", "carro"], "auto": ["vehiculo", "carro", "camioneta", "sedan", "suv"], "vehiculo": ["vehiculo", "carro", "camioneta", "auto"],
  "camioneta": ["camioneta", "suv", "pickup", "4x4"], "suv": ["suv", "camioneta", "4x4"], "pickup": ["pickup", "camioneta", "4x4"], "sedan": ["sedan", "carro", "auto"], "4x4": ["4x4", "camioneta", "suv", "pickup"],
  "apartment": ["apartamento", "apto"], "apartments": ["apartamento", "apto"], "flat": ["apartamento", "apto"], "condo": ["apartamento", "apto"], "house": ["casa", "quinta", "campestre"], "houses": ["casa", "quinta"], "home": ["casa", "apartamento"],
  "land": ["lote", "terreno"], "lot": ["lote", "terreno"], "plot": ["lote", "terreno"], "office": ["oficina"], "building": ["edificio"], "estate": ["finca", "campestre"], "warehouse": ["bodega"], "commercial": ["local", "comercial"], "store": ["local"],
  "bedroom": ["habitacion", "hab", "alcoba"], "bedrooms": ["habitacion", "hab", "alcoba"], "bed": ["habitacion", "hab"], "beds": ["habitaciones", "hab"], "bath": ["bano", "banos"], "baths": ["bano", "banos"], "bathroom": ["bano"], "bathrooms": ["bano", "banos"],
  "parking": ["garaje", "parqueadero"], "garage": ["garaje", "parqueadero"], "owner": ["propietario", "directo", "dueno"], "owners": ["propietario", "dueno"], "direct": ["directo", "dueno"],
  "discount": ["rebaja", "descuento", "ganga"], "bargain": ["ganga", "rebaja"], "deal": ["oportunidad", "directo"], "urgent": ["urgente", "viaje"],
  "studio": ["apartaestudio", "apartamento", "apto"], "pool": ["piscina"], "gym": ["gimnasio"], "balcony": ["balcon", "terraza"], "terrace": ["terraza", "balcon"],
  "furnished": ["amoblado", "amoblada"], "view": ["vista", "panoramica"], "security": ["vigilancia", "porteria"], "elevator": ["ascensor"], "storage": ["deposito", "bodega"],
  "rent": ["arriendo", "alquiler"], "sale": ["venta"], "luxury": ["lujo", "penthouse"], "investment": ["inversion", "arbitraje"], "remodeled": ["remodelado", "nuevo"],
  "bogota": ["bogota", "rosales", "chico"], "medellin": ["medellin", "poblado", "laureles"], "cali": ["cali", "pance"], "cartagena": ["cartagena", "bocagrande"], "pereira": ["pereira", "cerritos"], "bucaramanga": ["bucaramanga"]
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
  limiteVisible = 15;
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
  filtroHoyActivo = false;
  filtroOperacionActivo = "";

  const btnHoy = document.getElementById("cmdFilterToday");
  if (btnHoy) { btnHoy.classList.remove("active-filter"); btnHoy.setAttribute("aria-pressed", "false"); }
  const omnibox = document.getElementById("omniboxSearch");
  if (omnibox) omnibox.value = "";
  const btnClear = document.getElementById("cmdSearchClear");
  if (btnClear) btnClear.classList.remove("visible");

  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const lblLoc = document.getElementById("cmdFilterLocationLabel");
  if (lblLoc) lblLoc.textContent = isEn ? "All Cities" : "Colombia (Todas)";
  const lblOp = document.getElementById("cmdFilterOperationLabel");
  if (lblOp) lblOp.textContent = isEn ? "All Operations" : "Todas las operaciones";

  document.querySelectorAll(".cmd-filter-pill").forEach(p => p.classList.remove("active-filter", "open"));
  document.querySelectorAll(".cmd-dropdown-menu").forEach(d => d.classList.remove("show"));
  document.querySelectorAll(".cmd-filter-pill-dropdown-wrapper").forEach(w => w.classList.remove("open"));

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
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const dropdown = document.getElementById("cmdLocationDropdown");
  if (dropdown) {
    let html = `
      <div class="cmd-dropdown-item ${filtroCiudadActivo === "" ? "active" : ""}" data-city="">
        <i class="fa-solid fa-earth-americas"></i>
        <span data-i18n="filter_colombia_all">${isEn ? 'Colombia (All)' : 'Colombia (Todas)'}</span>
        <i class="fa-solid fa-check item-check"></i>
      </div>
    `;

    ciudadesOrdenadas.forEach(ciudad => {
      const cLow = ciudad.toLowerCase();
      let icon = "fa-solid fa-location-dot";
      if (cLow.includes("bogot")) icon = "fa-solid fa-city";
      else if (cLow.includes("medell") || cLow.includes("antioquia")) icon = "fa-solid fa-mountain-city";
      else if (cLow.includes("cali")) icon = "fa-solid fa-tree-city";
      else if (cLow.includes("barranquilla")) icon = "fa-solid fa-anchor";
      else if (cLow.includes("cartagena") || cLow.includes("santa marta")) icon = "fa-solid fa-umbrella-beach";
      else if (cLow.includes("bucaramanga")) icon = "fa-solid fa-building";
      else if (cLow.includes("pereira") || cLow.includes("manizales")) icon = "fa-solid fa-mug-hot";

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
    let selHtml = `<option value="" data-i18n="filter_all_cities">${isEn ? 'All Cities' : 'Todas las Ciudades'}</option>`;
    ciudadesOrdenadas.forEach(ciudad => {
      const sel = filtroCiudadActivo && filtroCiudadActivo.toLowerCase() === ciudad.toLowerCase() ? "selected" : "";
      selHtml += `<option value="${escaparHtml(ciudad)}" ${sel}>${escaparHtml(ciudad)} (${conteoPorCiudad[ciudad]})</option>`;
    });
    sideSelect.innerHTML = selHtml;
  }
}

/**
 * Deduplica un conjunto de leads garantizando una sola instancia canónica por oportunidad.
 * Aplica triple clave de idempotencia:
 * 1. ID único del lead
 * 2. Enlace fuente original de la publicación (Marketplace/Portal)
 * 3. Firma estructural única (título + precio + ubicación + superficie)
 * @param {Array} leads
 * @returns {Array}
 */
function deduplicarLeads(leads) {
  if (!Array.isArray(leads) || leads.length === 0) return [];
  const vistosIds = new Set();
  const vistosEnlaces = new Set();
  const vistosFirmas = new Set();

  return leads.filter((item) => {
    if (!item || typeof item !== "object") return false;

    // 1. Deduplicación por ID único
    if (item.id) {
      const idLimpio = String(item.id).trim();
      if (vistosIds.has(idLimpio)) return false;
      vistosIds.add(idLimpio);
    }

    // 2. Deduplicación por enlace original
    const enlace = item.enlace || item.url || item.enlace_bloqueado;
    if (enlace && typeof enlace === "string" && enlace.length > 5) {
      const enlaceNorm = enlace.trim().toLowerCase().split("?")[0];
      if (vistosEnlaces.has(enlaceNorm)) return false;
      vistosEnlaces.add(enlaceNorm);
    }

    // 3. Deduplicación por firma estructural
    const titNorm = normalizarTextoBusqueda(item.titulo || "");
    const prec = item.precio_raw || String(item.precio || "").replace(/\D/g, "");
    const ciuNorm = normalizarTextoBusqueda(item.ciudad || item.ubicacion || "");
    const supNorm = normalizarTextoBusqueda(item.dato_1 || item.superficie_m2 || "");

    if (titNorm && prec && ciuNorm) {
      const firma = `${titNorm}__${prec}__${ciuNorm}__${supNorm}`;
      if (vistosFirmas.has(firma)) return false;
      vistosFirmas.add(firma);
    }

    return true;
  });
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
  const leadsUnicos = deduplicarLeads(leads);

  const filtrados = leadsUnicos.filter((item) => {
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
      const detallesValores = item.detalles ? Object.values(item.detalles).join(' ') : '';
      const detallesEnValores = item.detalles_en ? Object.values(item.detalles_en).join(' ') : '';
      const itemSearchText = normalizarTextoBusqueda(
        `${item.titulo || ''} ${item.titulo_en || ''} ${item.tipo_inmueble || ''} ${item.tipo_inmueble_en || ''} ${item.ciudad || ''} ${item.ubicacion || ''} ${item.barrio || ''} ${item.precio || ''} ${item.precio_usd || ''} ${item.precio_m2 || ''} ${item.urgencia || ''} ${item.urgencia_en || ''} ${item.rebaja || ''} ${item.dato_1 || ''} ${item.dato_2 || ''} ${detallesValores} ${detallesEnValores} property real estate direct owner fsbo apartment house flat pool studio deal`
      );
      if (!coincideBusquedaInteligente(itemSearchText, textoBusquedaActivo)) return false;
    }

    // C. Filtro Rápido de Oportunidades del Día (Últimas 24 horas)
    if (filtroHoyActivo) {
      const ahora = Date.now();
      const UN_DIA_MS = 24 * 60 * 60 * 1000;
      const ts = Number(item.timestamp_ms || 0);
      const rel = String(item.fecha_relativa || '').toLowerCase();
      const esDeHoy = (ts > 0 && (ahora - ts) <= UN_DIA_MS) ||
        (Number(item.dias_en_mercado || 0) <= 1) ||
        rel.includes('ahora') ||
        rel.includes('min') ||
        rel.includes('hora');
      if (!esDeHoy) return false;
    }

    // D. Filtro por Tipo de Operación (Venta / Arriendo)
    if (filtroOperacionActivo) {
      const tit = normalizarTextoBusqueda(item.titulo || "");
      const op = normalizarTextoBusqueda(item.tipo_operacion || "");
      if (filtroOperacionActivo === "venta" && !tit.includes("venta") && !op.includes("venta")) return false;
      if (filtroOperacionActivo === "arriendo" && !tit.includes("arriendo") && !tit.includes("alquiler") && !op.includes("arriendo")) return false;
    }

    return true;
  });

  // E. Ordenamiento Dinámico
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
 * Cierra todos los dropdowns de la Barra de Comandos para evitar superposiciones.
 * @param {string} [exceptoId] - ID del dropdown que no debe cerrarse.
 */
function cerrarTodosLosDropdownsFiltro(exceptoId = null) {
  if (typeof cerrarMenuAutocomplete === 'function') {
    try { cerrarMenuAutocomplete(); } catch (_) {}
  }
  const configs = [
    { id: "cmdLocationDropdown", pillId: "cmdFilterLocation" },
    { id: "cmdSortDropdown", pillId: "cmdFilterSort" },
    { id: "cmdOperationDropdown", pillId: "cmdFilterOperation" }
  ];
  configs.forEach(({ id, pillId }) => {
    if (id !== exceptoId) {
      const drop = document.getElementById(id);
      const pill = document.getElementById(pillId);
      if (drop) drop.classList.remove("show");
      if (pill) {
        pill.classList.remove("open");
        pill.setAttribute("aria-expanded", "false");
        const w = pill.closest(".cmd-filter-pill-dropdown-wrapper");
        if (w) w.classList.remove("open");
      }
    }
  });
}

/**
 * Alterna el estado de un menú desplegable cerrando los demás.
 * @param {HTMLElement} pill
 * @param {HTMLElement} dropdown
 */
function alternarDropdownFiltro(pill, dropdown) {
  if (!pill || !dropdown) return;
  const yaAbierto = dropdown.classList.contains("show");
  cerrarTodosLosDropdownsFiltro(dropdown.id);
  const nuevoEstado = !yaAbierto;
  dropdown.classList.toggle("show", nuevoEstado);
  pill.classList.toggle("open", nuevoEstado);
  pill.setAttribute("aria-expanded", String(nuevoEstado));
  const wrapper = pill.closest(".cmd-filter-pill-dropdown-wrapper");
  if (wrapper) wrapper.classList.toggle("open", nuevoEstado);
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
    alternarDropdownFiltro(pillSort, dropdownSort);
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
    cerrarTodosLosDropdownsFiltro();
    aplicarFiltrosOmnibox();
  });

  inicializarBarraOperacion();
}

/**
 * Inicializa el selector de tipo de operación (Todas / Venta / Arriendo).
 */
function inicializarBarraOperacion() {
  const pillOp = document.getElementById("cmdFilterOperation");
  const dropOp = document.getElementById("cmdOperationDropdown");
  const lblOp = document.getElementById("cmdFilterOperationLabel");
  if (!pillOp || !dropOp) return;

  pillOp.addEventListener("click", (e) => {
    e.stopPropagation();
    alternarDropdownFiltro(pillOp, dropOp);
  });

  dropOp.addEventListener("click", (e) => {
    const it = e.target.closest(".cmd-dropdown-item");
    if (!it) return;
    e.stopPropagation();
    filtroOperacionActivo = it.getAttribute("data-operation") || "";
    dropOp.querySelectorAll(".cmd-dropdown-item").forEach(i => i.classList.remove("active"));
    it.classList.add("active");
    if (lblOp) lblOp.textContent = it.querySelector("span")?.textContent || "Todas las operaciones";
    pillOp.classList.toggle("active-filter", filtroOperacionActivo !== "");
    cerrarTodosLosDropdownsFiltro();
    aplicarFiltrosOmnibox();
  });
}

/**
 * Inicializa el botón de filtro rápido para oportunidades captadas en el día.
 */
function inicializarFiltroHoy() {
  const btnHoy = document.getElementById("cmdFilterToday");
  if (!btnHoy) return;

  btnHoy.addEventListener("click", () => {
    filtroHoyActivo = !filtroHoyActivo;
    btnHoy.classList.toggle("active-filter", filtroHoyActivo);
    btnHoy.setAttribute("aria-pressed", String(filtroHoyActivo));
    aplicarFiltrosOmnibox();
  });
}

// Cierre global seguro de dropdowns al hacer clic fuera
if (typeof window !== "undefined") {
  window.addEventListener("click", (e) => {
    if (!e.target.closest(".cmd-filter-pill-dropdown-wrapper")) {
      cerrarTodosLosDropdownsFiltro();
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DICCIONARIO_TERMINOS,
    normalizarTextoBusqueda,
    coincideBusquedaInteligente,
    deduplicarLeads,
    filtrarYOrdenarLeads,
    cerrarTodosLosDropdownsFiltro
  };
}
