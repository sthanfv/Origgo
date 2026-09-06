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
let limiteVisible = 9; // Display 9 cards per page for a better grid
let paginaActual = 1;

// Estado del ledger de créditos y usuario autenticado (Restauración síncrona en 0ms)
let sesionUsuario = null; // { token, phone, credits, plan, planCity, unlockedLeads: [] }
try {
  const tokenLocal = localStorage.getItem('hunter_pro_token');
  if (tokenLocal) {
    sesionUsuario = { token: tokenLocal };
  }
  localStorage.removeItem('hunter_user_data');
  localStorage.removeItem('hunter_unlocked_contacts');
} catch (e) {
  sesionUsuario = null;
}

let cacheContactosDesbloqueados = {};

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
  const recoveryToken = urlParams.get('recovery_token');
  let paymentRef = urlParams.get('payment_ref') || urlParams.get('ref');
  const wompiId = urlParams.get('id');

  if (recoveryToken) {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recover_token', recoveryToken })
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.token) {
        throw new Error(data.message || 'El enlace de recuperación no es válido o expiró.');
      }
      localStorage.setItem('hunter_pro_token', data.token);
      sesionUsuario = { ...data.user, token: data.token };
      delete sesionUsuario.pin;
      actualizarBadgeVip();
      sincronizarFiltroCiudadUsuario();
      mostrarNotificacionToast('Sesión restaurada correctamente.', 'success', { title: 'Acceso recuperado', duration: 5000 });
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    } catch (e) {
      localStorage.removeItem('hunter_pro_token');
      sesionUsuario = null;
      mostrarNotificacionToast(e.message || 'El enlace de recuperación no es válido o expiró.', 'warning', { title: 'Recuperación no válida', duration: 7000 });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  if (wompiId && !paymentRef) {
    try {
      const resVerify = await fetch(`/api/payments/verify?id=${wompiId}`);
      const textVerify = await resVerify.text();
      let dataVerify = null;
      try { dataVerify = JSON.parse(textVerify); } catch (_) {}
      if (resVerify.ok && dataVerify && dataVerify.ok && dataVerify.reference) {
        paymentRef = dataVerify.reference;
      }
    } catch (e) {
      console.warn('[Sesión] Error al verificar Wompi ID:', e.message);
    }
  }

  if (paymentRef && paymentRef.startsWith('HNT-')) {
    try {
      const tokenGuardado = localStorage.getItem('hunter_pro_token');
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokenGuardado ? { Authorization: `Bearer ${tokenGuardado}` } : {})
        },
        body: JSON.stringify({ action: 'claim_reference', reference: paymentRef })
      });
      const dataText = await res.text();
      let data = null;
      try { data = JSON.parse(dataText); } catch (_) {}
      if (data && data.requiresLogin) {
        mostrarNotificacionToast(data.message || 'Pago acreditado. Inicia sesión con tu PIN.', 'warning', { title: 'Protección de cuenta', duration: 7000 });
        if (typeof abrirModalCheckout === 'function') abrirModalCheckout(undefined, 'tengo-pin');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      if (res.ok && data && data.ok && data.token) {
        localStorage.setItem('hunter_pro_token', data.token);
        const pinNuevo = data.user?.pin || null;
        sesionUsuario = { ...data.user, token: data.token };
        delete sesionUsuario.pin;
        actualizarBadgeVip();
        sincronizarFiltroCiudadUsuario();
        const notif = typeof generarMensajeBienvenidaToast === 'function' 
          ? generarMensajeBienvenidaToast(sesionUsuario)
          : { titulo: '🎉 ¡Pago confirmado!', mensaje: 'Tu acceso quedó acreditado.', tipo: 'success' };
        mostrarNotificacionToast(notif.mensaje, notif.tipo, { title: notif.titulo, duration: 6000 });
        if (typeof abrirModalBienvenidaVIP === 'function') {
          abrirModalBienvenidaVIP({ tipo: sesionUsuario.plan, ciudad: sesionUsuario.planCity }, { ...sesionUsuario, pin: pinNuevo });
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    } catch (e) {
      console.warn('[Sesión] No se pudo reclamar por referencia:', e.message);
    }
  }

  // 2. Revalidar sesión persistente en segundo plano desde el servidor
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
      } else if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('hunter_pro_token');
        localStorage.removeItem('hunter_user_data');
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
      const ciudad = typeof escaparHtml === 'function' ? escaparHtml(sesionUsuario.planCity || 'Ciudad') : (sesionUsuario.planCity || 'Ciudad');
      htmlBadge = `<i class="fa-solid fa-crown" style="color: #F59E0B;"></i><span class="vip-btn-text">VIP ${ciudad}</span>`;
      labelMovil = 'VIP Ciudad';
    } else {
      const cr = Number(sesionUsuario.credits || 0);
      htmlBadge = `<span class="vip-btn-text">⚡ ${cr} Créditos</span>`;
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
    delete sesionUsuario.pin;
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
  localStorage.removeItem('hunter_user_data');
  localStorage.removeItem('hunter_unlocked_contacts');
  cacheContactosDesbloqueados = {};
  sesionUsuario = null;
  actualizarBadgeVip();
  renderizarInterfaz(datosActuales);
  cerrarModalCheckout();
  mostrarNotificacionToast('Sesión cerrada correctamente.', 'info');
}

/**
 * Autoservicio 100% automático para restaurar acceso mediante correo electrónico.
 */
async function recuperarPinConReferencia() {
  const inputEmail = document.getElementById('recoveryReferenceInput');
  const msgBox = document.getElementById('recoveryResultMsg');
  const btn = document.getElementById('btnExecuteAutoRecovery');

  const email = inputEmail ? inputEmail.value.trim() : '';
  if (!email || !email.includes('@')) {
    if (msgBox) {
      msgBox.className = 'restore-status-msg error';
      msgBox.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Por favor, ingresa un correo electrónico válido.';
      msgBox.style.display = 'block';
    }
    return;
  }

  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando instrucciones...';
    btn.disabled = true;
  }

  try {
    const response = await fetch('/api/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const result = await response.json();

    if (msgBox) {
      if (response.ok) {
        msgBox.className = 'restore-status-msg success';
        msgBox.textContent = result.message || 'Si existe una cuenta asociada, enviaremos instrucciones de recuperación.';
        msgBox.style.display = 'block';
        if (inputEmail) inputEmail.value = '';
      } else {
        msgBox.className = 'restore-status-msg error';
        msgBox.textContent = result.message || 'No se pudo procesar la solicitud. Intenta más tarde.';
        msgBox.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('[Recuperación] Error:', error);
    if (msgBox) {
      msgBox.className = 'restore-status-msg error';
      msgBox.innerHTML = '<i class="fa-solid fa-network-wired"></i> Error de conexión. Intenta de nuevo.';
      msgBox.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar instrucciones';
      btn.disabled = false;
    }
  }
}
