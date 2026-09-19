/**
 * 🎯 MÓDULO DE LISTENERS Y EVENTOS (modules/10-listeners.js)
 * Vinculación de eventos del DOM, atajos de teclado y orquestación de la UI.
 * Estándar Ecosistema Desmulta.
 */


// Exposición global para compatibilidad y testing
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
    omnibox.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.keyCode === 13) {
        clearTimeout(timeoutBusqueda);
        omnibox.blur();
        aplicarFiltrosOmnibox();
      }
    });
    omnibox.addEventListener("input", (e) => {
      clearTimeout(timeoutBusqueda);
      textoBusquedaActivo = e.target.value;
      if (btnSearchClear) btnSearchClear.classList.toggle("visible", textoBusquedaActivo.trim().length > 0);
      timeoutBusqueda = setTimeout(() => aplicarFiltrosOmnibox(), 300);
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
      } else if (action === "abrir-checkout" || action === "revelar-desbloqueado") {
        e.stopPropagation();
        manejarClicDesbloquear(idx, { desdeFicha: Boolean(e.target.closest('.card-slideup-overlay')) });
      } else if (action === "slideup-cta") {
        e.stopPropagation();
        manejarClicDesbloquear(idx, { desdeFicha: true });
      } else if (action === "contactar-whatsapp") {
        e.stopPropagation();
        manejarContactoWhatsapp(idx);
      }

      // 🛡️ Debounce y protección contra doble clic ciego en WhatsApp
      const waLink = e.target.closest('.btn-whatsapp-direct, a[href*="wa.me"]');
      if (waLink) {
        if (waLink.dataset.isRedirecting === 'true') { e.preventDefault(); e.stopPropagation(); return; }
        waLink.dataset.isRedirecting = 'true';
        waLink.classList.add('is-redirecting');
        setTimeout(() => { delete waLink.dataset.isRedirecting; waLink.classList.remove('is-redirecting'); }, 2500);
      }

      const contactLink = e.target.closest('a[href*="wa.me"], a[href^="tel:"]');
      if (contactLink) {
        const slideup = contactLink.closest('.card-slideup-overlay');
        const firstStep = slideup?.querySelector('.next-step-item:first-child');
        if (firstStep) firstStep.classList.add('completed');
      }
    });
  }

  // Desplazamiento suave al catálogo desde el botón hero y el pilar de 1er desbloqueo
  const scrollToCatalog = () => {
    const catalogHeader = document.getElementById("catalogHeaderRow");
    if (catalogHeader) catalogHeader.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const btnHeroCta = document.getElementById("btnHeroCta");
  if (btnHeroCta) btnHeroCta.addEventListener("click", scrollToCatalog);
  const btnTrustPillarCta = document.getElementById("btnTrustPillarCta");
  if (btnTrustPillarCta) btnTrustPillarCta.addEventListener("click", scrollToCatalog);

  // Navegación Inferior Nativa (Solo Móvil)
  const mobileNavBtns = document.querySelectorAll(".mobile-nav-btn");
  mobileNavBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const navType = btn.getAttribute("data-nav");
      if (navType === "menu") return; // El menú lateral tiene su propio ciclo de vida

      mobileNavBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      if (navType === "home") {
        if (typeof restablecerTodosLosFiltros === "function") restablecerTodosLosFiltros();
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
      if (typeof alternarDropdownFiltro === "function") {
        alternarDropdownFiltro(pillLocation, dropdownLocation);
      } else {
        const isOpen = dropdownLocation.classList.toggle("show");
        pillLocation.classList.toggle("open", isOpen);
        pillLocation.setAttribute("aria-expanded", String(isOpen));
      }
    });

    dropdownLocation.addEventListener("click", (e) => {
      const item = e.target.closest(".cmd-dropdown-item");
      if (!item) return;
      e.stopPropagation();
      const cityValue = item.getAttribute("data-city") || "";
      filtroCiudadActivo = cityValue;
      if (omnibox) omnibox.blur();
      if (document.activeElement?.blur) document.activeElement.blur();

      dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      const spanText = item.querySelector("span") ? item.querySelector("span").textContent : "Colombia (Todas)";
      if (labelLocation) labelLocation.textContent = spanText;

      const sideMenuSelect = document.getElementById("sideMenuCitySelect");
      const sideMenuBadge = document.getElementById("sideMenuCityBadge");
      if (sideMenuSelect) sideMenuSelect.value = cityValue;
      if (sideMenuBadge) sideMenuBadge.textContent = cityValue || "Todas";

      pillLocation.classList.toggle("active-filter", cityValue !== "");
      if (typeof cerrarTodosLosDropdownsFiltro === "function") {
        cerrarTodosLosDropdownsFiltro();
      } else {
        dropdownLocation.classList.remove("show");
        pillLocation.classList.remove("open");
        pillLocation.setAttribute("aria-expanded", "false");
      }
      aplicarFiltrosOmnibox();
    });
  }

  // Selector de Ciudad en el Menú Lateral Móvil (Off-Canvas)
  const sideMenuCitySelect = document.getElementById("sideMenuCitySelect");
  const sideMenuCityBadge = document.getElementById("sideMenuCityBadge");
  if (sideMenuCitySelect) {
    sideMenuCitySelect.addEventListener("change", (e) => {
      const cityVal = e.target.value || "";
      filtroCiudadActivo = cityVal;
      sideMenuCitySelect.blur();
      if (omnibox) omnibox.blur();
      if (sideMenuCityBadge) sideMenuCityBadge.textContent = cityVal || "Todas";
      if (labelLocation) labelLocation.textContent = cityVal ? (sideMenuCitySelect.options[sideMenuCitySelect.selectedIndex]?.text || cityVal) : "Todas las Ciudades";
      if (pillLocation) pillLocation.classList.toggle("active-filter", cityVal !== "");
      if (dropdownLocation) {
        dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(item => {
          item.classList.toggle("active", (item.getAttribute("data-city") || "") === cityVal);
        });
      }
      aplicarFiltrosOmnibox();

      const sideMenu = document.getElementById('sideMenu');
      const menuOverlay = document.getElementById('sideMenuOverlay') || document.getElementById('menuOverlay');
      if (sideMenu && menuOverlay) {
        sideMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }

      const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
      const nombreLimpio = cityVal ? cityVal : 'Colombia';
      mostrarNotificacionToast(esIngles ? `📍 Showing direct deals in ${nombreLimpio}` : `📍 Mostrando oportunidades en ${nombreLimpio}`, 'info');
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
  const groupCitySelect = document.getElementById("groupCitySelect"), groupEmailInput = document.getElementById("groupEmailInput");
  const btnPagar = document.getElementById("btnConfirmWompi");
  optionCards.forEach(card => {
    card.addEventListener("click", () => {
      optionCards.forEach(c => c.classList.remove("active-option"));
      card.classList.add("active-option");
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        const val = radio.value, isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
        if (groupCitySelect) groupCitySelect.style.display = (val === 'subscription_city') ? 'block' : 'none';
        if (groupEmailInput) groupEmailInput.style.display = (val === 'welcome_free') ? 'block' : 'none';
        if (btnPagar) {
          if (val === 'welcome_free') {
            btnPagar.innerHTML = `<i class="fa-solid fa-gift"></i> <span>${isEn ? 'Claim 1 Free Unlock ($0)' : 'Reclamar 1 Desbloqueo Gratis ($0)'}</span>`;
            btnPagar.className = 'btn-confirm-wompi btn-claim-freemium';
          } else {
            btnPagar.innerHTML = `<i class="fa-solid fa-lock"></i> <span>${isEn ? 'Proceed to Secure Checkout with Wompi' : 'Continuar al Pago Seguro con Wompi'}</span>`;
            btnPagar.className = 'btn-confirm-wompi';
          }
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

  // Botón Confirmar Pago Wompi / Reclamar Regalo
  if (btnPagar) btnPagar.addEventListener("click", ejecutarPagoWompi);

  // Sanitización y limpieza de error en tiempo real para inputs numéricos
  const inputWaReal = document.getElementById("checkoutWhatsappInput");
  if (inputWaReal) {
    inputWaReal.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
      const errBox = document.getElementById("checkoutPhoneError"), wrapper = document.getElementById("checkoutInputWrapper");
      if (errBox) errBox.style.display = "none";
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
      const area = document.getElementById("recoveryContentArea"), icon = document.getElementById("recoveryToggleIcon");
      if (area) {
        const visible = area.classList.contains("is-open") || area.style.display === "block";
        area.style.display = visible ? "none" : "block";
        area.classList.toggle("is-open", !visible);
        area.classList.toggle("is-hidden", visible);
        if (icon) icon.classList.toggle("is-open", !visible);
      }
    });
  }
  const btnExecRec = document.getElementById("btnExecuteAutoRecovery");
  if (btnExecRec) btnExecRec.addEventListener("click", recuperarPinConReferencia);
  const btnMagic = document.getElementById("btnSendMagicLink");
  if (btnMagic) btnMagic.addEventListener("click", solicitarMagicLinkPorCorreo);
  const btnLogout = document.getElementById("btnLogoutSession"), btnSideLogout = document.getElementById("sideMenuLogoutBtn");
  if (btnLogout) btnLogout.addEventListener("click", cerrarSesionUsuario);
  if (btnSideLogout) btnSideLogout.addEventListener("click", (e) => { e.preventDefault(); cerrarSesionUsuario(); document.getElementById('sideMenu')?.classList.remove('active'); document.getElementById('sideMenuOverlay')?.classList.remove('active'); document.body.style.overflow = ''; });
  const btnBuyMore = document.getElementById("btnBuyMoreFromProfile");
  if (btnBuyMore) btnBuyMore.addEventListener("click", () => cambiarPestanaCheckout('comprar'));

  // Botón VIP del Header y Chip Móvil
  const btnVipHeader = document.getElementById("btnVipHeader");
  if (btnVipHeader) {
    btnVipHeader.addEventListener("mouseenter", preCargarWompi, { once: true });
    btnVipHeader.addEventListener("touchstart", preCargarWompi, { once: true, passive: true });
    btnVipHeader.addEventListener("click", () => abrirModalCheckout());
  }
  const btnMobileStatusChip = document.getElementById("btnMobileStatusChip");
  if (btnMobileStatusChip) {
    btnMobileStatusChip.addEventListener("mouseenter", preCargarWompi, { once: true });
    btnMobileStatusChip.addEventListener("touchstart", preCargarWompi, { once: true, passive: true });
    btnMobileStatusChip.addEventListener("click", () => abrirModalCheckout());
  }

  // MODAL LEGAL Y POLÍTICAS (LEY 1581 / SIC)
  const bindLegal = (id, tab) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", (e) => { e.preventDefault(); if (typeof abrirModalLegal === 'function') abrirModalLegal(tab); });
  };
  bindLegal("btnOpenTerminos", "terminos");
  bindLegal("btnOpenPrivacidad", "privacidad");
  bindLegal("linkCheckoutTerms", "terminos");
  bindLegal("linkCheckoutPrivacy", "privacidad");

  // Conmutador Atómico y Persistencia de Modo Claro / Modo Oscuro AMOLED
  const btnTheme = document.getElementById("btnThemeToggle");
  const btnThemeMobile = document.getElementById("btnThemeToggleMobile");
  const temaInicial = document.documentElement.getAttribute("data-theme") || (function() {
    try { const local = localStorage.getItem("hunter_theme"); if (local) return local; } catch (e) {}
    return (typeof obtenerCookieSegura === 'function' ? obtenerCookieSegura('origgo_theme') : null) || "light";
  })();

  document.documentElement.setAttribute("data-theme", temaInicial);
  actualizarIconoTema(temaInicial);

  const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    if (typeof aplicarTema === 'function') {
      aplicarTema(newTheme);
    } else {
      ejecutarConTransicionSuave(() => {
        document.documentElement.setAttribute("data-theme", newTheme);
        actualizarIconoTema(newTheme);
      });
      try { localStorage.setItem("hunter_theme", newTheme); } catch (e) {}
    }
    if (typeof sincronizarPreferenciasEnServidor === 'function') sincronizarPreferenciasEnServidor(null, newTheme);
  };

  if (btnTheme) btnTheme.addEventListener("click", toggleTheme);
  if (btnThemeMobile) btnThemeMobile.addEventListener("click", toggleTheme);
  const sideMenuTheme = document.getElementById("sideMenuThemeToggle");
  if (sideMenuTheme) {
    sideMenuTheme.addEventListener("click", (e) => {
      e.preventDefault();
      toggleTheme();
    });
  }

  // Clic o toque en el logotipo principal: volver al inicio y restablecer catálogo
  const brandBadge = document.querySelector(".brand-badge");
  if (brandBadge) {
    const volverAlInicio = () => {
      brandBadge.classList.add("calibrating");
      setTimeout(() => brandBadge.classList.remove("calibrating"), 750);
      if (typeof restablecerTodosLosFiltros === "function") restablecerTodosLosFiltros();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    brandBadge.addEventListener("click", volverAlInicio);
    brandBadge.addEventListener("touchstart", volverAlInicio, { passive: true });
  }

  // Soporte de accesibilidad: Cerrar modal o ficha técnica con la tecla Escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cerrarModalCheckout();
      document.querySelectorAll(".card-slideup-overlay.active").forEach((overlay) => overlay.classList.remove("active"));
    }
  });

  if (typeof inicializarBarraOrdenamiento === 'function') inicializarBarraOrdenamiento();
  if (typeof inicializarFiltroHoy === 'function') inicializarFiltroHoy();
  if (typeof inicializarProteccionAntiImpresion === 'function') inicializarProteccionAntiImpresion();
  if (typeof inicializarPerroGuardian === 'function') inicializarPerroGuardian();
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
    registrarLogDesarrollo('warn', "[Sesión] Fallo en verificación de segundo plano:", err.message);
  });

  // 5. Registro de Service Worker para capacidades PWA
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").then(r => r.update().catch(() => {})).catch(err => registrarLogDesarrollo('warn', "[PWA] Error registrando Service Worker:", err));
    });
  }

  // 6. Sincronizar dinámicamente enlaces de contacto con el WhatsApp de config.js
  const waConfig = window.PORTAL_CONFIG?.contacto?.whatsapp;
  if (waConfig) {
    document.querySelectorAll('a[href*="wa.me/"]').forEach(a => { a.href = a.href.replace(/wa\.me\/\d+/, `wa.me/${waConfig}`); });
  }
});
