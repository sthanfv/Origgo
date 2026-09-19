/**
 * 💡 MÓDULO DE BÚSQUEDA INTELIGENTE Y AUTOCOMPLETADO (modules/15-autocomplete.js)
 * Sugerencias contextuales en tiempo real, navegación táctil y por teclado,
 * accesibilidad ARIA completa y sanitización OWASP contra inyecciones XSS.
 * Estándar Ecosistema Desmulta DevSecOps (< 500 líneas).
 */

const SUGERENCIAS_TACTICAS_BASE = [
  // Ciudades y Sectores Estratégicos
  { texto: 'El Chicó, Bogotá', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Chico' },
  { texto: 'Rosales, Bogotá', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Rosales' },
  { texto: 'El Virrey, Bogotá', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Virrey' },
  { texto: 'El Poblado, Medellín', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Poblado' },
  { texto: 'Laureles, Medellín', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Laureles' },
  { texto: 'Pance, Cali', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Pance' },
  { texto: 'Ciudad Jardín, Cali', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Ciudad Jardin' },
  { texto: 'Bocagrande, Cartagena', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Bocagrande' },
  { texto: 'Ruitoque Condominio, Bucaramanga', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Ruitoque' },
  { texto: 'Cerritos, Pereira', categoria: 'barrio', icono: 'fa-location-dot', filtro: 'Cerritos' },

  // Tipologías Arquitectónicas
  { texto: 'Penthouse con terraza', categoria: 'tipologia', icono: 'fa-building', filtro: 'Penthouse' },
  { texto: 'Apartamento amoblado', categoria: 'tipologia', icono: 'fa-couch', filtro: 'Amoblado' },
  { texto: 'Casa campestre en condominio', categoria: 'tipologia', icono: 'fa-tree', filtro: 'Campestre' },
  { texto: 'Apartaestudio con balcón', categoria: 'tipologia', icono: 'fa-door-open', filtro: 'Apartaestudio' },
  { texto: 'Oficina ejecutiva', categoria: 'tipologia', icono: 'fa-briefcase', filtro: 'Oficina' },

  // Oportunidades y Operación
  { texto: 'Propiedades con rebaja reciente', categoria: 'oportunidad', icono: 'fa-tag', filtro: 'rebaja' },
  { texto: 'Trato directo con propietario', categoria: 'oportunidad', icono: 'fa-handshake', filtro: 'propietario' },
  { texto: 'Apartamentos en venta directa', categoria: 'operacion', icono: 'fa-house-chimney', filtro: 'venta' },
  { texto: 'Apartamentos en arriendo', categoria: 'operacion', icono: 'fa-key', filtro: 'arriendo' }
];

let indiceSeleccionadoAutocomplete = -1;
let sugerenciasActivas = [];
let temporizadorDebounce = null;

/**
 * Escapa caracteres HTML peligrosos protegiendo de forma determinista contra XSS (OWASP A03).
 * @param {string} str
 * @returns {string}
 */
function escaparHtmlSeguro(str) {
  if (typeof escaparHtml === 'function') return escaparHtml(str);
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Resalta de forma segura la coincidencia de texto protegiendo contra XSS (OWASP A03).
 * @param {string} texto
 * @param {string} consulta
 * @returns {string} HTML seguro con etiqueta <mark>
 */
function resaltarCoincidenciaSegura(texto, consulta) {
  if (!texto) return '';
  const textoEscapado = escaparHtmlSeguro(texto);
  if (!consulta || consulta.trim().length === 0) return textoEscapado;

  const normaConsulta = typeof normalizarTextoBusqueda === 'function'
    ? normalizarTextoBusqueda(consulta)
    : consulta.toLowerCase().trim();

  const normaTexto = typeof normalizarTextoBusqueda === 'function'
    ? normalizarTextoBusqueda(texto)
    : texto.toLowerCase().trim();

  const indice = normaTexto.indexOf(normaConsulta);
  if (indice === -1) return textoEscapado;

  const fin = indice + consulta.trim().length;
  const antes = escaparHtmlSeguro(texto.slice(0, indice));
  const coincidencia = escaparHtmlSeguro(texto.slice(indice, fin));
  const despues = escaparHtmlSeguro(texto.slice(fin));

  return `${antes}<strong class="autocomplete-highlight">${coincidencia}</strong>${despues}`;
}

/**
 * Obtiene o crea el contenedor de sugerencias en el DOM.
 * @returns {HTMLElement|null}
 */
function obtenerOCrearDropdownAutocomplete() {
  if (typeof document === 'undefined') return null;
  let dropdown = document.getElementById('omniboxAutocomplete');
  if (!dropdown) {
    const searchBox = document.querySelector('.cmd-search-box');
    if (!searchBox) return null;

    dropdown = document.createElement('div');
    dropdown.id = 'omniboxAutocomplete';
    dropdown.className = 'cmd-autocomplete-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Sugerencias de búsqueda inteligente');
    dropdown.hidden = true;
    searchBox.appendChild(dropdown);
  }
  return dropdown;
}

/**
 * Genera sugerencias relevantes combinando la base táctica con las oportunidades del catálogo activo.
 * @param {string} textoUsuario
 * @returns {Array<Object>}
 */
function calcularSugerencias(textoUsuario) {
  if (!textoUsuario || textoUsuario.trim().length < 1) return [];

  const consultaNorm = typeof normalizarTextoBusqueda === 'function'
    ? normalizarTextoBusqueda(textoUsuario)
    : textoUsuario.toLowerCase().trim();

  const resultados = [];
  const vistos = new Set();

  // 1. Coincidencias con sugerencias tácticas predefinidas
  for (const item of SUGERENCIAS_TACTICAS_BASE) {
    const textoNorm = typeof normalizarTextoBusqueda === 'function'
      ? normalizarTextoBusqueda(item.texto)
      : item.texto.toLowerCase();

    if (textoNorm.includes(consultaNorm)) {
      resultados.push(item);
      vistos.add(item.texto.toLowerCase());
    }
  }

  // 2. Coincidencias dinámicas con títulos y ubicaciones del catálogo activo
  if (typeof datosActuales !== 'undefined' && datosActuales && Array.isArray(datosActuales.leads)) {
    for (const lead of datosActuales.leads) {
      if (resultados.length >= 6) break;

      const titulo = lead.titulo || '';
      const ubicacion = lead.barrio || lead.ciudad || lead.ubicacion || '';
      const candTitulo = `${titulo} (${ubicacion})`.trim();

      const tituloNorm = typeof normalizarTextoBusqueda === 'function'
        ? normalizarTextoBusqueda(candTitulo)
        : candTitulo.toLowerCase();

      if (tituloNorm.includes(consultaNorm) && !vistos.has(candTitulo.toLowerCase())) {
        resultados.push({
          texto: candTitulo,
          categoria: 'inmueble',
          icono: 'fa-house',
          filtro: lead.titulo || ubicacion
        });
        vistos.add(candTitulo.toLowerCase());
      }
    }
  }

  return resultados.slice(0, 6);
}

/**
 * Renderiza las sugerencias calculadas en el menú desplegable accesible.
 * @param {Array<Object>} lista
 * @param {string} consultaOriginal
 */
function renderizarMenuAutocomplete(lista, consultaOriginal) {
  const dropdown = obtenerOCrearDropdownAutocomplete();
  const input = document.getElementById('omniboxSearch');
  if (!dropdown || !input) return;

  sugerenciasActivas = lista;
  indiceSeleccionadoAutocomplete = -1;

  if (lista.length === 0) {
    dropdown.hidden = true;
    dropdown.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    return;
  }

  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  let html = `<div class="cmd-autocomplete-header"><span><i class="fa-solid fa-wand-magic-sparkles"></i> ${isEn ? 'Smart Suggestions' : 'Sugerencias Inteligentes'}</span></div>`;

  html += lista.map((sug, idx) => {
    const textoResaltado = resaltarCoincidenciaSegura(sug.texto, consultaOriginal);
    return `
      <div
        class="cmd-autocomplete-item"
        id="autocomplete-opt-${idx}"
        role="option"
        aria-selected="false"
        data-index="${idx}"
        data-filtro="${typeof escaparHtml === 'function' ? escaparHtml(sug.filtro) : sug.filtro}"
      >
        <span class="cmd-autocomplete-item-icon"><i class="fa-solid ${sug.icono || 'fa-magnifying-glass'}"></i></span>
        <span class="cmd-autocomplete-item-text">${textoResaltado}</span>
        <span class="cmd-autocomplete-item-badge">${escaparHtml(sug.categoria)}</span>
      </div>
    `;
  }).join('');

  dropdown.innerHTML = html;
  dropdown.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

/**
 * Cierra y limpia el menú de autocompletado.
 */
function cerrarMenuAutocomplete() {
  const dropdown = document.getElementById('omniboxAutocomplete');
  const input = document.getElementById('omniboxSearch');
  if (dropdown) {
    dropdown.hidden = true;
    dropdown.innerHTML = '';
  }
  if (input) {
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  indiceSeleccionadoAutocomplete = -1;
  sugerenciasActivas = [];
}

/**
 * Aplica la sugerencia seleccionada al campo de búsqueda e interactúa con el filtro.
 * @param {Object} sugerencia
 */
function seleccionarSugerencia(sugerencia) {
  if (!sugerencia) return;
  const input = document.getElementById('omniboxSearch');
  const btnClear = document.getElementById('cmdSearchClear');

  if (input) {
    input.value = sugerencia.filtro || sugerencia.texto;
    if (btnClear) btnClear.classList.add('visible');
    textoBusquedaActivo = input.value;
    input.blur();
  }

  cerrarMenuAutocomplete();

  if (typeof aplicarFiltrosOmnibox === 'function') {
    aplicarFiltrosOmnibox();
  }
}

/**
 * Actualiza la selección activa por teclado (W3C ARIA Combobox pattern).
 * @param {number} nuevoIndice
 */
function actualizarSeleccionTeclado(nuevoIndice) {
  const dropdown = document.getElementById('omniboxAutocomplete');
  const input = document.getElementById('omniboxSearch');
  if (!dropdown || sugerenciasActivas.length === 0) return;

  const items = dropdown.querySelectorAll('.cmd-autocomplete-item');
  items.forEach(it => {
    it.classList.remove('active');
    it.setAttribute('aria-selected', 'false');
  });

  if (nuevoIndice >= 0 && nuevoIndice < items.length) {
    indiceSeleccionadoAutocomplete = nuevoIndice;
    const itemActivo = items[nuevoIndice];
    itemActivo.classList.add('active');
    itemActivo.setAttribute('aria-selected', 'true');
    itemActivo.scrollIntoView({ block: 'nearest' });

    if (input) {
      input.setAttribute('aria-activedescendant', itemActivo.id);
    }
  } else {
    indiceSeleccionadoAutocomplete = -1;
    if (input) input.removeAttribute('aria-activedescendant');
  }
}

/**
 * Vincula los eventos del Omnibox para autocompletado inteligente.
 */
function inicializarBúsquedaInteligente() {
  if (typeof document === 'undefined') return;

  const input = document.getElementById('omniboxSearch');
  if (!input) return;

  // Atributos W3C ARIA en el input
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'omniboxAutocomplete');

  // 1. Entrada de texto con debounce optimizado (160ms)
  input.addEventListener('input', (e) => {
    const val = e.target.value;
    if (temporizadorDebounce) clearTimeout(temporizadorDebounce);

    if (!val || val.trim().length === 0) {
      cerrarMenuAutocomplete();
      return;
    }

    temporizadorDebounce = setTimeout(() => {
      try {
        const sugerencias = calcularSugerencias(val);
        renderizarMenuAutocomplete(sugerencias, val);
      } catch (err) {
        if (typeof reportarFalloCliente === 'function') {
          reportarFalloCliente({
            tipo: 'AUTOCOMPLETE_SEARCH_ERROR',
            mensaje: err.message,
            origen: 'modules/15-autocomplete.js'
          });
        }
      }
    }, 160);
  });

  // 2. Navegación por teclado (ArrowDown, ArrowUp, Enter, Escape)
  input.addEventListener('keydown', (e) => {
    if (sugerenciasActivas.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const prox = (indiceSeleccionadoAutocomplete + 1) % sugerenciasActivas.length;
      actualizarSeleccionTeclado(prox);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = indiceSeleccionadoAutocomplete <= 0
        ? sugerenciasActivas.length - 1
        : indiceSeleccionadoAutocomplete - 1;
      actualizarSeleccionTeclado(prev);
    } else if (e.key === 'Enter') {
      if (indiceSeleccionadoAutocomplete >= 0 && sugerenciasActivas[indiceSeleccionadoAutocomplete]) {
        e.preventDefault();
        seleccionarSugerencia(sugerenciasActivas[indiceSeleccionadoAutocomplete]);
      } else {
        cerrarMenuAutocomplete();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cerrarMenuAutocomplete();
    }
  });

  // 3. Selección táctil o por clic del ratón
  const dropdown = obtenerOCrearDropdownAutocomplete();
  if (dropdown) {
    dropdown.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.cmd-autocomplete-item');
      if (!itemEl) return;
      const idx = Number.parseInt(itemEl.getAttribute('data-index') || '-1', 10);
      if (idx >= 0 && sugerenciasActivas[idx]) {
        seleccionarSugerencia(sugerenciasActivas[idx]);
      }
    });
  }

  // 4. Cierre al hacer clic fuera del Omnibox
  window.addEventListener('click', (e) => {
    if (!e.target.closest('.cmd-search-box')) {
      cerrarMenuAutocomplete();
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarBúsquedaInteligente);
  } else {
    inicializarBúsquedaInteligente();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUGERENCIAS_TACTICAS_BASE,
    resaltarCoincidenciaSegura,
    calcularSugerencias,
    cerrarMenuAutocomplete,
    seleccionarSugerencia
  };
}
