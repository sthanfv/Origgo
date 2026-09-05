# 🧠 MEMORY.md — Hunter Pro Intelligence (Showcase & Ledger)

Última actualización: 2026-09-04 21:45 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Eliminación Definitiva del Parpadeo Blanco (350ms) al Revelar Contacto**:
   - Se reemplazó la llamada destructiva global `renderizarInterfaz(datosActuales)` dentro de `ejecutarDesbloqueoLead()` en `app.js` por una mutación quirúrgica localizada mediante la nueva función `actualizarTarjetaEnElDOM(leadId, contacto, index)`.
   - Causa raíz: al desbloquear un lead, `renderizarInterfaz` purgaba los 52 elementos con `container.innerHTML`, recreaba todos los nodos con `opacity: 0` y esperaba ~350ms a que el `IntersectionObserver` disparara la clase `.revealed`, provocando el parpadeo en blanco.
   - Solución quirúrgica: `actualizarTarjetaEnElDOM` muta únicamente la tarjeta seleccionada:
     1. Añade la clase `.card-unlocked`.
     2. Reemplaza el badge de estado por el badge flotante `<span class="card-unlocked-badge"><i class="fa-solid fa-unlock"></i> Desbloqueado</span>`.
     3. Inserta o actualiza la barra verde esmeralda con el número telefónico real y el portal de origen (`.card-contact-phone-bar`).
     4. Transforma los botones inferiores al clúster de acción directa (`.btn-whatsapp-direct` con enlace verificado, `.btn-call-direct` con `tel:` y `.btn-portal-direct` con el enlace original al portal).
     5. Actualiza sincronizadamente el cajón deslizable de detalles (`#slideup-${cardIndex}`).
   - Resultado: 0 milisegundos de recarga, cero desplazamientos de scroll y cero parpadeos visuales.

2. **Herramienta Administrativa para Reseteo y Limpieza de Usuario de Pruebas**:
   - Se creó el script `scripts/reset_user.js` conectado a Google Cloud Firestore.
   - Permite consultar y reiniciar o purgar cualquier número de teléfono (por defecto `3113114357`), restableciendo sus créditos a 0, plan a `free`, desvinculando leads desbloqueados y archivando u eliminando órdenes de prueba en Firestore.
   - Opciones:
     - `node scripts/reset_user.js <celular>`: Modo reinicio (créditos 0, plan libre, leads limpios).
     - `node scripts/reset_user.js <celular> --delete`: Modo borrado físico total de documentos en `users` y `orders`.

3. **Suite de Validación y Pruebas Automatizadas (6/6 Fases Aprobadas)**:
   - Compilación exitosa de CSS (570 bloques).
   - Verificación estricta de sintaxis en `app.js`, `scripts/reset_user.js` y endpoints serverless.
   - Pruebas unitarias de pasarela Wompi y ledger: 12/12 pruebas al 100% con 0 fallos.

---

## 2. ¿Por qué cambió?

- **Parpadeo al Revelar**: El usuario experimentaba una pantalla blanca de 350ms al hacer clic en "Revelar contacto". La reconstrucción total del catálogo mediante `innerHTML` afectaba negativamente la percepción de velocidad y calidad de la aplicación.
- **Necesidad de Pruebas Limpias como Usuario Nuevo**: Para validar el flujo de compra desde la perspectiva de un nuevo cliente, se requería un método controlado para restablecer el estado del usuario de prueba en Firestore sin afectar datos de producción y explicando la limpieza de la sesión en el navegador.

---

## 3. Archivos Afectados

- `app.js`: Implementación de `actualizarTarjetaEnElDOM()` y desacoplamiento de `renderizarInterfaz` en `ejecutarDesbloqueoLead()`.
- `scripts/reset_user.js`: Nuevo script administrativo de reseteo y borrado selectivo en Firestore.
- `MEMORY.md`: Sincronización de memoria del proyecto.

---

## 4. Estado Actual del Sistema

- **Compilación CSS (`style.min.css`)**: 73.8 KB (-30% de peso), balance de 570 bloques.
- **Suite de Pruebas (`npm test`)**: 6 fases superadas al 100% con 0 errores.
- **Git**: Listo para commit y despliegue a producción en Vercel.
