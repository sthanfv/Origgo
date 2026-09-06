/**
 * 🎠 MÓDULO DE CARRUSELES Y FICHA TÉCNICA (modules/05-carousel.js)
 * Carruseles fotográficos táctiles, navegación y drawer slide-up de detalles.
 * Estándar Ecosistema Desmulta UI/UX.
 */

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
      // Carga bajo demanda de la foto activa si aún no se ha descargado
      const img = slide.querySelector('img[data-src]');
      if (img) {
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

