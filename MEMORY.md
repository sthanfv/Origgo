# 🧠 MEMORY.md — Origgo (Showcase & Ledger de Oportunidades Directas)

Última actualización: 2026-09-05 19:55 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Corrección del Bug de Paginación en Filtros (`modules/04-filters.js`)**:
   - Diagnóstico: Al aplicar filtros de búsqueda libre o seleccionar una ciudad mediante `aplicarFiltrosOmnibox()`, no se restablecía el estado `paginaActual = 1`. Si un usuario navegaba a una página superior (ej. página 3 o 5) y luego filtraba por una ciudad con pocos resultados (ej. 1 o 2 páginas), la vista quedaba desfasada, mostrando tarjetas fuera de rango o una lista vacía.
   - Solución: Se incorporó la asignación explícita `paginaActual = 1;` al inicio de `aplicarFiltrosOmnibox()`. Ahora, cualquier búsqueda o cambio de filtro devuelve inmediatamente al usuario a la primera página de resultados.

2. **Restauración de la Animación Cinemática Letra por Letra de "riggo" (`index.html` y `styles/02-base.css`)**:
   - Diagnóstico: Al recargar la página, la animación de la palabra no era visible debido a que en el commit `e63df65` se había unificado la palabra en un solo bloque de texto y el motor de renderizado de WebKit/Blink presenta inconsistencias al animar transformaciones en contenedores con `-webkit-background-clip: text` y `-webkit-text-fill-color: transparent`.
   - Solución: Se desagregó la palabra en spans individuales `<span class="brand-letter" style="--char-i: 1..5">` y se trasladó el degradado esmeralda con `-webkit-background-clip: text` directamente a la clase `.brand-letter`. Cada letra ahora anima su opacidad, escala y desplazamiento vertical de forma escalonada con `@keyframes animLetterAppear`, logrando una entrada fluida y llamativa sin pérdida de compatibilidad visual.

3. **Recompilación y Limpieza de Estilos**:
   - Se removieron keyframes residuales duplicados en `styles/02-base.css`.
   - Se ejecutó el pipeline `node scripts/build.js` para regenerar `style.css`, `style.min.css`, `app.js` y `app.min.js`.
   - La suite de 8 fases `npm test` fue ejecutada y aprobada al 100% con 0 errores.

---

## 2. ¿Por qué cambió?

- **Experiencia de Usuario en Navegación**: Corregir la paginación rota para que los filtros muestren los resultados desde la primera página en cualquier circunstancia.
- **Identidad Visual y Dinamismo**: Cumplir con la expectativa de que el isotipo mantenga su nitidez vectorial y que la palabra "riggo" cobre vida con una entrada cinemática letra por letra tras cada recarga.

---

## 3. Archivos Afectados

- `modules/04-filters.js`: Inclusión de `paginaActual = 1;` en `aplicarFiltrosOmnibox()` (181 líneas, < 500).
- `index.html`: Spans `.brand-letter` con índice de retardo `--char-i` (750 líneas).
- `styles/02-base.css`: Definición de `.brand-letter` con degradado individual y `@keyframes animLetterAppear` (317 líneas, < 500).
- `style.css` y `style.min.css`: Compilación sincronizada (92.3 KB minificado).
- `app.js` y `app.min.js`: Compilación sincronizada (111.0 KB minificado).
- `MEMORY.md`: Bitácora y memoria del sistema sincronizada.

---

## 4. Decisiones Técnicas Tomadas

- **Aislamiento de Animación en Inline-Block Hijos**: Aplicar el gradiente y el recorte de texto individualmente en cada letra resuelve el problema de composición del navegador y garantiza una animación limpia en pantallas de alta densidad (Retina/OLED) tanto en iOS como en Android y PC.
- **Reseteo Determinista de Paginación**: Vincular `paginaActual = 1` al ciclo de filtrado evita estados inconsistentes sin necesidad de añadir lógica compleja en el módulo de tarjetas.

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% (0 errores).
- **Límite de Líneas**: Todos los módulos de `modules/` y `styles/` cumplen estrictamente el estándar de menos de 500 líneas.
- **Paginación**: Totalmente funcional y sincronizada con el motor de filtros.
- **Identidad de Marca**: Isotipo nítido y animación cinemática letra por letra de Origgo activa y visible.
