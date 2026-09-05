# 🧠 MEMORY.md — Hunter Pro Intelligence (Showcase & Ledger)

Última actualización: 2026-09-04 22:22 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Erradicación del Bug de "Resurrección Zombi" de Usuarios Eliminados**:
   - Se identificó la causa exacta por la cual no se podía empezar de cero con el mismo número: en `api/lib/db.js` (`getUserByPhone` y `unlockLead`), `api/user/balance.js` y `api/auth/session.js`, el backend aceptaba un argumento `fallbackData` / `sessionData` derivado del JWT en `localStorage`. Si el usuario había sido borrado de Firestore, al recargar la web el endpoint `/api/user/balance` **re-creaba al usuario en Firestore** con los datos viejos del token (12 leads y plan city).
   - Solución: Se eliminó por completo la lógica de fallback/resurrección. Firestore es la única fuente de verdad. Si un usuario no existe en `usersRef`, `getUserByPhone` retorna `null` y `/api/user/balance` responde `404 Usuario no encontrado`.
   - En `app.js`, al recibir error 404 de `/api/user/balance`, el frontend purga automáticamente `hunter_pro_token`, `hunter_unlocked_contacts`, restablece el caché en memoria y resetea la sesión sin requerir intervención manual en DevTools.
   - En `cerrarSesionUsuario()`, se añadió la remoción explícita de `hunter_unlocked_contacts` y reseteo de `cacheContactosDesbloqueados`.

2. **Purgado Definitivo del Usuario `3113114357` en Firestore**:
   - Se ejecutó el purgado de `users/3113114357` y órdenes residuales. Verificado con `Doc exists? false`. Ahora el usuario puede registrarse y comprar desde cero con su número original.

3. **Despliegue y Blindaje de Reglas NoSQL (`firestore.rules`) Inspiradas en Desmulta**:
   - Reglas Zero-Trust desplegadas en producción en `hunter-pro-showcase`. Acceso directo de cliente web cerrado (`allow read, write: if false;`). Todo el tráfico transaccional pasa por las Serverless Functions autorizadas con Service Account.

4. **Suite de Validación y Pruebas Automatizadas (6/6 Fases Aprobadas)**:
   - Compilación exitosa de CSS (570 bloques).
   - Sintaxis JavaScript y endpoints serverless al 100%.
   - Pruebas unitarias de pasarela Wompi y ledger: 12/12 con 0 fallos.

---

## 2. ¿Por qué cambió?

- **Imposibilidad de Reiniciar con el Mismo Número**: El usuario reportó que no podía empezar de cero con su número `3113114357`. Al investigar el ciclo de vida del token, se descubrió que el backend estaba resucitando los registros borrados en cada llamada a `balance.js`.
- **Estrategia de Autenticación por Celular + PIN**: Se aclaró técnicamente la validez de la autenticación por número de WhatsApp + PIN frente a email tradicional, confirmando que es la arquitectura idónea para este modelo de negocio en Colombia.

---

## 3. Archivos Afectados

- `api/lib/db.js`: Remoción de `fallbackData` en `getUserByPhone` y denegación en `unlockLead` si `!doc.exists`.
- `api/user/balance.js`: Consulta sin rehidratación a `getUserByPhone`.
- `api/auth/session.js`: Consulta sin rehidratación a `getUserByPhone`.
- `app.js`: Purga automática de `hunter_pro_token` y `hunter_unlocked_contacts` en 404 y en `cerrarSesionUsuario`.
- `MEMORY.md`: Registro de memoria actualizado.

---

## 4. Estado Actual del Sistema

- **Reglas Firestore**: Desplegadas al 100% en `hunter-pro-showcase` (Protección activa).
- **Usuario de Prueba `3113114357`**: Totalmente eliminado de Firestore (`Doc exists: false`).
- **Resurrección Zombi**: Erradicada.
- **Suite de Pruebas (`npm test`)**: 6 fases superadas al 100% con 0 errores.
- **Git**: Listo para commit y despliegue a producción en Vercel.
