# 🏛️ Hunter Pro Intelligence — Portal Showcase ($0 Cost)
## Fachada Web de Alta Gama con Renderizador Agnóstico, Pasarela Wompi y Ledger Criptográfico

Este repositorio contiene la interfaz pública desacoplada e independiente diseñada para mostrar oportunidades directas y arbitraje a clientes finales (agentes inmobiliarios top e inversionistas).

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
9. **Estética Glassmorphic, Bento Grid & View Transitions API:** Modo oscuro y claro con cross-fade cinematográfico acelerado por GPU (`document.startViewTransition`), visualización ejecutiva con carruseles bajo demanda, deslizamiento táctil, ambient glow y modal de checkout nativo sin parpadeos.

## 🗺️ Índice Maestro de Comportamientos y Rutas de Archivos
> **Guía rápida para desarrolladores**: Localiza inmediatamente qué archivo y qué función controlan cada funcionalidad del portal sin tener que buscar palabras clave a ciegas.

| Comportamiento / Funcionalidad | Archivo Fuente / Ruta | Mecanismo o Función Clave |
|---|---|---|
| **Creación de orden y firma de integridad Wompi** | [`api/payments/create-order.js`](api/payments/create-order.js) | Generación SHA-256 de integridad para pasarela |
| **Webhook de pagos y acreditación de créditos** | [`api/payments/webhook-wompi.js`](api/payments/webhook-wompi.js) | Validación HMAC `timingSafeEqual` y ledger |
| **Login por WhatsApp + PIN y reclamo post-pago** | [`api/auth/session.js`](api/auth/session.js) | `claim_reference`, reconciliación API Wompi |
| **Recuperación segura de PIN por correo** | [`api/auth/recover.js`](api/auth/recover.js) | Envío transaccional vía Resend |
| **Desbloqueo de lead y descifrado de contacto** | [`api/leads/unlock.js`](api/leads/unlock.js) | Descifrado AES-256-GCM y deducción de créditos |
| **Verificación de firma HMAC del dataset JSON** | [`api/leads/unlock.js`](api/leads/unlock.js) | `verificarIntegridadDataset()` con `.json.sig` |
| **Consulta de saldo, perfil y compras** | [`api/user/balance.js`](api/user/balance.js) | Validación JWT y balance en tiempo real |
| **Ledger en Firestore y reintentos exponenciales**| [`lib/db.js`](lib/db.js) | `withRetry()`, persistencia de usuarios y órdenes |
| **Criptografía (AES-256-GCM, JWT, PIN)** | [`lib/crypto.js`](lib/crypto.js) | Cifrado simétrico y generación segura de PIN |
| **Control de variables de entorno y sandbox** | [`lib/env.js`](lib/env.js) | Validación de entorno (`WOMPI_ENV=sandbox`) |
| **Protección anti-fuerza bruta y rate limiting**| [`lib/rate-limiter.js`](lib/rate-limiter.js) | Ventana deslizante en memoria por IP |
| **Validación estricta de payloads con Zod** | [`lib/validation.js`](lib/validation.js) | Esquemas de checkout, login y desbloqueo |
| **CORS restringido con whitelist** | [`lib/cors.js`](lib/cors.js) | Cabeceras de seguridad e idempotencia |
| **Índice server-side de leads** | [`lib/leads.js`](lib/leads.js) | Caché de búsqueda en memoria para API |
| **Sanitización, escape HTML y View Transitions** | [`modules/00-security.js`](modules/00-security.js) | `escaparHtml()`, `ejecutarConTransicionSuave()` |
| **Estado reactivo y gestión de sesión** | [`modules/01-state.js`](modules/01-state.js) | `sesionUsuario`, actualización de badge VIP |
| **Notificaciones flotantes (Toasts)** | [`modules/02-toast.js`](modules/02-toast.js) | `mostrarNotificacionToast()`, barra progreso |
| **Carga de catálogo JSON con trace ID** | [`modules/03-api.js`](modules/03-api.js) | `cargarDatosPublicos()`, `x-trace-id` |
| **Filtros de ciudad, precio y búsqueda** | [`modules/04-filters.js`](modules/04-filters.js) | Normalización fonética y actualización de grilla |
| **Carrusel fotográfico y gestos táctiles** | [`modules/05-carousel.js`](modules/05-carousel.js) | Swipe táctil en móvil, drawer de ficha |
| **Renderizado Bento Grid y tarjetas** | [`modules/06-cards.js`](modules/06-cards.js) | `renderizarTarjetas()`, skeletons, botón ver anuncio |
| **Lógica de desbloqueo y revelación de título** | [`modules/07-unlock.js`](modules/07-unlock.js) | `actualizarTarjetaEnElDOM()`, datos revelados |
| **Checkout, planes y reconciliación Wompi** | [`modules/08-checkout.js`](modules/08-checkout.js) | Integración Wompi widget, reintentos post-pago, planes |
| **Efectos visuales, ripple y modo oscuro** | [`modules/09-ui-effects.js`](modules/09-ui-effects.js) | GPU acceleration, parallax sin reflow y temas |
| **Event listeners y atajos de teclado** | [`modules/10-listeners.js`](modules/10-listeners.js) | Orquestación de eventos globales en DOM |
| **Modal de bienvenida VIP y entrega de PIN** | [`modules/11-welcome.js`](modules/11-welcome.js) | `abrirModalBienvenidaVIP()`, guía de PIN |
| **Alertas Web Push nativas PWA (Cero variables)** | [`modules/12-push.js`](modules/12-push.js) | `activarNotificacionesPush()`, `inicializarBotonPush()` |
| **Clave pública VAPID dinámica** | [`api/notifications/vapid-public-key.js`](api/notifications/vapid-public-key.js) | GET clave pública sin quemar tokens en frontend |
| **Registro de suscripciones Push** | [`api/notifications/subscribe.js`](api/notifications/subscribe.js) | POST registro de endpoints y claves W3C Push |
| **Despacho masivo de notificaciones** | [`api/notifications/dispatch.js`](api/notifications/dispatch.js) | POST emisión server-to-server con `x-internal-secret` |
| **Persistencia y deduplicación Push** | [`lib/push-subscriptions.js`](lib/push-subscriptions.js) | Almacén híbrido Firestore/local y hash SHA-256 |
| **Telemetría y Perro Guardián serverless** | [`api/telemetry/report.js`](api/telemetry/report.js) | Ingesta no bloqueante con ofuscación PII/PCI |
| **Perro Guardián y reporte en cliente** | [`modules/00-security.js`](modules/00-security.js) | `inicializarPerroGuardian()`, `sendBeacon` |
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
├── style.min.css               # Hoja de estilos compilada y balanceada (103.2 KB, -27%)
├── app.js                      # Controlador orquestador del frontend
├── app.min.js                  # Script compilado y minificado (-13%)
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
│   └── 11-welcome.js           # Modal de bienvenida y experiencia inicial
├── styles/                     # Módulos CSS especializados (< 500 líneas)
│   ├── 01-tokens.css           # Fuentes y tokens de diseño HSL
│   ├── 02-base.css             # Reseteo y tipografía global
│   ├── 03-header.css           # Cabecera institucional y branding
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
│   └── 16-utilities.css        # Utilidades visuales finales sin estilos embebidos
├── lib/                        # Librerías privadas compartidas por funciones serverless
│   ├── cors.js                 # CORS estricto para API e idempotencia
│   ├── crypto.js               # Cifrado AES-256-GCM, tokens JWT y comparación constante
│   ├── db.js                   # Ledger de usuarios, créditos y reintentos exponenciales
│   ├── env.js                  # Variables obligatorias y rechazo de secretos de prueba
│   ├── leads.js                # Índice server-side de leads oficiales
│   ├── rate-limiter.js         # Middleware de limitación de tasa en memoria
│   └── validation.js           # Esquemas de validación estricta con Zod
├── api/                        # Funciones Serverless en Vercel
│   ├── payments/
│   │   ├── create-order.js     # Creación de orden y firma de integridad Wompi
│   │   └── webhook-wompi.js    # Receptor de eventos Wompi con validación HMAC
│   ├── auth/
│   │   ├── session.js          # Inicio de sesión por PIN y reconciliación Wompi
│   │   └── recover.js          # Recuperación segura mediante enlace temporal firmado
│   ├── leads/
│   │   └── unlock.js           # Desbloqueo de leads con deducción atómica de crédito
│   └── user/
│       └── balance.js          # Consulta de saldo, perfil y leads desbloqueados
├── scripts/
│   ├── build.js                # Compilador y ensamblador modular de CSS y JS
│   ├── validate.js             # Suite de validación DevSecOps en 8 fases
│   ├── test_ledger_wompi.js    # Suite de pruebas unitarias de ledger y pagos
│   └── test_validation_ratelimit.js # Pruebas unitarias de validación Zod y rate limit
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
