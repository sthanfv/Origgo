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

  // 2. Efecto Onda (Ripple) y Háptica Unificada
  const inyectarOndaRipple = (btn, e, esPesado = false) => {
    if (!btn) return;
    if (esPesado) hapticHeavy(); else hapticLight();
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const clientX = (e && typeof e.clientX === 'number' && e.clientX > 0) ? e.clientX : (rect.left + rect.width / 2);
    const clientY = (e && typeof e.clientY === 'number' && e.clientY > 0) ? e.clientY : (rect.top + rect.height / 2);
    const x = clientX - rect.left - size / 2;
    const y = clientY - rect.top - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple-span';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    btn.classList.add('btn-ripple');
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 450);
  };

  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-unlock-lead, .btn-wompi-pay, .slideup-cta-btn, .mobile-nav-btn, .btn-hero-cta, .btn-menu-pill');
    if (btn) inyectarOndaRipple(btn, e, btn.classList.contains('btn-wompi-pay'));
  });

  document.querySelectorAll('.mobile-nav-btn').forEach(navBtn => {
    navBtn.addEventListener('pointerdown', (e) => {
      inyectarOndaRipple(navBtn, e, navBtn.id === 'btnNavVip');
    }, { passive: true });
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

  const actualizarIconoBotonMenu = (estaAbierto) => {
    if (btnNavMenuBottom) {
      const span = btnNavMenuBottom.querySelector('span[data-i18n="nav_menu"]') || btnNavMenuBottom.querySelector(':scope > span');
      if (span) span.textContent = estaAbierto ? (typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en' ? 'Close' : 'Cerrar') : (typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en' ? 'Menu' : 'Menú');
      btnNavMenuBottom.classList.toggle('active', estaAbierto);
      btnNavMenuBottom.classList.toggle('is-active', estaAbierto);
      btnNavMenuBottom.setAttribute('aria-expanded', estaAbierto ? 'true' : 'false');
    }
    if (btnMenuTrigger) btnMenuTrigger.classList.toggle('is-active', estaAbierto);
  };

  const abrirSideMenu = () => {
    if (sideMenu && menuOverlay) {
      sideMenu.classList.add('active');
      menuOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      actualizarIconoBotonMenu(true);
    }
  };

  const cerrarSideMenu = () => {
    if (sideMenu && menuOverlay) {
      sideMenu.classList.remove('active');
      menuOverlay.classList.remove('active');
      document.body.style.overflow = '';
      actualizarIconoBotonMenu(false);
    }
  };

  if (btnNavMenuBottom) {
    btnNavMenuBottom.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      inyectarOndaRipple(btnNavMenuBottom, e);
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
      e.stopPropagation();
      if (sideMenu && sideMenu.classList.contains('active')) {
        cerrarSideMenu();
      } else {
        abrirSideMenu();
      }
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
        else if (typeof restablecerTodosLosFiltros === 'function') restablecerTodosLosFiltros();
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

// ══════════════════════════════════════════════════════════════
// VERSIÓN LEGAL VINCULANTE (Incrementar si se alteran cláusulas)
// ══════════════════════════════════════════════════════════════
const VERSION_LEGAL_VIGENTE = 'v1.0 (Septiembre 2026)';

/**
 * Textos claros y transparentes para usuarios y propietarios.
 */
const TEXTOS_LEGALES_ORIGGO = {
  terminos: {
    titulo: 'Términos y Condiciones de Uso',
    subtitulo: `Terminal de agregación de fuentes públicas — Versión ${VERSION_LEGAL_VIGENTE}`,
    badge: 'Terminal de Inteligencia y Agregación',
    icono: 'fa-solid fa-file-contract',
    html: `
      <div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-server"></i> 1. Naturaleza del Software: Terminal de Inteligencia y Agregación</div><p>Origgo es un software de monitoreo algorítmico, clasificación analítica y terminal de inteligencia de mercado en Colombia. <strong>Origgo no es una agencia inmobiliaria, ni corredores, comisionistas ni un repositorio exclusivo de inmuebles</strong>. No representamos a compradores ni vendedores, no custodiamos llaves, no fijamos precios ni intervenimos en visitas, arras o contratos de compraventa/arrendamiento. Nuestra función tecnológica consiste en estructurar datos públicos abiertos y conectar directamente a compradores con anunciantes para posibilitar el trato directo.</p></div>
      <div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-network-wired"></i> 2. Indexación de Fuentes Públicas y Ausencia de Exclusividad</div><p>Los datos, enlaces e información mostrados provienen de fuentes abiertas y públicas de libre acceso en internet, recopilados mediante algoritmos de indexación referencial. Origgo no reclama exclusividad, mandato comercial ni titularidad jurídica sobre los inmuebles ni sobre las imágenes públicas referenciadas.</p></div>
      <div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-bolt"></i> 3. Créditos de Consulta Analítica y Ejecución Instantánea</div><p>Cada crédito adquirido habilita la consulta analítica y visualización directa del contacto y canal verificado del anunciante. Conforme al Art. 47 numeral 1 de la Ley 1480 de 2011, al consultar un contacto el servicio digital se ejecuta de forma instantánea y definitiva.</p></div>
      <div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-lock"></i> 4. Precios Claros y Pasarela Oficial Wompi</div><p>Todos los precios están expresados en pesos colombianos (COP). Los pagos se procesan de forma cifrada a través de Wompi Bancolombia (entidad vigilada por la SFC), sin cargos ocultos ni renovaciones automáticas forzadas.</p></div>
    `
  },
  exoneracion: {
    titulo: 'Seguridad, Diligencia y Exoneración',
    subtitulo: `Recomendaciones esenciales — Versión ${VERSION_LEGAL_VIGENTE}`,
    badge: 'Diligencia Debida',
    icono: 'fa-solid fa-shield-halved',
    html: `
      <div class="legal-section legal-section-warning"><div class="legal-section-badge"><i class="fa-solid fa-circle-exclamation"></i> 1. Verificación Física y Tradición del Inmueble</div><p>Aconsejamos visitar siempre el inmueble en persona, constatar la identidad del vendedor y solicitar un <strong>Certificado de Tradición y Libertad reciente</strong> ante la Oficina de Registro (SNR) antes de entregar dineros o firmar acuerdos.</p></div>
      <div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-scale-balanced"></i> 2. Software Neutral y Acuerdos entre Particulares</div><p>Como software neutral de búsqueda e inteligencia, Origgo no responde por vicios ocultos, modificaciones unilaterales de precio, estado del predio o acuerdos privados celebrados entre las partes.</p></div>
      <div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-copyright"></i> 3. Marcas de Terceros y Propiedad Intelectual</div><p>Las marcas, nombres o signos distintivos que aparezcan incidentalmente en imágenes de fuentes públicas pertenecen a sus respectivos titulares. Origgo no tiene vinculación, alianza ni patrocinio con portales o competidores externos.</p></div>
      <div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-user-lock"></i> 4. Uso Prohibido y Protección Anti-Spam</div><p>El acceso es para uso personal o comercial legítimo de trato directo. Queda prohibida la extracción masiva automatizada (scraping), la reventa de datos y el envío de spam o acoso a los propietarios.</p></div>
    `
  },
  privacidad: {
    titulo: 'Política de Tratamiento de Datos Personales',
    subtitulo: `Régimen de Habeas Data (Ley 1581 de 2012) — Versión ${VERSION_LEGAL_VIGENTE}`,
    badge: 'Habeas Data (SIC)',
    icono: 'fa-solid fa-user-shield',
    html: `
      <div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-database"></i> 1. Finalidad Exclusiva del Tratamiento</div><p>Los datos suministrados (WhatsApp y correo) se recolectan únicamente para: <strong>(i)</strong> vincular y custodiar tus créditos, <strong>(ii)</strong> emitir comprobantes y enlaces de acceso seguro (Magic Link), y <strong>(iii)</strong> soporte técnico. <strong>Cero venta de datos y cero spam publicitario</strong>.</p></div>
      <div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-key"></i> 2. Cifrado Militar AES-256</div><p>Los teléfonos de propietarios se custodian cifrados mediante estándar AES-256-GCM. La navegación se encuentra protegida con HTTPS/TLS y cabeceras de seguridad OWASP.</p></div>
      <div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-id-card"></i> 3. Derechos del Titular (Habeas Data)</div><p>Conforme a la Ley 1581 de 2012, los titulares pueden solicitar la actualización o supresión de sus datos de contacto públicos directamente a través de los canales de autogestión de la plataforma o vía WhatsApp oficial.</p></div>
      <div class="legal-section legal-section-highlight"><div class="legal-section-badge"><i class="fa-solid fa-shield-cat"></i> 4. Desindexación Automatizada para Titulares</div><p>Origgo opera como motor de búsqueda e indexación tecnológica de fuentes públicas abiertas. Si un propietario ya vendió su inmueble o desea retirar su anuncio del índice, puede solicitar el retiro inmediato indicando la referencia del inmueble.</p></div>
    `
  },
  reembolsos: {
    titulo: 'Garantía de Saldo, Retracto y PQR',
    subtitulo: `Régimen Comercial y Tecnológico Colombiano — Versión ${VERSION_LEGAL_VIGENTE}`,
    badge: 'Garantía y Reversión',
    icono: 'fa-solid fa-rotate-left',
    html: `
      <div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-shield-halved"></i> 1. Tu Saldo Nunca se Pierde</div><p>Los créditos adquiridos no caducan. Si limpias el navegador o cambias de dispositivo, puedes recuperarlos en segundos desde <strong>"Restaurar Cuenta"</strong> con tu número de WhatsApp.</p></div>
      <div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-arrow-rotate-left"></i> 2. Derecho de Retracto y Reversión del Pago</div><p>Para paquetes con créditos sin consumir, puedes ejercer derecho de retracto dentro de los 5 días hábiles siguientes al pago (Art. 47 Ley 1480). Ante cobros duplicados o fallas técnicas, aplica reversión del pago conforme al Decreto 587 de 2016.</p></div>
      <div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-headset"></i> 3. Peticiones y Consultas (PQR)</div><p>Para consultas sobre transacciones de saldo o pagos Wompi, comunícate con la referencia de pago al canal oficial de WhatsApp de Origgo. Atención en días hábiles conforme al régimen comercial colombiano.</p></div>
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
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const repo = (isEn && window.TEXTOS_LEGALES_ORIGGO_EN) ? window.TEXTOS_LEGALES_ORIGGO_EN : TEXTOS_LEGALES_ORIGGO;
  const data = repo[tabKey] || repo.terminos || TEXTOS_LEGALES_ORIGGO.terminos;
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

  if (btnAccept) btnAccept.addEventListener('click', (e) => { e.preventDefault(); cerrarModalLegal(); });

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cerrarModalLegal();
    });

    const tabBtns = modal.querySelectorAll('.legal-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
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
      });
    });
  }

  if (btnTerminosFooter) btnTerminosFooter.addEventListener('click', (e) => { e.preventDefault(); abrirModalLegal('terminos'); });
  if (btnPrivacidadFooter) btnPrivacidadFooter.addEventListener('click', (e) => { e.preventDefault(); abrirModalLegal('privacidad'); });
  if (btnReembolsosFooter) btnReembolsosFooter.addEventListener('click', (e) => { e.preventDefault(); abrirModalLegal('reembolsos'); });

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
window.renderizarContenidoLegal = renderizarContenidoLegal;

function animarContador(e,t,n=1200){if(!e)return;let a=t!==undefined?t:parseInt(e.getAttribute("data-target")||"0",10),s=0,r=performance.now(),i=document.documentElement.lang||"es",o=n=>new Intl.NumberFormat(i==="es"?"es-CO":"en-US").format(n);function d(c){let l=Math.min((c-r)/n,1),m=Math.floor(s+(a-s)*(1-Math.pow(1-l,4)));e.textContent=o(m);l<1?window.requestAnimationFrame(d):(e.textContent=o(a))}window.requestAnimationFrame(d)}
function poblarEstadisticasHero(d){if(!d||!d.leads||!d.config)return;let t=document.getElementById("statLeadsTotal"),c=document.getElementById("statCiudades"),s=document.getElementById("statSectores"),f=document.getElementById("catalogFreshnessText"),h=document.getElementById("heroLiveStats");if(t)animarContador(t,d.leads.length);if(c)animarContador(c,new Set(d.leads.map(l=>l.ciudad)).size);if(s)animarContador(s,d.config.total_sectores_monitoreados);if(f&&d.config.actualizado_en){const m=d.config.actualizado_en.match(/(\d{1,2}:\d{2}\s*(?:[ap]\.?\s*m\.?)?)/i);const esEn=document.documentElement.lang==="en";f.textContent=(esEn?"Today ":"Hoy ")+(m?m[1].replace(/\s+/g," ").trim():d.config.actualizado_en);const p=f.closest(".catalog-freshness");if(p)p.setAttribute("title",(esEn?"Last sync: ":"Última sincronización: ")+d.config.actualizado_en);}if(h)h.style.animation="fadeInUp 0.8s ease forwards";}
window.animarContador = animarContador;
window.poblarEstadisticasHero = poblarEstadisticasHero;
