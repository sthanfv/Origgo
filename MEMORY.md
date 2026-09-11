# MEMORY.md — Origgo (Showcase y Ledger de Oportunidades Directas)

Última actualización: 2026-09-10 22:08 (GMT-5)

---

## 1. Qué cambió

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
- `api/leads/unlock.js`: Devuelve `datosRevelados` (título original, barrio, ubicación completa).
- `modules/07-unlock.js`: Recibe y renderiza `datosRevelados` en la tarjeta tras desbloqueo.
- `modules/11-welcome.js`: PIN real o instrucciones de recuperación en vez de "PIN protegido".
- `docs/INDICE_ARCHIVOS.md`: Copia del índice maestro.
- `app.js`, `app.min.js`: Recompilados.

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
