# MEMORY.md — Origgo (Showcase y Ledger de Oportunidades Directas)

Última actualización: 2026-09-08 18:36 (GMT-5)

---

## 1. Qué cambió

1. **Ofuscación Anti-Ingeniería Inversa de Títulos (CRÍTICO)**:
   - Los títulos públicos de las tarjetas ya NO muestran el nombre del conjunto, urbanización o barrio.
   - Antes: "Apartamento en venta en Hacienda Santa Cruz, Ibagué"
   - Ahora: "Apartamento en Venta — Ibagué"
   - El título completo, barrio y ubicación exacta se guardan CIFRADOS dentro de `contacto_cifrado` (AES-256-GCM).
   - Solo se revelan tras el desbloqueo pagado, a través de `datosRevelados` en la respuesta del API.
   - Esto impide que un usuario copie el título, lo busque en Google y encuentre el anuncio original gratis.

2. **Corrección del PIN Protegido**:
   - El modal de bienvenida mostraba "PIN protegido" cuando el PIN no llegaba del backend.
   - Ahora muestra instrucciones claras: "Revisa tu correo o usa Recuperar PIN".
   - El botón de copiar PIN se oculta correctamente cuando no hay PIN disponible.

3. **Corrección del Badge de Créditos**:
   - Después de cada desbloqueo, `actualizarBadgeVip()` se llama para reflejar el saldo real.
   - El toast post-desbloqueo muestra el número exacto de créditos restantes.

4. **Firma HMAC-SHA256 Integrada en el Publisher del Scraper**:
   - `publisher_web.js` ahora genera y sube `inmobiliario.json.sig` junto al JSON a GitHub.
   - El backend de la web verifica la firma antes de desbloquear contactos.
   - El scraper en el teléfono firmará automáticamente cuando se despliegue la nueva versión.

5. **Compatibilidad Sandbox Wompi** (sesión anterior):
   - `lib/env.js` respeta `WOMPI_ENV=sandbox` para no rechazar credenciales de prueba.

6. **Índice Maestro de Archivos**:
   - Nuevo `docs/INDICE_ARCHIVOS.md` con mapa completo de ambos proyectos.
   - Cada archivo tiene descripción en una línea para localización rápida por humanos.

---

## 2. Por qué cambió

- El usuario descubrió que copiando el texto de una tarjeta y buscándolo en Google, se encontraba el anuncio original con teléfono incluido, eliminando la necesidad de pagar. Esto destruía la monetización.
- El "PIN protegido" confundía a los usuarios: si cerraban sesión, no podían volver a entrar.
- Los créditos no se actualizaban visualmente después de cada desbloqueo, causando confusión.
- La firma HMAC estaba solo en la web pero no en el scraper que genera los datos.
- La documentación existía pero nadie sabía dónde estaban los archivos.

---

## 3. Archivos afectados

### Scraper (ofertas-hunter-pro)
- `publisher_web.js`: Ofuscación de títulos, firma HMAC-SHA256, datos reales en contacto cifrado.
- `docs/INDICE_ARCHIVOS.md`: Nuevo índice maestro de archivos.

### Web (hunter-portal-showcase)
- `api/leads/unlock.js`: Devuelve `datosRevelados` (título original, barrio, ubicación completa).
- `modules/07-unlock.js`: Recibe y renderiza `datosRevelados` en la tarjeta tras desbloqueo.
- `modules/11-welcome.js`: PIN real o instrucciones de recuperación en vez de "PIN protegido".
- `docs/INDICE_ARCHIVOS.md`: Copia del índice maestro.
- `app.js`, `app.min.js`: Recompilados.

---

## 4. Decisiones técnicas tomadas

- **Ofuscación simple pero efectiva**: En vez de usar NLP para reescribir títulos (complejo), se genera un título genérico tipo + operación + ciudad. Es simple, seguro y no revela nada buscable.
- **Datos revelados en contacto cifrado**: El título original, barrio y ubicación se empaquetan dentro del mismo blob AES-256-GCM que ya protegía teléfono y enlace. No se necesita infraestructura nueva.
- **Retrocompatibilidad**: Si `datosRevelados` es null (datos antiguos sin título cifrado), la tarjeta simplemente no actualiza el título. Funciona con datos viejos y nuevos.
- **PIN pendiente en vez de falso**: Mostrar "Revisa tu correo" es honesto y accionable. "PIN protegido" era confuso e inútil.

---

## 5. Estado actual del sistema

- `npm test` (web): 8/8 fases DevSecOps al 100%.
- `node -c publisher_web.js` (scraper): Sintaxis válida.
- Scraper pendiente de despliegue al teléfono para activar ofuscación + firma.
- `WOMPI_ENV=sandbox` pendiente de agregar en Vercel Environment Variables.
