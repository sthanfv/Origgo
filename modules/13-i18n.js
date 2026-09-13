/**
 * 🌐 MÓDULO DE INTERNACIONALIZACIÓN Y TRANSICIONES SUAVES (modules/13-i18n.js)
 * Sistema bilingüe sin parpadeos (ES / EN), conversión referencial USD
 * y mutaciones de interfaz aceleradas por GPU (View Transitions API W3C).
 * Estándar Ecosistema Desmulta UI/UX (< 500 líneas).
 */

const TASA_CAMBIO_USD_COP = 4100; // Tasa de cambio de referencia comercial

const DICCIONARIO_I18N = {
  es: {
    vip_btn_default: 'Créditos / Planes', vip_btn_title: 'Ver Créditos y Planes', lang_btn_label: 'Cambiar idioma',
    search_placeholder: 'Buscar por barrio, ciudad o palabra clave...', search_clear: 'Limpiar búsqueda',
    filter_all_cities: 'Todas las Ciudades', filter_colombia_all: 'Colombia (Todas)',
    filter_today: 'Captados Hoy', filter_today_title: 'Oportunidades captadas en las últimas 24 horas',
    sort_placeholder: 'Ordenar por', sort_recent: 'Más Recientes', sort_price_asc: 'Precio: Menor a Mayor',
    sort_price_desc: 'Precio: Mayor a Menor', sort_discount: 'Mayor Oportunidad',
    hero_title: 'Inmuebles en venta <span class="editorial-italic">directo</span> de sus dueños',
    hero_subtitle: 'Sin intermediarios ni comisiones de inmobiliaria. Oportunidades y rebajas de urgencia detectadas hoy en Colombia antes de que lleguen a las agencias.',
    hero_badge_suffix: 'Sectores Monitoreados en Tiempo Real', catalog_heading: 'Inmuebles Directos en Vivo',
    catalog_count_suffix: 'oportunidades directas', catalog_count_single: 'oportunidad directa',
    catalog_empty_title: 'Sin oportunidades en esta zona',
    catalog_empty_desc: 'No se encontraron avisos directos con los filtros activos. Puedes explorar otras ciudades o restablecer.',
    catalog_btn_reset: 'Restablecer todos los filtros',
    card_view_details: 'Ver Detalles', card_listed_price: 'Precio Publicado',
    card_unlock_btn: 'Desbloquear', card_unlock_closed: 'Ver Cierre',
    card_unlocked_badge: 'Desbloqueado', card_view_ad: 'Ver Anuncio',
    card_whatsapp: 'WhatsApp', card_call: 'Llamar', card_reveal_contact: 'Revelar Contacto',
    card_time_now: '⚡ Justo ahora', card_time_ago_min: 'Hace {n} min', card_time_ago_hours: 'Hace {n} h', card_time_ago_days: 'Hace {n} d',
    card_usd_prefix: '≈ $', card_usd_suffix: 'USD',
    slideup_title: 'Detalles de la Propiedad', slideup_close_title: 'Cerrar Detalles',
    slideup_trust_badge: 'Trato Directo con el Propietario',
    slideup_trust_desc: 'Propiedad comercializada directamente por su dueño. Sin inmobiliarias ni comisiones intermedias, lista para negociar por llamada o WhatsApp.',
    slideup_unlocked_title: 'Datos de Contacto Desbloqueados', slideup_call_owner: 'Llamar al Propietario',
    slideup_direct_ad: 'Ver Anuncio Original', slideup_unlock_heading: 'Desbloquea el Contacto del Dueño',
    slideup_unlock_desc: 'Obtén de inmediato el número telefónico, enlace directo y WhatsApp del propietario para negociar sin intermediarios.',
    slideup_unlock_btn: 'Desbloquear con Créditos',
    checkout_badge: 'Pasarela de Pago Segura Wompi', checkout_title: 'Desbloqueo de Propietarios Directos',
    checkout_subtitle: 'Sin intermediarios, comisiones de agencia ni mensualidades forzosas.',
    checkout_tab_buy: 'Comprar Planes', checkout_tab_restore: 'Restaurar Cuenta', checkout_tab_account: 'Mi Membresía',
    checkout_opt_single_title: 'Desbloqueo Individual', checkout_opt_single_desc: '1 Contacto verificado del propietario directo. Ideal para compra puntual.',
    checkout_opt_pack10_title: 'Bolsa 10 Contactos', checkout_opt_pack10_desc: '$3.500 por contacto. Los créditos no vencen y quedan asociados a tu PIN.',
    checkout_opt_city_title: 'Plan Pro Ciudad', checkout_opt_city_desc: 'Acceso ilimitado por 30 días a todos los propietarios directos de tu ciudad.',
    checkout_opt_nat_title: 'Plan Nacional VIP', checkout_opt_nat_desc: 'Acceso total en toda Colombia + Radar exclusivo de rebajas de precio.',
    checkout_label_city: 'Ciudad de Cobertura Ilimitada (Plan Pro):', checkout_label_whatsapp: 'WhatsApp de Autenticación (10 dígitos):',
    checkout_ph_whatsapp: 'Ej: 3001234567', checkout_help_whatsapp: 'Tu número de WhatsApp se vinculará de forma segura a tus créditos adquiridos.',
    checkout_btn_pay: 'Conectando con pago seguro...', checkout_btn_pay_default: 'Pagar con Wompi',
    checkout_btn_wompi_note: 'Bancolombia, Nequi, PSE, Tarjeta Crédito/Débito',
    checkout_restore_title: 'Restaura tu sesión con tu PIN o Referencia de Pago', checkout_btn_restore: 'Restaurar Mi Cuenta',
    welcome_badge: 'ACCESO VIP CONFIRMADO', welcome_title: '¡Bienvenido a Origgo!',
    welcome_subtitle: 'Tu acceso directo a propietarios de inmuebles sin intermediarios.',
    welcome_pin_desc: 'Guarda tu PIN de 4 dígitos. Te servirá para restaurar tu sesión en cualquier dispositivo.',
    welcome_btn_explore: 'Comenzar a Explorar Oportunidades',
    push_badge: 'RADAR EN TIEMPO REAL', push_title: '¿Activar Alertas de Oportunidades Directas?',
    push_subtitle: 'Recibe una alerta en tu teléfono en el segundo exacto en que un propietario publique un inmueble sin comisiones inmobiliarias.',
    push_feature_1: 'Primicia total:', push_feature_1_desc: 'Entérate antes de que el inmueble llegue a portales o agencias con comisiones.',
    push_feature_2: 'Filtro por tu ciudad:', push_feature_2_desc: 'Avisos geolocalizados de tu zona de interés o inversión comercial.',
    push_feature_3: '100% libre de spam:', push_feature_3_desc: 'Solo señales cuando se confirme una oportunidad real negociada entre particulares.',
    push_btn_accept: 'Activar Radar en mi Teléfono', push_btn_later: 'Quizás más tarde / Explorar primero',
    nav_home: 'Inicio', nav_search: 'Buscar', nav_theme: 'Tema', nav_credits: 'Créditos', nav_menu: 'Menú',
    menu_lang_label: 'Idioma / Language', menu_city_label: 'Ciudad de Interés',
    menu_dashboard: 'Dashboard Principal', menu_direct_leads: 'Inmuebles Directos',
    menu_push: 'Activar Alertas en Vivo', menu_theme: 'Modo Claro / Oscuro', menu_vip: 'Desbloqueo VIP',
    menu_support: 'Soporte VIP WhatsApp', menu_terms: 'Términos & Exoneración',
    legal_title: '¿Cómo Funciona Origgo?', legal_subtitle: 'Información clara para compradores y propietarios',
    legal_tab_how: 'Cómo Funciona', legal_tab_security: 'Seguridad', legal_tab_privacy: 'Tus Datos', legal_tab_guarantee: 'Garantía de Saldo',
    legal_btn_accept: 'Entendido',
    footer_tagline: 'Monitoreo continuo en principales ciudades y polos de inversión inmobiliaria.',
    footer_col_info: 'Información y Seguridad', footer_col_support: 'Soporte y Contacto',
    footer_no_agency: 'Sin comisiones ni intermediación', footer_wa_support: 'Atención directa por WhatsApp',
    footer_theme_label: 'Modo Visual', footer_copy: '© 2026 Origgo. Conexión directa entre compradores y propietarios sin intermediarios.',
    footer_disclaimer_title: 'Aviso de Confianza:',
    footer_disclaimer: 'Origgo es una herramienta para conectar compradores directamente con propietarios. No cobramos comisiones ni participamos en las negociaciones. Te recomendamos siempre revisar la documentación del inmueble antes de hacer acuerdos.'
  },
  en: {
    vip_btn_default: 'Credits / Plans', vip_btn_title: 'View Credits & Plans', lang_btn_label: 'Change language',
    search_placeholder: 'Search by neighborhood, city or keyword...', search_clear: 'Clear search',
    filter_all_cities: 'All Cities', filter_colombia_all: 'Colombia (All)',
    filter_today: 'Captured Today', filter_today_title: 'Deals captured in the last 24 hours',
    sort_placeholder: 'Sort by', sort_recent: 'Most Recent', sort_price_asc: 'Price: Low to High',
    sort_price_desc: 'Price: High to Low', sort_discount: 'Highest Arbitrage / Discount',
    hero_title: 'Properties for sale <span class="editorial-italic">directly</span> from owners',
    hero_subtitle: 'Zero middleman and zero agency commissions. Fresh off-market opportunities and urgent price drops detected today in Colombia.',
    hero_badge_suffix: 'Districts Monitored in Real Time', catalog_heading: 'Live Direct Listings',
    catalog_count_suffix: 'direct opportunities', catalog_count_single: 'direct opportunity',
    catalog_empty_title: 'No opportunities found in this area',
    catalog_empty_desc: 'No direct owner listings found with the active filters. You can explore other cities or reset filters.',
    catalog_btn_reset: 'Reset all filters',
    card_view_details: 'View Details', card_listed_price: 'Listed Price',
    card_unlock_btn: 'Unlock Contact', card_unlock_closed: 'View Closed',
    card_unlocked_badge: 'Unlocked', card_view_ad: 'View Listing',
    card_whatsapp: 'WhatsApp', card_call: 'Call Owner', card_reveal_contact: 'Reveal Contact',
    card_time_now: '⚡ Just now', card_time_ago_min: '{n}m ago', card_time_ago_hours: '{n}h ago', card_time_ago_days: '{n}d ago',
    card_usd_prefix: '≈ $', card_usd_suffix: 'USD',
    slideup_title: 'Property Details', slideup_close_title: 'Close Details',
    slideup_trust_badge: 'Direct Deal with Owner',
    slideup_trust_desc: 'Property listed directly by its owner. Zero real estate brokers or intermediate commissions, ready to negotiate via call or WhatsApp.',
    slideup_unlocked_title: 'Unlocked Owner Contact Data', slideup_call_owner: 'Call Owner',
    slideup_direct_ad: 'View Original Listing', slideup_unlock_heading: 'Unlock Direct Owner Contact',
    slideup_unlock_desc: 'Instantly access verified direct phone number, original listing link and direct WhatsApp to negotiate commission-free.',
    slideup_unlock_btn: 'Unlock with Credits',
    checkout_badge: 'Wompi Certified Secure Payment Gateway', checkout_title: 'Unlock Direct Property Owners',
    checkout_subtitle: 'Zero middlemen, zero brokerage commissions, zero forced monthly subscriptions.',
    checkout_tab_buy: 'Purchase Plans', checkout_tab_restore: 'Restore Account', checkout_tab_account: 'My Membership',
    checkout_opt_single_title: 'Single Lead Unlock', checkout_opt_single_desc: '1 Verified direct owner contact. Ideal for a single target property.',
    checkout_opt_pack10_title: '10 Direct Unlocks Pack', checkout_opt_pack10_desc: '$3,500 COP (~$0.85 USD) per lead. Credits never expire and attach to your PIN.',
    checkout_opt_city_title: 'City Unlimited Pass', checkout_opt_city_desc: '30-day unlimited unlocks for all direct property owners across your city.',
    checkout_opt_nat_title: 'National VIP Pass', checkout_opt_nat_desc: 'Full access nationwide + exclusive urgent price-drop live radar.',
    checkout_label_city: 'Unlimited Coverage City (City Pass):', checkout_label_whatsapp: 'Authentication WhatsApp (10 digits):',
    checkout_ph_whatsapp: 'E.g: 3001234567', checkout_help_whatsapp: 'Your WhatsApp number is securely linked to your purchased credits and PIN.',
    checkout_btn_pay: 'Connecting to secure payment...', checkout_btn_pay_default: 'Pay Securely with Wompi',
    checkout_btn_wompi_note: 'Bancolombia, Nequi, PSE, Credit/Debit Cards',
    checkout_restore_title: 'Restore session with your PIN or Payment Reference', checkout_btn_restore: 'Restore My Account',
    welcome_badge: 'VIP ACCESS CONFIRMED', welcome_title: 'Welcome to Origgo!',
    welcome_subtitle: 'Your direct pipeline to property owners without real estate agency fees.',
    welcome_pin_desc: 'Keep your 4-digit PIN safe. You can use it to restore your access on any device.',
    welcome_btn_explore: 'Start Exploring Deals',
    push_badge: 'REAL-TIME RADAR', push_title: 'Enable Direct Deal Instant Alerts?',
    push_subtitle: 'Get notified on your phone the exact second an owner lists a property commission-free.',
    push_feature_1: 'First in line:', push_feature_1_desc: 'Get notified before the property reaches agency brokers with markup fees.',
    push_feature_2: 'Filter by city:', push_feature_2_desc: 'Geolocated alerts tailored to your investment or residential area.',
    push_feature_3: '100% spam-free:', push_feature_3_desc: 'Only genuine verified direct-owner listings and urgent discounts.',
    push_btn_accept: 'Activate Radar on Phone', push_btn_later: 'Maybe later / Explore first',
    nav_home: 'Home', nav_search: 'Search', nav_theme: 'Theme', nav_credits: 'Credits', nav_menu: 'Menu',
    menu_lang_label: 'Language / Idioma', menu_city_label: 'Target City',
    menu_dashboard: 'Main Dashboard', menu_direct_leads: 'Direct Properties',
    menu_push: 'Enable Live Radar Alerts', menu_theme: 'Light / Dark Mode', menu_vip: 'VIP Unlocks',
    menu_support: 'WhatsApp VIP Support', menu_terms: 'Terms & Disclaimers',
    legal_title: 'How Origgo Works', legal_subtitle: 'Clear, transparent information for buyers and property owners',
    legal_tab_how: 'How It Works', legal_tab_security: 'Security', legal_tab_privacy: 'Your Data', legal_tab_guarantee: 'Balance Guarantee',
    legal_btn_accept: 'Understood',
    footer_tagline: 'Continuous monitoring across Colombia’s major investment hubs.',
    footer_col_info: 'Information & Security', footer_col_support: 'Support & Contact',
    footer_no_agency: 'Zero agency fees and zero broker commissions', footer_wa_support: 'Direct WhatsApp support',
    footer_theme_label: 'Visual Theme', footer_copy: '© 2026 Origgo. Direct connection between buyers and owners with no intermediaries.',
    footer_disclaimer_title: 'Trust Notice:',
    footer_disclaimer: 'Origgo is a tool to connect buyers directly with property owners. We do not charge broker commissions nor take part in negotiations. We always recommend reviewing property title and documentation before agreements.'
  }
};

/**
 * Retorna el idioma actualmente seleccionado ('es' o 'en').
 * @returns {'es'|'en'}
 */
function obtenerIdiomaActual() {
  try {
    const almacenado = localStorage.getItem('origgo_lang');
    if (almacenado === 'es' || almacenado === 'en') return almacenado;
  } catch (e) {}
  if (typeof navigator !== 'undefined' && navigator.language && navigator.language.startsWith('en')) {
    return 'en';
  }
  return 'es';
}

/**
 * Traduce una clave del diccionario con fallback seguro.
 * @param {string} clave
 * @param {string} [fallback]
 * @returns {string}
 */
function t(clave, fallback = '') {
  const lang = obtenerIdiomaActual();
  const dict = DICCIONARIO_I18N[lang] || DICCIONARIO_I18N.es;
  return dict[clave] !== undefined ? dict[clave] : (fallback || clave);
}

/**
 * Convierte un monto en COP a valor aproximado en USD de forma elegante.
 * @param {string|number} precioStr
 * @returns {string} Ej: "≈ $109,750 USD"
 */
function calcularReferenciaUSD(precioStr) {
  if (!precioStr) return '';
  const limpio = String(precioStr).replace(/[^0-9]/g, '');
  const valorCop = Number(limpio);
  if (isNaN(valorCop) || valorCop <= 0) return '';
  const usd = Math.round(valorCop / TASA_CAMBIO_USD_COP);
  const usdFormateado = usd.toLocaleString('en-US');
  const lang = obtenerIdiomaActual();
  return lang === 'en' ? `≈ $${usdFormateado} USD` : `~$${usdFormateado} USD`;
}

/**
 * Actualiza las insignias de referencia en USD en todas las tarjetas Bento.
 */
function sincronizarPreciosUsdEnDOM() {
  document.querySelectorAll('.bento-card').forEach(card => {
    const priceMain = card.querySelector('.price-main');
    if (!priceMain) return;
    let elUsd = card.querySelector('.card-price-usd');
    const valorCop = priceMain.textContent.trim();
    const usdRef = calcularReferenciaUSD(valorCop);
    if (usdRef) {
      if (!elUsd) {
        elUsd = document.createElement('div');
        elUsd.className = 'card-price-usd';
        priceMain.parentNode.insertBefore(elUsd, priceMain.nextSibling);
      }
      elUsd.textContent = usdRef;
    }
  });
}

/**
 * Aplica exhaustivamente las traducciones sobre todos los elementos del DOM.
 */
function aplicarTraduccionesAlDOM() {
  const lang = obtenerIdiomaActual();
  const dict = DICCIONARIO_I18N[lang] || DICCIONARIO_I18N.es;
  
  // 1. Elementos con data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      if (key === 'hero_title') {
        el.innerHTML = dict[key];
      } else {
        el.textContent = dict[key];
      }
    }
  });

  // 2. Placeholders y tooltips
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (dict[key]) el.setAttribute('placeholder', dict[key]);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (dict[key]) el.setAttribute('title', dict[key]);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    if (dict[key]) el.setAttribute('aria-label', dict[key]);
  });

  // 3. Botón de ordenamiento
  const sortBtn = document.getElementById('cmdFilterSort');
  if (sortBtn) {
    const sortVal = typeof ordenamientoActivo !== 'undefined' ? ordenamientoActivo : '';
    const labelMap = {
      '': dict.sort_recent, 'reciente': dict.sort_recent,
      'precio_asc': dict.sort_price_asc, 'precio_desc': dict.sort_price_desc,
      'descuento': dict.sort_discount
    };
    const span = sortBtn.querySelector('span');
    if (span) span.textContent = labelMap[sortVal] || dict.sort_placeholder;
  }

  // 4. Selector de Ciudad (Label)
  const locLabel = document.getElementById('cmdFilterLocationLabel');
  if (locLabel && (typeof filtroCiudadActivo === 'undefined' || !filtroCiudadActivo)) {
    locLabel.textContent = dict.filter_all_cities;
  }

  // 5. Botones de tarjetas bento
  document.querySelectorAll('.btn-specs-pill').forEach(btn => {
    btn.innerHTML = `${dict.card_view_details} <i class="fa-solid fa-chevron-up"></i>`;
  });
  document.querySelectorAll('.pricing-label').forEach(label => {
    label.textContent = dict.card_listed_price;
  });
  document.querySelectorAll('.btn-unlock-lead:not(.closed)').forEach(btn => {
    btn.innerHTML = `<i class="fa-solid fa-lock"></i> ${dict.card_unlock_btn}`;
  });
  document.querySelectorAll('.card-unlocked-badge').forEach(badge => {
    badge.innerHTML = `<i class="fa-solid fa-unlock"></i> ${dict.card_unlocked_badge}`;
  });
  document.querySelectorAll('.btn-view-ad-direct').forEach(btn => {
    btn.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i> ${dict.card_view_ad}`;
  });

  // 6. Precios referenciales USD en tarjetas
  sincronizarPreciosUsdEnDOM();

  // 7. Sincronizar estado visual de los botones de idioma
  document.querySelectorAll('.lang-btn, .side-lang-btn').forEach(btn => {
    const targetLang = btn.getAttribute('data-lang');
    if (targetLang === lang) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
  });

  // 8. Atributo lang global en el HTML
  if (document.documentElement) {
    document.documentElement.lang = lang;
  }
}

/**
 * Conmuta el idioma con transición cinematográfica sedosa (View Transitions API).
 * @param {'es'|'en'} nuevoIdioma
 */
function cambiarIdioma(nuevoIdioma) {
  if (nuevoIdioma !== 'es' && nuevoIdioma !== 'en') return;
  const actual = obtenerIdiomaActual();
  if (actual === nuevoIdioma) return;

  try {
    localStorage.setItem('origgo_lang', nuevoIdioma);
  } catch (e) {}

  if (typeof ejecutarConTransicionSuave === 'function') {
    ejecutarConTransicionSuave(() => {
      aplicarTraduccionesAlDOM();
    });
  } else {
    aplicarTraduccionesAlDOM();
  }

  window.dispatchEvent(new CustomEvent('origgo:languageChanged', { detail: { lang: nuevoIdioma } }));
}

/**
 * Traduce dinámicamente las especificaciones del Slide-up Drawer al abrirse.
 */
function traducirSlideupDrawer() {
  const lang = obtenerIdiomaActual();
  if (lang !== 'en') return;
  const dict = DICCIONARIO_I18N.en;
  document.querySelectorAll('.slideup-title').forEach(t => {
    t.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${dict.slideup_title}`;
  });
  document.querySelectorAll('.trust-badge').forEach(b => {
    b.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${dict.slideup_trust_badge}`;
  });
  document.querySelectorAll('.trust-desc').forEach(d => {
    d.textContent = dict.slideup_trust_desc;
  });
  document.querySelectorAll('.unlocked-phone-label').forEach(l => {
    l.innerHTML = `<i class="fa-solid fa-unlock"></i> ${dict.slideup_unlocked_title}`;
  });
  document.querySelectorAll('.slideup-unlock-cta').forEach(cta => {
    const h4 = cta.querySelector('h4');
    if (h4) h4.textContent = dict.slideup_unlock_heading;
    const p = cta.querySelector('p');
    if (p) p.textContent = dict.slideup_unlock_desc;
    const btn = cta.querySelector('.btn-slideup-unlock');
    if (btn) btn.innerHTML = `<i class="fa-solid fa-bolt"></i> ${dict.slideup_unlock_btn}`;
  });
  document.querySelectorAll('.slideup-spec-key').forEach(keyEl => {
    const txt = keyEl.textContent.trim().toLowerCase();
    if (txt.includes('estrato')) keyEl.innerHTML = `<i class="fa-solid fa-layer-group"></i> Tier / Stratum`;
    else if (txt.includes('área') || txt.includes('superficie')) keyEl.innerHTML = `<i class="fa-solid fa-ruler-combined"></i> Built Area`;
    else if (txt.includes('hab') || txt.includes('alcoba')) keyEl.innerHTML = `<i class="fa-solid fa-bed"></i> Bedrooms`;
    else if (txt.includes('baño')) keyEl.innerHTML = `<i class="fa-solid fa-bath"></i> Bathrooms`;
    else if (txt.includes('parqueadero') || txt.includes('garaje')) keyEl.innerHTML = `<i class="fa-solid fa-square-parking"></i> Parking`;
    else if (txt.includes('tipo')) keyEl.innerHTML = `<i class="fa-solid fa-building"></i> Property Type`;
    else if (txt.includes('ubicación')) keyEl.innerHTML = `<i class="fa-solid fa-location-dot"></i> Location`;
    else if (txt.includes('operación')) keyEl.innerHTML = `<i class="fa-solid fa-handshake"></i> Deal Type`;
  });
}

/**
 * Inicializa los escuchadores de los botones selectores de idioma.
 */
function inicializarSelectorIdiomas() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-btn, .side-lang-btn');
    if (btn) {
      e.preventDefault();
      const targetLang = btn.getAttribute('data-lang');
      if (targetLang) cambiarIdioma(targetLang);
      return;
    }

    if (e.target.closest('[data-action="abrir-ficha"]')) {
      setTimeout(() => {
        if (obtenerIdiomaActual() === 'en') traducirSlideupDrawer();
      }, 40);
    }
  });

  const container = document.getElementById('bentoGridContainer');
  if (container && window.MutationObserver) {
    const observer = new MutationObserver(() => {
      sincronizarPreciosUsdEnDOM();
      if (obtenerIdiomaActual() === 'en') aplicarTraduccionesAlDOM();
    });
    observer.observe(container, { childList: true });
  }

  aplicarTraduccionesAlDOM();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarSelectorIdiomas);
  } else {
    inicializarSelectorIdiomas();
  }
}

if (typeof window !== 'undefined') {
  window.obtenerIdiomaActual = obtenerIdiomaActual;
  window.cambiarIdioma = cambiarIdioma;
  window.t = t;
  window.calcularReferenciaUSD = calcularReferenciaUSD;
  window.aplicarTraduccionesAlDOM = aplicarTraduccionesAlDOM;
  window.traducirSlideupDrawer = traducirSlideupDrawer;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DICCIONARIO_I18N,
    obtenerIdiomaActual,
    cambiarIdioma,
    t,
    calcularReferenciaUSD,
    aplicarTraduccionesAlDOM,
    traducirSlideupDrawer
  };
}
