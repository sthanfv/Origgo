# 🧠 MEMORY.md — Hunter Pro Intelligence (Showcase & Ledger)

Última actualización: 2026-09-05 06:05 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Erradicación Definitiva y Estructural de la Barra de Desplazamiento Interna del Modal**:
   - Diagnóstico: `.checkout-modal-card` tenía `max-height: 90vh; overflow-y: auto;` y en `styles/13-footer.css` (`@media (max-width: 640px)`) tenía `overflow-y: auto !important;`. Esto generaba un scroll anidado en una tarjeta de 540px, obligando a Chrome/Edge en Windows a pintar una barra vertical nativa de 17px con flechas `▲` y `▼` pegada al borde derecho de la tarjeta (en medio de la pantalla).
   - Solución Arquitectónica: Se configuró `.checkout-modal-card` con `overflow: visible !important; max-height: none !important;`. Al no tener límite de altura interna ni overflow, el contenedor modal no genera scrollbar propia; el desplazamiento vertical lo gestiona enteramente el viewport `.modal-backdrop`, donde las barras están suprimidas globalmente con `scrollbar-width: none !important` y pseudo-elementos `::-webkit-scrollbar { display: none !important; width: 0 !important; }`.

2. **Cálculo Antifraude de Mes Calendario Real y Corte por Hora Exacta (`api/lib/db.js`)**:
   - Se reemplazó el cálculo rígido de 30 días (`Date.now() + 30 * 86400 * 1000`) por la función `calcularExpiracionMesCalendario(fechaInicio, meses = 1)` siguiendo el estándar de telecomunicaciones y Stripe Billing.
   - En meses de 31 días (enero, marzo, mayo, julio, agosto, octubre, diciembre), el usuario disfruta de sus 31 días completos sin que el sistema le reste tiempo.
   - La fecha de corte (`planExpiresAt`) se guarda en formato ISO 8601 UTC y se corta exactamente al minuto de la misma hora en que el usuario realizó la compra.
   - En `api/leads/unlock.js`, la validación `new Date(user.planExpiresAt) > new Date()` se evalúa en el servidor contra el reloj atómico UTC de Google Cloud, impidiendo cualquier manipulación desde el reloj del dispositivo móvil o PC.

3. **Arquitectura y Trazabilidad Antifraude de Órdenes**:
   - El tipo de paquete (`productType`: `single_lead`, `pack_10_leads`, `subscription_city`, `subscription_national`), el monto en centavos y la ciudad quedan sellados desde el inicio en Firestore (`pendingOrders`) con firma HMAC-SHA256 (`WOMPI_INTEGRITY_SECRET`).
   - El backend valida que la transacción de Wompi coincida exactamente al centavo y en estado `APPROVED` antes de acreditar beneficios de forma idempotente (`claim_${reference}`).

4. **Modularidad Desmulta (< 500 líneas)**:
   - 11 submódulos JS (`modules/`) y 15 submódulos CSS (`styles/`), todos rigurosamente por debajo de 500 líneas.
   - Suite DevSecOps de 8 fases (`npm test`) aprobada al 100% con 0 errores.

---

## 2. ¿Por qué cambió?

- **Eliminación Visual de la Barra Recta**: El usuario reportó que la barra de desplazamiento seguía visible a la derecha de la tarjeta modal en Windows (`media_1788606084387.png`), rompiendo la estética limpia.
- **Transparencia y Precisión en el Vencimiento**: El usuario consultó cómo opera el vencimiento de planes, exigiendo que no se roben días en meses de 31 días y que el corte se ejecute a la hora exacta de la compra con validación del servidor a prueba de fraude.

---

## 3. Archivos Afectados

- `styles/09-checkout-modal.css`: `.checkout-modal-card` reconfigurado con `overflow: visible !important; max-height: none !important;` y selectores de scrollbar reforzados.
- `styles/13-footer.css`: Eliminado el `overflow-y: auto !important` de `.checkout-modal-card` en media queries móviles.
- `api/lib/db.js`: Función `calcularExpiracionMesCalendario` para respetar meses de 31 días y horas de corte exactas.
- `style.css` y `style.min.css`: Recompilados y verificados.
- `MEMORY.md`: Bitácora sincronizada.

---

## 4. Decisiones Técnicas Tomadas

- **Delegación de Scroll al Backdrop**: Al transferir el scroll exclusivamente a `.modal-backdrop` y liberar `.checkout-modal-card` de restricciones de altura (`max-height: none`), se erradica la barra nativa interna en medio de la pantalla preservando la fluidez del desplazamiento en toda la página.
- **Mes Calendario**: Se aplica la lógica `d.setMonth(d.getMonth() + 1)` con ajuste al último día del mes si el mes siguiente tiene menos días (ej. 31 de enero a 28 de febrero), garantizando equidad y exactitud temporal.

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% (0 errores).
- **Estética Modal**: Cero barras internas de scroll; curvatura orgánica completa (`border-radius: 40px`).
- **Seguridad y Ledger**: Reconciliación estricta Wompi, vencimiento por servidor UTC y zero-trust.
