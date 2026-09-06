/**
 * 💳 MÓDULO DE CHECKOUT Y PASARELA WOMPI (modules/08-checkout.js)
 * Modal de compra, selector de planes, orquestación del widget Wompi
 * y gestión de 3 pestañas de cuenta con perfil VIP enriquecido.
 * Estándar Ecosistema Desmulta Finanzas.
 */

let pagoWompiEnProgreso = false;

function generarIdempotencyKeyPago() {
  const cryptoObj = window.crypto || window.msCrypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Tu navegador no permite crear una orden segura. Actualiza el navegador e intenta de nuevo.');
  }

  const bytes = new Uint8Array(16);
  cryptoObj.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
  const tabMiCuenta = document.getElementById('tabBtnMiCuenta');
  const tabComprar = document.getElementById('tabBtnComprar');
  const tabPin = document.getElementById('tabBtnTengoPin');
  const panelComprar = document.getElementById('panelComprar');
  const panelPin = document.getElementById('panelTengoPin');
  const panelPerfil = document.getElementById('panelUsuarioActivo');
  const tabsBar = document.getElementById('checkoutTabsBar');

  if (panelComprar) panelComprar.classList.remove('active');
  if (panelPin) panelPin.classList.remove('active');
  if (panelPerfil) panelPerfil.classList.remove('active');
  if (tabMiCuenta) tabMiCuenta.classList.remove('active');
  if (tabComprar) tabComprar.classList.remove('active');
  if (tabPin) tabPin.classList.remove('active');
  if (tabsBar) tabsBar.style.display = 'flex';

  if (pestana === 'comprar') {
    if (tabComprar) tabComprar.classList.add('active');
    if (panelComprar) panelComprar.classList.add('active');
  } else if (pestana === 'tengo-pin') {
    if (tabPin) tabPin.classList.add('active');
    if (panelPin) panelPin.classList.add('active');
  } else if (pestana === 'perfil' || pestana === 'mi-cuenta') {
    if (tabMiCuenta) tabMiCuenta.classList.add('active');
    if (panelPerfil) panelPerfil.classList.add('active');
  }
}

/**
 * Abre el modal de checkout para comprar créditos, ver PIN o perfil.
 * @param {number|undefined} index - Índice del lead seleccionado si aplica
 * @param {string|null} pestana - Pestaña inicial
 */
function abrirModalCheckout(index, pestana = null) {
  if (!wompiScriptCargado) {
    cargarScriptWompi();
  }

  if (typeof index === 'number' && datosActuales?.leads && datosActuales.leads[index]) {
    leadSeleccionado = datosActuales.leads[index];
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

      elSummary.innerHTML = `
        ${imgHtml}
        <div class="modal-summary-item">
          <span class="modal-summary-label">Inmueble:</span>
          <strong class="modal-summary-value">${escaparHtml(leadSeleccionado.titulo)}</strong>
        </div>
        <div class="modal-summary-item">
          <span class="modal-summary-label">Ubicación:</span>
          <span class="modal-summary-label">${escaparHtml(leadSeleccionado.ubicacion)}</span>
        </div>
        <div class="modal-summary-item">
          <span class="modal-summary-label">Precio Publicado:</span>
          <strong class="modal-summary-price">${escaparHtml(leadSeleccionado.precio)}</strong>
        </div>
        ${leadSeleccionado.precio_m2 ? `
          <div class="modal-summary-item modal-summary-divider">
            <span class="modal-summary-label">Valor Unitario:</span>
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

    const elPhone = document.getElementById('userActivePhone');
    const elPin = document.getElementById('userActivePin');
    const elCredits = document.getElementById('userActiveCredits');
    const elPlan = document.getElementById('userActivePlan');
    const elCount = document.getElementById('userActiveUnlockedCount');
    const inputWa = document.getElementById('checkoutWhatsappInput');
    const cardCredits = document.getElementById('userCreditsCard');
    const badgeWrap = document.getElementById('userMembershipBadgeWrap');
    const badgeEl = document.getElementById('userMembershipBadge');
    const labelCredits = document.getElementById('userCreditsLabel');
    const extraWrap = document.getElementById('userExtraCreditsWrap');
    const extraPill = document.getElementById('userExtraCreditsPill');
    const benefitsWrap = document.getElementById('userBenefitsToggleWrap');
    const benefitsList = document.getElementById('userBenefitsList');

    if (elPhone) elPhone.textContent = `+57 ${sesionUsuario.phone}`;
    if (elPin) elPin.textContent = sesionUsuario.pin ? `PIN: ${sesionUsuario.pin}` : 'PIN protegido';
    if (inputWa) inputWa.value = sesionUsuario.phone;

    if (sesionUsuario.plan === 'national') {
      if (cardCredits) cardCredits.classList.add('vip-mode');
      if (badgeWrap) badgeWrap.style.display = 'block';
      if (badgeEl) badgeEl.innerHTML = '<i class="fa-solid fa-crown"></i> Plan Nacional VIP';
      if (labelCredits) labelCredits.textContent = 'Estado de Cobertura';
      if (elCredits) elCredits.textContent = 'Colombia Ilimitada';
      if (elPlan) elPlan.textContent = 'Acceso total sin límites a todas las ciudades y categorías.';
      if (extraWrap && extraPill) {
        if (sesionUsuario.credits > 0) {
          extraWrap.style.display = 'block';
          extraPill.textContent = `⚡ +${sesionUsuario.credits} Créditos acumulados`;
        } else {
          extraWrap.style.display = 'none';
        }
      }
      if (benefitsWrap) benefitsWrap.style.display = 'block';
      if (benefitsList) {
        benefitsList.innerHTML = `
          <li><i class="fa-solid fa-check"></i> Desbloqueo ilimitado nacional por 30 días.</li>
          <li><i class="fa-solid fa-check"></i> 0% Comisión de corretaje inmobiliario.</li>
          <li><i class="fa-solid fa-check"></i> Radar exclusivo de rebajas de precio y arbitraje.</li>
        `;
      }
    } else if (sesionUsuario.plan === 'city') {
      const cNom = sesionUsuario.planCity || 'Bogotá';
      const cNomSeguro = escaparHtml(cNom);
      if (cardCredits) cardCredits.classList.add('vip-mode');
      if (badgeWrap) badgeWrap.style.display = 'block';
      if (badgeEl) badgeEl.innerHTML = `<i class="fa-solid fa-crown"></i> Plan Pro Ciudad (${cNomSeguro})`;
      if (labelCredits) labelCredits.textContent = 'Estado de Cobertura';
      if (elCredits) elCredits.textContent = 'Acceso Ilimitado';
      if (elPlan) elPlan.textContent = `Desbloqueo de propietarios al 100% en ${cNom} por 30 días.`;
      if (extraWrap && extraPill) {
        if (sesionUsuario.credits > 0) {
          extraWrap.style.display = 'block';
          extraPill.textContent = `⚡ +${sesionUsuario.credits} Créditos fuera de cobertura`;
        } else {
          extraWrap.style.display = 'none';
        }
      }
      if (benefitsWrap) benefitsWrap.style.display = 'block';
      if (benefitsList) {
        benefitsList.innerHTML = `
          <li><i class="fa-solid fa-check"></i> Propietarios directos sin gasto de créditos en ${cNomSeguro}.</li>
          <li><i class="fa-solid fa-check"></i> 0% Comisión de agencia e intermediarios.</li>
          <li><i class="fa-solid fa-check"></i> Radar de nuevas oportunidades en tiempo real.</li>
        `;
      }
    } else {
      if (cardCredits) cardCredits.classList.remove('vip-mode');
      if (badgeWrap) badgeWrap.style.display = 'none';
      if (labelCredits) labelCredits.textContent = 'Saldo Disponible';
      if (elCredits) elCredits.textContent = `⚡ ${sesionUsuario.credits} Créditos`;
      if (elPlan) elPlan.textContent = 'Plan Estándar: 1 crédito = 1 propietario directo de por vida.';
      if (extraWrap) extraWrap.style.display = 'none';
      if (benefitsWrap) benefitsWrap.style.display = 'none';
    }

    if (elCount) {
      const cant = (sesionUsuario.unlockedLeads || []).length;
      elCount.textContent = `Has desbloqueado ${cant} ${cant === 1 ? 'propiedad' : 'propiedades'} directamente.`;
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
  const modal = document.getElementById("checkoutModal");
  if (modal) {
    modal.classList.remove("active");
  }
  document.body.style.overflow = "";
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
    btnPagar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando firma criptográfica...';
    btnPagar.disabled = true;
  }

  try {
    pagoWompiEnProgreso = true;
    idempotencyKey = generarIdempotencyKeyPago();
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
        if (trx && trx.status === 'APPROVED') {
          try {
            const tokenGuardado = localStorage.getItem('hunter_pro_token') || sesionUsuario?.token || '';
            const headersClaim = { 'Content-Type': 'application/json' };
            if (tokenGuardado) {
              headersClaim.Authorization = `Bearer ${tokenGuardado}`;
            }

            const claimRes = await fetch('/api/auth/session', {
              method: 'POST',
              headers: headersClaim,
              body: JSON.stringify({ action: 'claim_reference', reference: orderData.reference })
            });
            const claimText = await claimRes.text();
            let claimData = null;
            try { claimData = JSON.parse(claimText); } catch (_) { /* Respuesta no JSON */ }
            if (claimRes.status === 202 && claimData?.requiresLogin) {
              mostrarNotificacionToast(claimData.message || 'Pago acreditado. Inicia sesión con tu PIN existente.', 'warning', { title: 'Protección de cuenta', duration: 7000 });
              abrirModalCheckout(undefined, 'tengo-pin');
              return;
            }
            if (claimRes.ok && claimData && claimData.ok && claimData.token) {
              localStorage.setItem('hunter_pro_token', claimData.token);
              const pinNuevo = claimData.user?.pin || null;
              sesionUsuario = { ...claimData.user, token: claimData.token };
              delete sesionUsuario.pin;
              actualizarBadgeVip();
              sincronizarFiltroCiudadUsuario();
              renderizarInterfaz(datosActuales);

              const notif = typeof generarMensajeBienvenidaToast === 'function'
                ? generarMensajeBienvenidaToast(sesionUsuario, productType, ciudad)
                : { titulo: '🎉 ¡Pago Exitoso!', mensaje: 'Tu acceso quedó acreditado de forma segura.', tipo: 'success' };
              mostrarNotificacionToast(notif.mensaje, notif.tipo, { title: notif.titulo, duration: 6000 });

              // Abrir modal de bienvenida y beneficios VIP
              if (typeof abrirModalBienvenidaVIP === 'function') {
                abrirModalBienvenidaVIP({ tipo: productType, ciudad }, { ...sesionUsuario, pin: pinNuevo });
              }

              if (leadSeleccionado) {
                await ejecutarDesbloqueoLead(leadSeleccionado);
              }
            }
          } catch (errClaim) {
            registrarLogDesarrollo('warn', '[Wompi Callback] Error reclamando sesión:', errClaim);
          }
        }
      });
      return;
    }

    // Fallback si la CDN de Wompi estuviera caída
    const msg = encodeURIComponent(`Hola Origgo, deseo activar ${orderData.productName} para el celular ${celular}. Ref: ${orderData.reference}`);
    window.open(`https://wa.me/573001234567?text=${msg}`, '_blank', 'noopener,noreferrer');
    cerrarModalCheckout();
  } catch (err) {
    registrarLogDesarrollo('error', '[Pago Wompi] Error:', err);
    const mensajeError = err?.message || (typeof err === 'string' ? err : 'Error al conectar con la pasarela de pagos.');
    if (errorBox) {
      errorBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escaparHtml(mensajeError)}`;
      errorBox.classList.remove('is-hidden');
      errorBox.style.display = 'block';
    } else {
      mostrarNotificacionToast(`⚠️ ${mensajeError}`);
    }
  } finally {
    pagoWompiEnProgreso = false;
    if (btnPagar) {
      btnPagar.innerHTML = textoOriginal;
      btnPagar.disabled = false;
    }
  }
}

// Inicialización de Listeners Propios de Pestañas y Acordeón en Checkout
document.addEventListener("DOMContentLoaded", () => {
  const tabMiCuenta = document.getElementById("tabBtnMiCuenta");
  if (tabMiCuenta) {
    tabMiCuenta.addEventListener("click", () => cambiarPestanaCheckout('mi-cuenta'));
  }

  const btnToggleBenefits = document.getElementById("btnToggleUserBenefits");
  const accordionBenefits = document.getElementById("userBenefitsAccordion");
  if (btnToggleBenefits && accordionBenefits) {
    btnToggleBenefits.addEventListener("click", () => {
      accordionBenefits.classList.toggle("active");
      const isActive = accordionBenefits.classList.contains("active");
      btnToggleBenefits.innerHTML = isActive 
        ? '<i class="fa-solid fa-chevron-up"></i> Ocultar Privilegios' 
        : '<i class="fa-solid fa-sparkles"></i> Ver Privilegios de mi Membresía';
    });
  }
});
