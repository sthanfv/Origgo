/**
 * 🔓 MÓDULO DE DESBLOQUEO DE CONTACTOS (modules/07-unlock.js)
 * Desbloqueo atómico de propietarios, actualización de tarjeta en DOM y enlace a WhatsApp.
 * Estándar Ecosistema Desmulta Seguridad.
 */

// Registro de operaciones de desbloqueo en progreso para evitar dobles clics o peticiones concurrentes
const desbloqueosEnProgreso = new Set();

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
 * @param {object|undefined} datosRevelados - Título y ubicación reales (post-desbloqueo)
 */
function actualizarTarjetaEnElDOM(leadId, contacto, index, datosRevelados) {
  const card = document.querySelector(`.bento-card[data-lead-id="${leadId}"]`) || 
               (typeof index === 'number' ? document.querySelector(`.bento-card[data-index="${index}"]`) : null);
  if (!card) {
    renderizarInterfaz(datosActuales);
    return;
  }
  const contactoSeguro = typeof sanitizarContactoCliente === 'function'
    ? sanitizarContactoCliente(contacto)
    : contacto;

  card.classList.add('card-unlocked');

  // Revelar título y ubicación reales si vienen del backend
  if (datosRevelados) {
    const cardTitle = card.querySelector('.card-title');
    if (cardTitle && datosRevelados.tituloOriginal) {
      cardTitle.textContent = datosRevelados.tituloOriginal;
    }
    const cardLocation = card.querySelector('.card-location');
    if (cardLocation && datosRevelados.ubicacionCompleta) {
      cardLocation.innerHTML = '<i class="fa-solid fa-location-dot"></i> ' + escaparHtml(datosRevelados.ubicacionCompleta);
    }
  }

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
    cluster.innerHTML = `
      ${contactoSeguro?.enlace ? `
        <a href="${contactoSeguro.enlace}" target="_blank" rel="noopener noreferrer" class="btn-view-ad-direct" title="Ver anuncio original del propietario directo">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Anuncio
        </a>
      ` : ''}
      ${contactoSeguro?.whatsappUrl ? `
        <a href="${contactoSeguro.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-direct btn-whatsapp-compact" title="Chatear por WhatsApp" aria-label="Chatear por WhatsApp con el propietario">
          <i class="fa-brands fa-whatsapp"></i> WhatsApp
        </a>
      ` : ''}
      ${contactoSeguro?.telLlamar ? `
        <a href="tel:${contactoSeguro.telLlamar}" class="btn-call-direct" title="Llamar al dueño" aria-label="Llamar al propietario directo">
          <i class="fa-solid fa-phone"></i> Llamar
        </a>
      ` : ''}
      ${(!contactoSeguro?.enlace && !contactoSeguro?.whatsappUrl && !contactoSeguro?.telLlamar) ? `
        <button class="btn-whatsapp-direct" data-action="contactar-whatsapp" data-index="${index}" title="Revelar contacto y enlace del propietario">
          <i class="fa-solid fa-unlock"></i> Revelar Contacto
        </button>
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
        <div class="slideup-unlocked-layout">
          <div class="slideup-unlocked-row">
            ${contactoSeguro?.whatsappUrl ? `
              <a href="${contactoSeguro.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn btn-whatsapp-direct cta-flex" title="Chatear por WhatsApp" aria-label="Chatear por WhatsApp con el propietario">
                <i class="fa-brands fa-whatsapp"></i> WhatsApp
              </a>
            ` : ''}
            ${contactoSeguro?.telLlamar ? `
              <a href="tel:${contactoSeguro.telLlamar}" class="slideup-cta-btn cta-flex-sm cta-call" title="Llamar al dueño" aria-label="Llamar al propietario directo">
                <i class="fa-solid fa-phone"></i> Llamar
              </a>
            ` : ''}
            ${contactoSeguro?.enlace ? `
              <a href="${contactoSeguro.enlace}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn cta-flex cta-neutral" title="Ver anuncio original del propietario directo" aria-label="Ver anuncio original del propietario directo">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Anuncio
              </a>
            ` : ''}
          </div>
          <span class="slideup-cta-note slideup-cta-note-ok">
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
  if (!lead || !lead.id) return;

  // 🛡️ Protección anti-rebote: evitar peticiones concurrentes para el mismo lead
  if (desbloqueosEnProgreso.has(lead.id)) {
    return;
  }
  desbloqueosEnProgreso.add(lead.id);

  const selector = typeof index === 'number' ? `.bento-card[data-index="${index}"] .btn-unlock-lead` : null;
  const btn = selector ? document.querySelector(selector) : (typeof index === 'number' ? document.querySelector(`.bento-card[data-index="${index}"] button[data-action="contactar-whatsapp"]`) : null);
  const textoOriginal = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Desbloqueando...';
    btn.disabled = true;
  }

  // Deshabilitar también el botón dentro de la Ficha Técnica (Drawer) si está abierta
  const slideup = typeof index === 'number' ? document.getElementById(`slideup-${index}`) : null;
  const slideupBtn = slideup ? slideup.querySelector('.slideup-cta-btn[data-action="slideup-cta"]') : null;
  const slideupTextoOriginal = slideupBtn ? slideupBtn.innerHTML : '';
  if (slideupBtn) {
    slideupBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Desbloqueando...';
    slideupBtn.disabled = true;
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
    cacheContactosDesbloqueados[lead.id] = typeof sanitizarContactoCliente === 'function'
      ? sanitizarContactoCliente(data.contacto)
      : data.contacto;
    // Cachear datos revelados para re-renderizado futuro
    if (data.datosRevelados) {
      cacheContactosDesbloqueados[lead.id]._datosRevelados = data.datosRevelados;
    }

    cerrarModalCheckout();
    actualizarBadgeVip();
    actualizarTarjetaEnElDOM(lead.id, cacheContactosDesbloqueados[lead.id], index, data.datosRevelados);

    let mensajeExito = '';
    if (data.alreadyUnlocked) {
      mensajeExito = '✅ Inmueble ya desbloqueado previamente (Costo: 0 créditos). Contacto restablecido.';
    } else if (data.planBenefit) {
      mensajeExito = '👑 ¡Contacto desbloqueado sin costo por tu Membresía Pro!';
    } else {
      const palabraCredito = data.creditsRemaining === 1 ? 'crédito' : 'créditos';
      mensajeExito = `🎉 ¡Contacto desbloqueado! Saldo restante: ${data.creditsRemaining} ${palabraCredito}.`;
    }
    mostrarNotificacionToast(mensajeExito);
  } catch (err) {
    registrarLogDesarrollo('error', '[Desbloqueo] Error:', err);
    const esErrorRed = !navigator.onLine || err.name === 'TypeError' || String(err.message || '').toLowerCase().includes('failed to fetch') || String(err.message || '').toLowerCase().includes('network');
    if (esErrorRed) {
      mostrarNotificacionToast('📡 Red inestable o sin conexión. Tus créditos están protegidos; intenta nuevamente.', 'error');
    } else {
      mostrarNotificacionToast(err.message || 'Error de conexión durante el desbloqueo', 'error');
    }
  } finally {
    desbloqueosEnProgreso.delete(lead.id);
    if (btn) {
      btn.innerHTML = textoOriginal;
      btn.disabled = false;
    }
    if (slideupBtn) {
      slideupBtn.innerHTML = slideupTextoOriginal;
      slideupBtn.disabled = false;
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
  const contactoSeguro = typeof sanitizarContactoCliente === 'function'
    ? sanitizarContactoCliente(contacto)
    : contacto;
  if (contactoSeguro?.whatsappUrl) {
    window.open(contactoSeguro.whatsappUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  if (contactoSeguro?.enlace) {
    window.open(contactoSeguro.enlace, '_blank', 'noopener,noreferrer');
    return;
  }

  await ejecutarDesbloqueoLead(lead, index);
}
