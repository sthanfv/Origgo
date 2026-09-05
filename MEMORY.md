# 🧠 MEMORY.md — Origgo (Showcase & Ledger de Oportunidades Directas)

Última actualización: 2026-09-05 16:30 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Integración del Logotipo Oficial como "O" de la Palabra "Origgo" y Animación Letra por Letra**:
   - Diagnóstico y Solicitud: El usuario solicitó eliminar el logo creado anteriormente que estaba separado a la izquierda, y en su lugar emplear el isotipo de la marca (la 'O' con el radar/flecha) directamente como la primera letra de la palabra "Origgo". La imagen debe permanecer quieta y estática, mientras las letras "r-i-g-g-o" se animan una por una secuencialmente de forma cinematográfica.
   - Solución en `index.html` y `styles/02-base.css`:
     - Se eliminó el isotipo exterior redundante que precedía al título.
     - `.brand-title`: Contiene `.brand-logo-container.brand-initial-o-wrap` con la imagen `./assets/img/origgo-icon.svg` (36×36 px, estática, con sombra esmeralda `drop-shadow(0 0 10px rgba(16, 185, 129, 0.45))`).
     - Cada letra de `.brand-letters-riggo` se maquetó como un `<span class="brand-letter" style="--char-i: 1..5;">` con animación escalonada `animLetterAppear` mediante retardo dinámico `animation-delay: calc(0.12s + var(--char-i) * 0.08s)`.
     - Preservación de selectores críticos: Se mantuvieron `.brand-logo-container` y `.brand-iso-svg` con sus dimensiones intactas garantizando compatibilidad 100% con la suite DevSecOps.

2. **Remediación de Vulnerabilidades de la Auditoría DevSecOps**:
   - **Control de Acceso CORS Centralizado (`api/lib/cors.js`)**: Creado módulo con lista blanca estricta (`DOMINIOS_PERMITIDOS`: `origgo.vercel.app`, `origgo.online`, `www.origgo.online`, entornos locales) erradicando `Access-Control-Allow-Origin: *` en `api/auth/session.js`, `api/payments/create-order.js`, `api/leads/unlock.js`, `api/user/balance.js` y `api/payments/verify.js`.
   - **Eliminación de CORS en Webhooks (`api/payments/webhook-wompi.js`)**: Al ser peticiones server-to-server bancarias, se removió la cabecera innecesaria y se aisló el fallback de firma exclusivamente para `process.env.NODE_ENV === 'test'`.
   - **Generación Criptográficamente Segura de PIN (`api/lib/crypto.js`)**: Se erradicó la derivación del PIN a partir de los últimos 4 dígitos del celular. Ahora genera un PIN de 4 dígitos verdaderamente aleatorio mediante `crypto.randomInt(1000, 9999)` bajo estándar Zero-Trust.
   - **Erradicación de Secretos Hardcodeados en Producción**: `JWT_SECRET` y `LEADS_ENCRYPTION_KEY` exigen estrictamente variables de entorno en producción tanto en `api/auth/session.js`, `api/leads/unlock.js` como en `api/user/balance.js`.
   - **Aislamiento de Carga de Cuenta de Servicio (`api/lib/db.js`)**: Se condicionó la búsqueda del archivo `service-account.json` para que nunca se intente cargar en producción, exigiendo credenciales de entorno (`FIREBASE_SERVICE_ACCOUNT_BASE64`) o ADC.
   - **Sanitización contra XSS (`modules/11-welcome.js`)**: Se envolvió la variable territorial `ciudad` con `escaparHtml()` en interpolaciones de `innerHTML`.
   - **Content-Security-Policy (CSP) en `vercel.json`**: Se agregó cabecera `Content-Security-Policy` estricta para Vercel Edge.
   - **Service Worker Versionado (`sw.js`)**: Se incrementó a `origgo-v2` y se actualizaron los recursos críticos para cachear exclusivamente activos minificados (`app.min.js`, `style.min.css`) e icono SVG.

---

## 2. ¿Por qué cambió?

- **Unificación Visual de Marca**: El usuario requirió que el logo fuera parte intrínseca de la palabra, simplificando la barra de navegación y ofreciendo una animación tipográfica distintiva letra por letra.
- **Blindaje DevSecOps Post-Auditoría**: Cumplimiento estricto del plan de remediación aprobado, cerrando vectores de ataque (CORS wildcard, predecibilidad de PIN, inyección XSS y exposición potencial de credenciales).

---

## 3. Archivos Afectados

- `index.html`: Integración del isotipo como 'O' y letras animables individuales de 'riggo'.
- `styles/02-base.css`: Estilos de `.brand-title`, `.brand-initial-o-wrap`, `.brand-letter` y keyframes (334 líneas, < 500).
- `api/lib/cors.js`: Nuevo módulo de CORS con lista blanca (40 líneas, < 500).
- `api/lib/crypto.js`: PIN con `crypto.randomInt` (197 líneas).
- `api/lib/db.js`: Aislamiento de carga de archivo de credenciales.
- `api/auth/session.js`: CORS restringido y validación de `JWT_SECRET`.
- `api/leads/unlock.js`: CORS restringido y eliminación de llaves residuales en producción.
- `api/payments/create-order.js`: CORS restringido y validación de secretos de Wompi.
- `api/payments/webhook-wompi.js`: Eliminación de CORS y aislamiento de fallback a test.
- `api/payments/verify.js`: CORS restringido.
- `api/user/balance.js`: CORS restringido y validación de `JWT_SECRET`.
- `modules/11-welcome.js`: Sanitización con `escaparHtml()` (194 líneas).
- `sw.js`: Versión `origgo-v2` y caché de minificados.
- `vercel.json`: Cabecera CSP agregada.
- `style.css` y `style.min.css`: Recompilados (92.5 KB minificado).
- `app.js` y `app.min.js`: Recompilados (109.8 KB minificado).
- `MEMORY.md`: Bitácora actualizada.

---

## 4. Decisiones Técnicas Tomadas

- **Animación Escalonada CSS Pura**: Se utilizó CSS Grid/Flexbox y variables CSS (`--char-i`) para la animación de entrada letra por letra sin añadir dependencias JS externas (peso 0 KB adicional).
- **Inmutabilidad de Pruebas**: La suite de pruebas de 8 fases (`npm test`) se preservó funcionando al 100% (12/12 pruebas unitarias de pasarela y ledger aprobadas).
- **Lista Blanca de Dominios**: Preparada proactivamente para el futuro dominio oficial `origgo.online` y `www.origgo.online`.

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% (0 errores).
- **Límite de Líneas**: Ningún archivo supera las 500 líneas en `modules/` ni en `styles/`.
- **Identidad de Marca**: Origgo desplegado con la "O" de radar estática y la animación letra por letra de "riggo".
- **Seguridad**: AES-256-GCM, tokens JWT firmados, CORS con whitelist, CSP activo y generación de PIN aleatoria.
