# 🧠 MEMORY.md — Hunter Pro Intelligence (Showcase & Ledger)

Última actualización: 2026-09-05 00:30 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Auditoría Exhaustiva de Variables Léxicas y Prevención de TDZ**:
   - Se detectó que las variables reactivas del Omnibox (`filtroCiudadActivo`, `filtroTratoDirectoActivo`, `textoBusquedaActivo`) habían quedado declaradas hacia el final de `modules/07-unlock.js` tras la partición, lo cual provocaba riesgo de `ReferenceError: Cannot access before initialization` (Temporal Dead Zone - TDZ) si `modules/01-state.js` o `modules/06-cards.js` intentaban leerlas durante el arranque antes de inicializarse.
   - Se migraron las 3 variables al inicio de `modules/01-state.js` junto con el estado global de la aplicación.
   - Se reubicó el evento `DOMContentLoaded` al módulo orquestador final `modules/10-listeners.js` (488 líneas) para asegurar que todas las funciones y componentes estén completamente declarados en memoria antes de ejecutarse.
   - Se validó el script completo en un entorno virtual DOM (`vm`) simulando navegadores móviles y de escritorio, confirmando cero errores en runtime.

2. **Blindaje Financiero y Cierre de Brecha de Reclamo Gratuito (`api/auth/session.js`)**:
   - Se erradicó la asignación ciega de créditos por código de texto.
   - El reclamo de referencias (`claim_reference`) ahora ejecuta una verificación directa server-to-server contra la API oficial de Wompi (`/v1/transactions?reference=...`) usando `WOMPI_PRIVATE_KEY`.
   - Se exige que la transacción tenga estado formal `APPROVED` y que el monto pagado coincida al centavo con el valor legal del producto adquirido antes de registrar créditos o activar membresías VIP.

3. **Erradicación Total del Bypass de PIN (`api/lib/db.js`)**:
   - Se eliminó de raíz la comprobación que permitía autenticar a cualquier usuario cuyos dígitos de PIN coincidieran con los últimos 4 dígitos de su número celular (`digitsInput === phoneClean.slice(-4)`).
   - Ahora se requiere estrictamente el PIN criptográfico secreto de 4 dígitos o el token JWT firmado con HMAC-SHA256.

4. **Resiliencia ante el Caos y Reintentos con Backoff Exponencial (`api/lib/db.js`)**:
   - Se implementó la función envolvente `withRetry(operacion, maxIntentos = 3)` con backoff exponencial y *jitter* aleatorio ($\min(200 \times 2^i, 2000) + \text{random}(0, 150)$ ms).
   - Se aplicó a todas las operaciones transaccionales y de lectura en Google Cloud Firestore (`getUserByPhone`, `addCredits`, `unlockLead`, `recordTransaction`, `isTransactionProcessed`, `savePendingOrder` y `getPendingOrder`), absorbiendo micro-cortes de red y picos de latencia sin emitir HTTP 500 al cliente.

5. **Middleware de Rate Limiting en Memoria (`api/lib/rate-limiter.js`)**:
   - Nuevo middleware de limitación de tasa basado en ventana deslizante en memoria con soporte de proxies (`x-forwarded-for`, `x-real-ip`) y cabeceras estándar (`X-RateLimit-*`, `Retry-After`).
   - Integrado en todos los endpoints sensibles:
     - `api/payments/create-order.js`: máx 12 órdenes/minuto por IP.
     - `api/auth/session.js`: máx 10 reclamos de referencia/minuto y máx 8 intentos erróneos de PIN por 15 min.
     - `api/leads/unlock.js`: máx 30 desbloqueos/minuto por IP.
     - `api/payments/webhook-wompi.js`: máx 60 peticiones/minuto por IP.
     - `api/user/balance.js`: máx 60 consultas/minuto por IP.

6. **Principio Fail-Closed en Producción**:
   - Bloqueo inmediato de arranque si faltan variables críticas (`JWT_SECRET`, `LEADS_ENCRYPTION_KEY`, `WOMPI_INTEGRITY_SECRET`) cuando `NODE_ENV === 'production'`.

7. **Cabeceras de Seguridad Globales OWASP (`vercel.json`)**:
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   - Políticas de caché CDN optimizadas para JSON (300s + stale-while-revalidate) y estáticos (86400s).

8. **Desacoplamiento y Modularización Arquitectónica (< 500 Líneas por Módulo)**:
   - **JavaScript (`modules/`)**: 10 submódulos altamente especializados:
     - `01-state.js` (271 líneas): Estado global, sesión JWT y PIN.
     - `02-toast.js` (227 líneas): Notificaciones luxury con ambient glow y swipe.
     - `03-api.js` (41 líneas): Cliente HTTP centralizado con `x-trace-id`.
     - `04-filters.js` (180 líneas): Búsqueda inteligente, omnibox y ciudades.
     - `05-carousel.js` (105 líneas): Carruseles fotográficos y drawer slide-up.
     - `06-cards.js` (481 líneas): Renderizado Bento Grid, skeletons y precios.
     - `07-unlock.js` (258 líneas): Desbloqueo atómico y WhatsApp directo.
     - `08-checkout.js` (325 líneas): Modal de pago y pasarela Wompi.
     - `09-ui-effects.js` (248 líneas): Háptica, ripple, parallax GPU y temas.
     - `10-listeners.js` (488 líneas): Event listeners DOM, atajos de teclado y DOMContentLoaded.
   - **CSS (`styles/`)**: 14 submódulos semánticos (`01-tokens.css` a `14-toast.css`), todos bajo 475 líneas.
   - **Compilador Determinista (`scripts/build.js`)**: Ensambla los módulos en orden riguroso hacia `style.css` y `app.js`, generando `style.min.css` (80.6 KB, -30%) y `app.min.js` (94.4 KB, -15%).

9. **Suite de Validación DevSecOps Ampliada a 8 Fases (`scripts/validate.js`)**:
   - Fase 1: Sintaxis JS (23 archivos analizados con `node --check`).
   - Fase 2: Integridad y balance CSS (14 submódulos verificados).
   - Fase 3: Marcado HTML y cabeceras OWASP en `vercel.json`.
   - Fase 4: Contratos JSON y cifrado AES-256 (`iv:tag:cipher`).
   - Fase 5: Suite Wompi y ledger (12/12 pruebas unitarias al 100%).
   - Fase 6: Auditoría antifraude en `claim_reference` (rechazo con HTTP 403).
   - Fase 7: Auditoría de PIN estricto (rechazo de bypass por celular).
   - Fase 8: Auditoría de modularidad (< 500 líneas por módulo comprobado).

10. **Documento de Arquitectura Técnica (`ARCHITECTURE.md`)**:
    - Documentada la arquitectura en 4 capas, tolerancia a fallos y diagramas de flujo.

---

## 2. ¿Por qué cambió?

- **Auditoría Exhaustiva Solicitada por el Usuario**: El usuario pidió explícitamente revisar todo el trabajo desde el inicio para garantizar la ausencia total de errores o fallos ocultos. La auditoría profunda reveló el riesgo de TDZ en variables léxicas del Omnibox que fue subsanado inmediatamente con verificación en sandbox de DOM.

---

## 3. Archivos Afectados

- `modules/01-state.js`: Migración de variables del Omnibox al inicio del estado.
- `modules/07-unlock.js`: Eliminación de variables duplicadas.
- `modules/10-listeners.js`: Reubicación del evento `DOMContentLoaded` de arranque.
- `app.js`: Archivo ensamblado actualizado.
- `app.min.js`: Bundle minificado actualizado.
- `MEMORY.md`: Bitácora de memoria persistente actualizada.

---

## 4. Decisiones Técnicas Tomadas

- **Prevención de TDZ (Temporal Dead Zone)**: Se centralizaron todas las variables de estado reactivo en `01-state.js` para asegurar que existan en el ámbito global antes de que cualquier otro módulo intente leerlas o asignarlas.
- **Arranque Secuencial en el Último Módulo**: `DOMContentLoaded` se trasladó a `10-listeners.js` para garantizar que cuando se dispare la carga de datos (`cargarDatos`), todas las funciones de renderizado, filtrado y efectos ya estén registradas en el scope.

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% con 0 errores.
- **Simulación en Navegador (VM Sandbox)**: 0 ReferenceErrors, 0 fallos de ejecución.
- **Seguridad**: Reconciliación Wompi verificada, bypass de PIN eliminado, Zero-Trust en reposo.
- **Modularidad**: Todos los submódulos JS (< 488 líneas) y CSS (< 475 líneas).
- **Git**: Listo para commit y push.
