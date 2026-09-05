# 🧠 MEMORY.md — Hunter Pro Intelligence (Showcase & Ledger)

Última actualización: 2026-09-04 21:17 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Blindaje Antifraude Estricto en Pagos Wompi**:
   - Se configuraron las llaves oficiales del comercio en Sandbox (`pub_test_PQAm6bJXtS4ScbCpBU058xY0vlTPFXfA`, secreto de integridad `test_integrity_2g8NUSOa7paHZDObHhpPlnIRszyxGfIq`, eventos `test_events_Ywbmm47eiERZEHu4hRjTyyIzXe8EpEkc`).
   - Con la firma de integridad SHA-256 oficial vinculada al comercio, la pasarela de Wompi bloquea la edición del importe.
   - En el backend (`api/payments/webhook-wompi.js`), se implementó la regla defensiva que compara `montoPagado < expectedAmountInCents`. Si un atacante altera el cliente o inyecta una petición con monto inferior al catálogo ($5.000, $35.000, $89.000, $149.000 COP), la transacción es rechazada de inmediato con `400 MONTO_INVALIDO_FRAUDE` y cero créditos acreditados.

2. **Resolución de Error HTTP 402 en Usuarios Existentes**:
   - En `api/auth/session.js`, la condición `if (!user)` impedía que usuarios que ya existían en Firestore recibieran la actualización de su plan o créditos al reclamar una referencia post-pago. Se corrigió implementando idempotencia con `claim_${reference}` en el ledger para aplicar siempre la acreditación legal.
   - Se solucionó la asignación errónea de `creditosAAcreditar = order.creditos || 1` para planes VIP ilimitados (donde `creditos` es 0). Ahora se asigna `0` créditos individuales y se activa el plan correspondiente con su ciudad.

3. **Restricción Geográfica y Selector de Ciudad (Plan Pro Ciudad - $89.000 COP/mes)**:
   - En `index.html`, se añadió el contenedor `#groupCitySelect` con un selector desplegable de ciudades principales (Bogotá, Medellín, Cali, Barranquilla, Cartagena, Ibagué, Bucaramanga, Chía, Pereira, Santa Marta) visible únicamente al marcar el radio `subscription_city`.
   - En `app.js`, se implementó la validación obligatoria para exigir la selección de la ciudad antes de generar la orden de pago. La ciudad seleccionada viaja en la referencia Wompi (`HNT-[celular]-VIPCIU_[SLUG]-...`) y en la orden.
   - En `api/lib/db.js` y `api/leads/unlock.js`, `unlockLead` valida si el usuario tiene Plan Pro Ciudad y si la ciudad del inmueble coincide con la contratada.
     - Si coincide: desbloqueo ilimitado a costo 0 créditos (`planBenefit: true`).
     - Si es de otra ciudad y el usuario tiene 0 créditos: respuesta HTTP `403 PLAN_CIUDAD_DIFERENTE`, informando amigablemente qué ciudad cubre su membresía y abriendo el modal para que pueda comprar créditos individuales para otras ciudades.

4. **Sincronización Automática del Filtro del Portal**:
   - En `app.js`, la nueva función `sincronizarFiltroCiudadUsuario()` auto-selecciona en el Omnibox la ciudad correspondiente al Plan Pro del usuario al iniciar sesión o reclamar su pago, mostrando directamente los avisos directos de su ciudad contratada.

5. **Suite de Pruebas Automatizadas (12/12)**:
   - Se ampliaron las pruebas en `scripts/test_ledger_wompi.js` de 10 a 12 pruebas, añadiendo cobertura de regresión para el Escudo Anti-Fraude (Test 11) y el Plan Pro Ciudad con restricción geográfica (Test 12). Todas ejecutadas exitosamente.

---

## 2. ¿Por qué cambió?

- **Riesgo Financiero / Explotación de Pasarela**: El usuario descubrió que en Sandbox el campo de monto era editable si la firma no correspondía al secreto oficial del comercio. Además, no existía validación de servidor que impidiera acreditar beneficios por importes manipulados ($0 COP).
- **Falla Funcional HTTP 402**: Clientes existentes que compraban el Plan Pro Ciudad quedaban bloqueados al desbloquear leads debido a que `session.js` no actualizaba sus planes en Firestore si ya tenían registro previo.
- **Falta de Control Geográfico**: El Plan Pro Ciudad prometía cobertura de una ciudad por $89.000/mes, pero la interfaz no pedía la ciudad ni restringía los desbloqueos a esa urbe.

---

## 3. Archivos Afectados

- `api/auth/session.js`: Idempotencia de reclamo de referencia, corrección de evaluación de créditos para planes VIP ilimitados y persistencia de `planCity`.
- `api/leads/unlock.js`: Recepción de `leadCity`, validación de beneficio de plan geográfico y retorno HTTP 403 `PLAN_CIUDAD_DIFERENTE`.
- `api/lib/db.js`: Lógica transaccional de cobertura de ciudad en `unlockLead` con tolerancia fonética/tildes y respuesta estructurada.
- `api/payments/create-order.js`: Llaves Sandbox oficiales de Wompi, firma estricta SHA-256 y persistencia de ciudad seleccionada en referencia y orden.
- `api/payments/verify.js`: Corrección sintáctica en template literal de URL y retorno de metadatos de monto.
- `api/payments/webhook-wompi.js`: Escudo anti-fraude por monto inferior al catálogo, cálculo robusto de firma HMAC y asignación de planes.
- `app.js`: Integración de selector de ciudad en checkout, validación previa a Wompi, envío de `leadCity`, auto-sincronización de filtros de ciudad en el Omnibox y actualización de toasts.
- `index.html`: Selector `#checkoutCitySelect` en modal de compras con opciones de ciudades y mensajes explicativos.
- `scripts/test_ledger_wompi.js`: Suite ampliada a 12 pruebas unitarias de integración, antifraude y control territorial.
- `scripts/validate.js`: Actualización del reporte de la fase 5 para validar 12/12 pruebas.

---

## 4. Decisiones Técnicas Tomadas

1. **Doble Barrera Anti-Fraude**:
   - Barrera 1 (Cliente / Wompi): Firma de integridad `SHA256(reference + amountInCents + currency + integritySecret)` calculada en servidor con las credenciales oficiales registradas en Wompi, sellando el widget.
   - Barrera 2 (Servidor / Webhook): Inspección de `transaction.amount_in_cents` contra el catálogo oficial. Si el pago fue alterado, se rechaza y no se tocan los créditos del usuario.
2. **Arquitectura Stateless y Rehidratación por JWT**:
   - Toda la información de plan, créditos y ciudad se codifica y firma en el token JWT del usuario, permitiendo que las lambdas frías de Vercel operen con o sin base de datos Firestore activa.
3. **Restricción Territorial Tolerante**:
   - La comparación de ciudades normaliza tildes y diacríticos (ej. `Bogotá` vs `bogota`) mediante `NFD` para evitar falsos rechazos por diferencias de formato entre el scraper y el catálogo.

---

## 5. Estado Actual del Sistema

- **Compilación CSS (`style.min.css`)**: 73.8 KB (-30% de peso), balance perfecto de 570 bloques.
- **Suite de Pruebas (`npm test`)**: 6 fases superadas al 100% (Sintaxis, CSS, HTML, Contratos JSON AES-256, 12 Pruebas Wompi/Ledger, Seguridad Zero-Trust).
- **Git**: Rama `main`, listo para commit y despliegue a producción en Vercel.
