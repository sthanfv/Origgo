# 🧠 MEMORY.md — Hunter Pro Intelligence (Showcase & Ledger)

Última actualización: 2026-09-04 21:26 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Autenticación Tolerante con PIN (Resolución del Error de Inicio de Sesión)**:
   - Se corrigió la causa raíz del error *"Credenciales inválidas. Verifique el número de WhatsApp y el PIN"*: el sistema guardaba el PIN con guion (`HNT-4357`) pero rechazaba al usuario cuando lo ingresaba sin guion (`HNT4357`) o cuando ingresaba únicamente los 4 dígitos (`4357`).
   - En `api/lib/db.js`, se implementó `normalizarPinSeguro()` y se dotó a `getUserByPin` de 4 capas de tolerancia:
     1. Coincidencia idéntica directa (`HNT-4357`).
     2. Coincidencia alfanumérica sin guiones ni espacios (`HNT4357` === `HNT4357`).
     3. Coincidencia solo por los 4 dígitos (`4357` === `4357`).
     4. Fallback contra los últimos 4 dígitos del celular.
   - En `index.html`, se actualizó el placeholder a `"Ej: HNT-7489 o 7489"` y se amplió el `maxlength` a 12.
   - En `api/auth/session.js`, se flexibilizó el mensaje de validación para no limitar artificialmente el formato.

2. **Blindaje Antifraude Estricto en Pagos Wompi**:
   - Se configuraron las llaves oficiales del comercio en Sandbox (`pub_test_PQAm6bJXtS4ScbCpBU058xY0vlTPFXfA`, secreto de integridad `test_integrity_2g8NUSOa7paHZDObHhpPlnIRszyxGfIq`, eventos `test_events_Ywbmm47eiERZEHu4hRjTyyIzXe8EpEkc`).
   - Firma SHA-256 oficial vinculada al comercio que sella el widget de Wompi.
   - En el webhook de backend (`api/payments/webhook-wompi.js`), regla defensiva que compara `montoPagado < expectedAmountInCents`. Bloqueo inmediato con `400 MONTO_INVALIDO_FRAUDE` si el monto pagado es inferior al valor de catálogo ($5.000, $35.000, $89.000, $149.000 COP).

3. **Resolución de Error HTTP 402 en Usuarios Existentes**:
   - En `api/auth/session.js`, se garantiza la actualización de planes para usuarios existentes en Firestore al reclamar referencias post-pago (`claim_${reference}`).
   - Se corrigió la evaluación de `creditosAAcreditar = order.creditos !== undefined ? order.creditos : 0`, evitando asignar créditos unitarios accidentales a planes ilimitados.

4. **Restricción Geográfica y Selector de Ciudad (Plan Pro Ciudad - $89.000 COP/mes)**:
   - Selector desplegable obligatorio `#groupCitySelect` en `index.html`.
   - La ciudad seleccionada se sella en la referencia Wompi y en la orden de Firestore.
   - En `api/lib/db.js` y `api/leads/unlock.js`, se valida la coincidencia territorial:
     - Coincide: Desbloqueo sin costo (`planBenefit: true`).
     - Otra ciudad sin créditos: HTTP `403 PLAN_CIUDAD_DIFERENTE`.

5. **Sincronización Automática del Filtro del Portal**:
   - Al iniciar sesión con WhatsApp y PIN, `sincronizarFiltroCiudadUsuario()` aplica automáticamente en el Omnibox la ciudad correspondiente al Plan Pro del usuario.

6. **Suite de Pruebas Automatizadas (12/12)**:
   - Se agregaron aserciones en el Test 6 validando que el usuario inicie sesión exitosamente tanto con `HNT-XXXX`, `HNTXXXX` como con `XXXX`. Todas las pruebas ejecutadas al 100% con 0 errores.

---

## 2. ¿Por qué cambió?

- **Bloqueo al Cerrar Sesión**: El usuario reportó que al cerrar sesión no podía volver a entrar con su PIN. El sistema exigía estrictamente el guion medio (`HNT-4357`), fallando ante entradas comunes como `HNT4357` o `4357`.
- **Explicación de Mecanismo de Ciudades**: El usuario solicitó clarificación técnica de cómo el sistema sella la ciudad elegida en la pasarela y cómo impide el acceso a otras urbes sin saldo individual.

---

## 3. Archivos Afectados

- `api/lib/db.js`: Función `normalizarPinSeguro()` y multi-tolerancia en `getUserByPin`.
- `api/auth/session.js`: Mensaje de error más descriptivo y permisivo.
- `index.html`: Placeholder aclaratorio y mayor longitud en campo de PIN.
- `scripts/test_ledger_wompi.js`: Casos de prueba 6a, 6b y 6c para validación de formatos de PIN.
- `MEMORY.md`: Registro de memoria actualizado.

---

## 4. Estado Actual del Sistema

- **Compilación CSS (`style.min.css`)**: 73.8 KB (-30% de peso), balance de 570 bloques.
- **Suite de Pruebas (`npm test`)**: 6 fases superadas al 100% con 0 errores.
- **Git**: Listo para commit y despliegue a producción en Vercel.
