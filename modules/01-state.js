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
let limiteVisible = 15; // Lote de 15 oportunidades por página optimizado para móviles y desktop
let paginaActual = 1;

// ✅ HAL-01 — PROTECCIÓN ANTI-MANIPULACIÓN DE SESIÓN DESDE CONSOLA
// La variable interna _sesionUsuario es la fuente de verdad del módulo.
// Se expone en window como propiedad de SOLO LECTURA para que asignaciones
// directas desde F12/consola (ej: sesionUsuario.credits = 99999) no tengan efecto.
let _sesionUsuario = null; // Fuente de verdad interna
// Alias mutable para compatibilidad interna del módulo (usado por el propio JS)
let sesionUsuario = null;

if (typeof window !== 'undefined') {
  // Interceptar escritura directa de window.sesionUsuario desde la consola
  try {
    Object.defineProperty(window, '_origgoSesionProtegida', {
      get() { return _sesionUsuario; },
      set() { /* escritura externa ignorada silenciosamente */ },
      configurable: false,
      enumerable: false
    });
  } catch (_) { /* Entornos sin window (SSR/test) — ignorar */ }
}

try {
  let tokenLocal = localStorage.getItem('hunter_pro_token');
  if (!tokenLocal && typeof obtenerCookieSegura === 'function') {
    tokenLocal = obtenerCookieSegura('origgo_token');
    if (tokenLocal) {
      try { localStorage.setItem('hunter_pro_token', tokenLocal); } catch (_) {}
    }
  }
  if (tokenLocal) {
    _sesionUsuario = { token: tokenLocal };
    sesionUsuario = _sesionUsuario;
  }
  localStorage.removeItem('hunter_user_data');
  localStorage.removeItem('hunter_unlocked_contacts');
} catch (e) {
  _sesionUsuario = null;
  sesionUsuario = null;
}
let cacheContactosDesbloqueados = {};
// ✅ HAL-06: Flag atómico anti-race-condition para la restauración de sesión por PIN.
let restauracionEnProgreso = false;
// Variables de estado reactivo del Omnibox y filtros
let filtroCiudadActivo = "";
let filtroOperacionActivo = ""; // "" = todas, "venta", "arriendo"
let filtroTratoDirectoActivo = false;
let filtroHoyActivo = false;
let textoBusquedaActivo = "";
let criterioOrdenActivo = "recientes";

function aplicarPreferenciasUsuario(usr) {
  if (!usr) return;
  if (usr.preferredLang && typeof cambiarIdioma === 'function' && typeof obtenerIdiomaActual === 'function' && usr.preferredLang !== obtenerIdiomaActual()) {
    cambiarIdioma(usr.preferredLang);
  }
  if (usr.preferredTheme && typeof aplicarTema === 'function' && typeof obtenerTemaActual === 'function' && usr.preferredTheme !== obtenerTemaActual()) {
    aplicarTema(usr.preferredTheme);
  }
}

function establecerSesionDesdeToken(data, { msgEs, msgEn, titleEs, titleEn, isWelcome = false }) {
  localStorage.setItem('hunter_pro_token', data.token);
  if (typeof guardarCookieSegura === 'function') guardarCookieSegura('origgo_token', data.token, 30);
  if (isWelcome && typeof marcarDispositivoComoReclamado === 'function') marcarDispositivoComoReclamado();
  sesionUsuario = { ...data.user, token: data.token };
  delete sesionUsuario.pin;
  aplicarPreferenciasUsuario(data.user);
  actualizarBadgeVip();
  sincronizarFiltroCiudadUsuario();
  const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  mostrarNotificacionToast(esIngles ? msgEn : msgEs, 'success', { title: esIngles ? titleEn : titleEs, duration: 6000 });
  window.history.replaceState({}, document.title, window.location.pathname);
}

/**
 * Inicializa y restaura la sesión de usuario persistente (JWT / PIN / Wompi Callback).
 */
async function inicializarSesionUsuario() {
  const urlParams = new URLSearchParams(window.location.search);
  const recoveryToken = urlParams.get('recovery_token'), magicToken = urlParams.get('magic_token'), welcomeToken = urlParams.get('welcome_token');
  let paymentRef = urlParams.get('payment_ref') || urlParams.get('ref') || localStorage.getItem('origgo_pending_ref');
  const wompiId = urlParams.get('id');

  // 🎁 Activación de Regalo Freemium (Doble Opt-In por correo)
  if (welcomeToken) {
    try {
      const res = await fetch('/api/auth/welcome-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: welcomeToken }) });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.token) throw new Error(data.message || 'El enlace de activación no es válido o expiró.');
      establecerSesionDesdeToken(data, { msgEs: '🎉 ¡Regalo activado! Tienes 1 desbloqueo directo listo.', msgEn: '🎉 Welcome gift activated! 1 free unlock ready.', titleEs: 'Regalo de Bienvenida ($0)', titleEn: 'Gift Activated', isWelcome: true });
      return;
    } catch (e) {
      const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
      mostrarNotificacionToast(e.message || (esIngles ? 'The welcome link is invalid or expired.' : 'El enlace de activación no es válido o expiró.'), 'warning');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  if (magicToken) {
    try {
      const res = await fetch('/api/auth/magic-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: magicToken }) });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.token) throw new Error(data.message || 'El enlace no es válido o expiró.');
      establecerSesionDesdeToken(data, { msgEs: '¡Bienvenido! Sesión iniciada con Enlace Mágico.', msgEn: 'Welcome back! Instant access verified.', titleEs: 'Acceso Instantáneo', titleEn: 'Instant Access' });
      return;
    } catch (e) {
      const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
      mostrarNotificacionToast(e.message || (esIngles ? 'The magic link is invalid or expired.' : 'El enlace de acceso no es válido o expiró.'), 'warning');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  if (recoveryToken) {
    try {
      const res = await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'recover_token', recoveryToken }) });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.token) throw new Error(data.message || 'El enlace de recuperación no es válido o expiró.');
      establecerSesionDesdeToken(data, { msgEs: 'Sesión restaurada correctamente.', msgEn: 'Session successfully restored.', titleEs: 'Acceso recuperado', titleEn: 'Access Restored' });
      return;
    } catch (e) {
      localStorage.removeItem('hunter_pro_token');
      if (typeof borrarCookieSegura === 'function') borrarCookieSegura('origgo_token');
      sesionUsuario = null;
      const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
      mostrarNotificacionToast(e.message || (esIngles ? 'The recovery link is invalid or has expired.' : 'El enlace de recuperación no es válido o expiró.'), 'warning');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  if (wompiId && !paymentRef) {
    try {
      const resVerify = await fetch(`/api/payments/verify?id=${wompiId}`);
      const dataVerify = await resVerify.json().catch(() => null);
      if (resVerify.ok && dataVerify?.ok && dataVerify.reference) paymentRef = dataVerify.reference;
    } catch (e) { registrarLogDesarrollo('warn', '[Sesión] Error al verificar Wompi ID:', e.message); }
  }

  if (paymentRef && paymentRef.startsWith('HNT-')) {
    try {
      const tokenGuardado = localStorage.getItem('hunter_pro_token');
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tokenGuardado ? { Authorization: `Bearer ${tokenGuardado}` } : {}) },
        body: JSON.stringify({ action: 'claim_reference', reference: paymentRef })
      });
      const data = await res.json().catch(() => null);
      const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
      if (data?.requiresLogin) {
        mostrarNotificacionToast(data.message || (esIngles ? 'Payment credited. Sign in with your PIN.' : 'Pago acreditado. Inicia sesión con tu PIN.'), 'warning', { title: esIngles ? 'Account Protection' : 'Protección de cuenta', duration: 7000 });
        if (typeof abrirModalCheckout === 'function') abrirModalCheckout(undefined, 'tengo-pin');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      if (res.ok && data?.ok && data.token) {
        localStorage.setItem('hunter_pro_token', data.token);
        if (typeof guardarCookieSegura === 'function') guardarCookieSegura('origgo_token', data.token, 30);
        localStorage.removeItem('origgo_pending_ref');
        const pinNuevo = data.user?.pin || null;
        sesionUsuario = { ...data.user, token: data.token };
        delete sesionUsuario.pin;
        aplicarPreferenciasUsuario(data.user);
        actualizarBadgeVip();
        sincronizarFiltroCiudadUsuario();
        const notif = typeof generarMensajeBienvenidaToast === 'function' 
          ? generarMensajeBienvenidaToast(sesionUsuario)
          : { titulo: esIngles ? '🎉 Payment confirmed!' : '🎉 ¡Pago confirmado!', mensaje: esIngles ? 'Your access has been accredited.' : 'Tu acceso quedó acreditado.', tipo: 'success' };
        mostrarNotificacionToast(notif.mensaje, notif.tipo, { title: notif.titulo, duration: 6000 });
        if (typeof abrirModalBienvenidaVIP === 'function') abrirModalBienvenidaVIP({ tipo: sesionUsuario.plan, ciudad: sesionUsuario.planCity }, { ...sesionUsuario, pin: pinNuevo });
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    } catch (e) { registrarLogDesarrollo('warn', '[Sesión] No se pudo reclamar por referencia:', e.message); }
  }

  // 2. Revalidar sesión persistente en segundo plano desde el servidor
  const tokenGuardado = (sesionUsuario && sesionUsuario.token) || localStorage.getItem('hunter_pro_token') || (typeof obtenerCookieSegura === 'function' ? obtenerCookieSegura('origgo_token') : null);
  if (tokenGuardado) {
    try {
      const res = await fetch('/api/user/balance', {
        headers: { 'Authorization': `Bearer ${tokenGuardado}` }
      });
      if (res.ok) {
        const data = await res.json();
        sesionUsuario = { ...data, token: tokenGuardado };
        if (typeof guardarCookieSegura === 'function') {
          guardarCookieSegura('origgo_token', tokenGuardado, 30);
        }
        aplicarPreferenciasUsuario(data);
        actualizarBadgeVip();
        sincronizarFiltroCiudadUsuario();
      } else if (res.status === 401 || res.status === 403 || res.status === 404) {
        localStorage.removeItem('hunter_pro_token');
        if (typeof borrarCookieSegura === 'function') borrarCookieSegura('origgo_token');
        localStorage.removeItem('hunter_user_data');
        localStorage.removeItem('hunter_unlocked_contacts');
        cacheContactosDesbloqueados = {};
        sesionUsuario = null;
        actualizarBadgeVip();
      }
    } catch (e) {
      registrarLogDesarrollo('warn', '[Sesión] Fallo al verificar balance persistente:', e.message);
    }
  }
}

/**
 * Actualiza visualmente el botón VIP del header, chip móvil y menú lateral.
 */
function actualizarBadgeVip() {
  const btnHeader = document.getElementById('btnVipHeader'), btnNavVip = document.getElementById('btnNavVip');
  const btnMobileChip = document.getElementById('btnMobileStatusChip'), sideUserBox = document.getElementById('sideMenuUserAccount');
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';

  if (sesionUsuario) {
    let htmlBadge = '', labelMovil = '', htmlChipMovil = '', htmlSideUser = '';
    const phoneFormateado = sesionUsuario.phone ? `+57 ${sesionUsuario.phone}` : (isEn ? 'Active Account' : 'Cuenta Activa');

    if (sesionUsuario.plan === 'national') {
      htmlBadge = `<i class="fa-solid fa-crown"></i><span class="vip-btn-text">${isEn ? 'National VIP' : 'VIP Nacional'}</span>`;
      labelMovil = isEn ? 'Nat. VIP' : 'VIP Nac.';
      htmlChipMovil = `<i class="fa-solid fa-crown" style="color:#FBBF24;"></i><span>${isEn ? 'National 30d' : 'Nacional 30d'}</span>`;
      htmlSideUser = `<div class="side-user-card side-user-vip-national"><div class="side-user-top"><span class="side-user-badge-gold">👑 ${isEn ? 'National VIP' : 'VIP Nacional'}</span><span class="side-user-phone">${escaparHtml(phoneFormateado)}</span></div><p class="side-user-desc">${isEn ? 'Full unlimited nationwide access active for 30 days.' : 'Acceso total ilimitado a todo el país activo por 30 días.'}</p></div>`;
    } else if (sesionUsuario.plan === 'city') {
      const ciudad = typeof escaparHtml === 'function' ? escaparHtml(sesionUsuario.planCity || 'Ciudad') : (sesionUsuario.planCity || 'Ciudad');
      htmlBadge = `<i class="fa-solid fa-crown"></i><span class="vip-btn-text">VIP ${ciudad}</span>`;
      labelMovil = isEn ? 'City VIP' : 'VIP Ciudad';
      htmlChipMovil = `<i class="fa-solid fa-crown" style="color:#34D399;"></i><span>${ciudad} 30d</span>`;
      htmlSideUser = `<div class="side-user-card side-user-vip-city"><div class="side-user-top"><span class="side-user-badge-emerald">👑 VIP ${ciudad}</span><span class="side-user-phone">${escaparHtml(phoneFormateado)}</span></div><p class="side-user-desc">${isEn ? `Unlimited contact reveals in ${ciudad} for 30 days.` : `Desbloqueo ilimitado de contactos en ${ciudad} por 30 días.`}</p></div>`;
    } else {
      const cr = Number(sesionUsuario.credits || 0);
      const palabraCred = cr === 1 ? (isEn ? 'Credit' : 'Crédito') : (isEn ? 'Credits' : 'Créditos');
      htmlBadge = `<span class="vip-btn-text">⚡ ${cr} ${palabraCred}</span>`;
      labelMovil = `${cr} Creds`;
      htmlChipMovil = cr > 0 ? `<i class="fa-solid fa-bolt" style="color:#34D399;"></i><span>${cr} Creds</span>` : `<i class="fa-solid fa-bolt" style="color:#F59E0B;"></i><span>0 Creds</span>`;
      const descCreds = cr > 0 ? (isEn ? 'Active balance to unlock verified direct owners.' : 'Saldo activo para desbloquear propietarios directos.') : (isEn ? 'No active balance. Top up to unlock contacts.' : 'Sin saldo activo. Recarga para desbloquear contactos.');
      htmlSideUser = `<div class="side-user-card"><div class="side-user-top"><span class="side-user-badge-creds">⚡ ${cr} ${palabraCred}</span><span class="side-user-phone">${escaparHtml(phoneFormateado)}</span></div><p class="side-user-desc">${descCreds}</p></div>`;
    }

    if (btnHeader) btnHeader.innerHTML = htmlBadge;
    if (btnNavVip) {
      const span = btnNavVip.querySelector('span'), icon = btnNavVip.querySelector('i');
      if (span) span.textContent = labelMovil;
      if (icon) icon.className = (sesionUsuario.plan || Number(sesionUsuario.credits || 0) === 0) ? 'fa-solid fa-crown' : 'fa-solid fa-bolt';
    }
    if (btnMobileChip) { btnMobileChip.innerHTML = htmlChipMovil; btnMobileChip.classList.remove('is-hidden'); }
    if (sideUserBox) { sideUserBox.innerHTML = htmlSideUser; sideUserBox.classList.remove('is-hidden'); }
    const btnSideLogout = document.getElementById('sideMenuLogoutBtn');
    if (btnSideLogout) btnSideLogout.classList.remove('is-hidden');
  } else {
    if (btnHeader) btnHeader.innerHTML = `<i class="fa-solid fa-bolt"></i><span class="vip-btn-text">${isEn ? 'Credits / Plans' : 'Créditos / Planes'}</span>`;
    if (btnNavVip) {
      const span = btnNavVip.querySelector('span'), icon = btnNavVip.querySelector('i');
      if (span) span.textContent = isEn ? 'Credits' : 'Créditos';
      if (icon) icon.className = 'fa-solid fa-bolt';
    }
    if (btnMobileChip) { btnMobileChip.innerHTML = `<i class="fa-solid fa-bolt"></i><span>${isEn ? 'Credits' : 'Créditos'}</span>`; btnMobileChip.classList.remove('is-hidden'); }
    if (sideUserBox) { sideUserBox.innerHTML = ''; sideUserBox.classList.add('is-hidden'); }
    const btnSideLogout = document.getElementById('sideMenuLogoutBtn');
    if (btnSideLogout) btnSideLogout.classList.add('is-hidden');
  }
}

/**
 * Sincroniza el filtro de ubicación del Omnibox con la ciudad del Plan Pro del usuario.
 */
function sincronizarFiltroCiudadUsuario() {
  if (!sesionUsuario || sesionUsuario.plan !== 'city' || !sesionUsuario.planCity) return;
  const targetCity = String(sesionUsuario.planCity).trim();
  if (!targetCity) return;
  filtroCiudadActivo = targetCity;

  const dropdownLocation = document.getElementById("cmdLocationDropdown");
  const pillLocation = document.getElementById("cmdFilterLocation");
  const labelLocation = document.getElementById("cmdFilterLocationLabel");

  if (dropdownLocation) {
    let matchItem = null;
    dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(item => {
      const itemCity = item.getAttribute("data-city") || "";
      if (itemCity && (itemCity.toLowerCase().includes(targetCity.toLowerCase()) || targetCity.toLowerCase().includes(itemCity.toLowerCase()))) matchItem = item;
    });
    if (matchItem) {
      dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(i => i.classList.remove("active"));
      matchItem.classList.add("active");
      const spanText = matchItem.querySelector("span")?.textContent || targetCity;
      if (labelLocation) labelLocation.textContent = spanText;
      if (pillLocation) pillLocation.classList.add("active-filter");
    } else if (labelLocation) {
      labelLocation.textContent = targetCity;
      if (pillLocation) pillLocation.classList.add("active-filter");
    }
  }
  const sideMenuSelect = document.getElementById("sideMenuCitySelect"), sideMenuBadge = document.getElementById("sideMenuCityBadge");
  if (sideMenuSelect) {
    let matchedVal = "";
    for (const opt of sideMenuSelect.options) {
      if (opt.value && (opt.value.toLowerCase().includes(targetCity.toLowerCase()) || targetCity.toLowerCase().includes(opt.value.toLowerCase()))) {
        matchedVal = opt.value; break;
      }
    }
    sideMenuSelect.value = matchedVal || targetCity;
  }
  if (sideMenuBadge) sideMenuBadge.textContent = targetCity;
  if (typeof aplicarFiltrosOmnibox === 'function') aplicarFiltrosOmnibox();
}

/**
 * Restaura la sesión de un usuario existente usando WhatsApp + PIN.
 * ✅ HAL-06: Protegido con flag atómico anti-race-condition.
 */
async function restaurarSesionConPin() {
  if (restauracionEnProgreso) return;
  restauracionEnProgreso = true;
  const inputWa = document.getElementById('restoreWhatsappInput'), inputPin = document.getElementById('restorePinInput');
  const msgBox = document.getElementById('restoreStatusMsg'), btn = document.getElementById('btnRestoreSession');
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const celular = inputWa ? inputWa.value.trim() : '', pin = inputPin ? inputPin.value.trim().toUpperCase() : '';
  if (!celular || !pin) {
    if (msgBox) { msgBox.className = 'restore-status-msg error'; msgBox.textContent = isEn ? 'Enter your WhatsApp number and security PIN.' : 'Ingresa tu número de WhatsApp y tu PIN de seguridad.'; msgBox.style.display = 'block'; }
    restauracionEnProgreso = false;
    return;
  }
  if (btn) { btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEn ? 'Verifying credentials...' : 'Verificando credenciales...'}`; btn.disabled = true; }
  const esReferencia = pin.startsWith('HNT-') && pin.length > 12;
  let securityData = {};
  if (!esReferencia && typeof obtenerDesafioSeguridadResuelto === 'function') securityData = await obtenerDesafioSeguridadResuelto();
  const requestBody = esReferencia ? { action: 'claim_reference', reference: pin, lang: isEn ? 'en' : 'es' } : { celular, pin, lang: isEn ? 'en' : 'es', ...securityData };

  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || data.error || (isEn ? 'Incorrect credentials or reference' : 'Credenciales o referencia incorrectas'));
    if (data.requiresLogin) throw new Error(data.message || (isEn ? 'Payment credited. Enter your PIN to continue.' : 'Pago acreditado. Ingresa tu PIN para continuar.'));

    localStorage.setItem('hunter_pro_token', data.token);
    if (typeof guardarCookieSegura === 'function') guardarCookieSegura('origgo_token', data.token, 30);
    localStorage.removeItem('origgo_pending_ref');
    const pinDevuelto = data.user?.pin || null;
    sesionUsuario = { ...data.user, token: data.token };
    delete sesionUsuario.pin;
    aplicarPreferenciasUsuario(data.user);
    actualizarBadgeVip();
    sincronizarFiltroCiudadUsuario();
    renderizarInterfaz(datosActuales);

    if (msgBox) {
      msgBox.className = 'restore-status-msg success';
      msgBox.textContent = pinDevuelto
        ? (isEn ? `✅ Payment verified! PIN: ${pinDevuelto}. Balance: ${data.user.credits} credits.` : `✅ ¡Pago verificado! Tu PIN es ${pinDevuelto}. Saldo: ${data.user.credits} créditos.`)
        : (isEn ? `✅ Welcome back! Available: ${data.user.credits} credits.` : `✅ ¡Bienvenido de nuevo! Tienes ${data.user.credits} créditos disponibles.`);
      msgBox.style.display = 'block';
    }
    setTimeout(() => { abrirModalCheckout(undefined, 'perfil'); }, 800);
  } catch (err) {
    if (msgBox) { msgBox.className = 'restore-status-msg error'; msgBox.textContent = err.message; msgBox.style.display = 'block'; }
  } finally {
    restauracionEnProgreso = false;
    if (btn) { btn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> ${isEn ? 'Restore My Credits' : 'Restaurar Mis Créditos'}`; btn.disabled = false; }
  }
}

/**
 * Cierra la sesión activa del usuario.
 * Preserva intacta la marca Zombie del dispositivo (origgo_device_claimed)
 * para evitar que el usuario burle el modelo freemium al desloguearse.
 */
function cerrarSesionUsuario() {
  localStorage.removeItem('hunter_pro_token');
  if (typeof borrarCookieSegura === 'function') borrarCookieSegura('origgo_token');
  localStorage.removeItem('hunter_user_data');
  localStorage.removeItem('hunter_unlocked_contacts');
  cacheContactosDesbloqueados = {};
  sesionUsuario = null;
  if (typeof esDispositivoMarcadoComoReclamado === 'function') esDispositivoMarcadoComoReclamado();
  actualizarBadgeVip();
  renderizarInterfaz(datosActuales);
  const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  mostrarNotificacionToast(esIngles ? 'Logged out successfully.' : 'Sesión cerrada correctamente.', 'info');
}

/**
 * Autoservicio para restaurar acceso mediante PIN o Magic Link por correo electrónico.
 */
async function recuperarPinConReferencia() {
  const inputEmail = document.getElementById('recoveryReferenceInput'), msgBox = document.getElementById('recoveryResultMsg'), btn = document.getElementById('btnExecuteAutoRecovery');
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const email = inputEmail ? inputEmail.value.trim() : '';
  if (!email || !email.includes('@')) {
    if (msgBox) {
      msgBox.className = 'restore-status-msg restore-status-recovery-result error';
      msgBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${isEn ? 'Please enter a valid email address.' : 'Por favor, ingresa un correo electrónico válido.'}`;
      msgBox.style.display = 'block';
    }
    return;
  }
  if (btn) { btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEn ? 'Sending...' : 'Enviando...'}`; btn.disabled = true; }
  try {
    const response = await fetch('/api/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, lang: isEn ? 'en' : 'es' })
    });
    const result = await response.json();
    if (msgBox) {
      msgBox.className = response.ok ? 'restore-status-msg restore-status-recovery-result success' : 'restore-status-msg restore-status-recovery-result error';
      msgBox.textContent = result.message || (response.ok ? (isEn ? 'If an account exists, instructions were sent.' : 'Si existe una cuenta asociada, enviaremos instrucciones.') : (isEn ? 'Could not process request.' : 'No se pudo procesar la solicitud.'));
      msgBox.style.display = 'block';
      if (response.ok && inputEmail) inputEmail.value = '';
    }
  } catch (error) {
    if (msgBox) {
      msgBox.className = 'restore-status-msg restore-status-recovery-result error';
      msgBox.innerHTML = `<i class="fa-solid fa-network-wired"></i> ${isEn ? 'Connection error. Try again.' : 'Error de conexión. Intenta de nuevo.'}`;
      msgBox.style.display = 'block';
    }
  } finally {
    if (btn) { btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ${isEn ? 'Send instructions' : 'Enviar instrucciones'}`; btn.disabled = false; }
  }
}

/**
 * Solicita el envío de un Magic Link de acceso sin contraseña al correo del usuario.
 */
async function solicitarMagicLinkPorCorreo() {
  const inputEmail = document.getElementById('magicLinkEmailInput') || document.getElementById('recoveryReferenceInput');
  const msgBox = document.getElementById('magicLinkStatusMsg') || document.getElementById('recoveryResultMsg') || document.getElementById('restoreStatusMsg');
  const btn = document.getElementById('btnSendMagicLink'), isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const email = inputEmail ? inputEmail.value.trim() : '';

  if (!email || !email.includes('@')) {
    if (msgBox) {
      msgBox.className = 'restore-status-msg restore-status-recovery-result error';
      msgBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${isEn ? 'Please enter a valid email address.' : 'Por favor, ingresa un correo electrónico válido.'}`;
      msgBox.style.display = 'block';
    }
    return;
  }
  if (btn) { btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEn ? 'Sending link...' : 'Enviando enlace...'}`; btn.disabled = true; }
  try {
    const response = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, lang: isEn ? 'en' : 'es' })
    });
    const result = await response.json();
    if (msgBox) {
      msgBox.className = response.ok ? 'restore-status-msg restore-status-recovery-result success' : 'restore-status-msg restore-status-recovery-result error';
      msgBox.textContent = result.message || (response.ok ? (isEn ? 'Instant access link sent to your inbox.' : 'Enlace de acceso rápido enviado a tu correo.') : (isEn ? 'Could not send access link.' : 'No se pudo enviar el enlace de acceso.'));
      msgBox.style.display = 'block';
      if (response.ok && inputEmail) inputEmail.value = '';
    }
  } catch (error) {
    if (msgBox) {
      msgBox.className = 'restore-status-msg restore-status-recovery-result error';
      msgBox.innerHTML = `<i class="fa-solid fa-network-wired"></i> ${isEn ? 'Connection error. Try again.' : 'Error de conexión. Intenta de nuevo.'}`;
      msgBox.style.display = 'block';
    }
  } finally {
    if (btn) { btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${isEn ? 'Send 1-Click Link' : 'Enviar Enlace Mágico'}`; btn.disabled = false; }
  }
}

// 🛡️ Secreto Comercial: purga automática de contactos volátiles tras inactividad prolongada (>15m)
let _lastActive = Date.now();
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') _lastActive = Date.now();
    else if (document.visibilityState === 'visible' && Date.now() - _lastActive > 15 * 60 * 1000 && Object.keys(cacheContactosDesbloqueados).length > 0) {
      cacheContactosDesbloqueados = {};
      if (typeof renderizarInterfaz === 'function' && datosActuales) renderizarInterfaz(datosActuales);
    }
  });
}
window.solicitarMagicLinkPorCorreo = solicitarMagicLinkPorCorreo;
