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
 * Textos legales estructurados para términos, disclaimer y habeas data.
 */
const TEXTOS_LEGALES_ORIGGO = {
  terminos: {
    titulo: 'Términos y Condiciones de Uso',
    subtitulo: 'Reglas de operación y acceso a la terminal tecnológica',
    badge: 'Contrato Digital',
    icono: 'fa-solid fa-file-contract',
    html: `
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-code"></i> 1. Naturaleza Tecnológica del Servicio</div>
        <p>Origgo es una plataforma informática SaaS especializada en el procesamiento, clasificación y normalización de información inmobiliaria pública disponible en la web abierta. El acceso a la terminal es personal e intransferible.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-key"></i> 2. Créditos y Desbloqueo Directo</div>
        <p>El sistema de créditos permite revelar datos de contacto (WhatsApp y enlaces directos) de propietarios que han publicado voluntariamente sus bienes. Los créditos adquiridos no tienen fecha de caducidad mientras la cuenta mantenga actividad.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-ban"></i> 3. Prohibición Estricta de Reventa y Scraping</div>
        <p>Queda prohibida la extracción masiva automatizada, el raspado web (scraping), la ingeniería inversa o la comercialización no autorizada de las bases de datos de Origgo, acarreando el bloqueo de la cuenta sin derecho a restitución.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-shield-check"></i> 4. Seguridad en Transacciones Wompi</div>
        <p>Los pagos se procesan de forma cifrada a través de la pasarela oficial Wompi (Vigilada Superfinanciera) bajo normativa internacional PCI-DSS Nivel 1. Origgo no almacena números de tarjeta de crédito ni credenciales bancarias.</p>
      </div>
    `
  },
  exoneracion: {
    titulo: 'Exoneración de Responsabilidad (Disclaimer)',
    subtitulo: 'Cláusula de inmunidad y debida diligencia del comprador',
    badge: 'Aviso Legal Vinculante',
    icono: 'fa-solid fa-shield-halved',
    html: `
      <div class="legal-section legal-section-warning">
        <div class="legal-section-badge"><i class="fa-solid fa-triangle-exclamation"></i> 1. Cero Intermediación y Cero Corretaje</div>
        <p>Origgo <strong>NO es una agencia inmobiliaria, entidad de corretaje, firma comisionista ni asesoría financiera o jurídica</strong>. No cobra comisión por transacción, no fija precios, no custodia arras ni participa en contratos de promesa de compraventa.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-scale-balanced"></i> 2. Debida Diligencia (Due Diligence) Obligatoria</div>
        <p>La verificación física, técnica, catastral, jurídica y tributaria del inmueble es <strong>responsabilidad exclusiva, indelegable y directa de las partes contratantes</strong>. Es deber del comprador solicitar el Certificado de Tradición y Libertad reciente ante la ORIP y realizar el estudio de títulos antes de cualquier desembolso.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-file-shield"></i> 3. Inmunidad ante Disputas Particulares</div>
        <p>Origgo no valida el estado material, gravámenes ni titularidad de los bienes catalogados, quedando formal y expresamente exonerado de cualquier daño económico o conflicto contractual entre particulares.</p>
      </div>
    `
  },
  privacidad: {
    titulo: 'Privacidad, Habeas Data & GDPR',
    subtitulo: 'Tratamiento de datos personales según Ley 1581 de 2012 y estándares internacionales',
    badge: 'Protección de Datos',
    icono: 'fa-solid fa-user-shield',
    html: `
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-gavel"></i> 1. Marco Regulatorio (Ley 1581 de 2012)</div>
        <p>En cumplimiento del régimen de protección de datos de Colombia, Origgo garantiza a los titulares el ejercicio pleno de sus derechos de consulta, actualización, rectificación y supresión de datos personales.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-globe"></i> 2. Inmuebles Catalogados (Fuentes Públicas)</div>
        <p>Los datos de contacto y descripciones provienen exclusivamente de publicaciones abiertas realizadas voluntariamente por los titulares en portales web inmobiliarios (Art. 10 lit. a, Ley 1581).</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-address-card"></i> 3. Datos de Compradores (WhatsApp y Correo)</div>
        <p>El teléfono y correo suministrados por el comprador se utilizan estrictamente para autenticación, entrega del PIN de seguridad, asignación de créditos y recibos de pago. <strong>Cero venta a terceros y cero spam</strong>.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-earth-americas"></i> 4. Cumplimiento Internacional y GDPR</div>
        <p>Para residentes en el exterior o en la Unión Europea (Reglamento UE 2016/679), se garantizan los derechos de acceso, rectificación, olvido, limitación y portabilidad escribiendo a <strong>contacto@origgo.online</strong>.</p>
      </div>
      <div class="legal-section legal-section-highlight">
        <div class="legal-section-badge"><i class="fa-solid fa-user-xmark"></i> 5. Desindexación Inmediata (Opt-Out)</div>
        <p>Si usted es propietario y no desea que su inmueble figure catalogado, solicite su <strong>supresión y desindexación inmediata y permanente</strong> sin costo por WhatsApp o al correo <strong>contacto@origgo.online</strong> (procesamiento en < 24h).</p>
      </div>
    `
  },
  reembolsos: {
    titulo: 'Garantía de Acceso y Política de Reembolso',
    subtitulo: 'Reglas de consumo digital, respaldo por PIN maestro y reversión de pago',
    badge: 'Garantía & Devoluciones',
    icono: 'fa-solid fa-rotate-left',
    html: `
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-bolt"></i> 1. Servicios Digitales de Consumo Inmediato</div>
        <p>Conforme al Art. 47 de la Ley 1480 de 2011 (Estatuto del Consumidor), se exceptúan del derecho de retracto los servicios ejecutados en el acto. Al desbloquear un contacto de propietario directo, el crédito se perfecciona y consume.</p>
      </div>
      <div class="legal-section legal-section-highlight">
        <div class="legal-section-badge"><i class="fa-solid fa-key"></i> 2. Garantía de Permanencia mediante PIN Maestro</div>
        <p>El saldo y membresías activas no se pierden por cambio de dispositivo o borrado de navegador. Su saldo está protegido y puede reactivarse en segundos desde la opción <strong>"Restaurar Cuenta"</strong> con su correo o celular.</p>
      </div>
      <div class="legal-section">
        <div class="legal-section-badge"><i class="fa-solid fa-arrows-rotate"></i> 3. Reversión de Pago por Falla Técnica</div>
        <p>Conforme al Art. 51 de la Ley 1480, ante cobros duplicados involuntarios en pasarela o fallas técnicas imputables a Origgo no resueltas en 72 horas, se procederá a la reposición de créditos o a la reversión íntegra del pago.</p>
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
