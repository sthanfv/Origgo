# 🧠 MEMORY.md — Hunter Pro Intelligence (Showcase & Ledger)

Última actualización: 2026-09-04 22:34 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Integración Completa del Selector de Ciudades para Dispositivos Móviles y Escritorio**:
   - En `index.html`, se restauró el grupo `.cmd-filters-group` dentro de `.command-bar-container` con `#cmdFilterLocation` y el menú flotante `#cmdLocationDropdown` con 9 ciudades principales de Colombia (Santa Marta, Bogotá, Medellín, Cali, Barranquilla, Cartagena, Bucaramanga, Pereira, Ibagué).
   - En el Menú Lateral Móvil (`#sideMenu`), se integró un widget nativo táctil de selección de ciudad (`#sideMenuCitySelect` y `#sideMenuCityBadge`), permitiendo al usuario en celular filtrar ciudades con un toque sin depender de la barra de búsqueda de texto.
   - En `app.js`, se conectó el evento `change` de `#sideMenuCitySelect` con sincronización bidireccional: al cambiar en el menú lateral móvil, se actualiza el dropdown de escritorio, se aplica el filtro en la grilla (`aplicarFiltrosOmnibox`), se cierra suavemente el menú y se emite un toast de confirmación.
   - En `sincronizarFiltroCiudadUsuario()`, al iniciar sesión o cargar un Plan Pro Ciudad (ej. Santa Marta), tanto el menú lateral móvil como el dropdown de escritorio quedan automáticamente seleccionados en la ciudad cubierta por la membresía.

2. **Erradicación del Bug de "Resurrección Zombi" de Usuarios Eliminados**:
   - Se eliminó el fallback de rehidratación en `api/lib/db.js`, `api/user/balance.js`, `api/auth/session.js` y `api/leads/unlock.js`.
   - Firestore es la única fuente de verdad; si un usuario no existe, se responde 404 y el frontend purga automáticamente el token y caché local.
   - El usuario de prueba `3113114357` quedó completamente purgado (`Doc exists? false`).

3. **Suite de Validación y Pruebas Automatizadas (6/6 Fases Aprobadas)**:
   - Compilación exitosa de CSS (570 bloques).
   - Sintaxis JavaScript y endpoints serverless al 100%.
   - Pruebas unitarias de pasarela Wompi y ledger: 12/12 con 0 fallos.

---

## 2. ¿Por qué cambió?

- **Ausencia de Selector de Ciudades en Móvil**: En resoluciones móviles, la barra de búsqueda de texto se ocultaba por diseño responsivo, y el contenedor `.cmd-filters-group` no estaba presente en el HTML, dejando al usuario sin mecanismo visual para filtrar las oportunidades de su ciudad adquirida (ej. Santa Marta).
- **Consulta de Arquitectura de Backend**: El usuario solicitó clarificación profunda sobre los lenguajes utilizados en el sistema (Node.js Serverless vs Python/PHP/Go), la optimización criptográfica y la división funcional entre el scraper de campo y el gateway de pagos.

---

## 3. Archivos Afectados

- `index.html`: Inclusión de `.cmd-filters-group` en la barra de comandos y widget `#sideMenuCitySelect` en `#sideMenu`.
- `app.js`: Sincronización bidireccional y listeners de eventos para `#sideMenuCitySelect` y `sincronizarFiltroCiudadUsuario()`.
- `MEMORY.md`: Registro de memoria del sistema actualizado.

---

## 4. Estado Actual del Sistema

- **Filtro de Ciudad en Móvil**: 100% funcional y visible en el menú lateral y barra flotante.
- **Sincronización Plan Pro Ciudad**: Santa Marta se auto-selecciona automáticamente al ingresar.
- **Suite de Pruebas (`npm test`)**: 6 fases superadas al 100% con 0 errores.
- **Git**: Listo para commit y sincronización.
