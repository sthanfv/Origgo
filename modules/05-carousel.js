/**
 * 🎠 MÓDULO DE CARRUSELES Y FICHA TÉCNICA (modules/05-carousel.js)
 * Carruseles fotográficos táctiles, navegación y drawer slide-up de detalles.
 * Estándar Ecosistema Desmulta UI/UX.
 */

let ultimoGiroCarruselMs = 0;

/**
 * Desplaza las diapositivas del carrusel fotográfico con guarda de debounce anti-ráfagas táctiles.
 * @param {number} cardIndex
 * @param {number} delta
 * @param {number} totalFotos
 * @param {Event} event
 */
function moverCarrusel(cardIndex, delta, totalFotos, event) {
  if (event) event.stopPropagation();
  const ahora = Date.now();
  if (ahora - ultimoGiroCarruselMs < 220) return;
  ultimoGiroCarruselMs = ahora;

  if (typeof carruselIndices[cardIndex] !== 'number') carruselIndices[cardIndex] = 0;

  const actual = carruselIndices[cardIndex];
  const nuevo = (actual + delta + totalFotos) % totalFotos;
  carruselIndices[cardIndex] = nuevo;

  actualizarVistaCarrusel(cardIndex, nuevo);
}

/**
 * Despachador de navegación de diapositivas con debounce táctil (Mobile Rapid Tapping).
 */
function avanzarCarruselSeguro(idx, totalFotos = 1, delta = 1) {
  moverCarrusel(idx, delta, totalFotos);
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
      // Carga bajo demanda de la foto activa si aún no se ha descargado
      const img = slide.querySelector('img[data-src]');
      if (img) {
        img.decoding = 'async';
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      }
    } else {
      slide.classList.remove('active');
    }
  });

  // Precarga proactiva del siguiente slide para respuesta instantánea sin peso inicial
  if (slides.length > 1) {
    const nextIdx = (activeIndex + 1) % slides.length;
    const nextImg = slides[nextIdx]?.querySelector('img[data-src]');
    if (nextImg) {
      nextImg.decoding = 'async';
      nextImg.src = nextImg.dataset.src;
      nextImg.removeAttribute('data-src');
    }
  }

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

  const photoBadge = document.getElementById(`carousel-badge-${cardIndex}`);
  if (photoBadge && slides.length > 0) {
    photoBadge.innerHTML = `<i class="fa-regular fa-image"></i> ${activeIndex + 1}/${slides.length}`;
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
 * Inicializa gestos táctiles en carruseles sin interferir con el scroll vertical.
 * @param {HTMLElement} trackEl
 * @param {number} cardIndex
 * @param {number} totalFotos
 */
function habilitarSwipeTactilCarrusel(trackEl, cardIndex, totalFotos) {
  if (!trackEl || trackEl.dataset.deslizamientoConfigurado === "true" || totalFotos <= 1) return;
  trackEl.dataset.deslizamientoConfigurado = "true";

  let startX = 0;
  let startY = 0;
  let isSwiping = false;

  trackEl.addEventListener("touchstart", (event) => {
    if (!event.touches || event.touches.length !== 1) return;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    isSwiping = true;
  }, { passive: true });

  trackEl.addEventListener("touchmove", (event) => {
    if (!isSwiping || !event.touches || event.touches.length !== 1) return;
    const diffY = Math.abs(event.touches[0].clientY - startY);
    const diffX = Math.abs(event.touches[0].clientX - startX);

    if (diffY > diffX && diffY > 15) {
      isSwiping = false;
    }
  }, { passive: true });

  trackEl.addEventListener("touchend", (event) => {
    if (!isSwiping) return;
    isSwiping = false;
    const touch = event.changedTouches ? event.changedTouches[0] : null;
    if (!touch) return;

    const diffX = touch.clientX - startX;
    const diffY = Math.abs(touch.clientY - startY);

    if (Math.abs(diffX) >= 35 && Math.abs(diffX) > diffY) {
      moverCarrusel(cardIndex, diffX < 0 ? 1 : -1, totalFotos);
    }
  }, { passive: true });
}

/**
 * Abre una ventana emergente optimizada para impresión con el dossier completo de la propiedad.
 * @param {string} leadId
 */
function abrirDossierImprimible(leadId) {
  const dataset = window._origgoDatasetCompleto || (window.datosLeadsCache ? { leads: window.datosLeadsCache } : null);
  const lead = dataset?.leads?.find(l => String(l.id) === String(leadId)) || (typeof leadSeleccionado !== 'undefined' ? leadSeleccionado : null);
  if (!lead) return;
  const contacto = (typeof cacheContactosDesbloqueados !== 'undefined' ? cacheContactosDesbloqueados[leadId] : null) || lead.contacto;
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  const tel = contacto?.telefonoDisplay || contacto?.telefono || (isEn ? 'Direct in listing' : 'Directo en anuncio');
  const wa = contacto?.whatsappUrl || '';
  const web = contacto?.enlace || '';
  const html = `<!DOCTYPE html><html lang="${isEn ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${lead.titulo || 'Origgo Dossier'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #0A110E; background: #FFF; }
    .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 18px; } .logo { font-size: 28px; font-weight: 800; color: #047857; margin: 0; } .tag { font-size: 10px; color: #059669; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
    .box { border: 1px solid #CBDAD0; border-radius: 12px; padding: 18px; margin-bottom: 16px; } .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0; }
    .metric { background: #F2F7F4; border-radius: 8px; padding: 10px; text-align: center; } .metric-k { font-size: 10px; color: #4B6358; font-weight: 800; text-transform: uppercase; } .metric-v { font-size: 15px; font-weight: 800; color: #0A110E; margin-top: 4px; }
    .contact { background: #ECFDF5; border: 2px solid #059669; border-radius: 12px; padding: 18px; text-align: center; margin: 18px 0; } .phone { font-size: 24px; font-weight: 800; color: #064E3B; font-family: monospace; letter-spacing: 2px; }
    .btn { display: inline-block; background: #059669; color: #FFF; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px; margin: 6px 4px; cursor: pointer; border: none; } .wa-btn { background: #25D366; }
    .notice { background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 12px; font-size: 12px; color: #991B1B; line-height: 1.4; margin-top: 16px; } @media print { .no-print { display: none !important; } }
  </style></head><body>
    <div class="header"><h1 class="logo">Origgo</h1><div class="tag">${isEn ? 'CONFIDENTIAL PROPERTY DOSSIER · DIRECT OWNER' : 'DOSSIER CONFIDENCIAL DE PROPIEDAD · TRATO DIRECTO'}</div></div>
    <div class="box">
      <h2 style="margin:0 0 6px;">${lead.titulo || ''}</h2>
      <p style="color:#4B6358;margin:0 0 14px;font-size:13px;">📍 ${lead.ubicacion || 'Colombia'} · <em>${contacto?.portal || lead.portal || 'Finca Raíz'}</em></p>
      <div class="grid">
        <div class="metric"><div class="metric-k">${isEn ? 'Price' : 'Precio'}</div><div class="metric-v" style="color:#047857;">${lead.precio || 'Consultar'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Area' : 'Área'}</div><div class="metric-v">${lead.detalles?.['Área'] || lead.dato_1 || 'N/A'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Value / m²' : 'Valor / m²'}</div><div class="metric-v">${lead.precio_m2 || 'N/A'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Rooms' : 'Habitaciones'}</div><div class="metric-v">${lead.detalles?.['Habitaciones'] || 'N/A'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Baths' : 'Baños'}</div><div class="metric-v">${lead.detalles?.['Baños'] || 'N/A'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Stratum' : 'Estrato'}</div><div class="metric-v">${lead.detalles?.['Estrato'] || 'N/A'}</div></div>
      </div>
    </div>
    <div class="contact">
      <div style="font-size:11px;font-weight:800;color:#047857;letter-spacing:1px;margin-bottom:6px;">${isEn ? 'VERIFIED DIRECT OWNER CONTACT' : 'CONTACTO DIRECTO VERIFICADO'}</div>
      <div class="phone">${tel}</div>
      <div style="margin-top:12px;">
        ${wa ? `<a href="${wa}" target="_blank" class="btn wa-btn">💬 WhatsApp</a>` : ''}
        ${web ? `<a href="${web}" target="_blank" class="btn">🔗 ${isEn ? 'View Ad' : 'Ver Anuncio'}</a>` : ''}
      </div>
    </div>
    <div class="notice">
      <strong>🛡️ ${isEn ? 'Direct Closing Protocol:' : 'Protocolo de Cierre Directo:'}</strong>
      ${isEn ? 'Verify Title Certificate before sending down payment. Negotiate directly with 0% broker fees.' : 'Verifica el Certificado de Tradición y Libertad antes de transferir anticipos. Negocia sin comisiones de agencia.'}
    </div>
    <div style="text-align:center;margin-top:24px;" class="no-print">
      <button onclick="window.print()" class="btn" style="font-size:14px;padding:12px 28px;">🖨️ ${isEn ? 'Print / Save as PDF' : 'Imprimir / Guardar como PDF'}</button>
    </div>
  </body></html>`;
  w.document.write(html); w.document.close();
}
window.abrirDossierImprimible = abrirDossierImprimible;
window.avanzarCarruselSeguro = avanzarCarruselSeguro;
window.moverCarrusel = moverCarrusel;

