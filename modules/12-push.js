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
 * Inicia el proceso de suscripción a notificaciones Web Push.
 * Consulta la clave pública dinámicamente al endpoint serverless sin quemar tokens en el cliente.
 */
async function activarNotificacionesPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (typeof mostrarNotificacionToast === 'function') {
      mostrarNotificacionToast('Tu navegador no soporta notificaciones push nativas.', 'error');
    }
    return;
  }

  try {
    // 1. Solicitar permiso al usuario si aún no está otorgado
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      if (typeof mostrarNotificacionToast === 'function') {
        mostrarNotificacionToast('Permiso de notificaciones rechazado o bloqueado.', 'error');
      }
      return;
    }

    // 2. Obtener clave pública VAPID dinámicamente del backend
    const respKey = await fetch('/api/notifications/vapid-public-key');
    if (!respKey.ok) {
      throw new Error('No se pudo obtener la configuración de notificaciones.');
    }

    const { publicKey } = await respKey.json();
    if (!publicKey) {
      throw new Error('Servicio de notificaciones temporalmente no disponible.');
    }

    // 3. Registrar suscripción en el Service Worker
    const registro = await navigator.serviceWorker.ready;
    let suscripcion = await registro.pushManager.getSubscription();

    if (!suscripcion) {
      const convertedKey = base64UrlToUint8Array(publicKey);
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    // 4. Enviar suscripción al servidor para persistencia
    const respSub = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: suscripcion.toJSON(),
        ciudad: window.filtroCiudadSeleccionada || 'Colombia'
      })
    });

    if (!respSub.ok) {
      throw new Error('Fallo al registrar la suscripción en el servidor.');
    }

    // 5. Feedback visual exitoso
    const btnBell = document.getElementById('btnPushSubscribe');
    if (btnBell) {
      btnBell.classList.add('active-push');
      btnBell.title = 'Alertas de Oportunidades Activas';
    }

    const linkSide = document.getElementById('sideMenuLinkPush');
    if (linkSide) {
      linkSide.innerHTML = '<i class="fa-solid fa-bell" style="color: var(--accent-emerald);"></i> Alertas en Vivo (Activas)';
    }

    // Cerrar modal de bienvenida si estuviera visible
    cerrarPushPromptModal(true);

    if (typeof mostrarNotificacionToast === 'function') {
      mostrarNotificacionToast('🔔 ¡Radar activado! Te avisaremos en tu teléfono cuando se capte un nuevo inmueble directo.', 'success');
    }

    // 6. Confirmación de activación silenciosa (las notificaciones llegarán exclusivamente por eventos reales del backend)
  } catch (err) {
    if (typeof mostrarNotificacionToast === 'function') {
      mostrarNotificacionToast(err.message || 'Error al activar alertas.', 'error');
    }
  }
}

/**
 * Abre el modal sugestivo de radar de notificaciones push (Soft-Prompt).
 */
function abrirPushPromptModal() {
  const overlay = document.getElementById('modalPushPromptOverlay');
  if (overlay) {
    overlay.classList.add('active', 'open');
  }
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
      activarNotificacionesPush();
    });
  }

  if (linkSide) {
    linkSide.addEventListener('click', (e) => {
      e.preventDefault();
      activarNotificacionesPush();
      const menu = document.getElementById('sideMenu');
      const overlay = document.getElementById('sideMenuOverlay');
      if (menu) menu.classList.remove('active', 'open');
      if (overlay) overlay.classList.remove('active', 'open');
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
    if (btnBell) {
      btnBell.classList.add('active-push');
      btnBell.title = 'Alertas de Oportunidades Activas';
    }
    if (linkSide) {
      linkSide.innerHTML = '<i class="fa-solid fa-bell" style="color: var(--accent-emerald);"></i> Alertas en Vivo (Activas)';
    }
  } else {
    // Si no tiene permiso, programar la invitación suave
    evaluarSugerenciaPushAutomatica();
  }
}

// Escuchar inicialización del DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarBotonPush);
} else {
  inicializarBotonPush();
}
