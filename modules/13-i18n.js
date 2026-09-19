/**
 * 🌐 MÓDULO DE INTERNACIONALIZACIÓN Y TRANSICIONES SUAVES (modules/13-i18n.js)
 * Sistema bilingüe sin parpadeos (ES / EN), conversión referencial USD
 * y mutaciones de interfaz aceleradas por GPU (View Transitions API W3C).
 * Estándar Ecosistema Desmulta UI/UX (< 500 líneas).
 */

const TASA_CAMBIO_USD_COP = 4100; // Tasa de cambio de referencia comercial

const DICCIONARIO_I18N = {
  es: {
    vip_btn_default: 'Créditos / Planes', vip_btn_title: 'Ver Créditos y Planes', lang_btn_label: 'Cambiar idioma', search_placeholder: 'Buscar por barrio, ciudad o palabra clave...', search_clear: 'Limpiar búsqueda',
    filter_all_cities: 'Todas las Ciudades', filter_colombia_all: 'Colombia (Todas)', filter_today: 'Captados Hoy', filter_today_title: 'Oportunidades captadas en las últimas 24 horas',
    sort_placeholder: 'Ordenar por', sort_recent: 'Más Recientes', sort_price_asc: 'Precio: Menor a Mayor', sort_price_desc: 'Precio: Mayor a Menor', sort_discount: 'Mayor Oportunidad', sort_m2_asc: 'Menor $/m²', sort_rebajas: 'Rebaja Reciente', filter_op_all: 'Todas las operaciones', filter_op_sale: 'En Venta', filter_op_rent: 'En Arriendo',
    hero_title: 'Inmuebles en venta <span class="editorial-italic">directo</span> de sus dueños',
    hero_subtitle: 'Sin intermediarios ni comisiones de inmobiliaria. Oportunidades y rebajas de urgencia detectadas hoy en Colombia antes de que lleguen a las agencias.',
    hero_badge_suffix: 'Sectores Monitoreados en Tiempo Real', hero_cta: 'Ver Inmuebles Directos Disponibles', hero_about_pill_text: '¿Qué es Origgo?',
    catalog_heading: 'Inmuebles Directos en Vivo', catalog_eyebrow: 'PORTAFOLIO VERIFICADO',
    catalog_count_suffix: 'oportunidades directas', catalog_count_single: 'oportunidad directa',
    marquee_direct_title: '0% Comisión', marquee_direct_sub: 'Trato directo',
    marquee_alerts_title: 'Alertas < 3 Min', marquee_alerts_sub: 'Tiempo real',
    marquee_arbitrage_title: 'Margen Arbitraje', marquee_arbitrage_sub: 'Bajo mediana',
    marquee_access_title: 'Acceso Abierto', marquee_access_sub: 'Avisos reales',
    catalog_empty_title: 'Sin oportunidades en esta zona', catalog_empty_desc: 'No se encontraron avisos directos con los filtros activos. Puedes explorar otras ciudades o restablecer.',
    catalog_btn_reset: 'Restablecer todos los filtros', card_view_details: 'Ver Detalles', card_listed_price: 'Precio Publicado',
    card_unlock_btn: 'Ver Contacto Directo', card_unlock_closed: 'Ver Cierre', card_unlocked_badge: 'Desbloqueado', card_view_ad: 'Ver Anuncio',
    card_whatsapp: 'WhatsApp', card_call: 'Llamar', card_reveal_contact: 'Revelar Contacto',
    card_time_now: '⚡ Justo ahora', card_time_ago_min: 'Hace {n} min', card_time_ago_hours: 'Hace {n} h', card_time_ago_days: 'Hace {n} d',
    card_usd_prefix: '≈ $', card_usd_suffix: 'USD',
    slideup_title: 'Detalles de la Propiedad', slideup_close_title: 'Cerrar Detalles',
    slideup_trust_badge: 'Trato Directo con el Propietario', slideup_trust_desc: 'Propiedad comercializada directamente por su dueño. Sin inmobiliarias ni comisiones intermedias, lista para negociar por llamada o WhatsApp.',
    slideup_unlocked_title: 'Datos de Contacto Desbloqueados', slideup_call_owner: 'Llamar al Propietario',
    slideup_direct_ad: 'Ver Anuncio Original', slideup_unlock_heading: 'Desbloquea el Contacto del Dueño',
    slideup_unlock_desc: 'Obtén de inmediato el número telefónico, enlace directo y WhatsApp del propietario para negociar sin intermediarios.',
    slideup_unlock_btn: 'Desbloquear con Créditos',
    modal_summary_property: 'Inmueble:', modal_summary_location: 'Ubicación:', modal_summary_price: 'Precio Publicado:', modal_summary_unit_value: 'Valor Unitario:',
    checkout_badge: 'Pasarela de Pago Segura Wompi', checkout_title: 'Desbloqueo de Propietarios Directos', checkout_subtitle: 'Sin intermediarios, comisiones de agencia ni mensualidades forzosas.',
    checkout_tab_buy: 'Comprar Planes', checkout_tab_restore: 'Restaurar Cuenta', checkout_tab_account: 'Mi Membresía', checkout_freemium_ribbon: '🎁 BIENVENIDA ($0)', checkout_opt_free_title: '1 Desbloqueo Gratis', checkout_opt_free_desc: 'Pruébalo sin pagar. 1 contacto directo de regalo ingresando tu WhatsApp y Correo.', checkout_btn_magic_link: 'Acceso Seguro sin PIN', checkout_label_email: 'Correo Electrónico (para Acceso Seguro):', checkout_help_email: 'Te enviaremos tu enlace de acceso seguro sin contraseñas ni PINs difíciles.',
    checkout_opt_single_title: 'Desbloqueo Individual', checkout_opt_single_desc: '1 Contacto verificado del propietario directo. Ideal para compra puntual.',
    checkout_opt_pack10_title: 'Bolsa 10 Contactos', checkout_opt_pack10_desc: '$3.500 por contacto. Los créditos no vencen y quedan asociados a tu PIN.',
    checkout_opt_city_title: 'Plan Pro Ciudad', checkout_opt_city_desc: 'Acceso ilimitado por 30 días a todos los propietarios directos de tu ciudad.',
    checkout_opt_nat_title: 'Plan Nacional VIP', checkout_opt_nat_desc: 'Acceso total en toda Colombia + Radar exclusivo de rebajas de precio.',
    checkout_popular_ribbon: '⭐ Más Popular (-30%)', checkout_month_suffix: '/ mes', checkout_city_select_default: '-- Selecciona tu ciudad --',
    checkout_label_city: 'Ciudad de Cobertura Ilimitada (Plan Pro):', checkout_city_help: 'Tu membresía desbloqueará sin límite todos los contactos directos de la ciudad elegida durante 30 días.',
    checkout_wa_alert_title: 'Atención: Ingresa tu WhatsApp REAL y activo', checkout_wa_alert_desc: 'Este número es tu identificador único de seguridad. Si ingresas un número falso o equivocado, no podrás acceder a tus créditos ni recuperar tu PIN. El sistema no realiza llamadas ni spam.',
    checkout_label_whatsapp: 'WhatsApp de Autenticación (10 dígitos):', checkout_ph_whatsapp: 'Ej: 300 123 4567', checkout_help_whatsapp: 'Tus créditos quedarán sellados con este celular para que los uses desde cualquier teléfono o PC.',
    checkout_btn_pay: 'Continuar al Pago Seguro con Wompi', checkout_btn_pay_default: 'Pagar con Wompi', checkout_btn_wompi_note: 'PSE, Nequi, Tarjetas Crédito y Débito', checkout_merchant_title: 'Operador de Cobro Oficial:', checkout_merchant_desc: 'Tu pago se procesa de forma segura a través de pasarela certificada y vigilada por la Superintendencia Financiera a nombre de nuestro comercio operador registrado Desmulta.', checkout_guarantee_wompi: 'Pasarela Segura Wompi (Vigilada SFC)', checkout_guarantee_instant: 'Activación Instantánea',
    checkout_restore_title: 'Restaura tu sesión con tu PIN o Referencia de Pago', checkout_btn_restore: 'Restaurar Mis Créditos', checkout_restore_intro: 'Si ya adquiriste créditos o un plan en otro navegador o dispositivo, ingresa tu número de WhatsApp y tu Código de Acceso Origgo (ej. HNT-7489).',
    checkout_restore_wa_label: 'WhatsApp Registrado:', checkout_restore_pin_label: 'Código de Acceso (PIN) o Ref. Wompi:', checkout_restore_pin_ph: 'Ej: HNT-7489 o Referencia de Pago', checkout_restore_pin_help: 'Ingresa tu PIN o pega la referencia de tu comprobante bancario para auto-acreditarte en vivo.',
    checkout_forgot_pin_btn: '¿Olvidaste tu Código? Restaurar por Correo', checkout_forgot_pin_desc: 'Ingresa el Correo Electrónico que utilizaste durante tu pago en Wompi. Te enviaremos instrucciones de recuperación si la cuenta existe.',
    checkout_email_label: 'Correo Electrónico de Compra:', checkout_email_ph: 'ejemplo@correo.com', checkout_btn_send_instructions: 'Enviar instrucciones',
    checkout_user_pin_protected: 'PIN protegido', checkout_user_balance_label: 'Saldo Disponible', checkout_user_benefits_btn: 'Ver Privilegios de mi Membresía', checkout_user_btn_plans: 'Planes & Recargas', checkout_user_btn_logout: 'Cerrar Sesión',
    welcome_badge: 'ACCESO VIP CONFIRMADO', welcome_title: '¡Bienvenido a Origgo!', welcome_subtitle: 'Tu acceso directo a propietarios de inmuebles sin intermediarios.',
    welcome_wa_label: 'WhatsApp Asociado', welcome_pin_label: 'Tu PIN Maestro de Acceso', welcome_copy_btn: 'Copiar', welcome_privileges_tag: 'Tus Privilegios Activos', welcome_footer_note: '100% Trato Directo • Sin Intermediarios • Sin Cargos Ocultos', welcome_pin_desc: 'Guarda tu PIN de 4 dígitos. Te servirá para restaurar tu sesión en cualquier dispositivo.', welcome_btn_explore: 'Comenzar a Explorar Oportunidades',
    push_badge: 'RADAR EN TIEMPO REAL', push_title: '¿Activar Alertas de Oportunidades Directas?', push_subtitle: 'Recibe una alerta en tu teléfono en el segundo exacto en que un propietario publique un inmueble sin comisiones inmobiliarias.',
    push_feature_1: 'Primicia total:', push_feature_1_desc: 'Entérate antes de que el inmueble llegue a portales o agencias con comisiones.', push_feature_2: 'Filtro por tu ciudad:', push_feature_2_desc: 'Avisos geolocalizados de tu zona de interés o inversión comercial.', push_feature_3: '100% libre de spam:', push_feature_3_desc: 'Solo señales cuando se confirme una oportunidad real negociada entre particulares.', push_btn_accept: 'Activar Radar en mi Teléfono', push_btn_later: 'Quizás más tarde / Explorar primero', push_city_label: 'Zona o ciudad de alertas:', push_city_all: '🇨🇴 Toda Colombia', push_btn_update: 'Actualizar Preferencia de Zona',
    push_ios_title: 'Para activar en iPhone:', push_ios_desc: ' Toca Compartir (⎋) en Safari y selecciona "Agregar al inicio" (+).', push_op_label: 'Tipo de negocio:', push_op_all: '🏷️ Todo (Venta y Arriendo)', push_op_sale: '🏡 Solo Venta', push_op_rent: '🔑 Solo Arriendo', push_discount_label: '📉 Solo alertarme si el propietario baja el precio o aplica rebaja urgente',
    nav_home: 'Inicio', nav_search: 'Buscar', nav_theme: 'Tema', nav_credits: 'Créditos', nav_menu: 'Menú', menu_lang_label: 'Idioma / Language', menu_city_label: 'Ciudad de Interés',
    menu_about: '¿Qué es Origgo?', menu_dashboard: 'Dashboard Principal', menu_direct_leads: 'Inmuebles Directos', menu_push: 'Activar Alertas en Vivo', menu_theme: 'Modo Claro / Oscuro', menu_vip: 'Desbloqueo VIP', menu_support: 'Soporte VIP WhatsApp', menu_terms: 'Términos & Exoneración', menu_logout: 'Cerrar Sesión',
    onboarding_badge: 'BIENVENIDO A ORIGGO', onboarding_title: 'Oportunidades directas, de persona a persona.',
    onboarding_subtitle: 'El punto de encuentro donde compradores e inversionistas tratan directamente con los dueños reales, sin intermediarios.',
    onboarding_p1_title: 'Encuentra antes que los demás', onboarding_p1_desc: 'Rastreamos el mercado todos los días para encontrar oportunidades recién publicadas por sus dueños, antes de que pasen a terceros.',
    onboarding_p2_title: 'Trato directo sin comisiones', onboarding_p2_desc: 'Hablas directamente con el propietario. Sin agencias intermediarias, sin comisiones de por medio y sin sobrecostos.',
    onboarding_p3_title: 'Tú tienes el control', onboarding_p3_desc: 'Explora libremente el catálogo. Cuando una oportunidad se ajuste a lo que buscas, desbloqueas el contacto en un solo toque.',
    onboarding_cta_btn: 'Comenzar a Explorar Oportunidades', onboarding_footer_note: '100% Trato Directo · Cero Comisiones de Agencia · Información Verificada',
    legal_header_tag: 'Transparencia y Confianza', legal_title: '¿Cómo Funciona Origgo?', legal_subtitle: 'Información clara para compradores y propietarios',
    legal_tab_how: 'Cómo Funciona', legal_tab_security: 'Seguridad', legal_tab_privacy: 'Tus Datos', legal_tab_guarantee: 'Garantía de Saldo', legal_btn_accept: 'Entendido',
    footer_bio: 'Plataforma de conexión directa con propietarios de inmuebles en Colombia. Sin intermediarios, sin comisiones de agencia y con oportunidades verificadas en tiempo real.',
    footer_tagline: 'Monitoreo continuo en principales ciudades y polos de inversión inmobiliaria.', footer_telegram: 'Canal de Telegram',
    footer_col_info: 'Información y Seguridad', footer_col_support: 'Soporte y Contacto', footer_no_agency: 'Sin comisiones ni intermediación', footer_wa_support: 'Atención directa por WhatsApp',
    footer_theme_label: 'Modo Visual', footer_copy: '© 2026 Origgo. Conexión directa entre compradores y propietarios sin intermediarios.',
    footer_disclaimer_title: 'Aviso de Confianza:', footer_disclaimer: 'Origgo es una herramienta para conectar compradores directamente con propietarios. No cobramos comisiones ni participamos en las negociaciones. Te recomendamos siempre revisar la documentación del inmueble antes de hacer acuerdos.',
    toast_default_title: 'Notificación Origgo', toast_action_required: 'Acción Requerida', toast_attention: 'Atención', toast_info: 'Información',
    toast_radar_active: '🔔 ¡Radar activado! Te avisaremos en tu teléfono cuando se capte un nuevo inmueble directo.',
    toast_radar_unsupported: 'Tu navegador no soporta notificaciones push nativas.', toast_radar_denied: 'Permiso de notificaciones rechazado o bloqueado.',
    stat_leads_total: 'Propietarios Directos', stat_ciudades: 'Ciudades Activas', stat_sectores: 'Sectores Monitoreados', catalog_freshness: 'Actualizado hace un momento',
    trust_badge: 'DIRECTO AL PUNTO', trust_headline: 'Nosotros rastreamos y filtramos el mercado por ti. <br class="trust-br" /><span>Tú negocias directo con el dueño real.</span>',
    trust_subtext: 'Buscar vivienda no debería ser perder semanas llamando a intermediarios ni navegando en un mar de anuncios repetidos. Escaneamos Colombia las 24 horas, descartamos comisiones del 3%–4% y te entregamos solo oportunidades reales y verificadas.',
    trust_p1_title: 'Rastreo 24/7', trust_p1_desc: 'Escaneamos cientos de fuentes continuas. No tienes que revisar portales todos los días.',
    trust_p2_title: 'Cero Comisiones', trust_p2_desc: 'Ahorra entre $10M y $30M en comisiones de corretaje negociando de tú a tú.',
    trust_p3_title: '1er Contacto Gratis', trust_p3_desc: 'Prueba el servicio sin costo: desbloquea un propietario real con tu WhatsApp.',
    trust_p3_cta: 'Probar 1er Desbloqueo'
  },
  en: {
    vip_btn_default: 'Credits / Plans', vip_btn_title: 'View Credits & Plans', lang_btn_label: 'Change language', search_placeholder: 'Search by neighborhood, city or keyword...', search_clear: 'Clear search',
    filter_all_cities: 'All Cities', filter_colombia_all: 'Colombia (All)', filter_today: 'Captured Today', filter_today_title: 'Deals captured in the last 24 hours',
    sort_placeholder: 'Sort by', sort_recent: 'Most Recent', sort_price_asc: 'Price: Low to High', sort_price_desc: 'Price: High to Low', sort_discount: 'Highest Arbitrage / Discount', sort_m2_asc: 'Lowest $/sqm', sort_rebajas: 'Recent Price Drop', filter_op_all: 'All Operations', filter_op_sale: 'For Sale', filter_op_rent: 'For Rent',
    hero_title: 'Properties for sale <span class="editorial-italic">directly</span> from owners',
    hero_subtitle: 'Zero middleman and zero agency commissions. Fresh off-market opportunities and urgent price drops detected today in Colombia.',
    hero_badge_suffix: 'Districts Monitored in Real Time', hero_cta: 'View Available Direct Properties', hero_about_pill_text: 'What is Origgo?',
    catalog_heading: 'Live Direct Listings', catalog_eyebrow: 'VERIFIED PORTFOLIO',
    catalog_count_suffix: 'direct opportunities', catalog_count_single: 'direct opportunity',
    marquee_direct_title: '0% Commission', marquee_direct_sub: 'Direct deal',
    marquee_alerts_title: 'Alerts < 3 Min', marquee_alerts_sub: 'Real time',
    marquee_arbitrage_title: 'High Arbitrage', marquee_arbitrage_sub: 'Below market',
    marquee_access_title: 'Open Access', marquee_access_sub: 'Verified leads',
    catalog_empty_title: 'No opportunities found in this area', catalog_empty_desc: 'No direct owner listings found with the active filters. You can explore other cities or reset filters.',
    catalog_btn_reset: 'Reset all filters', card_view_details: 'View Details', card_listed_price: 'Listed Price',
    card_unlock_btn: 'View Direct Contact', card_unlock_closed: 'View Closed', card_unlocked_badge: 'Unlocked', card_view_ad: 'View Listing',
    card_whatsapp: 'WhatsApp', card_call: 'Call', card_reveal_contact: 'Reveal Contact',
    card_time_now: '⚡ Just now', card_time_ago_min: '{n}m ago', card_time_ago_hours: '{n}h ago', card_time_ago_days: '{n}d ago',
    card_usd_prefix: '≈ $', card_usd_suffix: 'USD',
    slideup_title: 'Property Overview', slideup_close_title: 'Close Overview',
    slideup_trust_badge: 'Direct Deal with Owner', slideup_trust_desc: 'Property marketed directly by its legitimate owner. Zero brokerage markups and zero intermediate agents, ready for direct call or WhatsApp.',
    slideup_unlocked_title: 'Unlocked Contact Details', slideup_call_owner: 'Call Owner',
    slideup_direct_ad: 'View Original Listing', slideup_unlock_heading: 'Unlock Verified Owner Direct Contact',
    slideup_unlock_desc: 'Get immediate verified telephone, direct link, and WhatsApp of the owner to negotiate with no intermediaries.',
    slideup_unlock_btn: 'Unlock with Credits',
    modal_summary_property: 'Property:', modal_summary_location: 'Location:', modal_summary_price: 'Listed Price:', modal_summary_unit_value: 'Unit Value:',
    checkout_badge: 'Wompi Secure Payment Gateway', checkout_title: 'Direct Owner Contact Unlock', checkout_subtitle: 'No middlemen, zero broker commissions, and no recurring commitments.',
    checkout_tab_buy: 'Buy Passes', checkout_tab_restore: 'Restore Account', checkout_tab_account: 'My Membership', checkout_freemium_ribbon: '🎁 WELCOME GIFT ($0)', checkout_opt_free_title: '1 Free Unlock', checkout_opt_free_desc: 'Try it free. 1 direct contact gift by entering your WhatsApp and Email.', checkout_btn_magic_link: 'Direct Secure Access', checkout_label_email: 'Email (for Passwordless Secure Access):', checkout_help_email: 'We will send your instant access link with no passwords or complex PINs needed.',
    checkout_opt_single_title: 'Single Direct Unlock', checkout_opt_single_desc: '1 Verified direct owner contact. Ideal for a one-off negotiation.',
    checkout_opt_pack10_title: '10 Contacts Pro Pack', checkout_opt_pack10_desc: 'Only $3,500 each. Credits never expire and remain sealed to your secure PIN.',
    checkout_opt_city_title: 'Pro City Pass', checkout_opt_city_desc: 'Unlimited 30-day access to all direct owners in your chosen city.',
    checkout_opt_nat_title: 'National VIP Pass', checkout_opt_nat_desc: 'Full access across Colombia + Exclusive Price Drop radar.',
    checkout_popular_ribbon: '⭐ Most Popular (-30%)', checkout_month_suffix: '/ month', checkout_city_select_default: '-- Select your target city --',
    checkout_label_city: 'Unlimited Coverage City (Pro Pass):', checkout_city_help: 'Your pass unlocks all direct contacts in your chosen city for 30 full days.',
    checkout_wa_alert_title: 'Important: Enter your REAL active WhatsApp', checkout_wa_alert_desc: 'This number is your unique security key. If you enter an invalid number, you cannot access credits or restore your PIN. We never spam or place phone calls.',
    checkout_label_whatsapp: 'Authentication WhatsApp (10 digits):', checkout_ph_whatsapp: 'E.g., 300 123 4567', checkout_help_whatsapp: 'Your credits are cryptographically sealed to this phone number.',
    checkout_btn_pay: 'Proceed to Secure Payment with Wompi', checkout_btn_pay_default: 'Pay with Wompi', checkout_btn_wompi_note: 'PSE, Nequi, Credit & Debit Cards', checkout_merchant_title: 'Official Billing Merchant:', checkout_merchant_desc: 'Your payment is securely processed through an officially monitored payment gateway under our registered merchant Desmulta.', checkout_guarantee_wompi: 'Regulated Wompi Gateway (SFC Monitored)', checkout_guarantee_instant: 'Instant Activation',
    checkout_restore_title: 'Restore your session with PIN or Payment Reference', checkout_btn_restore: 'Restore My Credits', checkout_restore_intro: 'If you previously bought credits on another device, enter your WhatsApp and Origgo Access PIN (e.g. HNT-7489).',
    checkout_restore_wa_label: 'Registered WhatsApp:', checkout_restore_pin_label: 'Access PIN or Wompi Ref:', checkout_restore_pin_ph: 'E.g., HNT-7489 or Payment Reference', checkout_restore_pin_help: 'Enter your PIN or paste the bank reference code to auto-credit your balance.',
    checkout_forgot_pin_btn: 'Forgot your PIN? Restore via Email', checkout_forgot_pin_desc: 'Enter the Email used during your Wompi checkout. We will email your login link.',
    checkout_email_label: 'Checkout Email:', checkout_email_ph: 'user@example.com', checkout_btn_send_instructions: 'Send instructions',
    checkout_user_pin_protected: 'Protected PIN', checkout_user_balance_label: 'Available Balance', checkout_user_benefits_btn: 'View Membership Privileges', checkout_user_btn_plans: 'Plans & Top-Ups', checkout_user_btn_logout: 'Log Out',
    welcome_badge: 'VIP ACCESS CONFIRMED', welcome_title: 'Welcome to Origgo!', welcome_subtitle: 'Your direct pipeline to property owners without real estate agency fees.',
    welcome_wa_label: 'Linked WhatsApp', welcome_pin_label: 'Your Master Access PIN', welcome_copy_btn: 'Copy', welcome_privileges_tag: 'Your Active Privileges', welcome_footer_note: '100% Direct Deal • Zero Middlemen • Zero Hidden Fees', welcome_pin_desc: 'Keep your 4-digit PIN safe. You can use it to restore your access on any device.', welcome_btn_explore: 'Start Exploring Deals',
    push_badge: 'LIVE OPPORTUNITY RADAR', push_title: 'Enable Real-Time Direct Listing Alerts?', push_subtitle: 'Receive instant phone alerts the exact second an owner publishes an off-market property with zero brokerage commissions.',
    push_feature_1: 'Total head-start:', push_feature_1_desc: 'Catch fresh deals before they reach saturated portals or agency catalogs.', push_feature_2: 'Filter by city:', push_feature_2_desc: 'Geolocated alerts tailored to your investment or residential area.', push_feature_3: '100% spam-free:', push_feature_3_desc: 'Only genuine verified direct-owner listings and urgent discounts.', push_btn_accept: 'Activate Radar on Phone', push_btn_later: 'Maybe later / Explore first', push_city_label: 'Alerts target city or region:', push_city_all: '🇨🇴 All Colombia', push_btn_update: 'Save Radar Preference',
    push_ios_title: 'To activate on iPhone:', push_ios_desc: ' Tap Share (⎋) in Safari and tap "Add to Home Screen" (+).', push_op_label: 'Deal type:', push_op_all: '🏷️ All (Sale & Rent)', push_op_sale: '🏡 For Sale Only', push_op_rent: '🔑 For Rent Only', push_discount_label: '📉 Only alert me if the owner drops the price or applies an urgent discount',
    nav_home: 'Home', nav_search: 'Search', nav_theme: 'Theme', nav_credits: 'Credits', nav_menu: 'Menu', menu_lang_label: 'Language / Idioma', menu_city_label: 'Target City',
    menu_about: 'What is Origgo?', menu_dashboard: 'Main Dashboard', menu_direct_leads: 'Direct Properties', menu_push: 'Enable Live Radar Alerts', menu_theme: 'Light / Dark Mode', menu_vip: 'VIP Unlocks', menu_support: 'WhatsApp VIP Support', menu_terms: 'Terms & Disclaimers', menu_logout: 'Log Out',
    onboarding_badge: 'WELCOME TO ORIGGO', onboarding_title: 'Direct deals, person to person.',
    onboarding_subtitle: 'Where buyers and investors connect directly with verified owners, zero middlemen.',
    onboarding_p1_title: 'Discover first, before the crowd', onboarding_p1_desc: 'We monitor the market daily to catch deals freshly listed by their owners, before agencies step in.',
    onboarding_p2_title: 'Direct negotiations, 0% commission', onboarding_p2_desc: 'Deal directly with the owner. No brokerage fees, no middleman markups, and no fine print.',
    onboarding_p3_title: 'Full control in your hands', onboarding_p3_desc: 'Browse the portfolio freely. Whenever you spot a deal you like, unlock direct contact in one tap.',
    onboarding_cta_btn: 'Start Exploring Opportunities', onboarding_footer_note: '100% Direct Deals • Zero Agency Commission • Verified Records',
    legal_header_tag: 'Transparency & Trust', legal_title: 'How Origgo Works', legal_subtitle: 'Clear, transparent information for buyers and owners',
    legal_tab_how: 'How It Works', legal_tab_security: 'Security', legal_tab_privacy: 'Your Data', legal_tab_guarantee: 'Balance Guarantee', legal_btn_accept: 'Understood',
    footer_bio: 'Direct connection platform with property owners in Colombia. Zero middleman, zero agency commissions, and real-time verified opportunities.',
    footer_tagline: 'Continuous monitoring across Colombia’s major investment hubs.', footer_telegram: 'Telegram Channel',
    footer_col_info: 'Information & Security', footer_col_support: 'Support & Contact', footer_no_agency: 'Zero agency fees and zero broker commissions', footer_wa_support: 'Direct WhatsApp support',
    footer_theme_label: 'Visual Theme', footer_copy: '© 2026 Origgo. Direct connection between buyers and owners with no intermediaries.',
    footer_disclaimer_title: 'Trust Notice:', footer_disclaimer: 'Origgo is a tool to connect buyers directly with property owners. We do not charge broker commissions nor take part in negotiations. We always recommend reviewing property title and documentation before agreements.',
    toast_default_title: 'Origgo Notification', toast_action_required: 'Action Required', toast_attention: 'Attention', toast_info: 'Information',
    toast_radar_active: '🔔 Radar activated! We will notify your phone when a new direct property is captured.', toast_radar_unsupported: 'Your browser does not support native push notifications.', toast_radar_denied: 'Notification permission was denied or blocked.', stat_leads_total: 'Direct Owners', stat_ciudades: 'Active Cities', stat_sectores: 'Sectors Monitored', catalog_freshness: 'Updated moments ago',
    trust_badge: 'STRAIGHT TO THE POINT', trust_headline: 'We track and filter the market for you. <br class="trust-br" /><span>You deal directly with the real owner.</span>',
    trust_subtext: "House hunting shouldn't mean wasting weeks calling middlemen or sorting through duplicate listings. We monitor Colombia 24/7, cut out 3-4% broker commissions, and deliver only verified opportunities.",
    trust_p1_title: '24/7 Market Scan', trust_p1_desc: "We scan multiple sources non-stop so you don't have to check portals daily.",
    trust_p2_title: 'Zero Brokerage Commissions', trust_p2_desc: 'Save $2,500 to $8,000+ USD in brokerage fees by negotiating person-to-person.',
    trust_p3_title: '1st Contact Free', trust_p3_desc: 'Test the service for free: unlock a real direct owner with your WhatsApp.',
    trust_p3_cta: 'Try 1st Unlock Free',
    footer_sic: 'Superintendency of Industry and Commerce (SIC)',
    checkout_legal_consent: 'By continuing, you authorize data processing (Law 1581) and accept our',
    legal_link_terms: 'Terms of Service',
    legal_link_and: 'and',
    legal_link_privacy: 'Privacy Policy'
  }
};

const TEXTOS_LEGALES_ORIGGO_EN = {
  terminos: { titulo: 'Terms and Conditions of Use', subtitulo: 'Public Aggregation & Market Intelligence Terminal — Version v1.0 (September 2026)', badge: 'Intelligence & Aggregation Terminal', icono: 'fa-solid fa-file-contract', html: '<div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-server"></i> 1. Software Nature: Intelligence & Aggregation Terminal</div><p>Origgo is algorithmic market monitoring, classification, and real estate intelligence software in Colombia. <strong>Origgo is not a real estate agency, broker, or exclusive listing repository</strong>. We do not represent buyers or sellers, hold keys, set prices, or participate in property walkthroughs, earnest deposits, or sales/rental deeds; our technological function is structuring open public data and connecting buyers directly with advertisers for direct deals.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-network-wired"></i> 2. Public Data Indexing & No Exclusivity</div><p>Displayed listings and links originate from open public sources on the internet, aggregated via referential search algorithms. Origgo claims no exclusivity, commercial mandate, or legal ownership over referenced properties or public imagery.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-bolt"></i> 3. Analytical Query Credits & Instant Execution</div><p>Each purchased credit enables analytical query and direct viewing of the advertiser\'s verified contact channel. Under Art. 47.1 of Colombian Consumer Law 1480/2011, accessing a contact constitutes an instantly and definitively executed digital service.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-lock"></i> 4. Clear Pricing in Colombian Pesos (COP) & Wompi</div><p>All prices in COP. Encrypted bank-level payments via Wompi Bancolombia (SFC regulated), with zero hidden fees or forced recurring charges.</p></div>' },
  exoneracion: { titulo: 'Due Diligence & Disclaimer', subtitulo: 'Essential recommendations for buyers and advertisers — Version v1.0 (September 2026)', badge: 'Due Diligence', icono: 'fa-solid fa-shield-halved', html: '<div class="legal-section legal-section-warning"><div class="legal-section-badge"><i class="fa-solid fa-circle-exclamation"></i> 1. Physical Inspection & Title Verification</div><p>Always inspect the property in person, verify the owner identity, and obtain an official Title Certificate (Certificado de Tradición y Libertad) before transferring funds or signing agreements.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-scale-balanced"></i> 2. Neutral Software & Agreements Between Private Parties</div><p>As neutral search and intelligence software, Origgo is not liable for latent defects, unilateral price changes, physical property condition, or private agreements between parties.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-copyright"></i> 3. Third-Party Trademarks & Intellectual Property</div><p>Trademarks, names, or brand signs appearing incidentally on public source images belong to their respective owners. Origgo has no affiliation, partnership, or sponsorship with external portals or competitors.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-user-lock"></i> 4. Anti-Spam & Fair Use</div><p>Access is strictly for legitimate personal or commercial direct-deal purposes. Automated mass data extraction (scraping), data resale, and spam/harassment to owners are strictly prohibited.</p></div>' },
  privacidad: { titulo: 'Personal Data Processing Policy', subtitulo: 'Habeas Data Compliance (Law 1581/2012) — Version v1.0 (September 2026)', badge: 'Data Privacy (SIC)', icono: 'fa-solid fa-user-shield', html: '<div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-database"></i> 1. Purpose of Data Processing</div><p>User phone and email are collected solely to: <strong>(i)</strong> safeguard unlock credits, <strong>(ii)</strong> issue purchase receipts and secure access links (Magic Link), and <strong>(iii)</strong> provide support. <strong>Zero data selling and zero spam</strong>.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-key"></i> 2. AES-256 Military-Grade Encryption</div><p>Owner phone numbers are stored encrypted with AES-256-GCM. Browsing is protected with HTTPS/TLS and OWASP headers.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-id-card"></i> 3. Rights of Data Subjects (Habeas Data)</div><p>Under Law 1581 of 2012, data subjects may request the update or removal of public contact details directly via platform self-service channels or official WhatsApp.</p></div><div class="legal-section legal-section-highlight"><div class="legal-section-badge"><i class="fa-solid fa-shield-cat"></i> 4. Automated Delisting for Owners</div><p>Origgo operates as an open public source search and indexing engine. If an owner has already closed their deal or wishes to remove their listing from the index, they can request immediate removal with the property reference.</p></div>' },
  reembolsos: { titulo: 'Credit Balance Guarantee & PQR', subtitulo: 'Commercial & Consumer Protection Framework — Version v1.0 (September 2026)', badge: 'Guarantee & Reversal', icono: 'fa-solid fa-rotate-left', html: '<div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-shield-halved"></i> 1. Your Balance Never Expires</div><p>Purchased credits do not expire. If you switch devices or clear cookies, restore them anytime using <strong>"Restore Account"</strong> with your WhatsApp.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-arrow-rotate-left"></i> 2. Right of Withdrawal & Payment Reversal</div><p>For unconsumed credit packs, users may exercise withdrawal within 5 business days of purchase (Art. 47 Law 1480). For system errors or duplicate charges, payment reversal applies under Decree 587/2016.</p></div><div class="legal-section"><div class="legal-section-badge"><i class="fa-solid fa-headset"></i> 3. Petitions & Inquiries (PQR)</div><p>For inquiries regarding balance transactions or Wompi payments, contact Origgo official WhatsApp with your payment reference. Business-day support under Colombian commercial regulations.</p></div>' }
};

function obtenerIdiomaActual() {
  try {
    const almacenado = localStorage.getItem('origgo_lang');
    if (almacenado === 'es' || almacenado === 'en') return almacenado;
  } catch (e) {}
  if (typeof obtenerCookieSegura === 'function') {
    const c = obtenerCookieSegura('origgo_lang');
    if (c === 'es' || c === 'en') return c;
    try {
      const p = JSON.parse(obtenerCookieSegura('origgo_prefs') || '{}');
      if (p.lang === 'es' || p.lang === 'en') return p.lang;
    } catch (_) {}
  }
  return (typeof navigator !== 'undefined' && navigator.language && navigator.language.startsWith('en')) ? 'en' : 'es';
}

function t(clave, fallback = '') {
  const lang = obtenerIdiomaActual(), dict = DICCIONARIO_I18N[lang] || DICCIONARIO_I18N.es;
  return dict[clave] !== undefined ? dict[clave] : (fallback || clave);
}

function calcularReferenciaUSD(precioStr) {
  if (!precioStr) return '';
  const limpio = String(precioStr).replace(/[^0-9]/g, ''), valorCop = Number(limpio);
  if (isNaN(valorCop) || valorCop <= 0) return '';
  const usd = Math.round(valorCop / TASA_CAMBIO_USD_COP), usdFormateado = usd.toLocaleString('en-US');
  return obtenerIdiomaActual() === 'en' ? `≈ $${usdFormateado} USD` : `~$${usdFormateado} USD`;
}

/**
 * Actualiza las insignias de referencia en USD en todas las tarjetas Bento.
 */
function sincronizarPreciosUsdEnDOM() {
  const isEn = typeof obtenerIdiomaActual === 'function' && obtenerIdiomaActual() === 'en';
  document.querySelectorAll('.bento-card').forEach(card => {
    const priceMain = card.querySelector('.price-main');
    if (!priceMain) return;
    let elUsd = card.querySelector('.card-price-usd');
    const valorCop = priceMain.textContent.trim(), usdRef = calcularReferenciaUSD(valorCop);
    if (usdRef) {
      if (!elUsd) {
        elUsd = document.createElement('div');
        elUsd.className = 'card-price-usd';
        priceMain.parentNode.insertBefore(elUsd, priceMain.nextSibling);
      }
      elUsd.textContent = usdRef;
    }
  });
  const usdMap = { single_lead: '≈ $1.20 USD', pack_10_leads: '≈ $8.50 USD', subscription_city: '≈ $22 USD/mo', subscription_national: '≈ $36 USD/mo' };
  document.querySelectorAll('.pricing-option-card').forEach(card => {
    const pEl = card.querySelector('.option-price');
    if (!pEl) return;
    let badgeUsd = card.querySelector('.option-usd-ref');
    const prod = card.getAttribute('data-product'), refTxt = usdMap[prod];
    if (refTxt && isEn) {
      if (!badgeUsd) {
        badgeUsd = document.createElement('span');
        badgeUsd.className = 'option-usd-ref';
        pEl.appendChild(badgeUsd);
      }
      badgeUsd.textContent = ` (${refTxt})`;
    } else if (badgeUsd) { badgeUsd.remove(); }
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
      if (key === 'hero_title' || key === 'trust_headline') {
        el.innerHTML = dict[key];
      } else {
        el.textContent = dict[key];
      }
    }
  });

  const selCity = document.getElementById('checkoutCitySelect');
  if (selCity) {
    const optDef = selCity.querySelector('option[value=""]');
    if (optDef) optDef.textContent = dict.checkout_city_select_default || '-- Selecciona tu ciudad --';
  }

  // 2. Placeholders y tooltips
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { const k = el.getAttribute('data-i18n-ph'); if (dict[k]) el.setAttribute('placeholder', dict[k]); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { const k = el.getAttribute('data-i18n-title'); if (dict[k]) el.setAttribute('title', dict[k]); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { const k = el.getAttribute('data-i18n-aria'); if (dict[k]) el.setAttribute('aria-label', dict[k]); });

  // 3. Botón de ordenamiento
  const sortBtn = document.getElementById('cmdFilterSort');
  if (sortBtn) {
    const sortVal = typeof criterioOrdenActivo !== 'undefined' ? criterioOrdenActivo : '';
    const labelMap = { '': dict.sort_recent, 'reciente': dict.sort_recent, 'recientes': dict.sort_recent, 'precio_asc': dict.sort_price_asc, 'precio_desc': dict.sort_price_desc, 'descuento': dict.sort_discount, 'precio_m2_asc': dict.sort_m2_asc, 'rebajas': dict.sort_rebajas };
    const span = sortBtn.querySelector('#cmdFilterSortLabel') || sortBtn.querySelector('span');
    if (span) span.textContent = labelMap[sortVal] || dict.sort_recent || dict.sort_placeholder;
    document.querySelectorAll('#cmdSortDropdown .cmd-dropdown-item').forEach(item => {
      const sVal = item.getAttribute('data-sort'), itemSpan = item.querySelector('span');
      if (itemSpan && labelMap[sVal]) itemSpan.textContent = labelMap[sVal];
    });
  }

  // 4. Selector de Ciudad y Operación (Labels)
  const locLabel = document.getElementById('cmdFilterLocationLabel');
  if (locLabel && (typeof filtroCiudadActivo === 'undefined' || !filtroCiudadActivo)) locLabel.textContent = dict.filter_all_cities;
  const opLabel = document.getElementById('cmdFilterOperationLabel');
  if (opLabel) { const opMap = { '': dict.filter_op_all, 'venta': dict.filter_op_sale, 'arriendo': dict.filter_op_rent }; opLabel.textContent = opMap[typeof filtroOperacionActivo !== 'undefined' ? filtroOperacionActivo : ''] || dict.filter_op_all; }

  // 5. Botones de tarjetas bento
  document.querySelectorAll('.btn-specs-pill').forEach(btn => { btn.innerHTML = `${dict.card_view_details} <i class="fa-solid fa-chevron-up"></i>`; });
  document.querySelectorAll('.pricing-label').forEach(label => { label.textContent = dict.card_listed_price; });
  document.querySelectorAll('.btn-unlock-lead:not(.closed)').forEach(btn => { btn.innerHTML = `<i class="fa-solid fa-lock"></i> ${dict.card_unlock_btn}`; });
  document.querySelectorAll('.card-unlocked-badge').forEach(badge => { badge.innerHTML = `<i class="fa-solid fa-unlock"></i> ${dict.card_unlocked_badge}`; });
  document.querySelectorAll('.btn-view-ad-direct').forEach(btn => { btn.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i> ${dict.card_view_ad}`; });

  // 6. Precios referenciales USD en tarjetas
  sincronizarPreciosUsdEnDOM();

  // 7. Badge de sectores y contador de catálogo dinámicos
  const elBadgeSectoresHero = document.getElementById('badgeSectoresHero');
  if (elBadgeSectoresHero) {
    const m = (elBadgeSectoresHero.textContent || '').match(/\d+/);
    const n = m ? m[0] : '26';
    elBadgeSectoresHero.textContent = `${n} ${dict.hero_badge_suffix}`;
  }
  const countEl = document.getElementById('catalogCountText');
  if (countEl) {
    const m = (countEl.textContent || '').match(/\d+/);
    const n = m ? parseInt(m[0], 10) : 0;
    countEl.textContent = `${n} ${n === 1 ? dict.catalog_count_single : dict.catalog_count_suffix}`;
  }

  // 8. Sincronizar estado visual de los botones de idioma
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

  // 9. Atributo lang global en el HTML con inmunidad notranslate
  if (document.documentElement) {
    document.documentElement.lang = lang;
    document.documentElement.classList.add('notranslate');
    document.documentElement.setAttribute('translate', 'no');
  }

  // 10. Aviso anti-impresión localizado
  const printNotice = document.getElementById('printProtectionNotice');
  if (printNotice) {
    const isEn = lang === 'en';
    const b = printNotice.querySelector('.print-notice-badge'), t = printNotice.querySelector('.print-notice-title'), l = printNotice.querySelector('.print-notice-lead'), c = printNotice.querySelector('.print-notice-card');
    if (b) b.textContent = isEn ? 'ORIGGO PRIVACY & SECURITY' : 'SEGURIDAD Y PRIVACIDAD ORIGGO';
    if (t) t.textContent = isEn ? 'PROTECTED DOCUMENT — LAW 1581 OF 2012' : 'DOCUMENTO PROTEGIDO — LEY 1581 DE 2012';
    if (l) l.textContent = isEn ? 'Due to constitutional data protection (Habeas Data) and unauthorized brokerage prevention, printing or mass scraping of this catalog is strictly restricted.' : 'Por protección constitucional de datos personales de los propietarios (Habeas Data) y prevención de intermediación inmobiliaria no autorizada, la impresión, exportación a PDF o extracción masiva de este catálogo está estrictamente restringida.';
    if (c) c.innerHTML = isEn
      ? '<p><strong>Personal & Exclusive Use:</strong> Direct owner contact details may only be accessed individually by authenticated account holders.</p><p><strong>Active Forensic Traceability:</strong> Mass redistribution, commercial resale, or forwarding this directory to third-party brokers violates platform terms and Colombian Data Protection regulations.</p>'
      : '<p><strong>Uso Personal y Exclusivo:</strong> Los números telefónicos y datos de contacto directo de los inmuebles únicamente pueden ser consultados de forma individual por el titular de la cuenta autenticada.</p><p><strong>Trazabilidad Forense Activa:</strong> Cualquier redistribución masiva, comercialización o suministro de este directorio a terceras inmobiliarias o bases de datos externas vulnera las políticas de la plataforma y el Régimen General de Protección de Datos Personales de Colombia.</p>';
  }

  // 11. Sincronizar badge VIP según idioma
  if (typeof actualizarBadgeVip === 'function') actualizarBadgeVip();
}

/**
 * Conmuta el idioma de manera instantánea y atómica en el DOM (0ms de latencia, cero parpadeos).
 * @param {'es'|'en'} nuevoIdioma
 */
function cambiarIdioma(nuevoIdioma) {
  if (nuevoIdioma !== 'es' && nuevoIdioma !== 'en') return;
  const actual = obtenerIdiomaActual();
  if (actual === nuevoIdioma) return;

  try { localStorage.setItem('origgo_lang', nuevoIdioma); } catch (e) {}
  if (typeof sincronizarPreferenciasEnServidor === 'function') sincronizarPreferenciasEnServidor(nuevoIdioma, null);

  aplicarTraduccionesAlDOM();

  // Re-renderizar la grilla Bento para reflejar instantáneamente el nuevo idioma
  if (typeof datosActuales !== 'undefined' && datosActuales && typeof renderizarInterfaz === 'function') {
    renderizarInterfaz(datosActuales);
  }

  // Actualizar cualquier ficha técnica abierta
  traducirSlideupDrawer();

  // Actualizar badges y botones VIP
  if (typeof actualizarBadgeVip === 'function') actualizarBadgeVip();

  // Actualizar modales abiertos si están activos en pantalla
  if (typeof renderizarContenidoLegal === 'function') {
    const modalLegal = document.getElementById('modalLegalOverlay');
    if (modalLegal && modalLegal.classList.contains('active')) {
      const activeTab = typeof pestanaLegalActiva !== 'undefined' ? pestanaLegalActiva : 'terminos';
      renderizarContenidoLegal(activeTab);
    }
  }

  const checkoutModal = document.getElementById('checkoutModal');
  if (checkoutModal && checkoutModal.classList.contains('active') && typeof abrirModalCheckout === 'function') {
    abrirModalCheckout();
  }

  const welcomeModal = document.getElementById('modalWelcomeSuccess');
  if (welcomeModal && welcomeModal.classList.contains('active') && typeof abrirModalBienvenidaVIP === 'function') {
    abrirModalBienvenidaVIP(null, typeof sesionUsuario !== 'undefined' ? sesionUsuario : null);
  }

  window.dispatchEvent(new CustomEvent('origgo:languageChanged', { detail: { lang: nuevoIdioma } }));
}

/**
 * Traduce dinámicamente las especificaciones del Slide-up Drawer al abrirse o cambiar de idioma.
 */
function traducirSlideupDrawer() {
  const lang = obtenerIdiomaActual(), dict = DICCIONARIO_I18N[lang] || DICCIONARIO_I18N.es, isEn = lang === 'en';
  document.querySelectorAll('.card-slideup-overlay').forEach(overlay => {
    const card = overlay.closest('.bento-card');
    const isUnlocked = card?.classList.contains('card-unlocked');
    const cTitle = card?.querySelector('.card-title')?.textContent;
    const sTitle = overlay.querySelector('.slideup-title');
    if (sTitle) {
      sTitle.textContent = '';
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-circle-info';
      sTitle.appendChild(icon);
      sTitle.appendChild(document.createTextNode(' ' + (isUnlocked && cTitle ? cTitle : (dict.slideup_title || ''))));
    }
  });
  document.querySelectorAll('.trust-badge').forEach(b => { b.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${dict.slideup_trust_badge}`; });
  document.querySelectorAll('.trust-desc').forEach(d => { d.textContent = dict.slideup_trust_desc; });
  document.querySelectorAll('.unlocked-phone-label').forEach(l => { l.innerHTML = `<i class="fa-solid fa-unlock"></i> ${dict.slideup_unlocked_title}`; });
  document.querySelectorAll('.next-steps-title').forEach(t => { t.innerHTML = `<i class="fa-solid fa-list-check"></i> ${isEn ? 'Next Steps to Close Deal' : 'Siguientes Pasos de Negociación'}`; });
  document.querySelectorAll('.slideup-next-steps').forEach(steps => {
    const list = steps.querySelector('.next-steps-list');
    if (list) {
      list.innerHTML = `<li class="next-step-item"><span class="next-step-num">1</span><span><strong>${isEn ? 'Contact:' : 'Contacto:'}</strong> ${isEn ? 'Send pre-formatted WhatsApp message or place direct phone call.' : 'Envía el mensaje de WhatsApp preparado o realiza llamada directa.'}</span></li><li class="next-step-item"><span class="next-step-num">2</span><span><strong>${isEn ? 'Tour:' : 'Visita:'}</strong> ${isEn ? 'Ask for additional media and arrange property walkthrough.' : 'Pide fotos adicionales y agenda visita presencial al inmueble.'}</span></li><li class="next-step-item"><span class="next-step-num">3</span><span><strong>${isEn ? 'Deal:' : 'Acuerdo:'}</strong> ${isEn ? 'Verify title certificate and negotiate with zero agency fees.' : 'Verifica el certificado de tradición y acuerda sin pagar comisión.'}</span></li>`;
    }
  });
  document.querySelectorAll('.slideup-cta-btn:not(.btn-whatsapp-direct):not(.cta-call):not(.cta-neutral)').forEach(btn => {
    btn.innerHTML = `<i class="fa-solid fa-unlock-keyhole"></i> ${dict.slideup_unlock_btn || (isEn ? 'Unlock Owner Contact' : 'Desbloquear Contacto del Dueño')}`;
  });
  document.querySelectorAll('.slideup-cta-btn.cta-call, .btn-call-direct').forEach(btn => { btn.innerHTML = `<i class="fa-solid fa-phone"></i> ${isEn ? 'Call' : 'Llamar'}`; });
  document.querySelectorAll('.slideup-cta-btn.cta-neutral, .btn-view-ad-direct').forEach(btn => { btn.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i> ${isEn ? 'View Listing' : 'Ver Anuncio'}`; });
  document.querySelectorAll('.slideup-cta-note:not(.slideup-cta-note-ok)').forEach(note => {
    note.innerHTML = `<i class="fa-solid fa-bolt"></i> ${isEn ? 'Instant access • Zero broker commissions' : 'Acceso al instante • Sin pagar comisiones'}`;
  });
  document.querySelectorAll('.slideup-cta-note-ok').forEach(note => {
    note.innerHTML = `<i class="fa-solid fa-check-double"></i> ${isEn ? 'Contact and direct link unlocked for your account' : 'Contacto y enlace directo desbloqueados para tu cuenta'}`;
  });
  const specKeyMap = [
    { match: /estrato|stratum|tier/i, icon: 'fa-layer-group', es: 'Estrato', en: 'Stratum' }, { match: /área|area|superficie/i, icon: 'fa-ruler-combined', es: 'Área', en: 'Built Area' },
    { match: /hab|alcoba|bed/i, icon: 'fa-bed', es: 'Habitaciones', en: 'Bedrooms' }, { match: /baño|bath/i, icon: 'fa-bath', es: 'Baños', en: 'Bathrooms' },
    { match: /parqueadero|garaje|parking/i, icon: 'fa-square-parking', es: 'Parqueaderos', en: 'Parking' }, { match: /contacto|contact/i, icon: 'fa-user-shield', es: 'Contacto', en: 'Contact' },
    { match: /tipo|type/i, icon: 'fa-building', es: 'Tipo', en: 'Property Type' }, { match: /ubicación|location/i, icon: 'fa-location-dot', es: 'Ubicación', en: 'Location' },
    { match: /operación|deal/i, icon: 'fa-handshake', es: 'Operación', en: 'Deal Type' }
  ];
  document.querySelectorAll('.slideup-spec-card').forEach(card => {
    const keyEl = card.querySelector('.slideup-spec-key'), valEl = card.querySelector('.slideup-spec-val');
    if (!keyEl || !valEl) return;
    const txtKey = keyEl.textContent.trim();
    for (const item of specKeyMap) {
      if (item.match.test(txtKey)) { keyEl.innerHTML = `<i class="fa-solid ${item.icon}"></i> ${isEn ? item.en : item.es}`; break; }
    }
    const txtVal = valEl.textContent.trim().toLowerCase();
    if (/contacto|contact/i.test(txtKey) || /propietario|owner|verificado|verified/i.test(txtVal)) {
      valEl.innerHTML = `<span class="verified-badge-wrap"><i class="fa-solid fa-circle-check verified-badge-icon"></i> ${isEn ? 'Verified Owner' : 'Propietario Verificado'}</span>`;
    } else if (isEn) {
      valEl.textContent = valEl.textContent.replace(/(\d+)\s*Residencial/gi, '$1 Residential').replace(/\b1\s*alcobas?\b/gi, '1 Bedroom').replace(/(\d+)\s*alcobas?\b/gi, '$1 Bedrooms').replace(/\b1\s*completos?\b/gi, '1 Full Bath').replace(/(\d+)\s*completos?\b/gi, '$1 Full Baths').replace(/\b1\s*espacios?\b/gi, '1 Space').replace(/(\d+)\s*espacios?\b/gi, '$1 Spaces');
    }
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
      setTimeout(() => { if (obtenerIdiomaActual() === 'en') traducirSlideupDrawer(); }, 40);
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializarSelectorIdiomas);
  else inicializarSelectorIdiomas();
}
if (typeof window !== 'undefined') { Object.assign(window, { obtenerIdiomaActual, cambiarIdioma, t, calcularReferenciaUSD, aplicarTraduccionesAlDOM, traducirSlideupDrawer, TEXTOS_LEGALES_ORIGGO_EN }); }
if (typeof module !== 'undefined' && module.exports) { module.exports = { DICCIONARIO_I18N, obtenerIdiomaActual, cambiarIdioma, t, calcularReferenciaUSD, aplicarTraduccionesAlDOM, traducirSlideupDrawer }; }
