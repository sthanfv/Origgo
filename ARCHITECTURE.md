# 🏛️ ARCHITECTURE.md — Hunter Pro Intelligence (Showcase & Ledger)
## Arquitectura de Alta Disponibilidad, Resiliencia Financiera y Desacoplamiento Modular (Estándar Desmulta)

---

## 1. Visión General y Filosofía de Diseño

El portal comercial `hunter-portal-showcase` es la fachada pública decoupled y de coste $0 diseñada para que inversionistas y agentes inmobiliarios capturen oportunidades directas de propietarios (FSBO) y vehículos en Colombia con margen de arbitraje comercial.

A diferencia de las aplicaciones web tradicionales monolíticas, este sistema está concebido para **operar con éxito en un "mundo caótico"** caracterizado por:
- Cortes intermitentes de red y micro-desconexiones en conexiones móviles.
- Picos masivos de tráfico o intentos coordinados de denegación de servicio (DDoS).
- Intentos maliciosos de suplantación de identidad (fuerza bruta a credenciales).
- Fraude financiero (manipulación de referencias de pago o firmas adulteradas).
- Caídas o latencias temporales en la nube de Google Cloud Firestore o pasarelas externas (Wompi).

---

## 2. Diagrama de Arquitectura Multicapa

```
                                  ┌──────────────────────────────┐
                                  │      CLIENTE WEB / PWA       │
                                  │   (Vainilla JS Modular +     │
                                  │    Caché Offline Seguro)     │
                                  └──────────────┬───────────────┘
                                                 │ HTTPS + x-trace-id
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CAPA 1: EDGE & PERMISSIONS (vercel.json)                                                       │
│  • Cabeceras OWASP: HSTS (max-age 2 años, preload), X-Content-Type: nosniff, Frame: DENY.     │
│  • Políticas de Caché CDN: max-age=300 con stale-while-revalidate para JSON y 86400 para CSS/JS│
│  • Permissions-Policy: camera=(), microphone=(), geolocation=()                                │
└────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                 │ Peticiones Entrantes
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CAPA 2: RATE LIMITING & MITIGACIÓN ANTI-DDOS (lib/rate-limiter.js)                             │
│  • Ventana deslizante en memoria por IP y clave secundaria (celular).                         │
│  • Límites estrictos: 12 órdenes/min, 8 logins PIN/15 min, 30 unlocks/min, 60 webhooks/min.   │
│  • Cabeceras de trazabilidad: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After.          │
└────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                 │ Tráfico Filtrado
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CAPA 3: SERVICIOS SERVERLESS Y MOTOR FINANCIERO (api/)                                         │
│  • create-order.js:   Generación determinista de orden y firma de integridad SHA-256 Wompi.    │
│  • webhook-wompi.js:  Validación HMAC dinámica en tiempo constante (timingSafeEqual).          │
│  • reconcile-cron.js: Conciliación periódica Vercel Cron fail-safe de órdenes PENDING.         │
│  • session.js:        Reconciliación server-to-server con Wompi API ante reclamo de referencia.│
│  • unlock.js:         Deducción atómica de crédito y descifrado AES-256-GCM en memoria volátil.│
│  • balance.js:        Consulta de estado reactivo y leads desbloqueados para renderizado inst. │
└────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                 │ Operaciones Criptográficas y Datos
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CAPA 4: PERSISTENCIA Y RESILIENCIA CON BACKOFF EXPONENCIAL (lib/db.js)                         │
│  • Google Cloud Firestore: Modo primario de producción con soporte multi-región.               │
│  • Fallback Transaccional: Archivo transaccional local atómico para entornos serverless.       │
│  • Circuit Breaker & Retry: withRetry() con 3 intentos, backoff exponencial y jitter aleatorio.│
│  • Autenticación Zero-Trust: Erradicación absoluta de bypass por dígitos de celular.          │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Principios DevSecOps y Blindaje Financiero

### 3.1 Reconciliación Server-to-Server Oficial con Wompi
- **Problema previo**: Un atacante podía enviar cualquier referencia sintética (`HNT-3001234567-VIPNAC-...`) y el sistema le otorgaba acceso VIP ilimitado sin haber cobrado un solo peso.
- **Solución implementada**: `api/auth/session.js` consulta de manera síncrona y segura a la API oficial de Wompi (`https://production.wompi.co/v1/transactions?reference=...`) usando la llave secreta privada `WOMPI_PRIVATE_KEY`. Solo cuando la pasarela responde con estado formal `APPROVED` y se verifica que el monto cobrado coincide al centavo con el valor legal de la orden, se acredita la membresía.

### 3.2 Erradicación Total del Bypass de PIN
- **Problema previo**: Se permitía autenticar como usuario si el PIN coincidía con los últimos 4 dígitos del celular.
- **Solución implementada**: Eliminación total del fallback. La autenticación exige PIN aleatorio criptográfico de 4 dígitos solo para cuentas existentes, sesión JWT vigente o enlace temporal firmado de recuperación. El PIN no se inserta en JWT ni se envía por correo.

### 3.3 Tolerancia a Fallos de Red y Caos (Exponential Backoff + Jitter)
Toda interacción crítica con la capa de base de datos se ejecuta a través del envoltorio `withRetry`:
$$\text{delay} = \min(200 \times 2^{\text{intento}}, 2000) + \text{random}(0, 150) \text{ ms}$$
Esto previene el fenómeno de "rebaño atronador" (*thundering herd problem*) ante micro-cortes de red en la infraestructura de Google Cloud.

### 3.4 Modelo Freemium Atómico ($0) y CRO (Fase 2)
- **Problema previo**: Fricción y desconfianza inicial del usuario ("¿esto será una estafa?") antes de poder verificar la autenticidad de un propietario directo.
- **Solución implementada**: Función `claimWelcomeCredit(phone, email)` en `lib/db.js` y `lib/auth/welcome-credit.js`. Asigna de forma atómica en transacción Firestore 1 crédito gratuito de bienvenida ($0), fija `welcomeClaimed: true` para prevenir abusos, emite un JWT firmado y activa de inmediato el desbloqueo en pantalla sin pasar por pasarela bancaria.

### 3.5 Autenticación Passwordless y Magic Link Criptográfico (Fase 2)
- **Problema previo**: Pérdida de conversión por olvido de PIN numérico de 4 dígitos al cambiar de dispositivo o limpiar cookies.
- **Solución implementada**: Colección zero-trust `magic_tokens` en Firestore con reglas estrictas de acceso (`allow read, write: if false`). `createMagicToken()` genera un token criptográfico de un solo uso con vigencia de 30 minutos. Despachado por correo transaccional vía Resend API con plantilla HTML responsiva apuntando inmutablemente al dominio canónico `https://origgo.online/?magic_token=...`. Al hacer clic, `consumeMagicToken()` valida la expiración, invalida el token y firma un JWT de sesión sin requerir contraseñas.

### 3.6 Salvaguarda de Secreto Comercial y Memoria Volátil Zero-Trust
- **Principio Fundamental**: Los números telefónicos y enlaces directos descifrados NUNCA se guardan en texto plano en almacenamiento local (`localStorage`, `sessionStorage` o IndexedDB).
- **Mecanismo Volátil**: Residen exclusivamente en memoria volátil de JavaScript (`cacheContactosDesbloqueados`).
- **TTL de Inactividad**: Temporizador de 15 minutos e invalidación automática ante desenfoque de ventana (`document.visibilitychange = 'hidden'`). Al transcurrir dicho tiempo, la memoria de contactos se purga.
- **Re-descifrado $0 de Leads Adquiridos**: Si el usuario recarga la página o expira la memoria volátil, la tarjeta y el slideup drawer muestran el botón interactivo `[ 🔓 Ver Contacto (Desbloqueado) ]`. Al pulsar, el endpoint `/api/leads/unlock` consulta el ledger del usuario (`unlockedLeads`), reconoce la compra previa y devuelve el contacto descifrado al instante a costo $0 sin descontar saldo ni requerir pagos repetidos.

### 3.7 Cierre de Sesión Seguro (Logout) y Purga Reactiva
- **Cierre de Sesión Accesible**: Enlaces dedicados de "Cerrar Sesión" en el menú lateral (`#sideMenuLogoutBtn`) y en el modal de membresía (`#btnLogoutSession`). Al activarse, purga atómicamente `localStorage`, elimina la cookie HttpOnly `origgo_token`, vacía la caché de memoria y re-renderiza la interfaz al estado anónimo.
- **Auto-Reset ante HTTP 404**: Si un usuario de prueba es borrado manualmente de Firestore, la verificación en cliente `/api/user/balance` captura el 404 e invalida de inmediato las credenciales locales sin generar errores rojos en la consola de DevTools.

### 3.8 Blindaje Anti-Sybil Freemium y Defensa en Profundidad ($0)
- **Problema Previo**: Al no ser WhatsApp el autenticador criptográfico y no mediar verificación, un atacante podía cambiar un solo dígito de celular y usar cualquier correo inventado o temporal (`tempmail`) para saquear de forma infinita el catálogo sin pagar nunca.
- **Solución Implementada (3 Barreras de Defensa en Profundidad)**:
  1. **Barrera 1 (Hardware ID / Device Fingerprint Zombie)**: En `modules/14-offline.js`, `obtenerDeviceFingerprint()` calcula una huella digital determinista basada en hardware (WebGL, Canvas 2D, Screen, AudioContext, Cores, Zona horaria) y hash SHA-256. Dicha marca se almacena en modo *Zombie multicapa* (`localStorage` y cookie de 10 años `origgo_device_claimed`) para que **sobreviva al cierre de sesión**. Si el dispositivo ya reclamó, el cliente deshabilita el plan freemium y el backend (`db.isDeviceClaimed`) rechaza la solicitud con `HTTP 409 DISPOSITIVO_YA_RECLAMADO`.
  2. **Barrera 2 (Normalización Estricta y Lista Negra de Temporales)**: En `lib/validation.js`, `normalizarEmail()` elimina puntos y alias (`+alias`) en Gmail y Outlook para impedir crear infinitas cuentas con el mismo buzón. `DISPOSABLE_EMAIL_DOMAINS` bloquea de forma inmediata dominios de correo desechables (`yopmail.com`, `tempmail.com`, `10minutemail.com`, etc.) con `HTTP 400 VALIDACION_FALLIDA`.
  3. **Barrera 3 (Doble Opt-In Obligatorio por Correo)**: `lib/auth/welcome-credit.js` **NO emite crédito ni JWT de inmediato**. Genera un token criptográfico temporal en Firestore (`welcome_tokens`) y despacha un correo de bienvenida. Solo cuando el usuario abre el enlace (`/api/auth/welcome-verify` -> `db.consumeWelcomeVerificationToken`), se valida la existencia real del buzón, se quema el token, se registran el dispositivo y correo como reclamados (`claimed_devices`, `claimed_emails`), se entrega el crédito y se firma el JWT de sesión de 30 días.

### 3.9 Escalabilidad Masiva de Datos y Paginación Serverless Pura (Fase 3)
- **Problema Previo**: La carga inicial descargaba el JSON completo en cliente (`modules/03-api.js`), provocando congestión de ancho de banda y agotamiento de RAM móvil ($> 100\text{ MB}$) al escalar a 5.000+ propiedades.
- **Solución Implementada**:
  1. **Backend Serverless con Pre-Indexación (`api/leads/list.js`)**: Deduplicación idempotente única en arranque, índices en memoria por ciudad y operación, arrays pre-ordenados para consultas $O(1)$ (`recientes`, `precio_menor`, `precio_mayor`, `m2_menor`, `rebaja_mayor`), agregación de conteo de ciudades (`ciudades`) y latencia demostrada de **$2.06\text{ms}$** ($< 150\text{ms}$ exigido). Cabeceras Edge CDN: `Cache-Control: public, max-age=60, s-maxage=120, stale-while-revalidate=300`.
  2. **Desacoplamiento Monolítico (`modules/03-api.js`)**: El frontend consulta exclusivamente la API serverless paginada por lotes de 15 items, manteniendo el archivo local como contingencia offline resiliente.
  3. **Reciclaje de Nodos DOM y Consumo de RAM Móvil**: Solo 15 oportunidades residen en el DOM al cambiar de página, con imágenes en carga diferida (`loading="lazy"`, `decoding="async"`), asegurando un consumo de heap de memoria RAM móvil de solo **$22 - 25\text{ MB}$** ($< 45\text{ MB}$ exigido) al navegar más de 100 propiedades.

---

### 4.0 Localizador Rápido de Archivos Backend, Serverless y Scripts
| Responsabilidad / Comportamiento | Archivo / Ruta | Función o Mecanismo Clave |
|---|---|---|
| **Creación de orden y firma de integridad Wompi** | [`api/payments/create-order.js`](api/payments/create-order.js) | SHA-256 de integridad para widget Wompi |
| **Webhook de pagos y acreditación de créditos** | [`api/payments/webhook-wompi.js`](api/payments/webhook-wompi.js) | HMAC `timingSafeEqual`, acreditación atómica |
| **Modelo Freemium (1 Desbloqueo Gratis $0)** | [`lib/auth/welcome-credit.js`](lib/auth/welcome-credit.js) | `claimWelcomeCredit()`, asignación atómica $0 |
| **Emisión de Magic Link sin contraseña** | [`lib/auth/magic-link.js`](lib/auth/magic-link.js) | Tokens criptográficos temporales en Firestore |
| **Inicio de sesión con Magic Link** | [`lib/auth/magic-login.js`](lib/auth/magic-login.js) | `consumeMagicToken()`, emisión de JWT seguro |
| **Conciliación automática Vercel Cron** | [`api/payments/reconcile-cron.js`](api/payments/reconcile-cron.js) | Verificación periódica server-to-server de órdenes `PENDING` |
| **Inicio de sesión y reclamo de referencias** | [`api/auth/session.js`](api/auth/session.js) | Verificación directa con API oficial de Wompi |
| **Recuperación de PIN por email** | [`api/auth/recover.js`](api/auth/recover.js) | Tokens temporales firmados con Resend |
| **Desbloqueo seguro y deducción de créditos**| [`api/leads/unlock.js`](api/leads/unlock.js) | Descifrado AES-256-GCM y verificación `.sig` |
| **Consulta de saldo y estado reactivo** | [`api/user/balance.js`](api/user/balance.js) | Ledger y verificación de sesión JWT |
| **Persistencia Firestore y reintentos** | [`lib/db.js`](lib/db.js) | `withRetry()`, aislamiento de fallos de red |
| **Criptografía (JWT, AES, hashes)** | [`lib/crypto.js`](lib/crypto.js) | Cifrado y validación en tiempo constante |
| **Control de variables de entorno y sandbox** | [`lib/env.js`](lib/env.js) | Validación de entorno (`WOMPI_ENV=sandbox`) |
| **Mitigación DDoS y Rate Limiting** | [`lib/rate-limiter.js`](lib/rate-limiter.js) | Ventana deslizante en memoria por IP |
| **Validación estricta de esquemas Zod** | [`lib/validation.js`](lib/validation.js) | Validadores para pagos, auth y leads |
| **Persistencia de suscripciones Web Push** | [`lib/push-subscriptions.js`](lib/push-subscriptions.js) | Deduplicación SHA-256 y soporte Firestore/local |
| **Telemetría y Perro Guardián serverless** | [`api/telemetry/report.js`](api/telemetry/report.js) | Ingesta no bloqueante con ofuscación PII/PCI |
| **Clave pública VAPID dinámica** | [`api/notifications/vapid-public-key.js`](api/notifications/vapid-public-key.js) | Endpoint GET protegido por rate limit y caché |
| **Registro de suscripciones Web Push** | [`api/notifications/subscribe.js`](api/notifications/subscribe.js) | Validación W3C Push y persistencia |
| **Despacho masivo de alertas Push** | [`api/notifications/dispatch.js`](api/notifications/dispatch.js) | Despacho seguro autenticado por x-internal-secret |
| **Compilador y empaquetador de producción** | [`scripts/build.js`](scripts/build.js) | Ensambla CSS y JS en `style.min.css` y `app.js` |
| **Suite DevSecOps de 8 fases** | [`scripts/validate.js`](scripts/validate.js) | Validador sintáctico, CSS, HTML y OWASP |
| **Firma HMAC de datasets públicos** | [`scripts/sign-data.js`](scripts/sign-data.js) | Sellado criptográfico de `data/*.json` |

### 4.1 Módulos JavaScript (`modules/`):
| Archivo | Responsabilidad | Líneas |
| :--- | :--- | :---: |
| `00-security.js` | Escape HTML, sanitización de URL, teléfono, contacto cliente y registro de consola solo en desarrollo. | 494 |
| `01-state.js` | Estado global reactivo, JWT mínimo en `localStorage`, purga 404, sincronización multi-pestaña, detección ?welcome_token= y secreto comercial. | 496 |
| `02-toast.js` | Notificaciones flotantes con contenido escapado, micro-barra y deslizamiento. | 299 |
| `03-api.js` | Cliente HTTP centralizado, carga reactiva, deduplicación preventiva y fail-safe R2/local. | 177 |
| `04-filters.js` | Búsqueda fonética inteligente, deduplicación triple-key, omnibox y cierre unificado de dropdowns. | 484 |
| `05-carousel.js`| Carruseles fotográficos táctiles, deslizamiento y drawer slide-up de detalles. | 159 |
| `06-cards.js` | Renderizado Bento Grid, re-desbloqueo de contactos $0, skeletons y precios. | 496 |
| `07-unlock.js` | Desbloqueo atómico de propietarios, auto-desbloqueo por ID, actualización DOM y revelación de datos. | 499 |
| `08-checkout.js`| Modal de compra Wompi, selector de planes, freemium $0 anti-sybil, idempotencia y widget checkout. | 496 |
| `09-ui-effects.js`| Menú móvil animado de hamburguesa a X (estilo Desmulta), háptica y temas. | 489 |
| `10-listeners.js`| Vinculación de eventos DOM, atajos de teclado, logout y orquestación. | 497 |
| `11-welcome.js`| Modal de bienvenida y experiencia inicial. | 263 |
| `12-push.js`   | Alertas Web Push nativas PWA en memoria, registro de Service Worker y CERO variables expuestas. | 412 |
| `13-i18n.js`   | Motor bilingüe ES/EN reactivo, diccionario de UI y persistencia de idioma. | 499 |
| `14-offline.js`| Resiliencia offline, Device Fingerprint SHA-256 de hardware y persistencia Zombie multicapa. | 338 |
| `15-autocomplete.js`| Sugerencias multicapa de autocompletado en búsqueda con accesibilidad W3C ARIA. | 386 |

### 4.2 Módulos CSS (`styles/`):
Divididos en 19 submódulos semánticos (`01-tokens.css` a `19-offline-autocomplete.css`), todos inferiores a 500 líneas, que se compilan deterministamente mediante `scripts/build.js` generando `style.min.css`.
- **Aislamiento de Stacking Context y Opacidad:** `styles/04-command-bar.css` y `styles/11-mobile.css` aplican `isolation: isolate`, fondos 100% opacos (`var(--bg-card)` y `#111622`) y `z-index: 100` en los menús desplegables para erradicar cualquier solapamiento o efecto fantasma entre barras de filtros.
- **Grilla Balanceada de Planes:** `styles/10-checkout-plans.css` posiciona la tarjeta de Bienvenida ($0) en `grid-column: 1 / -1;`, asegurando una grilla de 2x2 simétrica para los demás planes sin espacios vacíos.
- **Scroll Total en Modal:** `styles/09-checkout-modal.css` habilita `overflow-y: auto`, `align-items: flex-start` y botón de cierre sticky que garantiza navegación total y visibilidad permanente de la X.

### 4.3 Deduplicación Canónica de Oportunidades
- **Motor Triple-Key:** `deduplicarLeads` aplica un filtrado idempotente en tres dimensiones:
  1. `vistosIds`: Identificador único de lead (`lead-inm-XXX`).
  2. `vistosEnlaces`: URL única de publicación externa o marketplace.
  3. `vistosFirmas`: Hash semántico compuesto por `título + precio + ciudad + área`.
- **Garantía Combinatoria:** Ninguna mezcla de filtros (Ciudad x Operación x Ordenamiento x Búsqueda) puede generar duplicados visuales en la interfaz. Probado exhaustivamente en 90 permutaciones en `tests/filters_sorting.test.js`.

### 4.4 Tarjetas, carruseles y enlaces seguros
- Los carruseles aceptan navegación por flechas, puntos y deslizamiento táctil con umbral horizontal para evitar colisiones con el scroll vertical.
- El botón `Ver Anuncio` solo se renderiza desde `sanitizarContactoCliente(contacto)`, por lo que los enlaces deben usar `https` y hosts permitidos antes de llegar al DOM.
- Los estados desbloqueados muestran WhatsApp, llamada y anuncio original sin persistir el contacto en `localStorage`.

### 4.4 Higiene de interfaz y consola
- Las plantillas del frontend no generan atributos `style="..."`; los detalles visuales viven en clases CSS y en `styles/16-utilities.css` para utilidades finales.
- Los diagnósticos de cliente pasan por `registrarLogDesarrollo`, activo en `localhost`, `file:` o `?debug=origgo`, y silencioso en producción.
- `dist/` se conserva como paquete público deliberado del build, ignorado por Git, porque `vercel.json` lo usa como salida de despliegue y evita publicar `api/`, `lib/` o `modules/`.

### 4.5 Resiliencia Offline y Caché PWA Inteligente (`modules/14-offline.js` & `sw.js`)
- **Partición Aislada de Imágenes con Control LRU (`origgo-images-v11`):** Aísla las imágenes locales y de CDN (Unsplash) con un tope estricto de 60 entradas para evitar sobrecarga en la cuota de disco de dispositivos móviles. Ante fallo de red o desconexión, sirve de inmediato el vector SVG corporativo `FALLBACK_INMUEBLE_SVG`.
- **Estrategia Stale-While-Revalidate en Catálogo:** El dataset (`data/inmobiliario.json`) y la consulta serverless (`api/leads/list`) entregan contenido de caché inmediato con revalidación en segundo plano.
- **Protección Antifallo y Monitoreo:** Las acciones financieras dependientes de red (pasarela Wompi) son interceptadas preventivamente si el dispositivo está sin conexión (`asegurarConexionParaAccion`). Cualquier transición a offline se notifica al Perro Guardián (`reportarFalloCliente`).
- **Banner Flotante de Conectividad:** Renderiza un indicador flotante no invasivo con animación acelerada por hardware que informa al usuario si navega en modo sin conexión o si la conexión fue recuperada.

### 4.6 Búsqueda Inteligente y Autocompletado Seguro (`modules/15-autocomplete.js` & `styles/19-offline-autocomplete.css`)
- **Sugerencias Tácticas Multicapa:** Despliega en tiempo real barrios estratégicos (Rosales, Chicó, Virrey, Poblado, Pance, etc.), tipologías (Penthouse, Amoblado, Campestre) y oportunidades activas del catálogo en memoria.
- **Seguridad OWASP A03 (Sanitización XSS):** El resaltado tipográfico (`resaltarCoincidenciaSegura`) limpia y escapa todo carácter especial y etiquetas HTML potencialmente peligrosas.
- **Accesibilidad W3C Combobox ARIA:** Integra soporte completo para teclado (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`), lectores de pantalla (`role="combobox"`, `role="listbox"`, `role="option"`, `aria-activedescendant`) y soporte táctil sin latencia en dispositivos móviles.

### 4.7 Skeletons Shimmer Bento Grid de Alta Fidelidad (`styles/06-bento-grid.css` & `modules/06-cards.js`)
- **Aceleración por Hardware:** Los skeletons y animaciones de onda utilizan `transform: translateZ(0)` y `will-change: background-position` garantizando 60 FPS estables sin recalentamiento de CPU.
- **Respeto a Accesibilidad:** Conforme a WCAG, se implementa `@media (prefers-reduced-motion: reduce)` para reemplazar el desplazamiento visual continuo por un pulso suave de opacidad.
- **Cero Cumulative Layout Shift (CLS = 0):** Las dimensiones de los skeletons coinciden de forma exacta con la tarjeta Bento definitiva.

### 4.8 Continuidad de Oportunidad, Auto-Desbloqueo al Validar Correo y Sincronización Multi-Pestaña
- **Continuidad de Oportunidad (`&lead=...`):** Al solicitar el regalo de bienvenida desde una tarjeta específica, el backend (`lib/auth/welcome-credit.js`) asocia el identificador del inmueble en el correo transaccional personalizado y el cliente lo preserva en `sessionStorage`.
- **Auto-Desbloqueo Reactivo (`modules/07-unlock.js` & `modules/01-state.js`):** Al retornar con `?welcome_token=...`, el cliente valida la cuenta, ejecuta `ejecutarDesbloqueoLeadPorId()` y enfoca la tarjeta con scroll suave automático (`scrollIntoView`).
- **Sincronización Multi-Pestaña:** Escucha el evento `storage` en `window` para actualizar de inmediato cualquier otra pestaña abierta si el usuario confirma su enlace en otra ventana o WebView de correo.
- **Notificación Positiva y Asertiva:** Sustitución de mensajes confusos ("0 créditos restantes") por confirmaciones asertivas de contacto del propietario desbloqueado listo para llamada y WhatsApp.

---

## 5. Suite de Validación DevSecOps (8 Fases)

Respaldada por `npm test` antes de cada commit:
1. Sintaxis estricta con `node --check` en 23 archivos JS y lambdas serverless.
2. Integridad de estilos CSS, balance de llaves y presencia de selectores críticos.
3. Marcado HTML y cabeceras de seguridad globales OWASP en `vercel.json`.
4. Contratos de datos JSON y firmas criptográficas AES-256-GCM.
5. Suite automatizada de pasarela Wompi y ledger (12/12 pruebas al 100%).
6. Auditoría antifraude: prueba de inyección de referencia falsa rechazada con 403.
7. Auditoría de autenticación: verificación de que el bypass de PIN esté 100% erradicado.
8. Auditoría de modularidad: confirmación de que ningún módulo exceda las 500 líneas.
