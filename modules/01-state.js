/**
 * 🧠 MÓDULO DE ESTADO Y SESIÓN (modules/01-state.js)
 * Gestión de estado global, persistencia en localStorage, sesión JWT, balance y membresías.
 * Estándar Ecosistema Desmulta DevSecOps.
 */

// Estado en memoria de la interfaz y sesión de usuario
let datosActuales = null;
let leadSeleccionado = null;
let wompiScriptCargado = false;
const carruselIndices = {};
let limiteVisible = 6;

// Estado del ledger de créditos y usuario autenticado
let sesionUsuario = null; // { token, phone, credits, pin, plan, planCity, unlockedLeads: [] }
let cacheContactosDesbloqueados = {}; // { [leadId]: { telefono, telLlamar, esCelularValido, whatsappUrl, enlace, portal } }
try {
  const guardados = localStorage.getItem('hunter_unlocked_contacts');
  if (guardados) cacheContactosDesbloqueados = JSON.parse(guardados);
} catch (e) {
  cacheContactosDesbloqueados = {};
}

// Variables de estado reactivo del Omnibox y filtros
let filtroCiudadActivo = "";
let filtroTratoDirectoActivo = false;
let textoBusquedaActivo = "";

/**
 * Inicializa y restaura la sesión de usuario persistente (JWT / PIN / Wompi Callback).
 */
async function inicializarSesionUsuario() {
  // 1. Revisar si hay un retorno de pago en la URL (ej. ?payment_ref=HNT-... o ?id=WompiTransactionID)
  const urlParams = new URLSearchParams(window.location.search);
  let paymentRef = urlParams.get('payment_ref') || urlParams.get('ref');
  const wompiId = urlParams.get('id');

  if (wompiId && !paymentRef) {
    try {
      const resVerify = await fetch(`/api/payments/verify?id=${wompiId}`);
      const dataVerify = await resVerify.json();
      if (dataVerify.ok && dataVerify.reference) {
        paymentRef = dataVerify.reference;
      }
    } catch (e) {
      console.warn('[Sesión] Error al verificar Wompi ID:', e.message);
    }
  }

  if (paymentRef && paymentRef.startsWith('HNT-')) {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim_reference', reference: paymentRef })
      });
      const data = await res.json();
      if (data.ok && data.token) {
        localStorage.setItem('hunter_pro_token', data.token);
        sesionUsuario = { ...data.user, token: data.token };
        actualizarBadgeVip();
        sincronizarFiltroCiudadUsuario();
        const notif = typeof generarMensajeBienvenidaToast === 'function' 
          ? generarMensajeBienvenidaToast(sesionUsuario)
          : { titulo: '🎉 ¡Pago confirmado!', mensaje: `Tu PIN es ${data.user.pin}.`, tipo: 'success' };
        mostrarNotificacionToast(notif.mensaje, notif.tipo, { title: notif.titulo, duration: 6000 });
        if (typeof abrirModalBienvenidaVIP === 'function') {
          abrirModalBienvenidaVIP({ tipo: sesionUsuario.plan, ciudad: sesionUsuario.planCity }, sesionUsuario);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    } catch (e) {
      console.warn('[Sesión] No se pudo reclamar por referencia:', e.message);
    }
  }

  // 2. Restaurar sesión desde localStorage
  const tokenGuardado = localStorage.getItem('hunter_pro_token');
  if (tokenGuardado) {
    try {
      const res = await fetch('/api/user/balance', {
        headers: { 'Authorization': `Bearer ${tokenGuardado}` }
      });
      if (res.ok) {
        const data = await res.json();
        sesionUsuario = { ...data, token: tokenGuardado };
        actualizarBadgeVip();
        sincronizarFiltroCiudadUsuario();
      } else {
        localStorage.removeItem('hunter_pro_token');
        localStorage.removeItem('hunter_unlocked_contacts');
        cacheContactosDesbloqueados = {};
        sesionUsuario = null;
        actualizarBadgeVip();
      }
    } catch (e) {
      console.warn('[Sesión] Fallo al verificar balance persistente:', e.message);
    }
  }
}

/**
 * Actualiza visualmente el botón VIP del header y el botón de la barra móvil.
 */
function actualizarBadgeVip() {
  const btnHeader = document.getElementById('btnVipHeader');
  const btnNavVip = document.getElementById('btnNavVip');

  if (sesionUsuario) {
    let htmlBadge = '';
    let labelMovil = '';

    if (sesionUsuario.plan === 'national') {
      htmlBadge = '<i class="fa-solid fa-crown" style="color: #F59E0B;"></i><span class="vip-btn-text">VIP Nacional</span>';
      labelMovil = 'VIP Nac.';
    } else if (sesionUsuario.plan === 'city') {
      const ciudad = sesionUsuario.planCity || 'Ciudad';
      htmlBadge = `<i class="fa-solid fa-crown" style="color: #F59E0B;"></i><span class="vip-btn-text">VIP ${ciudad}</span>`;
      labelMovil = 'VIP Ciudad';
    } else {
      const cr = Number(sesionUsuario.credits || 0);
      htmlBadge = `<i class="fa-solid fa-bolt" style="color: #10B981;"></i><span class="vip-btn-text">⚡ ${cr} Créditos</span>`;
      labelMovil = `${cr} Créditos`;
    }

    if (btnHeader) btnHeader.innerHTML = htmlBadge;
    if (btnNavVip) {
      const span = btnNavVip.querySelector('span');
      if (span) span.textContent = labelMovil;
    }
  } else {
    if (btnHeader) {
      btnHeader.innerHTML = '<i class="fa-solid fa-crown"></i><span class="vip-btn-text">Acceso VIP</span>';
    }
    if (btnNavVip) {
      const span = btnNavVip.querySelector('span');
      if (span) span.textContent = 'VIP';
    }
  }
}

/**
 * Sincroniza el filtro de ubicación del Omnibox con la ciudad del Plan Pro del usuario.
 */
function sincronizarFiltroCiudadUsuario() {
  if (sesionUsuario && sesionUsuario.plan === 'city' && sesionUsuario.planCity) {
    const targetCity = String(sesionUsuario.planCity).trim();
    if (targetCity) {
      filtroCiudadActivo = targetCity;

      const dropdownLocation = document.getElementById("cmdLocationDropdown");
      const pillLocation = document.getElementById("cmdFilterLocation");
      const labelLocation = document.getElementById("cmdFilterLocationLabel");

      if (dropdownLocation) {
        let matchItem = null;
        dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(item => {
          const itemCity = item.getAttribute("data-city") || "";
          if (itemCity && (itemCity.toLowerCase().includes(targetCity.toLowerCase()) || targetCity.toLowerCase().includes(itemCity.toLowerCase()))) {
            matchItem = item;
          }
        });
        if (matchItem) {
          dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(i => i.classList.remove("active"));
          matchItem.classList.add("active");
          const spanText = matchItem.querySelector("span") ? matchItem.querySelector("span").textContent : targetCity;
          if (labelLocation) labelLocation.textContent = spanText;
          if (pillLocation) pillLocation.classList.add("active-filter");
        } else if (labelLocation) {
          labelLocation.textContent = targetCity;
          if (pillLocation) pillLocation.classList.add("active-filter");
        }
      }
      const sideMenuSelect = document.getElementById("sideMenuCitySelect");
      const sideMenuBadge = document.getElementById("sideMenuCityBadge");
      if (sideMenuSelect) {
        let matchedVal = "";
        for (const opt of sideMenuSelect.options) {
          if (opt.value && (opt.value.toLowerCase().includes(targetCity.toLowerCase()) || targetCity.toLowerCase().includes(opt.value.toLowerCase()))) {
            matchedVal = opt.value;
            break;
          }
        }
        sideMenuSelect.value = matchedVal || targetCity;
      }
      if (sideMenuBadge) {
        sideMenuBadge.textContent = targetCity;
      }

      if (typeof aplicarFiltrosOmnibox === 'function') {
        aplicarFiltrosOmnibox();
      }
    }
  }
}

/**
 * Restaura la sesión de un usuario existente usando WhatsApp + PIN.
 */
async function restaurarSesionConPin() {
  const inputWa = document.getElementById('restoreWhatsappInput');
  const inputPin = document.getElementById('restorePinInput');
  const msgBox = document.getElementById('restoreStatusMsg');
  const btn = document.getElementById('btnRestoreSession');

  const celular = inputWa ? inputWa.value.trim() : '';
  const pin = inputPin ? inputPin.value.trim().toUpperCase() : '';

  if (!celular || !pin) {
    if (msgBox) {
      msgBox.className = 'restore-status-msg error';
      msgBox.textContent = 'Ingresa tu número de WhatsApp y tu PIN de seguridad.';
      msgBox.style.display = 'block';
    }
    return;
  }

  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando credenciales...';
    btn.disabled = true;
  }

  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ celular, pin })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Credenciales incorrectas');
    }

    localStorage.setItem('hunter_pro_token', data.token);
    sesionUsuario = { ...data.user, token: data.token };
    actualizarBadgeVip();
    sincronizarFiltroCiudadUsuario();
    renderizarInterfaz(datosActuales);

    if (msgBox) {
      msgBox.className = 'restore-status-msg success';
      msgBox.textContent = `✅ ¡Bienvenido de nuevo! Tienes ${data.user.credits} créditos disponibles.`;
      msgBox.style.display = 'block';
    }

    setTimeout(() => {
      abrirModalCheckout(undefined, 'perfil');
    }, 800);
  } catch (err) {
    if (msgBox) {
      msgBox.className = 'restore-status-msg error';
      msgBox.textContent = err.message;
      msgBox.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Restaurar Mis Créditos';
      btn.disabled = false;
    }
  }
}

/**
 * Cierra la sesión activa del usuario.
 */
function cerrarSesionUsuario() {
  localStorage.removeItem('hunter_pro_token');
  localStorage.removeItem('hunter_unlocked_contacts');
  cacheContactosDesbloqueados = {};
  sesionUsuario = null;
  actualizarBadgeVip();
  renderizarInterfaz(datosActuales);
  cerrarModalCheckout();
  mostrarNotificacionToast('Sesión cerrada correctamente.', 'info');
}