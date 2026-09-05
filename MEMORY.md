# 🧠 MEMORY.md — Hunter Pro Intelligence (Showcase & Ledger)

Última actualización: 2026-09-04 21:52 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Ejecución del Reseteo y Purgado de Datos de Prueba en Firestore**:
   - Se ejecutó `node scripts/reset_user.js 3113114357 --delete`.
   - Se eliminó el documento `users/3113114357` (que contenía 12 leads desbloqueados y plan city) y se purgaron 3 órdenes de prueba asociadas en la colección `orders`.
   - El entorno queda en estado virgen para simular la experiencia completa de un nuevo comprador.

2. **Auditoría e Implementación de Reglas de Seguridad NoSQL (`firestore.rules`) Inspiradas en Desmulta**:
   - Se auditó el archivo `Desmulta/firestore.rules` ubicado en `C:\workspace\Ecosistema_Desmulta\Desmulta\firestore.rules`.
   - Patrón adoptado: Arquitectura **Zero-Trust Serverless** con principio de mínimo privilegio y denegación explícita e implícita (`Default-Deny`).
   - Se crearon `firestore.rules`, `firebase.json` y `.firebaserc` para `hunter-pro-showcase`:
     - `users/{phone}`: `allow read, write: if false;` (Blindaje total: previene que clientes web o atacantes lean teléfonos, hashes de PIN, saldos de créditos o inyecten saldo de forma fraudulenta).
     - `orders/{reference}`: `allow read, write: if false;` (Inviolabilidad de órdenes, montos y firmas SHA-256).
     - `transactions/{transactionId}`: `allow read, write: if false;` (Ledger inmutable contra ataques de replay o manipulación).
     - `system_config/{docId}`: `allow get: if true; allow list, write: if false;` (Configuración pública controlada).
     - `match /{document=**}`: `allow read, write: if false;` (Catch-all defensivo).
   - Las reglas fueron **desplegadas exitosamente en vivo** en el proyecto Google Cloud / Firebase `hunter-pro-showcase` mediante Firebase MCP CLI (`firebase_deploy`).

3. **Eliminación Definitiva del Parpadeo Blanco (350ms) al Revelar Contacto**:
   - Mutación quirúrgica en DOM mediante `actualizarTarjetaEnElDOM()`.
   - Reemplazo inmediato de badge, barra de teléfono y botones a llamadas/WhatsApp directo sin reconstruir la grilla ni disparar opacidades transicionales de 350ms.

4. **Suite de Validación y Pruebas Automatizadas (6/6 Fases Aprobadas)**:
   - Compilación exitosa de CSS (570 bloques).
   - Sintaxis JavaScript y endpoints serverless al 100%.
   - Pruebas unitarias de pasarela Wompi y ledger: 12/12 con 0 fallos.

---

## 2. ¿Por qué cambió?

- **Reinicio de Ciclo de Pruebas**: El usuario solicitó limpiar la base de datos para validar el flujo como cliente nuevo.
- **Protección NoSQL de Producción**: Para prevenir vulnerabilidades donde un cliente malicioso intente consultar o alterar documentos de Firestore directamente desde el navegador, se adoptó la arquitectura de seguridad probada en el proyecto `Desmulta`.

---

## 3. Archivos Afectados

- `firestore.rules`: Reglas de seguridad Cloud Firestore (Zero-Trust).
- `firebase.json`: Manifiesto de servicios Firebase apuntando a `firestore.rules`.
- `.firebaserc`: Mapeo del proyecto por defecto a `hunter-pro-showcase`.
- `MEMORY.md`: Registro de memoria actualizado.

---

## 4. Estado Actual del Sistema

- **Reglas Firestore**: Desplegadas al 100% en `hunter-pro-showcase` (Protección activa).
- **Usuario de Prueba**: Reseteado y purgado en Firestore (`3113114357`).
- **Suite de Pruebas (`npm test`)**: 6 fases superadas al 100% con 0 errores.
- **Git**: Listo para commit y sincronización.
