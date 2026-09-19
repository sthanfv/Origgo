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
 * @param {object} [opciones]
 */
async function manejarClicDesbloquear(index, opciones = {}) {
  if (!datosActuales?.leads || !datosActuales.leads[index]) return;
  const lead = datosActuales.leads[index];
  leadSeleccionado = lead;
  if (opciones && opciones.desdeFicha) {
    leadSeleccionado._desdeFicha = true;
    leadSeleccionado._fichaIndex = index;
  }

  if (typeof registrarEventoEmbudoCliente === 'function' && lead) {
    registrarEventoEmbudoCliente('interes_inmueble', {
      leadId: lead.id,
      ciudad: lead.ciudad || lead.ubicacion || null
    });
  }

  const yaEstaDesbloqueado = sesionUsuario && Array.isArray(sesionUsuario.unlockedLeads) && sesionUsuario.unlockedLeads.includes(lead.id);
  const tienePlanActivo = sesionUsuario?.plan === 'national' || sesionUsuario?.plan === 'city';
  const tieneCreditos = sesionUsuario && Number(sesionUsuario.credits || 0) >= 1;

  if (sesionUsuario && (yaEstaDesbloqueado || tieneCreditos || tienePlanActivo)) {
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
 * @param {Array|undefined} siguientesPasos - Protocolo de siguientes pasos bilingüe
 */
function actualizarTarjetaEnElDOM(leadId, contacto, index, datosRevelados, siguientesPasos) {
  const card = document.querySelector(`.bento-card[data-lead-id="${leadId}"]`) || 
               (typeof index === 'number' ? document.querySelector(`.bento-card[data-index="${index}"]`) : null);
  if (!card) {
    renderizarInterfaz(datosActuales);
    return;
  }
  const contactoSeguro = typeof sanitizarContactoCliente === 'function'
    ? sanitizarContactoCliente(contacto)
    : contacto;

  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';

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

  // 1. Badge superior flotante de "Desbloqueado" / "Unlocked"
  const floatingBadges = card.querySelector('.card-floating-badges');
  if (floatingBadges) {
    let unlockedBadge = floatingBadges.querySelector('.card-unlocked-badge');
    if (!unlockedBadge) {
      unlockedBadge = document.createElement('span');
      unlockedBadge.className = 'card-unlocked-badge';
      unlockedBadge.innerHTML = `<i class="fa-solid fa-unlock"></i> ${isEn ? 'Unlocked' : 'Desbloqueado'}`;
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
      const specsInline = cardBody.querySelector('.card-specs-inline') || cardBody.querySelector('.card-title');
      const bottomRow = cardBody.querySelector('.card-bottom-row');
      if (specsInline && specsInline.parentNode) {
        specsInline.parentNode.insertBefore(phoneBar, specsInline.nextSibling);
      } else if (bottomRow) {
        cardBody.insertBefore(phoneBar, bottomRow);
      } else {
        cardBody.appendChild(phoneBar);
      }
    }
    const telDisplay = contacto.telefonoDisplay || contacto.telefono || (isEn ? 'View in Ad' : 'Ver en Anuncio');
    phoneBar.innerHTML = `
      <span><i class="fa-solid fa-phone"></i> <strong class="contact-phone-number">${escaparHtml(telDisplay)}</strong></span>
      <span class="unlocked-portal-pill"><i class="fa-solid fa-building-flag"></i> ${escaparHtml(contacto.portal || 'Finca Raíz')}</span>
    `;
  }

  // 3. Botones de acción directa (WhatsApp, Llamar, Ver Anuncio)
  const bottomRow = card.querySelector('.card-bottom-row');
  if (bottomRow) {
    const existingCluster = bottomRow.querySelector('.unlocked-action-cluster');
    const existingUnlockBtn = bottomRow.querySelector('.btn-unlock-action, .btn-unlock-lead, [data-action="desbloquear-lead"]');
    const existingDirectBtn = bottomRow.querySelector('button[data-action="contactar-whatsapp"]');

    const cluster = existingCluster || document.createElement('div');
    cluster.className = 'unlocked-action-cluster';
    cluster.innerHTML = `
      ${contactoSeguro?.enlace ? `
        <a href="${contactoSeguro.enlace}" target="_blank" rel="noopener noreferrer" class="btn-view-ad-direct" title="${isEn ? 'View original owner listing' : 'Ver anuncio original del propietario directo'}">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> ${isEn ? 'View Listing' : 'Ver Anuncio'}
        </a>
      ` : ''}
      ${contactoSeguro?.whatsappUrl ? `
        <a href="${contactoSeguro.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-direct btn-whatsapp-compact" title="WhatsApp" aria-label="WhatsApp">
          <i class="fa-brands fa-whatsapp"></i> WhatsApp
        </a>
      ` : ''}
      ${contactoSeguro?.telLlamar ? `
        <a href="tel:${contactoSeguro.telLlamar}" class="btn-call-direct" title="${isEn ? 'Call Owner' : 'Llamar al dueño'}" aria-label="Llamar">
          <i class="fa-solid fa-phone"></i> ${isEn ? 'Call' : 'Llamar'}
        </a>
      ` : ''}
      ${(!contactoSeguro?.enlace && !contactoSeguro?.whatsappUrl && !contactoSeguro?.telLlamar) ? `
        <button class="btn-whatsapp-direct" data-action="contactar-whatsapp" data-index="${index}" title="${isEn ? 'Reveal owner contact and link' : 'Revelar contacto y enlace del propietario'}">
          <i class="fa-solid fa-unlock"></i> ${isEn ? 'Reveal Contact' : 'Revelar Contacto'}
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
    if (datosRevelados) {
      const slideTitle = slideup.querySelector('.slideup-title');
      if (slideTitle && datosRevelados.tituloOriginal) {
        slideTitle.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${escaparHtml(datosRevelados.tituloOriginal)}`;
      }
    }
    const specCards = slideup.querySelectorAll('.slideup-spec-card');
    specCards.forEach(sc => {
      const k = sc.querySelector('.slideup-spec-key');
      const v = sc.querySelector('.slideup-spec-val');
      if (k && v) {
        if (/contacto|contact/i.test(k.textContent)) {
          v.innerHTML = `<span class="verified-badge-wrap"><i class="fa-solid fa-circle-check verified-badge-icon"></i> ${isEn ? 'Verified Owner' : 'Propietario Verificado'}</span>`;
        } else if (/ubicación|location/i.test(k.textContent) && datosRevelados?.ubicacionCompleta) {
          v.textContent = datosRevelados.ubicacionCompleta;
        }
      }
    });

    const pasosRender = Array.isArray(siguientesPasos) && siguientesPasos.length > 0
      ? siguientesPasos
      : (contacto?._siguientesPasos && Array.isArray(contacto._siguientesPasos)
        ? contacto._siguientesPasos
        : (isEn
            ? [{ paso: 1, titulo: 'Contact:', accion: 'Send WhatsApp message or direct call.' }, { paso: 2, titulo: 'Tour:', accion: 'Ask for media and arrange property walkthrough.' }, { paso: 3, titulo: 'Deal:', accion: 'Verify title certificate and negotiate with zero agency fees.' }]
            : [{ paso: 1, titulo: 'Contacto:', accion: 'Envía el WhatsApp preparado o realiza llamada directa.' }, { paso: 2, titulo: 'Visita:', accion: 'Pide fotos adicionales y agenda visita presencial.' }, { paso: 3, titulo: 'Acuerdo:', accion: 'Verifica el certificado de tradición y acuerda sin comisión.' }]));

    const pasosHtml = pasosRender.map(p => `
      <li class="next-step-item"><span class="next-step-num">${p.paso}</span><span><strong>${escaparHtml(p.titulo || (p.clave ? p.clave + ':' : ''))}</strong> ${escaparHtml(p.accion || p.descripcion || '')}</span></li>
    `).join('');

    const actionGroup = slideup.querySelector('.slideup-action-group');
    if (actionGroup) {
      actionGroup.innerHTML = `
        <div class="slideup-unlocked-layout">
          <div class="unlocked-phone-box">
            <div class="unlocked-phone-label"><i class="fa-solid fa-unlock"></i> ${isEn ? 'Unlocked Contact Details' : 'Datos de Contacto Desbloqueados'}</div>
            <div class="unlocked-phone-number">${escaparHtml(contacto?.telefonoDisplay || contacto?.telefono || (isEn ? 'Fetching contact...' : 'Consultando contacto...'))}</div>
          </div>
          <div class="slideup-unlocked-row">
            ${contactoSeguro?.whatsappUrl ? `
              <a href="${contactoSeguro.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn btn-whatsapp-direct cta-flex" title="WhatsApp" aria-label="WhatsApp">
                <i class="fa-brands fa-whatsapp"></i> WhatsApp
              </a>
            ` : ''}
            ${contactoSeguro?.telLlamar ? `
              <a href="tel:${contactoSeguro.telLlamar}" class="slideup-cta-btn cta-flex-sm cta-call" title="${isEn ? 'Call Owner' : 'Llamar al dueño'}" aria-label="Llamar">
                <i class="fa-solid fa-phone"></i> ${isEn ? 'Call' : 'Llamar'}
              </a>
            ` : ''}
            ${contactoSeguro?.enlace ? `
              <a href="${contactoSeguro.enlace}" target="_blank" rel="noopener noreferrer" class="slideup-cta-btn cta-flex cta-neutral" title="${isEn ? 'View Original Listing' : 'Ver Anuncio Original'}" aria-label="Anuncio">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> ${isEn ? 'View Listing' : 'Ver Anuncio'}
              </a>
            ` : ''}
          </div>
          <div class="slideup-next-steps">
            <div class="next-steps-title"><i class="fa-solid fa-list-check"></i> ${isEn ? 'Next Steps to Close Deal' : 'Siguientes Pasos de Negociación'}</div>
            <ul class="next-steps-list">
              ${pasosHtml}
            </ul>
          </div>
          <span class="slideup-cta-note slideup-cta-note-ok">
            <i class="fa-solid fa-check-double"></i> ${isEn ? 'Contact and direct link unlocked for your account' : 'Contacto y enlace directo desbloqueados para tu cuenta'}
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

  const cardEl = typeof index === 'number' ? document.querySelector(`.bento-card[data-index="${index}"]`) : (lead?.id ? document.querySelector(`.bento-card[data-lead-id="${lead.id}"]`) : null);
  const btn = cardEl ? cardEl.querySelector('.btn-unlock-action, .btn-unlock-lead, [data-action="desbloquear-lead"], [data-action="contactar-whatsapp"]') : null;
  const textoOriginal = btn ? btn.innerHTML : '';
  const isEnUnlock = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEnUnlock ? 'Unlocking...' : 'Desbloqueando...'}`;
    btn.disabled = true;
  }

  // Deshabilitar también el botón dentro de la Ficha Técnica (Drawer) si está abierta
  const slideup = typeof index === 'number' ? document.getElementById(`slideup-${index}`) : null;
  const slideupBtn = slideup ? slideup.querySelector('.slideup-cta-btn[data-action="slideup-cta"]') : null;
  const slideupTextoOriginal = slideupBtn ? slideupBtn.innerHTML : '';
  if (slideupBtn) {
    slideupBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEnUnlock ? 'Unlocking...' : 'Desbloqueando...'}`;
    slideupBtn.disabled = true;
  }

  try {
    const unlockHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sesionUsuario.token}`
    };
    if (typeof generarUUIDv4 === 'function') {
      unlockHeaders['Idempotency-Key'] = generarUUIDv4();
    }

    const res = await fetch('/api/leads/unlock', {
      method: 'POST',
      headers: unlockHeaders,
      body: JSON.stringify({
        leadId: lead.id,
        contactoCifrado: lead.contacto_cifrado || '',
        leadCity: lead.ciudad || lead.ubicacion || lead.barrio || '',
        lang: isEnUnlock ? 'en' : 'es'
      })
    });

    const data = await res.json();
    const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';

    if (!res.ok || !data.ok) {
      if (res.status === 429 || data.error === 'CUOTA_DIARIA_EXCEDIDA') {
        const msgCuota = esIngles ? 'Fair use daily limit reached (35 contacts/day). Resets tomorrow.' : (data.message || 'Cuota de uso justo alcanzada (35 contactos/día). Se reiniciará mañana.');
        mostrarNotificacionToast(`🛡️ ${msgCuota}`, 'warning');
        return;
      }
      if (res.status === 403 && data.error === 'PLAN_CIUDAD_DIFERENTE') {
        const msgCiudad = esIngles ? 'Your active pass does not cover this city.' : (data.message || 'Tu membresía no cubre esta ciudad.');
        mostrarNotificacionToast(`📍 ${msgCiudad}`, 'error');
        abrirModalCheckout(index, 'comprar');
        return;
      }
      if (res.status === 402) {
        mostrarNotificacionToast(esIngles ? '⚠️ Insufficient credits to unlock this owner contact.' : '⚠️ Saldo insuficiente para desbloquear este contacto.', 'error');
        abrirModalCheckout(index, 'comprar');
        return;
      }
      throw new Error(data.error || (esIngles ? 'Error unlocking contact' : 'Error al desbloquear contacto'));
    }

    sesionUsuario.credits = data.creditsRemaining;
    if (data.token) {
      localStorage.setItem('hunter_pro_token', data.token);
      if (typeof guardarCookieSegura === 'function') guardarCookieSegura('origgo_token', data.token, 30);
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
    // Cachear datos revelados y siguientes pasos para re-renderizado futuro
    if (data.datosRevelados) {
      cacheContactosDesbloqueados[lead.id]._datosRevelados = data.datosRevelados;
    }
    if (data.siguientesPasos) {
      cacheContactosDesbloqueados[lead.id]._siguientesPasos = data.siguientesPasos;
    }

    cerrarModalCheckout();
    actualizarBadgeVip();
    actualizarTarjetaEnElDOM(lead.id, cacheContactosDesbloqueados[lead.id], index, data.datosRevelados, data.siguientesPasos);

    // Si el usuario desbloqueó desde la segunda capa (Ficha Técnica), mantener el drawer abierto y enfocar
    if (slideup && (leadSeleccionado?._desdeFicha || slideup.classList.contains('active'))) {
      slideup.classList.add('active');
      const phoneBox = slideup.querySelector('.unlocked-phone-box');
      if (phoneBox) setTimeout(() => phoneBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
      if (leadSeleccionado) delete leadSeleccionado._desdeFicha;
    }

    let mensajeExito = '';
    if (data.alreadyUnlocked) {
      mensajeExito = esIngles
        ? '✅ Property already unlocked previously (Cost: 0 credits). Contact restored.'
        : '✅ Inmueble ya desbloqueado previamente (Costo: 0 créditos). Contacto restablecido.';
    } else if (data.planBenefit) {
      const restHoy = typeof data.dailyUnlocksRemaining === 'number'
        ? (esIngles ? ` (${data.dailyUnlocksRemaining} left today)` : ` (${data.dailyUnlocksRemaining} restantes hoy)`)
        : '';
      mensajeExito = esIngles
        ? `👑 Contact unlocked at zero cost via your Pro Pass!${restHoy}`
        : `👑 ¡Contacto desbloqueado sin costo por tu Membresía Pro!${restHoy}`;
    } else {
      if (data.creditsRemaining === 0) {
        mensajeExito = esIngles
          ? '🎉 Direct owner contact unlocked! WhatsApp & call ready.'
          : '🎉 ¡Contacto del propietario desbloqueado! WhatsApp y llamada listos.';
      } else {
        const palabraCredito = data.creditsRemaining === 1
          ? (esIngles ? 'credit' : 'crédito')
          : (esIngles ? 'credits' : 'créditos');
        mensajeExito = esIngles
          ? `🎉 Contact unlocked! Remaining balance: ${data.creditsRemaining} ${palabraCredito}.`
          : `🎉 ¡Contacto desbloqueado! Saldo restante: ${data.creditsRemaining} ${palabraCredito}.`;
      }
    }
    mostrarNotificacionToast(mensajeExito);
  } catch (err) {
    registrarLogDesarrollo('error', '[Desbloqueo] Error:', err);
    const esIngles = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
    const esErrorRed = !navigator.onLine || err.name === 'TypeError' || String(err.message || '').toLowerCase().includes('failed to fetch') || String(err.message || '').toLowerCase().includes('network');
    if (esErrorRed) {
      mostrarNotificacionToast(esIngles ? '📡 Unstable network or offline. Your credits are safe; please try again.' : '📡 Red inestable o sin conexión. Tus créditos están protegidos; intenta nuevamente.', 'error');
    } else {
      mostrarNotificacionToast(err.message || (esIngles ? 'Connection error during contact unlock' : 'Error de conexión durante el desbloqueo'), 'error');
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
  if (manejarContactoWhatsapp._enProgreso) return;
  if (!datosActuales?.leads || !datosActuales.leads[index]) return;
  const lead = datosActuales.leads[index];

  const contacto = cacheContactosDesbloqueados[lead.id];
  const contactoSeguro = typeof sanitizarContactoCliente === 'function'
    ? sanitizarContactoCliente(contacto)
    : contacto;
  if (contactoSeguro?.whatsappUrl) {
    manejarContactoWhatsapp._enProgreso = true;
    setTimeout(() => { manejarContactoWhatsapp._enProgreso = false; }, 2500);
    window.open(contactoSeguro.whatsappUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  if (contactoSeguro?.enlace) {
    manejarContactoWhatsapp._enProgreso = true;
    setTimeout(() => { manejarContactoWhatsapp._enProgreso = false; }, 2500);
    window.open(contactoSeguro.enlace, '_blank', 'noopener,noreferrer');
    return;
  }

  await ejecutarDesbloqueoLead(lead, index);
}

/**
 * Desbloquea automáticamente un lead por su ID, enfocando la tarjeta en pantalla.
 * @param {string} leadId
 */
async function ejecutarDesbloqueoLeadPorId(leadId) {
  if (!leadId) return;
  let intentos = 0;
  while ((!datosActuales?.leads || datosActuales.leads.length === 0) && intentos < 15) {
    await new Promise(r => setTimeout(r, 200));
    intentos++;
  }
  const idx = datosActuales?.leads ? datosActuales.leads.findIndex(l => String(l.id) === String(leadId)) : -1;
  if (idx === -1) return;
  await ejecutarDesbloqueoLead(datosActuales.leads[idx], idx);
  const card = document.querySelector(`.bento-card[data-lead-id="${leadId}"]`) || document.querySelector(`.bento-card[data-index="${idx}"]`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
window.ejecutarDesbloqueoLeadPorId = ejecutarDesbloqueoLeadPorId;
