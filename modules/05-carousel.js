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
