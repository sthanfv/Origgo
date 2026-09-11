/**
 * 🃏 MÓDULO DE RENDERIZADO BENTO GRID (modules/06-cards.js)
 * Renderizado de oportunidades, skeletons, badges ejecutivos y formateo de precios.
 * Estándar Ecosistema Desmulta UI/UX.
 */

/**
 * Formatea visualmente un precio con el símbolo $ separado sutilmente
 * de la cifra numérica, sin mostrar jamás la palabra 'COP'.
 * @param {string} precioStr - Cadena de precio (ej. "$ 1.250.000.000")
 * @returns {string} HTML estilizado con separación visual limpia
 */
function formatearPrecioDisplay(precioStr) {
  if (!precioStr) return '<span class="price-currency-sign">$</span> <span class="price-number">0</span>';
  let str = String(precioStr).replace(/COP|USD|pesos/gi, '').trim();
  if (str.startsWith('$')) {
    str = str.substring(1).trim();
  }
  return `<span class="price-currency-sign">$</span> <span class="price-number">${escaparHtml(str)}</span>`;
}

/**
 * Genera el marcado de tarjetas esqueleto (Skeleton Loading) con efecto Shimmer.
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
        <div class="skeleton-footer">
          <div class="skeleton-line skeleton-shimmer skeleton-line-price"></div>
          <div class="skeleton-btn skeleton-shimmer skeleton-btn-ph"></div>
        </div>
      </div>
    </article>
  `).join('');
}


/**
 * Renderiza la interfaz utilizando Mapeo Dinámico de Llaves (Content-Agnostic) y Dark Luxury Cards.
 * Estructura de Curvatura 2.5rem y Fusión de Imagen Impecable (h-32 y -mt-4).
 * @param {Object} dataset
 */
function renderizarInterfaz(dataset) {
  const config = dataset.config || {};
  const leads = dataset.leads || [];

  // Sincronizar dinámicamente las ciudades con el dataset activo
  if (typeof sincronizarDropdownCiudades === 'function') {
    sincronizarDropdownCiudades(leads);
  }

  // Actualizar textos de cabecera dinámicos
  const elTitle = document.getElementById("heroTitle");
  const elSubtitle = document.getElementById("heroSubtitle");
  const elBadgeSectores = document.getElementById("badgeSectores");
  const elBadgeSectoresHero = document.getElementById("badgeSectoresHero");

  if (elTitle && config.titulo_modulo) {
    // [SEGURIDAD] Mitigación XSS (Cross-Site Scripting)
    // Se sanitizan todos los tags HTML excepto la etiqueta <span> autorizada para cursivas
    const sanitizedTitle = config.titulo_modulo
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/&lt;span class="editorial-italic"&gt;/gi, '<span class="editorial-italic">')
      .replace(/&lt;\/span&gt;/gi, '</span>');
    elTitle.innerHTML = sanitizedTitle;
  }
  if (elSubtitle && config.subtitulo) elSubtitle.textContent = config.subtitulo;
  if (config.total_sectores_monitoreados) {
    const txtSectores = `${config.total_sectores_monitoreados} Sectores Monitoreados en Tiempo Real`;
    if (elBadgeSectores) elBadgeSectores.textContent = txtSectores;
    if (elBadgeSectoresHero) elBadgeSectoresHero.textContent = txtSectores;
  }

  // Actualizar metadatos de la cabecera de catálogo
  const countEl = document.getElementById("catalogCountText");
  if (countEl) {
    countEl.textContent = `${leads.length} oportunidades directas`;
  }
  const headingEl = document.getElementById("catalogHeading");
  if (headingEl) {
    const esVehiculoModulo = (config.titulo_modulo && config.titulo_modulo.toLowerCase().includes('vehículo'));
    headingEl.textContent = esVehiculoModulo ? "Vehículos con Margen en Vivo" : "Inmuebles Directos en Vivo";
  }

  // Renderizar la grilla Bento
  const container = document.getElementById("bentoGridContainer");
  if (!container) return;

  if (leads.length === 0) {
    container.innerHTML = `
      <div class="empty-state-msg">
        <p>No hay oportunidades activas registradas en este momento.</p>
      </div>
    `;
    return;
  }

  const col1Nombre = config.columna_variable_1 || "Atributo 1";
  const col2Nombre = config.columna_variable_2 || "Atributo 2";

  // 1. Filtrar y ordenar leads según ciudad, búsqueda y criterio de orden activo
  const leadsFiltrados = typeof filtrarYOrdenarLeads === 'function'
    ? filtrarYOrdenarLeads(leads)
    : leads;

  // Actualizar metadatos de la cabecera de catálogo con el conteo real filtrado
  if (countEl) {
    const sufijoCiudad = filtroCiudadActivo ? ` en ${filtroCiudadActivo}` : '';
    countEl.textContent = `${leadsFiltrados.length} oportunidad${leadsFiltrados.length === 1 ? '' : 'es'} directa${leadsFiltrados.length === 1 ? '' : 's'}${sufijoCiudad}`;
  }

  // Estado vacío si no hay coincidencias
  if (leadsFiltrados.length === 0) {
    const ciudadTexto = filtroCiudadActivo ? ` en ${filtroCiudadActivo}` : '';
    const querySegura = escaparHtml((textoBusquedaActivo || "").slice(0, 40).trim());
    const busquedaTexto = querySegura ? ` para "${querySegura}"` : '';
    container.innerHTML = `
      <div class="empty-catalog-state" id="emptyCatalogState">
        <div class="empty-state-icon-box">
          <i class="fa-solid fa-filter-circle-xmark"></i>
        </div>
        <div class="empty-state-content">
          <h3 class="empty-state-title">Sin oportunidades en esta zona</h3>
          <p class="empty-state-desc">No se encontraron avisos directos${busquedaTexto}${ciudadTexto}. Puedes explorar otras ciudades o restablecer los filtros.</p>
        </div>
        <button type="button" class="btn-empty-reset" id="btnResetFilters">
          <i class="fa-solid fa-rotate-left"></i> Restablecer todos los filtros
        </button>
      </div>
    `;
    const btnReset = document.getElementById("btnResetFilters");
    if (btnReset) {
      btnReset.addEventListener("click", restablecerTodosLosFiltros);
    }
    return;
  }

  const totalPaginas = Math.ceil(leadsFiltrados.length / limiteVisible);
  if (paginaActual > totalPaginas && totalPaginas > 0) paginaActual = totalPaginas;
  const startIndex = (paginaActual - 1) * limiteVisible;
  const endIndex = startIndex + limiteVisible;
  const leadsVisibles = leadsFiltrados.slice(startIndex, endIndex);

  let htmlContenido = leadsVisibles.map((item) => {
    const index = dataset.leads.indexOf(item);
    const claseUrgencia = item.urgencia_tipo || "urgente";
    const imgUrl = item.imagen || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80";
    const tieneMultiplesFotos = Array.isArray(item.imagenes) && item.imagenes.length > 1;
    const fotos = tieneMultiplesFotos ? item.imagenes : [imgUrl];

    // Renderizado condicional del carrusel vs imagen estática limpia (Mandato del usuario)
    let mediaHtml = '<div class="card-media-wrapper">';
    if (tieneMultiplesFotos) {
      mediaHtml += `
        <div class="carousel-track" id="carousel-${index}">
          ${fotos.map((foto, fIdx) => `
            <div class="carousel-slide ${fIdx === 0 ? 'active' : ''}" data-slide="${fIdx}">
              ${fIdx === 0 ? `
                <img src="${escaparHtml(foto)}" alt="${escaparHtml(item.titulo)} - Foto 1" class="carousel-img" ${index < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />
              ` : `
                <img data-src="${escaparHtml(foto)}" alt="${escaparHtml(item.titulo)} - Foto ${fIdx + 1}" class="carousel-img" loading="lazy" decoding="async" />
              `}
            </div>
          `).join('')}

          <!-- Flechas de navegación (Aparecen en Hover) -->
          <button class="carousel-nav-btn prev" data-action="carrusel-prev" data-index="${index}" data-total="${fotos.length}" title="Foto Anterior">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <button class="carousel-nav-btn next" data-action="carrusel-next" data-index="${index}" data-total="${fotos.length}" title="Siguiente Foto">
            <i class="fa-solid fa-chevron-right"></i>
          </button>

          <!-- Puntos indicadores de foto -->
          <div class="carousel-dots" id="dots-${index}">
            ${fotos.map((_, fIdx) => `
              <span class="carousel-dot ${fIdx === 0 ? 'active' : ''}" data-dot="${fIdx}"></span>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      mediaHtml += `
        <img src="${escaparHtml(imgUrl)}" alt="${escaparHtml(item.titulo)}" class="card-static-img" ${index < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />
      `;
    }
    mediaHtml += '</div>';

    const esVehiculo = (config.titulo_modulo && config.titulo_modulo.toLowerCase().includes('vehículo')) || (item.tipo_inmueble && (item.tipo_inmueble.toLowerCase().includes('sedán') || item.tipo_inmueble.toLowerCase().includes('pick-up') || item.tipo_inmueble.toLowerCase().includes('suv')));

    // Preparar especificaciones para la Ficha de Detalles
    const detalles = item.detalles || {
      [col1Nombre]: item.dato_1 || "No especificado",
      [col2Nombre]: item.dato_2 || "No especificado",
      "Ubicación": item.ubicacion || "Colombia",
      "Tipo": item.tipo_inmueble || (esVehiculo ? "Vehículo" : "Propiedad"),
      "Operación": esVehiculo ? "Venta Directa Particular" : "Venta Directa con Propietario"
    };

    const claseRetrasoEntrada = index === 1 ? 'enter-delay-soft' : '';

    const detallesStr = item.detalles ? Object.entries(item.detalles).map(([k, v]) => `${k} ${v}`).join(' ') : '';
    const corpusBruto = [
      item.titulo,
      item.ubicacion,
      item.barrio,
      item.ciudad,
      item.tipo_inmueble,
      item.urgencia,
      item.rebaja,
      item.dato_1,
      item.dato_2,
      item.precio,
      item.precio_m2,
      detallesStr,
      esVehiculo ? 'vehiculo carro auto particular' : 'inmueble propiedad vivienda particular directo dueno'
    ].filter(Boolean).join(' ');

    const searchDataCorpus = normalizarTextoBusqueda(corpusBruto);
    const ciudadNorm = normalizarTextoBusqueda(item.ciudad || '');
    const barrioNorm = normalizarTextoBusqueda(item.barrio || '');

    const estaDesbloqueado = sesionUsuario && Array.isArray(sesionUsuario.unlockedLeads) && sesionUsuario.unlockedLeads.includes(item.id);
    const contacto = estaDesbloqueado ? (cacheContactosDesbloqueados[item.id] || null) : null;
    const contactoSeguro = sanitizarContactoCliente(contacto);
    const portalNombre = item.portal || ((item.enlace_bloqueado || item.enlace || '').toLowerCase().includes('metrocuadrado') ? 'Metrocuadrado' : 'Finca Raíz');

    return `
      <article class="bento-card ${estaDesbloqueado ? 'card-unlocked' : ''} ${claseRetrasoEntrada}" data-index="${index}" data-lead-id="${escaparHtml(item.id || '')}" data-ciudad="${escaparHtml(item.ciudad || '')}" data-ciudad-norm="${escaparHtml(ciudadNorm)}" data-barrio-norm="${escaparHtml(barrioNorm)}" data-tipo="${escaparHtml(item.tipo_inmueble || '')}" data-search="${escaparHtml(searchDataCorpus)}">
        <!-- Cabecera Fotográfica con Fusión Degradada -->
        <div class="card-media-wrapper" data-action="abrir-ficha" data-index="${index}">
          ${mediaHtml}

          <!-- Degradado de fusión profunda (El secreto de 8rem del usuario) -->
          <div class="card-media-gradient"></div>

          <!-- Badges Superiores Flotantes (Izquierda) -->
          <div class="card-floating-badges">
            <span class="badge-time-pill">
              <i class="fa-regular fa-clock"></i> ${escaparHtml(item.fecha_relativa || 'Reciente')}
            </span>
            ${estaDesbloqueado ? `
              <span class="card-unlocked-badge"><i class="fa-solid fa-unlock"></i> Desbloqueado</span>
            ` : (item.urgencia ? `
              <span class="badge-status-pill ${claseUrgencia}">
                ${escaparHtml(item.urgencia)}
              </span>
            ` : '')}
          </div>
        </div>

        <!-- Cuerpo de la Tarjeta (Montado físicamente -mt-4 sobre la foto) -->
        <div class="card-body">
          <div>
            <div class="card-meta-header">
              <span class="card-location">
                <i class="fa-solid fa-location-dot"></i> ${escaparHtml(item.ubicacion)}
              </span>
              <button class="btn-specs-pill" data-action="abrir-ficha" data-index="${index}" title="Ver Detalles Completos">
                Ver Detalles <i class="fa-solid fa-chevron-up"></i>
              </button>
            </div>

            <h3 class="card-title" data-action="abrir-ficha" data-index="${index}">${escaparHtml(item.titulo)}</h3>

            <!-- Panel de Especificaciones Dinámicas (Inspirado en el bloque del usuario) -->
            <div class="card-specs-panel" data-action="abrir-ficha" data-index="${index}" title="Click para abrir especificaciones completas">
              <div class="specs-row">
                <div class="spec-item">
                  <span class="spec-label">${escaparHtml(col1Nombre)}</span>
                  <span class="spec-value">${escaparHtml(item.dato_1 || 'N/A')}</span>
                </div>
                <div class="spec-item">
                  <span class="spec-label">${escaparHtml(col2Nombre)}</span>
                  <span class="spec-value">${escaparHtml(item.dato_2 || 'N/A')}</span>
                </div>
              </div>
            </div>

            ${(estaDesbloqueado && contacto) ? `
              <div class="card-contact-phone-bar">
                <span><i class="fa-solid fa-phone"></i> <strong class="contact-phone-number">${escaparHtml(contacto.telefono || 'Ver en Anuncio')}</strong></span>
                <span class="unlocked-portal-pill"><i class="fa-solid fa-building-flag"></i> ${escaparHtml(portalNombre)}</span>
              </div>
            ` : ''}
          </div>

          <!-- Bloque Inferior: Precio Publicado y Acciones de Contacto -->
          <div class="card-bottom-row">
            <div class="pricing-column">
              <span class="pricing-label">Precio Publicado</span>
              <div class="price-main">${formatearPrecioDisplay(item.precio)}</div>
              ${item.precio_m2 ? `
                <div>
                  <span class="unit-rate-badge">${escaparHtml(item.precio_m2)}</span>
                </div>
              ` : ''}
            </div>

            ${estaDesbloqueado ? `
              <div class="unlocked-action-cluster">
                ${contactoSeguro?.enlace ? `
                  <a href="${contactoSeguro.enlace}" target="_blank" rel="noopener noreferrer" class="btn-view-ad-direct" title="Ver anuncio original del propietario directo">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Anuncio
                  </a>
                ` : ''}
                ${contactoSeguro?.whatsappUrl ? `
                  <a href="${contactoSeguro.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-direct btn-whatsapp-compact" title="Chatear por WhatsApp" aria-label="Chatear por WhatsApp con el propietario">
                    <i class="fa-brands fa-whatsapp"></i> WhatsApp
                  </a>
                ` : ''}
                ${contactoSeguro?.telLlamar ? `
                  <a href="tel:${contactoSeguro.telLlamar}" class="btn-call-direct" title="Llamar al dueño" aria-label="Llamar al propietario directo">
                    <i class="fa-solid fa-phone"></i> Llamar
                  </a>
                ` : ''}
                ${(!contactoSeguro?.enlace && !contactoSeguro?.whatsappUrl && !contactoSeguro?.telLlamar) ? `
                  <button class="btn-whatsapp-direct" data-action="contactar-whatsapp" data-index="${index}" title="Revelar contacto y enlace del propietario">
                    <i class="fa-solid fa-unlock"></i> Revelar Contacto
                  </button>
                ` : ''}
              </div>
            ` : `
              <button class="btn-unlock-lead ${item.urgencia_tipo === 'cerrado' ? 'closed' : ''}" data-action="abrir-checkout" data-index="${index}">
                <i class="fa-solid fa-lock"></i> ${item.urgencia_tipo === 'cerrado' ? 'Ver Cierre' : 'Desbloquear'}
              </button>
            `}
          </div>
        </div>

        <!-- Overlay de Detalles Deslizable (Slide-Up Drawer Integrado) -->
        <div class="card-slideup-overlay" id="slideup-${index}">
          <div class="slideup-header">
            <div class="slideup-title">
              <i class="fa-solid fa-circle-info"></i> ${esVehiculo ? 'Detalles del Vehículo' : 'Detalles de la Propiedad'}
            </div>
            <button class="btn-slideup-close" data-action="cerrar-ficha" data-index="${index}" title="Cerrar Detalles">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="slideup-body">
            <!-- Grid de Características Simétricas -->
            <div class="slideup-specs-grid">
              ${Object.entries(detalles).map(([k, v]) => {
                const kLow = k.toLowerCase();
                const iconClass = kLow.includes('estrato') ? 'fa-layer-group' : (kLow.includes('área') || kLow.includes('superficie')) ? 'fa-ruler-combined' : kLow.includes('hab') ? 'fa-bed' : kLow.includes('baño') ? 'fa-bath' : (kLow.includes('garaje') || kLow.includes('parqueadero')) ? 'fa-square-parking' : (kLow.includes('kilómet') || kLow.includes('km')) ? 'fa-gauge-high' : kLow.includes('transmisi') ? 'fa-gears' : kLow.includes('motor') ? 'fa-car-battery' : kLow.includes('placa') ? 'fa-id-card' : (kLow.includes('año') || kLow.includes('modelo')) ? 'fa-calendar-days' : kLow.includes('contacto') ? 'fa-user-shield' : 'fa-circle-info';
                const vNorm = String(v || 'N/A').replace(/\b1 espacios\b/gi, '1 espacio').replace(/\b1 alcobas\b/gi, '1 alcoba').replace(/\b1 completos\b/gi, '1 completo');
                return `
                  <div class="slideup-spec-card">
                    <span class="slideup-spec-key"><i class="fa-solid ${iconClass}"></i> ${escaparHtml(k)}</span>
                    <span class="slideup-spec-val">${escaparHtml(vNorm)}</span>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Bloque de Confianza: Trato Directo Sin Intermediarios -->
            <div class="slideup-trust-card">
              <div class="trust-badge">
                <i class="fa-solid fa-shield-halved"></i> ${esVehiculo ? 'Trato Directo con el Dueño' : 'Trato Directo con el Propietario'}
              </div>
              <p class="trust-desc">
                ${esVehiculo ? 'Vehículo publicado directamente por su dueño. Sin intermediarios ni comisiones de concesionario, listo para negociar por llamada o WhatsApp.' : 'Propiedad publicada directamente por su dueño. Sin inmobiliarias ni comisiones intermedias, lista para negociar por llamada o WhatsApp.'}
              </p>
            </div>

            <!-- Grupo de Acción: Botón principal y micro-garantía -->
            <div class="slideup-action-group">
              ${estaDesbloqueado ? `
                <div class="slideup-unlocked-layout">
                  <div class="unlocked-phone-box">
                    <div class="unlocked-phone-label">
                      <i class="fa-solid fa-unlock"></i> Datos de Contacto Desbloqueados
                    </div>
                    <div class="unlocked-phone-number">
                      ${contacto?.telefono ? escaparHtml(contacto.telefono) : 'Consultando contacto...'}
                    </div>
                  </div>
                  <div class="slideup-unlocked-row">
                    ${contactoSeguro?.whatsappUrl ? `
                      <a href="${contactoSeguro.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn btn-whatsapp-direct cta-flex" title="Chatear por WhatsApp" aria-label="Chatear por WhatsApp con el propietario">
                        <i class="fa-brands fa-whatsapp"></i> WhatsApp
                      </a>
                    ` : ''}
                    ${contactoSeguro?.telLlamar ? `
                      <a href="tel:${contactoSeguro.telLlamar}" class="slideup-cta-btn cta-flex-sm cta-call" title="Llamar al dueño" aria-label="Llamar al propietario directo">
                        <i class="fa-solid fa-phone"></i> Llamar
                      </a>
                    ` : ''}
                    ${contactoSeguro?.enlace ? `
                      <a href="${contactoSeguro.enlace}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn cta-flex cta-neutral" title="Ver anuncio original del propietario directo" aria-label="Ver anuncio original del propietario directo">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Anuncio
                      </a>
                    ` : `
                      <button class="slideup-cta-btn btn-whatsapp-direct" data-action="contactar-whatsapp" data-index="${index}" title="Revelar contacto directo" aria-label="Revelar contacto directo">
                        <i class="fa-solid fa-unlock"></i> Revelar Contacto Directo
                      </button>
                    `}
                  </div>
                  <span class="slideup-cta-note slideup-cta-note-ok">
                    <i class="fa-solid fa-check-double"></i> Contacto y enlace directo desbloqueados para tu cuenta
                  </span>
                </div>
              ` : `
                <button class="slideup-cta-btn" data-action="slideup-cta" data-index="${index}">
                  <i class="fa-solid fa-unlock-keyhole"></i> Desbloquear Contacto del Dueño
                </button>
                <span class="slideup-cta-note">
                  <i class="fa-solid fa-bolt"></i> Acceso al instante • Sin pagar comisiones
                </span>
              `}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  if (totalPaginas > 1) {
    const btnPrevHtml = paginaActual > 1 ? `<button type="button" class="btn-pagination" id="btnPrevPage" aria-label="Ir a la página anterior"><i class="fa-solid fa-chevron-left"></i> Anterior</button>` : '';
    const btnNextHtml = paginaActual < totalPaginas ? `<button type="button" class="btn-pagination" id="btnNextPage" aria-label="Ir a la página siguiente">Siguiente <i class="fa-solid fa-chevron-right"></i></button>` : '';
    htmlContenido += `
      <div class="pagination-controls">
        ${btnPrevHtml}
        <span class="pagination-info">
          Página ${paginaActual} de ${totalPaginas}
        </span>
        ${btnNextHtml}
      </div>
    `;
  }

  container.innerHTML = htmlContenido;

  if (totalPaginas > 1) {
    const btnPrev = document.getElementById("btnPrevPage");
    const btnNext = document.getElementById("btnNextPage");
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

  // Activar el Scroll Reveal progresivo con inercia para scroll móvil
  iniciarScrollReveal();

  container.querySelectorAll('.carousel-track').forEach((track) => {
    const card = track.closest('.bento-card');
    const cardIndex = Number.parseInt(card?.getAttribute('data-index') || '', 10);
    const totalFotos = track.querySelectorAll('.carousel-slide').length;
    if (typeof habilitarSwipeTactilCarrusel === 'function' && Number.isFinite(cardIndex) && totalFotos > 1) {
      habilitarSwipeTactilCarrusel(track, cardIndex, totalFotos);
    }
  });
}
