/**
 * 💳 MÓDULO DE CHECKOUT Y PASARELA WOMPI (modules/08-checkout.js)
 * Modal de compra, selector de planes, orquestación del widget Wompi y verificación de firmas.
 * Estándar Ecosistema Desmulta Finanzas.
 */

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
    console.log("✅ Widget de Wompi cargado exitosamente.");
  };
  script.onerror = () => {
    console.warn("⚠️ No se pudo cargar el script de Wompi de la CDN. Fallback comercial activo.");
  };
  document.head.appendChild(script);
}


/**
 * Cambia la pestaña activa del modal de checkout.
 * @param {'comprar'|'tengo-pin'|'perfil'} pestana
 */
function cambiarPestanaCheckout(pestana) {
  const tabComprar = document.getElementById('tabBtnComprar');
  const tabPin = document.getElementById('tabBtnTengoPin');
  const panelComprar = document.getElementById('panelComprar');
  const panelPin = document.getElementById('panelTengoPin');
  const panelPerfil = document.getElementById('panelUsuarioActivo');
  const tabsBar = document.getElementById('checkoutTabsBar');

  if (panelComprar) panelComprar.classList.remove('active');
  if (panelPin) panelPin.classList.remove('active');
  if (panelPerfil) panelPerfil.classList.remove('active');
  if (tabComprar) tabComprar.classList.remove('active');
  if (tabPin) tabPin.classList.remove('active');
  if (tabsBar) tabsBar.style.display = 'flex';

  if (pestana === 'comprar') {
    if (tabComprar) tabComprar.classList.add('active');
    if (panelComprar) panelComprar.classList.add('active');
  } else if (pestana === 'tengo-pin') {
    if (tabPin) tabPin.classList.add('active');
    if (panelPin) panelPin.classList.add('active');
  } else if (pestana === 'perfil') {
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
          <span style="color: var(--text-muted);">Inmueble:</span>
          <strong style="color: var(--text-main);">${escaparHtml(leadSeleccionado.titulo)}</strong>
        </div>
        <div class="modal-summary-item">
          <span style="color: var(--text-muted);">Ubicación:</span>
          <span style="color: var(--text-muted);">${escaparHtml(leadSeleccionado.ubicacion)}</span>
        </div>
        <div class="modal-summary-item">
          <span style="color: var(--text-muted);">Precio Publicado:</span>
          <strong style="color: var(--accent-emerald); font-size: 1.15rem;">${escaparHtml(leadSeleccionado.precio)}</strong>
        </div>
        ${leadSeleccionado.precio_m2 ? `
          <div class="modal-summary-item" style="border-top: 1px dashed var(--border-subtle); padding-top: 0.4rem; margin-top: 0.4rem;">
            <span style="color: var(--text-muted);">Valor Unitario:</span>
            <strong style="color: var(--text-main);">${escaparHtml(leadSeleccionado.precio_m2)}</strong>
          </div>
        ` : ''}
      `;
    } else {
      elSummary.style.display = 'none';
    }
  }

  // Si el usuario ya tiene sesión activa
  if (sesionUsuario) {
    const elPhone = document.getElementById('userActivePhone');
    const elPin = document.getElementById('userActivePin');
    const elCredits = document.getElementById('userActiveCredits');
    const elPlan = document.getElementById('userActivePlan');
    const elCount = document.getElementById('userActiveUnlockedCount');
    const inputWa = document.getElementById('checkoutWhatsappInput');

    if (elPhone) elPhone.textContent = `+57 ${sesionUsuario.phone}`;
    if (elPin) elPin.textContent = `PIN: ${sesionUsuario.pin}`;
    if (elCredits) elCredits.textContent = `⚡ ${sesionUsuario.credits} Créditos`;
    if (elPlan) {
      if (sesionUsuario.plan === 'national') elPlan.textContent = '👑 Plan Nacional VIP (Ilimitado)';
      else if (sesionUsuario.plan === 'city') elPlan.textContent = `👑 Plan Pro Ciudad (${sesionUsuario.planCity || 'Activa'})`;
      else elPlan.textContent = 'Plan Estándar por Créditos';
    }
    if (elCount) {
      const cant = (sesionUsuario.unlockedLeads || []).length;
      elCount.textContent = `Has desbloqueado ${cant} ${cant === 1 ? 'propiedad' : 'propiedades'} directamente.`;
    }
    if (inputWa) inputWa.value = sesionUsuario.phone;

    if (pestana === 'comprar' || (!sesionUsuario.credits && sesionUsuario.plan === 'free')) {
      cambiarPestanaCheckout('comprar');
    } else {
      cambiarPestanaCheckout('perfil');
    }
  } else {
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
        cityError.style.display = 'block';
      }
      if (selectCity) {
        selectCity.focus();
        selectCity.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    if (cityError) cityError.style.display = 'none';
  }

  const btnPagar = document.getElementById('btnConfirmWompi');
  const textoOriginal = btnPagar ? btnPagar.innerHTML : '';
  if (btnPagar) {
    btnPagar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando firma criptográfica...';
    btnPagar.disabled = true;
  }

  try {
    const res = await fetch('/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
            const claimRes = await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'claim_reference', reference: orderData.reference })
            });
            const claimData = await claimRes.json();
            if (claimData.ok && claimData.token) {
              localStorage.setItem('hunter_pro_token', claimData.token);
              sesionUsuario = { ...claimData.user, token: claimData.token };
              actualizarBadgeVip();
              sincronizarFiltroCiudadUsuario();
              renderizarInterfaz(datosActuales);
              mostrarNotificacionToast(`🎉 ¡Pago aprobado! Tu PIN es: ${claimData.user.pin}. Tienes ${claimData.user.credits} créditos.`);
              if (leadSeleccionado) {
                await ejecutarDesbloqueoLead(leadSeleccionado);
              }
            }
          } catch (errClaim) {
            console.warn('[Wompi Callback] Error reclamando sesión:', errClaim);
          }
        }
      });
      return;
    }

    // Fallback si la CDN de Wompi estuviera caída
    const msg = encodeURIComponent(`Hola Hunter Pro, deseo activar ${orderData.productName} para el celular ${celular}. Ref: ${orderData.reference}`);
    window.open(`https://wa.me/573001234567?text=${msg}`, '_blank');
    cerrarModalCheckout();
  } catch (err) {
    console.error('[Pago Wompi] Error:', err);
    const mensajeError = err?.message || (typeof err === 'string' ? err : 'Error al conectar con la pasarela de pagos.');
    if (errorBox) {
      errorBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escaparHtml(mensajeError)}`;
      errorBox.style.display = 'block';
    } else {
      mostrarNotificacionToast(`⚠️ ${mensajeError}`);
    }
  } finally {
    if (btnPagar) {
      btnPagar.innerHTML = textoOriginal;
      btnPagar.disabled = false;
    }
  }
}
