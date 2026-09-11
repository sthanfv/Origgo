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
| `api/auth/session.js` | POST /api/auth/session | Login con WhatsApp+PIN, reclamo de sesión post-pago |
| `api/auth/recover.js` | POST /api/auth/recover | Recuperación de PIN por correo electrónico |
| `api/leads/unlock.js` | POST /api/leads/unlock | Desbloqueo seguro de contactos con AES-256-GCM |
| `api/user/balance.js` | GET /api/user/balance | Consulta de saldo y estado del usuario |

### Bibliotecas Backend (lib/)
| Archivo | Descripción |
|---|---|
| `lib/env.js` | Carga de .env, validación de variables, control WOMPI_ENV sandbox/producción |
| `lib/db.js` | Persistencia en Firestore: ledger de usuarios, órdenes, créditos |
| `lib/crypto.js` | Criptografía: JWT, AES-256-GCM, generación de PIN seguro |
| `lib/cors.js` | CORS seguro con whitelist de dominios |
| `lib/rate-limiter.js` | Rate limiting por IP con ventanas deslizantes |
| `lib/validation.js` | Esquemas Zod para validación estricta de inputs |
| `lib/leads.js` | Índice de leads por ID desde archivos JSON |

### Módulos Frontend (modules/)
| Archivo | Descripción |
|---|---|
| `modules/00-security.js` | Helpers: escape HTML, sanitización URLs/teléfonos, logger producción |
| `modules/01-state.js` | Estado global, sesión, badge VIP, inicialización |
| `modules/02-toast.js` | Sistema de notificaciones toast animadas |
| `modules/03-api.js` | Carga de datos JSON, estados de error/vacío |
| `modules/04-filters.js` | Filtros de ciudad, tipo y rango de precio |
| `modules/05-carousel.js` | Carrusel de imágenes con swipe táctil |
| `modules/06-cards.js` | Renderizado de tarjetas bento, skeletons, paginación |
| `modules/07-unlock.js` | Desbloqueo de contactos y actualización del DOM |
| `modules/08-checkout.js` | Modal de checkout, integración widget Wompi |
| `modules/09-ui-effects.js` | Efectos visuales: parallax, animaciones, intersección |
| `modules/10-listeners.js` | Event listeners globales, acordeones, teclado |
| `modules/11-welcome.js` | Modal de bienvenida VIP, privilegios y credenciales |

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

### Configuración y Build
| Archivo | Descripción |
|---|---|
| `config.js` | Configuración pública: nombre, precios, llave Wompi, contacto |
| `scripts/build.js` | Compila modules/ → app.js y styles/ → style.css + minificados |
| `scripts/validate.js` | Suite DevSecOps de 8 fases: sintaxis, CSS, HTML, seguridad, modularidad |
| `scripts/sign-data.js` | Firma HMAC-SHA256 de archivos JSON de datos |
| `vercel.json` | Rutas, cabeceras OWASP, CSP, rewrites para Vercel |
| `.env.example` | Plantilla de variables de entorno con documentación |
| `docs/INTEGRACIONES_EXTERNAS.md` | Manual paso a paso para integraciones externas ($0 coste) |
