# 🧠 MEMORY.md — Hunter Pro Intelligence (Showcase & Ledger)

Última actualización: 2026-09-05 00:15 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Blindaje Financiero y Cierre de Brecha de Reclamo Gratuito (`api/auth/session.js`)**:
   - Se erradicó la asignación ciega de créditos por código de texto.
   - El reclamo de referencias (`claim_reference`) ahora ejecuta una verificación directa server-to-server contra la API oficial de Wompi (`/v1/transactions?reference=...`) usando `WOMPI_PRIVATE_KEY`.
   - Se exige que la transacción tenga estado formal `APPROVED` y que el monto pagado coincida al centavo con el valor legal del producto adquirido antes de registrar créditos o activar membresías VIP.

2. **Erradicación Total del Bypass de PIN (`api/lib/db.js`)**:
   - Se eliminó de raíz la comprobación que permitía autenticar a cualquier usuario cuyos dígitos de PIN coincidieran con los últimos 4 dígitos de su número celular (`digitsInput === phoneClean.slice(-4)`).
   - Ahora se requiere estrictamente el PIN criptográfico secreto de 4 dígitos o el token JWT firmado con HMAC-SHA256.

3. **Resiliencia ante el Caos y Reintentos con Backoff Exponencial (`api/lib/db.js`)**:
   - Se implementó la función envolvente `withRetry(operacion, maxIntentos = 3)` con backoff exponencial y *jitter* aleatorio ($\min(200 \times 2^i, 2000) + \text{random}(0, 150)$ ms).
   - Se aplicó a todas las operaciones transaccionales y de lectura en Google Cloud Firestore (`getUserByPhone`, `addCredits`, `unlockLead`, `recordTransaction`, `isTransactionProcessed`, `savePendingOrder` y `getPendingOrder`), absorbiendo micro-cortes de red y picos de latencia sin emitir HTTP 500 al cliente.

4. **Middleware de Rate Limiting en Memoria (`api/lib/rate-limiter.js`)**:
   - Nuevo middleware de limitación de tasa basado en ventana deslizante en memoria con soporte de proxies (`x-forwarded-for`, `x-real-ip`) y cabeceras estándar (`X-RateLimit-*`, `Retry-After`).
   - Integrado en todos los endpoints sensibles:
     - `api/payments/create-order.js`: máx 12 órdenes/minuto por IP.
     - `api/auth/session.js`: máx 10 reclamos de referencia/minuto y máx 8 intentos erróneos de PIN por 15 min.
     - `api/leads/unlock.js`: máx 30 desbloqueos/minuto por IP.
     - `api/payments/webhook-wompi.js`: máx 60 peticiones/minuto por IP.
     - `api/user/balance.js`: máx 60 consultas/minuto por IP.

5. **Principio Fail-Closed en Producción**:
   - Bloqueo inmediato de arranque si faltan variables críticas (`JWT_SECRET`, `LEADS_ENCRYPTION_KEY`, `WOMPI_INTEGRITY_SECRET`) cuando `NODE_ENV === 'production'`.

6. **Cabeceras de Seguridad Globales OWASP (`vercel.json`)**:
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   - Políticas de caché CDN optimizadas para JSON (300s + stale-while-revalidate) y estáticos (86400s).

7. **Desacoplamiento y Modularización Arquitectónica (< 500 Líneas por Módulo)**:
   - **JavaScript (`modules/`)**: Se dividió el monolito `app.js` (2,559 líneas) en 10 submódulos altamente especializados:
     - `01-state.js` (297 líneas): Estado global, sesión JWT y PIN.
     - `02-toast.js` (227 líneas): Notificaciones luxury con ambient glow y swipe.
     - `03-api.js` (41 líneas): Cliente HTTP centralizado con `x-trace-id`.
     - `04-filters.js` (180 líneas): Búsqueda inteligente, omnibox y ciudades.
     - `05-carousel.js` (105 líneas): Carruseles fotográficos y drawer slide-up.
     - `06-cards.js` (481 líneas): Renderizado Bento Grid, skeletons y precios.
     - `07-unlock.js` (264 líneas): Desbloqueo atómico y WhatsApp directo.
     - `08-checkout.js` (325 líneas): Modal de pago y pasarela Wompi.
     - `09-ui-effects.js` (248 líneas): Háptica, ripple, parallax GPU y temas.
     - `10-listeners.js` (463 líneas): Event listeners DOM y atajos de teclado.
   - **CSS (`styles/`)**: Se dividió `style.css` (4,662 líneas) en 14 submódulos semánticos (`01-tokens.css` a `14-toast.css`), todos bajo 475 líneas.
   - **Compilador Determinista (`scripts/build.js`)**: Ensambla los módulos en orden riguroso hacia `style.css` y `app.js`, generando `style.min.css` (80.6 KB, -30%) y `app.min.js` (94.4 KB, -15%).

8. **Suite de Validación DevSecOps Ampliada a 8 Fases (`scripts/validate.js`)**:
   - Fase 1: Sintaxis JS (23 archivos analizados con `node --check`).
   - Fase 2: Integridad y balance CSS (14 submódulos verificados).
   - Fase 3: Marcado HTML y cabeceras OWASP en `vercel.json`.
   - Fase 4: Contratos JSON y cifrado AES-256 (`iv:tag:cipher`).
   - Fase 5: Suite Wompi y ledger (12/12 pruebas unitarias al 100%).
   - Fase 6: Auditoría antifraude en `claim_reference` (rechazo con HTTP 403).
   - Fase 7: Auditoría de PIN estricto (rechazo de bypass por celular).
   - Fase 8: Auditoría de modularidad (< 500 líneas por módulo comprobado).

9. **Creación del Documento de Arquitectura (`ARCHITECTURE.md`)**:
   - Documentada la arquitectura en 4 capas, tolerancia a fallos y diagramas de flujo.

---

## 2. ¿Por qué cambió?

- **Reclamo Crítico del Usuario**: Solicitó auditar exhaustivamente la seguridad financiera del portal y las transacciones de Wompi, eliminar archivos monolíticos gigantes inmanejables, diseñar un sistema preparado para un "mundo caótico" (reintentos, colas, rate limiting, anti-DDoS, anti-suplantación) y aplicar la suite de validación pre-commit del Ecosistema Desmulta con commits 100% en español.

---

## 3. Archivos Afectados

- `api/auth/session.js`: Reconciliación oficial server-to-server con Wompi API, rate limiting y fail-closed.
- `api/lib/db.js`: Erradicación del bypass de PIN y envoltorio `withRetry` con backoff exponencial y jitter en Firestore.
- `api/lib/rate-limiter.js`: Nuevo middleware de limitación de tasa por IP/clave.
- `api/payments/create-order.js`: Rate limiting anti-DDoS y fail-closed.
- `api/payments/webhook-wompi.js`: Rate limiting para webhooks y fail-closed.
- `api/leads/unlock.js`: Rate limiting y descifrado seguro fail-closed.
- `api/user/balance.js`: Rate limiting en consultas de saldo y JWT seguro.
- `vercel.json`: Cabeceras de seguridad globales OWASP y políticas de caché CDN.
- `styles/` (14 submódulos): `01-tokens.css` a `14-toast.css` (< 475 líneas cada uno).
- `modules/` (10 submódulos): `01-state.js` a `10-listeners.js` (< 481 líneas cada uno).
- `scripts/build.js`: Compilador y ensamblador modular determinista.
- `scripts/validate.js`: Suite DevSecOps ampliada a 8 fases.
- `scripts/test_ledger_wompi.js`: Pruebas unitarias de pasarela y criptografía.
- `README.md`: Documentación técnica sincronizada.
- `ARCHITECTURE.md`: Documento de arquitectura técnica en 4 capas.
- `MEMORY.md`: Bitácora de memoria persistente actualizada.

---

## 4. Decisiones Técnicas Tomadas

- **Modularización sin Dependencias Pesadas**: En lugar de introducir bundlers complejos como Webpack o Vite que añadirían cientos de megabytes en `node_modules` y romperían el principio de coste $0 y ligereza, se diseñó un ensamblador determinista nativo en `scripts/build.js` que concatena los submódulos, valida la sintaxis con `node --check` y genera minificados óptimos para el CDN.
- **Fail-Closed Criptográfico**: Si en producción no se configuran las variables de entorno críticas, el sistema aborta de inmediato en lugar de caer en cadenas de texto públicas de prueba, eliminando la vulnerabilidad de claves quemadas en código.
- **Reconciliación Directa Wompi**: En `claim_reference`, la consulta directa a `https://production.wompi.co/v1/transactions?reference=...` con `WOMPI_PRIVATE_KEY` garantiza que el dinero esté efectivamente en la cuenta de Bancolombia/Wompi antes de emitir cualquier crédito en el ledger.

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% con 0 errores.
- **Seguridad**: Cero brechas financieras, bypass de PIN eliminado, Zero-Trust en reposo.
- **Modularidad**: Ningún módulo de desarrollo excede las 500 líneas de código.
- **Git**: Listo para commit y despliegue a producción.
