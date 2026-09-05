# 🧠 MEMORY.md — Hunter Pro Intelligence (Showcase & Ledger)

Última actualización: 2026-09-05 07:00 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Resaltado y Prestancia de Marca del Portal de Origen en Tarjetas**:
   - Diagnóstico: En las tarjetas inmobiliarias el portal de origen se mostraba como un texto plano grisáceo diminuto (`FINCARAIZ`) y en tarjetas bloqueadas figuraba como texto genérico ("Portal Inmobiliario").
   - Solución Visual y Lógica (`modules/06-cards.js`, `styles/07-cards.css`):
     - Se incorporó la píldora destacada `.card-portal-badge` en la cabecera `.card-meta-header` tanto para tarjetas bloqueadas como desbloqueadas, mostrando explícitamente la fuente real (**Finca Raíz**, **Metrocuadrado**, etc.) con tipografía display, borde esmeralda translúcido y fondo premium.
     - En el estado desbloqueado, se inyectó la cápsula `.unlocked-portal-pill` junto al número telefónico revelado `.contact-phone-number` dentro de la barra de contacto `.card-contact-phone-bar`.

2. **Simetría Dinámica y Eliminación de Huecos en Badges de "Ver Detalles" (Slide-Up Drawer)**:
   - Diagnóstico: En el drawer deslizable de detalles (`#slideUpDrawer`), el contenedor `.slideup-body` utilizaba `justify-content: space-between`, lo que forzaba a separar las cajas a los extremos superior e inferior generando un vacío central asimétrico. Además, las 6 cajas de especificaciones (`Estrato`, `Área`, `Habitaciones`, `Baños`, `Parqueaderos`, `Contacto`) carecían de altura mínima uniforme, viéndose dispares si el texto ocupaba una o dos líneas.
   - Solución Integral (`styles/08-slideup.css`, `modules/06-cards.js`):
     - Se reemplazó `justify-content: space-between` por `justify-content: flex-start; gap: 0.75rem;` en `.slideup-body`.
     - Se configuró `.slideup-specs-grid` con `grid-template-columns: repeat(2, 1fr); gap: 0.65rem;`.
     - Se definió para `.slideup-spec-card` una altura mínima fija con centrado vertical: `min-height: 68px; display: flex; flex-direction: column; justify-content: center;`, logrando una perfecta simetría geométrica 2x3 idéntica para todas las tarjetas.
     - Se asignó iconografía vectorial contextual FontAwesome para cada especificación (`fa-layer-group`, `fa-ruler-combined`, `fa-bed`, `fa-bath`, `fa-square-parking`, `fa-user-shield`).

3. **Corrección Gramatical de Plurales e Inconsistencias Lingüísticas**:
   - Diagnóstico: En publicaciones con un solo parqueadero, la especificación renderizaba incorrectamente `"1 espacios"`.
   - Solución en Tres Capas:
     - **Dataset (`data/inmobiliario.json`)**: Reemplazo de más de 40 ocurrencias de `"1 espacios"` por `"1 espacio"` e inyección del campo explícito `portal`.
     - **Scraper Core (`publisher_web.js`)**: Ajuste condicional singular/plural en la generación del JSON:
       - Habitaciones: `Number(habs) === 1 ? '1 alcoba' : \`${habs} alcobas\``
       - Baños: `Number(banos) === 1 ? '1 completo' : \`${banos} completos\``
       - Parqueaderos: `Number(garajes) === 1 ? '1 espacio' : \`${garajes} espacios\``
     - **Renderizador Frontend (`modules/06-cards.js`)**: Normalización dinámica al vuelo con Regex (`.replace(/\b1 espacios\b/gi, '1 espacio')`) para blindar contra cualquier inconsistencia que ingrese en payloads futuros.

4. **Arquitectura del Sello Criptográfico Forense (SHA-256)**:
   - Se ratificó el esquema de trazabilidad B2B donde el scraper en Termux calcula `raw_response_sha256` sobre el payload original de la API/HTML del portal fuente antes de cifrar en AES-256-GCM. Este hash reside en SQLite y queda preparado para mostrarse en la ficha técnica de auditoría forense post-desbloqueo.

5. **Modularidad Desmulta y Suite DevSecOps**:
   - Todos los 11 submódulos JS (`modules/`) y 15 submódulos CSS (`styles/`) se mantienen estrictamente `< 500 líneas` (`06-cards.js` en 490 líneas, `07-cards.css` en 446 líneas).
   - Compilación con `scripts/build.js` y validación de 8 fases (`npm test`) aprobada al 100% con 0 errores.

---

## 2. ¿Por qué cambió?

- **Requerimiento del Usuario sobre Visibilidad de Portal**: El usuario observó que en la tarjeta original el portal se perdía visualmente y requería que fuera claro y destacado desde el primer contacto visual.
- **Armonía Estética y Balance Visual**: Los badges de especificaciones en el drawer emergente se veían deformes y con vacíos desproporcionados debido al `space-between` y alturas variables.
- **Calidad y Rigor de Redacción**: Erradicar el error gramatical de concordancia de número ("1 espacios") para proyectar máxima exclusividad y seriedad corporativa.

---

## 3. Archivos Afectados

- `data/inmobiliario.json`: Corrección de concordancia de número singular ("1 espacio") y adición de campo `portal`.
- `modules/06-cards.js`: Inyección de `portalNombre`, `.card-portal-badge`, iconografía FontAwesome en drawer y normalizador gramatical dinámico.
- `modules/07-unlock.js`: Actualización del renderizado de contacto con `.unlocked-portal-pill` y `.contact-phone-number`.
- `styles/07-cards.css`: Estilos visuales para `.card-portal-badge`, `.card-contact-phone-bar` y `.unlocked-portal-pill`.
- `styles/08-slideup.css`: Simetría 2x3 con `min-height: 68px`, centrado vertical, espaciado uniforme y anulación de `justify-content: space-between`.
- `style.css` y `style.min.css`: Recompilados (93.1 KB minificado).
- `app.js` y `app.min.js`: Recompilados (109.9 KB minificado).
- `MEMORY.md`: Bitácora actualizada.
- `C:\workspace\ofertas-hunter-pro\publisher_web.js`: Generación gramatical singular/plural corregida en el motor del scraper.

---

## 4. Decisiones Técnicas Tomadas

- **Normalización Defensiva en 3 Niveles (Scraper, Dataset y Runtime UI)**: No basta con corregir la base de datos actual; se corrigió el generador en el scraper y además se añadió una regla de reemplazo por expresión regular en el componente de renderizado del frontend para asegurar que ningún error de concordancia escape en caso de reingestas.
- **Grid Simétrico con Centrado Vertical en Lugar de Space-Between**: Al fijar una altura mínima de 68px y centrado en cada celda del grid de 2 columnas, todas las tarjetas de detalles lucen exactamente del mismo tamaño independientemente del número de caracteres, eliminando la disparidad visual.

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% (0 errores).
- **Límite de Líneas**: Ningún archivo supera las 500 líneas en `modules/` ni en `styles/`.
- **Integridad Visual**: Badges simétricos, portal de origen destacado y gramática impecable.
- **Seguridad**: AES-256-GCM, firma HMAC-SHA256 y hashing SHA-256 preservados intactos.
