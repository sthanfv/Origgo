# 🧠 MEMORY.md — Origgo (Showcase & Ledger de Oportunidades Directas)

Última actualización: 2026-09-06 12:25 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Migración Segura y Adaptación desde Entorno de Pruebas**:
   - Se descartaron por completo las envolturas de desarrollo de Vite/React/AI Studio (`src/App.tsx`, `vite.config.ts`, `data/local_db.json`, `bun.lock`), manteniendo la arquitectura pura Vanilla JS + Vercel Serverless.
   - Se preservaron intactos los secretos criptográficos maestros en reposo (`LEADS_ENCRYPTION_KEY`, `JWT_SECRET`).

2. **Capa de Validación Robusta con Zod en Endpoints Serverless (`api/lib/validation.js`)**:
   - Integración de esquemas de validación Zod para teléfonos colombianos (`3XXXXXXXXX`), emails RFC 5322, PINs de 4 dígitos, tipos de plan y montos en `api/payments/create-order.js`, `api/payments/webhook-wompi.js`, `api/auth/session.js`, `api/leads/unlock.js` y `api/auth/recover.js`.
   - Manejo centralizado de variables de entorno mediante `api/lib/env.js`.

3. **Recuperación Segura de PIN vía Correo Electrónico (`api/auth/recover.js`)**:
   - Despacho transaccional del PIN de 4 dígitos mediante Resend API con plantilla HTML corporativa de Origgo.
   - Protección contra abusos mediante limitación de tasa diaria en memoria (máximo 3 recuperaciones por día por usuario/IP).
   - Formulario reactivo en el modal de inicio de sesión (`index.html`, `modules/01-state.js`, `modules/10-listeners.js`).

4. **Mejoras en Capa de Persistencia y Ledger (`api/lib/db.js`)**:
   - Nuevas funciones `getUserByEmail(email)` y `getPendingOrderByEmail(email)`.
   - Compatibilidad robusta en inicialización de Firestore tolerando claves privadas PEM escapadas (`\n`), codificadas en Base64 o JSON crudo.
   - Registro de `customer_email` en transacciones y ledger.

5. **Experiencia de Usuario, Rendimiento y Branding Unificado (Origgo)**:
   - **Eliminación de Vestigios del Branding Pasado**: Sustitución definitiva del logo de la brújula/radar por el isotipo SVG oficial de Origgo en el footer, menú lateral, modal de bienvenida y PWA. Erradicación física del archivo obsoleto `assets/img/hunter_radar_logo.svg`.
   - **Kerning y Tipografía Óptica en Footer (`styles/13-footer.css`)**: Implementación de `.footer-brand-title` con espaciado óptico (`margin-right: -2px`) y tipografía continua para la identidad "Origgo".
   - **Conmutación Atómica de Tema sin Congelamiento (*Zero-Jank*)**: Retiro de transiciones globales `*` en `styles/01-tokens.css` y congelamiento transitorio de transiciones durante la alternancia en `modules/10-listeners.js`.
   - **Sincronización Dinámica de Filtros por Ciudad (`modules/04-filters.js` y `modules/06-cards.js`)**: Sincronización automática de dropdowns de ciudades a partir del catálogo cargado, enriquecida con `DICCIONARIO_TERMINOS`.
   - **Anti-Rebote en Desbloqueo de Leads (`modules/07-unlock.js`)**: Conjunto `desbloqueosEnProgreso` para evitar peticiones duplicadas y estados de carga en el Drawer.
   - **Parseo Defensivo No-JSON (`modules/01-state.js`, `modules/08-checkout.js`)**: Protección ante respuestas con contenido HTML inesperado (páginas de error de CDN).

6. **PWA y Caché del Service Worker**:
   - Elevación del Service Worker a `origgo-v5` con precaché optimizado y bypass de endpoints `/api/*`.
   - Actualización de `manifest.json` apuntando a `./assets/img/origgo-icon.svg`.

7. **Ampliación de la Suite DevSecOps de 8 Fases (`scripts/validate.js`)**:
   - Creación y ejecución de `scripts/test_validation_ratelimit.js` validando esquemas Zod y límites de recuperación.
   - Integración formal en la Fase 5 del pipeline `npm test`.

---

## 2. ¿Por qué cambió?

- **Requerimiento del Usuario**: Integrar de manera segura y probada las funcionalidades desarrolladas en el entorno de pruebas, erradicando vestigios del branding antiguo en el footer y garantizando el correcto funcionamiento del backend.
- **Seguridad en Tiempo de Ejecución**: Blindar las APIs serverless contra inyecciones y cargas malformadas mediante validación de tipos Zod.
- **Retención y Recuperación de Usuarios**: Brindar un mecanismo amigable y seguro para que los usuarios puedan recuperar su PIN olvidado mediante su correo electrónico registrado.
- **Excelencia Visual y Fluidez**: Eliminar los retrasos de renderizado al alternar temas y proporcionar una identidad de marca 100% coherente bajo el nombre Origgo.

---

## 3. Archivos Afectados

- `package.json` y `package-lock.json`: Adición de la dependencia `zod`.
- `api/lib/validation.js`: Esquemas de validación Zod para todas las cargas de entrada.
- `api/lib/env.js`: Helper para lectura normalizada de variables de entorno.
- `api/lib/rate-limiter.js`: Soporte para respuestas personalizadas en rate limiters.
- `api/auth/recover.js`: Endpoint serverless de despacho de PIN por email vía Resend.
- `api/auth/session.js`: Validación con Zod y registro de `customer_email`.
- `api/payments/create-order.js`: Validación con Zod y persistencia de email.
- `api/payments/webhook-wompi.js`: Validación con Zod de payloads de webhook.
- `api/leads/unlock.js`: Validación con Zod de parámetros de desbloqueo.
- `api/lib/db.js`: Soporte de búsqueda por email y resiliencia en credenciales Firestore.
- `modules/01-state.js`: Lógica de recuperación de PIN y parseo defensivo no-JSON.
- `modules/04-filters.js`: Sincronización de ciudades y diccionario de términos.
- `modules/06-cards.js`: Enlace a sincronización de ciudades e iconos vehiculares.
- `modules/07-unlock.js`: Anti-rebote y feedback visual en desbloqueo.
- `modules/08-checkout.js`: Parseo defensivo en respuestas de checkout.
- `modules/10-listeners.js`: Delegación de eventos, sanitización y conmutación instantánea de tema.
- `styles/01-tokens.css`: Eliminación de transiciones globales perjudiciales para el rendimiento.
- `styles/04-command-bar.css`: Ajustes de contraste en autocompletado y selección.
- `styles/11-mobile.css`: Bordes redondeados y glassmorphism en navegación móvil inferior.
- `styles/13-footer.css`: Tipografía continua y alineación óptica del footer Origgo.
- `index.html`: Formulario de recuperación de PIN, isotipo Origgo unificado y atributos de accesibilidad.
- `manifest.json`: Icono PWA actualizado a Origgo.
- `sw.js`: Caché elevado a `origgo-v5`.
- `scripts/test_validation_ratelimit.js`: Suite de pruebas automatizadas Zod y rate limiting.
- `scripts/validate.js`: Fases 1 y 5 actualizadas en la suite DevSecOps.
- `server.js`: Enrutamiento local de endpoints `/api/*` con telemetría.
- `.env.example`: Sincronización de variables de entorno de Resend API y URL.
- `README.md`: Documentación técnica sincronizada.
- `MEMORY.md`: Bitácora persistente actualizada.
- `app.js`, `app.min.js`, `style.css`, `style.min.css`: Compilación sincronizada en producción.

---

## 4. Decisiones Técnicas Tomadas

- **Validación Estricta Zod en la Frontera**: Cualquier payload mal formado es rechazado con HTTP 400 antes de ejecutar lógica criptográfica o consultar la base de datos.
- **Recuperación con Rate Limit Diario**: La recuperación de PIN limita los despachos a 3 por día para prevenir spam y sobrecostos en Resend.
- **Cero Mutación de Secretos Criptográficos**: Se mantuvieron estrictamente los valores de `LEADS_ENCRYPTION_KEY` y `JWT_SECRET` originales del proyecto en producción.
- **Compilación Modular Determinista**: Se mantuvo la modularización estricta por debajo de 500 líneas en los 11 módulos JS y 15 módulos CSS.

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% (0 errores).
- **Compilación de Producción**: `style.min.css` (95.5 KB, -28%) y `app.min.js` (120.1 KB, -12%) compilados y balanceados.
- **Seguridad OWASP**: Cero secretos expuestos, HSTS, X-Content-Type: nosniff, Frame: DENY, criptografía AES-256-GCM y firmas HMAC validadas.
- **Git Repository**: Preparado para commit y sincronización en rama principal (`main`).

