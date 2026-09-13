/**
 * 👑 MÓDULO DE ONBOARDING Y BIENVENIDA VIP (modules/11-welcome.js)
 * Despliegue de modal celebratorio de lujo, matriz de privilegios y credenciales.
 * Estándar Ecosistema Desmulta UI/UX.
 */

/**
 * Despliega el modal de bienvenida y onboarding de beneficios estilo Google One / Apple Gold.
 * @param {object} planInfo - { tipo, nombre, ciudad, creditos }
 * @param {object} usuario - Datos de sesión del usuario
 */
function abrirModalBienvenidaVIP(planInfo, usuario) {
  const modal = document.getElementById("modalWelcomeSuccess");
  if (!modal) return;

  const elPill = document.getElementById("welcomeBadgePill");
  const elTitle = document.getElementById("welcomeModalTitle");
  const elSubtitle = document.getElementById("welcomeModalSubtitle");
  const elPhone = document.getElementById("welcomeUserPhone");
  const elPin = document.getElementById("welcomeUserPin");
  const elCopyPin = document.getElementById("btnCopyPin");
  const elList = document.getElementById("welcomeBenefitsList");
  const elCtaText = document.getElementById("welcomeCtaText");

  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const planTipo = planInfo?.tipo || usuario?.plan || 'single';
  const ciudad = planInfo?.ciudad || usuario?.planCity || (isEn ? 'your city' : 'tu ciudad');
  const pin = usuario?.pin || '';
  const phone = usuario?.phone ? `+57 ${usuario.phone}` : '+57 ••••••••••';

  if (elPhone) elPhone.textContent = phone;
  if (elPin) {
    if (pin) {
      elPin.textContent = pin;
    } else {
      elPin.innerHTML = isEn
        ? '<span class="pin-pending">Check your email or use <em>Restore PIN</em></span>'
        : '<span class="pin-pending">Revisa tu correo o usa <em>Recuperar PIN</em></span>';
    }
  }
  if (elCopyPin) {
    elCopyPin.classList.toggle('is-hidden', !pin);
  }

  let itemsHtml = '';

  if (planTipo === 'subscription_national' || usuario?.plan === 'national') {
    if (elPill) elPill.innerHTML = `<i class="fa-solid fa-crown"></i> ${isEn ? 'NATIONAL VIP PASS' : 'MEMBRESÍA NACIONAL VIP'}`;
    if (elTitle) elTitle.textContent = isEn ? 'Welcome to the National Elite Tier!' : '¡Bienvenido al Nivel Élite Nacional!';
    if (elSubtitle) elSubtitle.textContent = isEn ? 'You have unrestricted access to all direct property owners across Colombia.' : 'Tienes acceso total y sin restricciones a todos los propietarios directos de Colombia.';
    itemsHtml = isEn ? `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Unlimited Unlocks Across Colombia</strong><span class="benefit-desc">Bogotá, Medellín, Cali, Caribbean Coast, Coffee Triangle and all regions for 30 days.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Price-Drop & Arbitrage Live Radar</strong><span class="benefit-desc">Instant detection of urgent off-market opportunities before they reach agencies.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">0% Brokerage Commission</strong><span class="benefit-desc">Direct negotiation with verified owners with zero intermediate markups.</span></div></div>
    ` : `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Desbloqueo Ilimitado en Toda Colombia</strong><span class="benefit-desc">Bogotá, Medellín, Cali, Costa, Eje Cafetero y todas las ciudades por 30 días.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Radar de Rebajas de Precio & Arbitraje</strong><span class="benefit-desc">Detección de oportunidades urgentes con alto potencial antes que salgan al mercado.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">0% Comisión de Intermediarios</strong><span class="benefit-desc">Negociación de tú a tú con dueños directos sin sobrecostos de inmobiliaria.</span></div></div>
    `;
  } else if (planTipo === 'subscription_city' || usuario?.plan === 'city') {
    const ciudadEscapada = typeof escaparHtml === 'function' ? escaparHtml(ciudad) : ciudad;
    const ciudadMayusculaEscapada = typeof escaparHtml === 'function' ? escaparHtml(String(ciudad || '').toUpperCase()) : String(ciudad || '').toUpperCase();
    if (elPill) elPill.innerHTML = `<i class="fa-solid fa-crown"></i> ${isEn ? 'PRO CITY PASS' : 'PLAN PRO CIUDAD'} — ${ciudadMayusculaEscapada}`;
    if (elTitle) elTitle.textContent = isEn ? `Welcome to the ${ciudad} Pro Pass!` : `¡Bienvenido al Plan Pro ${ciudad}!`;
    if (elSubtitle) elSubtitle.textContent = isEn ? `Your territorial pass is active. Unlock all direct contacts in ${ciudad} without spending credits.` : `Tu membresía territorial está activa. Desbloquea todos los contactos de ${ciudad} sin gastar créditos.`;
    itemsHtml = isEn ? `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">30-Day Unlimited Access in ${ciudadEscapada}</strong><span class="benefit-desc">All verified direct owners in ${ciudadEscapada} without using credits.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">0% Real Estate Commission</strong><span class="benefit-desc">Save millions by dealing directly with the verified owner.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Real-Time Priority Alerts</strong><span class="benefit-desc">Instant alerts of direct listings in your coverage zone.</span></div></div>
    ` : `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Acceso Ilimitado 30 Días en ${ciudadEscapada}</strong><span class="benefit-desc">Todos los propietarios directos verificados en ${ciudadEscapada} sin consumir créditos.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">0% Comisión de Inmobiliaria</strong><span class="benefit-desc">Ahorra millones tratando de forma directa con el propietario verificado.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Alertas Prioritarias en Tiempo Real</strong><span class="benefit-desc">Capturas instantáneas de inmuebles directos en tu área de cobertura.</span></div></div>
    `;
  } else if (planTipo === 'pack_10_leads' || (usuario?.credits >= 10)) {
    if (elPill) elPill.innerHTML = `<i class="fa-solid fa-star"></i> ${isEn ? '10 CONTACTS PRO PACK' : 'BOLSA PRO 10 CONTACTOS'}`;
    if (elTitle) elTitle.textContent = isEn ? '10 Contacts Pack Ready!' : '¡Bolsa de 10 Contactos Lista!';
    if (elSubtitle) elSubtitle.textContent = isEn ? 'You secured the bundle with a 30% discount. Your credits never expire.' : 'Has asegurado el paquete con 30% de descuento. Tus créditos nunca vencen.';
    itemsHtml = isEn ? `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">10 Direct Owner Unlocks</strong><span class="benefit-desc">Use them whenever you find an ideal property across Colombia.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Non-Expiring Credits</strong><span class="benefit-desc">Your credits remain sealed to your PIN for life.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Mobile & Desktop Portability</strong><span class="benefit-desc">Access from any device using your phone number and PIN.</span></div></div>
    ` : `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">10 Desbloqueos de Propietario Directo</strong><span class="benefit-desc">Úsalos cuando encuentres el inmueble ideal en cualquier ciudad.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Créditos Sin Caducidad</strong><span class="benefit-desc">Tus créditos permanecen sellados con tu PIN de por vida.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Portabilidad Total en Móvil y PC</strong><span class="benefit-desc">Accede desde cualquier dispositivo ingresando tu celular y PIN.</span></div></div>
    `;
  } else {
    if (elPill) elPill.innerHTML = `<i class="fa-solid fa-bolt"></i> ${isEn ? 'SINGLE DIRECT UNLOCK' : 'DESBLOQUEO INDIVIDUAL'}`;
    if (elTitle) elTitle.textContent = isEn ? 'Direct Contact Activated!' : '¡Contacto Directo Activado!';
    if (elSubtitle) elSubtitle.textContent = isEn ? 'Your credit has been safely sealed to contact the owner.' : 'Tu crédito ha sido sellado con éxito para contactar al propietario.';
    itemsHtml = isEn ? `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Guaranteed Direct Contact</strong><span class="benefit-desc">Verified direct phone and WhatsApp without agency fees.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Reusable Access PIN</strong><span class="benefit-desc">Your PIN allows you to restore your unlocked deals anytime.</span></div></div>
    ` : `
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">Contacto Directo Garantizado</strong><span class="benefit-desc">Teléfono y WhatsApp verificado del propietario sin intermediarios.</span></div></div>
      <div class="benefit-item"><div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div><div class="benefit-content"><strong class="benefit-title">PIN Reutilizable</strong><span class="benefit-desc">Tu PIN te permite recuperar tu historial en cualquier momento.</span></div></div>
    `;
  }

  if (elList) elList.innerHTML = itemsHtml;
  if (elCtaText) {
    elCtaText.textContent = leadSeleccionado
      ? (isEn ? 'View Property Phone Number' : 'Ver Teléfono de Mi Inmueble')
      : (isEn ? 'Explore Direct Opportunities' : 'Explorar Oportunidades Directas');
  }

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

/**
 * Cierra el modal de bienvenida y beneficios VIP.
 */
function cerrarModalBienvenidaVIP() {
  const modal = document.getElementById("modalWelcomeSuccess");
  if (modal) modal.classList.remove("active");
  document.body.style.overflow = "";
}

/**
 * Despliega el modal de bienvenida y onboarding universal de Origgo.
 */
function abrirModalOnboarding() {
  const modal = document.getElementById("modalOnboardingWelcome");
  if (!modal) return;
  if (typeof aplicarTraduccionesAlDOM === 'function') {
    aplicarTraduccionesAlDOM();
  }
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

/**
 * Cierra el modal de bienvenida y onboarding universal.
 */
function cerrarModalOnboarding() {
  const modal = document.getElementById("modalOnboardingWelcome");
  if (modal) modal.classList.remove("active");
  document.body.style.overflow = "";
  try { localStorage.setItem('origgo_onboarding_seen', '1'); } catch (e) {}
}

// Inicialización de Listeners de Bienvenida y Onboarding
document.addEventListener("DOMContentLoaded", () => {
  const btnCloseWelcome = document.getElementById("btnWelcomeCloseIcon");
  if (btnCloseWelcome) {
    btnCloseWelcome.addEventListener("click", cerrarModalBienvenidaVIP);
  }

  const btnCtaWelcome = document.getElementById("btnWelcomeCta");
  if (btnCtaWelcome) {
    btnCtaWelcome.addEventListener("click", () => {
      cerrarModalBienvenidaVIP();
      if (leadSeleccionado && typeof ejecutarDesbloqueoLead === 'function') {
        ejecutarDesbloqueoLead(leadSeleccionado);
      }
    });
  }

  const btnCopy = document.getElementById("btnCopyPin");
  if (btnCopy) {
    btnCopy.addEventListener("click", async () => {
      const pinCodeEl = document.getElementById("welcomeUserPin");
      const pin = pinCodeEl ? pinCodeEl.textContent.trim() : (sesionUsuario?.pin || '');
      if (pin && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(pin);
          btnCopy.classList.add("copied");
          btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!';
          setTimeout(() => {
            btnCopy.classList.remove("copied");
            btnCopy.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar';
          }, 2000);
        } catch (e) {
          registrarLogDesarrollo('warn', '[Clipboard] Error copiando PIN:', e);
        }
      }
    });
  }

  // Listeners para el Onboarding Universal
  const btnCloseOnboarding = document.getElementById("btnOnboardingClose");
  if (btnCloseOnboarding) {
    btnCloseOnboarding.addEventListener("click", cerrarModalOnboarding);
  }

  const btnCtaOnboarding = document.getElementById("btnOnboardingCta");
  if (btnCtaOnboarding) {
    btnCtaOnboarding.addEventListener("click", cerrarModalOnboarding);
  }

  const modalOnboarding = document.getElementById("modalOnboardingWelcome");
  if (modalOnboarding) {
    modalOnboarding.addEventListener("click", (e) => {
      if (e.target === modalOnboarding) cerrarModalOnboarding();
    });
  }

  const linkAbout = document.getElementById("sideMenuLinkAbout");
  if (linkAbout) {
    linkAbout.addEventListener("click", (e) => {
      e.preventDefault();
      const btnCloseMenu = document.getElementById('btnCloseSideMenu') || document.getElementById('btnCloseMenu');
      if (btnCloseMenu) btnCloseMenu.click();
      abrirModalOnboarding();
    });
  }

  // Despliegue automático y suave en la primera visita
  try {
    if (!localStorage.getItem('origgo_onboarding_seen')) {
      setTimeout(() => {
        if (!localStorage.getItem('origgo_onboarding_seen')) {
          abrirModalOnboarding();
        }
      }, 1300);
    }
  } catch (e) {}
});

if (typeof window !== 'undefined') {
  window.abrirModalBienvenidaVIP = abrirModalBienvenidaVIP;
  window.cerrarModalBienvenidaVIP = cerrarModalBienvenidaVIP;
  window.abrirModalOnboarding = abrirModalOnboarding;
  window.cerrarModalOnboarding = cerrarModalOnboarding;
}
