/**
 * Ripple & Haptic micro-interactions engine.
 * Restores the authentic Android / Origgo ripple wave pulsation on interactive buttons.
 */
export function inyectarOndaRipple(
  btn: HTMLElement, 
  e?: React.MouseEvent | React.PointerEvent | MouseEvent | PointerEvent,
  esPesado = false
) {
  if (!btn) return;

  // Evitar duplicación accidental si el evento se dispara a nivel de componente y global
  const ahora = Date.now();
  const ultimoToque = Number(btn.getAttribute('data-last-ripple') || 0);
  if (ahora - ultimoToque < 150) return;
  btn.setAttribute('data-last-ripple', String(ahora));

  // 1. Háptica nativa en Android / Teléfonos
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      if (esPesado || btn.id === 'btnNavVip' || btn.classList.contains('btn-wompi-pay')) {
        navigator.vibrate([30, 40, 30]);
      } else {
        navigator.vibrate(25);
      }
    } catch {}
  }

  // 2. Cálculo geométrico de la onda
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.0;

  let clientX = rect.left + rect.width / 2;
  let clientY = rect.top + rect.height / 2;

  if (e && 'clientX' in e && typeof e.clientX === 'number' && e.clientX > 0) {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  const x = clientX - rect.left - size / 2;
  const y = clientY - rect.top - size / 2;

  // 3. Creación del nodo DOM de la onda
  const ripple = document.createElement('span');
  ripple.className = 'ripple-span';
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  btn.classList.add('btn-ripple');
  btn.appendChild(ripple);

  setTimeout(() => {
    if (ripple.parentNode === btn) {
      ripple.remove();
    }
  }, 480);
}

/**
 * Registra el listener global para capturar toques/clics con efecto onda en la barra móvil y botones.
 */
export function registrarEfectosRippleGlobales() {
  if (typeof document === 'undefined') return () => {};

  const handlePointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const btn = target.closest(
      '.mobile-nav-btn, .btn-unlock-lead, .btn-wompi-pay, .slideup-cta-btn, .btn-hero-cta, .btn-menu-pill, .btn-vip-header, .btn-theme-toggle, .btn-pagination, .btn-page-number'
    ) as HTMLElement | null;

    if (btn) {
      inyectarOndaRipple(btn, e, btn.id === 'btnNavVip' || btn.classList.contains('btn-wompi-pay'));
    }
  };

  document.body.addEventListener('pointerdown', handlePointerDown, { passive: true });
  return () => {
    document.body.removeEventListener('pointerdown', handlePointerDown);
  };
}
