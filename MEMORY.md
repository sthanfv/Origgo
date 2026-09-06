# 🧠 MEMORY.md — Origgo (Showcase & Ledger de Oportunidades Directas)

Última actualización: 2026-09-05 19:55 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Corrección del Bug Visual del Input de WhatsApp y Neutralización de Autofill (`styles/10-checkout-plans.css`)**:
   - Diagnóstico: En navegadores basados en Chromium/WebKit (Chrome, Edge, Android), al escribir o autocompletar el número telefónico, el navegador inyectaba un fondo blanco/celeste (`#e8f0fe`) con bordes cuadrados. Como `.checkout-input-wrapper` tenía padding interno, el input aparecía como una "isla" rectangular blanca desalineada flotando dentro del contenedor verde oscuro.
   - Solución: Se eliminó el padding del wrapper (`padding: 0; overflow: hidden;`), se extendió la altura y padding directamente a los elementos hijos (`.checkout-input-prefix` y `.checkout-text-input`), y se añadió neutralización estricta de `:-webkit-autofill` mediante `box-shadow: inset` adaptado tanto a tema oscuro como claro.

2. **Ruta de Asistencia y Recuperación de PIN en UI (`index.html`)**:
   - Se añadió un enlace directo de recuperación de PIN y cuenta olvidada en el panel "Ya tengo un PIN" hacia el canal de soporte verificado de WhatsApp.

3. **Compactación Arquitectónica de Estilos**:
   - `styles/10-checkout-plans.css` fue compactado a 484 líneas, manteniéndose estrictamente por debajo del límite de 500 líneas.
   - Se ejecutó `node scripts/build.js` y `npm run validate` aprobando las 8 fases DevSecOps al 100%.

---

## 2. ¿Por qué cambió?

- **Estética Prémium y Consistencia Visual**: Eliminar cajas blancas deformadas generadas por el autocompletado del navegador en temas oscuros.
- **Soporte y Resiliencia de Clientes**: Brindar un camino claro para que los usuarios que olvidan su PIN o cambian de dispositivo puedan restaurar su cuenta sin fricción.

---

## 3. Archivos Afectados

- `styles/10-checkout-plans.css`: Estilos de input y neutralización de autofill (484 líneas, < 500).
- `index.html`: Enlace de recuperación de PIN en `panelTengoPin` (757 líneas).
- `style.css` y `style.min.css`: Compilación sincronizada (93.2 KB minificado).
- `MEMORY.md`: Bitácora técnica actualizada.

---

## 4. Decisiones Técnicas Tomadas

- **Autofill Masking con Inset Shadow**: El uso de `-webkit-box-shadow: 0 0 0 1000px ... inset !important;` es el estándar de la industria (utilizado por plataformas como Stripe y Linear) para anular el fondo claro inyectado por WebKit sin romper la funcionalidad nativa de autocompletado del sistema operativo.
- **Identidad de Cuenta por Número E.164**: La clave primaria de usuario en Firestore es su número de WhatsApp (`users/{telefono}`). La posesión del número telefónico actúa como factor de autenticación de canal (2FA).

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% (0 errores).
- **Límite de Líneas**: Todos los módulos de `modules/` y `styles/` cumplen estrictamente el estándar de menos de 500 líneas.
- **Input de WhatsApp**: Completamente integrado, sin desbordamientos ni cajas blancas de autofill.
- **Autenticación**: Flujo de recuperación de PIN y validación de referencias activo.
