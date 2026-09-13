/**
 * 💳 MÓDULO DE CHECKOUT Y PASARELA WOMPI (modules/08-checkout.js)
 * Modal de compra, selector de planes, orquestación del widget Wompi
 * y gestión de 3 pestañas de cuenta con perfil VIP enriquecido.
 * Estándar Ecosistema Desmulta Finanzas.
 */

let pagoWompiEnProgreso = false;

/**
 * Carga de forma asíncrona y segura el script oficial del widget de Wompi.
 */
function cargarScriptWompi() {
  if (document.getElementById("wompi-widget-script")) return;
  const script = document.createElement("script");
  script.id = "wompi-widget-script";
  script.src = "https://checkout.wompi.co/widget.js";
  script.async = true;
  script.onload = () => {
    wompiScriptCargado = true;
    registrarLogDesarrollo('log', "✅ Widget de Wompi cargado exitosamente.");
  };
  script.onerror = () => {
    registrarLogDesarrollo('warn', "⚠️ No se pudo cargar el script de Wompi de la CDN. Fallback comercial activo.");
  };
  document.head.appendChild(script);
}

/**
 * Cambia la pestaña activa del modal de checkout.
 * @param {'comprar'|'tengo-pin'|'perfil'|'mi-cuenta'} pestana
 */
function cambiarPestanaCheckout(pestana) {
  const tabMiCuenta = document.getElementById('tabBtnMiCuenta'), tabComprar = document.getElementById('tabBtnComprar'), tabPin = document.getElementById('tabBtnTengoPin');
  const panelComprar = document.getElementById('panelComprar'), panelPin = document.getElementById('panelTengoPin'), panelPerfil = document.getElementById('panelUsuarioActivo');
  const tabsBar = document.getElementById('checkoutTabsBar');

  [panelComprar, panelPin, panelPerfil, tabMiCuenta, tabComprar, tabPin].forEach(el => el?.classList.remove('active'));
  if (tabsBar) tabsBar.style.display = 'flex';

  if (pestana === 'comprar') {
    tabComprar?.classList.add('active'); panelComprar?.classList.add('active');
  } else if (pestana === 'tengo-pin') {
    tabPin?.classList.add('active'); panelPin?.classList.add('active');
  } else if (pestana === 'perfil' || pestana === 'mi-cuenta') {
    tabMiCuenta?.classList.add('active'); panelPerfil?.classList.add('active');
  }
}

/**
 * Abre el modal de checkout para comprar créditos, ver PIN o perfil.
 * @param {number|undefined} index - Índice del lead seleccionado si aplica
 * @param {string|null} pestana - Pestaña inicial
 */
function abrirModalCheckout(index, pestana = null) {
  if (!wompiScriptCargado) cargarScriptWompi();

  if (typeof index === 'number' && datosActuales?.leads && datosActuales.leads[index]) {
    const prevDesdeFicha = Boolean(leadSeleccionado?._desdeFicha);
    const prevFichaIdx = typeof leadSeleccionado?._fichaIndex === 'number' ? leadSeleccionado._fichaIndex : index;
    leadSeleccionado = { ...datosActuales.leads[index], _desdeFicha: prevDesdeFicha, _fichaIndex: prevFichaIdx };
  }

  const modal = document.getElementById("checkoutModal");
  const elSummary = document.getElementById("modalLeadSummary");
  const tabMiCuenta = document.getElementById('tabBtnMiCuenta');

  if (elSummary) {
    if (leadSeleccionado) {
      elSummary.style.display = 'block';
      const imgHtml = leadSeleccionado.imagen ? `
        <div class="modal-lead-thumb-wrap">
          <img src="${escaparHtml(leadSeleccionado.imagen)}" alt="${escaparHtml(leadSeleccionado.titulo)}" class="modal-lead-thumb" />
          <div class="modal-lead-thumb-gradient"></div>
        </div>
      ` : '';

      const lblProp = typeof t === 'function' ? t('modal_summary_property', 'Inmueble:') : 'Inmueble:';
      const lblLoc = typeof t === 'function' ? t('modal_summary_location', 'Ubicación:') : 'Ubicación:';
      const lblPrice = typeof t === 'function' ? t('modal_summary_price', 'Precio Publicado:') : 'Precio Publicado:';
      const lblUnit = typeof t === 'function' ? t('modal_summary_unit_value', 'Valor Unitario:') : 'Valor Unitario:';

      elSummary.innerHTML = `
        ${imgHtml}
        <div class="modal-summary-item">
          <span class="modal-summary-label">${lblProp}</span>
          <strong class="modal-summary-value">${escaparHtml(leadSeleccionado.titulo)}</strong>
        </div>
        <div class="modal-summary-item">
          <span class="modal-summary-label">${lblLoc}</span>
          <span class="modal-summary-label">${escaparHtml(leadSeleccionado.ubicacion)}</span>
        </div>
        <div class="modal-summary-item">
          <span class="modal-summary-label">${lblPrice}</span>
          <strong class="modal-summary-price">${escaparHtml(leadSeleccionado.precio)}</strong>
        </div>
        ${leadSeleccionado.precio_m2 ? `
          <div class="modal-summary-item modal-summary-divider">
            <span class="modal-summary-label">${lblUnit}</span>
            <strong class="modal-summary-value">${escaparHtml(leadSeleccionado.precio_m2)}</strong>
          </div>
        ` : ''}
      `;
    } else {
      elSummary.style.display = 'none';
    }
  }

  // Si el usuario ya tiene sesión activa
  if (sesionUsuario) {
    if (tabMiCuenta) tabMiCuenta.style.display = 'flex';

    const elPhone = document.getElementById('userActivePhone'), elPin = document.getElementById('userActivePin');
    const elCredits = document.getElementById('userActiveCredits'), elPlan = document.getElementById('userActivePlan');
    const elCount = document.getElementById('userActiveUnlockedCount'), inputWa = document.getElementById('checkoutWhatsappInput');
    const cardCredits = document.getElementById('userCreditsCard'), badgeWrap = document.getElementById('userMembershipBadgeWrap');
    const badgeEl = document.getElementById('userMembershipBadge'), labelCredits = document.getElementById('userCreditsLabel');
    const extraWrap = document.getElementById('userExtraCreditsWrap'), extraPill = document.getElementById('userExtraCreditsPill');
    const benefitsWrap = document.getElementById('userBenefitsToggleWrap'), benefitsList = document.getElementById('userBenefitsList');

    if (elPhone) elPhone.textContent = `+57 ${sesionUsuario.phone}`;
    if (elPin) elPin.textContent = sesionUsuario.pin ? `PIN: ${sesionUsuario.pin}` : 'PIN protegido';
    if (inputWa) inputWa.value = sesionUsuario.phone;

    const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
    if (sesionUsuario.plan === 'national') {
      if (cardCredits) cardCredits.classList.add('vip-mode');
      if (badgeWrap) badgeWrap.style.display = 'block';
      if (badgeEl) badgeEl.innerHTML = `<i class="fa-solid fa-crown"></i> ${isEn ? 'National VIP Pass' : 'Plan Nacional VIP'}`;
      if (labelCredits) labelCredits.textContent = isEn ? 'Coverage Status' : 'Estado de Cobertura';
      if (elCredits) elCredits.textContent = isEn ? 'Unlimited Colombia' : 'Colombia Ilimitada';
      if (elPlan) elPlan.textContent = isEn ? 'Full unrestricted access across all Colombian cities.' : 'Acceso total sin límites a todas las ciudades y categorías.';
      if (extraWrap && extraPill) {
        if (sesionUsuario.credits > 0) {
          extraWrap.style.display = 'block';
          extraPill.textContent = isEn ? `⚡ Vault: ${sesionUsuario.credits} Safe Credits (never expire)` : `⚡ Bóveda: ${sesionUsuario.credits} Créditos seguros (no vencen)`;
          extraPill.title = isEn ? 'Your credits are frozen and protected. They remain available when your pass ends.' : 'Tus créditos previos están protegidos y congelados. Si tu membresía finaliza, tus créditos seguirán disponibles para ti.';
        } else {
          extraWrap.style.display = 'none';
        }
      }
      if (benefitsWrap) benefitsWrap.style.display = 'block';
      if (benefitsList) {
        benefitsList.innerHTML = isEn
          ? `<li><i class="fa-solid fa-check"></i> Unlimited unlocks without spending vault credits.</li><li><i class="fa-solid fa-check"></i> 0% Broker commissions or fees.</li><li><i class="fa-solid fa-shield"></i> When 30 days end, your vault credits remain intact.</li>`
          : `<li><i class="fa-solid fa-check"></i> Desbloqueos ilimitados sin consumir tus créditos en bóveda.</li><li><i class="fa-solid fa-check"></i> 0% Comisión de corretaje inmobiliario.</li><li><i class="fa-solid fa-shield"></i> Al vencer los 30 días, tus créditos previos seguirán intactos.</li>`;
      }
    } else if (sesionUsuario.plan === 'city') {
      const cNom = sesionUsuario.planCity || 'Bogotá';
      const cNomSeguro = escaparHtml(cNom);
      if (cardCredits) cardCredits.classList.add('vip-mode');
      if (badgeWrap) badgeWrap.style.display = 'block';
      if (badgeEl) badgeEl.innerHTML = `<i class="fa-solid fa-crown"></i> ${isEn ? `Pro City Pass (${cNomSeguro})` : `Plan Pro Ciudad (${cNomSeguro})`}`;
      if (labelCredits) labelCredits.textContent = isEn ? 'Coverage Status' : 'Estado de Cobertura';
      if (elCredits) elCredits.textContent = isEn ? 'Unlimited Access' : 'Acceso Ilimitado';
      if (elPlan) elPlan.textContent = isEn ? `100% Direct owner unlocks in ${cNom} for 30 days.` : `Desbloqueo de propietarios al 100% en ${cNom} por 30 días.`;
      if (extraWrap && extraPill) {
        if (sesionUsuario.credits > 0) {
          extraWrap.style.display = 'block';
          extraPill.textContent = isEn ? `⚡ Vault: ${sesionUsuario.credits} Credits for other cities` : `⚡ Bóveda: ${sesionUsuario.credits} Créditos para otras ciudades`;
          extraPill.title = isEn ? 'Your contacts in ' + cNom + ' are unlimited. These credits are for outside cities.' : 'Tus contactos en ' + cNom + ' son ilimitados. Estos créditos se usan para desbloquear fuera de tu ciudad o al terminar tu plan.';
        } else {
          extraWrap.style.display = 'none';
        }
      }
      if (benefitsWrap) benefitsWrap.style.display = 'block';
      if (benefitsList) {
        benefitsList.innerHTML = isEn
          ? `<li><i class="fa-solid fa-check"></i> Direct owners without spending credits in ${cNomSeguro}.</li><li><i class="fa-solid fa-check"></i> 0% Real estate commission.</li><li><i class="fa-solid fa-shield"></i> Vault credits let you unlock in other cities.</li>`
          : `<li><i class="fa-solid fa-check"></i> Propietarios directos sin gasto de créditos en ${cNomSeguro}.</li><li><i class="fa-solid fa-check"></i> 0% Comisión de agencia e intermediarios.</li><li><i class="fa-solid fa-shield"></i> Tus créditos de bóveda te permiten desbloquear en otras ciudades.</li>`;
      }
    } else {
      if (cardCredits) cardCredits.classList.remove('vip-mode');
      if (badgeWrap) badgeWrap.style.display = 'none';
      if (labelCredits) labelCredits.textContent = isEn ? 'Available Balance' : 'Saldo Disponible';
      if (elCredits) elCredits.textContent = isEn ? `⚡ ${sesionUsuario.credits} Credits` : `⚡ ${sesionUsuario.credits} Créditos`;
      if (elPlan) elPlan.textContent = isEn ? 'Standard Plan: 1 credit = 1 direct owner for life.' : 'Plan Estándar: 1 crédito = 1 propietario directo de por vida.';
      if (extraWrap) extraWrap.style.display = 'none';
      if (benefitsWrap) benefitsWrap.style.display = 'none';
    }

    if (elCount) {
      const cant = (sesionUsuario.unlockedLeads || []).length;
      elCount.textContent = isEn
        ? `You have unlocked ${cant} direct ${cant === 1 ? 'property' : 'properties'}.`
        : `Has desbloqueado ${cant} ${cant === 1 ? 'propiedad' : 'propiedades'} directamente.`;
    }

    if (pestana === 'comprar') {
      cambiarPestanaCheckout('comprar');
    } else {
      cambiarPestanaCheckout('mi-cuenta');
    }
  } else {
    if (tabMiCuenta) tabMiCuenta.style.display = 'none';
    cambiarPestanaCheckout(pestana || 'comprar');
  }

  // Sincronizar visibilidad del selector de ciudad según la opción seleccionada
  const radioActivo = document.querySelector('input[name="checkoutProduct"]:checked');
  const groupCity = document.getElementById("groupCitySelect");
  if (groupCity) {
    groupCity.style.display = (radioActivo && radioActivo.value === 'subscription_city') ? 'block' : 'none';
  }

  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

/**
 * Cierra el modal de checkout.
 */
function cerrarModalCheckout() {
  document.getElementById("checkoutModal")?.classList.remove("active");
  document.body.style.overflow = "";
}

/**
 * Reconcilia la acreditación del pago con reintentos para mitigar latencias de pasarela.
 */
async function reclamarSesionPostPago(orderData, productType, ciudad) {
  const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  mostrarNotificacionToast(esIngles ? 'Confirming payment accreditation with your bank...' : 'Confirmando acreditación de pago con tu banco...', 'info', { title: esIngles ? 'Verifying balance' : 'Verificando saldo', duration: 4500 });
  const tokenGuardado = localStorage.getItem('hunter_pro_token') || sesionUsuario?.token || '';
  const headersClaim = { 'Content-Type': 'application/json' };
  if (tokenGuardado) headersClaim.Authorization = `Bearer ${tokenGuardado}`;

  for (let intento = 1; intento <= 3; intento++) {
    try {
      const claimRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: headersClaim,
        body: JSON.stringify({ action: 'claim_reference', reference: orderData.reference })
      });
      const claimText = await claimRes.text();
      let claimData = null;
      try { claimData = JSON.parse(claimText); } catch (_) {}

      if (claimRes.status === 202 && claimData?.requiresLogin) {
        mostrarNotificacionToast(claimData.message || (esIngles ? 'Payment credited. Sign in with your existing PIN.' : 'Pago acreditado. Inicia sesión con tu PIN existente.'), 'warning', { title: esIngles ? 'Account Protection' : 'Protección de cuenta', duration: 7000 });
        abrirModalCheckout(undefined, 'tengo-pin');
        return true;
      }

      if (claimRes.ok && claimData?.ok && claimData?.token) {
        localStorage.setItem('hunter_pro_token', claimData.token);
        if (typeof guardarCookieSegura === 'function') guardarCookieSegura('origgo_token', claimData.token, 30);
        localStorage.removeItem('origgo_pending_ref');
        const pinNuevo = claimData.user?.pin || null;
        sesionUsuario = { ...claimData.user, token: claimData.token };
        delete sesionUsuario.pin;
        if (claimData.user?.preferredLang && typeof cambiarIdioma === 'function' && typeof obtenerIdiomaActual === 'function' && claimData.user.preferredLang !== obtenerIdiomaActual()) {
          cambiarIdioma(claimData.user.preferredLang);
        }
        if (claimData.user?.preferredTheme && typeof aplicarTema === 'function' && typeof obtenerTemaActual === 'function' && claimData.user.preferredTheme !== obtenerTemaActual()) {
          aplicarTema(claimData.user.preferredTheme);
        }
        actualizarBadgeVip();
        sincronizarFiltroCiudadUsuario();
        renderizarInterfaz(datosActuales);

        const notif = typeof generarMensajeBienvenidaToast === 'function'
          ? generarMensajeBienvenidaToast(sesionUsuario, productType, ciudad)
          : { titulo: esIngles ? '🎉 Payment Successful!' : '🎉 ¡Pago Exitoso!', mensaje: esIngles ? 'Your access has been secured.' : 'Tu acceso quedó acreditado de forma segura.', tipo: 'success' };
        mostrarNotificacionToast(notif.mensaje, notif.tipo, { title: notif.titulo, duration: 6000 });

        if (typeof abrirModalBienvenidaVIP === 'function') {
          abrirModalBienvenidaVIP({ tipo: productType, ciudad }, { ...sesionUsuario, pin: pinNuevo });
        }
        if (leadSeleccionado) {
          const idxLead = typeof leadSeleccionado._fichaIndex === 'number' ? leadSeleccionado._fichaIndex : (datosActuales?.leads ? datosActuales.leads.findIndex(l => l.id === leadSeleccionado.id) : undefined);
          await ejecutarDesbloqueoLead(leadSeleccionado, idxLead);
        }
        return true;
      }

      if (claimRes.status === 403 && intento < 3) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
    } catch (errClaim) {
      registrarLogDesarrollo('warn', `[Claim Intento ${intento}] Error de red:`, errClaim);
      if (intento < 3) await new Promise(r => setTimeout(r, 1500));
    }
  }

  localStorage.setItem('origgo_pending_ref', orderData.reference);
  mostrarNotificacionToast(
    esIngles
      ? `Payment received (Ref: ${orderData.reference}). Your bank is finalizing processing. If not reflected, tap Restore Account.`
      : `Pago recibido (Ref: ${orderData.reference}). Tu banco está procesando la confirmación. Si no se refleja, pulsa Restaurar Cuenta.`,
    'warning',
    { title: esIngles ? 'Processing Confirmation' : 'Confirmación en proceso', duration: 9000 }
  );
  return false;
}

/**
 * Inicia la orden de pago y abre el widget oficial de Wompi con firma SHA256.
 */
async function ejecutarPagoWompi() {
  if (pagoWompiEnProgreso) return;

  const radio = document.querySelector('input[name="checkoutProduct"]:checked');
  const productType = radio ? radio.value : 'pack_10_leads';
  const inputWa = document.getElementById('checkoutWhatsappInput');
  const errorBox = document.getElementById('checkoutPhoneError');
  const inputWrapper = document.getElementById('checkoutInputWrapper');
  const whatsappRaw = inputWa ? inputWa.value.trim() : '';
  const celularLimpio = whatsappRaw.replace(/\D/g, '');
  const celular = celularLimpio.startsWith('57') && celularLimpio.length === 12 
    ? celularLimpio.substring(2) 
    : celularLimpio;

  if (!celular || celular.length < 10) {
    if (errorBox) {
      errorBox.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Por favor ingresa tu número de WhatsApp real (10 dígitos). Ejemplo: 300 123 4567';
      errorBox.classList.remove('is-hidden');
      errorBox.style.display = 'block';
    }
    if (inputWrapper) {
      inputWrapper.classList.add('input-error-shake');
      setTimeout(() => inputWrapper.classList.remove('input-error-shake'), 600);
    }
    if (inputWa) {
      inputWa.focus();
      inputWa.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  if (errorBox) {
    errorBox.classList.add('is-hidden');
    errorBox.style.display = 'none';
  }

  // Validación estricta de ciudad para Plan Pro Ciudad
  let ciudad = null;
  if (productType === 'subscription_city') {
    const selectCity = document.getElementById('checkoutCitySelect');
    const cityError = document.getElementById('checkoutCityError');
    ciudad = selectCity ? selectCity.value.trim() : '';
    if (!ciudad) {
      if (cityError) {
        cityError.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Por favor selecciona la ciudad de cobertura para tu membresía.';
        cityError.classList.remove('is-hidden');
        cityError.style.display = 'block';
      }
      if (selectCity) {
        selectCity.focus();
        selectCity.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    if (cityError) {
      cityError.classList.add('is-hidden');
      cityError.style.display = 'none';
    }
  }

  const btnPagar = document.getElementById('btnConfirmWompi');
  const textoOriginal = btnPagar ? btnPagar.innerHTML : '';
  let idempotencyKey = '';
  if (btnPagar) {
    btnPagar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando con pago seguro...';
    btnPagar.disabled = true;
  }

  try {
    pagoWompiEnProgreso = true;
    idempotencyKey = typeof generarUUIDv4 === 'function' ? generarUUIDv4() : (window.crypto?.randomUUID?.() || '');
    const headersOrden = {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    };
    if (sesionUsuario?.token) {
      headersOrden.Authorization = `Bearer ${sesionUsuario.token}`;
    }

    const res = await fetch('/api/payments/create-order', {
      method: 'POST',
      headers: headersOrden,
      body: JSON.stringify({ productType, celular, ciudad })
    });

    const orderData = await res.json();
    if (!res.ok || !orderData.ok) {
      throw new Error(orderData.error || 'No se pudo generar la orden de pago');
    }

    if (typeof WidgetCheckout === 'undefined') {
      await new Promise((resolve) => {
        const scriptId = 'wompi-widget-script';
        if (!document.getElementById(scriptId)) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.src = 'https://checkout.wompi.co/widget.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => resolve();
          document.body.appendChild(script);
        } else {
          const check = setInterval(() => {
            if (typeof WidgetCheckout !== 'undefined') {
              clearInterval(check);
              resolve();
            }
          }, 100);
          setTimeout(() => { clearInterval(check); resolve(); }, 3000);
        }
      });
    }

    if (typeof WidgetCheckout !== 'undefined') {
      const checkout = new WidgetCheckout({
        currency: 'COP',
        amountInCents: orderData.amountInCents,
        reference: orderData.reference,
        publicKey: orderData.publicKey,
        signature: {
          integrity: orderData.signature
        }
      });

      cerrarModalCheckout();

      checkout.open(async (result) => {
        const trx = result?.transaction;
        const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
        if (trx?.status === 'APPROVED') {
          await reclamarSesionPostPago(orderData, productType, ciudad);
        } else if (trx?.status === 'PENDING') {
          localStorage.setItem('origgo_pending_ref', orderData.reference);
          mostrarNotificacionToast(
            esIngles
              ? `Your payment (Ref: ${orderData.reference}) is pending validation by your bank. It will auto-credit once confirmed.`
              : `Tu pago (Ref: ${orderData.reference}) está en validación por tu banco. Se acreditará automáticamente al confirmarse.`,
            'info',
            { title: esIngles ? 'Payment in Validation' : 'Pago en Validación (PSE / Nequi)', duration: 8500 }
          );
        } else if (trx && (trx.status === 'DECLINED' || trx.status === 'ERROR')) {
          mostrarNotificacionToast(
            esIngles
              ? 'The transaction was declined by the financial institution. Please try another payment method.'
              : 'La transacción no fue aprobada por la entidad financiera. Intenta con otro medio de pago.',
            'error',
            { title: esIngles ? 'Payment Declined' : 'Pago Rechazado', duration: 7500 }
          );
        }
      });
      return;
    }

    // Fallback comercial si la CDN de Wompi estuviera inaccesible
    const msg = encodeURIComponent(`Hola Origgo, deseo activar ${orderData.productName} para el celular ${celular}. Ref: ${orderData.reference}`);
    const whatsappNum = window.PORTAL_CONFIG?.contacto?.whatsapp || '573001234567';
    window.open(`https://wa.me/${whatsappNum}?text=${msg}`, '_blank', 'noopener,noreferrer');
    cerrarModalCheckout();
  } catch (err) {
    registrarLogDesarrollo('error', '[Pago Wompi] Error:', err);
    const mensajeError = err?.message || (typeof err === 'string' ? err : 'Error al conectar con la pasarela de pagos.');
    if (errorBox) {
      errorBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escaparHtml(mensajeError)}`;
      errorBox.classList.remove('is-hidden'); errorBox.style.display = 'block';
    } else {
      mostrarNotificacionToast(`⚠️ ${mensajeError}`);
    }
  } finally {
    pagoWompiEnProgreso = false;
    if (btnPagar) { btnPagar.innerHTML = textoOriginal; btnPagar.disabled = false; }
  }
}

// Inicialización de Listeners Propios de Pestañas y Acordeón en Checkout
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("tabBtnMiCuenta")?.addEventListener("click", () => cambiarPestanaCheckout('mi-cuenta'));
  const btnToggle = document.getElementById("btnToggleUserBenefits"), acc = document.getElementById("userBenefitsAccordion");
  btnToggle?.addEventListener("click", () => {
    acc?.classList.toggle("active");
    const active = acc?.classList.contains("active"), isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
    btnToggle.innerHTML = active
      ? (isEn ? '<i class="fa-solid fa-chevron-up"></i> Hide Privileges' : '<i class="fa-solid fa-chevron-up"></i> Ocultar Privilegios')
      : (isEn ? '<i class="fa-solid fa-sparkles"></i> View Membership Privileges' : '<i class="fa-solid fa-sparkles"></i> Ver Privilegios de mi Membresía');
  });
});
