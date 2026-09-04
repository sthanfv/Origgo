/**
 * ⚡ MOTOR DE RENDERIZADO UNIVERSAL Y MODAL DE CHECKOUT WOMPI
 * Arquitectura Agnóstica al Contenido (Dynamic Key Mapping)
 * Ecosistema Ofertas Hunter Pro — Interfaz Dark Luxury Terminal v2.0
 */

// Estado en memoria de la interfaz
let datosActuales = null;
let leadSeleccionado = null;
let wompiScriptCargado = false;
const carruselIndices = {};
let limiteVisible = 6;

// Inicialización al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
  cargarScriptWompi();
  cargarDatos("./data/inmobiliario.json");
  configurarListeners();
  
  // Activar Motor Premium de micro-interacciones (Ripple, Parallax, Háptica)
  inicializarEfectosPremium();

  // Registro de Service Worker para capacidades PWA e instalación en Android/iOS
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("[PWA] Error registrando Service Worker:", err);
      });
    });
  }
});

/**
 * Desplaza las diapositivas del carrusel fotográfico.
 * @param {number} cardIndex
 * @param {number} delta
 * @param {number} totalFotos
 * @param {Event} event
 */
function moverCarrusel(cardIndex, delta, totalFotos, event) {
  if (event) event.stopPropagation();
  if (typeof carruselIndices[cardIndex] !== 'number') carruselIndices[cardIndex] = 0;
  
  const actual = carruselIndices[cardIndex];
  const nuevo = (actual + delta + totalFotos) % totalFotos;
  carruselIndices[cardIndex] = nuevo;
  
  actualizarVistaCarrusel(cardIndex, nuevo);
}

/**
 * Mueve el carrusel a una diapositiva específica.
 * @param {number} cardIndex
 * @param {number} targetIndex
 * @param {Event} event
 */
function irACarrusel(cardIndex, targetIndex, event) {
  if (event) event.stopPropagation();
  carruselIndices[cardIndex] = targetIndex;
  actualizarVistaCarrusel(cardIndex, targetIndex);
}

/**
 * Actualiza las clases visuales de slides y dots para un carrusel.
 * @param {number} cardIndex
 * @param {number} activeIndex
 */
function actualizarVistaCarrusel(cardIndex, activeIndex) {
  const track = document.getElementById(`carousel-${cardIndex}`);
  if (!track) return;
  
  const slides = track.querySelectorAll('.carousel-slide');
  slides.forEach((slide, sIdx) => {
    if (sIdx === activeIndex) {
      slide.classList.add('active');
    } else {
      slide.classList.remove('active');
    }
  });

  const dotsContainer = document.getElementById(`dots-${cardIndex}`);
  if (dotsContainer) {
    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    dots.forEach((dot, dIdx) => {
      if (dIdx === activeIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }
}

/**
 * Abre el panel deslizable de la Ficha Técnica (Slide-Up Drawer).
 * @param {number} index
 * @param {Event} event
 */
function abrirFichaTecnica(index, event) {
  if (event) event.stopPropagation();
  const overlay = document.getElementById(`slideup-${index}`);
  if (overlay) overlay.classList.add('active');
}

/**
 * Cierra el panel deslizable de la Ficha Técnica.
 * @param {number} index
 * @param {Event} event
 */
function cerrarFichaTecnica(index, event) {
  if (event) event.stopPropagation();
  const overlay = document.getElementById(`slideup-${index}`);
  if (overlay) overlay.classList.remove('active');
}

/**
 * Carga de forma asíncrona y segura el script oficial del widget de Wompi.
 */
function cargarScriptWompi() {
  if (document.getElementById("wompi-widget-script")) return;
  const script = document.createElement("script");
  script.id = "wompi-widget-script";
  script.src = "https://checkout.wompi.co/widget.js";
  script.async = true;
  script.onload = () => {
    wompiScriptCargado = true;
    console.log("✅ Widget de Wompi cargado exitosamente.");
  };
  script.onerror = () => {
    console.warn("⚠️ No se pudo cargar el script de Wompi de la CDN. Fallback comercial activo.");
  };
  document.head.appendChild(script);
}

/**
 * Genera el marcado de tarjetas esqueleto (Skeleton Loading) con efecto Shimmer.
 * @returns {string}
 */
function generarHtmlSkeletons() {
  return Array(3).fill(0).map((_, i) => `
    <article class="bento-card skeleton-card" style="--enter-delay: ${i * 0.08}s;">
      <div class="skeleton-media skeleton-shimmer"></div>
      <div class="card-body" style="padding: 1.25rem; gap: 0.85rem;">
        <div class="skeleton-line skeleton-shimmer" style="width: 45%; height: 14px;"></div>
        <div class="skeleton-line skeleton-shimmer" style="width: 80%; height: 22px;"></div>
        <div class="skeleton-box skeleton-shimmer" style="height: 64px; border-radius: 1.25rem;"></div>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 0.75rem;">
          <div class="skeleton-line skeleton-shimmer" style="width: 45%; height: 26px;"></div>
          <div class="skeleton-btn skeleton-shimmer" style="width: 38%; height: 38px;"></div>
        </div>
      </div>
    </article>
  `).join('');
}

/**
 * Carga un archivo JSON y realiza el mapeo dinámico de llaves en la interfaz.
 * @param {string} rutaJson
 */
async function cargarDatos(rutaJson) {
  const container = document.getElementById("bentoGridContainer");
  if (container) {
    container.innerHTML = generarHtmlSkeletons();
  }

  try {
    // Breve destello de 220ms para permitir la transición fluida del Skeleton sin demoras
    const [res] = await Promise.all([
      fetch(rutaJson),
      new Promise(resolve => setTimeout(resolve, 220))
    ]);
    if (!res.ok) throw new Error(`HTTP ${res.status}: No se pudo cargar el dataset.`);
    const json = await res.json();
    datosActuales = json;
    limiteVisible = 6;
    renderizarInterfaz(json);
    aplicarFiltrosOmnibox();
  } catch (err) {
    console.error("Error cargando dataset:", err);
    if (container) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: #F43F5E;">
          <p style="font-weight: 800; font-size: 1.1rem;">Error de conexión con la terminal de datos.</p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">${err.message}</p>
        </div>
      `;
    }
  }
}

/**
 * Renderiza la interfaz utilizando Mapeo Dinámico de Llaves (Content-Agnostic) y Dark Luxury Cards.
 * Estructura de Curvatura 2.5rem y Fusión de Imagen Impecable (h-32 y -mt-4).
 * @param {Object} dataset
 */
function renderizarInterfaz(dataset) {
  const config = dataset.config || {};
  const leads = dataset.leads || [];

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
      <div style="grid-column: 1/-1; text-align: center; padding: 5rem 1rem; color: var(--text-muted);">
        <p style="font-weight: 700;">No hay oportunidades activas registradas en este momento.</p>
      </div>
    `;
    return;
  }

  const col1Nombre = config.columna_variable_1 || "Atributo 1";
  const col2Nombre = config.columna_variable_2 || "Atributo 2";

  const leadsVisibles = leads.slice(0, limiteVisible);
  const tieneMasLeads = leads.length > limiteVisible;
  const restantes = leads.length - limiteVisible;

  let htmlContenido = leadsVisibles.map((item, index) => {
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
              <img src="${escaparHtml(foto)}" alt="${escaparHtml(item.titulo)} - Foto ${fIdx + 1}" class="carousel-img" loading="lazy" />
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
        <img src="${escaparHtml(imgUrl)}" alt="${escaparHtml(item.titulo)}" class="card-static-img" loading="lazy" />
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

    // Solo las 2 primeras tarjetas del viewport inicial llevan un retardo sutil de 0.08s
    const enterDelay = index < 2 ? (index * 0.08) : 0;

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

    return `
      <article class="bento-card" data-index="${index}" data-ciudad="${escaparHtml(item.ciudad || '')}" data-ciudad-norm="${escaparHtml(ciudadNorm)}" data-barrio-norm="${escaparHtml(barrioNorm)}" data-tipo="${escaparHtml(item.tipo_inmueble || '')}" data-search="${escaparHtml(searchDataCorpus)}" style="--enter-delay: ${enterDelay}s;">
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
            ${item.urgencia ? `
              <span class="badge-status-pill ${claseUrgencia}">
                ${escaparHtml(item.urgencia)}
              </span>
            ` : ''}
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
          </div>

          <!-- Bloque Inferior: Precio Publicado y Botón de Desbloqueo -->
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

            <button class="btn-unlock-lead ${item.urgencia_tipo === 'cerrado' ? 'closed' : ''}" data-action="abrir-checkout" data-index="${index}">
              <i class="fa-solid fa-lock"></i> ${item.urgencia_tipo === 'cerrado' ? 'Ver Cierre' : 'Desbloquear'}
            </button>
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
            <!-- Grid de Características -->
            <div class="slideup-specs-grid">
              ${Object.entries(detalles).map(([k, v]) => `
                <div class="slideup-spec-card">
                  <span class="slideup-spec-key">${escaparHtml(k)}</span>
                  <span class="slideup-spec-val">${escaparHtml(v)}</span>
                </div>
              `).join('')}
            </div>

            <!-- Bloque de Confianza: Trato Directo Sin Intermediarios -->
            <div class="slideup-trust-card">
              <div class="trust-badge">
                <i class="fa-solid fa-shield-halved"></i> ${esVehiculo ? 'Trato Directo con el Dueño' : 'Trato Directo con el Propietario'}
              </div>
              <p class="trust-desc">
                ${esVehiculo 
                  ? 'Vehículo publicado directamente por su dueño. Sin intermediarios ni comisiones de concesionario, listo para negociar por llamada o WhatsApp.' 
                  : 'Propiedad publicada directamente por su dueño. Sin inmobiliarias ni comisiones intermedias, lista para negociar por llamada o WhatsApp.'}
              </p>
            </div>

            <!-- Grupo de Acción: Botón CTA y Micro-Garantía -->
            <div class="slideup-action-group">
              <button class="slideup-cta-btn" data-action="slideup-cta" data-index="${index}">
                <i class="fa-solid fa-unlock-keyhole"></i> Desbloquear Contacto del Dueño
              </button>
              <span class="slideup-cta-note">
                <i class="fa-solid fa-bolt"></i> Acceso al instante • Sin pagar comisiones
              </span>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  if (tieneMasLeads) {
    htmlContenido += `
      <div class="pagination-row" id="paginationRow">
        <button type="button" class="btn-load-more" id="btnLoadMoreLeads">
          <i class="fa-solid fa-angles-down"></i>
          <span>Cargar más oportunidades directas (+${restantes} disponibles)</span>
        </button>
      </div>
    `;
  }

  container.innerHTML = htmlContenido;

  if (tieneMasLeads) {
    const btnCargar = document.getElementById("btnLoadMoreLeads");
    if (btnCargar) {
      btnCargar.addEventListener("click", () => {
        limiteVisible += 6;
        renderizarInterfaz(dataset);
        setTimeout(() => {
          const nuevasTarjetas = container.querySelectorAll(".bento-card");
          if (nuevasTarjetas.length > leadsVisibles.length) {
            nuevasTarjetas[leadsVisibles.length].scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }, 120);
      });
    }
  }

  // Activar el Scroll Reveal progresivo con inercia para scroll móvil
  iniciarScrollReveal();
}

/**
 * Inicia el IntersectionObserver para revelar suavemente las tarjetas a medida que el usuario hace scroll.
 */
function iniciarScrollReveal() {
  const cards = document.querySelectorAll(".bento-card:not(.skeleton-card)");
  if (!cards.length) return;

  if (!("IntersectionObserver" in window)) {
    cards.forEach(card => card.classList.add("revealed"));
    return;
  }

  // Margen predictivo amplio: activa la tarjeta 350px antes de que entre a la pantalla
  // para que esté completamente revelada cuando el usuario haga scroll en el teléfono
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.transitionDelay = '0s';
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.01,
    rootMargin: "350px 0px 250px 0px"
  });

  cards.forEach(card => observer.observe(card));
}

/**
 * Abre el modal de checkout para desbloquear el lead seleccionado.
 * @param {number} index
 */
function abrirModalCheckout(index) {
  if (!datosActuales || !datosActuales.leads || !datosActuales.leads[index]) return;
  leadSeleccionado = datosActuales.leads[index];

  const modal = document.getElementById("checkoutModal");
  const elSummary = document.getElementById("modalLeadSummary");
  const btnPagar = document.getElementById("btnConfirmWompi");

  if (elSummary) {
    const imgHtml = leadSeleccionado.imagen ? `
      <div class="modal-lead-thumb-wrap">
        <img src="${escaparHtml(leadSeleccionado.imagen)}" alt="${escaparHtml(leadSeleccionado.titulo)}" class="modal-lead-thumb" />
        <div class="modal-lead-thumb-gradient"></div>
      </div>
    ` : '';

    elSummary.innerHTML = `
      ${imgHtml}
      <div class="modal-summary-item">
        <span style="color: var(--text-muted);">Inmueble:</span>
        <strong style="color: var(--text-main);">${escaparHtml(leadSeleccionado.titulo)}</strong>
      </div>
      <div class="modal-summary-item">
        <span style="color: var(--text-muted);">Ubicación:</span>
        <span style="color: var(--text-muted);">${escaparHtml(leadSeleccionado.ubicacion)}</span>
      </div>
      <div class="modal-summary-item">
        <span style="color: var(--text-muted);">Precio Publicado:</span>
        <strong style="color: var(--accent-emerald); font-size: 1.15rem;">${escaparHtml(leadSeleccionado.precio)}</strong>
      </div>
      ${leadSeleccionado.precio_m2 ? `
        <div class="modal-summary-item" style="border-top: 1px dashed var(--border-subtle); padding-top: 0.4rem; margin-top: 0.4rem;">
          <span style="color: var(--text-muted);">Valor Unitario:</span>
          <strong style="color: var(--text-main);">${escaparHtml(leadSeleccionado.precio_m2)}</strong>
        </div>
      ` : ''}
    `;
  }

  if (btnPagar) {
    const precioFmt = (window.PORTAL_CONFIG && window.PORTAL_CONFIG.precioMembresiaFormateado) 
      || "$ 89.000 / mes";
    btnPagar.innerHTML = `<i class="fa-solid fa-bolt"></i> Pagar con Wompi (${precioFmt})`;
  }

  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden"; // Prevenir scroll de fondo mientras el modal está abierto
  }
}

/**
 * Cierra el modal de checkout.
 */
function cerrarModalCheckout() {
  const modal = document.getElementById("checkoutModal");
  if (modal) {
    modal.classList.remove("active");
  }
  document.body.style.overflow = ""; // Restaurar scroll del body
}

/**
 * Dispara el Widget oficial de Wompi para procesar el pago.
 */
function ejecutarPagoWompi() {
  const config = window.PORTAL_CONFIG || {};
  const wompiConf = config.wompi || {};
  const publicKey = wompiConf.publicKey || "pub_test_Q5yDA9xoKdePzhSGeVe9HAez7HgGObCi";
  const amountInCents = (config.precioMembresiaCop || 89000) * 100;
  // [LEGAL] Generación de referencia criptográficamente segura (Fallback a timestamp si no hay crypto)
  const safeId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.floor(Math.random() * 1000000);
  const reference = "OHP-" + Date.now() + "-" + safeId;

  // Manejo de Race Condition: Si el usuario presiona muy rápido y la CDN aún no responde
  if (typeof WidgetCheckout === "undefined") {
    console.warn("[QA] Widget de Wompi aún no está listo en el entorno (Race condition evitada).");
    const btnConfirm = document.getElementById("btnConfirmWompi");
    if (btnConfirm) {
      const textoOriginal = btnConfirm.innerHTML;
      btnConfirm.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Conectando pasarela segura...`;
      btnConfirm.style.pointerEvents = "none";
      
      // Reintentar en 1.5s
      setTimeout(() => {
        btnConfirm.innerHTML = textoOriginal;
        btnConfirm.style.pointerEvents = "auto";
        // Si aún falla, que se vaya por WhatsApp como fallback comercial
        ejecutarPagoWompi(); 
      }, 1500);
      return; // Detenemos la ejecución síncrona aquí
    }
  }

  // Si el script de Wompi está cargado y disponible
  if (typeof WidgetCheckout !== "undefined") {
    try {
      const checkout = new WidgetCheckout({
        currency: "COP",
        amountInCents: amountInCents,
        reference: reference,
        publicKey: publicKey,
        redirectUrl: window.location.href,
        customerData: {
          email: "inversionista@hunterpro.com",
          fullName: "Agente Inmobiliario Hunter Pro",
          phoneNumber: "3001234567"
        }
      });

      cerrarModalCheckout();
      checkout.open((result) => {
        const transaction = result.transaction;
        console.log("Transacción Wompi completada:", transaction);
        if (transaction && transaction.status === "APPROVED") {
          alert("🎉 ¡Pago aprobado exitosamente! Bienvenido a la Terminal VIP Hunter Pro.");
        }
      });
      return;
    } catch (errWompi) {
      console.error("Error al instanciar WidgetCheckout:", errWompi);
    }
  }

  // Fallback comercial si la CDN de Wompi no estuviera disponible
  const mensaje = encodeURIComponent(
    `Hola Hunter Pro, deseo activar mi suscripción VIP para acceder al contacto directo de: "${leadSeleccionado ? leadSeleccionado.titulo : 'Oportunidad'}". Ref: ${reference}`
  );
  const telWhatsapp = config.contacto?.whatsapp || "573001234567";
  const urlWhatsapp = `https://wa.me/${telWhatsapp}?text=${mensaje}`;
  
  window.open(urlWhatsapp, "_blank");
  cerrarModalCheckout();
}

// Variables de estado reactivo del Omnibox
let filtroCiudadActivo = "";
let filtroTratoDirectoActivo = false;
let textoBusquedaActivo = "";

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
  const container = document.getElementById("bentoGridContainer");
  if (!container) return;

  const cards = container.querySelectorAll(".bento-card:not(.skeleton-card)");
  const emptyStateExistente = document.getElementById("emptyCatalogState");
  if (emptyStateExistente) {
    emptyStateExistente.remove();
  }

  let visibles = 0;

  cards.forEach(card => {
    const cardSearchText = card.getAttribute("data-search") || "";
    const cardCiudadNorm = card.getAttribute("data-ciudad-norm") || "";
    const cardBarrioNorm = card.getAttribute("data-barrio-norm") || "";

    // 1. Filtro de Texto Inteligente (Multi-token, sin tildes, sinónimos)
    const coincideTexto = coincideBusquedaInteligente(cardSearchText, textoBusquedaActivo);

    // 2. Filtro de Ciudad seleccionada en Dropdown (Tolerante y Multi-Ciudad)
    let coincideCiudad = true;
    if (filtroCiudadActivo) {
      const ciudadesObjetivo = filtroCiudadActivo.split("|").map(normalizarTextoBusqueda);
      coincideCiudad = ciudadesObjetivo.some(c => 
        cardCiudadNorm.includes(c) || cardBarrioNorm.includes(c) || cardSearchText.includes(c)
      );
    }

    // 3. Filtro de Trato Directo (Todas las oportunidades del showcase son 100% FSBO de particulares)
    const coincideTrato = true;

    if (coincideTexto && coincideCiudad && coincideTrato) {
      card.style.display = "";
      visibles++;
    } else {
      card.style.display = "none";
    }
  });

  // Actualizar contador del catálogo
  const countEl = document.getElementById("catalogCountText");
  if (countEl) {
    countEl.textContent = `${visibles} oportunidad${visibles === 1 ? '' : 'es'} directa${visibles === 1 ? '' : 's'}`;
  }

  // Si no hay resultados visibles, inyectar el Empty State de lujo con botón de restablecimiento
  if (visibles === 0 && cards.length > 0) {
    const ciudadTexto = filtroCiudadActivo ? ` en ${filtroCiudadActivo.replace(/\|/g, ', ')}` : '';
    const querySegura = escaparHtml((textoBusquedaActivo || "").slice(0, 40).trim());
    const busquedaTexto = querySegura ? ` para "${querySegura}"` : '';
    const emptyStateHtml = `
      <div class="empty-catalog-state" id="emptyCatalogState">
        <div class="empty-state-icon-box">
          <i class="fa-solid fa-filter-circle-xmark"></i>
        </div>
        <div class="empty-state-content">
          <h3 class="empty-state-title">Sin oportunidades coincidentes</h3>
          <p class="empty-state-desc">No se encontraron avisos que coincidan con los filtros aplicados${busquedaTexto}${ciudadTexto}. Intenta restablecer los criterios o buscar por otra zona.</p>
        </div>
        <button type="button" class="btn-empty-reset" id="btnResetFilters">
          <i class="fa-solid fa-rotate-left"></i> Restablecer todos los filtros
        </button>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", emptyStateHtml);

    const btnReset = document.getElementById("btnResetFilters");
    if (btnReset) {
      btnReset.addEventListener("click", restablecerTodosLosFiltros);
    }
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
 * Configuración de listeners e interactividad.
 */
function configurarListeners() {
  // Selector de Nicho Unificado (Soporta .cmd-niche-tab y .niche-tab)
  const tabs = document.querySelectorAll(".cmd-niche-tab, .niche-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const datasetRuta = tab.getAttribute("data-dataset");
      // Sincronizar todas las pestañas vinculadas a la misma ruta
      document.querySelectorAll(`[data-dataset="${datasetRuta}"]`).forEach(t => t.classList.add("active"));
      if (datasetRuta) {
        restablecerTodosLosFiltros();
        cargarDatos(datasetRuta);
      }
    });
  });

  // Buscador Omnibox con Debounce (Evita saturación de CPU)
  const omnibox = document.getElementById("omniboxSearch");
  const btnSearchClear = document.getElementById("cmdSearchClear");
  let timeoutBusqueda;

  if (omnibox) {
    omnibox.addEventListener("input", (e) => {
      clearTimeout(timeoutBusqueda);
      textoBusquedaActivo = e.target.value;
      
      if (btnSearchClear) {
        btnSearchClear.classList.toggle("visible", textoBusquedaActivo.trim().length > 0);
      }
      
      // Retrasa la ejecución 300ms hasta que el usuario deje de teclear
      timeoutBusqueda = setTimeout(() => {
        aplicarFiltrosOmnibox();
      }, 300);
    });
  }

  if (btnSearchClear && omnibox) {
    btnSearchClear.addEventListener("click", () => {
      clearTimeout(timeoutBusqueda);
      omnibox.value = "";
      textoBusquedaActivo = "";
      btnSearchClear.classList.remove("visible");
      omnibox.focus();
      aplicarFiltrosOmnibox();
    });
  }

  // Delegación de Eventos en el Contenedor Bento (Cero fugas de memoria y optimización para Samsung J7)
  const bentoGrid = document.getElementById("bentoGridContainer");
  if (bentoGrid && !bentoGrid.dataset.delegacionConfigurada) {
    bentoGrid.dataset.delegacionConfigurada = "true";
    bentoGrid.addEventListener("click", (e) => {
      const actionEl = e.target.closest("[data-action]");
      if (!actionEl) return;

      const action = actionEl.getAttribute("data-action");
      const idx = parseInt(actionEl.getAttribute("data-index"), 10);
      if (isNaN(idx)) return;

      if (action === "carrusel-prev") {
        e.stopPropagation();
        const total = parseInt(actionEl.getAttribute("data-total"), 10) || 1;
        moverCarrusel(idx, -1, total, e);
      } else if (action === "carrusel-next") {
        e.stopPropagation();
        const total = parseInt(actionEl.getAttribute("data-total"), 10) || 1;
        moverCarrusel(idx, 1, total, e);
      } else if (action === "abrir-ficha") {
        e.stopPropagation();
        abrirFichaTecnica(idx, e);
      } else if (action === "cerrar-ficha") {
        e.stopPropagation();
        cerrarFichaTecnica(idx, e);
      } else if (action === "abrir-checkout") {
        e.stopPropagation();
        abrirModalCheckout(idx);
      } else if (action === "slideup-cta") {
        e.stopPropagation();
        cerrarFichaTecnica(idx, e);
        abrirModalCheckout(idx);
      }
    });
  }

  // Desplazamiento Suave al Catálogo desde el Hero CTA
  const btnHeroCta = document.getElementById("btnHeroCta");
  if (btnHeroCta) {
    btnHeroCta.addEventListener("click", () => {
      const catalogHeader = document.getElementById("catalogHeaderRow");
      if (catalogHeader) {
        catalogHeader.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  // Navegación Inferior Nativa (Solo Móvil)
  const mobileNavBtns = document.querySelectorAll(".mobile-nav-btn");
  mobileNavBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      mobileNavBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const navType = btn.getAttribute("data-nav");
      if (navType === "home") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (navType === "search") {
        const omnibox = document.getElementById("omniboxSearch");
        if (omnibox) {
          omnibox.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => omnibox.focus(), 350);
        }
      } else if (navType === "vip") {
        abrirModalCheckout(0);
      }
    });
  });

  // Dropdown de Ciudades de Alta Demanda
  const pillLocation = document.getElementById("cmdFilterLocation");
  const dropdownLocation = document.getElementById("cmdLocationDropdown");
  const labelLocation = document.getElementById("cmdFilterLocationLabel");

  if (pillLocation && dropdownLocation) {
    pillLocation.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdownLocation.classList.toggle("show");
      pillLocation.classList.toggle("open", isOpen);
      pillLocation.setAttribute("aria-expanded", String(isOpen));
    });

    dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const cityValue = item.getAttribute("data-city") || "";
        filtroCiudadActivo = cityValue;

        dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");

        const spanText = item.querySelector("span") ? item.querySelector("span").textContent : "Colombia (Todas)";
        if (labelLocation) labelLocation.textContent = spanText;

        pillLocation.classList.toggle("active-filter", cityValue !== "");
        dropdownLocation.classList.remove("show");
        pillLocation.classList.remove("open");
        pillLocation.setAttribute("aria-expanded", "false");

        aplicarFiltrosOmnibox();
      });
    });
  }

  // Cerrar Dropdown al hacer click fuera
  window.addEventListener("click", (e) => {
    if (dropdownLocation && dropdownLocation.classList.contains("show")) {
      if (!pillLocation.contains(e.target) && !dropdownLocation.contains(e.target)) {
        dropdownLocation.classList.remove("show");
        pillLocation.classList.remove("open");
        pillLocation.setAttribute("aria-expanded", "false");
      }
    }
  });

  // Filtro Conmutador de Trato Directo
  const pillType = document.getElementById("cmdFilterType");
  if (pillType) {
    pillType.addEventListener("click", () => {
      filtroTratoDirectoActivo = !filtroTratoDirectoActivo;
      pillType.classList.toggle("active-filter", filtroTratoDirectoActivo);
      aplicarFiltrosOmnibox();
    });
  }

  // Menú Táctico Rápido con Animación Cinemática Hamburguesa a X (Estilo Desmulta)
  const btnMenu = document.getElementById("btnMenuTrigger");
  if (btnMenu) {
    btnMenu.addEventListener("click", () => {
      btnMenu.classList.toggle("is-active");
    });
  }

  // Modal Close
  const btnClose = document.getElementById("btnModalClose");
  if (btnClose) btnClose.addEventListener("click", cerrarModalCheckout);

  const btnCancel = document.getElementById("btnModalCancel");
  if (btnCancel) btnCancel.addEventListener("click", cerrarModalCheckout);

  const modal = document.getElementById("checkoutModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) cerrarModalCheckout();
    });
  }

  // Botón Confirmar Pago Wompi
  const btnPagar = document.getElementById("btnConfirmWompi");
  if (btnPagar) {
    btnPagar.addEventListener("click", ejecutarPagoWompi);
  }

  // Botón VIP del Header
  const btnVipHeader = document.getElementById("btnVipHeader");
  if (btnVipHeader) {
    btnVipHeader.addEventListener("click", () => {
      abrirModalCheckout(0);
    });
  }


  // ==========================================
  // MODAL LEGAL Y POLÍTICAS (LEY 1581)
  // ==========================================
  const modalLegal = document.getElementById("modalLegalOverlay");
  const btnCloseLegal = document.getElementById("btnLegalCloseIcon");
  const btnCancelLegal = document.getElementById("btnLegalCancel");
  const legalTitle = document.getElementById("legalModalTitle");
  const legalContent = document.getElementById("legalContentBox");

  const btnTerminos = document.getElementById("btnOpenTerminos");
  const btnPrivacidad = document.getElementById("btnOpenPrivacidad");

  const textosLegales = {
    terminos: {
      titulo: "Términos de Servicio y Exoneración de Responsabilidad",
      html: "<p><strong>1. Naturaleza del Servicio y Cero Intermediación</strong><br>Hunter Pro Intelligence es una herramienta de software que indexa y clasifica información de ofertas publicadas abiertamente en internet. Hunter Pro NO es una agencia inmobiliaria, concesionario, entidad de corretaje, ni actúa como asesor financiero o legal. No cobramos comisiones ni participamos en acuerdos comerciales o pagos.</p><p><strong>2. Exoneración Total de Responsabilidad</strong><br>Hunter Pro no valida, certifica ni garantiza la veracidad, exactitud, vigencia, titularidad real, legalidad o estado físico o mecánico de los bienes listados. La negociación, desembolsos, revisión de títulos de propiedad, tradición, gravámenes o contratos es responsabilidad exclusiva, directa e indelegable del usuario y las partes interesadas. Hunter Pro queda expresamente eximido de cualquier daño, pérdida económica o disputa derivada de transacciones entre particulares.</p><p><strong>3. Cláusula Anti-Scraping Estricta</strong><br>Se prohíbe terminantemente la extracción automatizada, raspado web o minería de datos mediante bots, spiders o herramientas informáticas. La infracción facultará la revocación inmediata del acceso y las acciones judiciales pertinentes.</p>"
    },
    privacidad: {
      titulo: "Política de Privacidad y Tratamiento de Datos (Ley 1581)",
      html: "<p><strong>1. Cumplimiento Normativo (Ley 1581 de 2012)</strong><br>En cumplimiento del régimen de protección de datos personales de Colombia, Hunter Pro garantiza los derechos de consulta, actualización y supresión de datos a los titulares.</p><p><strong>2. Origen Público de la Información y Desindexación</strong><br>Los números de contacto y datos de bienes corresponden a información divulgada voluntariamente por sus anunciantes en plataformas públicas. Nuestro software opera únicamente como motor indexador. Si usted es el titular de un inmueble o vehículo y desea desindexar su contacto o publicación de la terminal, puede solicitar la supresión inmediata a través de nuestro canal de soporte.</p><p><strong>3. Acceso Restringido</strong><br>Los datos de contacto se suministran exclusivamente a usuarios registrados bajo verificación para evitar usos indebidos o masivos.</p>"
    }
  };

  function abrirModalLegal(tipo) {
    if (modalLegal && textosLegales[tipo]) {
      legalTitle.textContent = textosLegales[tipo].titulo;
      legalContent.innerHTML = textosLegales[tipo].html;
      modalLegal.style.display = "flex";
      modalLegal.offsetHeight;
      modalLegal.style.opacity = "1";
    }
  }

  function cerrarModalLegal() {
    if (modalLegal) {
      modalLegal.style.opacity = "0";
      setTimeout(() => {
        modalLegal.style.display = "none";
      }, 300);
    }
  }

  if (btnTerminos) btnTerminos.addEventListener("click", () => abrirModalLegal('terminos'));
  if (btnPrivacidad) btnPrivacidad.addEventListener("click", () => abrirModalLegal('privacidad'));
  
  if (btnCloseLegal) btnCloseLegal.addEventListener("click", cerrarModalLegal);
  if (btnCancelLegal) btnCancelLegal.addEventListener("click", cerrarModalLegal);
  
  if (modalLegal) {
    modalLegal.addEventListener("click", (e) => {
      if (e.target === modalLegal) cerrarModalLegal();
    });
  }

  // Conmutador y Persistencia de Modo Claro / Modo Oscuro AMOLED
  const btnTheme = document.getElementById("btnThemeToggle");
  const btnThemeMobile = document.getElementById("btnThemeToggleMobile");
  const temaInicial = document.documentElement.getAttribute("data-theme") || (function() {
    try { return localStorage.getItem("hunter_theme"); } catch (e) { return null; }
  })() || "dark";

  document.documentElement.setAttribute("data-theme", temaInicial);
  actualizarIconoTema(temaInicial);

  const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    try {
      localStorage.setItem("hunter_theme", newTheme);
    } catch (e) {
      console.warn("No se pudo guardar el tema en localStorage:", e);
    }
    actualizarIconoTema(newTheme);
  };

  if (btnTheme) btnTheme.addEventListener("click", toggleTheme);
  if (btnThemeMobile) btnThemeMobile.addEventListener("click", toggleTheme);

  // Calibración táctil del Isotipo Radar (Feedback háptico-visual en móvil y click en desktop)
  const brandBadge = document.querySelector(".brand-badge");
  if (brandBadge) {
    const dispararCalibracion = () => {
      brandBadge.classList.add("calibrating");
      setTimeout(() => brandBadge.classList.remove("calibrating"), 750);
    };
    brandBadge.addEventListener("click", dispararCalibracion);
    brandBadge.addEventListener("touchstart", dispararCalibracion, { passive: true });
  }

  // Soporte de accesibilidad: Cerrar modal o ficha técnica con la tecla Escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cerrarModalCheckout();
      document.querySelectorAll(".card-slideup-overlay.active").forEach((overlay) => {
        overlay.classList.remove("active");
      });
    }
  });
}

/**
 * Sanitización de texto HTML para prevenir inyecciones.
 * @param {string} texto
 * @returns {string}
 */
function escaparHtml(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
 * Sincroniza visualmente el icono y tooltip del conmutador de tema.
 * @param {string} theme - 'dark' o 'light'
 */
function actualizarIconoTema(theme) {
  const btnTheme = document.getElementById("btnThemeToggle");
  const btnThemeMobile = document.getElementById("btnThemeToggleMobile");

  if (btnTheme) {
    const icon = btnTheme.querySelector("i");
    if (icon) {
      if (theme === "light") {
        icon.className = "fa-solid fa-moon";
        btnTheme.title = "Cambiar a Modo Oscuro AMOLED";
      } else {
        icon.className = "fa-solid fa-sun";
        btnTheme.title = "Cambiar a Modo Claro Arquitectónico";
      }
    }
  }

  if (btnThemeMobile) {
    const iconM = btnThemeMobile.querySelector("i");
    const spanM = btnThemeMobile.querySelector("span");
    if (iconM) {
      if (theme === "light") {
        iconM.className = "fa-solid fa-moon";
        if (spanM) spanM.textContent = "Noche";
      } else {
        iconM.className = "fa-solid fa-sun";
        if (spanM) spanM.textContent = "Día";
      }
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════
// 🌐 EXPOSICIÓN GLOBAL PARA COMPATIBILIDAD Y TESTING
// ═════════════════════════════════════════════════════════════════════════
window.moverCarrusel = moverCarrusel;
window.irACarrusel = irACarrusel;
window.abrirFichaTecnica = abrirFichaTecnica;
window.cerrarFichaTecnica = cerrarFichaTecnica;
window.abrirModalCheckout = abrirModalCheckout;
window.aplicarFiltrosOmnibox = aplicarFiltrosOmnibox;

/* ═══════════════════════════════════════════════════
   ✨ MOTOR DE MICRO-INTERACCIONES Y HÁPTICA
   ═══════════════════════════════════════════════════ */
function inicializarEfectosPremium() {
  // 1. Motor Háptico (Vibración silenciosa nativa - Ajustado para motores más pesados)
  const hapticLight = () => { if (navigator.vibrate) navigator.vibrate(30); };
  const hapticHeavy = () => { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); };

  // 2. Efecto Onda (Ripple) y Sondeo de Clicks
  document.body.addEventListener('click', (e) => {
    // Detectar si el toque fue en un botón interactivo
    const btn = e.target.closest('.btn-unlock-lead, .btn-wompi-pay, .slideup-cta-btn, .mobile-nav-btn, .btn-hero-cta, .btn-menu-pill');
    
    if (btn) {
      // Diferenciar vibración según la importancia del botón
      if (btn.classList.contains('btn-wompi-pay')) {
        hapticHeavy();
      } else {
        hapticLight();
      }

      // Crear inyección de onda dinámica
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const ripple = document.createElement('span');
      ripple.className = 'ripple-span';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;

      btn.classList.add('btn-ripple');
      btn.appendChild(ripple);

      // Limpiar el DOM tras terminar la animación
      setTimeout(() => ripple.remove(), 500);
    }
  });

  // 3. Comando Flotante Magnético (Sticky Glass)
  const commandBar = document.querySelector('.command-bar-wrapper');
  if (commandBar) {
    // Usamos passive: true para no bloquear el hilo principal de scroll
    window.addEventListener('scroll', () => {
      if (window.scrollY > 15) {
        commandBar.classList.add('is-scrolled');
      } else {
        commandBar.classList.remove('is-scrolled');
      }
    }, { passive: true });
  }

  // 4. Motor Parallax de Bajo Consumo
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        // Seleccionamos las imágenes renderizadas
        const images = document.querySelectorAll('.carousel-img, .card-static-img');
        const windowHeight = window.innerHeight;

        images.forEach(img => {
          const parent = img.closest('.bento-card');
          if (parent) {
            const rect = parent.getBoundingClientRect();
            // Ejecutar física SOLO si la tarjeta está visible en pantalla
            if (rect.top < windowHeight && rect.bottom > 0) {
              // Calcular porcentaje de posición y mover de -7.5% a 7.5%
              const yPos = ((rect.top / windowHeight) * 15) - 7.5; 
              // translate3d activa el procesador gráfico (GPU) directamente
              img.style.transform = `translate3d(0, ${yPos}%, 0)`;
            }
          }
        });
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // 5. Lógica del Menú Lateral Móvil (Off-Canvas)
  const btnMenuTrigger = document.getElementById('btnMenuTrigger');
  const btnCloseMenu = document.getElementById('btnCloseMenu');
  const sideMenu = document.getElementById('sideMenu');
  const menuOverlay = document.getElementById('menuOverlay');

  const toggleMenu = () => {
    if (sideMenu && menuOverlay) {
      sideMenu.classList.toggle('active');
      menuOverlay.classList.toggle('active');
      if(btnMenuTrigger) btnMenuTrigger.classList.toggle('active');
      // Prevenir scroll de fondo si se abre
      if (sideMenu.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  };

  if (btnMenuTrigger) btnMenuTrigger.addEventListener('click', toggleMenu);
  const btnNavMenuBottom = document.getElementById('btnNavMenuBottom');
  if (btnNavMenuBottom) btnNavMenuBottom.addEventListener('click', toggleMenu);

  if (btnCloseMenu) btnCloseMenu.addEventListener('click', toggleMenu);
  if (menuOverlay) menuOverlay.addEventListener('click', toggleMenu);

}
