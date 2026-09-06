/**
 * 🎯 MÓDULO DE LISTENERS Y EVENTOS (modules/10-listeners.js)
 * Vinculación de eventos del DOM, atajos de teclado y orquestación de la UI.
 * Estándar Ecosistema Desmulta.
 */


// ═════════════════════════════════════════════════════════════════════════
// 🌐 EXPOSICIÓN GLOBAL PARA COMPATIBILIDAD Y TESTING
// ═════════════════════════════════════════════════════════════════════════
window.moverCarrusel = moverCarrusel;
window.irACarrusel = irACarrusel;
window.abrirFichaTecnica = abrirFichaTecnica;
window.cerrarFichaTecnica = cerrarFichaTecnica;
window.abrirModalCheckout = abrirModalCheckout;
window.aplicarFiltrosOmnibox = aplicarFiltrosOmnibox;


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
        manejarClicDesbloquear(idx);
      } else if (action === "slideup-cta") {
        e.stopPropagation();
        cerrarFichaTecnica(idx, e);
        manejarClicDesbloquear(idx);
      } else if (action === "contactar-whatsapp") {
        e.stopPropagation();
        manejarContactoWhatsapp(idx);
      }
    });
  }

  // Desplazamiento suave al catálogo desde el botón principal del hero
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
      const navType = btn.getAttribute("data-nav");
      if (navType === "menu") return; // El menú lateral tiene su propio ciclo de vida

      mobileNavBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      if (navType === "home") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (navType === "search") {
        const omnibox = document.getElementById("omniboxSearch");
        if (omnibox) {
          omnibox.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => omnibox.focus(), 350);
        }
      } else if (navType === "vip") {
        abrirModalCheckout();
      }
    });
  });

  // Precarga bajo demanda de Wompi al acercar el cursor o iniciar toque en botones VIP
  const preCargarWompi = () => { if (!wompiScriptCargado) cargarScriptWompi(); };
  const elBtnNavVip = document.getElementById("btnNavVip");
  if (elBtnNavVip) {
    elBtnNavVip.addEventListener("mouseenter", preCargarWompi, { once: true });
    elBtnNavVip.addEventListener("touchstart", preCargarWompi, { once: true, passive: true });
  }

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

    dropdownLocation.addEventListener("click", (e) => {
      const item = e.target.closest(".cmd-dropdown-item");
      if (!item) return;
      e.stopPropagation();
      const cityValue = item.getAttribute("data-city") || "";
      filtroCiudadActivo = cityValue;

      dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      const spanText = item.querySelector("span") ? item.querySelector("span").textContent : "Colombia (Todas)";
      if (labelLocation) labelLocation.textContent = spanText;

      // Sincronizar con el selector del menú móvil si existe
      const sideMenuSelect = document.getElementById("sideMenuCitySelect");
      const sideMenuBadge = document.getElementById("sideMenuCityBadge");
      if (sideMenuSelect) sideMenuSelect.value = cityValue;
      if (sideMenuBadge) sideMenuBadge.textContent = cityValue || "Todas";

      pillLocation.classList.toggle("active-filter", cityValue !== "");
      dropdownLocation.classList.remove("show");
      pillLocation.classList.remove("open");
      pillLocation.setAttribute("aria-expanded", "false");

      aplicarFiltrosOmnibox();
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

  // Selector de Ciudad en el Menú Lateral Móvil (Off-Canvas)
  const sideMenuCitySelect = document.getElementById("sideMenuCitySelect");
  const sideMenuCityBadge = document.getElementById("sideMenuCityBadge");
  if (sideMenuCitySelect) {
    sideMenuCitySelect.addEventListener("change", (e) => {
      const cityVal = e.target.value || "";
      filtroCiudadActivo = cityVal;

      if (sideMenuCityBadge) {
        sideMenuCityBadge.textContent = cityVal || "Todas";
      }

      // Sincronizar con la barra superior de comandos
      if (labelLocation) {
        labelLocation.textContent = cityVal ? (sideMenuCitySelect.options[sideMenuCitySelect.selectedIndex]?.text || cityVal) : "Todas las Ciudades";
      }
      if (pillLocation) {
        pillLocation.classList.toggle("active-filter", cityVal !== "");
      }
      if (dropdownLocation) {
        dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(item => {
          const itemCity = item.getAttribute("data-city") || "";
          item.classList.toggle("active", itemCity === cityVal);
        });
      }

      aplicarFiltrosOmnibox();

      // Cerrar el menú lateral para mostrar de inmediato la grilla filtrada
      const sideMenu = document.getElementById('sideMenu');
      const menuOverlay = document.getElementById('sideMenuOverlay') || document.getElementById('menuOverlay');
      if (sideMenu && menuOverlay) {
        sideMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }

      const nombreLimpio = cityVal ? cityVal : 'Colombia';
      mostrarNotificacionToast(`📍 Mostrando oportunidades en ${nombreLimpio}`, 'info');
    });
  }

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

  // Cierre de Modal de Checkout
  const btnCloseModal = document.getElementById("btnCloseCheckoutModal") || document.getElementById("btnModalClose");
  if (btnCloseModal) btnCloseModal.addEventListener("click", cerrarModalCheckout);

  const btnCancelModal = document.getElementById("btnModalCancel");
  if (btnCancelModal) btnCancelModal.addEventListener("click", cerrarModalCheckout);

  const modalCheckout = document.getElementById("checkoutModal");
  if (modalCheckout) {
    modalCheckout.addEventListener("click", (e) => {
      if (e.target === modalCheckout) cerrarModalCheckout();
    });
  }

  // Conmutación de Pestañas en el Modal de Checkout
  const tabComprar = document.getElementById("tabBtnComprar");
  if (tabComprar) {
    tabComprar.addEventListener("click", () => cambiarPestanaCheckout('comprar'));
  }

  const tabTengoPin = document.getElementById("tabBtnTengoPin");
  if (tabTengoPin) {
    tabTengoPin.addEventListener("click", () => cambiarPestanaCheckout('tengo-pin'));
  }

  // Selección visual de tarjetas de producto en el modal
  const optionCards = document.querySelectorAll(".pricing-option-card");
  const groupCitySelect = document.getElementById("groupCitySelect");
  optionCards.forEach(card => {
    card.addEventListener("click", () => {
      optionCards.forEach(c => c.classList.remove("active-option"));
      card.classList.add("active-option");
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        if (groupCitySelect) {
          groupCitySelect.style.display = (radio.value === 'subscription_city') ? 'block' : 'none';
        }
      }
    });
  });

  // Limpieza de error en selector de ciudad al elegir opción
  const selectCityInput = document.getElementById("checkoutCitySelect");
  if (selectCityInput) {
    selectCityInput.addEventListener("change", () => {
      const cityErr = document.getElementById("checkoutCityError");
      if (cityErr) cityErr.style.display = "none";
    });
  }

  // Botón Confirmar Pago Wompi
  const btnPagar = document.getElementById("btnConfirmWompi");
  if (btnPagar) {
    btnPagar.addEventListener("click", ejecutarPagoWompi);
  }

  // Sanitización y limpieza de error en tiempo real para inputs numéricos
  const inputWaReal = document.getElementById("checkoutWhatsappInput");
  if (inputWaReal) {
    inputWaReal.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
      const errBox = document.getElementById("checkoutPhoneError");
      if (errBox) errBox.style.display = "none";
      const wrapper = document.getElementById("checkoutInputWrapper");
      if (wrapper) wrapper.classList.remove("input-error-shake");
    });
  }
  const inputRestoreWa = document.getElementById("restoreWhatsappInput");
  if (inputRestoreWa) inputRestoreWa.addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
  const inputRestorePin = document.getElementById("restorePinInput");
  if (inputRestorePin) inputRestorePin.addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''); });

  // Botón Restaurar Sesión por PIN
  const btnRestore = document.getElementById("btnRestoreSession");
  if (btnRestore) btnRestore.addEventListener("click", restaurarSesionConPin);

  // Autoservicio: Recuperación Automática por Referencia de Pago Wompi
  const btnToggleRec = document.getElementById("btnToggleAutoRecovery");
  if (btnToggleRec) {
    btnToggleRec.addEventListener("click", () => {
      const area = document.getElementById("recoveryContentArea");
      const icon = document.getElementById("recoveryToggleIcon");
      if (area) {
        const visible = area.style.display !== "none";
        area.style.display = visible ? "none" : "block";
        if (icon) icon.style.transform = visible ? "rotate(0deg)" : "rotate(180deg)";
      }
    });
  }
  const btnExecRec = document.getElementById("btnExecuteAutoRecovery");
  if (btnExecRec) btnExecRec.addEventListener("click", recuperarPinConReferencia);
  const btnLogout = document.getElementById("btnLogoutSession");
  if (btnLogout) btnLogout.addEventListener("click", cerrarSesionUsuario);
  const btnBuyMore = document.getElementById("btnBuyMoreFromProfile");
  if (btnBuyMore) btnBuyMore.addEventListener("click", () => cambiarPestanaCheckout('comprar'));

  // Botón VIP del Header
  const btnVipHeader = document.getElementById("btnVipHeader");
  if (btnVipHeader) {
    btnVipHeader.addEventListener("mouseenter", preCargarWompi, { once: true });
    btnVipHeader.addEventListener("touchstart", preCargarWompi, { once: true, passive: true });
    btnVipHeader.addEventListener("click", () => abrirModalCheckout());
  }

  // MODAL LEGAL Y POLÍTICAS (LEY 1581)
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
      html: "<p><strong>1. Naturaleza del Servicio y Cero Intermediación</strong><br>Origgo es una herramienta de software que indexa y clasifica información de ofertas publicadas abiertamente en internet. Origgo NO es una agencia inmobiliaria, concesionario, entidad de corretaje, ni actúa como asesor financiero o legal. No cobramos comisiones ni participamos en acuerdos comerciales o pagos.</p><p><strong>2. Exoneración Total de Responsabilidad</strong><br>Origgo no valida, certifica ni garantiza la veracidad, exactitud, vigencia, titularidad real, legalidad o estado físico o mecánico de los bienes listados. La negociación, desembolsos, revisión de títulos de propiedad, tradición, gravámenes o contratos es responsabilidad exclusiva, directa e indelegable del usuario y las partes interesadas. Origgo queda expresamente eximido de cualquier daño, pérdida económica o disputa derivada de transacciones entre particulares.</p><p><strong>3. Cláusula Anti-Scraping Estricta</strong><br>Se prohíbe terminantemente la extracción automatizada, raspado web o minería de datos mediante bots, spiders o herramientas informáticas. La infracción facultará la revocación inmediata del acceso y las acciones judiciales pertinentes.</p>"
    },
    privacidad: {
      titulo: "Política de Privacidad y Tratamiento de Datos (Ley 1581)",
      html: "<p><strong>1. Cumplimiento Normativo (Ley 1581 de 2012)</strong><br>En cumplimiento del régimen de protección de datos personales de Colombia, Origgo garantiza los derechos de consulta, actualización y supresión de datos a los titulares.</p><p><strong>2. Origen Público de la Información y Desindexación</strong><br>Los números de contacto y datos de bienes corresponden a información divulgada voluntariamente por sus anunciantes en plataformas públicas. Nuestro software opera únicamente como motor indexador. Si usted es el titular de un inmueble o vehículo y desea desindexar su contacto o publicación de la terminal, puede solicitar la supresión inmediata a través de nuestro canal de soporte.</p><p><strong>3. Acceso Restringido</strong><br>Los datos de contacto se suministran exclusivamente a usuarios registrados bajo verificación para evitar usos indebidos o masivos.</p>"
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
      setTimeout(() => { modalLegal.style.display = "none"; }, 300);
    }
  }

  if (btnTerminos) btnTerminos.addEventListener("click", () => abrirModalLegal('terminos'));
  if (btnPrivacidad) btnPrivacidad.addEventListener("click", () => abrirModalLegal('privacidad'));
  if (btnCloseLegal) btnCloseLegal.addEventListener("click", cerrarModalLegal);
  if (btnCancelLegal) btnCancelLegal.addEventListener("click", cerrarModalLegal);
  if (modalLegal) modalLegal.addEventListener("click", (e) => { if (e.target === modalLegal) cerrarModalLegal(); });

  // Conmutador Atómico y Persistencia de Modo Claro / Modo Oscuro AMOLED
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

    // Congelar transiciones durante el cambio para actualización atómica instantánea de golpe
    const noAnim = document.createElement("style");
    noAnim.textContent = "*, *::before, *::after { transition: none !important; }";
    document.head.appendChild(noAnim);

    document.documentElement.setAttribute("data-theme", newTheme);
    try { localStorage.setItem("hunter_theme", newTheme); } catch (e) { /* ignore */ }
    actualizarIconoTema(newTheme);

    // Rehabilitar transiciones en el siguiente frame de renderizado
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (noAnim.parentNode) noAnim.parentNode.removeChild(noAnim);
      });
    });
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

// ═════════════════════════════════════════════════════════════════════════
// 🚀 ARRANQUE DE LA APLICACIÓN AL CARGAR EL DOM (NON-BLOCKING STARTUP)
// ═════════════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  // 1. Inmediato (0ms): Registrar todos los event listeners de la interfaz
  configurarListeners();

  // 2. Inmediato (0ms): Activar micro-interacciones (Ripple, Parallax GPU, Háptica)
  inicializarEfectosPremium();

  // 3. Inmediato (0ms): Cargar catálogo inmobiliario sin esperar la red externa
  cargarDatos("./data/inmobiliario.json");

  // 4. Segundo plano asíncrono: Revalidar sesión persistente (JWT / PIN / Wompi)
  inicializarSesionUsuario().catch((err) => {
    console.warn("[Sesión] Fallo en verificación de segundo plano:", err.message);
  });

  // 5. Registro de Service Worker para capacidades PWA
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("[PWA] Error registrando Service Worker:", err);
      });
    });
  }
});
