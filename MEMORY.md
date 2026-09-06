# 🧠 MEMORY.md — Origgo (Showcase & Ledger de Oportunidades Directas)

Última actualización: 2026-09-06 13:10 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Migración Segura y Adaptación desde Entorno de Pruebas**:
   - Se descartaron por completo las envolturas de desarrollo de Vite/React/AI Studio, manteniendo la arquitectura pura Vanilla JS + Vercel Serverless.
   - Se preservaron intactos los secretos criptográficos maestros en reposo (`LEADS_ENCRYPTION_KEY`, `JWT_SECRET`).

2. **Capa de Validación Robusta con Zod en Endpoints Serverless**:
   - Integración de esquemas de validación Zod para teléfonos colombianos (`3XXXXXXXXX`), emails RFC 5322, PINs de 4 dígitos, tipos de plan y montos en todos los handlers de `api/`.
   - Manejo centralizado de variables de entorno mediante `lib/env.js`.

3. **Recuperación Segura de PIN vía Correo Electrónico (`api/auth/recover.js`)**:
   - Despacho transaccional del PIN de 4 dígitos mediante Resend API con plantilla HTML corporativa de Origgo.
   - Protección contra abusos mediante limitación de tasa diaria en memoria (máximo 3 recuperaciones por día por usuario/IP).
   - Formulario reactivo en el modal de inicio de sesión.

4. **Mejoras en Capa de Persistencia y Ledger (`lib/db.js`)**:
   - Nuevas funciones `getUserByEmail(email)` y `getPendingOrderByEmail(email)`.
   - Compatibilidad robusta en inicialización de Firestore tolerando claves privadas PEM escapadas, en Base64 o JSON crudo.
   - Registro de `customer_email` en transacciones y ledger.

5. **Experiencia de Usuario, Rendimiento y Branding Unificado (Origgo)**:
   - **Eliminación de Vestigios del Branding Pasado**: Isotipo SVG oficial de Origgo en footer, menú lateral, modal de bienvenida y PWA. Erradicación física de `assets/img/hunter_radar_logo.svg`.
   - **Kerning y Tipografía Óptica en Footer**: Tipografía continua con espaciado óptico para la identidad "Origgo".
   - **Conmutación Atómica de Tema sin Congelamiento (*Zero-Jank*)**: Eliminación de transiciones globales `*`.
   - **Sincronización Dinámica de Filtros por Ciudad**: Dropdown de ciudades desde catálogo cargado con `DICCIONARIO_TERMINOS`.
   - **Anti-Rebote en Desbloqueo de Leads**: Conjunto `desbloqueosEnProgreso` para evitar peticiones duplicadas.
   - **Parseo Defensivo No-JSON**: Protección ante respuestas HTML inesperadas de CDN.

6. **PWA y Caché del Service Worker**:
   - Elevación del Service Worker a `origgo-v5` con precaché optimizado y bypass de endpoints `/api/*`.
   - `manifest.json` apuntando a `./assets/img/origgo-icon.svg`.

7. **Ampliación de la Suite DevSecOps de 8 Fases (`scripts/validate.js`)**:
   - Creación y ejecución de `scripts/test_validation_ratelimit.js`.
   - Integración formal en la Fase 5 del pipeline `npm test`.

8. **Resolución Definitiva del Fallo de Despliegue en Vercel — CRÍTICO**:
   - **Causa 1 (RESUELTA)**: El hook `"prepare": "husky"` en `package.json` provocaba `command not found: husky` en Vercel. El script fue **eliminado completamente** de `package.json`.
   - **Causa 2 (RESUELTA)**: Vercel rutea automáticamente **todos** los archivos `.js` en `api/**` como Serverless Functions públicamente enrutables. Los archivos de utilidades en `api/lib/` causaban fallos de build porque no tienen handler exportado.
   - **Solución**: Se movió el directorio completo `api/lib/` a `lib/` en la raíz del proyecto. `api/lib/` eliminado. Todas las rutas de importación en `api/**/*.js` y `scripts/` actualizadas a las rutas correctas.
   - **Bug adicional corregido en `scripts/validate.js`**: Línea 263 tenía `path.join(ROOT_DIR, 'api', 'lib', 'db.js')` → corregida a `path.join(ROOT_DIR, 'lib', 'db.js')`. Línea 250 usa `path.join(ROOT_DIR, 'lib', 'db')` para evitar conflictos de caché de módulos Node.js.

9. **Corrección Tipográfica en Llave Pública Wompi Sandbox**:
   - Llave pública oficial sincronizada: `pub_test_PQAm6bjXtS4ScbCpBU058xY0v1TPFXfA` en `config.js`, `api/payments/create-order.js` y `.env`.

10. **Erradicación de Advertencias de Git (`.gitattributes`)**:
    - `.gitattributes` creado con normalización `* text=auto eol=lf`.

---

## 2. ¿Por qué cambió?

- **Requerimiento del Usuario**: Integrar de manera segura las funcionalidades del entorno de pruebas, erradicando vestigios del branding antiguo y garantizando el correcto funcionamiento del backend en producción (Vercel + Firestore + Wompi).
- **Seguridad en Tiempo de Ejecución**: Blindar las APIs serverless contra inyecciones y cargas malformadas mediante validación Zod.
- **Retención y Recuperación de Usuarios**: Mecanismo seguro de recuperación de PIN por correo electrónico.
- **Compatibilidad con Vercel**: La arquitectura de `api/lib/` es incompatible con el sistema de ruteado automático de Vercel para Serverless Functions.

---

## 3. Archivos Afectados

### Arquitectura de Librerías (CAMBIO CRÍTICO — NUEVA UBICACIÓN EN RAÍZ)
- `lib/cors.js` — NUEVA UBICACIÓN (antes `api/lib/cors.js`). Incluye `hunter-pro.vercel.app` en lista blanca CORS.
- `lib/crypto.js` — NUEVA UBICACIÓN (antes `api/lib/crypto.js`).
- `lib/db.js` — NUEVA UBICACIÓN (antes `api/lib/db.js`).
- `lib/env.js` — NUEVA UBICACIÓN (antes `api/lib/env.js`).
- `lib/rate-limiter.js` — NUEVA UBICACIÓN (antes `api/lib/rate-limiter.js`).
- `lib/validation.js` — NUEVA UBICACIÓN (antes `api/lib/validation.js`).
- `api/lib/` — ELIMINADO COMPLETAMENTE.

### Endpoints Serverless (importaciones actualizadas a `../../lib/`)
- `api/auth/recover.js`, `api/auth/session.js`, `api/leads/unlock.js`
- `api/payments/create-order.js`, `api/payments/verify.js`, `api/payments/webhook-wompi.js`
- `api/user/balance.js`

### Scripts (importaciones actualizadas a `../lib/`)
- `scripts/test_ledger_wompi.js`, `scripts/test_validation_ratelimit.js`
- `scripts/validate.js` — Rutas de auditoría corregidas de `api/lib/` a `lib/`.

### Otros archivos
- `package.json` — Script `prepare` eliminado completamente.
- `.gitattributes` — Normalización LF.
- `config.js` — Llave Wompi corregida.
- `.env`, `.env.example` — Sincronizados con variables Resend y APP_URL.
- `README.md` — Árbol de archivos y fases actualizados.
- `MEMORY.md` — Este archivo.
- `app.js`, `app.min.js`, `style.css`, `style.min.css` — Compilación sincronizada.

---

## 4. Decisiones Técnicas Tomadas

- **Librerías fuera de `api/`**: La ubicación canónica para helpers en Vercel es `lib/` en la raíz o directorios con prefijo `_`. Se eligió `lib/` por claridad semántica.
- **`require(path.join(ROOT_DIR, 'lib', 'db'))` en validate.js**: Uso de ruta absoluta para evitar conflictos de caché de módulos Node.js entre Fase 6 (que carga `api/auth/session` que a su vez requiere `lib/db`) y Fase 7.
- **Validación Estricta Zod en la Frontera**: Cualquier payload mal formado es rechazado con HTTP 400 antes de ejecutar lógica criptográfica o consultar la base de datos.
- **Cero Mutación de Secretos Criptográficos**: Los valores de `LEADS_ENCRYPTION_KEY` y `JWT_SECRET` no se tocaron.
- **Compilación Modular Determinista**: Estricta modularización por debajo de 500 líneas en 11 módulos JS y 15 módulos CSS.

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% (0 errores).
- **Compilación de Producción**: `style.min.css` (95.5 KB, -28%) y `app.min.js` (120.1 KB, -12%) compilados y balanceados.
- **Seguridad OWASP**: Cero secretos expuestos, HSTS, X-Content-Type: nosniff, Frame: DENY, criptografía AES-256-GCM y firmas HMAC validadas.
- **Git Repository**: Commit realizado y publicado en `origin/main`.
- **Vercel**: Despliegue automático activado tras el push. `api/lib/` eliminado y `"prepare"` quitado de `package.json`.

### URL de Eventos Wompi Sandbox (configurar manualmente)
`https://hunter-pro.vercel.app/api/payments/webhook-wompi`
Ingresar en: `comercios.wompi.co/developers` → Eventos → Guardar.
