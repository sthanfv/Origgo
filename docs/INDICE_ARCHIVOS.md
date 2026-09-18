# 📂 Índice Maestro de Archivos — Ecosistema Origgo

Última actualización: 2026-09-08

> Referencia rápida para localizar cualquier componente del sistema.
> Cada entrada indica qué archivo es, qué hace y dónde encontrarlo.

---

## 🕷️ Scraper — `ofertas-hunter-pro/`

### Motor Principal
| Archivo | Descripción |
|---|---|
| `index.js` | Orquestador principal: ciclos de scraping, deduplicación, circuit breaker, retry |
| `scraper.js` | Wrapper ligero que lanza el motor principal |
| `config.js` | Configuración central: intervalos, timeouts, rutas, pool de User-Agents |
| `db.js` | Base de datos SQLite: esquema de leads, CRUD, deduplicación, TTL, purgado |
| `ecosystem.config.js` | Configuración de PM2 para el daemon en el teléfono |

### Adaptadores de Portales Inmobiliarios
| Archivo | Descripción |
|---|---|
| `adapters/fincaraiz.js` | Punto de entrada del adaptador FincaRaíz |
| `adapters/fincaraiz/index.js` | Orquestador del adaptador FincaRaíz |
| `adapters/fincaraiz/client.js` | Cliente HTTP con reintentos exponenciales para la API de FincaRaíz |
| `adapters/fincaraiz/parser.js` | Extractor determinista: detección de propietarios, regex de celulares, normalización |
| `adapters/fincaraiz/config.js` | Parámetros de red, User-Agents y lista negra de palabras de agencias |
| `adapters/metrocuadrado.js` | Punto de entrada del adaptador Metrocuadrado |
| `adapters/metrocuadrado/` | Módulos del adaptador Metrocuadrado (client, parser, config) |

### Publicación y Entrega
| Archivo | Descripción |
|---|---|
| `publisher_web.js` | Publica JSON cifrado a GitHub → Vercel. Ofusca títulos, firma HMAC-SHA256 |
| `telegram.js` | Envía alertas, resúmenes y backups a Telegram (respaldo off-device) |
| `telegram_bot.js` | Bot interactivo de Telegram para control remoto del scraper |
| `daily_digest.js` | Genera resúmenes diarios de operación y los envía por Telegram |
| `delivery_resend.js` | Envío de correos transaccionales con API de Resend |
| `cloud_client.js` | Cliente genérico para subir datos a la nube |
| `backup_cloud.js` | Respaldo automático de la BD a la nube (inmune a muerte súbita del J7) |

### Inteligencia y Análisis
| Archivo | Descripción |
|---|---|
| `categorizer.js` | Clasificador de leads por tipo de inmueble y operación |
| `transformer.js` | Transformaciones y normalización de datos crudos |
| `data_contract.js` | Validación contractual: verifica que un lead sea comercialmente vendible |
| `data_health.js` | Monitor de salud de datos: integridad, completitud, anomalías |
| `analytics.js` | Métricas de operación: leads/hora, tasa de éxito, distribución geográfica |
| `metrics.js` | Contadores internos de rendimiento por adaptador |
| `urgency_detector.js` | Detecta rebajas de precio y oportunidades urgentes |
| `market_arbitrage.js` | Detección de discrepancias de precio entre portales |
| `validator.js` | Validaciones de formato y estructura de datos |

### Resiliencia y Seguridad
| Archivo | Descripción |
|---|---|
| `resilience.js` | Circuit breaker, retry con backoff exponencial + jitter anti-bloqueo |
| `adaptive_limiter.js` | Limitador adaptativo de velocidad según respuesta del servidor |
| `http_client.js` | Cliente HTTP base con protección de memoria (8MB), detección de 403/429 |
| `stealth.js` | Fingerprinting anti-detección: randomización de headers y timings |
| `sentinel.js` | Centinela de seguridad: detección de bloqueos y alertas |
| `error_inspector.js` | Inspector forense de errores: diagnóstico automático de fallos |
| `watchdog_hardware.js` | Perro guardián del J7: batería, cargador, temperatura térmica |
| `worker_pool.js` | Pool de workers para procesamiento paralelo |
| `dispatcher.js` | Despacho de leads procesados a los canales de salida |

### Despliegue (scripts/)
| Archivo | Descripción |
|---|---|
| `deploy.ps1` | Script PowerShell para desplegar al teléfono vía ADB/SSH |
| `scripts/deploy_*.js` | Scripts de despliegue automatizado al servidor Android |

---

## 🌐 Portal Web — `hunter-portal-showcase/`

### Endpoints Serverless (api/)
| Archivo | Ruta API | Descripción |
|---|---|---|
| `api/payments/create-order.js` | POST /api/payments/create-order | Crea órdenes, firma integridad Wompi |
| `api/payments/webhook-wompi.js` | POST /api/payments/webhook-wompi | Recibe eventos asíncronos de Wompi, acredita créditos |
| `api/payments/reconcile-cron.js` | GET/POST /api/payments/reconcile-cron | Conciliación periódica Vercel Cron Fail-Safe de pagos PENDING |
| `api/auth/session.js` | POST /api/auth/session | Login con WhatsApp+PIN, reclamo de sesión post-pago |
| `api/auth/challenge.js` | GET /api/auth/challenge | Emisión de desafíos anti-fuerza bruta PoW y Cloudflare Turnstile |
| `api/auth/recover.js` | POST /api/auth/recover | Recuperación de PIN por correo electrónico |
| `api/auth.js` | Enrutador Serverless | Despachador unificado para sub-rutas de autenticación en Vercel |
| `lib/auth/welcome-credit.js` | POST /api/auth/welcome-credit | Canje de crédito gratuito de bienvenida ($0 COP) |
| `lib/auth/magic-link.js` | POST /api/auth/magic-link | Generación y despacho de enlace mágico sin contraseña vía Resend |
| `lib/auth/magic-login.js` | POST /api/auth/magic-login | Consumo atómico de token mágico e inicio de sesión transparente |
| `api/leads/unlock.js` | POST /api/leads/unlock | Desbloqueo seguro de contactos con AES-256-GCM |
| `api/user/balance.js` | GET /api/user/balance | Consulta de saldo y estado del usuario |
| `api/media/proxy.js` | GET /api/media/proxy | Proxy de medios edge anti-SSRF y optimización de caché |
| `api/notifications/vapid-public-key.js` | GET /api/notifications/vapid-public-key | Entrega dinámica de clave pública VAPID (CERO variables frontend) |
| `api/notifications/subscribe.js` | POST /api/notifications/subscribe | Registro de suscripciones W3C Push API |
| `api/notifications/dispatch.js` | POST /api/notifications/dispatch | Despacho masivo de alertas push (protegido con secreto interno) |
| `api/telemetry/report.js` | POST /api/telemetry/report | Perro Guardián serverless: ingesta de errores cliente con desinfección PII |

### Bibliotecas Backend (lib/)
| Archivo | Descripción |
|---|---|
| `lib/env.js` | Carga de .env, validación de variables, control WOMPI_ENV sandbox/producción |
| `lib/db.js` | Persistencia en Firestore: ledger de usuarios, órdenes, créditos |
| `lib/crypto.js` | Criptografía: JWT, AES-256-GCM, Keyring multi-versión, generación de PIN seguro |
| `lib/challenge.js` | Generador y verificador de Proof-of-Work criptográfico y Cloudflare Turnstile |
| `lib/cors.js` | CORS seguro con whitelist de dominios |
| `lib/rate-limiter.js` | Rate limiting por IP con ventanas deslizantes y Upstash Redis distribuido |
| `lib/idempotency.js` | Idempotencia distribuida con Upstash Redis REST, candados atómicos NX y fail-safe |
| `lib/validation.js` | Esquemas Zod para validación estricta de inputs |
| `lib/leads.js` | Índice de leads por ID desde archivos JSON |
| `lib/push-subscriptions.js` | Almacén y persistencia de suscripciones Web Push con deduplicación |
| `lib/email-templates.js` | Plantillas de correos transaccionales bilingües (Resend) con Magic Links |

### Módulos Frontend (modules/)
| Archivo | Descripción |
|---|---|
| `modules/00-security.js` | Helpers: escape HTML, sanitización URLs/teléfonos, logger producción |
| `modules/01-state.js` | Estado global, sesión, badge VIP, inicialización |
| `modules/02-toast.js` | Sistema de notificaciones toast animadas |
| `modules/03-api.js` | Carga de datos JSON, estados de error/vacío |
| `modules/04-filters.js` | Filtros de ciudad, tipo y rango de precio |
| `modules/05-carousel.js` | Carrusel de imágenes con swipe táctil |
| `modules/06-cards.js` | Renderizado de tarjetas bento, skeletons, traducción títulos |
| `modules/07-unlock.js` | Desbloqueo de contactos, DOM y ficha técnica |
| `modules/08-checkout.js` | Modal de checkout, integración widget Wompi |
| `modules/09-ui-effects.js` | Efectos visuales: parallax, animaciones, intersección |
| `modules/10-listeners.js` | Event listeners globales, acordeones, teclado |
| `modules/11-welcome.js` | Modal de bienvenida VIP, privilegios y credenciales |
| `modules/12-push.js` | Gestión de suscripciones Web Push nativas PWA en memoria |
| `modules/13-i18n.js` | Motor bilingüe ES/EN, conversión dinámica USD, View Transitions |

### Estilos CSS (styles/)
| Archivo | Descripción |
|---|---|
| `styles/01-tokens.css` | Variables CSS: colores, tipografía, breakpoints, sombras |
| `styles/02-base.css` | Reset, body, tipografía base, animaciones secuenciales |
| `styles/03-header.css` | Header fijo, navegación, logo, badge VIP |
| `styles/04-command-bar.css` | Barra de búsqueda y filtros |
| `styles/05-hero.css` | Sección hero con estadísticas |
| `styles/06-bento-grid.css` | Grilla bento responsiva, transiciones de entrada |
| `styles/07-cards.css` | Tarjetas de inmuebles, fotos, badges, botones |
| `styles/08-slideup.css` | Drawer de ficha técnica, botones de contacto, utilidades |
| `styles/09-checkout-modal.css` | Modal de checkout y planes |
| `styles/10-checkout-plans.css` | Tarjetas de planes de precios |
| `styles/11-mobile.css` | Responsive y adaptaciones móviles |
| `styles/12-sidebar.css` | Menú lateral de navegación |
| `styles/13-footer.css` | Footer, isotipo, enlaces legales |
| `styles/14-toast.css` | Notificaciones toast |
| `styles/15-welcome-modal.css` | Modal de bienvenida VIP |
| `styles/16-utilities.css` | Utilidades: `.is-hidden`, íconos compactos |
| `styles/17-push-modal.css` | Modal institucional de activación de alertas Web Push |
| `styles/18-i18n.css` | Switch flotante y estilos de internacionalización |

### Pruebas Automatizadas (tests/)
| Archivo | Descripción |
|---|---|
| `tests/freemium_welcome_credit.test.js` | Suite de validación de canje freemium $0 COP y protección anti-abuso |
| `tests/magic_link_auth.test.js` | Suite de autenticación sin contraseña con Magic Link y consumo de token |
| `tests/anti_bruteforce.test.js` | Desafíos de seguridad anti-fuerza bruta invisible (PoW / Turnstile) |
| `tests/crypto_rotation.test.js` | Rotación criptográfica y versionado de clave AES-256 (KID) |
| `tests/reconciliation_cron.test.js` | Conciliación periódica Vercel Cron Fail-Safe |
| `tests/bilingual_infrastructure.test.js` | Infraestructura bilingüe: correos, push, zod, catálogo |
| `tests/web_push.test.js` | Protocolo VAPID y suscripciones push |
| `tests/r2_integration.test.js` | Sincronización y fallback Cloudflare R2 |
| `tests/image_proxy.test.js` | Proxy de medios edge anti-SSRF |
| `tests/whatsapp_template.test.js` | Generación de plantillas WhatsApp bilingües |
| `tests/fair_usage_quota.test.js` | Límite de uso justo diario (35 leads/día) |
| `tests/filters_sorting.test.js` | Ordenamiento táctico por precio/m² |
| `tests/telemetry_watchdog.test.js` | Perro Guardián y reporte serverless |

### Configuración y Build
| Archivo | Descripción |
|---|---|
| `config.js` | Configuración pública: nombre, precios, llave Wompi, contacto |
| `scripts/build.js` | Compila modules/ → app.js y styles/ → style.css + minificados |
| `scripts/validate.js` | Suite DevSecOps de 8 fases: sintaxis, CSS, HTML, seguridad, modularidad |
| `scripts/sign-data.js` | Firma HMAC-SHA256 de archivos JSON de datos |
| `vercel.json` | Rutas, cabeceras OWASP, CSP, rewrites y Vercel Cron |
| `.env.example` | Plantilla de variables de entorno con documentación |
| `docs/INTEGRACIONES_EXTERNAS.md` | Manual paso a paso para integraciones externas ($0 coste) |
