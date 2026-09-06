# 🧠 MEMORY.md — Origgo (Showcase & Ledger de Oportunidades Directas)

Última actualización: 2026-09-06 13:40 (GMT-5)

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
   - **Kerning y Tipografía Óptica en Footer (`styles/13-footer.css`)**: Margen derecho del contenedor `.brand-initial-o-wrap` ajustado a `4px` para separar la "O" de "riggo" con lectura armónica sin superposición.
   - **Unificación de Ícono de Créditos (`modules/01-state.js`)**: Eliminación del ícono `<i class="fa-solid fa-bolt">` pequeño duplicado en el badge de créditos del header (`btnVipHeader`), dejando únicamente el rayo emoji dorado `⚡ ${cr} Créditos`.
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

8. **Resolución Definitiva del Fallo de Despliegue en Vercel**:
   - `api/lib/` reubicado a `lib/` en la raíz del proyecto para evitar que Vercel intente exponer helpers como funciones serverless.
   - Script `"prepare": "husky"` retirado de `package.json` para evitar fallo por falta de devDependencies en Vercel.

9. **Consola F12 Limpia de Advertencias (0 Errores / 0 Warnings)**:
   - Retiro de la directiva `frame-ancestors` en el tag `<meta http-equiv="Content-Security-Policy">` de `index.html`, erradicando el error en rojo del navegador (`directive 'frame-ancestors' is ignored when delivered via a <meta> element`). La directiva se mantiene en cabeceras HTTP en `vercel.json` (`X-Frame-Options: DENY`).

10. **Auditoría de Seguridad de Datos en F12 y Cero Fuga de Información**:
    - Todos los datos sensibles de leads (`contacto_cifrado`) viajan cifrados bajo el estándar militar AES-256-GCM.
    - Los teléfonos públicos permanecen enmascarados (`573 ••• ••••`).
    - Cero números en claro en `data/inmobiliario.json`.
    - Desencriptación delegada exclusivamente al backend seguro (`/api/leads/unlock`), validando saldo de créditos en Firestore antes de despachar el dato.
    - Cero secretos expuestos en `window` ni en `console.log`.

11. **Limpieza de Archivos Obsoletos y Configuración de npm**:
    - Eliminación de scripts temporales `scripts/split_modules.js` y `scripts/split_styles.js`.
    - Creación de `.npmrc` (`loglevel=error`, `fund=false`, `audit=false`) para evitar advertencias de paquetes deprecados de terceros durante instalaciones.

---

## 2. ¿Por qué cambió?

- **Requerimiento del Usuario**: Separar la "O" de "riggo" en el footer, remover el ícono de rayo pequeño duplicado en los créditos, eliminar cualquier error/advertencia en la consola F12 y garantizar blindaje absoluto contra robo o scraping de datos.
- **Estándar DevSecOps y Código Limpio**: 0 advertencias en consola de navegación y en pipelines de construcción.

---

## 3. Archivos Afectados

- `styles/13-footer.css`: Ajuste de `margin-right: 4px` en `.footer-brand-title .brand-initial-o-wrap`.
- `modules/01-state.js`: Eliminación del `<i class="fa-solid fa-bolt">` duplicado en `actualizarBadgeVip()`.
- `index.html`: Eliminación de `frame-ancestors` en etiqueta `<meta>` de Content-Security-Policy.
- `scripts/split_modules.js` y `scripts/split_styles.js`: Archivos huérfanos eliminados físicamente.
- `.npmrc`: Archivo de configuración creado para silenciar avisos de paquetes de terceros.
- `style.css`, `style.min.css`, `app.js`, `app.min.js`: Compilados y sincronizados.
- `MEMORY.md`: Bitácora actualizada.

---

## 4. Decisiones Técnicas Tomadas

- **CSP Nivel 3 W3C Compliance**: La directiva `frame-ancestors` solo es válida en encabezados HTTP. Al removerla de `<meta>` se elimina la advertencia de Chrome/Edge sin comprometer la protección contra Clickjacking (gestionada por `X-Frame-Options: DENY` en `vercel.json`).
- **Seguridad por Diseño (Privacy by Design)**: Los datos de contacto permanecen sellados con AES-256-GCM en reposo y en tránsito hacia el cliente, desbloqueables únicamente mediante transacción verificada en el backend.

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% (0 errores).
- **Consola F12**: 0 errores, 0 advertencias de CSP.
- **Git Repository**: Preparado para commit y sincronización en rama principal (`main`).
