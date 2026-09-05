/**
 * ✨ MÓDULO DE EFECTOS UI Y MICRO-INTERACCIONES (modules/09-ui-effects.js)
 * Háptica táctil, ondas ripple, scroll reveal, parallax GPU y menú lateral off-canvas.
 * Estándar Ecosistema Desmulta Frontend.
 */

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
  const sideMenu = document.getElementById('sideMenu');
  const menuOverlay = document.getElementById('sideMenuOverlay') || document.getElementById('menuOverlay');
  const btnCloseMenu = document.getElementById('btnCloseSideMenu') || document.getElementById('btnCloseMenu');
  const btnNavMenuBottom = document.getElementById('btnNavMenuBottom');
  const btnMenuTrigger = document.getElementById('btnMenuTrigger');

  const abrirSideMenu = () => {
    if (sideMenu && menuOverlay) {
      sideMenu.classList.add('active');
      menuOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      if (btnNavMenuBottom) btnNavMenuBottom.classList.add('active');
    }
  };

  const cerrarSideMenu = () => {
    if (sideMenu && menuOverlay) {
      sideMenu.classList.remove('active');
      menuOverlay.classList.remove('active');
      document.body.style.overflow = '';
      if (btnNavMenuBottom) btnNavMenuBottom.classList.remove('active');
    }
  };

  if (btnNavMenuBottom) {
    btnNavMenuBottom.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (sideMenu && sideMenu.classList.contains('active')) {
        cerrarSideMenu();
      } else {
        abrirSideMenu();
      }
    });
  }

  if (btnMenuTrigger) {
    btnMenuTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      abrirSideMenu();
    });
  }

  if (btnCloseMenu) {
    btnCloseMenu.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarSideMenu();
    });
  }

  if (menuOverlay) {
    menuOverlay.addEventListener('click', cerrarSideMenu);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sideMenu && sideMenu.classList.contains('active')) {
      cerrarSideMenu();
    }
  });

  // Vinculación de Enlaces de Navegación del Menú Lateral
  const sideLinks = document.querySelectorAll('.side-menu-link[data-side]');
  sideLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const action = link.getAttribute('data-side');
      cerrarSideMenu();
      sideLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      if (action === 'dashboard' || action === 'inmuebles') {
        e.preventDefault();
        const tabInm = document.querySelector('.cmd-niche-tab[data-dataset="./data/inmobiliario.json"]');
        if (tabInm) tabInm.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (action === 'vehiculos') {
        e.preventDefault();
        const tabVeh = document.querySelector('.cmd-niche-tab[data-dataset="./data/vehiculos.json"]');
        if (tabVeh) tabVeh.click();
      } else if (action === 'vip') {
        e.preventDefault();
        abrirModalCheckout(0);
      } else if (action === 'terminos') {
        e.preventDefault();
        const btnTerminos = document.getElementById('btnOpenTerminos');
        if (btnTerminos) btnTerminos.click();
      }
    });
  });

}
