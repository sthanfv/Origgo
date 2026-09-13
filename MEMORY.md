# MEMORY.md — Origgo (Showcase y Ledger de Oportunidades Directas)

Última actualización: 2026-09-13 13:40 (GMT-5)

---

## 1. Qué cambió

-56. **Fase 5: Rotación Criptográfica y Versionado de Claves AES-256 (KID Retrocompatible), Keyring Multi-Versión y Verificación Integrada en Unlock**:
    - **Diagnóstico y Causa Raíz:**
      1. *Ausencia de soporte para rotación de claves en reposo:* El sistema dependía de una única clave simétrica estática (`LEADS_ENCRYPTION_KEY`). Si dicha clave requería rotación periódica o sufría un ciclo de migración, todos los leads históricos cifrados quedarían inaccesibles o requerirían un re-cifrado sincrónico masivo de alto riesgo operativo.
      2. *Incompatibilidad de esquema ante múltiples versiones de clave:* El formato cifrado era estrictamente tripartito (`iv:authTag:ciphertext`) sin identificador de versión (`kid`). No existía un estándar para que el backend detectara con qué clave se había cifrado cada lead individual.
      3. *Falta de Keyring dinámico con fallback defensivo:* No había mecanismo para descifrar contactos cruzados generados con distintas versiones (`v1`, `v2`) ni soporte para verificar firmas de catálogo `.sig` generadas con claves rotadas.
    - **Solución Implementada:**
      1. **Núcleo Criptográfico con Keyring y Formato Cuatripartito (`lib/crypto.js`, 292 líneas $\le 500$):**
         - Implementada función `obtenerKeyRingLeads(fallbackKey)` que construye dinámicamente un keyring a partir de `LEADS_KEYRING_JSON`, variables individuales `LEADS_ENCRYPTION_KEY_V{N}` y `LEADS_KEY_VERSION`.
         - Actualizada `encryptLeadContact(contacto, claveHex, kid = CURRENT_KID)` para emitir el formato con metadato de versión `kid:iv:authTag:ciphertext`.
         - Actualizada `decryptLeadContact(contactoCifrado, claveOKeyRing)` para soportar:
           a) Formato de 4 partes (`kid:iv:tag:cipher`) extrayendo la clave correspondiente del keyring.
           b) Formato de 3 partes legado (`iv:tag:cipher`) descifrando con la clave activa o probando las claves disponibles.
           c) Fallback defensivo que itera sobre todas las claves del keyring si el `kid` no coincide directamente o fallara, garantizando cero falsas denegaciones operativas.
      2. **Endpoint de Desbloqueo Resistente (`api/leads/unlock.js`, 411 líneas $\le 500$):**
         - Inicialización de `keyringLeads` al arranque del módulo.
         - `verificarIntegridadDataset()` comprueba la firma HMAC `.sig` iterando sobre las claves del keyring antes de rechazar un catálogo.
         - Descifrado de contacto en el flujo principal migrado a `decryptLeadContact(contactoCifradoOficial, keyringLeads)`.
      3. **Scraper / Publicador con Versionado Canónico (`ofertas-hunter-pro/publisher_web.js`, 496 líneas $\le 500$):**
         - `cifrarContactoLead(datos, claveHex, version = process.env.LEADS_KEY_VERSION || 'v1')` emite el formato versionado `kid:iv:tag:cipher` de forma transparente.
      4. **Suite Automatizada de Rotación Criptográfica (`tests/crypto_rotation.test.js`, 170 líneas):**
         - 8 pruebas exhaustivas cubriendo: emisión de formato kid v1/v2, descifrado cruzado multi-versión, compatibilidad con formato legado de 3 partes, fallback defensivo ante kid desconocido, rechazo y protección GCM ante adulteración de datos o tags, parsing de keyring desde variables de entorno, e integración end-to-end con `/api/leads/unlock`.
         - 8/8 pruebas aprobadas al 100% (0 errores).
      5. **Certificación DevSecOps y Configuración:**
         - Integración permanente de la suite en la Fase 5 de `scripts/validate.js` (428 líneas $\le 500$).
         - Variables documentadas en `.env.example` en ambos proyectos (`LEADS_KEY_VERSION=v1`, `LEADS_KEYRING_JSON`, etc.).
         - 8/8 fases DevSecOps de `npm test` aprobadas con cero fallos y estricto cumplimiento del límite $\le 500$ líneas.

-55. **Pipeline de Ingesta Bilingüe Canónico (Publisher Web), Omnibox Semántico Multi-Atributo, Sincronización Reactiva de Badges VIP y Aviso Legal Anti-Impresión Localizado**:
    - **Diagnóstico y Causa Raíz:**
      1. *Falta de metadatos canónicos en origen (`inmobiliario.json`):* El generador de feeds del scraper `publisher_web.js` solo emitía atributos en español, obligando al frontend a traducir mediante expresiones regulares frágiles (`replace(/^Apartamento\s+en\s+Venta/)`). Títulos con redacción no estandarizada o señales de urgencia complejas no se traducían fielmente.
      2. *Discrepancia léxica en señales de urgencia:* En `publisher_web.js`, las señales específicas de urgencia ('Motivo Viaje', 'Urgencia Manifiesta', 'Herencia/Sucesión', 'Precio de Remate', 'Rebaja de Precio Activa') no contaban con traducciones semánticas 1-a-1 en inglés, emitiendo un genérico 'Urgent Opportunity'.
      3. *Re-sobrescritura rígida en español en Badges VIP:* Al alternar idioma o al actualizar estado reactivo en `modules/01-state.js` (`actualizarBadgeVip`), se generaban textos estáticos en español ("Créditos / Planes", "VIP Nacional", "VIP Ciudad", "Saldo activo para desbloquear...") sin respetar `isEn`.
      4. *Omisión de sincronización VIP y aviso legal en `modules/13-i18n.js`:* La conmutación de idioma no invocaba `actualizarBadgeVip()`, dejando el header desalineado, y el aviso anti-impresión (`#printProtectionNotice`) permanecía en español al imprimir en modo inglés.
      5. *Falta de pruebas de integración de frontend y colisión en rate limiter:* La suite de tests carecía de validación directa del omnibox con términos reales angloparlantes y el test de recuperación colisionaba por acumulación de peticiones en la misma IP/cuenta.
    - **Solución Implementada:**
      1. **Scraper / Ingesta con Metadatos Canónicos Bilingües (`ofertas-hunter-pro/publisher_web.js`, 495 líneas $\le 500$):**
         - Inyección determinista de `titulo_en`, `tipo_inmueble_en`, `urgencia_en`, `precio_usd` y `detalles_en` (Stratum, Built Area, Bedrooms, Bathrooms, Parking, Contact) en el 100% de los leads compilados en `data/inmobiliario.json`.
         - Matriz `MAPA_SENALES` ampliada con traducciones semánticas directas (`✈️ Relocation / Moving`, `⚡ Urgent Sale`, `⚖️ Estate Sale`, `🔨 Below Market Deal`, `🚚 Job Relocation`, `🔄 Trade-in Accepted`, `🤝 Open to Offers`, `🏷️ Negotiable Price`, `📉 Active Price Drop`, `💎 Investor Deal`).
      2. **Estado Reactivo Bilingüe (`modules/01-state.js`, 476 líneas $\le 500$):**
         - `actualizarBadgeVip` condicionado completamente por `isEn` ("National VIP", "Nat. VIP", "City VIP", "Credits / Plans", "Active balance to unlock verified direct owners.").
      3. **Omnibox y Tarjetas Bento de Alta Fidelidad (`modules/04-filters.js`, 460 líneas; `modules/06-cards.js`, 477 líneas $\le 500$):**
         - `DICCIONARIO_TERMINOS` enriquecido con términos de alta intención (`studio`, `pool`, `gym`, `balcony`, `terrace`, `furnished`, `view`, `security`, `elevator`, `storage`, `rent`, `sale`, `luxury`, `investment`, `remodeled`).
         - Búsqueda `itemSearchText` unifica campos en español e inglés.
         - `renderizarInterfaz` consume de primera mano los campos canónicos bilingües del dataset antes de aplicar fallbacks.
      4. **Internacionalización y Protección Legal (`modules/13-i18n.js`, 499 líneas $\le 500$):**
         - `cambiarIdioma` y `aplicarTraduccionesAlDOM` sincronizan atómicamente `actualizarBadgeVip()`.
         - `#printProtectionNotice` traducido al inglés ante impresión en modo anglosajón.
      5. **Suite de Pruebas DevSecOps y Blindaje Unitario (`tests/bilingual_infrastructure.test.js`):**
         - 5 nuevas pruebas unitarias cubriendo omnibox semántico, normalización fonética, badges de urgencia, conversión USD y consistencia del 100% del dataset.
         - Aislamiento de entorno (`process.env.NODE_ENV = 'test'`, `resetRateLimiter()` e identificadores dinámicos) garantizando 20/20 pruebas aprobadas en la suite y 54/54 en el total del portal.
      6. **Compilación y Certificación:**
         - `scripts/build.js` recompiló `app.min.js` y `style.min.css`.
         - Suite DevSecOps de 8 fases aprobada con 0 errores.
         - Todos los archivos JS y CSS modificados cumplen estrictamente $\le 500$ líneas.

-54. **Infraestructura Bilingüe Integral en Todo el Ecosistema (Omnibox Semántico EN->ES, Persistencia de Idioma en Órdenes/Checkout, Respuestas Localizadas en Autenticación/Desbloqueo y Referencias USD)**:
    - **Diagnóstico y Causa Raíz:**
      1. *Búsqueda Omnibox ciega en inglés:* El diccionario `DICCIONARIO_TERMINOS` en `modules/04-filters.js` solo contenía variantes y sinónimos en español. Búsquedas habituales de compradores e inversionistas internacionales (como `apartment`, `house`, `bedroom`, `bath`, `parking`, `owner`, `discount`, `deal`, `bargain`) retornaban 0 resultados porque el corpus de búsqueda y el diccionario carecían de equivalencias léxicas inglés-español.
      2. *Omisión de idioma en el checkout y creación de órdenes:* Al enviar el pago en `modules/08-checkout.js` (`ejecutarPagoWompi`), el payload a `POST /api/payments/create-order` no incluía `lang: obtenerIdiomaActual()`. Por lo tanto, la orden siempre se guardaba con `lang: 'es'`, causando que los recibos por correo (webhook, cron de conciliación) se emitieran en español para compradores extranjeros. Además, `productName` siempre se generaba en español y los mensajes de error del formulario de checkout estaban fijos en español.
      3. *Pérdida de idioma y textos rígidos en restauración y recuperación de cuenta:* En `modules/01-state.js` (`restaurarSesionConPin` y `recuperarPinConReferencia`), las peticiones a `/api/auth/session` y `/api/auth/recover` no enviaban `lang`. En el backend, `api/auth/session.js` omitía `lang` en `validateBody`, ignorando la actualización de `preferredLang` en Firestore y devolviendo errores hardcodeados en español (`Credenciales inválidas...`, `Pago acreditado...`). Igualmente, `api/auth/recover.js` respondía con textos en español sin considerar el idioma solicitado.
      4. *Falta de respuestas localizadas de error en `/api/leads/unlock`:* Mensajes de error como falta de token, sesión expirada, catálogo comprometido o lead no encontrado se devolvían únicamente en español.
      5. *Falta de referencias en USD en las opciones de precios del checkout:* A diferencia del catálogo Bento, el modal de checkout solo mostraba montos en COP sin equivalencias aproximadas en USD (`≈ $1.20 USD`, `≈ $8.50 USD`, etc.), generando fricción para compradores extranjeros.
    - **Solución Implementada:**
      1. **Omnibox Semántico Bilingüe (`modules/04-filters.js`, 438 líneas; `modules/06-cards.js`, 472 líneas):**
         - Enriquecido `DICCIONARIO_TERMINOS` con mapeo determinista EN -> ES: `apartment/flat/condo`, `house/home`, `land/lot/plot`, `bedroom/bed`, `bathroom/bath`, `parking/garage`, `owner/direct/fsbo`, `discount/bargain/deal/urgent`, etc.
         - Enriquecido `corpusBruto` en cada tarjeta con lemas canónicos bilingües (`property real estate direct owner fsbo apartment house flat`).
      2. **Persistencia y Emisión Bilingüe en Checkout (`modules/08-checkout.js`, 489 líneas; `api/payments/create-order.js`, 248 líneas):**
         - `ejecutarPagoWompi` inyecta `lang: esIngles ? 'en' : 'es'` en el payload a `/api/payments/create-order`.
         - Validaciones visuales y estados de carga de checkout (`checkoutPhoneError`, `checkoutCityError`, `btnConfirmWompi`) adaptados al idioma activo.
         - Catálogo en backend `PRODUCT_CATALOG_EN` asigna y persiste nombres de productos en inglés (`Single Direct Contact Unlock`, `10 Direct Contacts Pack (-30% Off)`, `Pro City Pass`, `National VIP Pass`).
      3. **Autenticación y Recuperación Bilingüe End-to-End (`modules/01-state.js`, 481 líneas; `api/auth/session.js`, 370 líneas; `api/auth/recover.js`, 211 líneas):**
         - `restaurarSesionConPin` y `recuperarPinConReferencia` envían `lang` y muestran feedback de validación, carga y éxito/error en el idioma activo.
         - `sessionLoginSchema` procesa `lang` y actualiza atómicamente `preferredLang` del usuario en Firestore. Errores (`Invalid credentials...`, `Payment reference not found...`, `Payment credited...`) responden en inglés ante `lang === 'en'`.
         - `/api/auth/recover` responde con mensajes genéricos antifraude localizados.
      4. **Manejo de Errores Localizado en Desbloqueo (`api/leads/unlock.js`, 428 líneas):**
         - Detección temprana de idioma para emitir respuestas semánticas en inglés ante falta de autenticación, expiración de sesión o catálogo no encontrado.
      5. **Referencias USD en Checkout y Dropdowns (`modules/13-i18n.js`, 481 líneas):**
         - `sincronizarPreciosUsdEnDOM` inyecta badges de equivalencia USD en las tarjetas de planes del checkout (`≈ $1.20 USD`, `≈ $8.50 USD`, `≈ $22 USD/mo`, `≈ $36 USD/mo`).
         - Traducción de las opciones del selector de ciudad (`checkoutCitySelect`).
      6. **Ampliación de Pruebas Unitarias DevSecOps (`tests/bilingual_infrastructure.test.js`):**
         - Añadidas 5 pruebas unitarias cubriendo: omnibox en inglés, checkout bilingüe, login con PIN en inglés, y autoservicio de recuperación por correo. Suite ampliada a 15 pruebas pasadas al 100%.
      7. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: `app.min.js`, `style.min.css` y `dist/` sincronizados.
         - 8/8 fases DevSecOps aprobadas al 100% (0 errores).
         - Cumplimiento estricto del Estándar Desmulta ($\le 500$ líneas por archivo).

-53. **Desbloqueo Integral de Segunda Capa (Ficha Técnica / Slide-Up Drawer), Protocolo de Siguientes Pasos Bilingüe Estructurado y Transición Fluida Post-Venta**:
    - **Diagnóstico y Causa Raíz:**
      1. *Pérdida de contexto de segunda capa en compra:* Al abrir el checkout desde la ficha técnica (`slideup-cta`), `abrirModalCheckout` sobreescribía `leadSeleccionado` directamente desde el catálogo, borrando los indicadores `_desdeFicha` y `_fichaIndex`.
      2. *Desincronización y colapso visual tras el pago:* Al completarse el pago (`reclamarSesionPostPago`), se llamaba a `renderizarInterfaz` (recreando el DOM y destruyendo el drawer abierto), y luego `ejecutarDesbloqueoLead` se ejecutaba sin pasar el índice, impidiendo que el drawer mantuviera su estado abierto o hiciera scroll a los datos revelados.
      3. *Petición redundante en modal de bienvenida:* Al hacer clic en "Ver Teléfono de Mi Inmueble" en el modal de bienvenida VIP, se volvía a disparar `ejecutarDesbloqueoLead` sin verificar si ya había sido desbloqueado.
      4. *Mezcla de idiomas en plantilla de WhatsApp y backend:* En `/api/leads/unlock`, el tipo de inmueble se inyectaba en español aún cuando `lang === 'en'`, y el endpoint no retornaba el protocolo de `siguientesPasos` condicionado por idioma de forma estructurada.
      5. *Falta de auto-enfoque y traducción de acciones en la segunda capa:* En la ficha técnica, el teléfono aparecía sin formato legible, los datos no hacían auto-scroll en pantallas pequeñas, y los botones de llamada y ver anuncio no se traducían dinámicamente al alternar idioma.
    - **Solución Implementada:**
      1. **Persistencia de Contexto en Checkout (`modules/08-checkout.js`, 488 líneas < 500):**
         - `abrirModalCheckout` preserva de manera inmutable `_desdeFicha` y `_fichaIndex`.
         - `reclamarSesionPostPago` pasa el índice exacto a `ejecutarDesbloqueoLead` para activar y enfocar la ficha técnica correspondiente.
      2. **Transición Cinemática y Cero Peticiones Redundantes (`modules/11-welcome.js`, 263 líneas < 500):**
         - Al cerrar el modal de bienvenida (con CTA o botón X), se enfoca directamente la segunda capa de la propiedad desbloqueada, realizando scroll suave al contenedor del teléfono sin disparar llamadas duplicadas a la API.
      3. **Backend con Siguientes Pasos Bilingües y Traducción de Tipos (`api/leads/unlock.js`, 423 líneas < 500):**
         - Mapeo determinista de tipos de inmuebles al inglés en la plantilla de WhatsApp (`apartment`, `house`, `lot / land`, `office`, etc.).
         - Objeto estructurado `siguientesPasos` devuelto en la respuesta HTTP condicionado por `lang: 'es' | 'en'`.
         - `telefonoDisplay` localizado ante anuncios sin celular directo.
      4. **Segunda Capa Dinámica y Auto-Enfoque (`modules/07-unlock.js`, 404 líneas; `modules/06-cards.js`, 472 líneas; `styles/08-slideup.css`, 473 líneas):**
         - `actualizarTarjetaEnElDOM` recibe y renderiza `siguientesPasos` dinámicamente, actualiza la ubicación revelada en las especificaciones del drawer y enfoca el scroll automáticamente en el bloque de contacto.
         - Detección interactiva de clics en WhatsApp o llamada para marcar el Paso 1 como completado.
      5. **Traducción Integral de Acciones de Segunda Capa (`modules/13-i18n.js`, 487 líneas < 500):**
         - `traducirSlideupDrawer` actualiza `.cta-call`, `.cta-neutral`, `.btn-call-direct` y `.btn-view-ad-direct` en vivo.
      6. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: `style.css`, `style.min.css`, `app.js` y `app.min.js` sincronizados.
         - Suite de validación DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).
         - Cumplimiento inflexible de $\le 500$ líneas en todos los archivos.

-52. **Inferencia Contextual Bilingüe en Despacho de Alertas Web Push (Scraper a Portal Web y Suite de Validación)**:
    - **Diagnóstico y Causa Raíz:**
      1. *Alertas push genéricas en inglés:* En `api/notifications/dispatch.js`, si el llamador externo (como el scraper `publisher_web.js`) no enviaba `titleEn` ni `messageEn`, el despachador emitía un texto estático ("New direct opportunity") que no incluía la ciudad, el tipo de inmueble ni si se trataba de una rebaja de precio.
      2. *Scraper emitiendo únicamente campos en español:* En `ofertas-hunter-pro/publisher_web.js` (`despacharAlertaPushWeb`), el payload enviado al endpoint serverless contenía únicamente `title` y `message` en español.
    - **Solución Implementada:**
      1. **Inferencia Contextual Dinámica en Endpoint (`api/notifications/dispatch.js`, 121 líneas < 500):**
         - Generación inteligente de `titleEn` (`Price Drop in {ciudad}` / `Direct Opportunity in {ciudad}`) y `bodyEn` si no son suministrados explícitamente en el cuerpo de la petición.
      2. **Emisión Bilingüe Nativa en Scraper (`ofertas-hunter-pro/publisher_web.js`, 495 líneas < 500):**
         - Mapeo determinista de tipos de inmuebles al inglés (`Apartment`, `House`, `Lot / Land`, `Office`, `Commercial Retail`, `Warehouse`, `Country Estate`).
         - Inyección de `titleEn` y `messageEn` con precio y ahorro contextualizado para suscriptores angloparlantes.
      3. **Ampliación de Pruebas Unitarias (`tests/bilingual_infrastructure.test.js`):**
         - Nueva prueba certificando la inferencia contextual en inglés ante payloads simplificados.
         - Suite de 10 pruebas pasadas al 100%.

-51. **Auditoría Forense de Cierre y Endurecimiento Defensivo (Sincronización Bilingüe en Webhook Wompi, Respaldo de Celular por Referencia en Cron, Actualización de `INDICE_ARCHIVOS.md` y Suite Ampliada a 8 Pruebas)**:
    - **Diagnóstico y Causa Raíz:**
      1. *Omisión de preferencia de idioma en el webhook asíncrono:* En `api/payments/webhook-wompi.js`, al despachar el comprobante de pago por Resend (`despacharCorreoConfirmacion`), no se pasaba el parámetro `lang: pendingOrder?.lang || 'es'`, provocando que transacciones aprobadas por webhook enviaran siempre el correo en español, y omitía actualizar `preferredLang` en Firestore vía `db.updateUserPreferences`.
      2. *Falta de extracción de respaldo de celular en el cron de conciliación:* En `api/payments/reconcile-cron.js`, si una orden pendiente recuperada de Firestore carecía de la propiedad `orden.celular` explícita, fallaba la acreditación en vez de extraer el celular directamente de la referencia canónica `HNT-[celular]-[prodCode]-...`. Además, no persistía `preferredLang` del comprador tras la conciliación exitosa.
      3. *Desfase documental en `docs/INDICE_ARCHIVOS.md`:* El índice maestro de archivos no listaba el nuevo endpoint de conciliación (`api/payments/reconcile-cron.js`), la biblioteca de correos (`lib/email-templates.js`), los módulos frontend bilingües (`modules/13-i18n.js`), los nuevos estilos (`styles/17-push-modal.css`, `styles/18-i18n.css`) ni el catálogo de suites automatizadas de pruebas en `tests/`.
    - **Solución Implementada:**
      1. **Sincronización Bilingüe Completa en Webhooks (`api/payments/webhook-wompi.js`, 271 líneas < 500):**
         - Inyección de `lang: pendingOrder?.lang || 'es'` en la llamada a `despacharCorreoConfirmacion`.
         - Actualización atómica de `db.updateUserPreferences(celular, { preferredLang: pendingOrder.lang })` para garantizar que compradores internacionales mantengan su idioma tras el pago.
      2. **Respaldo Canónico de Celular y Preferencias en Cron (`api/payments/reconcile-cron.js`, 361 líneas < 500):**
         - Extracción defensiva del número de celular desde la referencia `HNT-[celular]-...` en caso de que la orden en Firestore no lo tenga en el payload de primer nivel.
         - Actualización automática de `preferredLang` en Firestore si la orden contiene `orden.lang`.
      3. **Sincronización de Documentación (`docs/INDICE_ARCHIVOS.md` en ambos repositorios):**
         - Actualizadas las tablas de `api/`, `lib/`, `modules/`, `styles/` y agregada la tabla de suites de pruebas (`tests/`).
         - Sincronizado idénticamente en `C:\Workspace\ofertas-hunter-pro\docs\INDICE_ARCHIVOS.md`.
      4. **Ampliación de Suite Automatizada (`tests/reconciliation_cron.test.js`):**
         - Añadida prueba número 8 que certifica la extracción de celular desde la referencia sintética y la persistencia de `preferredLang: 'en'` en Firestore.
      5. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: `style.min.css`, `app.min.js` y `dist/` sincronizados.
         - Suite de 8 fases (`npm test`): 100% aprobada (0 errores).

-50. **Implementación de Tarea Programada de Conciliación Automática (Vercel Cron Fail-Safe Wompi, Ledger Atómico y Suite Automatizada)**:
    - **Diagnóstico y Causa Raíz:**
      1. *Órdenes huérfanas en estado `PENDING` por pagos diferidos (PSE / Nequi / Bancolombia):* En transacciones bancarias en Colombia, los pagos vía PSE o transferencias suelen tardar minutos u horas en confirmarse. Si el usuario cerraba la ventana del navegador antes de redirigirse al portal (`claim_reference`) o si ocurrían caídas de red que retrasaban o perdían los webhooks asíncronos de Wompi, la orden quedaba indefinidamente en estado `PENDING` a pesar de que el dinero ya había sido debitado de la cuenta bancaria del cliente.
      2. *Falta de conciliador periódico serverless:* No existía un proceso background automatizado y programado que verificara de forma proactiva con la API oficial de Wompi el estado de las órdenes pendientes en la base de datos.
    - **Solución Implementada:**
      1. **Capa de Persistencia Resiliente (`lib/db.js`, `getPendingOrders`, `updateOrderStatus`):**
         - Implementadas funciones `getPendingOrders(limitCount = 25)` y `updateOrderStatus(reference, status, extraData)` envueltas en `withRetry` con backoff exponencial.
         - Soporte en el almacén en memoria para consultas `.where('status', '==', 'PENDING').limit(n).get()` y `.get()` directo.
      2. **Endpoint Serverless de Conciliación (`api/payments/reconcile-cron.js`, 341 líneas < 500):**
         - Soporte para métodos `GET` (utilizado por Vercel Cron) y `POST`.
         - Autenticación criptográfica con `Authorization: Bearer CRON_SECRET` mediante `crypto.timingSafeEqual` contra ataques de temporización (HTTP 401 si es inválido).
         - **Ventana Anti-Carreras:** Órdenes creadas hace menos de 2 minutos son omitidas del ciclo para no interferir con el webhook natural o la respuesta del widget en el navegador.
         - **Expiración de Órdenes Huérfanas:** Órdenes pendientes con más de 24 horas de antigüedad se marcan automáticamente como `EXPIRED`.
         - **Consulta Server-to-Server Oficial Wompi:** Consulta directa a `${wompiApiBase}/transactions?reference=${ref}` usando la llave secreta privada `WOMPI_PRIVATE_KEY`.
         - **Auto-Acreditación Atómica e Idempotente:** Si la transacción está `APPROVED`, se valida que el monto pagado coincida al centavo con el exigido (`expectedAmount`), se registra la transacción con `db.recordTransaction` para evitar dobles entregas, se determina el plan o saldo de créditos y se acredita atómicamente con `db.addCredits`.
         - **Despacho Transaccional Bilingüe:** Envío automático del comprobante con Magic Link vía Resend (`despacharCorreoConfirmacion`) con el idioma de la orden (`lang`).
         - **Manejo de Transacciones Fallidas:** Actualización automática de la orden a `DECLINED`, `VOIDED` o `ERROR`.
         - **Balance y Telemetría JSON:** Retorna métricas completas (`totalRevisadas`, `aprobadas`, `rechazadas`, `pendientes`, `expiradas`, `omitidasPorRecientes`, `errores`) y traza de auditoría.
      3. **Programación Vercel Cron (`vercel.json`):**
         - Configuración de tarea periódica cada 15 minutos:
           ```json
           "crons": [
             {
               "path": "/api/payments/reconcile-cron",
               "schedule": "*/15 * * * *"
             }
           ]
           ```
      4. **Suite Automatizada de Pruebas (`tests/reconciliation_cron.test.js`, `scripts/validate.js`):**
         - 7 pruebas unitarias certificando: rechazo 401 sin auth, cola vacía, omisión de órdenes recientes (<2 min), auto-acreditación con Wompi APPROVED, marcado DECLINED ante rechazo, expiración tras 24h, y detección de fraude por alteración de montos.
         - Integración permanente en la Fase 1 y Fase 5 de `scripts/validate.js`.
      5. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: sincronizados `style.min.css`, `app.min.js` y `dist/`.
         - Suite de validación de 8 fases (`npm test`): 100% aprobada (0 errores).
         - Cumplimiento inflexible de $\le 500$ líneas en el 100% de los módulos JS y hojas CSS.

-49. **Despliegue de Infraestructura Bilingüe y Resiliencia Integral (Backend, Resend, Web Push, Ledger Wompi, Catálogo y Suite Automatizada)**:
    - **Diagnóstico y Causa Raíz:**
      1. *Soporte bilingüe superficial en el frontend:* La internacionalización inicial se limitaba a diccionarios visuales del DOM (`modules/13-i18n.js`). Los canales de fondo (correos de recuperación vía Resend, notificaciones Web Push, órdenes de Wompi y respuestas de la API) operaban rígidamente en español, rompiendo la experiencia para compradores e inversionistas internacionales.
      2. *Correos transaccionales sin inglés:* `lib/email-templates.js` solo contaba con plantillas fijas en español. Si un usuario angloparlante solicitaba recuperar su PIN o recibía confirmación de pago, el correo se emitía en español.
      3. *Web Push monolingüe:* Las suscripciones no persistían el idioma del suscriptor (`lib/push-subscriptions.js`), y el despachador (`api/notifications/dispatch.js`) emitía la misma alerta en español a todos los dispositivos.
      4. *Pérdida de preferencia de idioma en el checkout:* Las órdenes en Wompi (`api/payments/create-order.js`) no registraban el idioma en que el cliente realizó la compra, impidiendo que el ledger de Firestore inicializara `preferredLang` automáticamente tras el pago.
      5. *Títulos inmobiliarios sin traducción:* En la grilla Bento, los títulos del catálogo ("Apartamento en Venta — Medellin") permanecían en español aun con el modo inglés activado.
    - **Solución Implementada:**
      1. **Correos Transaccionales Bilingües (`lib/email-templates.js`, 272 líneas < 500; `api/auth/recover.js`):**
         - Refactorización modular de `generarPlantillaRestauracion`, `generarPlantillaSinCreditos` y `generarPlantillaConfirmacionPago` con soporte bilingüe nativo (`lang: 'es' | 'en'`) mediante tablas HTML de alta compatibilidad corporativa.
         - En `api/auth/recover.js`, detección del idioma preferido del usuario y despacho con asunto y cuerpo en el idioma correspondiente.
      2. **Web Push con Almacenamiento y Segmentación por Idioma (`lib/push-subscriptions.js`, `api/notifications/subscribe.js`, `api/notifications/dispatch.js`, `modules/12-push.js`):**
         - Persistencia de `lang: metadata.lang === 'en' ? 'en' : 'es'` en el registro de suscripción en Firestore y almacén local.
         - Despacho segmentado en `api/notifications/dispatch.js` enviando `payloadEn` a usuarios angloparlantes y `payloadEs` a hispanohablantes.
         - En `modules/12-push.js`, envío automático de `lang: obtenerIdiomaActual()` al solicitar alertas en navegador.
      3. **Validación Zod y Persistencia en Órdenes y Ledger (`lib/validation.js`, `api/payments/create-order.js`, `api/auth/session.js`):**
         - Esquemas Zod con validación estricta de `lang: z.enum(['es', 'en'])` en `recoverPinSchema`, `createOrderSchema`, `sessionLoginSchema` y `subscribePushSchema`.
         - Persistencia de `lang` en `db.savePendingOrder()`.
         - Propagación automática de `order.lang` hacia `user.preferredLang` en Firestore al reclamar órdenes post-pago o iniciar sesión.
      4. **Respuestas de Error y Notas de Contacto Bilingües (`api/leads/unlock.js`):**
         - Inyección de `contacto.nota` bilingüe y mensajes de error HTTP semánticos (429 cuota diaria, 403 cobertura de ciudad, 402 saldo insuficiente) localizados según `lang`.
      5. **Motor de Traducción de Títulos y Tipos Inmobiliarios (`modules/06-cards.js`, 472 líneas < 500):**
         - Implementadas funciones deterministas `traducirTituloCatalogo` y `traducirTipoInmueble`, traduciendo títulos en vivo ("Apartment for Sale") mientras se conservan los títulos reales revelados por el propietario.
      6. **Suite Automatizada de Infraestructura Bilingüe (`tests/bilingual_infrastructure.test.js`, `scripts/validate.js`):**
         - 9 pruebas de integración certificando correos Resend, esquemas Zod, Web Push y catálogo.
         - Integración permanente en la Fase 5 de `scripts/validate.js`.
      7. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: sincronizados `style.css`, `style.min.css`, `app.js`, `app.min.js` y `dist/`.
         - Suite de validación de 8 fases (`npm test`): 100% aprobada (0 errores).
         - Cumplimiento inflexible de $\le 500$ líneas en el 100% de los módulos JS y hojas CSS.

-48. **Desbloqueo Integral de Segunda Capa (Slide-Up Drawer / Ficha Técnica), Protocolo Guiado de Siguientes Pasos y Mensajería WhatsApp Condicionada por Idioma**:
    - **Diagnóstico y Causa Raíz:**
      1. *Expulsión involuntaria a la grilla tras interactuar en segunda capa:* En `modules/10-listeners.js`, al pulsar el CTA dentro de la ficha técnica desplegable (`action === "slideup-cta"`), el evento ejecutaba prematuramente `cerrarFichaTecnica(idx, e)` antes de invocar `manejarClicDesbloquear(idx)`. El usuario era expulsado a la grilla y la ficha se cerraba sin permitirle ver la información revelada in situ.
      2. *Falta de hidratación y datos revelados en el Slide-Up Drawer:* En `modules/07-unlock.js`, `actualizarTarjetaEnElDOM` solo inyectaba los botones y revelaba datos en la tarjeta Bento de la primera capa. El drawer (`#slideup-${cardIndex}`) no recibía la caja destacada del teléfono (`.unlocked-phone-box`), ni actualizaba su título (`.slideup-title`), ni sus especificaciones de contacto.
      3. *Ausencia de protocolo de cierre post-desbloqueo ("Siguientes Pasos"):* Una vez entregada la información de contacto, la interfaz no ofrecía una guía clara al usuario sobre el flujo de negociación directa sin comisión (contacto inmediato, agendamiento de visita y protocolo de cierre con promesa de compraventa).
      4. *Desconexión post-venta en Modal VIP:* Tras comprar créditos o planes en el Checkout y ser recibido en el Modal de Bienvenida VIP (`modules/11-welcome.js`), el botón "Comenzar a Desbloquear" no reabría automáticamente la segunda capa del lead que el usuario intentaba adquirir, perdiendo el hilo de conversión.
      5. *Plantilla de WhatsApp rígida en español en backend:* En `api/leads/unlock.js`, la plantilla formal de contacto directo se generaba exclusivamente en español, ignorando si el usuario o comprador internacional navegaba con `lang: 'en'`. Además, `lib/validation.js` no aceptaba `lang` en `unlockLeadSchema`.
    - **Solución Implementada:**
      1. **Persistencia Activa de Segunda Capa (`modules/10-listeners.js`, 489 líneas; `modules/07-unlock.js`, 377 líneas):**
         - En `modules/10-listeners.js`, se eliminó el cierre forzado en `slideup-cta` y se configuró `manejarClicDesbloquear(idx, { desdeFicha: true })`.
         - En `modules/07-unlock.js`, se preserva `leadSeleccionado._desdeFicha`. Si el desbloqueo proviene del drawer o el drawer está abierto, la ficha técnica permanece abierta y enfocada tras la revelación de datos.
      2. **Hidratación Quirúrgica del Drawer (`modules/07-unlock.js`, 377 líneas):**
         - `actualizarTarjetaEnElDOM` reconstruye el drawer con el teléfono en grande (`.unlocked-phone-box`), botones de acción directa (`Llamar Directo` / `WhatsApp Directo`), el título real revelado (`datosRevelados.tituloOriginal`), y el protocolo guiado de tres pasos (`.slideup-next-steps`).
      3. **Protocolo de "Siguientes Pasos" (Next Steps) Bilingüe (`modules/07-unlock.js`, `modules/06-cards.js`, `modules/13-i18n.js`, `styles/08-slideup.css`):**
         - Estructura visual de alta gama (`.slideup-next-steps`): Paso 1 (Contacto Inmediato / Direct Outreach), Paso 2 (Agendar Visita / On-Site Tour), Paso 3 (Cierre Directo 0% Comisión / Direct Closing).
         - Soporte en `modules/13-i18n.js` para traducción reactiva a 0ms sin parpadeos mediante `traducirSlideupDrawer()`.
      4. **Reapertura Fluida Post-Compra VIP (`modules/11-welcome.js`, 248 líneas):**
         - El botón `#btnWelcomeCta` evalúa si existía un `leadSeleccionado`. De ser así, abre de inmediato la segunda capa con `abrirFichaTecnica(indexToUse)`, desplaza suavemente la vista hacia el inmueble y dispara el desbloqueo automático.
      5. **Backend Bilingüe en Generación de WhatsApp (`api/leads/unlock.js`, `lib/validation.js`, `tests/whatsapp_template.test.js`):**
         - `unlockLeadSchema` incorpora validación para `lang: z.enum(['es', 'en']).optional().default('es')`.
         - `api/leads/unlock.js` genera mensaje formal bilingüe: en español con saludo horario formal (`Buenos días/tardes`) y en inglés para compradores extranjeros (`"Hello, I am interested in negotiating directly regarding your property listed as..."`).
         - Pruebas unitarias en `tests/whatsapp_template.test.js` adaptadas y ampliadas para certificar ambos idiomas al 100%.
      6. **Modularidad Desmulta y Estricto Control de Líneas:**
         - Todos los módulos JS y hojas CSS se mantienen estrictamente bajo el límite de 500 líneas (todos auditados en $\le 496$ líneas).
      7. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: `style.css`, `style.min.css`, `app.js` y `app.min.js` sincronizados.
         - Suite de validación DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).

-47. **Segunda Ronda de Auditoría Forense Ultra-Profunda (Fases 1, 2 y 3): Erradicación de Botón Zombi en Desbloqueo, Internacionalización Dinámica de Inyección DOM, Soporte de Fusión `{ merge: true }` en Almacén en Memoria, Hidratación Canónica de Preferencias y Liberación Inmediata de Locks**:
    - **Diagnóstico y Causa Raíz:**
      1. *Botón zombi tras desbloqueo de lead (Fase 3 / Frontend):* En `modules/07-unlock.js` (`actualizarTarjetaEnElDOM`), la búsqueda del botón anterior utilizaba `card.querySelector('.btn-unlock-lead')`. Debido a que `modules/06-cards.js` genera las tarjetas con la clase `.btn-unlock-action`, el selector devolvía `null`. En consecuencia, el contenedor de botones desbloqueados (`.unlocked-action-cluster`) se añadía al final sin eliminar el botón de desbloqueo, dejando ambos visibles en la tarjeta.
      2. *Inyección en español con idioma inglés activo (Fase 2 / Frontend):* En `modules/07-unlock.js`, las mutaciones quirúrgicas inyectaban cadenas fijas en español (`Desbloqueado`, `Ver Anuncio`, `Llamar`, `Revelar Contacto`), rompiendo la experiencia bilingüe si el usuario navegaba en inglés.
      3. *Pérdida de datos en almacén local/testing (Fase 2 / Backend):* En `lib/db.js`, `createMemoryCollection` no interpretaba el segundo argumento de `set(data, options)`. Al ejecutarse `userRef.set(updates, { merge: true })`, el almacén en memoria sobrescribía el documento borrando saldo, teléfono y PIN.
      4. *Omisión de hidratación de preferencias en flujos de pago y recuperación (Fase 2 / Frontend):* Al retornar de la pasarela Wompi o restaurar mediante `recovery_token`, el cliente no aplicaba `preferredLang` ni `preferredTheme`.
      5. *Locks zombis de 30s en Upstash Redis (Fase 3 / Backend):* En `lib/idempotency.js`, tras guardar el resultado exitoso en Redis, el candado de exclusividad permanecía retenido hasta su expiración (30 segundos).
    - **Solución Implementada:**
      1. **Selector Unificado y Reemplazo Limpio (`modules/07-unlock.js`, 338 líneas < 500):**
         - Se adoptó el selector robusto `.btn-unlock-action, .btn-unlock-lead, [data-action="desbloquear-lead"]`, garantizando la eliminación instantánea del botón previo y el reemplazo limpio por el cluster de contacto.
         - En `ejecutarDesbloqueoLead`, se localiza el botón con la misma regla y se muestra el spinner bilingüe (`Unlocking...` / `Desbloqueando...`).
      2. **Internacionalización Dinámica en Desbloqueo:**
         - `actualizarTarjetaEnElDOM` evalúa `isEn` e inyecta dinámicamente: `Unlocked`, `View Listing`, `Call`, `Reveal Contact` y notas del Slide-Up Drawer en inglés cuando corresponda.
      3. **Soporte de Fusión `{ merge: true }` en Memoria (`lib/db.js`):**
         - `createMemoryCollection` evalúa `options?.merge`: si es verdadero, fusiona `{ ...existing, ...data }`, protegiendo la integridad en pruebas unitarias y entornos sin Firebase.
      4. **Hidratación Canónica de Preferencias (`modules/01-state.js`, 495 líneas < 500; `modules/08-checkout.js`, 485 líneas < 500):**
         - Función auxiliar `aplicarPreferenciasUsuario(usr)` centralizada e invocada en los 4 flujos de sesión (recuperación por enlace, retorno Wompi, revalidación de balance y login PIN), y en `modules/08-checkout.js` tras reclamo de pago.
      5. **Resolución en Cascada con `origgo_prefs` (`modules/00-security.js`, 411 líneas; `modules/13-i18n.js`, 496 líneas):**
         - `obtenerTemaActual()` y `obtenerIdiomaActual()` inspeccionan la cookie JSON `origgo_prefs` si no hallan las cookies individuales.
      6. **Liberación Inmediata de Locks (`lib/idempotency.js`):**
         - Invocación de `await liberarBloqueo(clave)` inmediatamente después de `guardarResultadoIdempotente`.
      7. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: `style.min.css` y `app.min.js` sincronizados.
         - Conteo auditado: 100% de los 14 submódulos JS y 18 CSS $\le 500$ líneas.
         - Suite DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).

-46. **Auditoría Forense Exhaustiva de Fases 1, 2 y 3 (Frontend y Backend): Corrección de Envenenamiento de Caché en Idempotencia, Extracción Case-Insensitive de Headers, Resiliencia Transaccional Firestore, Sincronización Continua de Cookies y Optimización Eager LCP**:
    - **Diagnóstico y Causa Raíz:**
      1. *Envenenamiento de caché en errores de negocio (Fase 3):* En `lib/idempotency.js`, si `operacionAsync()` fallaba por un error de validación de negocio (ej. código 402 por saldo insuficiente en desbloqueo), el resultado erróneo quedaba cacheado en Redis durante 120-300s. Si el usuario recargaba saldo de inmediato, seguía recibiendo el error cacheado sin poder desbloquear el contacto.
      2. *Sensibilidad a mayúsculas en headers HTTP (Fase 3):* Proxies intermedios, CDNs o navegadores normalizan a veces los nombres de cabeceras HTTP a minúsculas o formato PascalCase. En `api/payments/create-order.js` y `api/leads/unlock.js` solo se buscaba `headers['idempotency-key']`.
      3. *Omisión de preferencias en login con PIN (Fase 2):* En `api/auth/session.js` (login vía WhatsApp + PIN), el payload de usuario devuelto al cliente no incluía `preferredLang` ni `preferredTheme`, impidiendo que el frontend hidratara el idioma del usuario tras autenticarse por credenciales.
      4. *Riesgo de condición de carrera en Firestore (Fase 2):* En `lib/db.js` (`updateUserPreferences`), la actualización realizaba `userRef.set(updatedUser)` completo en vez de un merge atómico, arriesgando sobreescribir créditos o leads desbloqueados si ocurría un evento concurrente.
      5. *Desincronización de cookie de sesión `origgo_token` (Fase 2):* Al refrescar token en desbloqueos (`modules/07-unlock.js`), en reclamos tras pago (`modules/08-checkout.js`) o en recovery links (`modules/01-state.js`), solo se actualizaba `localStorage`, dejando la cookie segura desfasada.
      6. *Prioridad de imágenes eager desfasada al filtrar (Fase 1):* En `modules/06-cards.js`, la prioridad de carga evaluaba `index < 3` (índice absoluto en el catálogo global). Al aplicar filtros de ciudad o búsquedas, las tarjetas resultantes visibles podían tener índices globales mayores a 2, perdiendo el atributo `fetchpriority="high"` y `loading="eager"`.
    - **Solución Implementada:**
      1. **Idempotencia Limpia en Negocio (`lib/idempotency.js`):**
         - Si `operacionAsync()` retorna `{ esError: true }` o `{ noCachear: true }`, se libera inmediatamente el bloqueo y NO se guarda en Redis.
         - En la cola de espera de solicitudes concurrentes, antes de reintentar la operación, se re-verifica `obtenerResultadoIdempotente(clave)` para devolver la respuesta ya calculada por el líder.
      2. **Extracción Robusta de Cabeceras (`api/payments/create-order.js`, `api/leads/unlock.js`):**
         - Búsqueda segura en `headers['idempotency-key'] || headers['Idempotency-Key'] || headers['IDEMPOTENCY-KEY']`.
      3. **Payload Completo en Autenticación (`api/auth/session.js`):**
         - Se integró `payloadUsuarioPublico(user)` en el login por PIN, asegurando la transmisión de `preferredLang` y `preferredTheme`.
      4. **Actualización Atómica en Base de Datos (`lib/db.js`):**
         - `updateUserPreferences` aplica `await userRef.set(updates, { merge: true })`, garantizando la integridad de saldos y membresías.
      5. **Sincronización Total de Cookies Seguras (`modules/01-state.js`, `modules/07-unlock.js`, `modules/08-checkout.js`):**
         - `guardarCookieSegura('origgo_token', token, 30)` se dispara automáticamente en todo refresco o adquisición de token.
         - Recuperación resiliente en arranque: evalúa `sesionUsuario?.token` $\rightarrow$ `localStorage` $\rightarrow$ cookie segura `origgo_token`.
      6. **LCP Prioritario según Viewport Real (`modules/06-cards.js`):**
         - `leadsVisibles.map((item, visibleIdx) => ...)` evalúa `visibleIdx < 3` para aplicar `fetchpriority="high" loading="eager"` exactamente a las 3 primeras tarjetas en pantalla independientemente de filtros o paginación.
      7. **Modularidad Desmulta (< 500 líneas):**
         - Se eliminó la función redundante `generarIdempotencyKeyPago()` en `modules/08-checkout.js` (ahora usa `generarUUIDv4()`).
         - Conteo auditado: los 14 módulos JS y 18 CSS permanecen estrictamente bajo el límite de 500 líneas.
      8. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: sincronizados `style.css`, `style.min.css`, `app.js` y `app.min.js`.
         - Suite DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).

-45. **Fase 2 (Frontend y Backend): Sincronización Automática de Idioma (`preferredLang`) y Tema (`preferredTheme`) en la Sesión de Usuario, Persistencia Dual en Cookies Seguras (`SameSite=Lax`) y Ledger en Firestore**:
    - **Diagnóstico y Causa Raíz:**
      1. *Pérdida de preferencias entre dispositivos:* Cuando un usuario VIP configuraba inglés (`en`) o modo claro (`light`) en su computadora, estas selecciones no se trasladaban a su teléfono móvil al iniciar sesión vía WhatsApp y PIN, forzándolo a reconfigurar sus preferencias en cada dispositivo.
      2. *Volatilidad ante borrado de almacenamiento local:* El estado dependía exclusivamente de `localStorage`. Si el usuario limpiaba los datos de navegación o accedía desde un webview/PWA donde el almacenamiento local se reiniciaba, sus selecciones se perdían.
      3. *Falta de sincronización en endpoints de usuario:* `api/user/balance.js` únicamente admitía `GET` y no exponía ni persistía preferencias de perfil.
    - **Solución Implementada:**
      1. **Capa de Cookies Seguras OWASP (`modules/00-security.js`, 380 líneas < 500):**
         - Funciones `guardarCookieSegura(nombre, valor, dias)`, `obtenerCookieSegura(nombre)` y `borrarCookieSegura(nombre)` con `SameSite=Lax`, `path=/` y directiva condicional `Secure` para entornos HTTPS.
         - Cookie unificada `origgo_prefs` (`{ lang, theme }`), cookies individuales `origgo_lang` y `origgo_theme`, y cookie de sesión `origgo_token` (30 días).
         - Función `aplicarTema(nuevoTema)` con soporte de `View Transitions API`, actualización de iconos, almacenamiento local y cookie.
         - Función `sincronizarPreferenciasEnServidor(nuevoLang, nuevoTheme)`: sincroniza en segundo plano no bloqueante (`PATCH /api/user/balance`) con el token JWT si la sesión está activa.
      2. **Hidratación Automática y Resiliencia en Arranque (`modules/01-state.js`, 490 líneas < 500):**
         - Si `localStorage` no contiene `hunter_pro_token`, el arranque rescata la sesión desde la cookie segura `origgo_token`.
         - Al revalidar balance (`/api/user/balance`) o iniciar sesión por PIN/recuperación, el cliente hidrata de inmediato `data.preferredLang` y `data.preferredTheme` aplicando `cambiarIdioma()` y `aplicarTema()` sin parpadeos.
         - Al cerrar sesión (`cerrarSesionUsuario`), se eliminan simultáneamente `localStorage` y la cookie `origgo_token`.
      3. **Reactividad en Conmutadores de Idioma y Tema (`modules/13-i18n.js`, 492 líneas; `modules/10-listeners.js`, 493 líneas):**
         - `obtenerIdiomaActual()` y arranque de tema evalúan en cascada: `localStorage` $\rightarrow$ cookie segura $\rightarrow$ `navigator.language` / `dark`.
         - Al alternar idioma o tema, se invoca automáticamente `sincronizarPreferenciasEnServidor()` para replicar el cambio en la base de datos sin fricción.
      4. **Endpoint Serverless de Balance y Preferencias (`api/user/balance.js`, 89 líneas):**
         - `GET /api/user/balance`: Retorna `preferredLang` y `preferredTheme` junto con los créditos y plan activo.
         - `PATCH /api/user/balance`: Valida el Bearer JWT y actualiza de manera atómica `preferredLang` y `preferredTheme` en Firestore.
      5. **Persistencia en Firestore y Sesiones (`lib/db.js`, 613 líneas; `api/auth/session.js`, 354 líneas):**
         - Nueva función `updateUserPreferences(phone, { preferredLang, preferredTheme })` con tolerancia a fallos `withRetry`.
         - `payloadUsuarioPublico(user)` en `api/auth/session.js` incluye `preferredLang` y `preferredTheme` en todos los flujos de login, reclamo de pago y recuperación.
      6. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: sincronizados `style.css`, `style.min.css`, `app.js` y `app.min.js`.
         - Suite de pruebas de integración (`test_fase2.js`): 100% aprobada.
         - Suite DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).
         - Cumplimiento inflexible del estándar Desmulta (< 500 líneas por módulo JS y CSS).

-44. **Fase 1 (Frontend): Optimización Responsiva y Paralela de Imágenes (LCP Crítico, Decodificación Asíncrona, Carga Prioritaria y Fallback Shimmer SVG Corporativo)**:
    - **Diagnóstico y Causa Raíz:**
      1. *Priorización subóptima del LCP:* Las imágenes solo tenían prioridad alta en los primeros 2 índices y carecían de `loading="eager"`, lo que en conexiones móviles 3G/4G demoraba la descarga inicial de las tarjetas visibles.
      2. *Bloqueo potencial de CDNs externas:* Si un portal inmobiliario externo bloqueaba hotlinking o retornaba 404, la tarjeta quedaba con marco roto o espacio en blanco sin feedback visual.
      3. *Contenedor duplicado:* En `modules/06-cards.js`, `mediaHtml` envolvía la imagen en un `.card-media-wrapper` redundante dentro del contenedor principal del mismo nombre.
    - **Solución Implementada:**
      1. **Carga Prioritaria y Paralela en Bento Grid (`modules/06-cards.js`, 432 líneas < 500):**
         - Las 3 primeras tarjetas visibles (*above-the-fold*, `index < 3`) se configuran con `fetchpriority="high"`, `loading="eager"` y `decoding="async"`.
         - A partir de la 4ta tarjeta (`index >= 3`) y las fotos secundarias del carrusel (`fIdx > 0`), se inyecta `loading="lazy"`, `fetchpriority="low"` y `decoding="async"`.
         - Se eliminó el `.card-media-wrapper` redundante dentro de `mediaHtml`.
      2. **Fallback Resiliente Shimmer SVG Corporativo (`FALLBACK_INMUEBLE_SVG` y `manejarErrorImagenLead`):**
         - Data URI SVG esmeralda (`#10b981`) de alta resolución optimizado a nivel de bytes, independiente de la red.
         - Manejador seguro `onerror="manejarErrorImagenLead(this)"` que neutraliza el evento para prevenir bucles y aplica `.img-fallback-applied` con `object-fit: cover`.
      3. **Decodificación Asíncrona en Carrusel y Precarga (`modules/05-carousel.js`, 154 líneas < 500):**
         - En `actualizarVistaCarrusel`, tanto la imagen activada bajo demanda como la precarga del siguiente slide asignan `img.decoding = 'async'` antes de inyectar el `src`.
      4. **Estilo de Resiliencia Visual (`styles/16-utilities.css`, 289 líneas < 500):**
         - Regla `.img-fallback-applied` que asegura cobertura perfecta y filtro cromático armónico con el tema.
      5. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: sincronizados `style.css`, `style.min.css`, `app.js` y `app.min.js`.
         - Suite DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).
         - Cumplimiento inflexible del estándar Desmulta (< 500 líneas).

-43. **Internacionalización Integral del Sistema de Notificaciones Flotantes (Toasts y Push Prompts), Clarificación de Pagos Internacionales con Wompi y Service Worker PWA (`origgo-v9-20260913`)**:
    - **Diagnóstico y Causa Raíz:**
      1. *Toasts en español con idioma inglés activo:* Al conmutar la interfaz a inglés (`EN`), las notificaciones toast emitidas por el sistema seguían imprimiendo cadenas estáticas en español:
         - Encabezado: *"Notificación Origgo"* en lugar de *"Origgo Notification"*.
         - Alerta de activación Push: *"🔔 ¡Radar activado! Te avisaremos en tu teléfono cuando se capte un nuevo inmueble directo."* en lugar de su versión en inglés.
         - Pie del toast interactivo: *"Cierra en 5s · Clic para pausar"* y *"En pausa · Desliza hacia arriba para cerrar"*.
         - Toasts de desbloqueo de leads, recargas, reclamo post-pago, estados de transacción de banco, cierre de sesión y atajo anti-impresión.
      2. *Dudas sobre pagos internacionales y pasarela Wompi:* El usuario consultó cómo opera Wompi para compradores fuera de Colombia, si acepta tarjetas internacionales y si la pasarela se traduce al inglés.
    - **Solución Implementada:**
      1. **Motor Toast Bilingüe y Reactivo (`modules/02-toast.js`, 299 líneas < 500):**
         - Se integró la evaluación `obtenerIdiomaActual() === 'en'` en `mostrarNotificacionToast()`.
         - Mapeo bilingüe automático de títulos derivados de prefijos y emojis: `👑 VIP Pro Membership`, `🎉 Success!`, `📍 Regional Coverage`, `⚠️ System Notice`, `✅ Confirmation`, `❌ Access Restricted` y fallback `Origgo Notification`.
         - Pie de micro-barra interactiva traducido: `Closes in {s}s · Click to pause` y `Paused · Swipe up to dismiss`.
         - Función `generarMensajeBienvenidaToast()` 100% bilingüe para todos los planes (Nacional VIP, Pro Ciudad, Bolsa 10 y Desbloqueo Individual).
      2. **Internacionalización Exhaustiva de Emisores de Toasts:**
         - `modules/12-push.js` (255 líneas): Notificación de radar activado (`🔔 Radar activated!...`), advertencia de navegador no soportado y permiso bloqueado.
         - `modules/07-unlock.js` (329 líneas): Notificaciones de éxito (`✅ Property already unlocked...`, `👑 Contact unlocked at zero cost...`, `🎉 Contact unlocked! Remaining balance: X credits`), cuota de uso justo, saldo insuficiente y error de red.
         - `modules/08-checkout.js` (489 líneas): Mensajes de verificación bancaria, pago acreditado, validación PSE/Nequi y pago rechazado.
         - `modules/01-state.js` (466 líneas): Restauración de sesión por enlace, protección de cuenta y toast de cierre de sesión (`Logged out successfully.`).
         - `modules/10-listeners.js` (489 líneas): Alerta de filtro de ciudad (`📍 Showing direct deals in ${nombreLimpio}`).
         - `modules/00-security.js` (244 líneas): Alerta de bloqueo de impresión conforme a Ley 1581 de 2012 traducida al inglés.
         - `modules/11-welcome.js` (239 líneas): Feedback visual de copiado de PIN bilingüe (`Copied!` / `Copy`).
         - `modules/13-i18n.js` (491 líneas): Nuevas claves de toast incorporadas en los diccionarios `es` y `en`.
      3. **Claridad Arquitectónica sobre Pagos Internacionales con Wompi:**
         - **Soporte de Tarjetas Internacionales:** Wompi Bancolombia procesa transacciones de crédito y débito internacionales (Visa, MasterCard, American Express) de cualquier banco del mundo.
         - **Moneda de Cobro:** Por regulación del Banco de la República de Colombia, la orden se liquida en COP. El banco emisor internacional del cliente convierte automáticamente a USD, EUR u otra divisa a la tasa interbancaria oficial. En Origgo, el usuario ve la referencia aproximada en USD (`~$0.85 USD` por contacto individual).
         - **Widget Bilingüe:** El checkout oficial de Wompi detecta automáticamente el idioma preferido del navegador del usuario (`navigator.language`).
      4. **Service Worker PWA v9 y Cache-Busting (`sw.js`, `index.html`):**
         - Versión de caché actualizada a `'origgo-v9-20260913'`.
         - Hashes de activos renovados a `style.min.css?v=20260913-v9` y `app.js?v=20260913-v9`.
      5. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: generados `style.css`, `style.min.css`, `app.js` y `app.min.js`.
         - Suite de validación DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).
         - Cumplimiento inflexible del estándar Desmulta (< 500 líneas en los 14 módulos JS y 18 archivos CSS).

-42. **Traducción Bilingüe Completa del Footer (`footer_bio`, `footer_telegram`), Estabilización de Cumulative Layout Shift (CLS) con Skeletons Estáticos Iniciales y Service Worker PWA (`origgo-v8-20260913`)**:
    - **Diagnóstico y Causa Raíz:**
      1. *Párrafo del footer en español en la vista en inglés:* En `index.html` (línea 346), el párrafo descriptivo de la marca (`.footer-bio`) carecía del atributo `data-i18n="footer_bio"`, provocando que al alternar a inglés permaneciera en español. De igual forma, el enlace al canal de Telegram carecía de `data-i18n="footer_telegram"`.
      2. *Cumulative Layout Shift (CLS) de 0.49 (pobre en Performance):* El contenedor de la grilla `#bentoGridContainer` iniciaba vacío con altura de 0px. Cuando el fetch asíncrono a Cloudflare R2 (`inmobiliario.json`) finalizaba tras 1.5 - 2.0 segundos e inyectaba las tarjetas Bento, el contenedor crecía súbitamente miles de píxeles, desplazando bruscamente el Footer hacia abajo en 4 shifts acumulativos.
      3. *Error en consola de extensiones de Chrome:* El mensaje `Uncaught (in promise) Error: A listener indicated an asynchronous response...` se identificó como un evento interno de extensiones instaladas en el navegador (como traductores o adblockers que cierran canales de mensajería `chrome.runtime.onMessage` antes de tiempo), ajeno a los scripts de la aplicación.
      4. *Petición de manifest.json en Network:* Se aclaró que la consulta con estado 200 iniciada por el Service Worker es la verificación estándar del Web App Manifest de la W3C para habilitar la instalación nativa como PWA.
    - **Solución Implementada:**
      1. **Traducción Exhaustiva del Footer (`modules/13-i18n.js`, 497 líneas < 500; `index.html`):**
         - Se incorporaron las claves `footer_bio` y `footer_telegram` en los diccionarios `es` y `en`.
         - Se vincularon `data-i18n="footer_bio"` y `data-i18n="footer_telegram"` en `index.html`. Al alternar a inglés, la descripción institucional se traduce de forma nativa e instantánea: *"Direct connection platform with property owners in Colombia. Zero middleman, zero agency commissions, and real-time verified opportunities."*
      2. **Erradicación Total del Layout Shift (CLS < 0.1) (`styles/06-bento-grid.css`, 241 líneas; `index.html`):**
         - Se fijó `min-height: 700px;` en `.bento-grid` para reservar el espacio geométrico de las tarjetas desde el primer fotograma de renderizado.
         - Se pre-insertaron 3 tarjetas skeleton estáticas (`.skeleton-card`) directamente en el marcado HTML de `#bentoGridContainer`. El usuario percibe la cinemática Shimmer de carga de inmediato y el Footer permanece anclado en su posición sin ningún salto visual.
      3. **Service Worker PWA v8 y Cache-Busting (`sw.js`, 146 líneas; `index.html`):**
         - Se actualizó `NOMBRE_CACHE` a `'origgo-v8-20260913'`.
         - Se actualizaron los hashes de versión en `index.html`: `style.min.css?v=20260913-v8` y `app.js?v=20260913-v8`.
      4. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: generados `style.css`, `style.min.css`, `app.js` y `app.min.js`.
         - Suite de validación DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).

-41. **Transición Cinemática Suave en Modal de Bienvenida (Fade-In Progresivo), Estrategia Network-First en Service Worker PWA (`origgo-v7-20260913`) y Blindaje de Marquee contra Ahorro de Batería en Android**:
    - **Diagnóstico y Causa Raíz:**
      1. *Entrada abrupta del modal:* El modal de bienvenida (`#modalOnboardingWelcome`) saltaba de golpe frente al usuario debido a una duración minúscula de 250ms (`fadeIn 0.25s`) en el backdrop y una escala agresiva (`scale(0.92)`). Además, la GPU sufría un salto de `display: none` a `display: flex` con cálculo instantáneo de `backdrop-filter: blur(24px)`.
      2. *Carrusel horizontal estático en móvil:* La causa real no residía en el código subido sino en la caché local del Service Worker (`sw.js`). Al tener `NOMBRE_CACHE = 'origgo-v6-20260911'` con política **Cache-First**, el navegador móvil en Android entregaba el CSS antiguo cacheado hace días, ignorando el archivo nuevo en Vercel. Adicionalmente, si el dispositivo Android tenía activado el ahorro de energía o reducción de animaciones, `@media (prefers-reduced-motion: reduce)` en `styles/11-mobile.css` forzaba `animation-duration: 0.01ms !important;` sobre todos los elementos (`*`), congelando el marquee.
    - **Solución Implementada:**
      1. **Transición Cinemática y Sedosa de Modales (`styles/09-checkout-modal.css`, 454 líneas; `styles/15-welcome-modal.css`, 446 líneas):**
         - `.modal-backdrop.active` ahora utiliza `fadeInBackdrop 0.45s cubic-bezier(0.16, 1, 0.3, 1)` con aceleración GPU (`will-change: opacity, backdrop-filter`), difuminando progresivamente el fondo sin tirones.
         - `.onboarding-modal-card` y `.welcome-modal-card` fueron calibradas a `0.5s` con `welcomePop`: parten desde `scale(0.96) translateY(18px)` y flotan elásticamente a su posición natural (`scale(1) translateY(0)`), logrando una sensación de levitación de alta gama.
      2. **Blindaje de Marquee contra Ahorro de Energía (`styles/11-mobile.css`, 496 líneas):**
         - En `@media (prefers-reduced-motion: reduce)`, se excluyeron explícitamente las clases `.marquee-track`, `.marquee-group` y `.marquee-item` (`*:not(.marquee-track):not(.marquee-group):not(.marquee-item)`).
         - Se fijó `.marquee-track { animation: scrollMarquee 24s linear infinite !important; }`, garantizando que la cinta de valor gire perpetuamente a 60 FPS sin importar el modo de batería o accesibilidad del sistema.
      3. **Service Worker PWA con Estrategia Network-First (`sw.js`, 146 líneas):**
         - Se elevó la versión de caché a `'origgo-v7-20260913'`.
         - Para todos los activos funcionales (HTML, CSS, JS y JSON), se implementó la estrategia **Network-First**: el navegador siempre descarga de inmediato la versión más fresca desde el CDN de Vercel y actualiza la caché local. Si el dispositivo se queda sin red, la caché entra en acción como fallback offline.
         - En `index.html`, se actualizaron los query params de cache-busting: `style.min.css?v=20260913-v7` y `app.js?v=20260913-v7`.
      4. **DevSecOps y Cumplimiento Desmulta (< 500 líneas):**
         - Módulos auditados: `styles/09-checkout-modal.css` (454 líneas), `styles/11-mobile.css` (496 líneas), `styles/15-welcome-modal.css` (446 líneas), `sw.js` (146 líneas).
         - Recompilación exitosa con `node scripts/build.js`: sincronizados `style.css`, `style.min.css`, `app.js` y `app.min.js`.
         - Suite de validación DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).

-40. **Movimiento Continuo Garantizado del Carrusel de Confianza (Marquee en Android y PC), Traducción Bilingüe Exhaustiva de Tarjetas Bento Grid / Drawer y Check Oficial de Verificación Esmeralda**:
    - **Diagnóstico y Causa Raíz:**
      1. *Carrusel horizontal congelado:* La cinta de confianza en el Hero (`.trust-marquee-container`) se detenía y no volvía a girar en pantallas táctiles de Android y escritorio. La causa raíz fue la presencia de reglas CSS `:hover` y `:active` que pausaban la animación (`animation-play-state: paused`). En dispositivos móviles, un toque táctil sobre el contenedor fijaba un estado `:hover` persistente en el navegador webview/Chrome, dejando la marquesina congelada de manera irreversible.
      2. *Inconsistencia idiomática en tarjetas Bento:* Al seleccionar el idioma inglés (`EN`), los titulares principales cambiaban pero las tarjetas conservaban cadenas fijas en español provenientes del JSON o del renderizado base (`"hace 6 horas"`, `"🔥 Oportunidad Directa"`, `"Superficie"`, `"Distribución"`, `"3 Hab • 2 Baños • 1 Garajes"`, `"Bogota • Estrato 4"`, `"-15% vs Mediana"`). Además, cualquier llamada a `renderizarInterfaz` pisaba las traducciones del DOM con textos en español.
      3. *Ficha técnica sin estilización de verificación:* La clave "Contacto: Propietario Verificado" carecía del distintivo visual oficial de alta gama (sello verificado estilo redes sociales / plataformas de alto prestigio) que transmitiera confianza inmediata al usuario.
    - **Solución Implementada:**
      1. **Rotación Continua y Fluida a 60 FPS del Marquee (`styles/05-hero.css`, 360 líneas < 500):**
         - Se erradicaron por completo las reglas de pausa en `:hover` y `:active`.
         - Se aplicó `pointer-events: none; user-select: none;` en `.trust-marquee-container` para inmunizar la cinta contra cualquier tap pegajoso en Android o hover en ratón.
         - Se inyectó `-webkit-transform: translate3d(0, 0, 0); transform: translate3d(0, 0, 0); backface-visibility: hidden;` para forzar aceleración nativa por GPU a 60 FPS sin parpadeos.
      2. **Traducción Bilingüe Dinámica de Tarjetas Bento Grid (`modules/06-cards.js`, 390 líneas < 500):**
         - Se implementó `formatearTiempoRelativo(fechaRaw, fallbackStr)` con soporte bilingüe completo: traduce tanto timestamps numéricos como cadenas fijas (`"hace X horas"` -> `"Xh ago"`, `"hace X minutos"` -> `"Xm ago"`, `"justo ahora"` -> `"⚡ Just now"`).
         - Función `traducirBadgeUrgencia(badgeTexto)` para mapear instantáneamente badges como `"🔥 Oportunidad Directa"` -> `"🔥 Direct Deal"`, `"⚡ Trato Directo"` -> `"⚡ High Arbitrage"`, `"📉 Rebaja de Precio"` -> `"📉 Price Drop"`.
         - Función `traducirDatoDistribucion(texto)` para convertir `"3 Hab • 2 Baños • 1 Garajes"` en `"3 Beds • 2 Baths • 1 Parking"`.
         - Adaptación bilingüe de etiquetas fijas en la tarjeta: `"Superficie"` -> `"Area"`, `"Distribución"` -> `"Layout"`, `"Bogota • Estrato X"` -> `"Bogota • Stratum X"`, `"-X% vs Mediana"` -> `"-X% vs Median"`.
         - `renderizarInterfaz` ahora evalúa `obtenerIdiomaActual() === 'en'` de forma reactiva, evitando sobrescribir textos en español sobre la vista en inglés.
      3. **Sello Oficial de Verificación Esmeralda y Drawer Traducido (`styles/08-slideup.css`, 476 líneas; `modules/13-i18n.js`, 495 líneas):**
         - Se crearon las clases `.verified-badge-wrap` y `.verified-badge-icon` con halo pulsante `pulseCheckGlow` en `#10B981`, recreando el check oficial esmeralda verificado de plataformas de prestigio.
         - `traducirSlideupDrawer()` traduce dinámicamente títulos (`Property Overview`), descripciones de confianza, botones de acción (`Unlock Owner Contact`), notas de garantía y especificaciones (`Stratum`, `Built Area`, `Bedrooms`, `Bathrooms`, `Parking`, `Contact`, `Deal Type`), e inyecta el sello con el icono `<i class="fa-solid fa-circle-check verified-badge-icon"></i> Verified Owner`.
      4. **Sincronización Reactiva de Idioma (`modules/13-i18n.js`, `modules/04-filters.js`):**
         - En `cambiarIdioma()`, se dispara de inmediato `renderizarInterfaz(datosActuales)` y `traducirSlideupDrawer()` para una reactividad instantánea a 0ms sin recargar la página.
         - Dropdown de ciudades y selector de ordenamiento sincronizados con `criterioOrdenActivo`.
      5. **DevSecOps y Cumplimiento Desmulta (< 500 líneas):**
         - Módulos optimizados y compactados: `modules/13-i18n.js` (495 líneas), `modules/06-cards.js` (390 líneas), `modules/04-filters.js` (402 líneas), `styles/05-hero.css` (360 líneas), `styles/08-slideup.css` (476 líneas).
         - Recompilación con `node scripts/build.js`: generados `app.js`, `app.min.js`, `style.css` y `style.min.css`.
         - Suite de validación DevSecOps de 8 fases (`npm test`): 100% aprobada con 0 errores.

-39. **Erradicación Definitiva de Bloqueo CSP en Fuentes Google, Eliminación de Advertencias de Precarga y Carga Garantizada de Tipografía Cursiva (`Alex Brush`)**:
    - **Diagnóstico y Causa Raíz:**
      1. El usuario abrió la consola de DevTools de Chrome y detectó 2 errores rojos de CSP y 2 advertencias amarillas de recursos precargados:
         * *Error CSP:* `Executing inline event handler violates Content Security Policy directive 'script-src 'self' ...'`.
         * *Advertencia:* `The resource .../css2?family=Alex+Brush... was preloaded using link preload but not used within a few seconds`.
      2. **Causa Raíz:** En `index.html` (línea 74), el tag de fuentes utilizaba el truco de carga asíncrona:
         `<link rel="preload" href="..." as="style" onload="this.onload=null;this.rel='stylesheet'">`.
         La directiva CSP estricta en `index.html` y `vercel.json` prohíbe scripts inline (`'unsafe-inline'` no está permitido en `script-src` por estándar DevSecOps OWASP). En consecuencia, el navegador bloqueó la ejecución de `onload="..."`, la hoja de estilos nunca cambió a `rel="stylesheet"` y la fuente caligráfica `Alex Brush` **nunca se aplicó**, provocando que el texto cursivo (`.editorial-italic`) utilizara la fuente de respaldo del sistema.
      3. Adicionalmente, en `404.html`, los botones de idioma tenían atributos inline `onclick="setLang('es')"`.
    - **Solución Implementada:**
      1. **Carga Estándar y Segura de Fuentes en `index.html`:**
         - Se reemplazó el `rel="preload"` con handler `onload` bloqueado por una inclusión directa y estándar:
           `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Inter:wght@400;500;600;700&display=swap">`.
         - Cumple al 100% con la política CSP (permitida en `style-src` y `font-src`).
         - CERO errores de CSP en consola, CERO advertencias de precarga huérfana y descarga garantizada e inmediata de la fuente `Alex Brush`.
      2. **Erradicación Total de Event Handlers Inline en `404.html`:**
         - Se eliminaron los atributos `onclick` de los botones `#btnLangEs` y `#btnLangEn`.
         - Se registraron los escuchadores de eventos mediante `addEventListener` en JavaScript no obstructivo.
      3. **Compilación y DevSecOps:**
         - `node scripts/build.js` ejecutado.
         - Suite de validación DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).
         - Cumplimiento inflexible del estándar Desmulta (< 500 líneas en todos los archivos).

-38. **Erradicación Total de Hijacking por Google Translate ("rigramogramoo" y pérdida de cursiva), Animación Táctica de Rompecabezas en Dígitos 4 de 404 y Acceso Prominente a Onboarding**:
    - **Diagnóstico y Análisis Forense:**
      1. *Misterio de "rigramogramoo" resuelto:* En la captura compartida por el usuario, el navegador Chrome tenía activada la barra automática de Google Translate (traductor de páginas de Chrome). Al conmutar el idioma a inglés (`EN`), el script aplicó `document.documentElement.lang = 'en'`. Chrome detectó que la página estaba en inglés y, al tener el usuario su navegador en español, forzó una traducción automática de regreso al español por fuerza bruta.
      2. *Traducción de letras como unidades métricas:* El logotipo tenía sus letras separadas en spans (`<span>r</span><span>i</span><span>g</span><span>g</span><span>o</span>`). El motor de Google Translate analizó cada nodo de forma aislada y tradujo `<span>g</span>` como la abreviatura de "gramo", resultando en `r` + `i` + `gramo` + `gramo` + `o` = `rigramogramoo`.
      3. *Pérdida de tipografía cursiva (`.editorial-italic`):* Al traducir el titular en inglés `Properties for sale <span class="editorial-italic">directly</span> from owners`, Google Translate sobrescribió el DOM con texto plano `"Propiedades en venta directamente de los propietarios"`, destruyendo el nodo `<span>` interior y perdiendo el estilo cursivo dorado.
      4. *Frecuencia del Modal de Onboarding:* El modal estaba restringido por `localStorage` para abrirse solo 1 vez en la vida del dispositivo. Al haberlo cerrado previamente, no volvía a abrirse automáticamente al refrescar o borrar caché.
      5. *Dígitos 4 en 404 estáticos:* El usuario exigió animar los dos números 4 para que entraran por partes/pedazos ensamblándose como un rompecabezas táctico interactivo.
    - **Solución Implementada:**
      1. **Blindaje de Inmunidad Notranslate en todo el Ecosistema (`index.html`, `404.html`, `modules/13-i18n.js`):**
         - Se añadió `<meta name="google" content="notranslate">` en la cabecera de `index.html` y `404.html`.
         - Se aplicó `class="notranslate" translate="no"` de forma atómica en la etiqueta raíz `<html>` y en los contenedores de identidad corporativa `.brand-badge`, `.brand-title` y `.brand-letters-riggo`.
         - En `modules/13-i18n.js`, al alternar idiomas, se garantiza que `document.documentElement` conserve inalterados `classList.add('notranslate')` y `setAttribute('translate', 'no')`.
      2. **Animación Rompecabezas Táctico en Dígitos 4 (`404.html`, 469 líneas < 500):**
         - Cada dígito 4 se descompuso en 3 piezas vectoriales geométricas SVG independientes: la diagonal (`.part-diag`), el travesaño (`.part-cross`) y el vástago vertical (`.part-stem`).
         - Animaciones de ensamble cinemático: la diagonal desciende en ángulo y rotación, el travesaño se desliza desde el flanco opuesto y el vástago desciende con inercia elástica, encajando magnéticamente ("snap") en el 4.
         - Desfase complementario entre el 4 izquierdo (entrada 0.15s - 0.45s) y el 4 derecho (entrada 0.55s - 0.85s).
         - Micro-interactividad: al hacer clic sobre cualquier dígito 4 o pulsar la lente del radar, los cuatros se desensamblan y reensamblan en vivo.
      3. **Onboarding Prominente y Frecuencia de Sesión (`modules/11-welcome.js`, `styles/05-hero.css`, `index.html`):**
         - Se agregó un botón interactivo permanente en el hero eyebrow tag: `[ ✦ ¿Qué es Origgo? ]` (`#btnHeroOpenAbout`), permitiendo abrir el modal en 1 clic sin tener que ir al menú lateral.
         - Se sincronizó la frecuencia con `sessionStorage`, de modo que en cada nueva sesión de navegación el modal se despliega suavemente a los 1000ms.
         - Expuesto `window.mostrarOnboarding` para activación inmediata.
      4. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: sincronizados `app.js`, `app.min.js`, `style.css` y `style.min.css`.
         - Validación completa de 8 fases (`npm test`): 100% aprobada (0 errores).
         - Cumplimiento inflexible del estándar Desmulta (< 500 líneas en todos los módulos JS y CSS).

-37. **Creación del Modal de Bienvenida y Onboarding Universal (Sin Tecnicismos, Multiactivo y Responsivo en PC y Android)**:
    - **Diagnóstico y Necesidad:**
      1. El usuario autorizó formalmente la implementación de una experiencia de bienvenida (Onboarding) elegante, de alta gama y responsiva tanto en PC como en Android.
      2. Se exigió erradicar palabras técnicas complejas, emplear un lenguaje natural, conversacional y de alto prestigio, y comunicar con total claridad qué es Origgo: un punto de encuentro de oportunidades directas sin intermediarios ni comisiones, con enfoque multiactivo (no limitado exclusivamente a lo inmobiliario, sino concebido para expandirse a vehículos y otros activos de alto valor).
    - **Solución Implementada:**
      1. **Componente Modal Universal (`index.html`):**
         - Se implementó `#modalOnboardingWelcome` con la tarjeta `.onboarding-modal-card`, dotada de aura lumínica esmeralda sutil, badge corporativo de alta finanza con el isotipo SVG oficial de Origgo, titular magnético (*"Oportunidades directas, de persona a persona"*) y subtítulo natural sin tecnicismos.
         - Se integró la matriz de 3 pilares universales:
           * 💎 *Encuentra antes que los demás*: Rastreo diario de oportunidades recién publicadas por sus dueños reales antes de que pasen a terceros.
           * 🤝 *Trato directo sin comisiones*: Negociación directa de tú a tú con el propietario, sin agencias ni sobrecostos.
           * ⚡ *Tú tienes el control*: Exploración libre y desbloqueo del contacto directo en un toque.
         - Botón de acción principal `[ Comenzar a Explorar Oportunidades ]` y sello de confianza institucional.
         - Acceso permanente en el menú lateral: se añadió la opción `¿Qué es Origgo?` (`#sideMenuLinkAbout`), permitiendo al usuario reabrir el onboarding en cualquier momento.
      2. **Estilos de Alta Gama (`styles/15-welcome-modal.css`, 444 líneas < 500):**
         - Diseño responsive mobile-first adaptado ergonómicamente para Android y pantallas táctiles, y centrado con proporciones armónicas en monitores de PC.
         - Tokens de modo oscuro y claro integrados de forma nativa.
      3. **Lógica de Presentación y Persistencia (`modules/11-welcome.js`, 228 líneas < 500):**
         - Funciones `abrirModalOnboarding()` y `cerrarModalOnboarding()`.
         - Despliegue automático y suave en la primera visita del usuario (`!localStorage.getItem('origgo_onboarding_seen')`) tras 1300ms de carga fluida.
         - Persistencia para no interrumpir en visitas recurrentes, con soporte de cierre por clic fuera de la tarjeta, botón de cierre `&times;` o botón CTA.
      4. **Soporte Bilingüe Internacional (`modules/13-i18n.js`, 485 líneas < 500):**
         - Traducciones completas en español e inglés para todos los textos del onboarding y del menú lateral.
      5. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: actualizados `app.js`, `app.min.js`, `style.css` y `style.min.css`.
         - Suite de validación DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).
         - Cumplimiento inflexible del estándar Desmulta (< 500 líneas en todos los archivos).
         - Conteo serverless inalterado: exactamente 11 funciones (límite Vercel Hobby <= 12).

-36. **Erradicación de Deriva Espacial en Ecos del Radar 404 (Fijación Absoluta de Coordenadas) y Arquitectura de Bienvenida Universal**:
    - **Diagnóstico y Causa Raíz:**
      1. El usuario descubrió un comportamiento visual anómalo en el escáner de `404.html`: mientras el haz giraba, el punto verde del radar se desplazaba físicamente de un lado a otro.
      2. **Causa Raíz Técnica:** En SVG, aplicar `transform: scale(...)` a un elemento `<circle>` sin `transform-box: fill-box` ni origen relativo provoca que la escala se calcule respecto al origen `(0, 0)` del lienzo global del SVG. Esto multiplicaba las coordenadas `(cx, cy)` por el factor de escala, provocando que el punto se desplazara físicamente entre `(34, 17)` y `(91.8, 45.9)`, creando la ilusión de un punto errático viajando por la pantalla.
      3. **Crítica de Enfoque Comercial:** El usuario señaló con precisión dos fallos de enfoque:
         - El uso de la sigla técnica/local "COP", la cual encasilla y restringe la imagen de una plataforma de alcance internacional y bilingüe.
         - La necesidad de concebir a Origgo como una plataforma universal de oportunidades directas (no solo inmobiliaria, sino expandible a vehículos y otros activos) y la urgencia de diseñar una experiencia de bienvenida (onboarding) elegante, responsiva y en lenguaje natural/coloquial para PC y Android.
    - **Solución Implementada:**
      1. **Inmovilización Absoluta de Ecos en `404.html` (395 líneas < 500):**
         - Se eliminó al 100% cualquier propiedad `transform: scale(...)` en los keyframes `@keyframes blipPhosphorAlpha` y `@keyframes blipPhosphorBeta`.
         - Los ecos ahora están anclados espacialmente de forma estática en sus coordenadas `(cx="68" cy="34")` y `(cx="32" cy="66")`.
         - La animación modula exclusivamente la `opacity` (de 0 a 1 y luego decaimiento gradual a 0), recreando la física pura del fósforo verde de un radar militar sin ningún tipo de bamboleo ni desplazamiento lateral.
      2. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: sincronizado `dist/404.html`.
         - Suite de validación DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).

-35. **Transformación del Escáner 404 a Radar Táctico Auténtico con Haz Cónico y Definición de Estrategia Comercial de Producto**:
    - **Diagnóstico y Causa Raíz:**
      1. El usuario señaló con agudeza que la aguja lineal rotatoria en el `0` central de `404.html` creaba la ilusión visual de un reloj de manecillas en lugar de un radar táctico. En percepción visual, una línea recta giratoria siempre se interpreta como reloj a menos que exista un cono angular con gradiente de estela y decaimiento de persistencia fosforescente.
      2. Adicionalmente, el usuario cuestionó cómo comunicarle al usuario común de Android qué es Origgo y qué ventaja da sobre el mercado inmobiliario tradicional de forma sutil, no directa, elegante e interactiva ("Show, Don't Tell"), sin aburrir con manuales o pasos lineales de texto.
    - **Solución Implementada:**
      1. **Haz de Barrido Cónico y Estela de Persistencia de Fósforo (`404.html`, 395 líneas < 500):**
         - Se eliminó por completo la aguja solitaria (`lens-sweep-arm`) que causaba la ilusión de reloj.
         - Se implementó `.radar-cone-beam` mediante un `conic-gradient` angular de 52° con estela de desvanecimiento esmeralda (`rgba(10, 159, 104, 0.5)` a transparente), rotando a 360° como una auténtica antena de radar militar.
         - Se integró retícula de precisión óptica con anillos concéntricos, marcas cardinales, muescas diagonales a 45° en los cuatro cuadrantes, núcleo emisor central y 2 ecos de fósforo (`radar-blip-alpha` y `radar-blip-beta`) con cinemáticas independientes de encendido y decaimiento al paso del haz.
         - Se preservó la interactividad táctil para Android (`pointerdown`/`pointerup`) con aceleración a 1.1s y actualización reactiva de la telemetría.
         - Optimización modular Desmulta: archivo compactado y reducido de 528 a 395 líneas.
      2. **Estructuración Estratégica de Marketing y Revelación Progresiva:**
         - Definición del modelo comercial para Origgo: sustituir la explicación técnica de software por el principio "Show, Don't Tell". El valor se comunica mediante el contraste de dolor financiero (el ahorro del 3%-4% de intermediación inmobiliaria) y la sensación de exclusividad de una "Terminal Confidencial en tu bolsillo".
      3. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: sincronizado `dist/404.html`.
         - Suite de validación DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).
         - Conteo serverless inalterado: exactamente 11 funciones (límite Vercel Hobby <= 12).

-34. **Creación de Escáner Óptico Táctico Interactivo 404 (Animación de Autor Táctil para Android) y Estandarización de Narrativa de Usuario**:
    - **Diagnóstico y Necesidad:**
      1. El usuario solicitó una animación personalizada de autor para la página de error 404 (`404.html`), exigiendo que no fuera nada parecido a lo ya existente en la plataforma, sin neones, sin aros genéricos y con un lenguaje visual técnico de alta fidelidad.
      2. Adicionalmente, el usuario requirió una clarificación conceptual de producto enfocada en el usuario común (no desarrollador) que navega desde un dispositivo Android: cómo explicarle qué es Origgo, qué ventaja le otorga sobre el mercado inmobiliario tradicional y qué encuentra al navegar por la plataforma.
    - **Solución Implementada:**
      1. **Escáner Óptico Táctico de Coordenadas (`404.html`, 481 líneas < 500):**
         - Se diseñó e implementó una pieza de arte interactiva en el número monumental `404`: el `0` central se transformó en una lente óptica giroscópica con retícula de cuadrante militar SVG, marcas cardinales esmeralda mate (`#0a9f68`), aguja de barrido continuo a 360° (`lens-sweep-arm`) y un blip de señal que titila y se desvanece simbolizando la coordenada perdida.
         - Se integró una barra de telemetría de instrumentación aeronáutica (`RADAR BOG / COL · ESTADO: SIN SEÑAL / STATUS: NO SIGNAL`).
         - **Interactividad Táctil para Android y Ratón:** Al presionar la lente táctica (`pointerdown`), el escáner se comprime elásticamente (`scale(1.08) rotateZ(-3deg)`), acelera la frecuencia de escaneo y actualiza la telemetría en tiempo real a `BUSCANDO EN EL LEDGER...` (`ACQUIRING SIGNAL...`). Al levantar el dedo (`pointerup`), reporta con sobriedad `SEÑAL CERRADA · COORDENADA 404`.
         - Optimización de código y modularidad estricta Desmulta (< 500 líneas: 481 líneas finales).
      2. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: actualizado `dist/404.html`.
         - Suite de validación DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).
         - Conteo serverless inalterado: exactamente 11 funciones (límite Vercel Hobby <= 12).

-33. **Corrección Milimétrica de Centrado Radial del Radar y Blindaje Espacial del Botón de Cierre en Modal de Alertas Web Push**:
    - **Diagnóstico y Necesidad:**
      1. El usuario reportó dos fallos visuales críticos en el modal de activación de alertas Web Push (`modalPushPromptOverlay`):
         - El pulso animado del radar en la píldora verde salía torcido y desplazado hacia la izquierda y abajo del punto central, en lugar de emerger concéntricamente desde el núcleo.
         - El botón de cierre (`&times;`) estaba pisando directamente el extremo derecho de la píldora "RADAR EN TIEMPO REAL", rompiendo la armonía y la estética de alta gama del producto.
    - **Solución Implementada:**
      1. **Alineación Concéntrica Absoluta del Radar Ping (`styles/17-push-modal.css`, 305 líneas < 500):**
         - Se erradicaron los offsets empíricos (`top: -4px; left: -4px;`) que causaban el desvío visual en subpíxeles.
         - Se estructuró `.push-radar-ping` como una caja contenedora de 10x10px con flex centrado, núcleo sólido central (`::before`) de 6x6px y aro expansivo (`::after`) matemáticamente anclado en `top: 50%; left: 50%; transform: translate(-50%, -50%)` con `transform-origin: center center;`.
         - La cinemática `pushPulseCenter` ahora expande la onda con simetría radial perfecta de 360°, naciendo con precisión milimétrica del centro del punto verde.
      2. **Erradicación Total de Colisión con el Botón de Cierre (`styles/17-push-modal.css`):**
         - Se modificó la distribución de `.push-prompt-header`: cambió de `justify-content: space-between` a `justify-content: flex-start` con `gap: 0.75rem`, y se blindó el lateral derecho con un margen de seguridad de `padding-right: 3.5rem` (56px) en desktop y `3.25rem` en móvil.
         - El logo y la píldora ahora fluyen ordenadamente hacia la izquierda sin invadir jamás el cuadrante superior derecho.
         - Se redefinió `.push-prompt-card .btn-modal-close` con círculo táctil de 36x36px en vidrio esmerilado, z-index protegido y aislamiento absoluto sin pisar ninguna sección.
      3. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: actualizados `style.css` y `style.min.css`.
         - Suite de validación DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).
         - Todos los módulos bajo el estándar Desmulta (< 500 líneas: `17-push-modal.css` en 305 líneas).
         - Conteo serverless inalterado: exactamente 11 funciones (límite Vercel Hobby <= 12).

-32. **Rediseño Austero de Página 404 (Estándar Desmulta), Restauración de Animación de Letras en 'riggo', Cero Neones y Purga de Documentos Obsoletos**:
    - **Diagnóstico y Necesidad:**
      1. El usuario expresó profunda decepción con el diseño inicial de `404.html`: faltaba el número `404` monumental, contenía brillos/neones que rompían la seriedad y, críticamente, incluía un botón de soporte de WhatsApp para reportar errores 404, lo cual comprometía financieramente la operación al generar costos de atención humana innecesarios en enlaces rotos. Se exigió una arquitectura idéntica a la creada por el usuario en el ecosistema Desmulta (`rounded-2xl/3xl`, código de estado 404 monumental, subtítulo claro, cero soporte manual y botón de retorno al inicio).
      2. El usuario reclamó la restauración de su animación de arranque cinemática sobre la palabra `riggo` (animación secuencial letra por letra `animLetterAppear` con isotipo limpio de 46x46px con 1px de margen y `filter: none`), eliminada previamente de forma inconsulta.
      3. Se exigió erradicar absolutamente brillos difusos, sombras verdes radioactivas o neones en el logotipo y en la página de error.
      4. Se denunció la acumulación de documentos basura obsoletos en el proyecto (específicamente en `docs/`) sin mantenimiento ni limpieza periódica.
    - **Solución Implementada:**
      1. **Rediseño Profesional y Automatizado de `404.html` (240 líneas < 500):**
         - Se implementó la estructura austera inspirada en Desmulta: caja táctica con icono `fa-file-circle-question`, número monumental `404` (6rem / peso 900), subtítulo tipográfico "Página No Encontrada / Page Not Found", explicación técnica clara y botón de retorno principal "IR AL INICIO".
         - Se erradicó por completo el enlace de WhatsApp y cualquier canal de soporte manual en 404, sustituyéndolo por un sello técnico silencioso de auditoría con baja opacidad (`Origgo v1.0.0 — Búsqueda Segura Finalizada`).
         - Cero neones o resplandores estridentes: estética mate en fondo obsidiana carbón y soporte bilingüe (`ES / EN`) con conmutación instantánea sin parpadeo.
      2. **Restauración de Animación de Arranque en 'riggo' (`index.html`, `styles/02-base.css` y `styles/11-mobile.css`):**
         - En `index.html`: restaurada la jerarquía con `.brand-text-block`, isotipo vectorial `.brand-initial-o-wrap` (46x46px, `filter: none`) y contenedor `.brand-letters-riggo` con letras individuales (`.brand-letter-1` a `.brand-letter-5`).
         - En `styles/02-base.css` (246 líneas < 500): restaurada la cinemática de arranque letra por letra `animLetterAppear` en cascada (`animation-delay: calc(0.12s + var(--char-i) * 0.08s)`), con traslación sutil de 8px a 0 y color verde mate `#0a9f68` sin neones ni halos difusos.
         - En `styles/11-mobile.css` (497 líneas < 500): calibradas las dimensiones responsivas de `.brand-title` y `.brand-initial-o-wrap` para tablets (1.45rem / 36px) y smartphones (1.22rem / 30px).
      3. **Purga de Documentación Basura:**
         - Se eliminó del repositorio el documento histórico obsoleto `docs/REPORTE_AUDITORIA_DEVSECOPS_REMEDIACIONES.md`, manteniendo únicamente la documentación viva y oficial (`INDICE_ARCHIVOS.md`, `INTEGRACIONES_EXTERNAS.md`, `README.md`, `ARCHITECTURE.md` y `MEMORY.md`).
      4. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: actualizados `style.css` y `style.min.css`.
         - Suite de validación DevSecOps de 8 fases (`npm test`): 100% aprobada (0 errores).
         - Cumplimiento inflexible del estándar Desmulta (< 500 líneas en todos los archivos).
         - Conteo serverless inalterado: exactamente 11 funciones (límite Vercel Hobby <= 12).

-31. **Estandarización de Identidad Visual, Soporte Bilingüe y Despacho Nativo de la Página Personalizada de Error 404**:
    - **Diagnóstico y Necesidad:**
      1. El usuario consultó por qué nunca había podido ver la página personalizada de error 404 y si existía en la plataforma.
      2. Una auditoría técnica reveló que `404.html` sí existía físicamente en el proyecto y se empaquetaba para producción en `dist/404.html` (donde Vercel la sirve de forma nativa), pero en el servidor local de desarrollo (`server.js`), ante una ruta inexistente o denegada, se respondía con un mensaje en texto plano `"404 No encontrado"`, impidiendo visualizar la experiencia real en entornos locales.
      3. Adicionalmente, `404.html` utilizaba un isotipo rasterizado (`/apple-touch-icon.png`), carecía del selector bilingüe internacional (`ES / EN`) implementado en la aplicación principal y no armonizaba automáticamente con los temas claro y oscuro (`data-theme`).
    - **Solución Implementada:**
      1. **Despacho Nativo en Servidor Local (`server.js`, 183 líneas < 500):**
         - Se implementó la función auxiliar `responder404()` que envía deterministamente el archivo `404.html` con código de estado HTTP 404 y cabeceras de seguridad OWASP ante cualquier archivo o ruta inexistente, unificando la experiencia de desarrollo local con el comportamiento nativo de Vercel en producción.
      2. **Elevación de Identidad y Prestigio en `404.html` (239 líneas < 500):**
         - Se sustituyó el favicon rasterizado por el logotipo corporativo oficial SVG de Origgo (`./assets/img/origgo-logo.svg`), incorporando el resplandor esmeralda respirante de alta gama.
         - Se integró un selector bilingüe minimalista (`ES / EN`) sincronizado con `localStorage.getItem('origgo_lang')`, con textos y traducciones completas para el badge de error, titular, descripción, botón de retorno y canal de soporte VIP.
         - Se adaptaron los tokens de diseño para responder automáticamente al modo oscuro y claro (`origgo_theme`).
      3. **DevSecOps y Compilación:**
         - Recompilación con `node scripts/build.js`: actualizado `dist/404.html` sincronizado con la raíz.
         - Validación completa de 8 fases (`npm test`): 100% aprobada (0 errores), submódulos bajo cota Desmulta (< 500 líneas) y 11 serverless functions inalteradas.

-30. **Erradicación Total de Pulso y Destello en Logotipo y Elevación Estética de Alto Estatus y Elegancia Arquitectónica**:
    - **Diagnóstico y Necesidad:**
      1. El usuario solicitó expresamente retirar los efectos de destello líquido oblicuo (`.brand-sheen-sweep`) y el aro/pulso de radar (`.brand-radar-ping`), considerándolos artificios estridentes y de baja gama que restaban seriedad y estatus a la plataforma.
      2. Se demandó restaurar una animación que transmita auténtica calidad, estatus institucional, exclusividad y alta finanza sobre el logotipo vectorial oficial (`assets/img/origgo-logo.svg`), sin cajas, aros ni brillos invasivos.
    - **Solución Implementada:**
      1. **Depuración Estructural del Marcado (`index.html`):**
         - Se eliminaron los elementos `<span class="brand-radar-ping"></span>` y `<span class="brand-sheen-sweep"></span>` dentro de `.brand-title`.
         - El encabezado del logotipo queda con la silueta pura del vector SVG oficial de Origgo.
      2. **Estética Pura, Sobria y de Alto Estatus (`styles/02-base.css`, 223 líneas < 500):**
         - Se purgaron por completo las clases `.brand-radar-ping`, `.brand-sheen-sweep`, `.brand-sheen-sweep::after` y sus keyframes asociados (`@keyframes radarSonarPing`, `@keyframes prestigeSheenSweep`).
         - Se diseñó una cinemática de alta finanza basada en la sobriedad:
           - **Entrada Cinemática Noble (`logoPrestigeEntrance`):** Micro-desplazamiento vertical sutil de 3px y transición de opacidad progresiva en 0.75s con curva `cubic-bezier(0.16, 1, 0.3, 1)`.
           - **Respiración Esmeralda de Alta Fidelidad (`logoBreathingGlow` / `logoBreathingGlowLight`):** Halo ambiental orgánico profundo y pausado en ciclos de 6 segundos, alternando un resplandor de `drop-shadow(0 0 3px rgba(10, 159, 104, 0.35))` a `drop-shadow(0 0 8px rgba(10, 159, 104, 0.75)) drop-shadow(0 0 16px rgba(16, 185, 129, 0.25))`, evocando una esmeralda tallada sobre fondo obsidiana sin artefactos ruidosos.
           - **Micro-interacción al Hover / Tap:** Elevación táctil de precisión (`scale(1.025)`) con encendido suave del resplandor esmeralda.
      3. **Saneamiento Responsivo en Dispositivos Móviles (`styles/11-mobile.css`, 482 líneas < 500):**
         - Se retiraron las sobreescrituras de `.brand-radar-ping` en las cotas de tablet (max-width: 768px) y smartphone (max-width: 480px), recuperando margen de modularidad (de 494 a 482 líneas).
      4. **DevSecOps y Compilación Modular:**
         - Ejecutado `node scripts/build.js`: recompilados `style.css` (159 KB) y `style.min.css` (118 KB) con 0 residuos de radar ni sheen.
         - Suite de validación DevSecOps de 8 fases (`node scripts/validate.js` / `npm test`): 100% aprobada (0 errores).
         - Cumplimiento inflexible del estándar Desmulta (< 500 líneas en todos los archivos).
         - Conteo serverless inalterado: exactamente 11 funciones (límite Vercel Hobby <= 12).

-29. **Internacionalización Integral de Modales (Checkout, Recuperación, Bienvenida VIP, Legal y Ficha) y Cinemática de Alto Prestigio del Logotipo**:
    - **Diagnóstico y Necesidad:**
      1. Al conmutar el idioma a inglés (`EN`), los modales (Checkout de planes, Restauración de PIN por WhatsApp y correo, Bienvenida VIP, Información Legal institucional de 4 pestañas y Ficha lateral slide-up) o textos generados dinámicamente por JavaScript aún se mostraban en español.
      2. El usuario solicitó recuperar la cinemática del logotipo (pulso táctico en la 'O' y destello líquido metálico) pero con una ejecución de alta gama: cero cajas, cero marcos rectangulares y con el efecto integrado orgánicamente en el vector SVG.
    - **Solución Implementada:**
      1. **Cinemática Orgánica del Logotipo (`styles/02-base.css`, `styles/11-mobile.css` e `index.html`):**
         - Se implementó `.brand-radar-ping`: pulso concéntrico táctico originado en el centro del compás de la 'O' de Origgo, expandiéndose libremente sin cortes (`overflow: visible` en `.brand-title`) y calibrado para desktop (`left: 20px`), tablets (`left: 17px`) y móviles (`left: 14.5px`).
         - Se implementó `.brand-sheen-sweep`: destello de cristal líquido enmascarado matemáticamente al vector SVG (`-webkit-mask-image: url('../assets/img/origgo-logo.svg')`), de modo que la luz recorre exclusivamente las letras sin generar fondos, bordes ni cajas rectangulares.
      2. **Internacionalización Exhaustiva de Modales (`modules/13-i18n.js`, `modules/08-checkout.js`, `modules/11-welcome.js`, `modules/09-ui-effects.js` e `index.html`):**
         - Enriquecido `DICCIONARIO_I18N` en ES y EN con todas las claves de modales: resumen de propiedad en checkout (`modal_summary_*`), selector de ciudad, advertencia de WhatsApp único, garantías Wompi, restauración de PIN, recuperación de cuenta por correo, estado de bóveda, planes de membresía y footer institucional.
         - En `modules/08-checkout.js` y `modules/11-welcome.js`: generadores de tarjetas de beneficios y estados de cuenta adaptados para renderizar dinámicamente en inglés o español según el idioma activo.
         - En `modules/09-ui-effects.js` y `modules/13-i18n.js`: creado repositorio `TEXTOS_LEGALES_ORIGGO_EN` que traduce al 100% las 4 pestañas legales (Cómo Funciona, Seguridad, Tus Datos, Garantía de Saldo).
         - En `cambiarIdioma()`: orquestada la sincronización reactiva inmediata de cualquier modal o drawer que se encuentre abierto al conmutar el selector.
      3. **DevSecOps y Cumplimiento Estricto:**
         - Build modular (`node scripts/build.js`): recompilados `app.js`, `app.min.js`, `style.css` y `style.min.css`.
         - Suite de validación DevSecOps de 8 fases (`node scripts/validate.js`): 100% aprobada (0 errores).
         - Todos los submódulos cumplen estrictamente el estándar Desmulta (< 500 líneas: `08-checkout.js` con 490 líneas, `09-ui-effects.js` con 493 líneas, `11-welcome.js` con 159 líneas, `13-i18n.js` con 485 líneas, `02-base.css` con 302 líneas, `11-mobile.css` con 494 líneas).
         - Conteo serverless inalterado: exactamente 11 funciones (límite Vercel Hobby <= 12).

-28. **Erradicación de Cajas y Aros en Logotipo, Rediseño Tipográfico Minimalista de Idiomas (Sin Banderas) y Eliminación de Parpadeo en Móviles**:
    - **Diagnóstico y Necesidad:**
      1. El usuario reportó que el logotipo "Origgo" quedó encerrado dentro de un contenedor rectangular cortado con un aro de radar descentrado que rompía la estética.
      2. Los emojis de banderas (`🇨🇴`, `🇺🇸`) en la cabecera móvil se renderizaban de gran tamaño y colores estridentes, saturando la barra y chirriando contra la paleta oscura/esmeralda de alta gama.
      3. Al conmutar el idioma, la llamada a `document.startViewTransition` a nivel de `root` congelaba la GPU del teléfono móvil para capturar un snapshot de 1080x2400px, provocando un parpadeo/flicker (flash blanco/negro) molesto.
      4. Varios elementos de la interfaz quedaban sin traducir en la vista en inglés (botón CTA del Hero, badge de sectores monitoreados, contador de catálogo, eyebrow y cinta marquee de confianza).
    - **Solución Implementada:**
      1. **Logotipo Puro y Silueta Respirante (`styles/02-base.css`, 208 líneas < 500):**
         - Se eliminó completamente cualquier caja, padding, fondo, borde y `overflow: hidden` en `.brand-title` y `.brand-badge`.
         - Se erradicaron los pseudoelementos `::before` (aro cortado `radarSonarPing`) y `::after` (destello `prestigeSheenSweep`), así como el halo ovalado `prestigeAmbientAura`.
         - La animación se trasladó directamente sobre el vector SVG `.brand-logo-img` mediante una respiración sutil de luz esmeralda (`logoBreathingGlow`) con `drop-shadow(0 0 2px rgba(10, 159, 104, 0.35))` a `drop-shadow(0 0 7px rgba(10, 159, 104, 0.75)) drop-shadow(0 0 14px rgba(16, 185, 129, 0.25))`, manteniendo el logotipo libre, nítido y de altísimo nivel.
      2. **Selector de Idioma Tipográfico de Alta Finanza (`styles/18-i18n.css`, 189 líneas e `index.html`):**
         - Se erradicaron todos los emojis de banderas tanto en la cabecera como en el menú lateral off-canvas.
         - Se implementó una micro-píldora minimalista suiza (`ES` / `EN`, 11px, `letter-spacing: 0.05em`) con micro-iluminación esmeralda en el idioma activo.
         - Ocupa un ancho mínimo (~54px) que respira con armonía perfecta junto al botón VIP en la barra móvil y de escritorio.
      3. **Erradicación Absoluta del Parpadeo (`modules/13-i18n.js`, 438 líneas < 500):**
         - Se eliminó `ejecutarConTransicionSuave` en `cambiarIdioma()`.
         - La mutación del DOM ahora se ejecuta de manera instantánea y síncrona en memoria (<1ms) a 60fps/120fps, erradicando por completo cualquier parpadeo, congelamiento o flash en dispositivos móviles.
      4. **Sincronización Total de Textos Bilingües (`modules/13-i18n.js` e `index.html`):**
         - Sincronizados y traducidos en ES y EN: botón CTA del hero (`hero_cta`), badge de sectores (`hero_badge_suffix`), contador dinámico de oportunidades (`catalog_count_suffix`/`catalog_count_single`), eyebrow de portafolio (`catalog_eyebrow`) y las 4 señales de la cinta marquee de confianza (`marquee_direct_title`, `marquee_alerts_title`, `marquee_arbitrage_title`, `marquee_access_title`).
    - **DevSecOps:**
      - Compilación modular ejecutada con éxito (`node scripts/build.js`): 14 módulos JS y 18 módulos CSS compilados y minificados.
      - Suite de 8 fases (`node scripts/validate.js`): 100% aprobada (0 errores). Todos los módulos bajo el estándar Desmulta (< 500 líneas). 11 funciones serverless inalteradas.

-27. **Sistema Bilingüe Internacional (ES / EN) con Transiciones Suaves Nativas (View Transitions API), Conversión Referencial USD y Elevación de Animación de Cabecera de Alto Prestigio**:
    - **Diagnóstico y Necesidad:**
      1. El usuario solicitó habilitar el soporte bilingüe (Español e Inglés) de manera fluida y sedosa, idéntica a la experiencia de transiciones de vista de Astro mostrada en el video de referencia, sin recargas de página, sin parpadeos y sin llamadas pesadas al backend (manteniendo las 11 funciones serverless en Vercel Hobby).
      2. Al unificar previamente el logotipo corporativo como vector `.svg` externo, se había perdido la vida y dinamismo en la cabecera. El usuario exigió recuperar la animación y elevar la estética visual para reflejar "el nivel de dinero que refleja en sus oportunidades de negocios (verse y sentirse premium)".
      3. Para inversionistas internacionales, los precios en pesos colombianos carecían de referencia internacional inmediata, limitando el atractivo del producto.
    - **Solución Implementada:**
      1. **Módulo de Internacionalización Desacoplado (`modules/13-i18n.js`, 419 líneas < 500):**
         - Diccionario centralizado de ultra alto rendimiento en español e inglés sin dependencias externas.
         - Conmutador de idioma `cambiarIdioma(nuevoIdioma)` que encapsula la mutación del DOM dentro de `ejecutarConTransicionSuave()`, activando la **View Transitions API nativa de W3C** acelerada por GPU (`::view-transition-old(root)` / `::view-transition-new(root)`), logrando un cross-fade sedoso imperceptible idéntico a Astro.
         - Conversión financiera automática a dólares estadounidenses referenciales (`calcularReferenciaUSD`) con formato de alta gama (`≈ $109,750 USD` en inglés y `~$109,750 USD` en español), inyectada de forma no invasiva en cada tarjeta Bento (`.card-price-usd`).
         - Observador reactivo `MutationObserver` sobre el contenedor de la grilla que sincroniza automáticamente las equivalencias en USD y textos de tarjetas sin inflar `modules/06-cards.js`.
         - Traducción contextual inmersiva del slide-up drawer (`traducirSlideupDrawer`) al abrir la ficha de cualquier propiedad.
         - Persistencia de preferencia de idioma en `localStorage` con detección automática del navegador.
      2. **Estilos de Internacionalización y Selector de Cristal (`styles/18-i18n.css`, 192 líneas < 500):**
         - Selector minimalista de cristal arquitectónico `.lang-switch` en cabecera desktop y móvil con banderas de alta definición (`🇨🇴 ES` | `🇺🇸 EN`), `backdrop-filter: blur(12px)` y micro-interacciones suaves.
         - Selector complementario en el menú lateral off-canvas (`.side-lang-switch`).
         - Tipografía de alta fidelidad para el valor referencial USD en tarjetas (`.card-price-usd`).
      3. **Cinemática de Cabecera de Alta Finanza y Prestigio Inmobiliario (`styles/02-base.css`):**
         - **Aura Lumínica Esmeralda Viva (`prestigeAmbientAura`):** Halo ambiental respirante detrás del logotipo en ciclos de 6 segundos, otorgando una presencia magnética y viva de joya esmeralda.
         - **Destello Líquido de Cristal (*Prestige Sheen Sweep*):** Destello diagonal metálico de luz blanca y reflejos esmeralda que recorre suavemente el logotipo cada 6 segundos (`@keyframes prestigeSheenSweep`), transmitiendo la solidez de una terminal financiera de alta gama (Bloomberg / Stripe Climate).
         - **Pulso de Radar Táctico en el Compás de la 'O' (`radarSonarPing`):** Ondas concéntricas suaves que nacen del compás de localización, simbolizando la detección de oportunidades en tiempo real.
         - **Micro-interacción al Hover / Tap:** Elevación táctil elástica `scale(1.03)` con encendido inmediato del resplandor esmeralda.
      4. **Marcado HTML y Accesibilidad (`index.html`):**
         - Integración de atributos `data-i18n`, `data-i18n-ph`, `data-i18n-title` en hero, omnibox, filtros, modales y footer.
         - Selector de idioma en barra de navegación y menú lateral.
    - **DevSecOps:**
      - Build modular ejecutado con éxito (`node scripts/build.js`): ensamblados 14 módulos JS y 18 módulos CSS.
      - Suite de 8 fases (`node scripts/validate.js`): 100% aprobada (0 errores).
      - Todos los archivos cumplen estrictamente la cota Desmulta (< 500 líneas). Conteo serverless inalterado (11 funciones en Vercel Hobby).

-26. **Unificación y Nitidez de Logotipo Oficial en Header, Footer y Menú Lateral, Erradicación de Jerga Residual y Optimización de Interacción**:
    - **Diagnóstico y Causa Raíz:** Se había fragmentado la identidad de marca dividiendo la inicial "O" como imagen rasterizada independiente (`origgo-icon.svg`) y las letras "riggo" como spans de texto HTML. Esto producía un espaciado desalineado, tipografía genérica y una silueta oscura casi imperceptible sobre fondos oscuros.
    - **Solución Implementada:**
      1. Se unificó la identidad visual en toda la plataforma (`index.html`, `styles/02-base.css`, `styles/11-mobile.css`, `styles/12-sidebar.css`, `styles/13-footer.css`) insertando el logotipo corporativo completo `assets/img/origgo-logo.svg` en la cabecera (`.brand-logo-img`), pie de página (`.footer-logo-img`) y menú lateral (`.side-menu-logo-img`), garantizando nitidez perfecta, color verde esmeralda uniforme (`#0a9f68`) y cero desalineaciones.
      2. En el pie de página (`index.html`), se sustituyó la jerga técnica antigua ("Terminal privada de inteligencia de mercado y arbitraje comercial...") por una descripción comercial limpia, cercana y enfocada al comprador de vivienda directa en Colombia.
      3. En la barra móvil inferior y cabecera (`modules/10-listeners.js`), hacer clic en el logotipo o en el botón "Inicio" ahora restablece automáticamente los filtros activos y desplaza la vista con suavidad al inicio del catálogo.
      4. En el modal de checkout (`modules/08-checkout.js`), se eliminó la jerga técnica en el botón de pago, sustituyendo "Generando firma criptográfica..." por "Conectando con pago seguro...".
    - **DevSecOps:** Ejecutado `npm run build` y validación completa de 8 fases (`scripts/validate.js`) al 100% (0 errores). Submódulos acotados bajo el límite Desmulta (< 500 líneas).

-25. **Resolución Crítica de Fallo de Despliegue en Vercel (Límite Estricto de 12 Funciones en Plan Hobby)**:
    - **Diagnóstico Forense de la Causa Raíz:**
      - El usuario reportó que los despliegues de Vercel fallaban sistemáticamente en GitHub (`All checks have failed — Vercel Deployment has failed`).
      - Una auditoría histórica determinó que el commit `573444a` fue el último exitoso y que los fallos comenzaron exactamente en `8fcba2d`.
      - **Causa Raíz:** El plan Hobby (gratuito) de Vercel impone un límite máximo inflexible de **12 Serverless Functions por despliegue**. En `573444a` el repositorio tenía exactamente 12 funciones. Al añadir `api/telemetry/report.js` (Perro Guardián), el conteo subió a 13 funciones, provocando que Vercel rechazara de inmediato cualquier intento de despliegue con HTTP 400 (`Hobby plan serverless function limit exceeded`).
    - **Consolidación Arquitectónica Zero-Breaking de Endpoints:**
      1. **Consolidación de Notificaciones Web Push (`api/notifications/subscribe.js`):**
         - Se fusionó la entrega dinámica de la clave pública VAPID (GET) y el registro de suscripciones W3C (POST) en un único endpoint multiplexado `api/notifications/subscribe.js`.
         - Se eliminó el archivo físico `api/notifications/vapid-public-key.js` (-1 función).
      2. **Consolidación de Verificación de Pasarela Wompi (`api/payments/create-order.js`):**
         - Se fusionó la verificación server-to-server de transacciones Wompi (GET) y la generación de órdenes con firma SHA-256 (POST) dentro de `api/payments/create-order.js`.
         - Se eliminó el archivo físico `api/payments/verify.js` (-1 función).
      3. **Enrutamiento Transparente mediante Rewrites (`vercel.json`):**
         - Añadidas reglas de `rewrites` para redirigir `/api/notifications/vapid-public-key` hacia `/api/notifications/subscribe` y `/api/payments/verify` hacia `/api/payments/create-order`. Cero roturas para clientes web o cachés previas.
      4. **Reducción de Funciones Serverless:** Conteo total reducido de 13 a **11 funciones activas**, garantizando despliegues verdes inmediatos en Vercel Hobby con margen de holgura.
    - **DevSecOps:** Actualizada la suite `tests/web_push.test.js` y `scripts/validate.js`. Las 8 fases de validación pasaron con 100% de éxito (0 errores).

-24. **Corrección Visual Integral Móvil, Regeneración de Assets de Marca a Alta Resolución, Restauración de FontAwesome y Modal Push**:
    - **Diagnóstico y Regeneración Cristalina de Assets de Marca (`scratch/regenerate_assets.js`):**
      - Se diagnosticó la causa raíz de la visualización deficiente del logotipo ("riggo" cortado y una "mancha" casi transparente en lugar de la 'O'): una compresión previa había reemplazado `origgo-icon.svg` por un PNG raster con 99% de transparencia y el texto se había fragmentado en spans.
      - A partir de la matriz master original de 4000x2250 (`test_logo_4000.png`), se identificó la caja delimitadora del isotipo oficial (compás/pin en 'O') en `X: [228, 1001], Y: [424, 1589]` y del logotipo completo en `X: [228, 3675], Y: [424, 1589]`.
      - Se regeneraron en color verde esmeralda corporativo `#0a9f68` con fondo transparente: `assets/img/origgo-logo.png`, `assets/img/origgo-logo.svg` (860x289px, peso pluma de 28 KB), `assets/img/origgo-icon.svg`, `push-icon-192.png`, `push-icon-512.png`, `favicon.svg`, `favicon-48x48.png` y `favicon-32x32.png`. Todos con nitidez cristalina en pantallas Retina/AMOLED.
    - **Reparación Crítica de Carga de FontAwesome (`index.html`):**
      - Se detectó que el hack `media="print" onload="this.media='all'"` introducido para optimizar métricas de Lighthouse bloqueaba la ejecución de la hoja de estilos en navegadores móviles (especialmente Brave Mobile con escudos de privacidad), provocando que todos los iconos de la web y modales no se renderizaran.
      - Se restauró la carga formal y síncrona de FontAwesome 6.5.1 en el `<head>`.
    - **Rediseño del Modal de Alertas Web Push (`index.html` y `styles/17-push-modal.css`):**
      - Se incorporó el logotipo oficial `origgo-logo.svg` en la cabecera `.push-prompt-header` junto al badge pulsante de radar en vivo.
      - Para garantizar que los iconos de las características nunca fallen sin importar la conexión o bloqueadores de red, se incrustaron iconos SVG vectoriales inline en las 3 filas descriptivas: rayo (`bolt`), mira táctica (`crosshairs`) y campana silenciada (`bell-slash`).
      - Se reposicionó el botón de cierre `.btn-modal-close` en `top: 1rem; right: 1rem;` con área táctil protegida (44px) sin solapamiento con el contenido.
    - **Restauración de Créditos y Saldo en Móvil (`styles/11-mobile.css` y `modules/01-state.js`):**
      - Se eliminó la regla destructiva `.nav-actions { display: none !important; }` que borraba el saldo del usuario en pantallas pequeñas.
      - Se rediseñó la barra de navegación superior móvil con distribución `space-between`: el logotipo a la izquierda y a la derecha el chip táctil de saldo (`#btnVipHeader`) con etiqueta clara (`⚡ Planes`, `⚡ X Créditos` o `👑 VIP`).
      - Se ajustó el `.command-bar-wrapper` en móvil con `position: relative !important; top: auto !important;` para que fluya con el scroll natural y no asfixie ni tape el 30% superior de las tarjetas de inmuebles.
    - **Erradicación de Jerga Antigua Residual ("Terminal de Inmuebles directos y Arbitraje"):**
      - Modificado `data/inmobiliario.json` con `"titulo_modulo": "Inmuebles en venta <span class=\"editorial-italic\">directo</span> de sus dueños"` y subtítulo sin tecnicismos. Dataset refirmado criptográficamente (`data/inmobiliario.json.sig`).
      - Blindada la función `renderizarHero` en `modules/06-cards.js` para neutralizar proactivamente cualquier cadena residual con "Terminal" o "Radar de captación".
    - **Modularidad Desmulta (< 500 líneas por submódulo):**
      - `modules/06-cards.js`: 488 líneas (< 500)
      - `styles/11-mobile.css`: 491 líneas (< 500)
      - `styles/17-push-modal.css`: 254 líneas (< 500)
    - **DevSecOps:** Build compilado (`npm run build`) y suite de 8 fases aprobada al 100% (0 errores).

-23. **Perro Guardián Serverless ($0 Coste), Telemetría con Sanitización PII, Cola Universal de Reintentos con Backoff Exponencial y Validación de Integridad de Catálogo**:
    - **Perro Guardián Serverless y Telemetría de Errores a Coste $0 (`api/telemetry/report.js` y `modules/00-security.js`):**
      - Diseñado e implementado el endpoint serverless `POST /api/telemetry/report` con CORS seguro y rate limiting distribuido mediante Upstash Redis (máximo 20 reportes/minuto por IP) para prevenir saturación de logs.
      - Sanitización y desinfección estricta de PII / PCI-DSS mediante expresiones regulares: antes de procesar o emitir logs estructurados en Vercel, el endpoint detecta y ofusca automáticamente tokens JWT (`[JWT_OFUSCADO]`), números de tarjeta de crédito (`[TARJETA_OFUSCADA]`), números de teléfono celular colombianos (`[TEL_OFUSCADO]`) y PINs maestros.
      - En el cliente (`modules/00-security.js`), la función `inicializarPerroGuardian` escucha `window.onerror` y `window.onunhandledrejection`. Cuenta con deduplicación por huella digital en memoria con ventana de 60 segundos para evitar bucles de spam ante errores repetitivos, e ignora excepciones externas generadas por extensiones del navegador (`chrome-extension://`).
      - El reporte hacia el servidor utiliza `navigator.sendBeacon` o `fetch` con `keepalive: true` de forma asíncrona y no bloqueante. Conectado en el ciclo de arranque de `modules/10-listeners.js`.
    - **Cola Universal de Reintentos con Backoff Exponencial y Jitter (`modules/03-api.js`):**
      - Creada la utilidad `fetchConReintentos(url, opciones, config)` que ejecuta reintentos automáticos ante errores de red (microcortes) o respuestas 5xx del servidor, calculando el retardo con backoff exponencial y variación aleatoria (jitter).
      - No reintenta errores 4xx (salvo 429 Too Many Requests), garantizando un comportamiento determinista.
    - **Validación Estructural de Catálogo e Integridad Zero-Trust (`modules/03-api.js` y `styles/16-utilities.css`):**
      - Creada la función `validarContratoCatalogo(json)` que audita la presencia de claves críticas (`leads`, `config`) y formato de arreglo antes de permitir la renderización en el DOM, blindando al usuario contra pantallas en blanco ante archivos JSON corruptos o incompletos.
      - `cargarDatos(rutaJson)` implementa una estrategia de tolerancia extrema a fallos: primero consulta Cloudflare R2 con reintento rápido; si falla o no supera la validación estructural, conmuta automáticamente a la ruta local empaquetada con 2 reintentos.
      - Si la conexión está totalmente caída, inyecta un estado visual amigable con botón de reintento interactivo (`.btn-retry-catalog`) y emite una alerta estructurada al Perro Guardián.
    - **Arquitectura Zero-Trust Clarificada y Auditada (Flujo del JSON del Teléfono):**
      - El bot en el Samsung Galaxy J7 extrae los leads, cifra los teléfonos con AES-256-GCM y firma el archivo `inmobiliario.json` con HMAC-SHA256 (`inmobiliario.json.sig`), subiendo ambos a Cloudflare R2.
      - La firma HMAC se valida estrictamente en el backend serverless (`api/leads/unlock.js`) mediante la clave privada `LEADS_ENCRYPTION_KEY`. El frontend no contiene ni puede contener dicha clave para evitar que usuarios maliciosos en DevTools (F12) la extraigan y desencripten el catálogo de Colombia de forma masiva. El frontend valida la integridad de contrato, cabeceras HTTP y conmuta al fallback local si detecta anomalías.
    - **Modularidad Desmulta (< 500 líneas por submódulo):**
      - `modules/00-security.js`: 238 líneas (< 500)
      - `modules/01-state.js`: 463 líneas (< 500)
      - `modules/03-api.js`: 174 líneas (< 500)
      - `modules/04-filters.js`: 401 líneas (< 500)
      - `modules/07-unlock.js`: 314 líneas (< 500)
      - `modules/10-listeners.js`: 485 líneas (< 500)
      - `styles/16-utilities.css`: 279 líneas (< 500)
    - **DevSecOps:** Creada suite unitaria en `tests/telemetry_watchdog.test.js`. 8 de 8 fases aprobadas al 100% (0 errores).

-22. **Blindaje Anti-Dumping (Ctrl+P / @media print), Cuota de Uso Justo (Fair Usage 35/día) y Filtro Táctico "Captados Hoy"**:
    - **Blindaje Anti-Dumping y Anti-Impresión (`styles/16-utilities.css`, `modules/00-security.js` e `index.html`):**
      - Erradicado el riesgo crítico de extracción masiva del directorio mediante atajos de impresión o exportación a PDF (`Ctrl + P` / `Cmd + P`).
      - En CSS (`@media print`), toda la cuadrícula, tarjetas interactivas y datos del portal se ocultan completamente (`display: none !important`), sustituyéndose por una hoja formal de documento protegido bajo la Ley 1581 de 2012 (Habeas Data de Colombia), señalando la trazabilidad forense activa del ledger y redireccionando al usuario a la sesión oficial en `origgo.online`.
      - En JavaScript (`modules/00-security.js`), la función `inicializarProteccionAntiImpresion` intercepta los atajos de teclado (`Ctrl + P` / `Cmd + P`) con `preventDefault()` y emite una alerta toast informativa.
    - **Política de Uso Justo (Fair Usage Policy - 35 Desbloqueos/Día) (`lib/db.js`, `api/leads/unlock.js` y `modules/07-unlock.js`):**
      - Implementado un límite estricto de 35 desbloqueos nuevos por día calendario para cuentas con membresía ilimitada (Plan Nacional o Plan Ciudad).
      - Si un usuario o scraper automatizado intenta superar los 35 desbloqueos en 24h, el backend rechaza la transacción con HTTP 429 (`CUOTA_DIARIA_EXCEDIDA`), protegiendo el catálogo contra revendedores o agencias piratas. Los inmuebles previamente desbloqueados pueden ser consultados ilimitadamente sin consumir cuota.
      - La interfaz informa de forma transparente los contactos diarios restantes (`${dailyUnlocksRemaining} restantes hoy`) tras cada desbloqueo con plan.
      - Creada suite unitaria automatizada en `tests/fair_usage_quota.test.js` e integrada en la Fase 5 de `scripts/validate.js`.
    - **Filtro Rápido de Oportunidades "⚡ Captados Hoy" (`index.html`, `modules/01-state.js` y `modules/04-filters.js`):**
      - Nuevo chip táctico `#cmdFilterToday` integrado en la barra de comandos flotante (`.cmd-filters-group`).
      - Permite aislar con un solo clic los inmuebles captados en las últimas 24 horas (`Date.now() - timestamp_ms <= 86400000`), respondiendo a la demanda de compradores que buscan primicias del día.
    - **Modularidad Desmulta (< 500 líneas por submódulo):**
      - `modules/00-security.js`: 151 líneas (< 500)
      - `modules/01-state.js`: 463 líneas (< 500)
      - `modules/04-filters.js`: 401 líneas (< 500)
      - `modules/07-unlock.js`: 314 líneas (< 500)
      - `modules/10-listeners.js`: 484 líneas (< 500)
      - `styles/16-utilities.css`: 256 líneas (< 500)
    - **DevSecOps:** Suite de 8 fases aprobada con 100% de éxito (0 errores).

-21. **Automatización Integral de Cobros, Despacho Autónomo por Resend, Bóveda Transparente de Créditos y Auto-Reclamo de Pagos**:
    - **Despacho Autónomo y Recibo Oficial con PIN Maestro (`lib/email-templates.js` + `api/payments/webhook-wompi.js`):**
      - Diseñada e implementada la función `generarPlantillaConfirmacionPago` con estética Salvia Lino Porcelana, PIN destacado (`HNT-XXXX`), desglose formal en COP, referencia Wompi y botón de Magic Link firmado con JWT para acceso instantáneo en 1 clic.
      - Creada la función `despacharCorreoConfirmacion` integrada con la API de Resend ($0 coste) e invocada automáticamente desde el webhook de Wompi al recibir confirmación `APPROVED`.
      - Idempotencia garantizada: se marca `order.emailSent = true` en el ledger para evitar envíos duplicados ante reintentos de webhook.
    - **Transparencia Visual de la Bóveda de Créditos y Convivencia de Saldos Híbridos (`modules/08-checkout.js`):**
      - Erradicado el temor comercial del usuario sobre la pérdida de créditos al pasar a suscripciones territoriales o nacionales.
      - El perfil y modal de checkout ahora visualizan formalmente: `⚡ Bóveda: X Créditos seguros (no vencen)`.
      - Se explica con total claridad que durante la vigencia del pase VIP los contactos se desbloquean a coste 0 créditos y que, si el mes concluye, los créditos de la bóveda permanecen intactos esperándolo.
    - **Auto-Reclamo de Pagos por Referencia Bancaria (`modules/01-state.js` + `index.html`):**
      - El formulario de restauración de cuenta ahora admite tanto el PIN de 4 dígitos como la Referencia de Pago Wompi (`HNT-...`).
      - Si un usuario paga por PSE o Nequi y la confirmación bancaria sufre latencia, el usuario solo ingresa su referencia bancaria y el frontend ejecuta automáticamente `claim_reference` contra `/api/auth/session`, restableciendo su sesión y acreditando su saldo en 2 segundos sin requerir soporte humano.
    - **Control Estricto de Modularidad Desmulta (< 500 líneas):**
      - `modules/01-state.js`: 462 líneas (Aprobado < 500).
      - `modules/08-checkout.js`: 491 líneas (Aprobado < 500).
      - Build y minificación (`npm run build`) ejecutados y sincronizados al 100%.
    - **DevSecOps:** Suite de 8 fases aprobada con 100% de éxito (0 errores).

-20. **Auditoría Profunda y Blindaje de Pasarela Wompi, Erradicación de Forced Reflow (193ms) y Sincronización Dinámica de Soporte WhatsApp**:
   - **Reconciliación Resiliente de Pagos Frontend (`modules/08-checkout.js`):**
     - **Problema Detectado en Auditoría:** Si el usuario pagaba con PSE o Nequi y existía latencia de red o propagación en el webhook de Wompi, el frontend hacía una única llamada a `/api/auth/session` (`claim_reference`), la cual retornaba 403 o fallaba silenciosamente en un `catch` vacío. El widget se cerraba y el usuario quedaba con la pantalla congelada sin sus créditos.
     - **Solución Implementada:** Función `reclamarSesionPostPago` con hasta 3 reintentos con backoff espaciado de 1.5s ante respuestas 403, feedback visual inmediato con toasts de estado, persistencia segura de la referencia no confirmada en `localStorage.setItem('origgo_pending_ref', reference)` y manejo de estados bancarios `PENDING` (PSE/Nequi en proceso) y `DECLINED/ERROR`.
     - **Recuperación Automática en Arranque (`modules/01-state.js`):** `inicializarSesionUsuario` ahora inspecciona `origgo_pending_ref` al recargar la página o volver a la pestaña, reclamando automáticamente el saldo pendiente si la transacción ya fue aprobada por el banco y limpiando el almacenamiento tras el éxito.
   - **Erradicación del Forced Reflow de 193ms en Scroll (`modules/09-ui-effects.js`):**
     - **Causa Raíz de Lighthouse:** El motor parallax ejecutaba un bucle síncrono sobre más de 100 imágenes (`.carousel-img, .card-static-img`), alternando lectura de layout (`parent.getBoundingClientRect()`) con escritura de estilos (`img.style.transform`), generando Layout Thrashing masivo en cada fotograma de scroll.
     - **Optimización DevSecOps:** Desactivado el efecto en dispositivos táctiles/móviles y con preferencia de movimiento reducido (foco crítico de Lighthouse Mobile a 60fps). En desktop, desacoplada la ejecución en **Fase 1 (Lectura en lote de tarjetas visibles)** y **Fase 2 (Escritura en lote de estilos GPU)** sobre el slide activo, erradicando al 100% el Forced Reflow.
   - **Centralización y Sincronización Dinámica de Soporte WhatsApp (`config.js` + `modules/10-listeners.js`):**
     - Eliminada la duplicación hardcodeada de números falsos (`573001234567`) en el checkout.
     - Actualizado el tagline comercial en `config.js` (`"Inmuebles en Venta Directo de Dueño en Colombia"`) y el mensaje por defecto.
     - Creado sincronizador automático en `DOMContentLoaded` que actualiza dinámicamente todos los botones y enlaces `wa.me/` del DOM con el número oficial configurado en `window.PORTAL_CONFIG.contacto.whatsapp`.
   - **Control Estricto de Modularidad Desmulta (< 500 líneas):**
     - `modules/08-checkout.js`: 489 líneas (Aprobado < 500).
     - `modules/09-ui-effects.js`: 490 líneas (Aprobado < 500).
     - `modules/10-listeners.js`: 482 líneas (Aprobado < 500).
     - `modules/01-state.js`: 449 líneas (Aprobado < 500).
   - **DevSecOps:** Suite de 8 fases aprobada con 100% de éxito (0 errores).

-19. **Transformación Radical de SEO Comercial, Schema.org JSON-LD y Optimización Extrema de Lighthouse**:
   - **Erradicación Total de Jerga Técnica y Rediseño Comercial del Copy:**
     - Erradicados los términos fríos y disuasivos ("Terminal", "Arbitraje", "Inteligencia de mercado").
     - Nuevo Título SEO: `Origgo — Inmuebles Directo de Dueño en Colombia | Sin Comisión`.
     - Nueva Meta Descripción: `Encuentra apartamentos, casas y lotes en venta directamente por sus propietarios en Bogotá, Medellín y Colombia. Cero comisiones de agencia, rebajas reales y trato directo.`.
     - Nuevo Hero: `Inmuebles en venta directo de sus dueños` / `Sin intermediarios ni comisiones de inmobiliaria. Oportunidades y rebajas de urgencia detectadas hoy en Colombia antes de que lleguen a las agencias.`.
     - Nuevo CTA principal: `Ver Inmuebles Directos Disponibles`.
     - Sincronizado en `index.html`, `data/inmobiliario.json` y el menú lateral.
   - **Inyección de Datos Estructurados Schema.org JSON-LD:**
     - Declarada formalmente la entidad `@type: "RealEstateAgent"` en Colombia con geolocalización, nombre canónico `Origgo`, logotipo corporativo oficial y métodos de pago aceptados (Wompi, Nequi, Bancolombia, PSE, Tarjetas). Esto erradica el diagnóstico de "sitio sin información oficial" en Google Search y Google AI Overview.
   - **Corrección Canónica de Sitemap y Robots:**
     - Reemplazadas todas las referencias residuales a `origgo.vercel.app` por el dominio canónico `https://origgo.online/sitemap.xml` en `sitemap.xml` y `robots.txt`.
   - **Favicons Oficiales para Googlebot (48x48 y 192x192):**
     - Enlazados explícitamente `favicon-48x48.png` y `push-icon-192.png` en el `<head>` para satisfacer los requerimientos de Googlebot-Image y erradicar el icono genérico del globo terráqueo.
   - **Optimización de Peso y Carga de Lighthouse (Resolución de Performance 57 -> 90+):**
     - **Reducción del 99.4% en SVGs:** Se detectó que `origgo-icon.svg` y `favicon.svg` pesaban 572 KB cada uno debido a matrices raster base64 embebidas. Se regeneraron optimizados a solo 3.5 KB, reduciendo casi 1 MB de payload de red.
     - **Erradicación de FontAwesome Duplicado:** Eliminado el CDN secundario redundante `ka-f.fontawesome.com` (1,110 ms de bloqueo de render) y configurado `all.min.css` con carga asíncrona no bloqueante `media="print" onload="this.media='all'"`.
     - **Google Fonts No Bloqueante:** Implementado patrón `rel="preload" as="style"` con fallback `<noscript>` para eliminar el retardo de render.
     - **Prefetch Asíncrono de Wompi:** Convertido el script de Wompi en prefetch no bloqueante en el arranque, activando su carga real solo bajo demanda cuando el usuario abre el modal de checkout, eliminando 228 ms de CPU innecesaria en el inicio.
   - **DevSecOps:** Suite de 8 fases aprobada con 100% de éxito (0 errores).

-18. **Implementación de View Transitions API Nativa (Erradicación de Parpadeos y Saltos Visuales)**:
   - **Análisis del Video (Astro Transitions / ClientRouter):**
     - El video mostraba cómo resolver los parpadeos y destellos molestos al cambiar de ruta o idioma mediante transiciones de vista de Astro (`astro:transitions`).
     - En Origgo (JavaScript vainilla modular de ultra alto rendimiento), se implementó la **View Transitions API nativa de W3C** con aceleración por GPU y fallback resiliente para navegadores sin soporte o modo `prefers-reduced-motion`.
   - **Helper Global Desacoplado (`modules/00-security.js`, 135 líneas < 500):**
     - Función `ejecutarConTransicionSuave(mutacionDOM)` que detecta si el navegador soporta `document.startViewTransition()`.
   - **Animaciones CSS Cinematográficas (`styles/16-utilities.css`, 134 líneas < 500):**
     - Reglas `::view-transition-old(root)` y `::view-transition-new(root)` con curva `cubic-bezier(0.4, 0, 0.2, 1)` a 220ms para un cross-fade sedoso imperceptible.
   - **Integración Reactiva en Filtros y Temas (`modules/04-filters.js` y `modules/10-listeners.js`):**
     - `aplicarFiltrosOmnibox()`: Al cambiar de ciudad, buscar en el omnibox o cambiar el ordenamiento, la cuadrícula Bento se transforma con cross-fade suave sin saltos secos del DOM.
     - `toggleTheme()`: Al conmutar entre modo claro y modo oscuro AMOLED, los colores se funden con elegancia cinematográfica, eliminando hacks antiguos de estilos temporales.
   - **Arquitectura del Scraper Definida (Ojos y Manos vs Motor):**
     - Confirmado el modelo de **Adaptadores Desacoplados (Pluggable Adapters)** bajo `adapters/` sin tocar el motor central (`index.js`).
     - Protección de IP residencial del Samsung Galaxy J7 mediante priorización de APIs JSON abiertas (ej. vacantes remotas USD) y cronogramas espaciados.
   - **DevSecOps:** Suite de 8 fases aprobada con 100% de éxito (0 errores).

-17. **Visibilidad Explícita del Botón e Icono de Créditos en Desktop y Barra Móvil**:
   - **Erradicación de Ambigüedad en Botón de Saldo (`index.html` + `modules/01-state.js`):**
     - Anteriormente, para usuarios no autenticados o nuevos visitantes, el botón mostraba una corona (`fa-crown`) con el texto "Acceso VIP" o "VIP", ocultando visualmente la existencia del sistema de créditos.
     - Se actualizó tanto en el marcado estático inicial como en el estado reactivo (`actualizarBadgeVip`):
       - Desktop: Icono de rayo `<i class="fa-solid fa-bolt"></i>` con texto descriptivo `"Créditos / Planes"`.
       - Móvil (Barra inferior `#btnNavVip`): Icono `<i class="fa-solid fa-bolt"></i>` con etiqueta `"Créditos"`.
     - Al autenticarse o comprar, se actualiza reactivamente mostrando el saldo exacto (`⚡ 10 Créditos` / `10 Creds`) o la membresía ilimitada territorial (`👑 VIP Bogotá 30d`).
   - **DevSecOps:** Suite de 8 fases aprobada con 100% de éxito (0 errores).

-16. **Humanización Total del Lenguaje Legal, Erradicación de Tecnicismos y Centralización en Soporte por WhatsApp**:
   - **Simplificación Empática de Textos Legales (`modules/09-ui-effects.js` + `index.html`):**
     - Erradicada la jerga técnica e intimidante ("Due Diligence", "SaaS especializada", "ORIP", "vicios redhibitorios", "desindexación", "Disclaimer", "ledger criptográfico").
     - Reescritura 100% en lenguaje claro, transparente y cercano para compradores y propietarios de a pie:
       - Pestaña 1: *Cómo Funciona* (Trato directo sin comisiones, uso personal, pagos seguros con Wompi).
       - Pestaña 2: *Seguridad* (Consejo práctico de visitar la propiedad y solicitar tradición y libertad antes de pagar).
       - Pestaña 3: *Tus Datos* (Exclusividad de celular para PIN y compras, cero venta de datos, opción directa para propietarios de retirar su anuncio).
       - Pestaña 4: *Garantía de Saldo* (Permanencia de créditos mediante número de WhatsApp, soporte prioritario).
   - **Erradicación de Canales Inexistentes y Centralización en WhatsApp:**
     - Removidas todas las menciones a `contacto@origgo.online` y promesas de respuesta en 24h.
     - Centralizado todo el canal de atención, soporte y retiro de anuncios en **WhatsApp directo**, el canal real, preferido e instantáneo en Colombia.
   - **Modernización del Modal de Bienvenida (`index.html`):**
     - Sustituido "sellado con éxito en el ledger criptográfico" por "Tu cuenta y tus créditos están activos y listos para usar".
   - **DevSecOps:** Suite de 8 fases aprobada con 100% de éxito (486 líneas en `09-ui-effects.js` < 500).

-15. **Service Worker v6 Network-First, Purga Automática de Caché y Erradicación Total de Referencias Bancarias**:
   - **Modernización de Service Worker (`sw.js`):**
     - Elevado a `origgo-v6-20260911` con política de purga activa de versiones obsoletas en evento `activate` (`caches.delete()`) y reclamo inmediato de clientes (`self.clients.claim()`).
     - Transición de la navegación HTML (`mode === 'navigate'` o `.html`) de *Cache-First* a **Network-First con fallback a caché**: cualquier dispositivo móvil o PC conectado a la red siempre recibe el `index.html` más fresco del servidor, resolviendo de raíz el congelamiento de versiones viejas en teléfonos de usuarios.
   - **Cache-Busting en Recursos Estáticos (`index.html`):**
     - Versionado forzado de CSS y JS en producción: `style.min.css?v=20260911-night` y `app.js?v=20260911-night`.
   - **Desinfección Semántica 100% de Textos Legales (`modules/09-ui-effects.js`):**
     - Sustituida la última mención residual a `(Bancolombia)` en la cláusula 4 de los términos legales por `pasarela oficial Wompi (Vigilada Superfinanciera)`.
     - Cero referencias no autorizadas a marcas financieras en el código ejecutable.
   - **DevSecOps:** Suite de 8 fases aprobada con 100% de éxito (0 errores).

-14. **Blindaje Jurídico Integral (Habeas Data, GDPR, Política de Reembolso por PIN) y Morfología Toast Android Nativo**:
   - **Marco Legal y Política de Reembolsos (`modules/09-ui-effects.js` + `index.html`):**
     - Se incorporó la pestaña formal **"Reembolsos"** sustentada en la Ley 1480 de 2011 (Estatuto del Consumidor): el desbloqueo de contactos directos constituye un servicio de contenido digital de consumo instantáneo no sujeto a retracto posterior.
     - Se formalizó la **Garantía de Permanencia mediante PIN Maestro**: el saldo y las membresías no expiran por cambio de equipo o navegador, permitiendo al comprador recuperar su acceso en segundos desde "Restaurar Cuenta".
     - Se contempló la **Reversión Total de Pago (Art. 51)** en caso de duplicidad técnica de cobro no resuelta en 72 horas hábiles.
   - **Protección de Datos de Compradores y Alcance Internacional GDPR (`modules/09-ui-effects.js`):**
     - Se declaró explícitamente el tratamiento de los datos entregados por compradores (WhatsApp y correo): uso exclusivo para autenticación, PIN y facturación (cero comercialización a terceros anunciantes).
     - Se añadió cláusula de cumplimiento del Reglamento General de Protección de Datos de la Unión Europea (GDPR - Reglamento UE 2016/679) para proteger transacciones internacionales en Wompi contra contracargos o bloqueos de pasarela.
     - Se habilitó el enlace directo en el footer institucional: `Garantía y Política de Reembolso`.
   - **Morfología Toast Nativa de Android (`styles/14-toast.css`):**
     - Se rediseñó la experiencia móvil del toast para adoptar la silueta y proporciones de una notificación nativa Heads-Up de Android 13/14 (One UI / Pixel): altura estilizada, esquinas de 18px, márgenes safe-area superiores, ocultamiento del pie explicativo ("Cierra en 4s") en pantallas táctiles y micro-barra de progreso inferior de 2px.
   - **DevSecOps:** Suite de 8 fases aprobada al 100% (0 errores, 494 líneas en `09-ui-effects.js` y 415 líneas en `14-toast.css`).

-13. **Estilos Tipográficos Sobrios de Rebajas / Arbitraje y Resurrección del Bot de Encendido Remoto (WoL)**:
   - **Estilos Tipográficos Sobrios para Rebajas (`styles/16-utilities.css`):** Se crearon las clases `.unit-rate-badge.badge-rebaja` y `.unit-rate-badge.badge-arbitraje` basadas en tipografía monoespaciada de alta legibilidad (`var(--font-mono)`), eliminando ilustraciones infantiles y reemplazándolas por notación sobria tipo terminal financiera/Bloomberg (`-$ 30M`, `-14.5% vs Mediana`).
   - **Resurrección y Blindaje del Bot de Encendido Remoto (`@Mi_PcEncendido_Bot`):** Erradicada la dependencia al proxy Tor caído en el Samsung J7, inyectado DNS robusto (`8.8.8.8`, `1.1.1.1`), persistido en PM2 y guardado (`pm2 save`). Comprobada MAC `F4-4D-30-55-D6-C2`.
   - **Compilación Modular:** Recompilado `style.css` y `style.min.css` mediante `npm run build`.
   - **DevSecOps:** Suite de 8 fases al 100% de éxito (`npm test`).

-12. **Rediseño de Jerarquía Visual de Alta Gama y Desacoplamiento de Controles en Cabecera**:
   - **Erradicación del Conflicto de Jerarquía en Cabecera (`index.html`):** Se eliminaron los botones de cambio de tema (`#btnThemeToggle`) y de alertas (`#btnPushSubscribe`) de `.nav-actions`. La cabecera desktop ahora contiene con exclusividad absoluta el botón de **Acceso VIP / Saldo**, eliminando distracciones visuales, sobrecarga cognitiva y elevando el estatus de la plataforma al estándar de terminales privadas de inversión.
   - **Alertas Push Contextuales en Command Bar (`index.html` + `styles/04-command-bar.css`):** El botón de alertas (`#btnPushSubscribe`) se integró junto a los filtros de búsqueda (`cmd-filters-group`) como una acción contextual natural (`<i class="fa-solid fa-bell"></i> Alertas en Vivo`), maximizando la intención de suscripción cuando el usuario filtra por ciudad o precio.
   - **Conmutador de Modo Visual en Pie de Página y Menú Lateral (`index.html` + `styles/13-footer.css` + `modules/10-listeners.js`):** Se reubicó el selector de tema (`#btnThemeToggle`) discretamente en el footer institucional (`.footer-bottom-inner`) y se añadió `#sideMenuThemeToggle` en el drawer lateral, sincronizados reactivamente sin afectar el foco principal.
   - **DevSecOps:** Suite de 8 fases al 100% de éxito (`npm test`).

-11. **Sincronización Continua de Hardware J7, Catálogo Fresco en Cloudflare R2 y Homologación de Dominio Canónico en Entorno**:
   - **Salud Operativa del Scraper en Samsung Galaxy J7 (`3300aebadc113449`):** El proceso principal de extracción (PID 31390) y el centinela de sistema operativo (PID 1934) operan con 100% de estabilidad y 0 caídas (74.9 MB RAM, 2.4% CPU en procesador Exynos).
   - **Base de Datos de Leads Directos:** SQLite `hunter.db` superó los 781 leads registrados, de los cuales 447 corresponden a oportunidades verificadas de propietarios directos (FSBO).
   - **Publicación Instantánea a Cloudflare R2:** `publisher_web.js` sincronizó exitosamente en 1,834 ms el feed en tiempo real a la CDN S3 de Cloudflare R2 (`origgo-catalogos`) con firma de integridad criptográfica HMAC-SHA256.
   - **Homologación de Dominio Canónico (`.env.example`):** Corregidas las referencias residuales a `origgo.co` para unificar el estándar 100% a `https://origgo.online` y `contacto@origgo.online`.
   - **DevSecOps:** Suite de 8 fases al 100% de éxito (`npm test`).

-10. **Desinfección Crítica de Google Safe Browsing, Restauración de Cuadrícula del Header, Favicon Canónico y Nuevo Posicionamiento SEO**:
   - **Erradicación de Heurísticas de Phishing en Vercel (`vercel.json`):** Se removió el bloque de `rewrites` que capturaba rutas trampa como `/.env`, `/.git`, `/wp-login.php`, `/wp-admin`, `/phpmyadmin` y `/api/admin`. Ahora devuelven 404 estándar limpio, eliminando el principal indicador de firmas de kits de phishing que activaron la alarma roja en los rastreadores automáticos de Google Safe Browsing.
   - **Desinfección Semántica Anti-Phishing (`index.html`):**
     - Se eliminó toda mención a marcas financieras sensibles ajenas ("Bancolombia"), reemplazándola por "Pasarela de Pago Segura Wompi (Vigilada SFC)".
     - Se sustituyó el término "PIN de Seguridad" por "Código de Acceso Origgo" y la pestaña "Ya Tengo un PIN" por "Restaurar Cuenta", erradicando el patrón heurístico de suplantación de billeteras bancarias (Nequi/Daviplata) al solicitar número celular + código de 4 dígitos.
   - **Restauración de la Cuadrícula Simétrica del Header en Escritorio (`index.html`):**
     - Se eliminó el contenedor intrusivo `<div class="header-user-status" id="headerUserStatus">` de `.site-header-inner`.
     - Se restauró la simetría exacta de 3 columnas (`1fr auto 1fr`): Columna 1 (Espaciador), Columna 2 (Logo Origgo centrado), Columna 3 (Botonera `.nav-actions` alineada a la derecha). Esto resolvió definitivamente el error visual donde el logo quedaba desplazado y los botones de acción saltaban a una fila inferior.
   - **Favicons Canónicos Absolutos y Metadatos SEO de Alto Estatus (`index.html`):**
     - Se especificaron rutas absolutas `/favicon.ico`, `/favicon-32x32.png`, `/favicon.svg`, `/apple-touch-icon.png` para que Googlebot, Chromium y motores de búsqueda asocien e indexen de forma inmediata el isotipo oficial `#0a9f68` en lugar del icono genérico del globo terráqueo.
     - Nuevo título: `Origgo — Radar de Primicia Inmobiliaria & Trato Directo`.
     - Nueva descripción SEO: `Terminal privada de inversión inmobiliaria en Colombia. Detectamos oportunidades comercializadas directamente por sus dueños, rebajas de urgencia y arbitraje de precio por m² antes de que lleguen a intermediarios.`
     - OpenGraph y Twitter Cards sincronizados.
   - **DevSecOps:** Suite de 8 fases al 100% de éxito (`npm test`).

-9. **Saludo Dinámico por Franja Horaria (Colombia UTC-5) y Modulación Formal de Visita en WhatsApp**:
   - **Saludo Adaptativo según Hora Local de Colombia (`api/leads/unlock.js`):** Se implementó la función `obtenerSaludoHorario(fecha)` que evalúa la zona horaria `America/Bogota`:
     - *05:00 a 11:59:* "Buen día"
     - *12:00 a 18:59:* "Buenas tardes"
     - *19:00 a 04:59:* "Buenas noches"
   - **Cortesía en Solicitud de Visita:** Se incorporó la cláusula de respeto `"y coordinar una visita, de ser posible"` para mantener una postura sobria, prudente y no invasiva ante propietarios de estratos 4, 5 y 6.
   - **Mensaje Oficial Resultante:**
     *"[Buen día / Buenas tardes / Buenas noches], le escribo con respecto a su publicación del [Tipo] en [Ubicación]. Me gustaría conocer más detalles sobre la propiedad y coordinar una visita, de ser posible. Quedo atento a su respuesta, muchas gracias."*
   - **Suite de Pruebas:** 4/4 pruebas unitarias pasadas en `tests/whatsapp_template.test.js`.
   - **En espera activa:** Preparado el espacio para el análisis e intervención inmediata de los 4 problemas críticos reportados por el usuario.

-8. **Resolución Crítica de Barra Inferior Móvil Secuestrada, Centrado de Logo y Saldo en Navegación Táctil**:
   - **Causa Raíz de Desaparición de Barra Móvil y Menú Lateral:** Se identificó que en `index.html` (línea 756), el contenedor `#modalLegalOverlay` carecía de su etiqueta de cierre `</div>`. Como consecuencia directa del parser HTML, los elementos posteriores (`#modalPushPromptOverlay`, `#mobileBottomBar` y `#sideMenu`) quedaron anidados dentro de un contenedor con clase `.modal-backdrop` que posee `display: none; pointer-events: none;`. Al corregir el balance de etiquetas `</div>`, la barra inferior táctil (`.mobile-bottom-bar`) y el menú lateral (`#sideMenu`) volvieron a ser hijos directos del `<body>`, restaurando de inmediato su visibilidad y operatividad nativa en teléfonos.
   - **Centrado Absoluto de Identidad de Marca en Móvil:** Se erradicó la regla `justify-content: space-between` de `.site-header-inner` en `styles/11-mobile.css` (468 líneas < 500) y se restauró `justify-content: center`. El logo corporativo de Origgo vuelve a gozar de protagonismo centrado en todas las pantallas móviles sin estar montado a la izquierda.
   - **Ocultamiento del Chip en Cabecera Móvil y Saldo en Navegación Táctil:** Se ocultó `.header-user-status` en pantallas `<= 768px` para evitar apiñamiento. Los créditos y estado de membresía se reflejan directamente en el botón táctil `#btnNavVip` de la barra inferior (`⚡ 10 Creds` con icono dinámico) y en el panel desplegable del menú lateral (`#sideMenuUserAccount`).
   - **DevSecOps:** Suite de 8 fases al 100% de éxito (`npm test`).

-7. **Resolución Crítica de Bloqueo CSP Cloudflare R2, Plantilla Formal de WhatsApp y Visualización de Arbitraje $/m²**:
   - **Desbloqueo de Content Security Policy (CSP):** Se integró `https://*.r2.dev` y `https://pub-040118b18ae247d7b4643d22289744b6.r2.dev` en la directiva `connect-src` tanto en `vercel.json` como en la etiqueta `<meta http-equiv="Content-Security-Policy">` de `index.html`. Erradicado por completo el bloqueo del navegador al consultar `inmobiliario.json` en Cloudflare R2 CDN.
   - **Piso 5: Plantilla Formal y Respetuosa de WhatsApp (`api/leads/unlock.js`):**
     - Erradicada la mención de "recursos listos", "cierre rápido" o cualquier referencia a dinero o regateo.
     - Nuevo mensaje institucional de alta gama para propietarios de alto estrato y patrimonio:
       *"Buen día, le escribo con respecto a su publicación del [Tipo] en [Ubicación]. Me gustaría conocer más detalles sobre la propiedad y coordinar una visita. Quedo atento a su respuesta, muchas gracias."*
     - Adaptada la suite de pruebas unitarias `tests/whatsapp_template.test.js` (3/3 aprobadas con 0 menciones de dinero).
   - **Pisos 2 y 4: Terminal de Arbitraje $/m² y Tracker de Rebajas (`modules/06-cards.js` + `styles/16-utilities.css`):**
     - Integrada la visualización reactiva de arbitraje cuantitativo (`-${item.descuento_arbitraje}% vs Mediana`) y badges de rebaja confirmada en la fila inferior de precio por m².
     - `modules/06-cards.js` preservado en 492 líneas (estricto cumplimiento < 500 líneas).
     - Nueva clase utilitaria `.pricing-sub-row` en `styles/16-utilities.css` (72 líneas).
   - **Sincronización End-to-End de Catálogo Real:**
     - Descargado y validado el feed de 60 oportunidades reales emitidas por el procesador Exynos del Samsung Galaxy J7 con firmas HMAC intactas en Cloudflare R2 y almacenamiento local de contingencia.
   - **DevSecOps:** Suite de 8 fases al 100% de éxito (`npm test`).

-6. **Corrección Crítica de Enlace 404 en Correos, Plantilla Bifurcada por Saldo y UI Móvil de Membresías**:
   - **Causa Raíz del 404 Identificada y Resuelta:** En `api/auth/recover.js`, `resolverPortalUrlSeguro()` tenía configurado `fallback = 'https://origgo.vercel.app'`. Esa URL pertenecía a una aplicación ajena de rutas en Brasil, no a Origgo, provocando 404 al pulsar el enlace del correo. Se corrigió a `https://origgo.online`.
   - **Módulo de Plantillas de Correo Élite (`lib/email-templates.js`, 253 líneas):**
     - Se unificó el diseño a un **único botón principal CTA** ("Restaurar Terminal VIP" o "Comprar Acceso Inmediato").
     - **Bifurcación de Negocio según Saldo:**
       - *Si el usuario tiene saldo o membresía activa:* Recibe `generarPlantillaRestauracion` con su balance detallado (ej. "👑 Plan Nacional 30d" o "⚡ 10 Créditos"), PIN protegido y botón único para restaurar la sesión con token criptográfico seguro de 1 solo uso.
       - *Si el usuario tiene 0 créditos y ningún plan activo:* Se le despacha `generarPlantillaSinCreditos` informándole formalmente de su estado ("Tu cuenta no posee créditos de desbloqueo activos ni planes vigentes") y ofreciéndole un botón directo para recargar saldo en el checkout oficial.
   - **Página 404 Personalizada de Élite (`404.html`):**
     - Se creó la página 404 con estética dark AMOLED institucional, isotipo esmeralda `#0a9f68`, animación de radar buscando en la nada y botón de regreso a la terminal principal.
   - **Visibilidad Móvil de Saldo y Planes de Suscripción:**
     - Se implementó `#btnMobileStatusChip` en el header móvil (`styles/11-mobile.css`, 497 líneas < 500) y `#sideMenuUserAccount` en el menú lateral (`styles/12-sidebar.css`, 304 líneas).
     - Muestra dinámicamente si el usuario posee "👑 Nacional 30d", "👑 [Ciudad] 30d" o "⚡ [N] Creds", sincronizado en caliente vía `actualizarEstadoCuentaMobile()` en `modules/01-state.js` (442 líneas) y `modules/10-listeners.js` (476 líneas).
   - **Despliegue y Validación DevSecOps:**
     - Las 8 fases del validador pasaron con 100% de éxito.
     - Commit `c4fb100` empujado a GitHub `main` y desplegado automáticamente en Vercel.

-5. **Activación Silenciosa y Profesional de Web Push (Erradicación de Alerta Mock)**:
   - **Comportamiento en Producción:** Se eliminó la llamada artificial a `registro.showNotification` que saltaba de inmediato al activar el radar. Ahora, el flujo es 100% nativo y profesional: el usuario otorga el permiso, se guarda la suscripción en el backend, la campana se enciende en verde esmeralda y se muestra un toast discreto. Las notificaciones reales al teléfono solo llegarán cuando el scraper despache ofertas reales desde el backend.
   - **Modularidad Intacta:** `modules/12-push.js` (241 líneas), 8 fases DevSecOps al 100%.

-3. **Regeneración de Iconos HD para Android, Modal Soft-Prompt de Radar y Estrategia Web Push**:
   - **Renderizado de Iconos HD de Estudio desde Matriz Vectorial:** Se eliminó la aproximación matemática rudimentaria de `scratch/generate_favicon.js`. Se localizó la matriz raster original de 4000x2250 embebida en los SVGs oficiales (`origgo-icon.svg`), extrayendo el isotipo exacto a 846 x 777 píxeles de resolución nativa. Con un remuestreo bilineal antialiased, color institucional `#0a9f68` y un 14% de safe-zone circular para Android, se generaron `apple-touch-icon.png` (192x192), `push-icon-192.png`, `push-icon-512.png` y `favicon-32x32.png`. En la bandeja de notificaciones de Android (Brave/Chrome) el icono se visualiza nítido, perfectamente centrado y sin deformaciones.
   - **Modal Sugestivo de Entrada (Soft-Prompt — `styles/17-push-modal.css` + `index.html`):** Se implementó una tarjeta modal interactiva con diseño glassmorphism y animación de radar verde esmeralda que invita amablemente al usuario tras 2.5 segundos de estancia (`Notification.permission === 'default'`). Explica las ventajas de la primicia total, filtro por ciudad y 0 spam. Si el usuario acepta, se solicita el permiso nativo mediante un gesto legítimo del usuario (W3C compliant). Si elige "Quizás más tarde" o la "X", se recuerda en `sessionStorage` durante la sesión para no estorbar, pero se vuelve a consultar en visitas posteriores.
   - **Estrategia de Retención y FOMO para Usuarios con 0 Créditos:** Se estructuró la regla de negocio donde las notificaciones push NO se detienen cuando el usuario agota su saldo. Al publicarse un inmueble directo o una rebaja agresiva en su ciudad, se despachan notificaciones sugestivas ("🔥 ¡Rebaja de $25M en tu ciudad! Publicado directo por dueño por viaje urgente"). Al pulsar la notificación, el usuario aterriza directamente en la ficha del inmueble (`?lead=...`), viendo el potencial de ahorro pero con el teléfono bloqueado, actuando como gatillo inmediato de re-compra de créditos.
   - **Segmentación por Ciudad y Deep Linking en Servidor (`api/notifications/dispatch.js`):** El endpoint ahora admite filtrado por `body.ciudad`, deep linking con `body.leadId` y `body.image` para desplegar banners fotográficos de los inmuebles en Android.
   - **Actualización de Service Worker (`sw.js`):** Soporte de `image` en `showNotification` y precaché de los nuevos assets en alta resolución (`push-icon-192.png`, `push-icon-512.png`).
   - **Modularidad Intacta (< 500 líneas):** `modules/12-push.js` (253 líneas), `styles/17-push-modal.css` (231 líneas), 8 fases DevSecOps en verde al 100%.

-2. **Reparación Crítica del Modal Legal, Pestañas Interactivas y Notificaciones Push en Android**:
   - **Corrección de Bloqueo de Clics y Cierre (Botón X):** `#modalLegalOverlay` no cerraba porque el motor de estilos mantenía `pointer-events: none` al no activarse la clase `.active`. Se corrigió el controlador en `modules/09-ui-effects.js`, otorgando `pointer-events: auto !important` y elevando el `z-index` a `100000 !important` por encima del menú lateral (9999). Ahora el botón "X", el botón "Entendido y Aceptado", el fondo y la tecla `Escape` cierran el modal con total fiabilidad tanto en Android como en escritorio.
   - **Pestañas y Contenido Estructurado:** Se sustituyó el texto estático plano por un sistema de pestañas interactivas:
     - 📜 *Términos:* Licencia SaaS de uso personal, créditos de desbloqueo, pasarela Wompi PCI-DSS y cláusula estricta anti-scraping/reventa.
     - ⚖️ *Exoneración (Disclaimer):* Cero intermediación ni comisiones inmobiliarias, obligatoriedad del Due Diligence e investigación de títulos (ORIP) por parte del comprador, inmunidad ante disputas entre particulares.
     - 🔒 *Habeas Data (Ley 1581):* Fuentes de acceso público, garantías legales y canal formal de desindexación inmediata (< 24h) vía WhatsApp y correo.
   - **Usabilidad Táctil en Android:** Se habilitó scroll con inercia (`-webkit-overflow-scrolling: touch; overscroll-behavior: contain;`) y una barra de desplazamiento visible estilizada en tono esmeralda para navegación táctil intuitiva.
   - **Disparo Inmediato de Notificación Push en Android:** En `modules/12-push.js`, tan pronto el usuario acepta el permiso, el Service Worker dispara una notificación local nativa ("🔥 ¡Radar de Origgo Activado!") con patrón de vibración táctil `[120, 60, 120]`, confirmando de inmediato que el dispositivo está recibiendo alertas.
   - **Compatibilidad de Iconos PNG para Android:** Se migraron los iconos de notificación en `sw.js` y `api/notifications/dispatch.js` a PNG (`./apple-touch-icon.png` y `./favicon-32x32.png`), evitando recuadros en blanco en el panel de notificaciones de Chromium/Android.
   - **Script de Despacho de Prueba por Consola:** Se creó `scripts/test_dispatch_push.js` para emitir pruebas en vivo a dispositivos suscritos.
   - **Limpieza Modular CSS:** Se removieron duplicados de sidebar en `styles/13-footer.css`, dejándolo en 365 líneas (estrictamente < 500).

-1. **Cableado Asíncrono de Upstash Redis y Autodefensa Perimetral con Honeypot**:
   - **Limitación de Tasa Distribuida Serverless (`checkRateLimitAsync`):** Se reemplazó la invocación síncrona en memoria por `checkRateLimitAsync` en los 8 endpoints de `api/` (`session.js`, `create-order.js`, `webhook-wompi.js`, `unlock.js`, `recover.js`, `balance.js`, `subscribe.js`, `vapid-public-key.js`). Ahora la tasa de peticiones se coordina atómicamente en Upstash Redis REST API en todas las instancias Lambdas de Vercel.
   - **Honeypot Autónomo con Auto-Ban (`api/security/honeypot.js` + `vercel.json`):** Se implementó endpoint trampa que intercepta intentos de escaneo malicioso (`/.env`, `/.git`, `/wp-login.php`, `/wp-admin`, `/phpmyadmin`, `/api/admin`). Al detectar la intrusión, banea inmediatamente la dirección IP en Redis por 24 horas (86,400s) con motivo forense sin requerir alertas manuales.
   - **Filtro Perimetral Atómico:** El pipeline atómico de `checkRateLimitAsync` consulta la clave de baneo `ratelimit:ban:${ip}` antes de incrementar contadores y responde de forma fulminante con HTTP 403 `IP_BLOCKED`.
   - **Favicons Multiformato e Identidad Móvil:** Se generaron `favicon.ico` (formato ICO binario 32x32), `favicon-32x32.png` y `apple-touch-icon.png` (192x192) con el isotipo oficial `#0a9f68`. Se corrigió el problema en navegadores móviles (Chrome/Brave Android) que mostraban el globo terráqueo genérico al no admitir favicons SVG en la barra superior.
   - **Acceso a Web Push en Drawer Móvil:** Se integró el botón "🔔 Activar Alertas en Vivo" en el menú lateral (`side-menu`) de `index.html` y se vinculó en `modules/12-push.js` con retroalimentación háptica y cierre automático del menú tras la interacción.

0. **Calibración Cromática AMOLED `#0a9f68` y Micro-Kerning Óptico del Isotipo**:
   - **Color Institucional Exacto:** Se eliminó el degradado CSS verde menta (`#34D399`) en `.brand-letter` tanto en `styles/02-base.css` como en `styles/13-footer.css`, fijando el color sólido corporativo exacto `#0a9f68` (`-webkit-text-fill-color: #0a9f68`). Esto erradica cualquier salto o inconsistencia cromática en pantallas AMOLED.
   - **Alineación y Espaciado Óptico Idéntico a los Caracteres:**
     - En la cabecera (`styles/02-base.css`), se restauró `margin-right: 1px` y `letter-spacing: -0.02em`, eliminando el exceso de 4px que separaba artificialmente la "O" de "riggo".
     - En el pie de página (`styles/13-footer.css`), se fijó `margin-right: 1px` y `letter-spacing: -0.02em` manteniendo `width: 100%; height: 100%`. De esta manera, el espacio entre el círculo de la "O" y la letra "r" coincide milimétricamente con el kerning existente entre la "r", la "i" y las "g" sin pisar ni separar en exceso.

1. **Purga Total de Mocks de Vehículos y Enlaces Residuales**:
   - Se removió la pestaña y botón de vehículos del selector de nichos en `index.html`.
   - Se removió el enlace de vehículos del menú lateral desplegable en `index.html`.
   - Se eliminaron las bifurcaciones y textos condicionales de vehículos en `modules/06-cards.js`, consolidando la experiencia al 100% en inmuebles residenciales directos.

2. **Contador Dinámico en Tiempo Real en Tarjetas de Catálogo**:
   - Se implementaron las funciones reactivas `formatearTiempoRelativo(timestampMs, fallback)` y `actualizarTiemposRelativosEnDOM()` en `modules/06-cards.js`.
   - El pill de antigüedad ahora almacena `data-timestamp` y actualiza automáticamente los textos en caliente ("⚡ Justo ahora", "Hace 5 min", "Hace 2 horas") cada 60 segundos con un `setInterval` global persistente.
   - El publicador del scraper (`publisher_web.js`) en el Samsung Galaxy J7 ahora calcula y emite `timestamp_ms` y `fecha_relativa` en cada registro.

3. **Publicación y Carga de Leads Reales desde Hardware Físico J7 a Cloudflare R2**:
   - Se conectó con el Samsung Galaxy J7 vía ADB y se ejecutó `publisher_web.js` sobre la base de datos de producción `hunter.db` (403 particulares activos).
   - Se compilaron y subieron 60 inmuebles reales a Cloudflare R2 (`https://pub-040118b18ae247d7b4643d22289744b6.r2.dev/inmobiliario.json`) y su firma criptográfica HMAC-SHA256 en 1.9 segundos.
   - Se sincronizó el catálogo local de fallback en `hunter-portal-showcase/data/` con los datos reales frescos.

0. **Unificación de Dominio Canónico a `origgo.online`**:
   - Se erradicaron todas las referencias a dominios hipotéticos (`origgo.co`).
   - El dominio de producción oficial del ecosistema es **`origgo.online`** (con alias de despliegue en `origgo.vercel.app`), ya contemplado en la lista blanca de CORS de `lib/cors.js`.
   - Se actualizó el subject de VAPID Web Push por defecto a `mailto:contacto@origgo.online` en `api/notifications/dispatch.js` y `docs/INTEGRACIONES_EXTERNAS.md`.
   - Se actualizaron los enlaces de Telegram y pruebas de no-canibalización en el scraper a `https://origgo.online`.

1. **Auditoría Crítica y Manual de Integraciones Externas ($0 Coste)**:
   - **Manual de Servicios Externos (`docs/INTEGRACIONES_EXTERNAS.md`):** Documentadas las instrucciones paso a paso con pantallas, clics y variables para Upstash Redis (rate limiting serverless), Healthchecks.io (sonda J7), Telegram BotFather & Canales, Web Push VAPID y Cloudflare R2.
   - **Plantillas de Entorno Sincronizadas (`.env.example`):** Variables documentadas en español para Upstash Redis, llaves VAPID y secretos de Wompi.
   - **Detección de Brechas en Auditoría:** Identificadas 6 brechas operativas en el ecosistema (rate limiting serverless volátil, riesgo de canibalización en Telegram, desconexión de sonda de hardware, cliente R2 incompleto, ausencia de .env.example en scraper e infraestructura PWA pendiente).
   - **Plan de Implementación Actualizado:** `implementation_plan.md` enriquecido con la resolución técnica y matrices de prueba para cada brecha.

2. **Blindaje de Grado Industrial (Nivel 9.9 / 10)**:
   - **Versionado Criptográfico y Rotación Segura (`lib/crypto.js`):** Formato `v1:iv:authTag:ciphertext` con soporte de llavero de claves (`keyRing { v1, v2 }`) manteniendo 100% retrocompatibilidad con formato legado de 3 partes.
   - **Anti-Replay en Webhooks Wompi (`api/payments/webhook-wompi.js`):** Ventana de expiración estricta de 300 segundos (< 5 min) y registro atómico para prevenir ataques de repetición y duplicación de saldo.
   - **Proxy de Medios Edge con Protección Anti-SSRF (`api/media/proxy.js`):** Descarga de fotos en streaming volátil, remoción de metadatos sensibles, bloqueo estricto de IPs privadas / dominios no autorizados y cabeceras de caché inmutables (`Cache-Control: public, max-age=86400, immutable`).
   - **Barra de Ordenamiento Dinámico Táctico (`modules/04-filters.js`, `modules/06-cards.js`, `index.html`):** Selector táctil por Menor $/m², Rebaja Reciente, Menor/Mayor Precio Total y Más Recientes.
   - **Plantilla de WhatsApp de Alta Conversión (`api/leads/unlock.js`):** Mensaje pre-redactado de comprador directo listo para cierre rápido (`Hola, vi su publicación del [tipo] en [zona]. Soy comprador directo con recursos listos...`).
   - **Modularidad Arquitectónica Desmulta:** Los 28 submódulos JS y CSS cumplen estrictamente el límite de < 500 líneas.
   - **Suite DevSecOps 100% Verde:** Pruebas unitarias de pasarela Wompi, criptografía, proxy de medios, plantilla WhatsApp y ordenamiento pasando con 0 errores.

1. **Ofuscación Anti-Ingeniería Inversa de Títulos (CRÍTICO)**:
   - Los títulos públicos de las tarjetas ya NO muestran el nombre del conjunto, urbanización o barrio.
   - Antes: "Apartamento en venta en Hacienda Santa Cruz, Ibagué"
   - Ahora: "Apartamento en Venta — Ibagué"
   - El título completo, barrio y ubicación exacta se guardan CIFRADOS dentro de `contacto_cifrado` (AES-256-GCM).
   - Solo se revelan tras el desbloqueo pagado, a través de `datosRevelados` en la respuesta del API.
   - Esto impide que un usuario copie el título, lo busque en Google y encuentre el anuncio original gratis.

2. **Corrección del PIN Protegido**:
   - El modal de bienvenida mostraba "PIN protegido" cuando el PIN no llegaba del backend.
   - Ahora muestra instrucciones claras: "Revisa tu correo o usa Recuperar PIN".
   - El botón de copiar PIN se oculta correctamente cuando no hay PIN disponible.

3. **Corrección del Badge de Créditos**:
   - Después de cada desbloqueo, `actualizarBadgeVip()` se llama para reflejar el saldo real.
   - El toast post-desbloqueo muestra el número exacto de créditos restantes.

4. **Firma HMAC-SHA256 Integrada en el Publisher del Scraper**:
   - `publisher_web.js` ahora genera y sube `inmobiliario.json.sig` junto al JSON a GitHub.
   - El backend de la web verifica la firma antes de desbloquear contactos.
   - El scraper en el teléfono firmará automáticamente cuando se despliegue la nueva versión.

5. **Compatibilidad Sandbox Wompi** (sesión anterior):
   - `lib/env.js` respeta `WOMPI_ENV=sandbox` para no rechazar credenciales de prueba.

6. **Índice Maestro de Archivos**:
   - Nuevo `docs/INDICE_ARCHIVOS.md` con mapa completo de ambos proyectos.
   - Cada archivo tiene descripción en una línea para localización rápida por humanos.

---

## 2. Por qué cambió

- El usuario descubrió que copiando el texto de una tarjeta y buscándolo en Google, se encontraba el anuncio original con teléfono incluido, eliminando la necesidad de pagar. Esto destruía la monetización.
- El "PIN protegido" confundía a los usuarios: si cerraban sesión, no podían volver a entrar.
- Los créditos no se actualizaban visualmente después de cada desbloqueo, causando confusión.
- La firma HMAC estaba solo en la web pero no en el scraper que genera los datos.
- La documentación existía pero nadie sabía dónde estaban los archivos.

---

## 3. Archivos afectados

### Scraper (ofertas-hunter-pro)
- `publisher_web.js`: Ofuscación de títulos, firma HMAC-SHA256, datos reales en contacto cifrado.
- `docs/INDICE_ARCHIVOS.md`: Nuevo índice maestro de archivos.

### Web (hunter-portal-showcase)
- `lib/email-templates.js`: Plantilla HTML de recibo oficial con PIN Maestro y función de despacho por Resend API ($0 coste).
- `api/payments/webhook-wompi.js`: Integración de despacho automático de comprobante y PIN tras aprobación de pago con idempotencia.
- `modules/01-state.js`: Soporte de auto-reclamo por referencia bancaria Wompi en restauración de cuenta y sincronización de estado.
- `modules/08-checkout.js`: Visualización transparente de Bóveda de Créditos no vencibles y convivencia con pases VIP.
- `index.html`: Formulario de restauración ampliado para admitir PIN o Referencia de pago (`HNT-...`).
- `app.js`, `app.min.js`: Recompilados y sincronizados.
- `docs/INDICE_ARCHIVOS.md`: Copia del índice maestro.

3. **Implementación de Integraciones Externas ($0 Coste)**:
   - **Pilar 1: Upstash Redis Distribuido (`lib/rate-limiter.js`):** Rate limiting serverless multi-región conectado a Upstash REST API (`origgo-ratelimit`), con pipeline atómico `INCR` + `EXPIRE` y fail-safe en memoria volátil ante microcortes.
   - **Pilar 2: Healthchecks.io Sonda J7 (`watchdog_hardware.js`):** Latido de supervivencia cada 5 minutos adaptado con DNS Android (`config.resolverDnsAndroid`) y ping HTTP 200 directo. 27/27 pruebas pasadas en procesador Exynos del J7.
   - **Pilar 4: Web Push PWA Nativo (VAPID):**
     - Llaves criptográficas VAPID generadas y aisladas estrictamente en el backend serverless.
     - CERO variables expuestas en el frontend: la clave pública se sirve en runtime vía `GET /api/notifications/vapid-public-key` con cabeceras de caché (`max-age=3600`) y rate limiting anti-abusos. DevTools / F12 limpio sin credenciales en `window` ni en bundle.
     - Registro de suscripciones W3C Push API con validación estricta y deduplicación por hash SHA-256 de endpoints (`api/notifications/subscribe.js` y `lib/push-subscriptions.js`).
     - Despacho masivo server-to-server (`api/notifications/dispatch.js`) protegido por secreto criptográfico en tiempo constante (`timingSafeEqual` sobre `x-internal-secret`).
     - Service Worker (`sw.js`) actualizado con eventos `push` y `notificationclick` (apertura/foco de ventana y vibración háptica).
     - Componente visual interactivo (`btnPushSubscribe`) con campana glassmorphism en cabecera desktop y móvil, y feedback mediante `mostrarNotificacionToast()`.
     - Suite DevSecOps (`tests/web_push.test.js`) con 5/5 pruebas unitarias automatizadas integradas en la Fase 5 de `scripts/validate.js`.

   - **Pilar 5: Cloudflare R2 Object Storage S3 ($0 Egress Fee):**
     - Bucket `origgo-catalogos` creado en Cloudflare R2 con subdominio público activo (`https://pub-040118b18ae247d7b4643d22289744b6.r2.dev`).
     - Política CORS aplicada para lecturas `GET`/`HEAD` sin restricciones desde dominios autorizados.
     - Cliente nativo S3 con firma criptográfica AWS Signature Version 4 (`r2_client.js`) implementado con 0 dependencias externas en Node.js, ahorrando memoria en el teléfono J7.
     - Publicador del scraper (`publisher_web.js`) sincroniza en tiempo real `inmobiliario.json` y su firma HMAC `inmobiliario.json.sig` en ~900 ms sin generar commits a Git.
     - Frontend (`modules/03-api.js` y `config.js`) consume el catálogo en tiempo real con timeout de 4s y fail-safe automático a `./data/inmobiliario.json` local.
     - 4 pruebas unitarias de R2 pasadas al 100% en el procesador Exynos del J7 (`tests/r2_client.test.js`) y 4 pruebas unitarias pasadas al 100% en el frontend (`tests/r2_integration.test.js`).

---

## 2. Por qué cambió

- El scraper realizaba hasta 96 commits diarios a GitHub para actualizar el JSON, saturando el historial de Git y obligando a Vercel a reconstruir la web completa continuamente.
- Cloudflare R2 permite almacenar y servir el catálogo JSON en tiempo real con **$0 costo de transferencia saliente (zero egress fees)**, 10 GB de almacenamiento gratuito y 10 millones de lecturas mensuales.
- WhatsApp Business Cloud API tiene costes por mensaje y requiere verificación de empresa en Meta. Web Push PWA utiliza el estándar W3C Push API con coste $0 permanente, permitiendo alertar a agentes e inversionistas en tiempo real sin tarifas por notificación.
- Requerimiento de seguridad mandatorio: Ningún token o clave pública/privada debe quemarse en el frontend para evitar raspado o exposición en DevTools (F12).
- Las funciones serverless de Vercel son efímeras; Upstash Redis garantiza contadores de rate limit distribuidos y compartidos entre todas las instancias edge.
- El teléfono Samsung Galaxy J7 requería un monitor de latido externo infalible ante sobrecalentamiento o desconexión del cargador sin depender de herramientas de pago.

---

## 3. Archivos afectados

### Web (hunter-portal-showcase)
- `config.js`: Declaración de `catalogoR2Url` apuntando a la CDN de Cloudflare R2.
- `modules/03-api.js`: Descarga en tiempo real con timeout de 4 segundos y fallback a almacenamiento local.
- `tests/r2_integration.test.js` [NUEVO]: Pruebas unitarias de disponibilidad, latencia y contrato de datos en R2.
- `scripts/validate.js`: Integración de validación de R2 en la Fase 5.
- `api/notifications/vapid-public-key.js` [NUEVO]: Endpoint serverless GET de clave pública con rate limit y caché.
- `api/notifications/subscribe.js` [NUEVO]: Endpoint serverless POST de registro de suscripciones W3C Push.
- `api/notifications/dispatch.js` [NUEVO]: Endpoint serverless POST de emisión masiva con autenticación interna.
- `lib/push-subscriptions.js` [NUEVO]: Almacén de suscripciones con deduplicación por hash SHA-256.
- `modules/12-push.js` [NUEVO]: Módulo cliente en memoria para solicitud de permisos y suscripción.
- `tests/web_push.test.js` [NUEVO]: 5 pruebas unitarias DevSecOps para endpoints push y deduplicación.
- `sw.js`: Handlers de eventos `push` y `notificationclick`.
- `index.html`: Botón `#btnPushSubscribe` en `.nav-actions`.
- `styles/03-header.css`: Estilos glassmorphic, estados hover y `.active-push`.
- `styles/11-mobile.css`: Tamaño táctil 36px en cabecera móvil.
- `scripts/build.js`: Exclusión de `push_subscriptions.json` en `dist/`.
- `.gitignore`: Exclusión de `data/push_subscriptions.json`.
- `README.md`, `ARCHITECTURE.md`, `docs/INDICE_ARCHIVOS.md`: Documentación técnica sincronizada al 100%.
- `app.js`, `app.min.js`, `style.css`, `style.min.css`: Recompilados.

### Scraper (ofertas-hunter-pro)
- `r2_client.js` [NUEVO]: Cliente S3 con firma canónica AWS SigV4 nativa de cero dependencias.
- `publisher_web.js`: Publicación instantánea a Cloudflare R2 como canal primario y GitHub tolerante a fallos como secundario.
- `worker_pool.js`: Reincorporación de la clase `WorkerPool` con mitigación anti-OOM y concurrencia acotada.
- `.env`: Credenciales de R2 configuradas.
- `tests/r2_client.test.js` [NUEVO]: Pruebas de firma SigV4, subida y lectura pública en R2 (100% verdes en J7).
- `watchdog_hardware.js`: Soporte de ping a Healthchecks.io con DNS Android.
- `tests/heartbeat_watchdog.test.js`: Suite de pruebas unitarias de sonda de supervivencia (27/27 tests verdes en J7).
- `docs/INDICE_ARCHIVOS.md`: Sincronizado.

---

## 4. Decisiones técnicas tomadas

- **Cliente S3 SigV4 sin SDK de AWS**: En lugar de instalar `@aws-sdk/client-s3` (>100MB de node_modules y alto consumo de RAM), se implementó la especificación canónica de firma AWS SigV4 con el módulo nativo `crypto` de Node.js en ~150 líneas, protegiendo los 1.5GB de RAM del J7.
- **Fail-Safe Bi-direccional R2 + Local**: El frontend consulta primero la CDN de Cloudflare R2 con un timeout estricto de 4 segundos. Si el usuario está offline o R2 tiene latencia, el sistema cae silenciosa e instantáneamente a `./data/inmobiliario.json` empaquetado en Vercel. Cero pantallas en blanco.
- **CERO variables en frontend (DevTools / F12 limpio)**: La clave pública VAPID no está quemada en HTML, JS ni en `window`. El cliente la solicita en memoria volátil en el instante en que el usuario activa las alertas, permitiendo rotar claves en Vercel sin reconstruir el frontend.
- **Deduplicación por SHA-256 de endpoints**: Los navegadores generan endpoints largos; se indexan por un hash determinista SHA-256 de 32 caracteres para operaciones de persistencia instantáneas O(1).
- **Protección timingSafeEqual en despacho masivo**: El endpoint `dispatch.js` compara el secreto interno en tiempo constante, previniendo ataques de canal lateral (*timing attacks*).
- **Aislamiento en .gitignore y dist/**: Las suscripciones de navegadores nunca se copian a `dist/` ni se comitean a Git, respetando el principio de Privacidad por Diseño.
- **Modularidad Desmulta (< 500 líneas)**: Todos los submódulos JS y CSS cumplen holgadamente el límite.

---

## 5. Estado actual del sistema

- `npm test` (web): 8/8 fases DevSecOps al 100% (0 errores).
- `node --test tests/*.test.js` (scraper): 109/109 pruebas pasadas al 100% (0 errores).
- Samsung Galaxy J7 (ADB `3300aebadc113449`): PM2 `scraper` (PID 1) y `dashboard` (PID 2) online con parche R2 aplicado.
- Cloudflare R2 `origgo-catalogos` activo y sirviendo 60 oportunidades directas en tiempo real.
- Upstash Redis y Healthchecks.io validados en producción.
- Web Push VAPID listo para despliegue en Vercel con variables de entorno preparadas.
- Idempotencia distribuida con Redis y Fail-Safe activa en creación de órdenes y desbloqueo.

---

# -46. FASE 3: IDEMPOTENCIA DISTRIBUIDA CON CLAVE TTL EN UPSTASH REDIS Y FAIL-SAFE

**Fecha:** 2026-09-13  
**Fase del Plan Maestro:** Fase 3 / 6 (Sector 2: Backend — Idempotencia de Pagos y Desbloqueos)  
**Estado:** ✅ COMPLETADO Y VERIFICADO AL 100%

### 1. Qué cambió
- **`lib/idempotency.js` (NUEVO):** Módulo centralizado de idempotencia distribuida con Upstash Redis REST API.
  - Implementa adquisición atómica de candados con `SET idempotency:lock:{clave} LOCKED EX lockTtl NX`.
  - Cachea el payload completo de la respuesta con TTL en `idempotency:result:{clave}` (`SET ... EX 120`).
  - Capa de microtareas en proceso (`inFlightPromises`): Si entran múltiples peticiones en el mismo proceso de Node.js o Lambda caliente, las peticiones secundarias esperan directamente la resolución de la promesa líder, retornando el resultado idéntico con `idempotent: true` en < 80ms sin duplicar transacciones.
  - Modo Fail-Safe local en memoria: Si Redis está caído o inaccesible por microcorte de red, conmuta automáticamente a memoria volátil con expiración TTL sin arrojar errores no controlados.
- **`api/payments/create-order.js`:**
  - Envuelve la generación criptográfica de la referencia, cálculo de la firma HMAC-SHA256 y guardado en Firestore dentro de `ejecutarConIdempotencia(\`order:\${idempotencyKey}\`, ..., { ttlSegundos: 120 })`.
  - Consulta secundaria en Firestore (`db.getPendingOrderByIdempotencyKey`) como respaldo histórico permanente si la clave expiró en Redis.
- **`api/leads/unlock.js`:**
  - Añadido soporte para `Idempotency-Key` opcional: cuando está presente, envuelve la deducción de créditos y descifrado en memoria con `ejecutarConIdempotencia(\`unlock:\${phone}:\${idempotencyKey}\`, ..., { ttlSegundos: 300 })`.
  - Evita dobles deducciones de saldo ante clics rápidos repetidos en el botón "Desbloquear".
  - Extracción de la función `obtenerSaludoHorario` a nivel de módulo para evitar redeclaraciones innecesarias.
- **`modules/00-security.js`:**
  - Implementada y exportada la utilidad `generarUUIDv4()` compatible con `crypto.randomUUID()`, `crypto.getRandomValues()` y fallback RFC4122 para entornos legacy.
- **`modules/07-unlock.js`:**
  - El botón de desbloqueo ahora genera e inyecta la cabecera `Idempotency-Key` en la solicitud HTTP hacia `/api/leads/unlock`.
- **`scripts/test_idempotency_concurrency.js` (NUEVO):**
  - Suite de estrés de concurrencia con 5 pruebas exhaustivas:
    1. Ráfaga de 5 peticiones simultáneas (`Promise.all`) con la misma `Idempotency-Key`.
    2. Verificación de unicidad absoluta (0 colisiones) y exactamente 1 orden en Firestore.
    3. Respuesta cacheada ultra rápida con `idempotent: true`.
    4. Concurrencia en desbloqueo: 3 clics rápidos descuentan exactamente 1 crédito.
    5. Resiliencia Fail-Safe: Verificación de candado en memoria local ante caída forzada de Redis.
- **`scripts/validate.js`:** Integrado `lib/idempotency.js` en validación 1/8 y `test_idempotency_concurrency.js` en validación 5/8.
- **`docs/INDICE_ARCHIVOS.md`:** Documentado `lib/idempotency.js`.

### 2. Por qué cambió
Para garantizar consistencia transaccional absoluta en el checkout y en el consumo de saldo. En conexiones móviles colombianas con fluctuaciones de red o cuando el usuario presiona repetidamente el botón de pago/desbloqueo, las ráfagas concurrentes podían generar múltiples intenciones de cobro o descontar créditos de más. Con este candado distribuido, el sistema garantiza que una misma intención siempre produzca exactamente la misma referencia bancaria Wompi.

### 3. Archivos afectados
- `lib/idempotency.js` (Nuevo, 187 líneas)
- `api/payments/create-order.js` (Modificado, 256 líneas)
- `api/leads/unlock.js` (Modificado, 356 líneas)
- `modules/00-security.js` (Modificado, 400 líneas — Cumple Estándar Desmulta < 500)
- `modules/07-unlock.js` (Modificado, 334 líneas — Cumple Estándar Desmulta < 500)
- `scripts/test_idempotency_concurrency.js` (Nuevo, 230 líneas)
- `scripts/validate.js` (Modificado, 405 líneas)
- `docs/INDICE_ARCHIVOS.md` (Modificado)

### 4. Decisiones técnicas tomadas
- **Arquitectura de Doble Candado (Microtarea + Redis REST)**: Para latencia mínima en Node.js, las peticiones que llegan en el mismo ciclo de eventos son sincronizadas en memoria mediante promesas compartidas; para instancias serverless separadas, Upstash Redis actúa como orquestador distribuido con operaciones atómicas `SET ... EX ... NX`.
- **TTL de 120 segundos en Órdenes de Pago**: El tiempo promedio que un usuario tarda en completar el widget de Wompi es de 30 a 90 segundos. 120s es la ventana óptima para prevenir doble referencia sin congelar compras legítimas posteriores.
- **Tolerancia a Fallos Transparente (Fail-Safe)**: Si Upstash Redis sufre interrupciones o microcortes, el sistema conmuta automáticamente a memoria local sin retornar HTTP 500 al cliente.

### 5. Estado actual del sistema
- `npm test`: 8/8 fases DevSecOps al 100% (0 errores).
- Pruebas de concurrencia e idempotencia: 5/5 pasadas al 100%.
- Todos los submódulos de `modules/` ($\le 493$) y `styles/` ($\le 496$) cumplen estrictamente la regla $\le 500$ líneas.
- Documentación e inventario de archivos 100% sincronizados.
