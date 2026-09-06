# 🧠 MEMORY.md — Origgo (Showcase & Ledger de Oportunidades Directas)

Última actualización: 2026-09-05 17:55 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Corrección de Conectividad CSP Multi-CDN y Estabilización del Service Worker**:
   - Diagnóstico: Al activar la cabecera `Content-Security-Policy`, la directiva `connect-src` no contemplaba los dominios externos de los que la aplicación obtiene imágenes de los inmuebles (`cdn2.infocasas.com.uy`, `images.unsplash.com`) ni los CDNs de fuentes (`fonts.googleapis.com`, `fonts.gstatic.com`, `cdnjs.cloudflare.com`). Adicionalmente, `sw.js` interceptaba indiscriminadamente peticiones de terceros sin tenerlas en caché, provocando rechazos de promesa con `TypeError: Failed to convert value to 'Response'` y bloqueos de red.
   - Solución en `vercel.json`, `index.html` y `sw.js`:
     - **CSP Ampliado**: Se incluyeron en `connect-src` todos los dominios necesarios: `https://checkout.wompi.co`, `https://*.wompi.co`, `https://fonts.googleapis.com`, `https://fonts.gstatic.com`, `https://cdnjs.cloudflare.com`, `https://images.unsplash.com`, `https://*.unsplash.com`, `https://cdn2.infocasas.com.uy` y `https://*.infocasas.com.uy`.
     - **Service Worker Aislado (`sw.js`)**: Se condicionó el evento `fetch` a peticiones `same-origin` (`url.origin === self.location.origin`). Las imágenes y- **Estado:** 🟢 Producción / Refinamiento.
- **Últimos Cambios:**
  - Mitigación de errores CSP para FontAwesome y tipografías en `index.html` y `vercel.json`.
  - Aumento de tamaño del logo (46px) y restauración de la animación en cascada para la palabra "riggo" (`02-base.css`).
  - Eliminación del scroll infinito "Cargar más" en favor de una **Paginación Clásica** (anterior/siguiente) con 9 tarjetas por página (`06-cards.js`).
  - Generación de guías de despliegue para dominio `.online`, entorno de producción Wompi y Google Search Console.ción Oficial de "riggo"**:
   - Diagnóstico: El usuario solicitó eliminar cualquier blur/brillo borroso artificial de la 'O' para preservar la pureza del logo original, y restaurar la animación cinemática suave de la palabra completa "riggo" tal como estaba originalmente (deslizamiento horizontal elegante con degradado esmeralda continuo).
   - Solución en `styles/02-base.css` e `index.html`:
     - `.brand-initial-o-wrap` y `.brand-icon-o`: `filter: none;` (cero blur, máxima nitidez y definición de imagen).
     - `.brand-letters-riggo`: Restaurada como texto unificado en fuente Lufga con su degradado esmeralda institucional y la animación cinemática oficial `animOriggoRiggo` (`0.95s cubic-bezier(0.22, 1, 0.36, 1) 0.25s both`), deslizándose suavemente desde `translateX(14px)` a `translateX(0)`.

---

## 2. ¿Por qué cambió?

- **Estabilidad de Red y Prevención de Bloqueos**: Evitar que políticas de seguridad demasiado restrictivas bloqueen los feeds de fotografías de inmuebles y fuentes del portal.
- **Preferencia Estética y Fidelidad de Marca**: Mantener el logotipo con bordes afilados y limpios sin filtros borrosos, y preservar el degradado continuo de la palabra "riggo" con su cinemática nativa.

---

## 3. Archivos Afectados

- `index.html`: CSP ampliado y unificación de `.brand-letters-riggo`.
- `vercel.json`: Directiva `connect-src` multi-CDN en CSP.
- `sw.js`: Versión `origgo-v3` con filtrado estricto `same-origin`.
- `styles/02-base.css`: Supresión de `filter: drop-shadow`, nitidez pura en la 'O' y animación `animOriggoRiggo` (325 líneas, < 500).
- `style.css` y `style.min.css`: Recompilados (92.3 KB minificado).
- `app.js` y `app.min.js`: Recompilados (109.8 KB minificado).
- `MEMORY.md`: Bitácora actualizada.

---

## 4. Decisiones Técnicas Tomadas

- **Aislamiento de Tráfico en Service Worker**: Delegar el tráfico cross-origin de imágenes directamente al subsistema de red del navegador garantiza cero latencia adicional en carruseles fotográficos y previene fallos por peticiones concurrentes de imágenes externas.
- **Integridad DevSecOps**: La suite `npm test` continúa aprobada al 100% en sus 8 fases.

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% (0 errores).
- **Límite de Líneas**: Ningún archivo supera las 500 líneas en `modules/` ni en `styles/`.
- **Identidad de Marca**: Origgo desplegado con la "O" de radar cristalina y la animación clásica suave de "riggo".
- **Conectividad**: Imágenes externas y fuentes autorizadas plenamente en CSP.
