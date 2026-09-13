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

  // 4. Motor Parallax GPU sin Forced Reflow (desactivado en pantallas táctiles/móviles para 60fps)
  const esTactilOMovil = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 768;
  const prefiereMenorMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!esTactilOMovil && !prefiereMenorMovimiento) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const cards = document.querySelectorAll('.bento-card.revealed');
          const windowHeight = window.innerHeight;
          // Fase 1: Lecturas en lote (Read Phase)
          const updates = [];
          cards.forEach((card) => {
            const rect = card.getBoundingClientRect();
            if (rect.top < windowHeight && rect.bottom > 0) {
              const yPos = ((rect.top / windowHeight) * 15) - 7.5;
              const img = card.querySelector('.carousel-slide.active img, .card-static-img');
              if (img) updates.push({ img, yPos });
            }
          });
          // Fase 2: Escrituras en lote (Write Phase - Cero Forced Reflow)
          updates.forEach(({ img, yPos }) => {
            img.style.transform = `translate3d(0, ${yPos}%, 0)`;
          });
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

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
      } else if (action === 'vip') {
        e.preventDefault();
        abrirModalCheckout(0);
      } else if (action === 'terminos') {
        e.preventDefault();
        abrirModalLegal('terminos');
      }
    });
  });

  // Inicializar controlador del modal legal
  inicializarModalLegal();
}

/**
 * Textos claros y transparentes para usuarios y propietarios.
 */
const TEXTOS_LEGALES_ORIGGO = {
  terminos: {
    titulo: 'Cómo Funciona Origgo',
    subtitulo: 'Conexión directa entre compradores y propietarios',
    badge: 'Transparencia',
    icono: 'fa-solid fa-file-contract',
    html: `
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-handshake"></i> 1. Trato Directo sin Intermediarios</div>
        <p>Origgo recopila y organiza anuncios publicados directamente por propietarios en internet. No somos una inmobiliaria ni cobramos comisión sobre la venta o arriendo. El trato lo haces tú directamente con el dueño.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-key"></i> 2. Créditos de Desbloqueo</div>
        <p>Cada crédito te permite ver el WhatsApp real del dueño para contactarlo de inmediato. Tus créditos no vencen y quedan protegidos con tu número de teléfono.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-shield-halved"></i> 3. Uso Personal y Protección</div>
        <p>El acceso a los contactos es para tu uso personal o comercial directo. Protegemos los datos para evitar llamadas masivas o molestias a los propietarios.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-lock"></i> 4. Pagos Seguros con Wompi</div>
        <p>Tus pagos se procesan de forma segura a través de la pasarela oficial Wompi (vigilada por la Superintendencia Financiera de Colombia). Origgo no guarda tus tarjetas ni claves bancarias.</p>
      </div>
    `
  },
  exoneracion: {
    titulo: 'Seguridad y Trato Directo',
    subtitulo: 'Recomendaciones importantes para comprar con tranquilidad',
    badge: 'Seguridad',
    icono: 'fa-solid fa-shield-halved',
    html: `
      <div class="legal-section legal-section-warning">
        <div class="legal-section-badge"><i class="fa-solid fa-circle-exclamation"></i> 1. Sin Comisión ni Intermediación</div>
        <p>Origgo <strong>no es una inmobiliaria ni cobra comisiones</strong>. No fijamos precios, no recibimos arras ni intervenimos en las promesas de compraventa. Negocias de tú a tú con el propietario.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-magnifying-glass"></i> 2. Revisa la propiedad antes de pagar</div>
        <p>Te aconsejamos visitar el inmueble en persona, conocer al propietario y solicitar un Certificado de Tradición y Libertad reciente en la oficina de registro antes de entregar dinero o firmar acuerdos.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-comments"></i> 3. Acuerdos entre Particulares</div>
        <p>Los anuncios se toman de publicaciones abiertas en internet. Cualquier acuerdo, precio o promesa de compraventa es responsabilidad mutua entre tú y el dueño del inmueble.</p>
      </div>
    `
  },
  privacidad: {
    titulo: 'Privacidad y Tus Datos',
    subtitulo: 'Protección de tu información según la Ley 1581 de 2012',
    badge: 'Tus Datos Seguros',
    icono: 'fa-solid fa-user-shield',
    html: `
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-lock"></i> 1. Cómo Usamos tu Teléfono y Correo</div>
        <p>Tu número de WhatsApp y correo solo se usan para entregarte tu código de acceso, guardar tus créditos y enviarte confirmación de compra. <strong>Cero venta de datos y cero spam</strong>.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-globe"></i> 2. Inmuebles Catalogados</div>
        <p>La información proviene de anuncios que los propietarios han compartido de manera pública y abierta en internet.</p>
      </div>
      <div class="legal-section legal-section-highlight">
        <div class="legal-section-badge"><i class="fa-brands fa-whatsapp"></i> 3. ¿Eres dueño y deseas retirar tu anuncio?</div>
        <p>Si eres el propietario de un inmueble aquí publicado y prefieres que no aparezca, escríbenos a nuestro WhatsApp de soporte y lo retiramos de inmediato sin ningún costo.</p>
      </div>
    `
  },
  reembolsos: {
    titulo: 'Garantía de Saldo y Respaldo',
    subtitulo: 'Tu dinero y tus créditos siempre protegidos',
    badge: 'Garantía de Saldo',
    icono: 'fa-solid fa-rotate-left',
    html: `
      <div class="legal-section legal-section-highlight">
        <div class="legal-section-badge"><i class="fa-solid fa-key"></i> 1. Tu Saldo Nunca se Pierde</div>
        <p>Si cambias de celular o borras el navegador, tus créditos siguen a salvo. Puedes recuperarlos en segundos desde <strong>"Restaurar Cuenta"</strong> con tu número de WhatsApp.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-bolt"></i> 2. Desbloqueo al Instante</div>
        <p>Cada vez que usas un crédito para ver el contacto de un propietario, la información se revela de inmediato en tu pantalla.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-brands fa-whatsapp"></i> 3. Soporte y Solución de Inconvenientes</div>
        <p>Si tuviste algún inconveniente con un pago en Wompi o una falla en el sistema, escríbenos directamente a nuestro WhatsApp de soporte y te repondremos tus créditos o daremos solución prioritaria.</p>
      </div>
    `
  }
};

let pestanaLegalActiva = 'terminos';

/**
 * Abre el modal legal institucional con la pestaña seleccionada.
 * @param {string} tabKey - 'terminos' | 'exoneracion' | 'privacidad'
 */
function abrirModalLegal(tabKey = 'terminos') {
  const modal = document.getElementById('modalLegalOverlay');
  if (!modal) return;

  pestanaLegalActiva = TEXTOS_LEGALES_ORIGGO[tabKey] ? tabKey : 'terminos';
  renderizarContenidoLegal(pestanaLegalActiva);

  modal.classList.add('active');
  modal.style.display = 'flex';
  modal.style.pointerEvents = 'auto';
  document.body.style.overflow = 'hidden';

  const tabButtons = modal.querySelectorAll('.legal-tab-btn');
  tabButtons.forEach(btn => {
    const isCurrent = btn.getAttribute('data-legal-tab') === pestanaLegalActiva;
    btn.classList.toggle('active', isCurrent);
    btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
  });
}

/**
 * Cierra el modal legal institucional.
 */
function cerrarModalLegal() {
  const modal = document.getElementById('modalLegalOverlay');
  if (!modal) return;

  modal.classList.remove('active');
  modal.style.pointerEvents = 'none';
  document.body.style.overflow = '';
  setTimeout(() => {
    if (!modal.classList.contains('active')) {
      modal.style.display = 'none';
    }
  }, 250);
}

/**
 * Renderiza el contenido y cabeceras de la pestaña seleccionada en el modal legal.
 * @param {string} tabKey
 */
function renderizarContenidoLegal(tabKey) {
  const data = TEXTOS_LEGALES_ORIGGO[tabKey] || TEXTOS_LEGALES_ORIGGO.terminos;
  const titleEl = document.getElementById('legalModalTitle');
  const subEl = document.getElementById('legalModalSubtitle');
  const tagEl = document.getElementById('legalHeaderTag');
  const boxEl = document.getElementById('legalContentBox');

  if (titleEl) titleEl.textContent = data.titulo;
  if (subEl) subEl.textContent = data.subtitulo;
  if (tagEl) tagEl.innerHTML = `<i class="${data.icono}"></i> ${data.badge}`;
  if (boxEl) {
    boxEl.innerHTML = data.html;
    boxEl.scrollTop = 0;
  }
}

/**
 * Inicializa todos los eventos táctiles y de clic para el modal legal.
 */
function inicializarModalLegal() {
  const modal = document.getElementById('modalLegalOverlay');
  const btnClose = document.getElementById('btnLegalCloseIcon');
  const btnAccept = document.getElementById('btnLegalCancel');
  const btnTerminosFooter = document.getElementById('btnOpenTerminos');
  const btnPrivacidadFooter = document.getElementById('btnOpenPrivacidad');
  const btnReembolsosFooter = document.getElementById('btnOpenReembolsos');

  if (btnClose) {
    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cerrarModalLegal();
    });
    btnClose.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cerrarModalLegal();
    }, { passive: false });
  }

  if (btnAccept) {
    btnAccept.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarModalLegal();
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cerrarModalLegal();
    });

    const tabBtns = modal.querySelectorAll('.legal-tab-btn');
    tabBtns.forEach(btn => {
      const cambiarTab = (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-legal-tab');
        if (tab && TEXTOS_LEGALES_ORIGGO[tab]) {
          pestanaLegalActiva = tab;
          tabBtns.forEach(b => {
            const isMatch = b === btn;
            b.classList.toggle('active', isMatch);
            b.setAttribute('aria-selected', isMatch ? 'true' : 'false');
          });
          renderizarContenidoLegal(tab);
        }
      };
      btn.addEventListener('click', cambiarTab);
    });
  }

  if (btnTerminosFooter) {
    btnTerminosFooter.addEventListener('click', (e) => {
      e.preventDefault();
      abrirModalLegal('terminos');
    });
  }

  if (btnPrivacidadFooter) {
    btnPrivacidadFooter.addEventListener('click', (e) => {
      e.preventDefault();
      abrirModalLegal('privacidad');
    });
  }

  if (btnReembolsosFooter) {
    btnReembolsosFooter.addEventListener('click', (e) => {
      e.preventDefault();
      abrirModalLegal('reembolsos');
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      cerrarModalLegal();
    }
  });
}

// Exposición global
window.abrirModalLegal = abrirModalLegal;
window.cerrarModalLegal = cerrarModalLegal;
window.inicializarModalLegal = inicializarModalLegal;
