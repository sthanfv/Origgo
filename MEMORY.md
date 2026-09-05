# 🧠 MEMORY.md — Hunter Pro Intelligence (Showcase & Ledger)

Última actualización: 2026-09-05 00:40 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Erradicación de Scrollbar Recta en el Modal de Compra y Ficha Técnica**:
   - Se eliminaron las barras de desplazamiento nativas rectangulares de Windows/navegador (`overflow-y: auto`) que rompían la estética curva (`border-radius: 40px` / `var(--radius-card)`) en `.checkout-modal-card`, `.modal-backdrop`, `.legal-content-box` y `.slideup-body`.
   - Se aplicó la técnica invisible de desplazamiento fluido moderno:
     - `scrollbar-width: none;` (Firefox y estándar W3C).
     - `-ms-overflow-style: none;` (Edge Legacy / IE).
     - `::-webkit-scrollbar { display: none; width: 0; height: 0; background: transparent; }` (Chrome, Safari, Edge Chromium, Samsung Internet y WebViews móviles).
     - `-webkit-overflow-scrolling: touch;` y `overscroll-behavior: contain;` para inercia táctil nativa sin rebotes.
   - El desplazamiento vertical se mantiene 100% operativo mediante rueda de ratón, trackpad y gestos táctiles, pero sin barras rectangulares blancas invasivas que resten estética al diseño glassmorphic de lujo.

2. **Auditoría Exhaustiva de Variables Léxicas y Prevención de TDZ**:
   - Centralización de variables de filtros (`filtroCiudadActivo`, `filtroTratoDirectoActivo`, `textoBusquedaActivo`) en `modules/01-state.js`.
   - Reubicación de `DOMContentLoaded` en `modules/10-listeners.js`.
   - Verificación en entorno sandbox DOM (`vm`) confirmando cero ReferenceErrors.

3. **Blindaje Financiero y Cierre de Brecha de Reclamo Gratuito (`api/auth/session.js`)**:
   - Reconciliación server-to-server directa contra la API de Wompi con `WOMPI_PRIVATE_KEY` para `claim_reference`.
   - Validación al centavo del monto pagado antes de acreditar saldo.

4. **Erradicación Total del Bypass de PIN (`api/lib/db.js`)**:
   - Eliminada la coincidencia con los últimos 4 dígitos del celular.

5. **Resiliencia ante el Caos y Reintentos con Backoff Exponencial (`api/lib/db.js`)**:
   - Envoltorio `withRetry` (3 intentos) con jitter aleatorio protegiendo todas las operaciones de Firestore.

6. **Middleware de Rate Limiting en Memoria (`api/lib/rate-limiter.js`)**:
   - Protección contra DDoS y ataques de fuerza bruta al PIN y creación de órdenes.

7. **Cabeceras de Seguridad Globales OWASP (`vercel.json`)**:
   - HSTS preload, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Permissions-Policy.

8. **Desacoplamiento y Modularización Arquitectónica (< 500 Líneas por Módulo)**:
   - 10 módulos JS (`modules/`) y 14 módulos CSS (`styles/`).
   - Compilación determinista con `scripts/build.js` a `style.min.css` (-30%) y `app.min.js` (-15%).

9. **Suite de Validación DevSecOps en 8 Fases (`scripts/validate.js`)**:
   - 8/8 Fases aprobadas al 100% en pre-commit y pre-push hooks.

---

## 2. ¿Por qué cambió?

- **Solicitud Estética del Usuario**: El usuario reportó que la barra de desplazamiento nativa recta sobre el contenedor modal con bordes redondeados (`border-radius: 40px`) resultaba antiestética e invasiva, solicitando ocultarla o desaparecerla por completo preservando la funcionalidad de desplazamiento táctil y de rueda.

---

## 3. Archivos Afectados

- `styles/09-checkout-modal.css`: Eliminación visual de la barra de scroll en `.modal-backdrop` y `.checkout-modal-card`.
- `styles/13-footer.css`: Eliminación visual de la barra de scroll en `.legal-content-box`.
- `styles/08-slideup.css`: Eliminación visual de la barra de scroll en `.slideup-body`.
- `style.css` y `style.min.css`: Hojas de estilo recompiladas y verificadas.
- `MEMORY.md`: Bitácora de persistencia actualizada.

---

## 4. Decisiones Técnicas Tomadas

- **Ocultamiento Multi-Motor**: Para garantizar que la barra recta no aparezca en ningún navegador (Windows Chrome, Edge, Firefox, Safari o navegadores móviles), se combinaron `scrollbar-width: none`, `-ms-overflow-style: none` y `::-webkit-scrollbar { display: none }` manteniendo el contenedor deslizable con inercia nativa táctil (`-webkit-overflow-scrolling: touch`).

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% con 0 errores.
- **Estética Modal**: Bordes redondeados orgánicos limpios, cero barras rectas invasivas.
- **Funcionalidad**: Desplazamiento vertical fluido intacto en PC y móvil.
- **Git**: Listo para commit y push.
