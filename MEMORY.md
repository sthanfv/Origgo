# 🧠 MEMORY.md — Hunter Pro Intelligence (Showcase & Ledger)

Última actualización: 2026-09-05 06:32 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Erradicación Absoluta y Universal de Barras de Desplazamiento Nativo en Modales**:
   - Diagnóstico: En navegadores basados en Chromium sobre Windows (Chrome, Edge, Brave), cuando un modal o contenedor desborda verticalmente, el motor dibuja una barra nativa rectangular gris/blanca de 17px con botones de flecha (`▲` y `▼`), rompiendo la curvatura de 40px (`border-radius: 2.5rem`) de las tarjetas.
   - Solución Integral (`styles/09-checkout-modal.css`):
     - Se aplicó la supresión universal en profundidad para `.modal-backdrop`, `.modal-card`, `.checkout-modal-card`, `.welcome-modal-card`, `.checkout-tab-panel` y todos sus elementos hijos (`*`).
     - Se anularon explícitamente todos los pseudo-elementos del motor WebKit: `::-webkit-scrollbar`, `::-webkit-scrollbar-thumb`, `::-webkit-scrollbar-track` y `::-webkit-scrollbar-button` con `display: none !important; width: 0px !important; height: 0px !important; background: transparent !important;`.
     - Se mantuvo el desplazamiento fluido natural y suave tanto con la rueda del ratón (`wheel`), pantalla táctil o teclado, con curvaturas visuales intactas y cero barras visibles.

2. **Resolución de la Causa Raíz de Desincronización por Caché Local (Cache-Busting v2.6.0)**:
   - Diagnóstico: `vercel.json` configuraba cabeceras de caché estáticas con `max-age=86400` (24 horas) para `.js` y `.css`. Los clientes que visitaron la web previamente cargaban `app.js` y `style.min.css` desde la caché del disco del navegador, ejecutando el código antiguo donde el toast de pago mostraba `"Tienes 0 créditos"` y no abría el modal de bienvenida.
   - Solución en Capa de Red y HTML:
     - `vercel.json`: Se modificó la regla de caché para `/(.*).(css|js)` y para `/` a `public, max-age=0, must-revalidate`. Esto obliga a los navegadores y al CDN de Vercel a validar contra el servidor de origen (ETag / 304 Not Modified), entregando cualquier actualización al instante sin demoras de 24 horas.
     - `index.html`: Se actualizó el parámetro de versionado a `?v=20260905-2.6.0` tanto en `style.min.css` como en `app.js`, forzando la invalidación inmediata de cualquier copia obsoleta en caché local de los usuarios.

3. **Verificación de Bienvenida VIP y Notificaciones Diferenciadas**:
   - Confirmado el flujo completo: tras pago aprobado en Wompi (`subscription_city`), `modules/08-checkout.js` invoca `generarMensajeBienvenidaToast` (mostrando mensaje exclusivo con tono de lujo y reconocimiento territorial) y abre de inmediato `#modalWelcomeSuccess` con la tarjeta de credenciales, copiado de PIN en un clic y matriz de privilegios.

4. **Modularidad Desmulta (< 500 líneas)**:
   - Todos los 11 submódulos JS (`modules/`) y 15 submódulos CSS (`styles/`) se mantienen estrictamente por debajo de 500 líneas (el más grande en CSS es `10-checkout-plans.css` con 491 líneas y en JS es `10-listeners.js` con 488 líneas).
   - Compilación determinista con `scripts/build.js` y suite DevSecOps de 8 fases (`npm test`) aprobada al 100% con 0 errores.

---

## 2. ¿Por qué cambió?

- **Requerimiento Estético del Usuario**: El usuario exigió erradicar totalmente la barra de desplazamiento recta que aparecía en la ventana de paquetes sobre la curvatura del modal en Windows.
- **Claridad y Exclusividad en Notificaciones Post-Pago**: El usuario pagó $89.000 por el Plan Pro Ciudad (Santa Marta) y la notificación en su navegador mostró el texto antiguo ("Tienes 0 créditos") debido a que Chrome sirvió el script anterior en caché de disco.

---

## 3. Archivos Afectados

- `styles/09-checkout-modal.css`: Blindaje universal anti-scrollbar abarcando todos los pseudo-elementos (`thumb`, `track`, `button`).
- `vercel.json`: Política de caché modernizada a `max-age=0, must-revalidate` para erradicar desfases de caché.
- `index.html`: Versionado actualizado a `?v=20260905-2.6.0` en CSS y JS.
- `style.css` y `style.min.css`: Recompilados (91.4 KB minificado).
- `app.js` y `app.min.js`: Recompilados (109.3 KB minificado).
- `MEMORY.md`: Bitácora actualizada y sincronizada.

---

## 4. Decisiones Técnicas Tomadas

- **Supresión Quirúrgica sin Pérdida Funcional**: En vez de bloquear el desborde con `overflow: hidden` (lo que impediría ver opciones de precios en pantallas bajas), se utilizaron las directivas de supresión de barra de scroll estándar (`scrollbar-width: none`) y de WebKit (`::-webkit-scrollbar` con todas sus partes a cero), manteniendo la rueda del mouse y el gesto táctil 100% funcionales pero completamente limpios visualmente.
- **Cache-Busting Dual**: Se combinó la invalidación por query parameter en HTML (`?v=20260905-2.6.0`) con la cabecera HTTP `must-revalidate` en Edge CDN, asegurando despliegues atómicos sin fricción de caché para usuarios recurrentes.

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% (0 errores).
- **Estética Modal**: Cero barras visibles en Windows Chrome, curvatura orgánica impecable de 40px.
- **Entrega Web**: Entrega inmediata de assets sin estancamiento en caché de disco.
- **Seguridad**: Cero secretos expuestos, tokens JWT y reconciliación server-to-server intacta.
