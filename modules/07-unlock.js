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
      const specsPanel = cardBody.querySelector('.card-specs-panel');
      if (specsPanel && specsPanel.parentNode) {
        specsPanel.parentNode.insertBefore(phoneBar, specsPanel.nextSibling);
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
      <button type="button" class="btn-dossier-direct" onclick="abrirDossierImprimible('${leadId}')" title="${isEn ? 'Print / Download Property Dossier' : 'Imprimir / Descargar Ficha PDF'}">
        <i class="fa-solid fa-file-pdf"></i> ${isEn ? 'PDF' : 'PDF'}
      </button>
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
        : (isEn ? [
            { paso: 1, titulo: 'Contact:', accion: 'Send pre-formatted WhatsApp message or place direct phone call.' },
            { paso: 2, titulo: 'Tour:', accion: 'Ask for additional media and arrange property walkthrough.' },
            { paso: 3, titulo: 'Deal:', accion: 'Verify title certificate and negotiate with zero agency fees.' }
          ] : [
            { paso: 1, titulo: 'Contacto:', accion: 'Envía el mensaje de WhatsApp preparado o realiza llamada directa.' },
            { paso: 2, titulo: 'Visita:', accion: 'Pide fotos adicionales y agenda visita presencial al inmueble.' },
            { paso: 3, titulo: 'Acuerdo:', accion: 'Verifica el certificado de tradición y acuerda sin pagar comisión.' }
          ]));

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
            <button type="button" class="slideup-cta-btn cta-flex-sm cta-neutral" onclick="abrirDossierImprimible('${leadId}')" title="${isEn ? 'Print / Download PDF Dossier' : 'Imprimir / Descargar Ficha PDF'}">
              <i class="fa-solid fa-file-pdf"></i> ${isEn ? 'PDF' : 'PDF'}
            </button>
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
      const palabraCredito = data.creditsRemaining === 1
        ? (esIngles ? 'credit' : 'crédito')
        : (esIngles ? 'credits' : 'créditos');
      mensajeExito = esIngles
        ? `🎉 Contact unlocked! Remaining balance: ${data.creditsRemaining} ${palabraCredito}.`
        : `🎉 ¡Contacto desbloqueado! Saldo restante: ${data.creditsRemaining} ${palabraCredito}.`;
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

/**
 * Abre una ventana emergente optimizada para impresión con el dossier completo de la propiedad.
 * @param {string} leadId
 */
function abrirDossierImprimible(leadId) {
  const dataset = window._origgoDatasetCompleto || (window.datosLeadsCache ? { leads: window.datosLeadsCache } : null);
  const lead = dataset?.leads?.find(l => String(l.id) === String(leadId)) || (typeof leadSeleccionado !== 'undefined' ? leadSeleccionado : null);
  if (!lead) return;
  const contacto = (typeof cacheContactosDesbloqueados !== 'undefined' ? cacheContactosDesbloqueados[leadId] : null) || lead.contacto;
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  const tel = contacto?.telefonoDisplay || contacto?.telefono || (isEn ? 'Direct in listing' : 'Directo en anuncio');
  const wa = contacto?.whatsappUrl || '';
  const web = contacto?.enlace || '';
  const html = `<!DOCTYPE html><html lang="${isEn ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${lead.titulo || 'Origgo Dossier'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #0A110E; background: #FFF; }
    .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 18px; }
    .logo { font-size: 28px; font-weight: 800; color: #047857; margin: 0; }
    .tag { font-size: 10px; color: #059669; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
    .box { border: 1px solid #CBDAD0; border-radius: 12px; padding: 18px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0; }
    .metric { background: #F2F7F4; border-radius: 8px; padding: 10px; text-align: center; }
    .metric-k { font-size: 10px; color: #4B6358; font-weight: 800; text-transform: uppercase; }
    .metric-v { font-size: 15px; font-weight: 800; color: #0A110E; margin-top: 4px; }
    .contact { background: #ECFDF5; border: 2px solid #059669; border-radius: 12px; padding: 18px; text-align: center; margin: 18px 0; }
    .phone { font-size: 24px; font-weight: 800; color: #064E3B; font-family: monospace; letter-spacing: 2px; }
    .btn { display: inline-block; background: #059669; color: #FFF; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px; margin: 6px 4px; cursor: pointer; border: none; }
    .wa-btn { background: #25D366; }
    .notice { background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 12px; font-size: 12px; color: #991B1B; line-height: 1.4; margin-top: 16px; }
    @media print { .no-print { display: none !important; } }
  </style></head><body>
    <div class="header"><h1 class="logo">Origgo</h1><div class="tag">${isEn ? 'CONFIDENTIAL PROPERTY DOSSIER · DIRECT OWNER' : 'DOSSIER CONFIDENCIAL DE PROPIEDAD · TRATO DIRECTO'}</div></div>
    <div class="box">
      <h2 style="margin:0 0 6px;">${lead.titulo || ''}</h2>
      <p style="color:#4B6358;margin:0 0 14px;font-size:13px;">📍 ${lead.ubicacion || 'Colombia'} · <em>${contacto?.portal || lead.portal || 'Finca Raíz'}</em></p>
      <div class="grid">
        <div class="metric"><div class="metric-k">${isEn ? 'Price' : 'Precio'}</div><div class="metric-v" style="color:#047857;">${lead.precio || 'Consultar'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Area' : 'Área'}</div><div class="metric-v">${lead.detalles?.['Área'] || lead.dato_1 || 'N/A'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Value / m²' : 'Valor / m²'}</div><div class="metric-v">${lead.precio_m2 || 'N/A'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Rooms' : 'Habitaciones'}</div><div class="metric-v">${lead.detalles?.['Habitaciones'] || 'N/A'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Baths' : 'Baños'}</div><div class="metric-v">${lead.detalles?.['Baños'] || 'N/A'}</div></div>
        <div class="metric"><div class="metric-k">${isEn ? 'Stratum' : 'Estrato'}</div><div class="metric-v">${lead.detalles?.['Estrato'] || 'N/A'}</div></div>
      </div>
    </div>
    <div class="contact">
      <div style="font-size:11px;font-weight:800;color:#047857;letter-spacing:1px;margin-bottom:6px;">${isEn ? 'VERIFIED DIRECT OWNER CONTACT' : 'CONTACTO DIRECTO VERIFICADO'}</div>
      <div class="phone">${tel}</div>
      <div style="margin-top:12px;">
        ${wa ? `<a href="${wa}" target="_blank" class="btn wa-btn">💬 WhatsApp</a>` : ''}
        ${web ? `<a href="${web}" target="_blank" class="btn">🔗 ${isEn ? 'View Ad' : 'Ver Anuncio'}</a>` : ''}
      </div>
    </div>
    <div class="notice">
      <strong>🛡️ ${isEn ? 'Direct Closing Protocol:' : 'Protocolo de Cierre Directo:'}</strong>
      ${isEn ? 'Verify Title Certificate before sending down payment. Negotiate directly with 0% broker fees.' : 'Verifica el Certificado de Tradición y Libertad antes de transferir anticipos. Negocia sin comisiones de agencia.'}
    </div>
    <div style="text-align:center;margin-top:24px;" class="no-print">
      <button onclick="window.print()" class="btn" style="font-size:14px;padding:12px 28px;">🖨️ ${isEn ? 'Print / Save as PDF' : 'Imprimir / Guardar como PDF'}</button>
    </div>
  </body></html>`;
  w.document.write(html);
  w.document.close();
}
window.abrirDossierImprimible = abrirDossierImprimible;
