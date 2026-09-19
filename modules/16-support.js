/**
 * 🎧 MÓDULO DE AUTO-SOPORTE INTELIGENTE (modules/16-support.js)
 * Centro de resolución autónoma para sincronización de pagos Wompi,
 * desindexación automatizada para propietarios (Notice & Takedown)
 * y restauración inmediata de cuenta sin fricción.
 * Estándar Ecosistema Desmulta (< 500 líneas).
 */

/**
 * Abre el modal del Centro de Auto-Soporte con la pestaña indicada.
 * @param {'pago'|'takedown'|'cuenta'} opcionPorDefecto
 */
function abrirModalAutoSoporte(opcionPorDefecto = 'pago') {
  const modal = document.getElementById('modalAutoSoporteOverlay');
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  seleccionarOpcionAutoSoporte(opcionPorDefecto);
}

/**
 * Cierra el modal de auto-soporte y restablece los mensajes.
 */
function cerrarModalAutoSoporte() {
  const modal = document.getElementById('modalAutoSoporteOverlay');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  const feedback = document.getElementById('soporteFeedbackMsg');
  if (feedback) feedback.className = 'soporte-feedback-msg is-hidden';
}

/**
 * Cambia la pestaña activa del centro de auto-soporte y renderiza el formulario dinámico.
 * @param {'pago'|'takedown'|'cuenta'} tipo
 */
function seleccionarOpcionAutoSoporte(tipo) {
  const modal = document.getElementById('modalAutoSoporteOverlay');
  if (!modal) return;
  modal.querySelectorAll('.soporte-option-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-soporte-tipo') === tipo;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-pressed', isTarget ? 'true' : 'false');
  });

  const formBox = document.getElementById('soporteFormContainer');
  if (!formBox) return;
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';

  if (tipo === 'pago') {
    formBox.innerHTML = `
      <div class="soporte-form-pane">
        <label for="soporteInputReferencia" class="soporte-form-label">
          <i class="fa-solid fa-receipt"></i> ${isEn ? 'Wompi Reference or Transaction ID:' : 'Referencia de Pago Wompi o ID Bancario:'}
        </label>
        <div class="soporte-input-group">
          <input type="text" id="soporteInputReferencia" class="soporte-input-field" placeholder="${isEn ? 'E.g., wompi_123456 or reference' : 'Ej. wompi_123456 o ref. numérica'}" autocomplete="off" />
          <button type="button" class="btn-soporte-submit" id="btnSubmitSoportePago">
            <i class="fa-solid fa-rotate"></i> ${isEn ? 'Sync Payment' : 'Sincronizar Pago'}
          </button>
        </div>
        <span class="soporte-form-help">
          <i class="fa-solid fa-shield-halved"></i> ${isEn ? 'If your payment was approved in Wompi / PSE / Nequi, this will instantly credit your account.' : 'Si tu pago fue aprobado en Wompi, PSE o Nequi, esto acreditará tu saldo de inmediato.'}
        </span>
      </div>`;
    const btnSubmit = document.getElementById('btnSubmitSoportePago');
    if (btnSubmit) btnSubmit.addEventListener('click', () => ejecutarSyncPagoSoporte());
  } else if (tipo === 'takedown') {
    formBox.innerHTML = `
      <div class="soporte-form-pane">
        <label for="soporteInputLeadId" class="soporte-form-label">
          <i class="fa-solid fa-house-chimney-crack"></i> ${isEn ? 'Listing ID or URL:' : 'Identificador o Enlace del Inmueble:'}
        </label>
        <input type="text" id="soporteInputLeadId" class="soporte-input-field" placeholder="${isEn ? 'E.g., fincaraiz-12345 or listing URL' : 'Ej. fincaraiz-12345 o enlace del anuncio'}" />
        <label for="soporteInputPhone" class="soporte-form-label" style="margin-top:0.6rem;">
          <i class="fa-solid fa-phone"></i> ${isEn ? 'Owner Phone Number:' : 'Teléfono del Propietario:'}
        </label>
        <input type="tel" id="soporteInputPhone" class="soporte-input-field" placeholder="${isEn ? 'E.g., 300 123 4567' : 'Ej. 300 123 4567'}" />
        <label for="soporteSelectRazon" class="soporte-form-label" style="margin-top:0.6rem;">
          <i class="fa-solid fa-clipboard-question"></i> ${isEn ? 'Reason for Delisting:' : 'Motivo de Retiro:'}
        </label>
        <select id="soporteSelectRazon" class="soporte-input-field">
          <option value="ya_vendido">${isEn ? 'Property Already Sold / Rented' : 'Inmueble ya vendido o arrendado'}</option>
          <option value="desistimiento">${isEn ? 'No longer marketing property' : 'Ya no deseo vender ni arrendar'}</option>
          <option value="datos_erroneos">${isEn ? 'Incorrect listing details' : 'Datos o precio incorrectos en portal origen'}</option>
          <option value="privacidad">${isEn ? 'Habeas Data Privacy Request' : 'Solicitud de privacidad y protección de datos'}</option>
        </select>
        <button type="button" class="btn-soporte-submit btn-soporte-takedown" id="btnSubmitSoporteTakedown" style="margin-top:0.85rem;">
          <i class="fa-solid fa-shield-xmark"></i> ${isEn ? 'Request Instant Delisting' : 'Retirar Inmueble del Índice'}
        </button>
      </div>`;
    const btnSubmit = document.getElementById('btnSubmitSoporteTakedown');
    if (btnSubmit) btnSubmit.addEventListener('click', () => ejecutarTakedownSoporte());
  } else if (tipo === 'cuenta') {
    cerrarModalAutoSoporte();
    if (typeof abrirModalCheckout === 'function') {
      abrirModalCheckout(0);
      setTimeout(() => {
        const tabPin = document.getElementById('tabBtnTengoPin');
        if (tabPin) tabPin.click();
      }, 50);
    }
  }
}

/**
 * Ejecuta la verificación y reconciliación server-to-server de una referencia bancaria.
 */
async function ejecutarSyncPagoSoporte() {
  const input = document.getElementById('soporteInputReferencia');
  const ref = input ? input.value.trim() : '';
  const feedback = document.getElementById('soporteFeedbackMsg');
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';

  if (!ref) {
    if (feedback) {
      feedback.className = 'soporte-feedback-msg error';
      feedback.textContent = isEn ? 'Please enter a valid payment reference.' : 'Por favor ingresa una referencia de pago válida.';
    }
    return;
  }

  if (feedback) {
    feedback.className = 'soporte-feedback-msg loading';
    feedback.textContent = isEn ? 'Checking Wompi gateway records...' : 'Consultando transacción oficial con Wompi...';
  }

  const btn = document.getElementById('btnSubmitSoportePago');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
  }

  try {
    if (typeof reclamarSesionPostPago === 'function') {
      await reclamarSesionPostPago({ reference: ref });
      if (feedback) {
        feedback.className = 'soporte-feedback-msg success';
        feedback.textContent = isEn ? '✓ Payment verified! Your credits are ready.' : '✓ ¡Pago verificado! Tus créditos están activos en tu cuenta.';
      }
    } else {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim_reference', reference: ref })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        if (feedback) {
          feedback.className = 'soporte-feedback-msg success';
          feedback.textContent = isEn ? '✓ Payment verified and credited!' : '✓ ¡Pago verificado y saldo acreditado!';
        }
        if (typeof inicializarSesionUsuario === 'function') inicializarSesionUsuario();
      } else {
        throw new Error(data.message || (isEn ? 'Payment not yet confirmed by bank.' : 'El pago aún no ha sido confirmado por la pasarela.'));
      }
    }
  } catch (err) {
    if (feedback) {
      feedback.className = 'soporte-feedback-msg error';
      feedback.textContent = err.message || (isEn ? 'Could not sync reference. Contact WhatsApp support.' : 'No se pudo sincronizar la referencia. Contacta a soporte por WhatsApp.');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  }
}

/**
 * Ejecuta la solicitud de retiro de inmueble (Notice & Takedown) hacia el endpoint serverless.
 */
async function ejecutarTakedownSoporte() {
  const inputLead = document.getElementById('soporteInputLeadId');
  const inputPhone = document.getElementById('soporteInputPhone');
  const selectRazon = document.getElementById('soporteSelectRazon');
  const feedback = document.getElementById('soporteFeedbackMsg');
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';

  const leadId = inputLead ? inputLead.value.trim() : '';
  const phone = inputPhone ? inputPhone.value.trim() : '';
  const reason = selectRazon ? selectRazon.value : 'solicitud_propietario';

  if (!leadId) {
    if (feedback) {
      feedback.className = 'soporte-feedback-msg error';
      feedback.textContent = isEn ? 'Please enter listing identifier or link.' : 'Por favor ingresa la referencia o enlace del inmueble.';
    }
    return;
  }

  if (feedback) {
    feedback.className = 'soporte-feedback-msg loading';
    feedback.textContent = isEn ? 'Processing delisting request...' : 'Procesando desindexación del inmueble...';
  }

  const btn = document.getElementById('btnSubmitSoporteTakedown');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
  }

  try {
    const res = await fetch('/api/support/takedown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, phone, reason })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      if (feedback) {
        feedback.className = 'soporte-feedback-msg success';
        feedback.textContent = data.message || (isEn ? '✓ Listing delisted from search index.' : '✓ Inmueble retirado exitosamente del índice.');
      }
      if (inputLead) inputLead.value = '';
      if (inputPhone) inputPhone.value = '';
    } else {
      throw new Error(data.message || (isEn ? 'Could not complete delisting.' : 'No se pudo retirar el inmueble.'));
    }
  } catch (err) {
    if (feedback) {
      feedback.className = 'soporte-feedback-msg error';
      feedback.textContent = err.message;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  }
}

/**
 * Inicializa todos los eventos táctiles y escuchadores del modal de Auto-Soporte.
 */
function inicializarModalAutoSoporte() {
  const modal = document.getElementById('modalAutoSoporteOverlay');
  const btnClose = document.getElementById('btnAutoSoporteCloseIcon');
  const btnFooter = document.getElementById('btnOpenAutoSoporte');
  const btnSide = document.getElementById('sideMenuLinkSupport');

  if (btnClose) btnClose.addEventListener('click', (e) => { e.preventDefault(); cerrarModalAutoSoporte(); });
  if (btnFooter) btnFooter.addEventListener('click', (e) => { e.preventDefault(); abrirModalAutoSoporte('pago'); });
  if (btnSide) btnSide.addEventListener('click', (e) => { e.preventDefault(); if (typeof cerrarSideMenu === 'function') cerrarSideMenu(); abrirModalAutoSoporte('pago'); });

  if (modal) {
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModalAutoSoporte(); });
    modal.querySelectorAll('.soporte-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tipo = btn.getAttribute('data-soporte-tipo');
        if (tipo) seleccionarOpcionAutoSoporte(tipo);
      });
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) cerrarModalAutoSoporte();
  });
}

// Exposición global
window.abrirModalAutoSoporte = abrirModalAutoSoporte;
window.cerrarModalAutoSoporte = cerrarModalAutoSoporte;
window.seleccionarOpcionAutoSoporte = seleccionarOpcionAutoSoporte;
window.inicializarModalAutoSoporte = inicializarModalAutoSoporte;

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializarModalAutoSoporte);
  else inicializarModalAutoSoporte();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    abrirModalAutoSoporte,
    cerrarModalAutoSoporte,
    seleccionarOpcionAutoSoporte,
    ejecutarSyncPagoSoporte,
    ejecutarTakedownSoporte,
    inicializarModalAutoSoporte
  };
}
