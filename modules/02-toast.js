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
    else titulo = 'Notificación Origgo';
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

  const segundosTotal = Math.round(duracionMs / 1000);
  const escapeFn = typeof escaparHtml === 'function' ? escaparHtml : (t) => String(t || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const tituloSeguro = escapeFn(titulo);
  const mensajeSeguro = escapeFn(mensajeLimpio);
  const actionTextSeguro = opts.actionText ? escapeFn(opts.actionText) : '';

  let actionHtml = '';
  if (opts.actionText) {
    actionHtml = `<button type="button" class="hunter-toast-action-btn">${actionTextSeguro}</button>`;
  }

  toast.innerHTML = `
    <div class="hunter-toast-glow"></div>
    <div class="hunter-toast-inner">
      <div class="hunter-toast-icon-wrapper">
        ${iconoSvg}
      </div>
      <div class="hunter-toast-content">
        <div class="hunter-toast-header">
          <h4 class="hunter-toast-title">${tituloSeguro}</h4>
          <button type="button" class="hunter-toast-close" aria-label="Cerrar notificación" title="Cerrar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <p class="hunter-toast-description">${mensajeSeguro}</p>
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
  const plan = usuario?.plan || 'free';
  const city = ciudad || usuario?.planCity || 'tu ciudad';

  if (plan === 'national' || tipoProducto === 'subscription_national') {
    return {
      titulo: '👑 ¡Élite Nacional Desbloqueada!',
      mensaje: '¡Bienvenido al Plan Nacional VIP! Acceso total en toda Colombia y radar de rebajas activado. Guarda tu PIN; también puedes recuperarlo por correo.',
      tipo: 'vip'
    };
  }

  if (plan === 'city' || tipoProducto === 'subscription_city') {
    return {
      titulo: `👑 ¡Membresía Pro ${city} Activa!`,
      mensaje: `¡Bienvenido! Disfrutas de acceso ilimitado a propietarios directos de ${city} por 30 días.`,
      tipo: 'vip'
    };
  }

  if (tipoProducto === 'pack_10_leads' || (usuario?.credits >= 10)) {
    return {
      titulo: '⭐ ¡Paquete Pro 10 Contactos Activo!',
      mensaje: `¡Ahorro del 30% asegurado! Tienes ${usuario?.credits || 10} contactos verificados sin vencimiento.`,
      tipo: 'success'
    };
  }

  return {
    titulo: '🎉 ¡Operación Exitosa!',
    mensaje: `¡Pago aprobado! Tienes ${usuario?.credits || 1} crédito disponible sin intermediarios.`,
    tipo: 'success'
  };
}
