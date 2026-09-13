/**
 * 🃏 MÓDULO DE RENDERIZADO BENTO GRID (modules/06-cards.js)
 * Renderizado de oportunidades, skeletons, badges ejecutivos, formateo de precios
 * y soporte bilingüe adaptativo (ES/EN) con sello verificado.
 * Estándar Ecosistema Desmulta UI/UX (< 500 líneas).
 */

/**
 * Data URI del SVG vectorial corporativo de fallback en caso de indisponibilidad de imagen externa.
 * Optimizado a nivel de bytes, no bloqueante y 100% resiliente sin dependencia de red.
 */
const FALLBACK_INMUEBLE_SVG = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">' +
  '<defs>' +
    '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#0b131e"/>' +
      '<stop offset="50%" stop-color="#111b2b"/>' +
      '<stop offset="100%" stop-color="#060a11"/>' +
    '</linearGradient>' +
    '<radialGradient id="glow" cx="50%" cy="45%" r="55%">' +
      '<stop offset="0%" stop-color="#10b981" stop-opacity="0.22"/>' +
      '<stop offset="100%" stop-color="#10b981" stop-opacity="0"/>' +
    '</radialGradient>' +
  '</defs>' +
  '<rect width="800" height="500" fill="url(#bg)"/>' +
  '<rect width="800" height="500" fill="url(#glow)"/>' +
  '<g transform="translate(400, 215)" text-anchor="middle">' +
    '<circle cx="0" cy="-10" r="50" fill="#10b981" fill-opacity="0.08" stroke="#10b981" stroke-width="2" stroke-dasharray="5 3"/>' +
    '<path d="M-26 10 L0 -16 L26 10 L17 10 L17 28 L-17 28 L-17 10 Z" fill="none" stroke="#10b981" stroke-width="3" stroke-linejoin="round"/>' +
    '<rect x="-6" y="14" width="12" height="14" fill="#10b981" fill-opacity="0.3" rx="1"/>' +
    '<text y="78" fill="#e2e8f0" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="2.5">ORIGGO DIRECT</text>' +
    '<text y="100" fill="#64748b" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="500" letter-spacing="1">VERIFIED PROPERTY</text>' +
  '</g>' +
  '</svg>'
);

/**
 * Manejador resiliente de fallo de carga de imagen de lead.
 * Sustituye de inmediato la imagen rota por un placeholder SVG esmeralda corporativo.
 * @param {HTMLImageElement} imgEl
 */
function manejarErrorImagenLead(imgEl) {
  if (!imgEl || imgEl._fallbackAplicado) return;
  imgEl._fallbackAplicado = true;
  imgEl.onerror = null;
  imgEl.src = FALLBACK_INMUEBLE_SVG;
  imgEl.classList.add('img-fallback-applied');
}
window.manejarErrorImagenLead = manejarErrorImagenLead;

/**
 * Formatea un precio con el símbolo $ separado sin mostrar jamás 'COP'.
 * @param {string} precioStr
 * @returns {string}
 */
function formatearPrecioDisplay(precioStr) {
  if (!precioStr) return '<span class="price-currency-sign">$</span> <span class="price-number">0</span>';
  let str = String(precioStr).replace(/COP|USD|pesos/gi, '').trim();
  if (str.startsWith('$')) str = str.substring(1).trim();
  return `<span class="price-currency-sign">$</span> <span class="price-number">${escaparHtml(str)}</span>`;
}

/**
 * Genera el marcado de tarjetas esqueleto con efecto Shimmer.
 * @returns {string}
 */
function generarHtmlSkeletons() {
  return Array(3).fill(0).map((_, i) => `
    <article class="bento-card skeleton-card skeleton-delay-${i}">
      <div class="skeleton-media skeleton-shimmer"></div>
      <div class="card-body skeleton-body">
        <div class="skeleton-line skeleton-shimmer skeleton-line-sm"></div>
        <div class="skeleton-line skeleton-shimmer skeleton-line-lg"></div>
        <div class="skeleton-box skeleton-shimmer skeleton-box-data"></div>
        <div class="skeleton-footer"><div class="skeleton-line skeleton-shimmer skeleton-line-price"></div><div class="skeleton-btn skeleton-shimmer skeleton-btn-ph"></div></div>
      </div>
    </article>`).join('');
}

/**
 * Formatea dinámicamente el tiempo relativo transcurrido (Bilingüe ES/EN).
 * @param {number|string} timestampMs
 * @param {string} [fallback]
 * @returns {string}
 */
function formatearTiempoRelativo(timestampMs, fallback) {
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  if (!timestampMs || isNaN(Number(timestampMs))) {
    if (fallback && isEn) {
      const f = String(fallback).toLowerCase();
      if (f.includes('justo')) return '⚡ Just now';
      const m = f.match(/hace\s+(\d+)\s*(h|m|d|hora|min)/);
      if (m) return `${m[1]}${m[2].charAt(0)} ago`;
      return f.includes('hoy') ? 'Today' : (f.includes('ayer') ? 'Yesterday' : 'Recent');
    }
    return fallback || (isEn ? 'Recent' : 'Reciente');
  }
  const diffMs = Date.now() - Number(timestampMs);
  if (diffMs < 0) return isEn ? '⚡ Just now' : '⚡ Justo ahora';
  const diffMin = Math.floor(diffMs / 60000), diffHoras = Math.floor(diffMin / 60), diffDias = Math.floor(diffHoras / 24);
  if (diffMin < 1) return isEn ? '⚡ Just now' : '⚡ Justo ahora';
  if (diffMin < 60) return isEn ? `${diffMin}m ago` : `Hace ${diffMin} min`;
  if (diffHoras < 24) return isEn ? `${diffHoras}h ago` : `Hace ${diffHoras} ${diffHoras === 1 ? 'hora' : 'horas'}`;
  if (diffDias < 30) return isEn ? `${diffDias}d ago` : `Hace ${diffDias} ${diffDias === 1 ? 'día' : 'días'}`;
  return isEn ? 'Recent' : (fallback || 'Reciente');
}

/**
 * Recalcula y actualiza contadores de tiempo en todas las tarjetas del DOM.
 */
function actualizarTiemposRelativosEnDOM() {
  document.querySelectorAll('.badge-time-pill[data-timestamp]').forEach((pill) => {
    const ts = pill.getAttribute('data-timestamp'), txtEl = pill.querySelector('.time-relative-text');
    if (ts && txtEl) txtEl.textContent = formatearTiempoRelativo(Number(ts), txtEl.textContent);
  });
}

/**
 * Traduce el badge de urgencia / estatus al idioma actual.
 */
function traducirBadgeUrgencia(urgencia, isEn) {
  if (!urgencia || !isEn) return urgencia || '';
  const u = String(urgencia).toLowerCase();
  if (u.includes('oportunidad') || u.includes('trato directo')) return '🔥 Direct Deal';
  if (u.includes('traslado')) return '🔥 Urgent Relocation';
  if (u.includes('ganga')) return '📉 Bargain Deal';
  if (u.includes('venta rápida')) return '💼 Quick Sale';
  if (u.includes('arbitraje')) return '⚡ High Arbitrage';
  if (u.includes('rebaja')) return '📉 Price Drop';
  return u.includes('cerrado') ? 'Closed' : (u.includes('urgente') ? 'Urgent' : urgencia);
}

/**
 * Traduce la distribución de ambientes (ej. "3 Hab • 2 Baños • 1 Garajes").
 */
function traducirDatoDistribucion(val, isEn) {
  if (!isEn || !val) return val || 'N/A';
  return String(val)
    .replace(/\b1\s*Hab\b/gi, '1 Bed').replace(/(\d+)\s*Hab\b/gi, '$1 Beds')
    .replace(/\b1\s*Baño\b/gi, '1 Bath').replace(/(\d+)\s*Baños?\b/gi, '$1 Baths')
    .replace(/\b1\s*Garajes?\b/gi, '1 Parking').replace(/(\d+)\s*Garajes?\b/gi, '$1 Parking');
}

/**
 * Traduce especificaciones del Slide-up Drawer con sello verificado.
 */
function traducirSlideupDetalles(detalles, isEn) {
  if (!detalles) return {};
  const salida = {};
  for (const [k, v] of Object.entries(detalles)) {
    const kLow = k.toLowerCase();
    let kTrad = k, vTrad = String(v || 'N/A');
    if (isEn) {
      if (kLow.includes('estrato')) kTrad = 'Stratum';
      else if (kLow.includes('área') || kLow.includes('superficie')) kTrad = 'Built Area';
      else if (kLow.includes('hab') || kLow.includes('alcoba')) kTrad = 'Bedrooms';
      else if (kLow.includes('baño')) kTrad = 'Bathrooms';
      else if (kLow.includes('parqueadero') || kLow.includes('garaje')) kTrad = 'Parking';
      else if (kLow.includes('contacto')) kTrad = 'Contact';
      else if (kLow.includes('ubicación')) kTrad = 'Location';
      else if (kLow.includes('tipo')) kTrad = 'Property Type';
      else if (kLow.includes('operación')) kTrad = 'Deal Type';

      vTrad = vTrad
        .replace(/(\d+)\s*Residencial/gi, '$1 Residential')
        .replace(/\b1\s*alcobas?\b/gi, '1 Bedroom').replace(/(\d+)\s*alcobas?\b/gi, '$1 Bedrooms')
        .replace(/\b1\s*completos?\b/gi, '1 Full Bath').replace(/(\d+)\s*completos?\b/gi, '$1 Full Baths')
        .replace(/\b1\s*espacios?\b/gi, '1 Space').replace(/(\d+)\s*espacios?\b/gi, '$1 Spaces')
        .replace(/Propietario Verificado/gi, 'Verified Owner')
        .replace(/Venta Directa con Propietario/gi, 'Direct Sale with Owner');
    } else {
      vTrad = vTrad.replace(/\b1 espacios\b/gi, '1 espacio').replace(/\b1 alcobas\b/gi, '1 alcoba').replace(/\b1 completos\b/gi, '1 completo');
    }

    if (kLow.includes('contacto') || vTrad.includes('Verificado') || vTrad.includes('Verified')) {
      vTrad = `<span class="verified-badge-wrap"><i class="fa-solid fa-circle-check verified-badge-icon"></i> ${isEn ? 'Verified Owner' : 'Propietario Verificado'}</span>`;
    }
    salida[kTrad] = vTrad;
  }
  return salida;
}

/**
 * Renderiza la interfaz utilizando Mapeo Dinámico de Llaves (Content-Agnostic) y Dark Luxury Cards.
 * @param {Object} dataset
 */
function renderizarInterfaz(dataset) {
  const config = dataset.config || {}, leads = dataset.leads || [];
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const dict = typeof DICCIONARIO_I18N !== 'undefined' ? (DICCIONARIO_I18N[isEn ? 'en' : 'es'] || {}) : {};

  if (typeof sincronizarDropdownCiudades === 'function') sincronizarDropdownCiudades(leads);

  const elTitle = document.getElementById("heroTitle"), elSubtitle = document.getElementById("heroSubtitle");
  const elBadgeSectores = document.getElementById("badgeSectores"), elBadgeSectoresHero = document.getElementById("badgeSectoresHero");

  if (elTitle) {
    elTitle.innerHTML = isEn ? (dict.hero_title || 'Properties for sale <span class="editorial-italic">directly</span> from owners') : 'Inmuebles en venta <span class="editorial-italic">directo</span> de sus dueños';
  }
  if (elSubtitle) {
    elSubtitle.textContent = isEn ? (dict.hero_subtitle || 'Zero middleman and zero agency commissions. Fresh off-market opportunities and urgent price drops detected today in Colombia.') : (config.subtitulo && !config.subtitulo.toLowerCase().includes('radar de captación') ? config.subtitulo : 'Sin intermediarios ni comisiones de inmobiliaria. Oportunidades y rebajas de urgencia detectadas hoy en Colombia antes de que lleguen a las agencias.');
  }
  if (config.total_sectores_monitoreados) {
    const txt = isEn ? `${config.total_sectores_monitoreados} ${dict.hero_badge_suffix || 'Districts Monitored in Real Time'}` : `${config.total_sectores_monitoreados} Sectores Monitoreados en Tiempo Real`;
    if (elBadgeSectores) elBadgeSectores.textContent = txt;
    if (elBadgeSectoresHero) elBadgeSectoresHero.textContent = txt;
  }
  const countEl = document.getElementById("catalogCountText");
  if (countEl) {
    countEl.textContent = isEn ? `${leads.length} ${leads.length === 1 ? (dict.catalog_count_single || 'direct opportunity') : (dict.catalog_count_suffix || 'direct opportunities')}` : `${leads.length} oportunidades directas`;
  }
  const headingEl = document.getElementById("catalogHeading");
  if (headingEl) headingEl.textContent = isEn ? (dict.catalog_heading || "Live Direct Listings") : "Inmuebles Directos en Vivo";

  const container = document.getElementById("bentoGridContainer");
  if (!container) return;
  if (leads.length === 0) {
    container.innerHTML = `<div class="empty-state-msg"><p>${isEn ? 'No active opportunities recorded at this time.' : 'No hay oportunidades activas registradas en este momento.'}</p></div>`;
    return;
  }

  const col1NombreRaw = config.columna_variable_1 || "Atributo 1", col2NombreRaw = config.columna_variable_2 || "Atributo 2";
  const col1Nombre = isEn ? (col1NombreRaw.toLowerCase().includes('superficie') ? 'Area' : col1NombreRaw) : col1NombreRaw;
  const col2Nombre = isEn ? (col2NombreRaw.toLowerCase().includes('distribución') ? 'Layout' : col2NombreRaw) : col2NombreRaw;

  const leadsFiltrados = typeof filtrarYOrdenarLeads === 'function' ? filtrarYOrdenarLeads(leads) : leads;

  if (countEl) {
    const sufijoCiudad = filtroCiudadActivo ? (isEn ? ` in ${filtroCiudadActivo}` : ` en ${filtroCiudadActivo}`) : '';
    countEl.textContent = isEn ? `${leadsFiltrados.length} ${leadsFiltrados.length === 1 ? (dict.catalog_count_single || 'direct opportunity') : (dict.catalog_count_suffix || 'direct opportunities')}${sufijoCiudad}` : `${leadsFiltrados.length} oportunidad${leadsFiltrados.length === 1 ? '' : 'es'} directa${leadsFiltrados.length === 1 ? '' : 's'}${sufijoCiudad}`;
  }

  if (leadsFiltrados.length === 0) {
    const ciudadTexto = filtroCiudadActivo ? (isEn ? ` in ${filtroCiudadActivo}` : ` en ${filtroCiudadActivo}`) : '';
    const querySegura = escaparHtml((textoBusquedaActivo || "").slice(0, 40).trim());
    const busquedaTexto = querySegura ? (isEn ? ` for "${querySegura}"` : ` para "${querySegura}"`) : '';
    container.innerHTML = `
      <div class="empty-catalog-state" id="emptyCatalogState">
        <div class="empty-state-icon-box"><i class="fa-solid fa-filter-circle-xmark"></i></div>
        <div class="empty-state-content">
          <h3 class="empty-state-title">${isEn ? 'No opportunities found in this area' : 'Sin oportunidades en esta zona'}</h3>
          <p class="empty-state-desc">${isEn ? `No direct owner listings found${busquedaTexto}${ciudadTexto}. You can explore other cities or reset filters.` : `No se encontraron avisos directos${busquedaTexto}${ciudadTexto}. Puedes explorar otras ciudades o restablecer los filtros.`}</p>
        </div>
        <button type="button" class="btn-empty-reset" id="btnResetFilters"><i class="fa-solid fa-rotate-left"></i> ${isEn ? 'Reset all filters' : 'Restablecer todos los filtros'}</button>
      </div>`;
    const btnReset = document.getElementById("btnResetFilters");
    if (btnReset) btnReset.addEventListener("click", restablecerTodosLosFiltros);
    return;
  }

  const totalPaginas = Math.ceil(leadsFiltrados.length / limiteVisible);
  if (paginaActual > totalPaginas && totalPaginas > 0) paginaActual = totalPaginas;
  const startIndex = (paginaActual - 1) * limiteVisible, endIndex = startIndex + limiteVisible;
  const leadsVisibles = leadsFiltrados.slice(startIndex, endIndex);

  let htmlContenido = leadsVisibles.map((item, visibleIdx) => {
    const index = dataset.leads.indexOf(item), claseUrgencia = item.urgencia_tipo || "urgente";
    const imgUrl = item.imagen || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80";
    const tieneMultiplesFotos = Array.isArray(item.imagenes) && item.imagenes.length > 1;
    const fotos = tieneMultiplesFotos ? item.imagenes : [imgUrl];

    let mediaHtml = '';
    if (tieneMultiplesFotos) {
      mediaHtml = `<div class="carousel-track" id="carousel-${index}">
        ${fotos.map((foto, fIdx) => `<div class="carousel-slide ${fIdx === 0 ? 'active' : ''}" data-slide="${fIdx}"><img ${fIdx === 0 ? `src="${escaparHtml(foto)}"` : `data-src="${escaparHtml(foto)}"`} alt="${escaparHtml(item.titulo)} - Foto ${fIdx + 1}" class="carousel-img" ${visibleIdx < 3 && fIdx === 0 ? 'fetchpriority="high" loading="eager"' : 'loading="lazy" fetchpriority="low"'} decoding="async" onerror="manejarErrorImagenLead(this)" /></div>`).join('')}
        <button class="carousel-nav-btn prev" data-action="carrusel-prev" data-index="${index}" data-total="${fotos.length}" title="${isEn ? 'Previous photo' : 'Foto Anterior'}"><i class="fa-solid fa-chevron-left"></i></button>
        <button class="carousel-nav-btn next" data-action="carrusel-next" data-index="${index}" data-total="${fotos.length}" title="${isEn ? 'Next photo' : 'Siguiente Foto'}"><i class="fa-solid fa-chevron-right"></i></button>
        <div class="carousel-dots" id="dots-${index}">${fotos.map((_, fIdx) => `<span class="carousel-dot ${fIdx === 0 ? 'active' : ''}" data-dot="${fIdx}"></span>`).join('')}</div>
      </div>`;
    } else {
      mediaHtml = `<img src="${escaparHtml(imgUrl)}" alt="${escaparHtml(item.titulo)}" class="card-static-img" ${visibleIdx < 3 ? 'fetchpriority="high" loading="eager"' : 'loading="lazy" fetchpriority="low"'} decoding="async" onerror="manejarErrorImagenLead(this)" />`;
    }

    const detalles = item.detalles || { [col1NombreRaw]: item.dato_1 || "No especificado", [col2NombreRaw]: item.dato_2 || "No especificado", "Ubicación": item.ubicacion || "Colombia", "Tipo": item.tipo_inmueble || "Propiedad Residencial", "Operación": "Venta Directa con Propietario" };
    const detallesTraducidos = traducirSlideupDetalles(detalles, isEn);

    const claseRetrasoEntrada = index === 1 ? 'enter-delay-soft' : '';
    const detallesStr = item.detalles ? Object.entries(item.detalles).map(([k, v]) => `${k} ${v}`).join(' ') : '';
    const corpusBruto = [item.titulo, item.ubicacion, item.barrio, item.ciudad, item.tipo_inmueble, item.urgencia, item.rebaja, item.dato_1, item.dato_2, item.precio, item.precio_m2, detallesStr, 'inmueble propiedad vivienda particular directo dueno'].filter(Boolean).join(' ');
    const searchDataCorpus = normalizarTextoBusqueda(corpusBruto), ciudadNorm = normalizarTextoBusqueda(item.ciudad || ''), barrioNorm = normalizarTextoBusqueda(item.barrio || '');

    const estaDesbloqueado = sesionUsuario && Array.isArray(sesionUsuario.unlockedLeads) && sesionUsuario.unlockedLeads.includes(item.id);
    const contacto = estaDesbloqueado ? (cacheContactosDesbloqueados[item.id] || null) : null;
    const contactoSeguro = sanitizarContactoCliente(contacto);
    const portalNombre = item.portal || ((item.enlace_bloqueado || item.enlace || '').toLowerCase().includes('metrocuadrado') ? 'Metrocuadrado' : 'Finca Raíz');

    const tiempoRelativoTexto = formatearTiempoRelativo(item.timestamp_ms, item.fecha_relativa);
    const statusBadgeTexto = traducirBadgeUrgencia(item.urgencia, isEn);
    const ubicacionTexto = isEn && item.ubicacion ? item.ubicacion.replace(/Estrato\s*(\d+)/gi, 'Stratum $1') : (item.ubicacion || '');
    const dato2Texto = traducirDatoDistribucion(item.dato_2, isEn);

    return `
      <article class="bento-card ${estaDesbloqueado ? 'card-unlocked' : ''} ${claseRetrasoEntrada}" data-index="${index}" data-lead-id="${escaparHtml(item.id || '')}" data-ciudad="${escaparHtml(item.ciudad || '')}" data-ciudad-norm="${escaparHtml(ciudadNorm)}" data-barrio-norm="${escaparHtml(barrioNorm)}" data-tipo="${escaparHtml(item.tipo_inmueble || '')}" data-search="${escaparHtml(searchDataCorpus)}">
        <div class="card-media-wrapper" data-action="abrir-ficha" data-index="${index}">
          ${mediaHtml}
          <div class="card-media-gradient"></div>
          <div class="card-floating-badges">
            <span class="badge-time-pill" data-timestamp="${item.timestamp_ms || ''}"><i class="fa-regular fa-clock"></i> <span class="time-relative-text">${escaparHtml(tiempoRelativoTexto)}</span></span>
            ${estaDesbloqueado ? `<span class="card-unlocked-badge"><i class="fa-solid fa-unlock"></i> ${isEn ? 'Unlocked' : 'Desbloqueado'}</span>` : (item.urgencia ? `<span class="badge-status-pill ${claseUrgencia}">${escaparHtml(statusBadgeTexto)}</span>` : '')}
          </div>
        </div>

        <div class="card-body">
          <div>
            <div class="card-meta-header">
              <span class="card-location"><i class="fa-solid fa-location-dot"></i> ${escaparHtml(ubicacionTexto)}</span>
              <button class="btn-specs-pill" data-action="abrir-ficha" data-index="${index}" title="${isEn ? 'View Full Details' : 'Ver Detalles Completos'}">${isEn ? 'View Details' : 'Ver Detalles'} <i class="fa-solid fa-chevron-up"></i></button>
            </div>
            <h3 class="card-title" data-action="abrir-ficha" data-index="${index}">${escaparHtml(item.titulo)}</h3>
            <div class="card-specs-panel" data-action="abrir-ficha" data-index="${index}" title="${isEn ? 'Click to open full overview' : 'Click para abrir especificaciones completas'}">
              <div class="specs-row">
                <div class="spec-item"><span class="spec-label">${escaparHtml(col1Nombre)}</span><span class="spec-value">${escaparHtml(item.dato_1 || 'N/A')}</span></div>
                <div class="spec-item"><span class="spec-label">${escaparHtml(col2Nombre)}</span><span class="spec-value">${escaparHtml(dato2Texto)}</span></div>
              </div>
            </div>
            ${(estaDesbloqueado && contacto) ? `<div class="card-contact-phone-bar"><span><i class="fa-solid fa-phone"></i> <strong class="contact-phone-number">${escaparHtml(contacto.telefono || (isEn ? 'View in Ad' : 'Ver en Anuncio'))}</strong></span><span class="unlocked-portal-pill"><i class="fa-solid fa-building-flag"></i> ${escaparHtml(portalNombre)}</span></div>` : ''}
          </div>

          <div class="card-bottom-row">
            <div class="pricing-column">
              <span class="pricing-label">${isEn ? 'Listed Price' : 'Precio Publicado'}</span>
              <div class="price-main">${formatearPrecioDisplay(item.precio)}</div>
              ${item.precio_m2 ? `<div class="pricing-sub-row">
                <span class="unit-rate-badge">${escaparHtml(item.precio_m2)}</span>
                ${item.descuento_arbitraje > 0 ? `<span class="unit-rate-badge badge-arbitraje" title="${isEn ? 'Quantitative Arbitrage Opportunity' : 'Oportunidad de Arbitraje Cuantitativo'}">-${item.descuento_arbitraje}% vs ${isEn ? 'Median' : 'Mediana'}</span>` : ''}
                ${item.rebaja ? `<span class="unit-rate-badge badge-rebaja" title="${isEn ? 'Confirmed price drop' : 'Rebaja de precio confirmada'}">${escaparHtml(isEn ? 'Price Drop' : item.rebaja)}</span>` : ''}
              </div>` : ''}
            </div>

            ${estaDesbloqueado ? `
              <div class="unlocked-action-cluster">
                ${contactoSeguro?.enlace ? `<a href="${contactoSeguro.enlace}" target="_blank" rel="noopener noreferrer" class="btn-view-ad-direct" title="${isEn ? 'View original owner listing' : 'Ver anuncio original del propietario directo'}"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${isEn ? 'View Listing' : 'Ver Anuncio'}</a>` : ''}
                ${contactoSeguro?.whatsappUrl ? `<a href="${contactoSeguro.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-direct btn-whatsapp-compact" title="WhatsApp" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}
                ${contactoSeguro?.telLlamar ? `<a href="tel:${contactoSeguro.telLlamar}" class="btn-call-direct" title="${isEn ? 'Call Owner' : 'Llamar al dueño'}" aria-label="Llamar"><i class="fa-solid fa-phone"></i> ${isEn ? 'Call' : 'Llamar'}</a>` : ''}
                ${(!contactoSeguro?.enlace && !contactoSeguro?.whatsappUrl && !contactoSeguro?.telLlamar) ? `<button class="btn-whatsapp-direct" data-action="contactar-whatsapp" data-index="${index}" title="${isEn ? 'Reveal owner contact and link' : 'Revelar contacto y enlace del propietario'}"><i class="fa-solid fa-unlock"></i> ${isEn ? 'Reveal Contact' : 'Revelar Contacto'}</button>` : ''}
              </div>
            ` : `
              <button class="btn-unlock-lead ${item.urgencia_tipo === 'cerrado' ? 'closed' : ''}" data-action="abrir-checkout" data-index="${index}">
                <i class="fa-solid fa-lock"></i> ${item.urgencia_tipo === 'cerrado' ? (isEn ? 'View Closed' : 'Ver Cierre') : (isEn ? 'Unlock' : 'Desbloquear')}
              </button>
            `}
          </div>
        </div>

        <div class="card-slideup-overlay" id="slideup-${index}">
          <div class="slideup-header">
            <div class="slideup-title"><i class="fa-solid fa-circle-info"></i> ${isEn ? 'Property Overview' : 'Detalles de la Propiedad'}</div>
            <button class="btn-slideup-close" data-action="cerrar-ficha" data-index="${index}" title="${isEn ? 'Close Details' : 'Cerrar Detalles'}"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="slideup-body">
            <div class="slideup-specs-grid">
              ${Object.entries(detallesTraducidos).map(([k, v]) => {
                const kLow = k.toLowerCase();
                const iconClass = (kLow.includes('estrato') || kLow.includes('stratum')) ? 'fa-layer-group' : (kLow.includes('área') || kLow.includes('built area') || kLow.includes('superficie')) ? 'fa-ruler-combined' : (kLow.includes('hab') || kLow.includes('bedroom')) ? 'fa-bed' : (kLow.includes('baño') || kLow.includes('bath')) ? 'fa-bath' : (kLow.includes('garaje') || kLow.includes('parqueadero') || kLow.includes('parking')) ? 'fa-square-parking' : (kLow.includes('contacto') || kLow.includes('contact')) ? 'fa-user-shield' : 'fa-circle-info';
                const tieneHtml = String(v).includes('<span class="verified-badge-wrap">');
                return `<div class="slideup-spec-card"><span class="slideup-spec-key"><i class="fa-solid ${iconClass}"></i> ${escaparHtml(k)}</span><span class="slideup-spec-val">${tieneHtml ? v : escaparHtml(v)}</span></div>`;
              }).join('')}
            </div>

            <div class="slideup-trust-card">
              <div class="trust-badge"><i class="fa-solid fa-shield-halved"></i> ${isEn ? 'Direct Deal with Owner' : 'Trato Directo con el Propietario'}</div>
              <p class="trust-desc">${isEn ? 'Property marketed directly by its legitimate owner. Zero brokerage markups and zero intermediate agents, ready for direct call or WhatsApp.' : 'Propiedad comercializada directamente por su dueño. Sin inmobiliarias ni comisiones intermedias, lista para negociar por llamada o WhatsApp.'}</p>
            </div>

            <div class="slideup-action-group">
              ${estaDesbloqueado ? `
                <div class="slideup-unlocked-layout">
                  <div class="unlocked-phone-box">
                    <div class="unlocked-phone-label"><i class="fa-solid fa-unlock"></i> ${isEn ? 'Unlocked Contact Details' : 'Datos de Contacto Desbloqueados'}</div>
                    <div class="unlocked-phone-number">${contacto?.telefono ? escaparHtml(contacto.telefono) : (isEn ? 'Fetching contact...' : 'Consultando contacto...')}</div>
                  </div>
                  <div class="slideup-unlocked-row">
                    ${contactoSeguro?.whatsappUrl ? `<a href="${contactoSeguro.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn btn-whatsapp-direct cta-flex" title="WhatsApp" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}
                    ${contactoSeguro?.telLlamar ? `<a href="tel:${contactoSeguro.telLlamar}" class="slideup-cta-btn cta-flex-sm cta-call" title="${isEn ? 'Call Owner' : 'Llamar al dueño'}" aria-label="Llamar"><i class="fa-solid fa-phone"></i> ${isEn ? 'Call' : 'Llamar'}</a>` : ''}
                    ${contactoSeguro?.enlace ? `<a href="${contactoSeguro.enlace}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn cta-flex cta-neutral" title="${isEn ? 'View Original Listing' : 'Ver Anuncio Original'}" aria-label="Anuncio"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${isEn ? 'View Listing' : 'Ver Anuncio'}</a>` : `<button class="slideup-cta-btn btn-whatsapp-direct" data-action="contactar-whatsapp" data-index="${index}" title="${isEn ? 'Reveal Direct Contact' : 'Revelar contacto directo'}"><i class="fa-solid fa-unlock"></i> ${isEn ? 'Reveal Direct Contact' : 'Revelar Contacto Directo'}</button>`}
                  </div>
                  <span class="slideup-cta-note slideup-cta-note-ok"><i class="fa-solid fa-check-double"></i> ${isEn ? 'Contact and direct link unlocked for your account' : 'Contacto y enlace directo desbloqueados para tu cuenta'}</span>
                </div>
              ` : `
                <button class="slideup-cta-btn" data-action="slideup-cta" data-index="${index}"><i class="fa-solid fa-unlock-keyhole"></i> ${isEn ? 'Unlock Owner Contact' : 'Desbloquear Contacto del Dueño'}</button>
                <span class="slideup-cta-note"><i class="fa-solid fa-bolt"></i> ${isEn ? 'Instant access • Zero broker commissions' : 'Acceso al instante • Sin pagar comisiones'}</span>
              `}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  if (totalPaginas > 1) {
    const btnPrevHtml = paginaActual > 1 ? `<button type="button" class="btn-pagination" id="btnPrevPage" aria-label="${isEn ? 'Go to previous page' : 'Ir a la página anterior'}"><i class="fa-solid fa-chevron-left"></i> ${isEn ? 'Previous' : 'Anterior'}</button>` : '';
    const btnNextHtml = paginaActual < totalPaginas ? `<button type="button" class="btn-pagination" id="btnNextPage" aria-label="${isEn ? 'Go to next page' : 'Ir a la página siguiente'}">${isEn ? 'Next' : 'Siguiente'} <i class="fa-solid fa-chevron-right"></i></button>` : '';
    htmlContenido += `<div class="pagination-controls">${btnPrevHtml}<span class="pagination-info">${isEn ? `Page ${paginaActual} of ${totalPaginas}` : `Página ${paginaActual} de ${totalPaginas}`}</span>${btnNextHtml}</div>`;
  }

  container.innerHTML = htmlContenido;

  if (totalPaginas > 1) {
    const btnPrev = document.getElementById("btnPrevPage"), btnNext = document.getElementById("btnNextPage");
    if (btnPrev && paginaActual > 1) {
      btnPrev.addEventListener("click", () => {
        paginaActual--;
        renderizarInterfaz(dataset);
        document.getElementById("catalogHeaderRow")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    if (btnNext && paginaActual < totalPaginas) {
      btnNext.addEventListener("click", () => {
        paginaActual++;
        renderizarInterfaz(dataset);
        document.getElementById("catalogHeaderRow")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  iniciarScrollReveal();

  if (!window._timerRelativoCards) {
    window._timerRelativoCards = setInterval(actualizarTiemposRelativosEnDOM, 60000);
  }

  container.querySelectorAll('.carousel-track').forEach((track) => {
    const card = track.closest('.bento-card');
    const cardIndex = Number.parseInt(card?.getAttribute('data-index') || '', 10);
    const totalFotos = track.querySelectorAll('.carousel-slide').length;
    if (typeof habilitarSwipeTactilCarrusel === 'function' && Number.isFinite(cardIndex) && totalFotos > 1) {
      habilitarSwipeTactilCarrusel(track, cardIndex, totalFotos);
    }
  });
}
