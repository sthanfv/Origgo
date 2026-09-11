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

    if (typeof mostrarNotificacionToast === 'function') {
      mostrarNotificacionToast('🔔 ¡Alertas activadas! Te avisaremos al instante cuando se capte una nueva ganga directa.', 'success');
    }

    // 6. Notificación inmediata de prueba en el sistema operativo Android / navegador
    if (registro && typeof registro.showNotification === 'function') {
      try {
        await registro.showNotification('🔥 ¡Radar de Origgo Activado!', {
          body: 'Notificaciones activas. Recibirás una alerta en tiempo real en tu teléfono cada vez que se capte un inmueble sin comisiones.',
          icon: './apple-touch-icon.png',
          badge: './favicon-32x32.png',
          vibrate: [120, 60, 120],
          tag: 'origgo-welcome-notification',
          data: { url: './' }
        });
      } catch (_) {}
    }
  } catch (err) {
    if (typeof mostrarNotificacionToast === 'function') {
      mostrarNotificacionToast(err.message || 'Error al activar alertas.', 'error');
    }
  }
}

/**
 * Inicializa el botón de notificaciones en el DOM.
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

  // Verificar si ya tiene permiso otorgado
  if ('Notification' in window && Notification.permission === 'granted') {
    if (btnBell) {
      btnBell.classList.add('active-push');
      btnBell.title = 'Alertas de Oportunidades Activas';
    }
    if (linkSide) {
      linkSide.innerHTML = '<i class="fa-solid fa-bell" style="color: var(--accent-emerald);"></i> Alertas en Vivo (Activas)';
    }
  }
}

// Escuchar inicialización del DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarBotonPush);
} else {
  inicializarBotonPush();
}
