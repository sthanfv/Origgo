/**
 * 🔔 MÓDULO DE ALERTAS WEB PUSH NATIVAS (modules/12-push.js)
 * Gestión de suscripción a notificaciones del navegador en tiempo real.
 * CERO variables expuestas en frontend (DevTools/F12 limpio) — Estándar Desmulta.
 */

/**
 * Convierte una cadena base64url a Uint8Array requerido por PushManager.
 * @param {string} base64String
 * @returns {Uint8Array}
 */
function base64UrlToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Inicia el proceso de suscripción o actualización de alertas Web Push segmentadas.
 * Consulta la clave pública dinámicamente al endpoint serverless sin quemar tokens en el cliente.
 * @param {string} [ciudadForzada] - Ciudad específica opcional
 */
async function activarNotificacionesPush(ciudadForzada) {
  const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (typeof mostrarNotificacionToast === 'function') {
      mostrarNotificacionToast(
        esIngles ? 'Your browser does not support native push notifications.' : 'Tu navegador no soporta notificaciones push nativas.',
        'error'
      );
    }
    return;
  }

  const btnBell = document.getElementById('btnPushSubscribe');
  const iconBell = btnBell ? btnBell.querySelector('i') : null;
  const originalIconClass = iconBell ? iconBell.className : 'fa-solid fa-bell';

  if (btnBell) {
    btnBell.classList.add('is-subscribing');
    if (iconBell) iconBell.className = 'fa-solid fa-circle-notch fa-spin';
  }

  try {
    // 1. Obtener criterios objetivos del selector, del parámetro o del almacenamiento
    const selectCiudad = document.getElementById('pushCitySelect');
    const selectOp = document.getElementById('pushOperationSelect');
    const checkDiscount = document.getElementById('pushDiscountOnly');

    let ciudadObjetivo = ciudadForzada;
    if (!ciudadObjetivo && selectCiudad && selectCiudad.value) {
      ciudadObjetivo = selectCiudad.value;
    }
    if (!ciudadObjetivo) {
      try {
        ciudadObjetivo = localStorage.getItem('origgo_push_city');
      } catch (_) {}
    }
    if (!ciudadObjetivo && window.filtroCiudadSeleccionada && window.filtroCiudadSeleccionada !== 'Colombia') {
      ciudadObjetivo = window.filtroCiudadSeleccionada;
    }
    if (!ciudadObjetivo) {
      ciudadObjetivo = 'Colombia';
    }

    const operacionObjetivo = selectOp && selectOp.value ? selectOp.value : (localStorage.getItem('origgo_push_operacion') || 'todas');
    const soloRebajas = checkDiscount ? checkDiscount.checked : (localStorage.getItem('origgo_push_discount') === 'true');

    // 2. Solicitar permiso al usuario si aún no está otorgado
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      if (typeof mostrarNotificacionToast === 'function') {
        mostrarNotificacionToast(
          esIngles ? 'Notification permission was denied or blocked.' : 'Permiso de notificaciones rechazado o bloqueado.',
          'error'
        );
      }
      return;
    }

    // 3. Obtener clave pública VAPID dinámicamente del backend con respaldo fail-safe
    const VAPID_KEY_FALLBACK = 'BOxsLRo4U5zEtBAu31sM199CSbxzOLhoFqE7V7tHJcVZ-kKTDUS8_F08emQ8Swzc0tQ4WCB7NvtmFLsVjC9Y7eQ';
    let publicKey = null;

    try {
      const respKey = await fetch('/api/notifications/vapid-public-key');
      if (respKey.ok) {
        const datosKey = await respKey.json();
        if (datosKey && datosKey.publicKey) {
          publicKey = String(datosKey.publicKey).trim();
        }
      }
    } catch (errKey) {
      console.warn('[Push] Error al consultar clave VAPID dinámica, usando fallback:', errKey);
    }

    if (!publicKey) {
      publicKey = VAPID_KEY_FALLBACK;
    }

    // 4. Registrar suscripción en el Service Worker
    const registro = await navigator.serviceWorker.ready;
    let suscripcion = await registro.pushManager.getSubscription();

    if (!suscripcion) {
      const convertedKey = base64UrlToUint8Array(publicKey);
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    // 5. Enviar suscripción con criterios segmentados al servidor para persistencia
    const respSub = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: suscripcion.toJSON(),
        ciudad: ciudadObjetivo,
        operacion: operacionObjetivo,
        soloRebajas: Boolean(soloRebajas),
        lang: typeof obtenerIdiomaActual === 'function' ? obtenerIdiomaActual() : (esIngles ? 'en' : 'es')
      })
    });

    if (!respSub.ok) {
      throw new Error(esIngles ? 'Failed to register subscription on server.' : 'Fallo al registrar la suscripción en el servidor.');
    }

    // 6. Guardar preferencias en almacenamiento local
    try {
      localStorage.setItem('origgo_push_city', ciudadObjetivo);
      localStorage.setItem('origgo_push_operacion', operacionObjetivo);
      localStorage.setItem('origgo_push_discount', soloRebajas ? 'true' : 'false');
    } catch (_) {}

    // 7. Feedback visual exitoso
    if (btnBell) {
      btnBell.classList.add('active-push');
      btnBell.title = esIngles 
        ? `Direct Listing Radar Active (${ciudadObjetivo})` 
        : `Radar de Oportunidades Activo (${ciudadObjetivo})`;
    }

    const linkSide = document.getElementById('sideMenuLinkPush');
    if (linkSide) {
      linkSide.innerHTML = `<i class="fa-solid fa-bell" style="color: var(--accent-emerald);"></i> ${esIngles ? `Live Radar (${ciudadObjetivo})` : `Radar en Vivo (${ciudadObjetivo})`}`;
    }

    // Cerrar modal de bienvenida si estuviera visible
    cerrarPushPromptModal(true);

    if (typeof mostrarNotificacionToast === 'function') {
      const textoCiudad = ciudadObjetivo === 'Colombia' 
        ? (esIngles ? 'all Colombia' : 'toda Colombia') 
        : ciudadObjetivo;
      mostrarNotificacionToast(
        esIngles
          ? `🔔 Radar active for ${textoCiudad}! We will notify your phone when new direct properties arrive.`
          : `🔔 ¡Radar activo para ${textoCiudad}! Te avisaremos en tu teléfono ante nuevos inmuebles directos.`,
        'success'
      );
    }
  } catch (err) {
    if (typeof mostrarNotificacionToast === 'function') {
      mostrarNotificacionToast(err.message || (esIngles ? 'Error activating radar alerts.' : 'Error al activar alertas.'), 'error');
    }
  } finally {
    if (btnBell) {
      btnBell.classList.remove('is-subscribing');
      if (iconBell) {
        iconBell.className = btnBell.classList.contains('active-push') ? 'fa-solid fa-bell' : originalIconClass;
      }
    }
  }
}

/**
 * Abre el modal sugestivo de radar de notificaciones push (Soft-Prompt).
 * Sincroniza la ciudad preferida en el selector.
 */
function abrirPushPromptModal() {
  const overlay = document.getElementById('modalPushPromptOverlay');
  if (!overlay) return;

  const selectCiudad = document.getElementById('pushCitySelect');
  if (selectCiudad) {
    let ciudadPrevia = null;
    try {
      ciudadPrevia = localStorage.getItem('origgo_push_city');
    } catch (_) {}

    // Si tiene Plan Pro Ciudad en su sesión activa, pre-seleccionar su ciudad
    if (!ciudadPrevia) {
      try {
        const sesion = JSON.parse(sessionStorage.getItem('origgo_session_data') || '{}');
        if (sesion.ciudadPro) ciudadPrevia = sesion.ciudadPro;
      } catch (_) {}
    }

    // Si está filtrando por una ciudad en el catálogo, pre-seleccionar
    if (!ciudadPrevia && window.filtroCiudadSeleccionada && window.filtroCiudadSeleccionada !== 'Colombia') {
      ciudadPrevia = window.filtroCiudadSeleccionada;
    }

    if (ciudadPrevia) {
      // Buscar coincidencia en opciones
      for (let i = 0; i < selectCiudad.options.length; i++) {
        if (selectCiudad.options[i].value.toLowerCase().includes(ciudadPrevia.toLowerCase()) ||
            ciudadPrevia.toLowerCase().includes(selectCiudad.options[i].value.toLowerCase())) {
          selectCiudad.selectedIndex = i;
          break;
        }
      }
    }
  }

  // Sincronizar selector de operación y filtro de rebajas
  const selectOp = document.getElementById('pushOperationSelect');
  if (selectOp) {
    const opPrevia = localStorage.getItem('origgo_push_operacion') || 'todas';
    selectOp.value = opPrevia;
  }

  const checkDiscount = document.getElementById('pushDiscountOnly');
  if (checkDiscount) {
    checkDiscount.checked = localStorage.getItem('origgo_push_discount') === 'true';
  }

  // Detección adaptativa para iPhone / iOS Safari
  const iosHint = document.getElementById('pushIosHint');
  if (iosHint) {
    const esIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const esStandalone = Boolean(window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));
    if (esIos && !esStandalone) {
      iosHint.style.display = 'flex';
    } else {
      iosHint.style.display = 'none';
    }
  }

  // Ajustar textos según estado del permiso
  const btnAccept = document.getElementById('btnPushPromptAccept');
  if (btnAccept && 'Notification' in window && Notification.permission === 'granted') {
    const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
    const spanText = btnAccept.querySelector('span');
    if (spanText) {
      spanText.textContent = esIngles ? 'Save Radar Preference' : 'Actualizar Preferencia de Zona';
    }
  }

  overlay.classList.add('active', 'open');
}

/**
 * Cierra el modal sugestivo de notificaciones push.
 * @param {boolean} guardarDescarte - Si es true, recuerda la decisión en la sesión actual.
 */
function cerrarPushPromptModal(guardarDescarte = true) {
  const overlay = document.getElementById('modalPushPromptOverlay');
  if (overlay) {
    overlay.classList.remove('active', 'open');
  }
  if (guardarDescarte) {
    try {
      sessionStorage.setItem('origgo_push_prompt_dismissed', 'true');
    } catch (_) {}
  }
}

/**
 * Evalúa automáticamente si se debe presentar la sugerencia de radar al entrar a la web.
 * Se dispara con un retardo amigable de 2.5 segundos para no interrumpir el render inicial.
 */
function evaluarSugerenciaPushAutomatica() {
  if (!('Notification' in window)) return;

  // Solo sugerir si el usuario aún no ha decidido (permiso 'default')
  if (Notification.permission === 'default') {
    let descartadoEnSesion = false;
    try {
      descartadoEnSesion = sessionStorage.getItem('origgo_push_prompt_dismissed') === 'true';
    } catch (_) {}

    if (!descartadoEnSesion) {
      setTimeout(() => {
        // Re-verificar por si el usuario ya interactuó con la campana
        if (Notification.permission === 'default') {
          abrirPushPromptModal();
        }
      }, 2500);
    }
  }
}

/**
 * Inicializa el botón de notificaciones y los listeners del modal en el DOM.
 */
function inicializarBotonPush() {
  const btnBell = document.getElementById('btnPushSubscribe');
  const linkSide = document.getElementById('sideMenuLinkPush');

  if (btnBell) {
    btnBell.addEventListener('click', () => {
      if ('Notification' in window && Notification.permission === 'granted') {
        abrirPushPromptModal();
      } else {
        activarNotificacionesPush();
      }
    });
  }

  if (linkSide) {
    linkSide.addEventListener('click', (e) => {
      e.preventDefault();
      const menu = document.getElementById('sideMenu');
      const overlay = document.getElementById('sideMenuOverlay');
      if (menu) menu.classList.remove('active', 'open');
      if (overlay) overlay.classList.remove('active', 'open');

      if ('Notification' in window && Notification.permission === 'granted') {
        abrirPushPromptModal();
      } else {
        activarNotificacionesPush();
      }
    });
  }

  // Listeners del modal interactivo Soft-Prompt
  const btnAccept = document.getElementById('btnPushPromptAccept');
  const btnLater = document.getElementById('btnPushPromptLater');
  const btnClose = document.getElementById('btnPushPromptClose');
  const promptOverlay = document.getElementById('modalPushPromptOverlay');

  if (btnAccept) {
    btnAccept.addEventListener('click', () => {
      activarNotificacionesPush();
    });
  }

  if (btnLater) {
    btnLater.addEventListener('click', () => {
      cerrarPushPromptModal(true);
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      cerrarPushPromptModal(true);
    });
  }

  if (promptOverlay) {
    promptOverlay.addEventListener('click', (e) => {
      if (e.target === promptOverlay) {
        cerrarPushPromptModal(true);
      }
    });
  }

  // Verificar si ya tiene permiso otorgado previamente
  if ('Notification' in window && Notification.permission === 'granted') {
    const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
    let ciudadPrevia = 'Colombia';
    try {
      ciudadPrevia = localStorage.getItem('origgo_push_city') || 'Colombia';
    } catch (_) {}

    if (btnBell) {
      btnBell.classList.add('active-push');
      btnBell.title = esIngles 
        ? `Direct Listing Radar Active (${ciudadPrevia})` 
        : `Radar de Oportunidades Activo (${ciudadPrevia})`;
    }
    if (linkSide) {
      linkSide.innerHTML = `<i class="fa-solid fa-bell" style="color: var(--accent-emerald);"></i> ${esIngles ? `Live Radar (${ciudadPrevia})` : `Radar en Vivo (${ciudadPrevia})`}`;
    }
  } else {
    // Si no tiene permiso, programar la invitación suave
    evaluarSugerenciaPushAutomatica();
  }
}

// Escuchar eventos de navegación profunda enviados desde el Service Worker
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (evento) => {
    if (evento.data && evento.data.tipo === 'ORIGGO_PUSH_CLICK') {
      const leadId = evento.data.leadId;
      if (leadId && typeof abrirFichaLead === 'function') {
        setTimeout(() => abrirFichaLead(leadId), 200);
      }
    }
  });
}

// Escuchar inicialización del DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarBotonPush);
} else {
  inicializarBotonPush();
}
