# 🧠 MEMORY.md — Hunter Pro Intelligence (Showcase & Ledger)

Última actualización: 2026-09-05 07:55 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Eliminación Quirúrgica del Badge Duplicado en Cabecera de Tarjeta**:
   - Diagnóstico: Se había inyectado una píldora sobredimensionada (`.card-portal-badge`) con icono de check (`fa-circle-check`) en la cabecera `.card-meta-header`. Al competir en ancho con la ubicación (`.card-location`) y el botón "Ver Detalles" (`.btn-specs-pill`), saturaba la fila y se quebraba a dos líneas de forma antiestética en pantallas compactas y móviles.
   - Solución Inmediata:
     - Se eliminó por completo el elemento `<span class="card-portal-badge">...</span>` de `modules/06-cards.js` dentro de `.card-meta-header`.
     - Se eliminaron las reglas CSS asociadas `.card-portal-badge` y `[data-theme="light"] .card-portal-badge` de `styles/07-cards.css`.
     - Se preservó intacta la cápsula de portal de origen `.unlocked-portal-pill` en la barra de teléfono `.card-contact-phone-bar`, ubicada al frente del número telefónico revelado (`.contact-phone-number`), la cual cumple el estándar de elegancia y legibilidad elogiado por el usuario.

2. **Simetría Dinámica y Eliminación de Huecos en Badges de "Ver Detalles" (Slide-Up Drawer)**:
   - Contenedor `.slideup-body` configurado con `justify-content: flex-start; gap: 0.75rem;`.
   - Grid `.slideup-specs-grid` en 2 columnas simétricas con tarjetas fijas de `min-height: 68px;` y centrado vertical.
   - Iconografía contextual FontAwesome para cada especificación.

3. **Corrección Gramatical de Plurales e Inconsistencias Lingüísticas**:
   - Normalización de concordancia singular en parqueaderos ("1 espacio") en tres niveles (Scraper, Dataset y Runtime UI).

4. **Modularidad Desmulta y Suite DevSecOps**:
   - `modules/06-cards.js`: 487 líneas (< 500).
   - `styles/07-cards.css`: 423 líneas (< 500).
   - Compilación y minificación completadas con `scripts/build.js`.
   - Suite de 8 fases `npm test` aprobada al 100% con 0 errores.

---

## 2. ¿Por qué cambió?

- **Requerimiento Estético Crítico del Usuario**: Erradicar de inmediato la duplicidad innecesaria de la procedencia y la deformación visual provocada por una píldora con check que no cabía en la cabecera `.card-meta-header`.
- **Limpieza y Proporción Visual**: La cabecera recupera su proporción original (ubicación a la izquierda y botón "Ver Detalles" a la derecha sin competencia de espacio).
- **Ubicación Semántica Correcta de la Procedencia**: La procedencia pertenece de forma natural al contexto del contacto revelado (`.unlocked-portal-pill`), donde acompaña la verificación del origen del dato junto al teléfono.

---

## 3. Archivos Afectados

- `modules/06-cards.js`: Eliminado `.card-portal-badge` de `.card-meta-header`. (487 líneas).
- `styles/07-cards.css`: Eliminadas reglas CSS de `.card-portal-badge`. (423 líneas).
- `style.css` y `style.min.css`: Recompilados (92.6 KB minificado, -29%).
- `app.js` y `app.min.js`: Recompilados (109.7 KB minificado, -14%).
- `MEMORY.md`: Bitácora actualizada.

---

## 4. Decisiones Técnicas Tomadas

- **Una Sola Fuente de Verdad para la Marca en la Tarjeta**: En lugar de saturar la tarjeta en múltiples puntos, la marca del portal de origen se reserva con exclusividad para la barra de contacto desbloqueado (`.unlocked-portal-pill`), manteniendo la cabecera limpia, minimalista y libre de desbordamientos.
- **Cumplimiento Estricto del Umbral de Modularidad**: Ambos archivos modificados permanecen con holgura por debajo del umbral de 500 líneas exigido por el Estándar Ecosistema Desmulta.

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% (0 errores).
- **Límite de Líneas**: Ningún archivo supera las 500 líneas en `modules/` ni en `styles/`.
- **Integridad Estética**: Cabecera limpia y simétrica; píldora de portal presente exclusivamente al frente del número telefónico.
- **Seguridad**: AES-256-GCM, firma HMAC-SHA256 y hashing SHA-256 preservados intactos.
