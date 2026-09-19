# 🏛️ Origgo — Terminal de Inteligencia y Agregación Inmobiliaria ($0 Cost)
## Software de Búsqueda, Monitoreo de Mercado y Conexión Directa de Fuentes Públicas

Este repositorio contiene el frontend desacoplado e independiente de Origgo, diseñado como una **Terminal de Inteligencia y Agregación de Datos Públicos** para que inversionistas y compradores identifiquen oportunidades directas (FSBO) en Colombia sin intermediación inmobiliaria ni cobro de comisiones.

---

## 🎯 Principios de Diseño y Arquitectura (Estándar Ecosistema Desmulta)

1. **Aislamiento Total del Backend:** Este proyecto es 100% independiente del scraper (`ofertas-hunter-pro`). Consume únicamente archivos estáticos `.json` exportados, garantizando que el servidor del celular Samsung Galaxy J7 permanezca invisible y protegido de ataques DDoS o tráfico masivo.
2. **Criptografía Zero-Trust en Reposo:** Los teléfonos y enlaces reales de los propietarios directos se cifran en origen con **AES-256-GCM** (`iv:authTag:ciphertext`). El JSON público únicamente expone el teléfono ofuscado (`+57 ••• ••••`).
3. **Desbloqueo en Memoria y Sesiones JWT:** El descifrado ocurre estrictamente en el backend serverless (`/api/leads/unlock`) tras validar un token JWT firmado (HMAC-SHA256) sin exponer PIN ni contactos persistentes en el navegador.
4. **Pasarela Wompi e Idempotencia:** Integración oficial con Wompi Bancolombia (Sandbox y Producción) con validación criptográfica de firmas de integridad SHA-256 y eventos mediante `crypto.timingSafeEqual`, previniendo ataques de timing y doble acreditación.
5. **Reconciliación Server-to-Server Oficial:** El reclamo de referencias de pago verifica directamente con la API oficial de Wompi usando la llave privada antes de acreditar créditos o membresías, cerrando cualquier intento de fraude.
6. **Resiliencia ante el Caos:** Envoltorio `withRetry` con backoff exponencial y jitter aleatorio en operaciones críticas de base de datos, absorbiendo caídas de red o picos de latencia.
7. **Rate Limiting Anti-DDoS:** Middleware en memoria que protege endpoints financieros y autenticación contra ataques de fuerza bruta y saturación.
8. **Arquitectura Modular (< 500 líneas por módulo):** Frontend y estilos 100% particionados en módulos especializados bajo `modules/` y `styles/`.
9. **Estética Editorial Inmobiliaria, Bento Grid & View Transitions API:** Modo claro editorial por defecto con paleta cálida y aspiracional (marfil, arena y esmeralda institucional), soporte alternable a modo oscuro, cross-fade cinematográfico acelerado por GPU (`document.startViewTransition`), descompresión visual con ratio panorámico 16:10, cero saltos de diseño (CLS = 0) y slide-up drawer para análisis cuantitativo.
10. **Modelo Freemium y Reducción de Fricción CRO (Fase 2):** "1 Desbloqueo Gratis de Bienvenida" a $0 al ingresar WhatsApp y correo electrónico, acreditado de forma atómica en Firestore para vencer la desconfianza inicial del comprador sin requerir tarjetas bancarias.
11. **Autenticación Passwordless y Acceso Seguro sin Contraseña (Fase 2):** Ingreso instantáneo por correo vía Resend API con token criptográfico temporal en Firestore (`magic_tokens`) que mitiga el olvido de PIN y la fricción de acceso, enlazando siempre al dominio canónico inmutable `https://origgo.online`.
12. **Salvaguarda de Secreto Comercial y Memoria Volátil:** Los contactos y teléfonos descifrados residen exclusivamente en memoria volátil de JavaScript (`cacheContactosDesbloqueados`) sin persistir en texto plano en disco ni `localStorage`. Cuentan con TTL de 15 minutos e invalidación automática ante inactividad o cambio de pestaña (`visibilitychange`). Los leads previamente adquiridos por el usuario se re-descifran al instante a costo $0 sin consumir saldo adicional.
13. **Cierre de Sesión Seguro y Purga de Credenciales:** Botón de "Cerrar Sesión" integrado en el menú lateral y modal de membresía que purga tokens JWT, cookies y memoria volátil, complementado con auto-reset reactivo ante usuarios eliminados (HTTP 404).
14. **Blindaje Anti-Sybil Freemium y Defensa en Profundidad ($0):** Prevención de saqueo del catálogo mediante 3 barreras: (a) Identificador de Hardware / Device Fingerprint persistido en almacenamiento Zombie multicapa que sobrevive al cierre de sesión; (b) Normalización estricta de correo (eliminación de puntos y alias `+` en Gmail/Outlook) y lista negra de dominios temporales desechables; (c) Doble Opt-In obligatorio con verificación por correo antes de emitir cualquier crédito de regalo o token JWT.
15. **Continuidad de Oportunidad y Auto-Desbloqueo al Verificar:** Preservación del inmueble solicitado (`&lead=...`) en el correo de activación freemium para ejecutar automáticamente el desbloqueo del contacto directo y scroll focalizado al confirmar la cuenta, junto con sincronización multi-pestaña (`storage` event) y notificación asertiva de contacto revelado.
16. **Escalabilidad Masiva de Datos y Paginación Serverless Pura (Fase 3):** Desacoplamiento del archivo monolítico local en favor de consultas particionadas a `GET /api/leads/list` con índices en memoria y caché Edge CDN. Latencia ultra-reducida $< 150\text{ms}$ (logrado $2\text{ms}$) y consumo de memoria RAM en navegador móvil $< 45\text{ MB}$ al navegar 100+ propiedades mediante reciclaje activo de nodos DOM y carga diferida de imágenes (`loading="lazy"`). El JSON local se preserva como contingencia offline resiliente.

## 🗺️ Índice Maestro de Comportamientos y Rutas de Archivos
> **Guía rápida para desarrolladores**: Localiza inmediatamente qué archivo y qué función controlan cada funcionalidad del portal sin tener que buscar palabras clave a ciegas.

| Comportamiento / Funcionalidad | Archivo Fuente / Ruta | Mecanismo o Función Clave |
|---|---|---|
| **Creación de orden y firma de integridad Wompi** | [`api/payments/create-order.js`](api/payments/create-order.js) | Generación SHA-256 de integridad para pasarela |
| **Webhook de pagos y acreditación de créditos** | [`api/payments/webhook-wompi.js`](api/payments/webhook-wompi.js) | Validación HMAC `timingSafeEqual` y ledger |
| **Login por WhatsApp + PIN y reclamo post-pago** | [`api/auth/session.js`](api/auth/session.js) | `claim_reference`, reconciliación API Wompi |
| **Modelo Freemium (1 Desbloqueo Gratis $0)** | [`lib/auth/welcome-credit.js`](lib/auth/welcome-credit.js) | `createWelcomeVerificationToken()`, Doble Opt-In |
| **Activación Freemium y emisión de JWT** | [`lib/auth/welcome-verify.js`](lib/auth/welcome-verify.js) | `consumeWelcomeVerificationToken()`, Anti-Sybil |
| **Emisión de Acceso Seguro sin contraseña** | [`lib/auth/magic-link.js`](lib/auth/magic-link.js) | Tokens criptográficos temporales en Firestore |
| **Inicio de sesión con Acceso Seguro** | [`lib/auth/magic-login.js`](lib/auth/magic-login.js) | `consumeMagicToken()`, emisión de JWT seguro |
| **Emisión de desafíos anti-bot (PoW / Turnstile)** | [`api/auth/challenge.js`](api/auth/challenge.js) | Retos firmados HMAC-SHA256 con ventana temporal |
| **Motor de desafíos y Proof-of-Work criptográfico**| [`lib/challenge.js`](lib/challenge.js) | Generación y verificación de PoW y Turnstile |
| **Conciliación automática y Vercel Cron Fail-Safe** | [`api/payments/reconcile-cron.js`](api/payments/reconcile-cron.js) | Verificación periódica server-to-server de órdenes `PENDING` |
| **Recuperación segura de PIN por correo** | [`api/auth/recover.js`](api/auth/recover.js) | Envío transaccional vía Resend canónico |
| **Desbloqueo de lead y descifrado de contacto** | [`api/leads/unlock.js`](api/leads/unlock.js) | Descifrado AES-256-GCM y deducción de créditos |
| **Verificación de firma HMAC del dataset JSON** | [`api/leads/unlock.js`](api/leads/unlock.js) | `verificarIntegridadDataset()` con `.json.sig` |
| **Consulta de saldo, perfil y compras** | [`api/user/balance.js`](api/user/balance.js) | Validación JWT y balance en tiempo real |
| **Ledger en Firestore y reintentos exponenciales**| [`lib/db.js`](lib/db.js) | `withRetry()`, persistencia de usuarios y órdenes |
| **Criptografía (AES-256-GCM, JWT, PIN, Keyring)** | [`lib/crypto.js`](lib/crypto.js) | Cifrado simétrico versionado y rotación de claves |
| **Control de variables de entorno y sandbox** | [`lib/env.js`](lib/env.js) | Validación de entorno (`WOMPI_ENV=sandbox`) |
| **Protección anti-fuerza bruta y rate limiting**| [`lib/rate-limiter.js`](lib/rate-limiter.js) | Ventana deslizante en memoria por IP |
| **Validación estricta de payloads con Zod** | [`lib/validation.js`](lib/validation.js) | Esquemas de checkout, login y desbloqueo |
| **CORS restringido con whitelist** | [`lib/cors.js`](lib/cors.js) | Cabeceras de seguridad e idempotencia |
| **Índice server-side de leads** | [`lib/leads.js`](lib/leads.js) | Caché de búsqueda en memoria para API |
| **Sanitización, escape HTML y View Transitions** | [`modules/00-security.js`](modules/00-security.js) | `escaparHtml()`, `ejecutarConTransicionSuave()` |
| **Estado reactivo, sesión y secreto comercial** | [`modules/01-state.js`](modules/01-state.js) | `sesionUsuario`, TTL inactividad, purga 404 |
| **Notificaciones flotantes (Toasts)** | [`modules/02-toast.js`](modules/02-toast.js) | `mostrarNotificacionToast()`, barra progreso |
| **Carga de catálogo JSON con trace ID** | [`modules/03-api.js`](modules/03-api.js) | `cargarDatosPublicos()`, `x-trace-id` |
| **Filtros de ciudad, precio y búsqueda** | [`modules/04-filters.js`](modules/04-filters.js) | Normalización fonética y actualización de grilla |
| **Carrusel fotográfico y gestos táctiles** | [`modules/05-carousel.js`](modules/05-carousel.js) | Swipe táctil en móvil, drawer de ficha |
| **Renderizado Bento Grid y re-desbloqueo $0** | [`modules/06-cards.js`](modules/06-cards.js) | Tarjetas Bento, botón ver contacto desbloqueado |
| **Lógica de desbloqueo y revelación de título** | [`modules/07-unlock.js`](modules/07-unlock.js) | `actualizarTarjetaEnElDOM()`, datos revelados |
| **Checkout, planes y reconciliación Wompi** | [`modules/08-checkout.js`](modules/08-checkout.js) | Integración Wompi widget, reintentos post-pago, planes |
| **Efectos visuales, menú móvil a X y temas** | [`modules/09-ui-effects.js`](modules/09-ui-effects.js) | Animación hamburguesa a X, GPU acceleration |
| **Event listeners y atajos de teclado** | [`modules/10-listeners.js`](modules/10-listeners.js) | Orquestación de eventos globales en DOM |
| **Modal de bienvenida VIP y entrega de PIN** | [`modules/11-welcome.js`](modules/11-welcome.js) | `abrirModalBienvenidaVIP()`, guía de PIN |
| **Suscripción y modal Web Push** | [`modules/12-push.js`](modules/12-push.js) | Manejador de notificaciones push en cliente |
| **Sistema bilingüe y conversión USD** | [`modules/13-i18n.js`](modules/13-i18n.js) | View Transitions API, diccionario ES/EN y USD |
| **Alertas Web Push y Clave VAPID** | [`api/notifications/subscribe.js`](api/notifications/subscribe.js) | GET clave pública VAPID y POST suscripciones W3C |
| **Despacho masivo de notificaciones** | [`api/notifications/dispatch.js`](api/notifications/dispatch.js) | POST emisión server-to-server con `x-internal-secret` |
| **Despachador resiliente y auto-limpieza** | [`lib/push-dispatcher.js`](lib/push-dispatcher.js) | Envío por lotes, backoff exponencial y purga 410/404 |
| **Persistencia y segmentación Push** | [`lib/push-subscriptions.js`](lib/push-subscriptions.js) | Almacén híbrido, multicriterio (ciudad/op/rebajas) y hash |
| **Telemetría y Perro Guardián serverless** | [`api/telemetry.js`](api/telemetry.js) | Enrutador unificado: reportes, embudo y Vercel Cron |
| **Perro Guardián y reporte en cliente** | [`modules/00-security.js`](modules/00-security.js) | `inicializarPerroGuardian()`, `sendBeacon` |
| **Centro de Auto-Soporte y Takedown** | [`modules/16-support.js`](modules/16-support.js) | Modal institucional, reconciliación y desindexación |
| **Retiro de Inmuebles (Notice & Takedown)**| [`api/support.js`](api/support.js) | Enrutador unificado: desindexación y lista negra pública |
| **Lista Negra pública para Scraper J7** | [`api/support.js`](api/support.js) | Endpoint GET `/api/support/blacklist` con caché Edge |
| **Cola de reintentos y contrato de catálogo** | [`modules/03-api.js`](modules/03-api.js) | `fetchConReintentos()`, `validarContratoCatalogo()` |
| **Compilador y minificador de assets** | [`scripts/build.js`](scripts/build.js) | Ensambla modules/ -> app.js y styles/ -> style.css |
| **Suite de validación DevSecOps (8 fases)** | [`scripts/validate.js`](scripts/validate.js) | `npm test` antes de cada despliegue |
| **Firma criptográfica offline de datasets** | [`scripts/sign-data.js`](scripts/sign-data.js) | Genera firmas `.sig` para JSONs estáticos |

---

## 📂 Estructura de Archivos Modular

```
hunter-portal-showcase/
├── index.html                  # Maquetación principal con Bento Grid y Modal de Checkout
├── style.css                   # Hoja de estilos ensamblada deterministamente
├── style.min.css               # Hoja de estilos compilada y balanceada (120 KB)
├── app.js                      # Controlador orquestador del frontend
├── app.min.js                  # Script compilado y minificado (179 KB)
├── og-image.png                # Banner oficial OpenGraph (1200x630) con fondo de marca
├── apple-touch-icon.png        # Icono táctil de alta definición (180x180) con fondo sólido
├── config.js                   # Configuración y llaves públicas de cliente
├── dist/                       # Paquete público generado por build e ignorado por Git
├── package.json                # Dependencias, scripts de build y tests
├── README.md                   # Documentación técnica completa
├── MEMORY.md                   # Bitácora de memoria persistente del sistema
├── ARCHITECTURE.md             # Arquitectura técnica en 4 capas y estándares OWASP
├── vercel.json                 # Cabeceras globales OWASP (HSTS, nosniff, DENY) y caché
├── .env.example                # Plantilla de variables de entorno de producción
├── modules/                    # Módulos JavaScript especializados (< 500 líneas)
│   ├── 00-security.js          # Escape HTML, sanitización de URL, teléfono y contacto cliente
│   ├── 01-state.js             # Estado reactivo, localStorage mínimo y sesión JWT sin PIN
│   ├── 02-toast.js             # Notificaciones toast flotantes con contenido escapado
│   ├── 03-api.js               # Cliente HTTP centralizado con x-trace-id
│   ├── 04-filters.js           # Búsqueda fonética inteligente, omnibox y ciudades
│   ├── 05-carousel.js          # Carruseles fotográficos táctiles, deslizamiento y drawer de detalles
│   ├── 06-cards.js             # Renderizado Bento Grid, botón Ver Anuncio seguro y precios
│   ├── 07-unlock.js            # Desbloqueo atómico de leads y enlace seguro a WhatsApp
│   ├── 08-checkout.js          # Modal de pago, idempotencia y widget Wompi
│   ├── 09-ui-effects.js        # Háptica táctil, ondas ripple, parallax GPU y temas
│   ├── 10-listeners.js         # Event listeners del DOM, atajos de teclado y arranque
│   ├── 11-welcome.js           # Modal de bienvenida y experiencia inicial
│   ├── 12-push.js              # Manejo en cliente de notificaciones Web Push y permisos
│   ├── 13-i18n.js              # Sistema bilingüe sin parpadeo (ES/EN) y conversión USD
│   ├── 14-offline.js           # Manejo de contingencia offline y caché local
│   ├── 15-autocomplete.js      # Sugerencias y autocompletado inteligente de búsqueda
│   └── 16-support.js           # Centro de auto-soporte, conciliación y desindexación
├── styles/                     # Módulos CSS especializados (< 500 líneas)
│   ├── 01-tokens.css           # Fuentes y tokens de diseño HSL
│   ├── 02-base.css             # Reseteo, tipografía y branding con cinemática de prestigio
│   ├── 03-header.css           # Cabecera institucional, botón VIP y estado
│   ├── 04-command-bar.css      # Barra táctica y omnibox
│   ├── 05-hero.css             # Hero en cápsula y cinta editorial
│   ├── 06-bento-grid.css       # Contenedor Bento Grid
│   ├── 07-cards.css            # Cuerpo de tarjetas y carruseles
│   ├── 08-slideup.css          # Drawer slide-up de detalles
│   ├── 09-checkout-modal.css   # Modal de checkout Wompi
│   ├── 10-checkout-plans.css   # Selector de planes y precios
│   ├── 11-mobile.css           # Responsividad móvil y navegación inferior PWA
│   ├── 12-sidebar.css          # Menú lateral off-canvas
│   ├── 13-footer.css           # Footer institucional y legal
│   ├── 14-toast.css            # Notificaciones toast con ambient glow
│   ├── 15-welcome-modal.css    # Modal inicial de bienvenida
│   ├── 16-utilities.css        # Transiciones View Transitions, anti-print y changelog legal
│   ├── 17-push-modal.css       # Modal sugestivo de radar push en tiempo real
│   ├── 18-i18n.css             # Selector de idiomas de cristal y precio referencial USD
│   ├── 19-offline-autocomplete.css # Estilos de skeletons offline y autocompletado
│   └── 20-support-modal.css    # Modal de auto-soporte inteligente y desindexación
├── lib/                        # Librerías privadas compartidas por funciones serverless
│   ├── cors.js                 # CORS estricto para API e idempotencia
│   ├── crypto.js               # Cifrado AES-256-GCM, tokens JWT y comparación constante
│   ├── db.js                   # Ledger de usuarios, créditos, reintentos y blacklist
│   ├── env.js                  # Variables obligatorias y rechazo de secretos de prueba
│   ├── leads.js                # Índice server-side de leads oficiales
│   ├── push-dispatcher.js      # Despachador resiliente con backoff y auto-limpieza 410/404
│   ├── push-subscriptions.js   # Persistencia y segmentación multicriterio de suscripciones
│   ├── rate-limiter.js         # Middleware de limitación de tasa en memoria
│   ├── validation.js           # Esquemas de validación estricta con Zod
│   ├── support/                # Módulos internos de auto-soporte y desindexación
│   │   ├── takedown.js         # Manejador Notice & Takedown Habeas Data
│   │   └── blacklist.js        # Manejador de consulta pública de lista negra
│   └── telemetry/              # Módulos internos de telemetría y embudo CRO
│       ├── report.js           # Manejador de reportes de error Perro Guardián
│       ├── funnel.js           # Manejador de eventos y conversión CRO
│       └── cron.js             # Manejador de cron diario a Telegram
├── api/                        # Funciones Serverless en Vercel (11 funciones, límite Hobby <= 12)
│   ├── auth.js                 # Sesión, recuperación, magic links y freemium
│   ├── notifications.js        # VAPID key, suscripciones y despacho Push
│   ├── support.js              # Enrutador consolidado de auto-soporte y lista negra
│   ├── telemetry.js            # Enrutador consolidado de telemetría, embudo y cron
│   ├── leads/
│   │   ├── list.js             # Catálogo paginado con caché Edge
│   │   └── unlock.js           # Desbloqueo de leads con deducción atómica de crédito
│   ├── media/
│   │   └── proxy.js            # Proxy seguro de medios y anti-SSRF
│   ├── payments/
│   │   ├── create-order.js     # Creación de orden y firma de integridad Wompi
│   │   ├── reconcile-cron.js   # Conciliación periódica de órdenes Wompi
│   │   └── webhook-wompi.js    # Receptor de eventos Wompi con validación HMAC
│   └── user/
│       └── balance.js          # Consulta de saldo, perfil y leads desbloqueados
├── scripts/
│   ├── build.js                # Compilador y ensamblador modular de CSS y JS
│   ├── validate.js             # Suite de validación DevSecOps en 8 fases
│   ├── test_ledger_wompi.js    # Suite de pruebas unitarias de ledger y pagos
│   └── test_validation_ratelimit.js # Pruebas unitarias de validación Zod y rate limit
├── tests/
│   └── support_blacklist.test.js # Pruebas unitarias de auto-soporte y lista negra
└── data/
    ├── inmobiliario.json       # Feed de oportunidades de bienes raíces selladas y cifradas
    └── vehiculos.json          # Feed de oportunidades automotrices (Flipping)
```

---

## ⚙️ Variables de Entorno (Vercel)

Para el funcionamiento seguro del backend serverless en producción, configure las siguientes variables en el panel de Vercel (**Settings > Environment Variables**):

| Variable | Tipo | Descripción |
| :--- | :--- | :--- |
| `LEADS_ENCRYPTION_KEY` | Crítico (32 bytes hex) | Llave simétrica AES-256 para cifrado y descifrado de datos de contacto. |
| `JWT_SECRET` | Crítico (string seguro) | Clave secreta para firma y verificación de tokens de sesión. |
| `WOMPI_PUBLIC_KEY` | Público | Llave pública de Wompi (`pub_test_...` o `pub_prod_...`). |
| `WOMPI_PRIVATE_KEY` | Privado | Llave privada de Wompi para consultas API y reconciliación server-to-server. |
| `WOMPI_INTEGRITY_SECRET` | Crítico | Secreto de integridad provisto por Wompi para firmas SHA-256 de órdenes. |
| `WOMPI_EVENTS_SECRET` | Crítico | Secreto para validar autenticidad de firmas en webhooks. |
| `FIREBASE_PROJECT_ID` | Opcional | ID de proyecto Firebase/Firestore si se usa persistencia en la nube. |
| `FIREBASE_SERVICE_ACCOUNT` | Opcional | JSON credencial de cuenta de servicio de Firebase codificado en Base64. |
| `RESEND_API_KEY` | Opcional | Llave de API de Resend para el despacho de enlaces temporales de recuperación. |
| `RESEND_FROM_EMAIL` | Opcional | Remitente verificado en Resend (por defecto: `Origgo <seguridad@origgo.online>`). |
| `APP_URL` | Opcional | URL base de la aplicación (ej: `https://origgo.online` o `https://origgo.vercel.app`). |

---

## 🧪 Validación y Pruebas Automatizadas (8 Fases DevSecOps)

El proyecto cuenta con una suite automatizada de 8 fases respaldada por Git Hooks (`husky`):

```bash
# Ejecutar compilación y suite completa de pruebas:
npm test
```

Fases evaluadas en cada commit y push:
1. **Sintaxis de JavaScript**: 29 archivos validados con `node --check` (lambdas en `api/`, librerías privadas en `lib/`, submódulos en `modules/` y compilados).
2. **Integridad y balance CSS**: 16 submódulos verificados, balance de llaves y selectores críticos.
3. **Marcado HTML y Seguridad OWASP**: Doctype, meta tags, recursos físicos y cabeceras de seguridad en `vercel.json`.
4. **Contratos de datos JSON**: Validación de estructura AES-256 (`iv:tag:cipher`) en 52 oportunidades.
5. **Suite de integración Wompi, ledger y esquemas Zod**: Pruebas al 100% de pasarela, idempotencia, rate limiting, recuperación por enlace firmado y contratos Zod.
6. **Auditoría Antifraude en Reconciliación**: Rechazo formal de reclamos con referencias falsas o no aprobadas.
7. **Auditoría de PIN Estricto**: Confirmación de erradicación total del bypass de autenticación por dígitos de celular.
8. **Auditoría de Modularidad Arquitectónica**: Verificación de que ningún archivo en `modules/` ni en `styles/` exceda 500 líneas.

---

## 🚀 Despliegue en Vercel

1. Clonar el repositorio y configurar variables en Vercel.
2. Los endpoints dentro de `api/` se despliegan automáticamente como funciones Serverless de Node.js.
3. Las páginas estáticas y recursos optimizados se sirven desde `dist/`, generado por `npm run build` sin copiar `.env`, `api/`, `lib/`, `modules/` ni dependencias privadas.
4. `dist/` no se versiona en Git; se genera en cada build porque `vercel.json` usa `"outputDirectory": "dist"` para evitar exponer código interno desde la raíz del proyecto.
