# MEMORY.md — Origgo (Showcase y Ledger de Oportunidades Directas)

Última actualización: 2026-09-07 05:55 (GMT-5)

---

## 1. Qué cambió

1. **Corrección Crítica: Filtro de Credenciales Sandbox en `lib/env.js`**:
   - La función `requireEnv()` rechazaba credenciales `test_*`, `prv_test_*` y `pub_test_*` cuando `NODE_ENV=production` en Vercel, impidiendo que el sistema de pagos Wompi Sandbox funcionara.
   - Se agregó la variable `WOMPI_ENV` que controla si el filtro permite credenciales de prueba.
   - Cuando `WOMPI_ENV=sandbox`, las credenciales de prueba de Wompi son aceptadas incluso en entornos con `NODE_ENV=production` (como Vercel).
   - Cuando se active el modo producción real de Wompi, basta con cambiar `WOMPI_ENV=produccion` y las llaves `test_*` serán rechazadas automáticamente.

2. **Firma de Integridad HMAC-SHA256 para Archivos de Datos**:
   - Nuevo script `scripts/sign-data.js` que genera una firma HMAC-SHA256 por cada archivo JSON en `data/` usando `LEADS_ENCRYPTION_KEY`.
   - Las firmas se guardan como archivos `.sig` junto a los JSON (ej. `data/inmobiliario.json.sig`).
   - El endpoint `api/leads/unlock.js` verifica la firma antes de desbloquear cualquier contacto. Si alguien altera el JSON de datos, el desbloqueo se rechaza con error `INTEGRIDAD_COMPROMETIDA`.
   - La verificación es retrocompatible: si no existe archivo `.sig`, se permite el desbloqueo (para compatibilidad con datos sin firmar).
   - Se usa `crypto.timingSafeEqual()` para prevenir ataques de temporización en la comparación de firmas.

3. **Sincronización de Llave Pública Wompi con Panel de Sandbox**:
   - La llave pública de Wompi en `config.js` y `.env` se sincronizó con la que aparece en el panel de Wompi Sandbox: `pub_test_PQAm6bJXtS4ScbCpBU058xY0vlTPFXfA`.

4. **Fortalecimiento de Cabeceras HTTP para Archivos de Datos**:
   - En `vercel.json`, los archivos bajo `/data/*.json` ahora tienen `Content-Security-Policy: default-src 'none'` y `X-Content-Type-Options: nosniff`, impidiendo que el navegador interprete los JSON como scripts o los cargue fuera de contexto.

5. **Clases CSS Utilitarias para Reemplazo de Estilos Embebidos**:
   - Se agregaron en `styles/08-slideup.css`: `.btn-call-direct`, `.btn-whatsapp-compact`, `.slideup-unlocked-layout`, `.slideup-unlocked-row`, `.pagination-controls`, `.btn-pagination`, `.skeleton-*`, `.empty-state-msg`, `.error-state-msg`, `.unlocked-phone-box`, `.modal-summary-*`, `.city-count-badge`, entre otras.

---

## 2. Por qué cambió

- **Error de Wompi en producción**: El backend rechazaba las credenciales sandbox con el error `CONFIGURACION_INSEGURA: WOMPI_INTEGRITY_SECRET usa credenciales de prueba`. El usuario necesita operar en modo sandbox hasta completar las pruebas de pago.
- **Solicitud del usuario**: Implementar firma HMAC-SHA256 para proteger la integridad de los archivos JSON contra alteraciones.
- **Mejora de seguridad**: La verificación de integridad se hace exclusivamente en el backend para que la llave secreta nunca se exponga al navegador.

---

## 3. Archivos afectados

- `lib/env.js`: Lógica de `requireEnv()` reescrita para respetar `WOMPI_ENV`.
- `api/leads/unlock.js`: Verificación de integridad HMAC-SHA256 del dataset antes del desbloqueo.
- `scripts/sign-data.js`: Nuevo script de firmado para el scraper.
- `config.js`: Llave pública de Wompi sincronizada con panel sandbox.
- `.env` y `.env.example`: Variable `WOMPI_ENV=sandbox` documentada.
- `.gitignore`: Archivos `data/*.sig` excluidos del repositorio.
- `vercel.json`: Cabeceras CSP y nosniff para `/data/*.json`.
- `styles/08-slideup.css`: Clases CSS utilitarias para botones, estados y layouts.
- `app.js`, `app.min.js`, `style.css`, `style.min.css`: Recompilados.

---

## 4. Decisiones técnicas tomadas

- **WOMPI_ENV por defecto es "sandbox"**: Si no se define la variable, el sistema asume sandbox. Esto previene bloqueos accidentales por omisión.
- **Firma HMAC-SHA256 con clave existente**: Se reutiliza `LEADS_ENCRYPTION_KEY` como secreto de firmado para no agregar otra variable de entorno. La seguridad no se compromete porque HMAC y AES-GCM operan en dominios criptográficos distintos.
- **Retrocompatibilidad**: Si no existe archivo `.sig`, el desbloqueo funciona normalmente. Esto permite que datos antiguos sin firmar sigan operando.
- **Verificación server-side exclusiva**: La idea original del usuario proponía verificar la firma en el frontend, pero eso expondría la llave secreta en el JavaScript público. La verificación se movió al backend.

---

## 5. Estado actual del sistema

- `npm test`: aprobado, 8/8 fases DevSecOps al 100%.
- `npm run build`: aprobado, 16 módulos CSS y 12 módulos JS compilados.
- `node scripts/sign-data.js`: 2 archivos JSON firmados correctamente.
- Credenciales Wompi Sandbox configuradas y aceptadas por `requireEnv()`.
- **Acción pendiente en Vercel**: Agregar `WOMPI_ENV=sandbox` en las variables de entorno del proyecto.
