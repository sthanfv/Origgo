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
    cacheContactosDesbloqueados[lead.id] = data.contacto;
    try {
      localStorage.setItem('hunter_unlocked_contacts', JSON.stringify(cacheContactosDesbloqueados));
    } catch (e) {}

    cerrarModalCheckout();
    actualizarBadgeVip();
    actualizarTarjetaEnElDOM(lead.id, data.contacto, index);

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
    console.error('[Desbloqueo] Error:', err);
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