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

/**
 * 🔔 MÓDULO DE NOTIFICACIONES TOAST (modules/02-toast.js)
 * Notificaciones flotantes luxury glassmorphism con ambient glow, micro-barra y swipe gestures.
 * Estándar Ecosistema Desmulta UI/UX.
 */

/**
 * Muestra una notificación toast ejecutiva de alta gama con iluminación ambiental,
 * micro-barra de progreso interactiva, soporte de gestos táctiles y modo oscuro/claro.
 * Compatible con la referencia Sonner / Radix Luxury Toast.
 * 
 * @param {string} mensaje - Texto principal o detalle de la alerta
 * @param {'success'|'error'|'warning'|'info'|'vip'} [tipo='success'] - Tipo semántico de notificación
 * @param {string|{title?: string, duration?: number, actionText?: string, onAction?: Function}} [opciones] - Opciones o título manual
 */
function mostrarNotificacionToast(mensaje, tipo = 'success', opciones = {}) {
  // Normalizar opciones
  const opts = typeof opciones === 'string' ? { title: opciones } : (opciones || {});
  let duracionMs = opts.duration || 4500;
  let tipoFinal = tipo;
  let titulo = opts.title || '';
  let mensajeLimpio = String(mensaje || '').trim();

  // Detección e interpretación inteligente de prefijos y emojis
  if (mensajeLimpio.startsWith('👑')) {
    tipoFinal = 'vip';
    if (!titulo) titulo = 'Membresía VIP Pro';
    mensajeLimpio = mensajeLimpio.replace(/^👑\s*/, '');
  } else if (mensajeLimpio.startsWith('🎉')) {
    if (!titulo) titulo = '¡Operación Exitosa!';
    mensajeLimpio = mensajeLimpio.replace(/^🎉\s*/, '');
  } else if (mensajeLimpio.startsWith('📍')) {
    if (!titulo) titulo = 'Cobertura Regional';
    mensajeLimpio = mensajeLimpio.replace(/^📍\s*/, '');
  } else if (mensajeLimpio.startsWith('⚠️')) {
    tipoFinal = 'warning';
    if (!titulo) titulo = 'Aviso del Sistema';
    mensajeLimpio = mensajeLimpio.replace(/^⚠️\s*/, '');
  } else if (mensajeLimpio.startsWith('✅')) {
    if (!titulo) titulo = 'Confirmación';
    mensajeLimpio = mensajeLimpio.replace(/^✅\s*/, '');
  } else if (mensajeLimpio.startsWith('❌')) {
    tipoFinal = 'error';
    if (!titulo) titulo = 'Acceso Restringido';
    mensajeLimpio = mensajeLimpio.replace(/^❌\s*/, '');
  }

  // Títulos por defecto según el tipo si no se asignaron previamente
  if (!titulo) {
    if (tipoFinal === 'vip') titulo = 'Membresía VIP Pro';
    else if (tipoFinal === 'error') titulo = 'Acción Requerida';
    else if (tipoFinal === 'warning') titulo = 'Atención';
    else if (tipoFinal === 'info') titulo = 'Información';
    else titulo = 'Notificación Hunter Pro';
  }

  // Contenedor global de toasts
  let container = document.getElementById('hunterToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'hunterToastContainer';
    container.className = 'hunter-toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  // Si ya hay un toast activo, cerramos el previo de inmediato para evitar sobrecargas
  const toastsExistentes = container.querySelectorAll('.hunter-toast:not(.hunter-toast--closing)');
  if (toastsExistentes.length >= 2) {
    toastsExistentes[0].classList.add('hunter-toast--closing');
    setTimeout(() => toastsExistentes[0].remove(), 280);
  }

  // Selector de Icono SVG de alta fidelidad según el tipo
  let iconoSvg = '';
  if (tipoFinal === 'vip') {
    iconoSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"/></svg>`;
  } else if (tipoFinal === 'error') {
    iconoSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  } else if (tipoFinal === 'warning') {
    iconoSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  } else if (tipoFinal === 'info') {
    iconoSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  } else {
    // success por defecto
    iconoSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  }

  // Generar tarjeta toast
  const toast = document.createElement('div');
  toast.className = `hunter-toast hunter-toast--${tipoFinal}`;
  toast.setAttribute('role', 'alert');

  // Botón de acción opcional
  let actionHtml = '';
  if (opts.actionText) {
    actionHtml = `<button type="button" class="hunter-toast-action-btn">${opts.actionText}</button>`;
  }

  const segundosTotal = Math.round(duracionMs / 1000);

  toast.innerHTML = `
    <div class="hunter-toast-glow"></div>
    <div class="hunter-toast-inner">
      <div class="hunter-toast-icon-wrapper">
        ${iconoSvg}
      </div>
      <div class="hunter-toast-content">
        <div class="hunter-toast-header">
          <h4 class="hunter-toast-title">${titulo}</h4>
          <button type="button" class="hunter-toast-close" aria-label="Cerrar notificación" title="Cerrar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <p class="hunter-toast-description">${mensajeLimpio}</p>
        ${actionHtml}
      </div>
    </div>
    <div class="hunter-toast-footer">
      <span class="hunter-toast-timer-label">Cierra en ${segundosTotal}s · Clic para pausar</span>
      <div class="hunter-toast-progress-track">
        <div class="hunter-toast-progress-bar" style="animation-duration: ${duracionMs}ms;"></div>
      </div>
    </div>
  `;

  container.appendChild(toast);

  // Vincular acción opcional si se suministró callback
  if (opts.onAction && typeof opts.onAction === 'function') {
    const actionBtn = toast.querySelector('.hunter-toast-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onAction();
        cerrarToast();
      });
    }
  }

  // Función de cierre elegante
  let cerrado = false;
  function cerrarToast() {
    if (cerrado) return;
    cerrado = true;
    toast.classList.add('hunter-toast--closing');
    clearTimeout(timeoutId);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 280);
  }

  // Botón de cierre superior
  const closeBtn = toast.querySelector('.hunter-toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cerrarToast();
    });
  }

  // Lógica de temporizador interactivo con soporte para pausa en hover y touch
  let tiempoRestante = duracionMs;
  let tiempoInicio = Date.now();
  let timeoutId = null;
  const timerLabel = toast.querySelector('.hunter-toast-timer-label');

  function iniciarTimer(ms) {
    tiempoInicio = Date.now();
    timeoutId = setTimeout(() => {
      cerrarToast();
    }, ms);
  }

  function pausarTimer() {
    clearTimeout(timeoutId);
    const transcurrido = Date.now() - tiempoInicio;
    tiempoRestante = Math.max(500, tiempoRestante - transcurrido);
    toast.classList.add('hunter-toast--paused');
    if (timerLabel) timerLabel.textContent = 'En pausa · Desliza hacia arriba para cerrar';
  }

  function reanudarTimer() {
    toast.classList.remove('hunter-toast--paused');
    if (timerLabel) timerLabel.textContent = `Cierra en ${Math.ceil(tiempoRestante / 1000)}s · Clic para pausar`;
    iniciarTimer(tiempoRestante);
  }

  // Pausa en hover de escritorio
  toast.addEventListener('mouseenter', pausarTimer);
  toast.addEventListener('mouseleave', reanudarTimer);

  // Gestos táctiles para móviles: pausa en toque y Swipe-Up para descartar
  let touchStartY = 0;
  let touchDiffY = 0;

  toast.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    pausarTimer();
  }, { passive: true });

  toast.addEventListener('touchmove', (e) => {
    touchDiffY = e.touches[0].clientY - touchStartY;
    if (touchDiffY < 0) {
      // Arrastre hacia arriba
      toast.style.transform = `translateY(${Math.max(touchDiffY, -80)}px) scale(${1 + touchDiffY / 500})`;
      toast.style.opacity = `${1 + touchDiffY / 120}`;
    }
  }, { passive: true });

  toast.addEventListener('touchend', () => {
    if (touchDiffY < -40) {
      // Gesto de swipe up confirmado: descartar
      cerrarToast();
    } else {
      // Volver a posición original y reanudar
      toast.style.transform = '';
      toast.style.opacity = '';
      reanudarTimer();
    }
    touchDiffY = 0;
  }, { passive: true });

  // Iniciar la cuenta regresiva inicial
  iniciarTimer(duracionMs);
}

/**
 * Construye la notificación toast personalizada con tono de alta gama y exclusividad según el plan.
 * @param {object} usuario - Datos del usuario autenticado
 * @param {string|null} [tipoProducto] - Tipo de producto adquirido
 * @param {string|null} [ciudad] - Ciudad de cobertura si aplica
 * @returns {{ titulo: string, mensaje: string, tipo: string }}
 */
function generarMensajeBienvenidaToast(usuario, tipoProducto = null, ciudad = null) {
  const pin = usuario?.pin || 'HNT-••••';
  const plan = usuario?.plan || 'free';
  const city = ciudad || usuario?.planCity || 'tu ciudad';

  if (plan === 'national' || tipoProducto === 'subscription_national') {
    return {
      titulo: '👑 ¡Élite Nacional Desbloqueada!',
      mensaje: `¡Bienvenido al Plan Nacional VIP! Tu PIN es ${pin}. Acceso total en toda Colombia y radar de rebajas activado.`,
      tipo: 'vip'
    };
  }

  if (plan === 'city' || tipoProducto === 'subscription_city') {
    return {
      titulo: `👑 ¡Membresía Pro ${city} Activa!`,
      mensaje: `¡Bienvenido! Tu PIN es ${pin}. Disfrutas de acceso ilimitado a propietarios directos de ${city} por 30 días.`,
      tipo: 'vip'
    };
  }

  if (tipoProducto === 'pack_10_leads' || (usuario?.credits >= 10)) {
    return {
      titulo: '⭐ ¡Paquete Pro 10 Contactos Activo!',
      mensaje: `¡Ahorro del 30% asegurado! Tu PIN es ${pin}. Tienes ${usuario?.credits || 10} contactos verificados sin vencimiento.`,
      tipo: 'success'
    };
  }

  return {
    titulo: '🎉 ¡Operación Exitosa!',
    mensaje: `¡Pago aprobado! Tu PIN es ${pin}. Tienes ${usuario?.credits || 1} crédito disponible sin intermediarios.`,
    tipo: 'success'
  };
}

/**
 * 🌐 MÓDULO DE RED Y CLIENTE API (modules/03-api.js)
 * Comunicación HTTP centralizada, inyección de x-trace-id y carga de datasets.
 * Estándar Ecosistema Desmulta DevSecOps.
 */

function generarTraceId() {
  return 'hnt_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
}

/**
 * Carga un archivo JSON y realiza el mapeo dinámico de llaves en la interfaz.
 * @param {string} rutaJson
 */
async function cargarDatos(rutaJson) {
  const container = document.getElementById("bentoGridContainer");
  if (container) {
    container.innerHTML = generarHtmlSkeletons();
  }

  try {
    const res = await fetch(rutaJson);
    if (!res.ok) throw new Error(`HTTP ${res.status}: No se pudo cargar el dataset.`);
    const json = await res.json();
    datosActuales = json;
    limiteVisible = 6;
    renderizarInterfaz(json);
    aplicarFiltrosOmnibox();
  } catch (err) {
    console.error("Error cargando dataset:", err);
    if (container) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: #F43F5E;">
          <p style="font-weight: 800; font-size: 1.1rem;">Error de conexión con la terminal de datos.</p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">${err.message}</p>
        </div>
      `;
    }
  }
}


/**
 * 🔍 MÓDULO DE BÚSQUEDA Y FILTROS (modules/04-filters.js)
 * Normalización de búsqueda fonética/inteligente, omnibox y sincronización de ciudades.
 * Estándar Ecosistema Desmulta.
 */

/**
 * Normaliza una cadena de texto para búsqueda flexible y tolerante a la escritura:
 * - Convierte a minúsculas
 * - Remueve diacríticos y acentos (á->a, é->e, í->i, ó->o, ú->u, ü->u)
 * - Mapea 'ñ' a 'n' para permitir que búsquedas sin eñe (dueno -> dueño) coincidan
 * - Sustituye caracteres de puntuación por espacios
 * - Colapsa espacios redundantes
 * @param {string} str
 * @returns {string}
 */
function normalizarTextoBusqueda(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[.,;:()\-–—_'"/\\#+!¿?¡]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Diccionario de sinónimos, abreviaturas y variantes léxicas en Colombia
 * para búsquedas inmobiliarias y vehiculares de alta precisión.
 */
const DICCIONARIO_TERMINOS = {
  // Tipología Inmobiliaria
  "apto": ["apartamento", "departamento", "apto"],
  "aptos": ["apartamento", "departamento", "apto"],
  "apartamento": ["apartamento", "apto"],
  "apartamentos": ["apartamento", "apto"],
  "ph": ["penthouse", "duplex", "ph"],
  "penthouse": ["penthouse", "ph", "duplex"],
  "duplex": ["duplex", "penthouse"],
  "casa": ["casa", "quinta", "campestre", "chalet"],
  "casas": ["casa", "quinta", "campestre"],
  "lote": ["lote", "terreno", "campestre"],
  "campestre": ["campestre", "quinta", "casa", "lote"],
  "quinta": ["quinta", "campestre", "casa"],
  // Distribución y Ambientes
  "alcoba": ["habitacion", "habitaciones", "hab", "alcoba", "alcobas", "cuarto"],
  "alcobas": ["habitacion", "habitaciones", "hab", "alcoba", "alcobas", "cuarto"],
  "habitacion": ["habitacion", "habitaciones", "hab", "alcoba", "alcobas", "cuarto"],
  "habitaciones": ["habitacion", "habitaciones", "hab", "alcoba", "alcobas", "cuarto"],
  "hab": ["habitacion", "habitaciones", "hab", "alcoba", "alcobas"],
  "cuarto": ["habitacion", "habitaciones", "hab", "alcoba", "alcobas"],
  "bano": ["bano", "banos", "ducha"],
  "banos": ["bano", "banos", "ducha"],
  "garaje": ["garaje", "garajes", "parqueadero", "parqueaderos", "parq", "cochera"],
  "garajes": ["garaje", "garajes", "parqueadero", "parqueaderos", "parq"],
  "parqueadero": ["garaje", "garajes", "parqueadero", "parqueaderos", "parq"],
  "parqueaderos": ["garaje", "garajes", "parqueadero", "parqueaderos", "parq"],
  "parq": ["garaje", "garajes", "parqueadero", "parqueaderos"],
  // Trato Directo y Oportunidad
  "dueno": ["propietario", "particular", "directo", "dueno", "fsbo"],
  "dueño": ["propietario", "particular", "directo", "dueno", "fsbo"],
  "propietario": ["propietario", "particular", "directo", "dueno"],
  "particular": ["propietario", "particular", "directo", "dueno"],
  "directo": ["directo", "dueno", "propietario", "particular"],
  "rebaja": ["rebaja", "descuento", "ganga", "barato", "negociable", "oportunidad"],
  "descuento": ["rebaja", "descuento", "ganga", "arbitraje"],
  "ganga": ["rebaja", "ganga", "oportunidad", "arbitraje"],
  "viaje": ["viaje", "motivo", "urgente"],
  "urgente": ["urgente", "viaje", "motivo", "urgeme", "oportunidad"],
  "arbitraje": ["arbitraje", "descuento", "mediana", "ganga"],
  // Vehículos
  "carro": ["vehiculo", "auto", "camioneta", "sedan", "suv", "carro"],
  "auto": ["vehiculo", "carro", "camioneta", "sedan", "suv"],
  "vehiculo": ["vehiculo", "carro", "camioneta", "auto"],
  "camioneta": ["camioneta", "suv", "pickup", "pick-up", "4x4"],
  "suv": ["suv", "camioneta", "4x4"],
  "pickup": ["pickup", "pick-up", "camioneta", "4x4", "utilitaria"],
  "sedan": ["sedan", "deportivo", "carro", "auto"],
  "4x4": ["4x4", "camioneta", "suv", "pickup"],
  // Ciudades / Sectores
  "bogota": ["bogota", "rosales", "chico", "cundinamarca"],
  "medellin": ["medellin", "poblado", "laureles", "san lucas", "antioquia"],
  "cali": ["cali", "pance", "valle del lili", "valle"],
  "cartagena": ["cartagena", "bocagrande", "bolivar"],
  "pereira": ["pereira", "cerritos", "risaralda", "eje cafetero"],
  "bucaramanga": ["bucaramanga", "floridablanca", "ruitoque", "santander"],
  "floridablanca": ["floridablanca", "bucaramanga", "ruitoque"]
};

/**
 * Evalúa si una tarjeta coincide con la búsqueda del usuario:
 * - Divide la consulta en tokens
 * - Verifica coincidencia directa, sinónimos y prefijos de raíz
 * - Aplica límites de seguridad (máximo 80 caracteres)
 * @param {string} textoTarjetaNormalizado
 * @param {string} busquedaUsuario
 * @returns {boolean}
 */
function coincideBusquedaInteligente(textoTarjetaNormalizado, busquedaUsuario) {
  if (!busquedaUsuario) return true;
  const queryLimpia = normalizarTextoBusqueda(busquedaUsuario.slice(0, 80));
  if (!queryLimpia) return true;

  const tokens = queryLimpia.split(" ").filter(t => t.length > 0);
  if (tokens.length === 0) return true;

  return tokens.every(token => {
    // 1. Coincidencia directa como subcadena
    if (textoTarjetaNormalizado.includes(token)) return true;

    // 2. Coincidencia por sinónimos o variantes léxicas
    const sinonimos = DICCIONARIO_TERMINOS[token];
    if (sinonimos && sinonimos.some(s => textoTarjetaNormalizado.includes(s))) {
      return true;
    }

    // 3. Tolerancia por prefijo (palabra parcial de al menos 4 caracteres)
    if (token.length >= 4) {
      const raiz = token.slice(0, token.length - 1);
      if (textoTarjetaNormalizado.includes(raiz)) return true;
    }

    return false;
  });
}

/**
 * Aplica los filtros combinados (Omnibox de búsqueda libre inteligente, Ciudad y Trato Directo)
 * sobre la grilla de oportunidades Bento.
 */
function aplicarFiltrosOmnibox() {
  limiteVisible = 6;
  if (datosActuales) {
    renderizarInterfaz(datosActuales);
  }
}

/**
 * Restablece todos los filtros del Omnibox a su estado por defecto.
 */
function restablecerTodosLosFiltros() {
  textoBusquedaActivo = "";
  filtroCiudadActivo = "";
  filtroTratoDirectoActivo = false;

  const omnibox = document.getElementById("omniboxSearch");
  if (omnibox) omnibox.value = "";

  const btnClear = document.getElementById("cmdSearchClear");
  if (btnClear) btnClear.classList.remove("visible");

  const labelLocation = document.getElementById("cmdFilterLocationLabel");
  if (labelLocation) labelLocation.textContent = "Colombia (Todas)";

  const pillLocation = document.getElementById("cmdFilterLocation");
  if (pillLocation) {
    pillLocation.classList.remove("active-filter", "open");
    pillLocation.setAttribute("aria-expanded", "false");
  }

  const dropdown = document.getElementById("cmdLocationDropdown");
  if (dropdown) {
    dropdown.classList.remove("show");
    dropdown.querySelectorAll(".cmd-dropdown-item").forEach(item => {
      if (item.getAttribute("data-city") === "") {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });
  }

  const pillType = document.getElementById("cmdFilterType");
  if (pillType) pillType.classList.remove("active-filter");

  aplicarFiltrosOmnibox();
}


/**
 * 🎠 MÓDULO DE CARRUSELES Y FICHA TÉCNICA (modules/05-carousel.js)
 * Carruseles fotográficos táctiles, navegación y drawer slide-up de detalles.
 * Estándar Ecosistema Desmulta UI/UX.
 */

/**
 * Desplaza las diapositivas del carrusel fotográfico.
 * @param {number} cardIndex
 * @param {number} delta
 * @param {number} totalFotos
 * @param {Event} event
 */
function moverCarrusel(cardIndex, delta, totalFotos, event) {
  if (event) event.stopPropagation();
  if (typeof carruselIndices[cardIndex] !== 'number') carruselIndices[cardIndex] = 0;
  
  const actual = carruselIndices[cardIndex];
  const nuevo = (actual + delta + totalFotos) % totalFotos;
  carruselIndices[cardIndex] = nuevo;
  
  actualizarVistaCarrusel(cardIndex, nuevo);
}

/**
 * Mueve el carrusel a una diapositiva específica.
 * @param {number} cardIndex
 * @param {number} targetIndex
 * @param {Event} event
 */
function irACarrusel(cardIndex, targetIndex, event) {
  if (event) event.stopPropagation();
  carruselIndices[cardIndex] = targetIndex;
  actualizarVistaCarrusel(cardIndex, targetIndex);
}

/**
 * Actualiza las clases visuales de slides y dots para un carrusel.
 * @param {number} cardIndex
 * @param {number} activeIndex
 */
function actualizarVistaCarrusel(cardIndex, activeIndex) {
  const track = document.getElementById(`carousel-${cardIndex}`);
  if (!track) return;
  
  const slides = track.querySelectorAll('.carousel-slide');
  slides.forEach((slide, sIdx) => {
    if (sIdx === activeIndex) {
      slide.classList.add('active');
      // Carga bajo demanda de la foto activa si aún no se ha descargado
      const img = slide.querySelector('img[data-src]');
      if (img) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      }
    } else {
      slide.classList.remove('active');
    }
  });

  // Precarga proactiva del siguiente slide para respuesta instantánea sin peso inicial
  if (slides.length > 1) {
    const nextIdx = (activeIndex + 1) % slides.length;
    const nextImg = slides[nextIdx]?.querySelector('img[data-src]');
    if (nextImg) {
      nextImg.src = nextImg.dataset.src;
      nextImg.removeAttribute('data-src');
    }
  }

  const dotsContainer = document.getElementById(`dots-${cardIndex}`);
  if (dotsContainer) {
    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    dots.forEach((dot, dIdx) => {
      if (dIdx === activeIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }
}

/**
 * Abre el panel deslizable de la Ficha Técnica (Slide-Up Drawer).
 * @param {number} index
 * @param {Event} event
 */
function abrirFichaTecnica(index, event) {
  if (event) event.stopPropagation();
  const overlay = document.getElementById(`slideup-${index}`);
  if (overlay) overlay.classList.add('active');
}

/**
 * Cierra el panel deslizable de la Ficha Técnica.
 * @param {number} index
 * @param {Event} event
 */
function cerrarFichaTecnica(index, event) {
  if (event) event.stopPropagation();
  const overlay = document.getElementById(`slideup-${index}`);
  if (overlay) overlay.classList.remove('active');
}


/**
 * 🃏 MÓDULO DE RENDERIZADO BENTO GRID (modules/06-cards.js)
 * Renderizado de oportunidades, skeletons, badges ejecutivos y formateo de precios.
 * Estándar Ecosistema Desmulta UI/UX.
 */

/**
 * Sanitización de texto HTML para prevenir inyecciones.
 * @param {string} texto
 * @returns {string}
 */
function escaparHtml(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Formatea visualmente un precio con el símbolo $ separado sutilmente
 * de la cifra numérica, sin mostrar jamás la palabra 'COP'.
 * @param {string} precioStr - Cadena de precio (ej. "$ 1.250.000.000")
 * @returns {string} HTML estilizado con separación visual limpia
 */
function formatearPrecioDisplay(precioStr) {
  if (!precioStr) return '<span class="price-currency-sign">$</span> <span class="price-number">0</span>';
  let str = String(precioStr).replace(/COP|USD|pesos/gi, '').trim();
  if (str.startsWith('$')) {
    str = str.substring(1).trim();
  }
  return `<span class="price-currency-sign">$</span> <span class="price-number">${escaparHtml(str)}</span>`;
}

/**
 * Genera el marcado de tarjetas esqueleto (Skeleton Loading) con efecto Shimmer.
 * @returns {string}
 */
function generarHtmlSkeletons() {
  return Array(3).fill(0).map((_, i) => `
    <article class="bento-card skeleton-card" style="--enter-delay: ${i * 0.08}s;">
      <div class="skeleton-media skeleton-shimmer"></div>
      <div class="card-body" style="padding: 1.25rem; gap: 0.85rem;">
        <div class="skeleton-line skeleton-shimmer" style="width: 45%; height: 14px;"></div>
        <div class="skeleton-line skeleton-shimmer" style="width: 80%; height: 22px;"></div>
        <div class="skeleton-box skeleton-shimmer" style="height: 64px; border-radius: 1.25rem;"></div>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 0.75rem;">
          <div class="skeleton-line skeleton-shimmer" style="width: 45%; height: 26px;"></div>
          <div class="skeleton-btn skeleton-shimmer" style="width: 38%; height: 38px;"></div>
        </div>
      </div>
    </article>
  `).join('');
}


/**
 * Renderiza la interfaz utilizando Mapeo Dinámico de Llaves (Content-Agnostic) y Dark Luxury Cards.
 * Estructura de Curvatura 2.5rem y Fusión de Imagen Impecable (h-32 y -mt-4).
 * @param {Object} dataset
 */
function renderizarInterfaz(dataset) {
  const config = dataset.config || {};
  const leads = dataset.leads || [];

  // Actualizar textos de cabecera dinámicos
  const elTitle = document.getElementById("heroTitle");
  const elSubtitle = document.getElementById("heroSubtitle");
  const elBadgeSectores = document.getElementById("badgeSectores");
  const elBadgeSectoresHero = document.getElementById("badgeSectoresHero");

  if (elTitle && config.titulo_modulo) {
    // [SEGURIDAD] Mitigación XSS (Cross-Site Scripting)
    // Se sanitizan todos los tags HTML excepto la etiqueta <span> autorizada para cursivas
    const sanitizedTitle = config.titulo_modulo
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/&lt;span class="editorial-italic"&gt;/gi, '<span class="editorial-italic">')
      .replace(/&lt;\/span&gt;/gi, '</span>');
    elTitle.innerHTML = sanitizedTitle;
  }
  if (elSubtitle && config.subtitulo) elSubtitle.textContent = config.subtitulo;
  if (config.total_sectores_monitoreados) {
    const txtSectores = `${config.total_sectores_monitoreados} Sectores Monitoreados en Tiempo Real`;
    if (elBadgeSectores) elBadgeSectores.textContent = txtSectores;
    if (elBadgeSectoresHero) elBadgeSectoresHero.textContent = txtSectores;
  }

  // Actualizar metadatos de la cabecera de catálogo
  const countEl = document.getElementById("catalogCountText");
  if (countEl) {
    countEl.textContent = `${leads.length} oportunidades directas`;
  }
  const headingEl = document.getElementById("catalogHeading");
  if (headingEl) {
    const esVehiculoModulo = (config.titulo_modulo && config.titulo_modulo.toLowerCase().includes('vehículo'));
    headingEl.textContent = esVehiculoModulo ? "Vehículos con Margen en Vivo" : "Inmuebles Directos en Vivo";
  }

  // Renderizar la grilla Bento
  const container = document.getElementById("bentoGridContainer");
  if (!container) return;

  if (leads.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 5rem 1rem; color: var(--text-muted);">
        <p style="font-weight: 700;">No hay oportunidades activas registradas en este momento.</p>
      </div>
    `;
    return;
  }

  const col1Nombre = config.columna_variable_1 || "Atributo 1";
  const col2Nombre = config.columna_variable_2 || "Atributo 2";

  // 1. Filtrar leads por ciudad y búsqueda de texto ANTES de paginar
  const leadsFiltrados = leads.filter(item => {
    // A. Filtro por Ciudad
    if (filtroCiudadActivo) {
      const ciudadesObjetivo = filtroCiudadActivo.split("|").map(normalizarTextoBusqueda);
      const itemCiudadNorm = normalizarTextoBusqueda(item.ciudad || "");
      const itemUbicNorm = normalizarTextoBusqueda(item.ubicacion || "");
      const itemTituloNorm = normalizarTextoBusqueda(item.titulo || "");
      const itemBarrioNorm = normalizarTextoBusqueda(item.barrio || "");
      const coincideCiudad = ciudadesObjetivo.some(c => 
        itemCiudadNorm.includes(c) || itemUbicNorm.includes(c) || itemTituloNorm.includes(c) || itemBarrioNorm.includes(c)
      );
      if (!coincideCiudad) return false;
    }
    // B. Filtro por Texto Libre
    if (textoBusquedaActivo) {
      const itemSearchText = normalizarTextoBusqueda(
        `${item.titulo || ''} ${item.ciudad || ''} ${item.ubicacion || ''} ${item.barrio || ''} ${item.precio || ''} ${item.detalles ? Object.values(item.detalles).join(' ') : ''}`
      );
      if (!coincideBusquedaInteligente(itemSearchText, textoBusquedaActivo)) return false;
    }
    return true;
  });

  // Actualizar metadatos de la cabecera de catálogo con el conteo real filtrado
  if (countEl) {
    const sufijoCiudad = filtroCiudadActivo ? ` en ${filtroCiudadActivo}` : '';
    countEl.textContent = `${leadsFiltrados.length} oportunidad${leadsFiltrados.length === 1 ? '' : 'es'} directa${leadsFiltrados.length === 1 ? '' : 's'}${sufijoCiudad}`;
  }

  // Estado vacío si no hay coincidencias
  if (leadsFiltrados.length === 0) {
    const ciudadTexto = filtroCiudadActivo ? ` en ${filtroCiudadActivo}` : '';
    const querySegura = escaparHtml((textoBusquedaActivo || "").slice(0, 40).trim());
    const busquedaTexto = querySegura ? ` para "${querySegura}"` : '';
    container.innerHTML = `
      <div class="empty-catalog-state" id="emptyCatalogState" style="grid-column: 1/-1;">
        <div class="empty-state-icon-box">
          <i class="fa-solid fa-filter-circle-xmark"></i>
        </div>
        <div class="empty-state-content">
          <h3 class="empty-state-title">Sin oportunidades en esta zona</h3>
          <p class="empty-state-desc">No se encontraron avisos directos${busquedaTexto}${ciudadTexto}. Puedes explorar otras ciudades o restablecer los filtros.</p>
        </div>
        <button type="button" class="btn-empty-reset" id="btnResetFilters">
          <i class="fa-solid fa-rotate-left"></i> Restablecer todos los filtros
        </button>
      </div>
    `;
    const btnReset = document.getElementById("btnResetFilters");
    if (btnReset) {
      btnReset.addEventListener("click", restablecerTodosLosFiltros);
    }
    return;
  }

  const leadsVisibles = leadsFiltrados.slice(0, limiteVisible);
  const tieneMasLeads = leadsFiltrados.length > limiteVisible;
  const restantes = leadsFiltrados.length - limiteVisible;

  let htmlContenido = leadsVisibles.map((item) => {
    const index = dataset.leads.indexOf(item);
    const claseUrgencia = item.urgencia_tipo || "urgente";
    const imgUrl = item.imagen || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80";
    const tieneMultiplesFotos = Array.isArray(item.imagenes) && item.imagenes.length > 1;
    const fotos = tieneMultiplesFotos ? item.imagenes : [imgUrl];

    // Renderizado condicional del carrusel vs imagen estática limpia (Mandato del usuario)
    let mediaHtml = '<div class="card-media-wrapper">';
    if (tieneMultiplesFotos) {
      mediaHtml += `
        <div class="carousel-track" id="carousel-${index}">
          ${fotos.map((foto, fIdx) => `
            <div class="carousel-slide ${fIdx === 0 ? 'active' : ''}" data-slide="${fIdx}">
              ${fIdx === 0 ? `
                <img src="${escaparHtml(foto)}" alt="${escaparHtml(item.titulo)} - Foto 1" class="carousel-img" ${index < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />
              ` : `
                <img data-src="${escaparHtml(foto)}" alt="${escaparHtml(item.titulo)} - Foto ${fIdx + 1}" class="carousel-img" loading="lazy" decoding="async" />
              `}
            </div>
          `).join('')}
          
          <!-- Flechas de navegación (Aparecen en Hover) -->
          <button class="carousel-nav-btn prev" data-action="carrusel-prev" data-index="${index}" data-total="${fotos.length}" title="Foto Anterior">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <button class="carousel-nav-btn next" data-action="carrusel-next" data-index="${index}" data-total="${fotos.length}" title="Siguiente Foto">
            <i class="fa-solid fa-chevron-right"></i>
          </button>

          <!-- Puntos indicadores de foto -->
          <div class="carousel-dots" id="dots-${index}">
            ${fotos.map((_, fIdx) => `
              <span class="carousel-dot ${fIdx === 0 ? 'active' : ''}" data-dot="${fIdx}"></span>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      mediaHtml += `
        <img src="${escaparHtml(imgUrl)}" alt="${escaparHtml(item.titulo)}" class="card-static-img" ${index < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />
      `;
    }
    mediaHtml += '</div>';

    const esVehiculo = (config.titulo_modulo && config.titulo_modulo.toLowerCase().includes('vehículo')) || (item.tipo_inmueble && (item.tipo_inmueble.toLowerCase().includes('sedán') || item.tipo_inmueble.toLowerCase().includes('pick-up') || item.tipo_inmueble.toLowerCase().includes('suv')));

    // Preparar especificaciones para la Ficha de Detalles
    const detalles = item.detalles || {
      [col1Nombre]: item.dato_1 || "No especificado",
      [col2Nombre]: item.dato_2 || "No especificado",
      "Ubicación": item.ubicacion || "Colombia",
      "Tipo": item.tipo_inmueble || (esVehiculo ? "Vehículo" : "Propiedad"),
      "Operación": esVehiculo ? "Venta Directa Particular" : "Venta Directa con Propietario"
    };

    // Solo las 2 primeras tarjetas del viewport inicial llevan un retardo sutil de 0.08s
    const enterDelay = index < 2 ? (index * 0.08) : 0;

    const detallesStr = item.detalles ? Object.entries(item.detalles).map(([k, v]) => `${k} ${v}`).join(' ') : '';
    const corpusBruto = [
      item.titulo,
      item.ubicacion,
      item.barrio,
      item.ciudad,
      item.tipo_inmueble,
      item.urgencia,
      item.rebaja,
      item.dato_1,
      item.dato_2,
      item.precio,
      item.precio_m2,
      detallesStr,
      esVehiculo ? 'vehiculo carro auto particular' : 'inmueble propiedad vivienda particular directo dueno'
    ].filter(Boolean).join(' ');

    const searchDataCorpus = normalizarTextoBusqueda(corpusBruto);
    const ciudadNorm = normalizarTextoBusqueda(item.ciudad || '');
    const barrioNorm = normalizarTextoBusqueda(item.barrio || '');

    const estaDesbloqueado = sesionUsuario && Array.isArray(sesionUsuario.unlockedLeads) && sesionUsuario.unlockedLeads.includes(item.id);
    const contacto = estaDesbloqueado ? (cacheContactosDesbloqueados[item.id] || null) : null;
    const portalNombre = item.portal || ((item.enlace_bloqueado || item.enlace || '').toLowerCase().includes('metrocuadrado') ? 'Metrocuadrado' : 'Finca Raíz');

    return `
      <article class="bento-card ${estaDesbloqueado ? 'card-unlocked' : ''}" data-index="${index}" data-lead-id="${escaparHtml(item.id || '')}" data-ciudad="${escaparHtml(item.ciudad || '')}" data-ciudad-norm="${escaparHtml(ciudadNorm)}" data-barrio-norm="${escaparHtml(barrioNorm)}" data-tipo="${escaparHtml(item.tipo_inmueble || '')}" data-search="${escaparHtml(searchDataCorpus)}" style="--enter-delay: ${enterDelay}s;">
        <!-- Cabecera Fotográfica con Fusión Degradada -->
        <div class="card-media-wrapper" data-action="abrir-ficha" data-index="${index}">
          ${mediaHtml}

          <!-- Degradado de fusión profunda (El secreto de 8rem del usuario) -->
          <div class="card-media-gradient"></div>

          <!-- Badges Superiores Flotantes (Izquierda) -->
          <div class="card-floating-badges">
            <span class="badge-time-pill">
              <i class="fa-regular fa-clock"></i> ${escaparHtml(item.fecha_relativa || 'Reciente')}
            </span>
            ${estaDesbloqueado ? `
              <span class="card-unlocked-badge"><i class="fa-solid fa-unlock"></i> Desbloqueado</span>
            ` : (item.urgencia ? `
              <span class="badge-status-pill ${claseUrgencia}">
                ${escaparHtml(item.urgencia)}
              </span>
            ` : '')}
          </div>
        </div>

        <!-- Cuerpo de la Tarjeta (Montado físicamente -mt-4 sobre la foto) -->
        <div class="card-body">
          <div>
            <div class="card-meta-header">
              <span class="card-location">
                <i class="fa-solid fa-location-dot"></i> ${escaparHtml(item.ubicacion)}
              </span>
              <button class="btn-specs-pill" data-action="abrir-ficha" data-index="${index}" title="Ver Detalles Completos">
                Ver Detalles <i class="fa-solid fa-chevron-up"></i>
              </button>
            </div>

            <h3 class="card-title" data-action="abrir-ficha" data-index="${index}">${escaparHtml(item.titulo)}</h3>

            <!-- Panel de Especificaciones Dinámicas (Inspirado en el bloque del usuario) -->
            <div class="card-specs-panel" data-action="abrir-ficha" data-index="${index}" title="Click para abrir especificaciones completas">
              <div class="specs-row">
                <div class="spec-item">
                  <span class="spec-label">${escaparHtml(col1Nombre)}</span>
                  <span class="spec-value">${escaparHtml(item.dato_1 || 'N/A')}</span>
                </div>
                <div class="spec-item">
                  <span class="spec-label">${escaparHtml(col2Nombre)}</span>
                  <span class="spec-value">${escaparHtml(item.dato_2 || 'N/A')}</span>
                </div>
              </div>
            </div>

            ${(estaDesbloqueado && contacto) ? `
              <div class="card-contact-phone-bar">
                <span><i class="fa-solid fa-phone"></i> <strong class="contact-phone-number">${escaparHtml(contacto.telefono || 'Ver en Anuncio')}</strong></span>
                <span class="unlocked-portal-pill"><i class="fa-solid fa-building-flag"></i> ${escaparHtml(portalNombre)}</span>
              </div>
            ` : ''}
          </div>

          <!-- Bloque Inferior: Precio Publicado y Acciones de Contacto -->
          <div class="card-bottom-row">
            <div class="pricing-column">
              <span class="pricing-label">Precio Publicado</span>
              <div class="price-main">${formatearPrecioDisplay(item.precio)}</div>
              ${item.precio_m2 ? `
                <div>
                  <span class="unit-rate-badge">${escaparHtml(item.precio_m2)}</span>
                </div>
              ` : ''}
            </div>

            ${estaDesbloqueado ? `
              <div class="unlocked-action-cluster" style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                ${contacto?.whatsappUrl ? `
                  <a href="${contacto.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-direct" style="text-decoration: none; padding: 7px 10px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 5px;" title="Chatear por WhatsApp">
                    <i class="fa-brands fa-whatsapp"></i> WhatsApp
                  </a>
                ` : ''}
                ${contacto?.telLlamar ? `
                  <a href="tel:${contacto.telLlamar}" class="btn-call-direct" style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); color: #60a5fa; padding: 7px 9px; border-radius: 8px; font-weight: 700; font-size: 0.78rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" title="Llamar al dueño">
                    <i class="fa-solid fa-phone"></i> Llamar
                  </a>
                ` : ''}
                ${contacto?.enlace ? `
                  <a href="${contacto.enlace}" target="_blank" rel="noopener noreferrer" class="btn-portal-direct" style="background: rgba(255, 255, 255, 0.08); border: 1px solid var(--border-color); color: var(--text-color); padding: 7px 9px; border-radius: 8px; font-weight: 600; font-size: 0.78rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" title="Ver Anuncio Original en Portal">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Anuncio
                  </a>
                ` : `
                  <button class="btn-whatsapp-direct" data-action="contactar-whatsapp" data-index="${index}" title="Revelar contacto y enlace del propietario">
                    <i class="fa-solid fa-unlock"></i> Revelar Contacto
                  </button>
                `}
              </div>
            ` : `
              <button class="btn-unlock-lead ${item.urgencia_tipo === 'cerrado' ? 'closed' : ''}" data-action="abrir-checkout" data-index="${index}">
                <i class="fa-solid fa-lock"></i> ${item.urgencia_tipo === 'cerrado' ? 'Ver Cierre' : 'Desbloquear'}
              </button>
            `}
          </div>
        </div>

        <!-- Overlay de Detalles Deslizable (Slide-Up Drawer Integrado) -->
        <div class="card-slideup-overlay" id="slideup-${index}">
          <div class="slideup-header">
            <div class="slideup-title">
              <i class="fa-solid fa-circle-info"></i> ${esVehiculo ? 'Detalles del Vehículo' : 'Detalles de la Propiedad'}
            </div>
            <button class="btn-slideup-close" data-action="cerrar-ficha" data-index="${index}" title="Cerrar Detalles">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="slideup-body">
            <!-- Grid de Características Simétricas -->
            <div class="slideup-specs-grid">
              ${Object.entries(detalles).map(([k, v]) => {
                const kLow = k.toLowerCase();
                const iconClass = kLow.includes('estrato') ? 'fa-layer-group' : (kLow.includes('área') || kLow.includes('superficie')) ? 'fa-ruler-combined' : kLow.includes('hab') ? 'fa-bed' : kLow.includes('baño') ? 'fa-bath' : (kLow.includes('garaje') || kLow.includes('parqueadero')) ? 'fa-square-parking' : kLow.includes('contacto') ? 'fa-user-shield' : 'fa-circle-info';
                const vNorm = String(v || 'N/A').replace(/\b1 espacios\b/gi, '1 espacio').replace(/\b1 alcobas\b/gi, '1 alcoba').replace(/\b1 completos\b/gi, '1 completo');
                return `
                  <div class="slideup-spec-card">
                    <span class="slideup-spec-key"><i class="fa-solid ${iconClass}"></i> ${escaparHtml(k)}</span>
                    <span class="slideup-spec-val">${escaparHtml(vNorm)}</span>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Bloque de Confianza: Trato Directo Sin Intermediarios -->
            <div class="slideup-trust-card">
              <div class="trust-badge">
                <i class="fa-solid fa-shield-halved"></i> ${esVehiculo ? 'Trato Directo con el Dueño' : 'Trato Directo con el Propietario'}
              </div>
              <p class="trust-desc">
                ${esVehiculo 
                  ? 'Vehículo publicado directamente por su dueño. Sin intermediarios ni comisiones de concesionario, listo para negociar por llamada o WhatsApp.' 
                  : 'Propiedad publicada directamente por su dueño. Sin inmobiliarias ni comisiones intermedias, lista para negociar por llamada o WhatsApp.'}
              </p>
            </div>

            <!-- Grupo de Acción: Botón CTA y Micro-Garantía -->
            <div class="slideup-action-group">
              ${estaDesbloqueado ? `
                <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                  <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 8px; padding: 10px 12px;">
                    <div style="font-size: 0.75rem; color: #10b981; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">
                      <i class="fa-solid fa-unlock"></i> Datos de Contacto Desbloqueados
                    </div>
                    <div style="font-size: 1.05rem; font-weight: 700; color: #fff; font-family: monospace;">
                      ${contacto?.telefono ? escaparHtml(contacto.telefono) : 'Consultando contacto...'}
                    </div>
                  </div>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${contacto?.whatsappUrl ? `
                      <a href="${contacto.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn btn-whatsapp-direct" style="flex: 1; min-width: 120px; justify-content: center; text-decoration: none;">
                        <i class="fa-brands fa-whatsapp"></i> WhatsApp
                      </a>
                    ` : ''}
                    ${contacto?.telLlamar ? `
                      <a href="tel:${contacto.telLlamar}" class="slideup-cta-btn" style="flex: 1; min-width: 100px; justify-content: center; background: rgba(59, 130, 246, 0.2); border: 1px solid #3b82f6; color: #93c5fd; text-decoration: none;">
                        <i class="fa-solid fa-phone"></i> Llamar
                      </a>
                    ` : ''}
                    ${contacto?.enlace ? `
                      <a href="${contacto.enlace}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn" style="flex: 1; min-width: 120px; justify-content: center; background: rgba(255, 255, 255, 0.08); border: 1px solid var(--border-color); color: var(--text-color); text-decoration: none;">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Anuncio
                      </a>
                    ` : `
                      <button class="slideup-cta-btn btn-whatsapp-direct" style="width: 100%; justify-content: center;" data-action="contactar-whatsapp" data-index="${index}">
                        <i class="fa-solid fa-unlock"></i> Revelar Contacto Directo
                      </button>
                    `}
                  </div>
                  <span class="slideup-cta-note" style="color: #22C55E;">
                    <i class="fa-solid fa-check-double"></i> Contacto y enlace directo desbloqueados para tu cuenta
                  </span>
                </div>
              ` : `
                <button class="slideup-cta-btn" data-action="slideup-cta" data-index="${index}">
                  <i class="fa-solid fa-unlock-keyhole"></i> Desbloquear Contacto del Dueño
                </button>
                <span class="slideup-cta-note">
                  <i class="fa-solid fa-bolt"></i> Acceso al instante • Sin pagar comisiones
                </span>
              `}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  if (tieneMasLeads) {
    htmlContenido += `
      <div class="pagination-row" id="paginationRow">
        <button type="button" class="btn-load-more" id="btnLoadMoreLeads">
          <i class="fa-solid fa-angles-down"></i>
          <span>Cargar más oportunidades directas (+${restantes} disponibles)</span>
        </button>
      </div>
    `;
  }

  container.innerHTML = htmlContenido;

  if (tieneMasLeads) {
    const btnCargar = document.getElementById("btnLoadMoreLeads");
    if (btnCargar) {
      btnCargar.addEventListener("click", () => {
        limiteVisible += 6;
        renderizarInterfaz(dataset);
        setTimeout(() => {
          const nuevasTarjetas = container.querySelectorAll(".bento-card");
          if (nuevasTarjetas.length > leadsVisibles.length) {
            nuevasTarjetas[leadsVisibles.length].scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }, 120);
      });
    }
  }

  // Activar el Scroll Reveal progresivo con inercia para scroll móvil
  iniciarScrollReveal();
}


/**
 * 🔓 MÓDULO DE DESBLOQUEO DE CONTACTOS (modules/07-unlock.js)
 * Desbloqueo atómico de propietarios, actualización de tarjeta en DOM y enlace a WhatsApp.
 * Estándar Ecosistema Desmulta Seguridad.
 */

/**
 * Maneja el clic en "Desbloquear": si tiene créditos desbloquea directo, sino abre checkout.
 * @param {number} index
 */
async function manejarClicDesbloquear(index) {
  if (!datosActuales?.leads || !datosActuales.leads[index]) return;
  const lead = datosActuales.leads[index];
  leadSeleccionado = lead;

  const tienePlanActivo = sesionUsuario?.plan === 'national' || sesionUsuario?.plan === 'city';
  const tieneCreditos = sesionUsuario && Number(sesionUsuario.credits || 0) >= 1;

  if (sesionUsuario && (tieneCreditos || tienePlanActivo)) {
    await ejecutarDesbloqueoLead(lead, index);
  } else {
    abrirModalCheckout(index, 'comprar');
  }
}

/**
 * Actualiza quirúrgicamente una tarjeta en el DOM sin recargar la grilla ni parpadear.
 * @param {string} leadId
 * @param {object} contacto
 * @param {number|undefined} index
 */
function actualizarTarjetaEnElDOM(leadId, contacto, index) {
  const card = document.querySelector(`.bento-card[data-lead-id="${leadId}"]`) || 
               (typeof index === 'number' ? document.querySelector(`.bento-card[data-index="${index}"]`) : null);
  if (!card) {
    renderizarInterfaz(datosActuales);
    return;
  }

  card.classList.add('card-unlocked');

  // 1. Badge superior flotante de "Desbloqueado"
  const floatingBadges = card.querySelector('.card-floating-badges');
  if (floatingBadges) {
    let unlockedBadge = floatingBadges.querySelector('.card-unlocked-badge');
    if (!unlockedBadge) {
      unlockedBadge = document.createElement('span');
      unlockedBadge.className = 'card-unlocked-badge';
      unlockedBadge.innerHTML = '<i class="fa-solid fa-unlock"></i> Desbloqueado';
      const statusPill = floatingBadges.querySelector('.badge-status-pill');
      if (statusPill) statusPill.remove();
      floatingBadges.appendChild(unlockedBadge);
    }
  }

  // 2. Barra de teléfono revelado en el cuerpo
  const cardBody = card.querySelector('.card-body');
  if (cardBody && contacto) {
    let phoneBar = cardBody.querySelector('.card-contact-phone-bar');
    if (!phoneBar) {
      phoneBar = document.createElement('div');
      phoneBar.className = 'card-contact-phone-bar';
      phoneBar.style.cssText = 'margin-top: 8px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem;';
      const specsPanel = cardBody.querySelector('.card-specs-panel');
      if (specsPanel && specsPanel.parentNode) {
        specsPanel.parentNode.insertBefore(phoneBar, specsPanel.nextSibling);
      } else {
        cardBody.appendChild(phoneBar);
      }
    }
    phoneBar.innerHTML = `
      <span><i class="fa-solid fa-phone"></i> <strong class="contact-phone-number">${escaparHtml(contacto.telefono || 'Ver en Anuncio')}</strong></span>
      <span class="unlocked-portal-pill"><i class="fa-solid fa-building-flag"></i> ${escaparHtml(contacto.portal || 'Finca Raíz')}</span>
    `;
  }

  // 3. Botones de acción directa (WhatsApp, Llamar, Ver Anuncio)
  const bottomRow = card.querySelector('.card-bottom-row');
  if (bottomRow) {
    const existingCluster = bottomRow.querySelector('.unlocked-action-cluster');
    const existingUnlockBtn = bottomRow.querySelector('.btn-unlock-lead');
    const existingDirectBtn = bottomRow.querySelector('button[data-action="contactar-whatsapp"]');
    
    const cluster = existingCluster || document.createElement('div');
    cluster.className = 'unlocked-action-cluster';
    cluster.style.cssText = 'display: flex; gap: 6px; align-items: center; flex-wrap: wrap;';
    cluster.innerHTML = `
      ${contacto?.whatsappUrl ? `
        <a href="${contacto.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-direct" style="text-decoration: none; padding: 7px 10px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 5px;" title="Chatear por WhatsApp">
          <i class="fa-brands fa-whatsapp"></i> WhatsApp
        </a>
      ` : ''}
      ${contacto?.telLlamar ? `
        <a href="tel:${contacto.telLlamar}" class="btn-call-direct" style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); color: #60a5fa; padding: 7px 9px; border-radius: 8px; font-weight: 700; font-size: 0.78rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" title="Llamar al dueño">
          <i class="fa-solid fa-phone"></i> Llamar
        </a>
      ` : ''}
      ${contacto?.enlace ? `
        <a href="${contacto.enlace}" target="_blank" rel="noopener noreferrer" class="btn-portal-direct" style="background: rgba(255, 255, 255, 0.08); border: 1px solid var(--border-color); color: var(--text-color); padding: 7px 9px; border-radius: 8px; font-weight: 600; font-size: 0.78rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" title="Ver Anuncio Original en Portal">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Anuncio
        </a>
      ` : ''}
    `;

    if (existingUnlockBtn) existingUnlockBtn.replaceWith(cluster);
    else if (existingDirectBtn) existingDirectBtn.replaceWith(cluster);
    else if (!existingCluster) bottomRow.appendChild(cluster);
  }

  // 4. Actualizar el Slide-Up Drawer si existe en el DOM
  const cardIndex = card.getAttribute('data-index');
  const slideup = document.getElementById(`slideup-${cardIndex}`);
  if (slideup) {
    const actionGroup = slideup.querySelector('.slideup-action-group');
    if (actionGroup) {
      actionGroup.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${contacto?.whatsappUrl ? `
              <a href="${contacto.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn btn-whatsapp-direct" style="flex: 1; min-width: 120px; justify-content: center; text-decoration: none;">
                <i class="fa-brands fa-whatsapp"></i> WhatsApp
              </a>
            ` : ''}
            ${contacto?.telLlamar ? `
              <a href="tel:${contacto.telLlamar}" class="slideup-cta-btn" style="flex: 1; min-width: 100px; justify-content: center; background: rgba(59, 130, 246, 0.2); border: 1px solid #3b82f6; color: #93c5fd; text-decoration: none;">
                <i class="fa-solid fa-phone"></i> Llamar
              </a>
            ` : ''}
            ${contacto?.enlace ? `
              <a href="${contacto.enlace}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn" style="flex: 1; min-width: 120px; justify-content: center; background: rgba(255, 255, 255, 0.08); border: 1px solid var(--border-color); color: var(--text-color); text-decoration: none;">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Anuncio
              </a>
            ` : ''}
          </div>
          <span class="slideup-cta-note" style="color: #22C55E;">
            <i class="fa-solid fa-check-double"></i> Contacto y enlace directo desbloqueados para tu cuenta
          </span>
        </div>
      `;
    }
  }
}

/**
 * Desbloquea un lead llamando a /api/leads/unlock y descifrando el contacto en backend.
 * @param {object} lead
 * @param {number|undefined} index
 */
async function ejecutarDesbloqueoLead(lead, index) {
  if (!sesionUsuario || !sesionUsuario.token) {
    abrirModalCheckout(index, 'comprar');
    return;
  }

  const selector = typeof index === 'number' ? `.bento-card[data-index="${index}"] .btn-unlock-lead` : null;
  const btn = selector ? document.querySelector(selector) : (typeof index === 'number' ? document.querySelector(`.bento-card[data-index="${index}"] button[data-action="contactar-whatsapp"]`) : null);
  const textoOriginal = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Desbloqueando...';
    btn.disabled = true;
  }

  try {
    const res = await fetch('/api/leads/unlock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sesionUsuario.token}`
      },
      body: JSON.stringify({
        leadId: lead.id,
        contactoCifrado: lead.contacto_cifrado || '',
        leadCity: lead.ciudad || lead.ubicacion || lead.barrio || ''
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (res.status === 403 && data.error === 'PLAN_CIUDAD_DIFERENTE') {
        mostrarNotificacionToast(`📍 ${data.message || 'Tu membresía no cubre esta ciudad.'}`, 'error');
        abrirModalCheckout(index, 'comprar');
        return;
      }
      if (res.status === 402) {
        mostrarNotificacionToast('⚠️ Saldo insuficiente para desbloquear este contacto.', 'error');
        abrirModalCheckout(index, 'comprar');
        return;
      }
      throw new Error(data.error || 'Error al desbloquear contacto');
    }

    sesionUsuario.credits = data.creditsRemaining;
    if (data.token) {
      localStorage.setItem('hunter_pro_token', data.token);
      sesionUsuario.token = data.token;
    }
    if (Array.isArray(data.unlockedLeads)) {
      sesionUsuario.unlockedLeads = data.unlockedLeads;
    } else {
      if (!sesionUsuario.unlockedLeads) sesionUsuario.unlockedLeads = [];
      if (!sesionUsuario.unlockedLeads.includes(lead.id)) {
        sesionUsuario.unlockedLeads.push(lead.id);
      }
    }
    cacheContactosDesbloqueados[lead.id] = data.contacto;
    try {
      localStorage.setItem('hunter_unlocked_contacts', JSON.stringify(cacheContactosDesbloqueados));
    } catch (e) {}

    cerrarModalCheckout();
    actualizarBadgeVip();
    actualizarTarjetaEnElDOM(lead.id, data.contacto, index);

    let mensajeExito = '';
    if (data.alreadyUnlocked) {
      mensajeExito = '✅ Inmueble ya desbloqueado (Costo 0 créditos).';
    } else if (data.planBenefit) {
      mensajeExito = '👑 ¡Contacto desbloqueado sin costo por tu Membresía Pro!';
    } else {
      mensajeExito = `🎉 ¡Contacto desbloqueado! Saldo restante: ${data.creditsRemaining} créditos.`;
    }
    mostrarNotificacionToast(mensajeExito);

    // Eliminada la redirección automática a WhatsApp para mostrar el PIN primero
    /* if (data.contacto?.whatsappUrl) {
      window.open(data.contacto.whatsappUrl, '_blank');
    } */
  } catch (err) {
    console.error('[Desbloqueo] Error:', err);
    mostrarNotificacionToast(err.message || 'Error de conexión', 'error');
  } finally {
    if (btn) {
      btn.innerHTML = textoOriginal;
      btn.disabled = false;
    }
  }
}

/**
 * Maneja el clic en "Chatear Propietario" de un inmueble previamente desbloqueado.
 * @param {number} index
 */
async function manejarContactoWhatsapp(index) {
  if (!datosActuales?.leads || !datosActuales.leads[index]) return;
  const lead = datosActuales.leads[index];

  const contacto = cacheContactosDesbloqueados[lead.id];
  if (contacto?.whatsappUrl) {
    window.open(contacto.whatsappUrl, '_blank');
    return;
  }
  if (contacto?.enlace) {
    window.open(contacto.enlace, '_blank');
    return;
  }

  await ejecutarDesbloqueoLead(lead, index);
}

/**
 * 💳 MÓDULO DE CHECKOUT Y PASARELA WOMPI (modules/08-checkout.js)
 * Modal de compra, selector de planes, orquestación del widget Wompi
 * y gestión de 3 pestañas de cuenta con perfil VIP enriquecido.
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
    if (elPin) elPin.textContent = `PIN: ${sesionUsuario.pin}`;
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
      if (cardCredits) cardCredits.classList.add('vip-mode');
      if (badgeWrap) badgeWrap.style.display = 'block';
      if (badgeEl) badgeEl.innerHTML = `<i class="fa-solid fa-crown"></i> Plan Pro Ciudad (${cNom})`;
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
          <li><i class="fa-solid fa-check"></i> Propietarios directos sin gasto de créditos en ${cNom}.</li>
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

              const notif = typeof generarMensajeBienvenidaToast === 'function'
                ? generarMensajeBienvenidaToast(sesionUsuario, productType, ciudad)
                : { titulo: '🎉 ¡Pago Exitoso!', mensaje: `PIN: ${claimData.user.pin}`, tipo: 'success' };
              mostrarNotificacionToast(notif.mensaje, notif.tipo, { title: notif.titulo, duration: 6000 });

              // Abrir modal de bienvenida y beneficios VIP
              if (typeof abrirModalBienvenidaVIP === 'function') {
                abrirModalBienvenidaVIP({ tipo: productType, ciudad }, sesionUsuario);
              }

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

  // 2. Efecto Onda (Ripple) y Sondeo de Clicks
  document.body.addEventListener('click', (e) => {
    // Detectar si el toque fue en un botón interactivo
    const btn = e.target.closest('.btn-unlock-lead, .btn-wompi-pay, .slideup-cta-btn, .mobile-nav-btn, .btn-hero-cta, .btn-menu-pill');
    
    if (btn) {
      // Diferenciar vibración según la importancia del botón
      if (btn.classList.contains('btn-wompi-pay')) {
        hapticHeavy();
      } else {
        hapticLight();
      }

      // Crear inyección de onda dinámica
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const ripple = document.createElement('span');
      ripple.className = 'ripple-span';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;

      btn.classList.add('btn-ripple');
      btn.appendChild(ripple);

      // Limpiar el DOM tras terminar la animación
      setTimeout(() => ripple.remove(), 500);
    }
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

  // 4. Motor Parallax de Bajo Consumo
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        // Seleccionamos las imágenes renderizadas
        const images = document.querySelectorAll('.carousel-img, .card-static-img');
        const windowHeight = window.innerHeight;

        images.forEach(img => {
          const parent = img.closest('.bento-card');
          if (parent) {
            const rect = parent.getBoundingClientRect();
            // Ejecutar física SOLO si la tarjeta está visible en pantalla
            if (rect.top < windowHeight && rect.bottom > 0) {
              // Calcular porcentaje de posición y mover de -7.5% a 7.5%
              const yPos = ((rect.top / windowHeight) * 15) - 7.5; 
              // translate3d activa el procesador gráfico (GPU) directamente
              img.style.transform = `translate3d(0, ${yPos}%, 0)`;
            }
          }
        });
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // 5. Lógica del Menú Lateral Móvil (Off-Canvas)
  const sideMenu = document.getElementById('sideMenu');
  const menuOverlay = document.getElementById('sideMenuOverlay') || document.getElementById('menuOverlay');
  const btnCloseMenu = document.getElementById('btnCloseSideMenu') || document.getElementById('btnCloseMenu');
  const btnNavMenuBottom = document.getElementById('btnNavMenuBottom');
  const btnMenuTrigger = document.getElementById('btnMenuTrigger');

  const abrirSideMenu = () => {
    if (sideMenu && menuOverlay) {
      sideMenu.classList.add('active');
      menuOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      if (btnNavMenuBottom) btnNavMenuBottom.classList.add('active');
    }
  };

  const cerrarSideMenu = () => {
    if (sideMenu && menuOverlay) {
      sideMenu.classList.remove('active');
      menuOverlay.classList.remove('active');
      document.body.style.overflow = '';
      if (btnNavMenuBottom) btnNavMenuBottom.classList.remove('active');
    }
  };

  if (btnNavMenuBottom) {
    btnNavMenuBottom.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
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
      abrirSideMenu();
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (action === 'vehiculos') {
        e.preventDefault();
        const tabVeh = document.querySelector('.cmd-niche-tab[data-dataset="./data/vehiculos.json"]');
        if (tabVeh) tabVeh.click();
      } else if (action === 'vip') {
        e.preventDefault();
        abrirModalCheckout(0);
      } else if (action === 'terminos') {
        e.preventDefault();
        const btnTerminos = document.getElementById('btnOpenTerminos');
        if (btnTerminos) btnTerminos.click();
      }
    });
  });

}


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

  // Desplazamiento Suave al Catálogo desde el Hero CTA
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

    dropdownLocation.querySelectorAll(".cmd-dropdown-item").forEach(item => {
      item.addEventListener("click", (e) => {
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

  // Limpieza de error en tiempo real al escribir WhatsApp
  const inputWaReal = document.getElementById("checkoutWhatsappInput");
  if (inputWaReal) {
    inputWaReal.addEventListener("input", () => {
      const errBox = document.getElementById("checkoutPhoneError");
      if (errBox) errBox.style.display = "none";
      const wrapper = document.getElementById("checkoutInputWrapper");
      if (wrapper) wrapper.classList.remove("input-error-shake");
    });
  }

  // Botón Restaurar Sesión por PIN
  const btnRestore = document.getElementById("btnRestoreSession");
  if (btnRestore) {
    btnRestore.addEventListener("click", restaurarSesionConPin);
  }

  // Botón Cerrar Sesión en Perfil
  const btnLogout = document.getElementById("btnLogoutSession");
  if (btnLogout) {
    btnLogout.addEventListener("click", cerrarSesionUsuario);
  }

  // Botón Comprar Más Créditos desde el Perfil
  const btnBuyMore = document.getElementById("btnBuyMoreFromProfile");
  if (btnBuyMore) {
    btnBuyMore.addEventListener("click", () => cambiarPestanaCheckout('comprar'));
  }

  // Botón VIP del Header
  const btnVipHeader = document.getElementById("btnVipHeader");
  if (btnVipHeader) {
    btnVipHeader.addEventListener("mouseenter", preCargarWompi, { once: true });
    btnVipHeader.addEventListener("touchstart", preCargarWompi, { once: true, passive: true });
    btnVipHeader.addEventListener("click", () => {
      abrirModalCheckout();
    });
  }


  // ==========================================
  // MODAL LEGAL Y POLÍTICAS (LEY 1581)
  // ==========================================
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
      html: "<p><strong>1. Naturaleza del Servicio y Cero Intermediación</strong><br>Hunter Pro Intelligence es una herramienta de software que indexa y clasifica información de ofertas publicadas abiertamente en internet. Hunter Pro NO es una agencia inmobiliaria, concesionario, entidad de corretaje, ni actúa como asesor financiero o legal. No cobramos comisiones ni participamos en acuerdos comerciales o pagos.</p><p><strong>2. Exoneración Total de Responsabilidad</strong><br>Hunter Pro no valida, certifica ni garantiza la veracidad, exactitud, vigencia, titularidad real, legalidad o estado físico o mecánico de los bienes listados. La negociación, desembolsos, revisión de títulos de propiedad, tradición, gravámenes o contratos es responsabilidad exclusiva, directa e indelegable del usuario y las partes interesadas. Hunter Pro queda expresamente eximido de cualquier daño, pérdida económica o disputa derivada de transacciones entre particulares.</p><p><strong>3. Cláusula Anti-Scraping Estricta</strong><br>Se prohíbe terminantemente la extracción automatizada, raspado web o minería de datos mediante bots, spiders o herramientas informáticas. La infracción facultará la revocación inmediata del acceso y las acciones judiciales pertinentes.</p>"
    },
    privacidad: {
      titulo: "Política de Privacidad y Tratamiento de Datos (Ley 1581)",
      html: "<p><strong>1. Cumplimiento Normativo (Ley 1581 de 2012)</strong><br>En cumplimiento del régimen de protección de datos personales de Colombia, Hunter Pro garantiza los derechos de consulta, actualización y supresión de datos a los titulares.</p><p><strong>2. Origen Público de la Información y Desindexación</strong><br>Los números de contacto y datos de bienes corresponden a información divulgada voluntariamente por sus anunciantes en plataformas públicas. Nuestro software opera únicamente como motor indexador. Si usted es el titular de un inmueble o vehículo y desea desindexar su contacto o publicación de la terminal, puede solicitar la supresión inmediata a través de nuestro canal de soporte.</p><p><strong>3. Acceso Restringido</strong><br>Los datos de contacto se suministran exclusivamente a usuarios registrados bajo verificación para evitar usos indebidos o masivos.</p>"
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
      setTimeout(() => {
        modalLegal.style.display = "none";
      }, 300);
    }
  }

  if (btnTerminos) btnTerminos.addEventListener("click", () => abrirModalLegal('terminos'));
  if (btnPrivacidad) btnPrivacidad.addEventListener("click", () => abrirModalLegal('privacidad'));
  
  if (btnCloseLegal) btnCloseLegal.addEventListener("click", cerrarModalLegal);
  if (btnCancelLegal) btnCancelLegal.addEventListener("click", cerrarModalLegal);
  
  if (modalLegal) {
    modalLegal.addEventListener("click", (e) => {
      if (e.target === modalLegal) cerrarModalLegal();
    });
  }

  // Conmutador y Persistencia de Modo Claro / Modo Oscuro AMOLED
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
    document.documentElement.setAttribute("data-theme", newTheme);
    try {
      localStorage.setItem("hunter_theme", newTheme);
    } catch (e) {
      console.warn("No se pudo guardar el tema en localStorage:", e);
    }
    actualizarIconoTema(newTheme);
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
// 🚀 ARRANQUE DE LA APLICACIÓN AL CARGAR EL DOM
// ═════════════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Inicializar sesión persistente de usuario (JWT / PIN / Retorno de Wompi)
  await inicializarSesionUsuario();

  // 2. Cargar datos iniciales del catálogo inmobiliario
  cargarDatos("./data/inmobiliario.json");

  // 3. Registrar todos los event listeners de la interfaz
  configurarListeners();
  
  // 4. Activar motor de micro-interacciones (Ripple, Parallax GPU, Háptica)
  inicializarEfectosPremium();

  // 5. Registro de Service Worker para capacidades PWA
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("[PWA] Error registrando Service Worker:", err);
      });
    });
  }
});

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
  const elList = document.getElementById("welcomeBenefitsList");
  const elCtaText = document.getElementById("welcomeCtaText");

  const planTipo = planInfo?.tipo || usuario?.plan || 'single';
  const ciudad = planInfo?.ciudad || usuario?.planCity || 'tu ciudad';
  const pin = usuario?.pin || 'HNT-••••';
  const phone = usuario?.phone ? `+57 ${usuario.phone}` : '+57 ••••••••••';

  if (elPhone) elPhone.textContent = phone;
  if (elPin) elPin.textContent = pin;

  let itemsHtml = '';

  if (planTipo === 'subscription_national' || usuario?.plan === 'national') {
    if (elPill) elPill.innerHTML = '<i class="fa-solid fa-crown"></i> MEMBRESÍA NACIONAL VIP';
    if (elTitle) elTitle.textContent = '¡Bienvenido al Nivel Élite Nacional!';
    if (elSubtitle) elSubtitle.textContent = 'Tienes acceso total y sin restricciones a todos los propietarios directos de Colombia.';
    itemsHtml = `
      <div class="benefit-item">
        <div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div>
        <div class="benefit-content">
          <strong class="benefit-title">Desbloqueo Ilimitado en Toda Colombia</strong>
          <span class="benefit-desc">Bogotá, Medellín, Cali, Costa, Eje Cafetero y todas las ciudades por 30 días.</span>
        </div>
      </div>
      <div class="benefit-item">
        <div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div>
        <div class="benefit-content">
          <strong class="benefit-title">Radar de Rebajas de Precio & Arbitraje</strong>
          <span class="benefit-desc">Detección de oportunidades urgentes con alto potencial antes que salgan al mercado.</span>
        </div>
      </div>
      <div class="benefit-item">
        <div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div>
        <div class="benefit-content">
          <strong class="benefit-title">0% Comisión de Intermediarios</strong>
          <span class="benefit-desc">Negociación de tú a tú con dueños directos sin sobrecostos de inmobiliaria.</span>
        </div>
      </div>
    `;
  } else if (planTipo === 'subscription_city' || usuario?.plan === 'city') {
    if (elPill) elPill.innerHTML = `<i class="fa-solid fa-crown"></i> PLAN PRO CIUDAD — ${ciudad.toUpperCase()}`;
    if (elTitle) elTitle.textContent = `¡Bienvenido al Plan Pro ${ciudad}!`;
    if (elSubtitle) elSubtitle.textContent = `Tu membresía territorial está activa. Desbloquea todos los contactos de ${ciudad} sin gastar créditos.`;
    itemsHtml = `
      <div class="benefit-item">
        <div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div>
        <div class="benefit-content">
          <strong class="benefit-title">Acceso Ilimitado 30 Días en ${ciudad}</strong>
          <span class="benefit-desc">Todos los propietarios directos verificados en ${ciudad} sin consumir créditos.</span>
        </div>
      </div>
      <div class="benefit-item">
        <div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div>
        <div class="benefit-content">
          <strong class="benefit-title">0% Comisión de Inmobiliaria</strong>
          <span class="benefit-desc">Ahorra millones tratando de forma directa con el propietario verificado.</span>
        </div>
      </div>
      <div class="benefit-item">
        <div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div>
        <div class="benefit-content">
          <strong class="benefit-title">Alertas Prioritarias en Tiempo Real</strong>
          <span class="benefit-desc">Capturas instantáneas de inmuebles directos en tu área de cobertura.</span>
        </div>
      </div>
    `;
  } else if (planTipo === 'pack_10_leads' || (usuario?.credits >= 10)) {
    if (elPill) elPill.innerHTML = '<i class="fa-solid fa-star"></i> BOLSA PRO 10 CONTACTOS';
    if (elTitle) elTitle.textContent = '¡Bolsa de 10 Contactos Lista!';
    if (elSubtitle) elSubtitle.textContent = 'Has asegurado el paquete con 30% de descuento. Tus créditos nunca vencen.';
    itemsHtml = `
      <div class="benefit-item">
        <div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div>
        <div class="benefit-content">
          <strong class="benefit-title">10 Desbloqueos de Propietario Directo</strong>
          <span class="benefit-desc">Úsalos cuando encuentres el inmueble ideal en cualquier ciudad.</span>
        </div>
      </div>
      <div class="benefit-item">
        <div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div>
        <div class="benefit-content">
          <strong class="benefit-title">Créditos Sin Caducidad</strong>
          <span class="benefit-desc">Tus créditos permanecen sellados con tu PIN de por vida.</span>
        </div>
      </div>
      <div class="benefit-item">
        <div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div>
        <div class="benefit-content">
          <strong class="benefit-title">Portabilidad Total en Móvil y PC</strong>
          <span class="benefit-desc">Accede desde cualquier dispositivo ingresando tu celular y PIN.</span>
        </div>
      </div>
    `;
  } else {
    if (elPill) elPill.innerHTML = '<i class="fa-solid fa-bolt"></i> DESBLOQUEO INDIVIDUAL';
    if (elTitle) elTitle.textContent = '¡Contacto Directo Activado!';
    if (elSubtitle) elSubtitle.textContent = 'Tu crédito ha sido sellado con éxito para contactar al propietario.';
    itemsHtml = `
      <div class="benefit-item">
        <div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div>
        <div class="benefit-content">
          <strong class="benefit-title">Contacto Directo Garantizado</strong>
          <span class="benefit-desc">Teléfono y WhatsApp verificado del propietario sin intermediarios.</span>
        </div>
      </div>
      <div class="benefit-item">
        <div class="benefit-icon-box"><i class="fa-solid fa-check"></i></div>
        <div class="benefit-content">
          <strong class="benefit-title">PIN Reutilizable</strong>
          <span class="benefit-desc">Tu PIN te permite recuperar tu historial en cualquier momento.</span>
        </div>
      </div>
    `;
  }

  if (elList) elList.innerHTML = itemsHtml;
  if (elCtaText) {
    elCtaText.textContent = leadSeleccionado ? 'Ver Teléfono de Mi Inmueble' : 'Comenzar a Cazar Oportunidades';
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

// Inicialización de Listeners del Modal de Bienvenida
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
          console.warn('[Clipboard] Error copiando PIN:', e);
        }
      }
    });
  }
});
