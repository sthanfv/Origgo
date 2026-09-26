# Retiro de anuncios (Habeas Data — Ley 1581 de 2012)

> Implementado el 2026-09-25. Código: `lib/support/takedown.js` (formulario público), `lib/retiros.js` (solicitudes), `lib/busqueda-inmuebles.js` + `lib/indice-busqueda.js` (búsqueda), `lib/admin/retiros.js` (panel), `src/components/FormularioRetiro.tsx`, `src/admin/PanelRetiros.tsx`. Pruebas: `tests/retiros_habeas_data.test.js`, `tests/support_blacklist.test.js`.

## Qué tiene que dar quien pide el retiro

Un texto como "borren mi casa" no permite saber cuál es el inmueble. Por eso el formulario (Centro de Auto-Soporte → "Retirar Inmueble") exige:

1. **Al menos un dato que identifique el anuncio** (con uno basta):
   - enlace o **código del inmueble** en Origgo (el código aparece en la ficha técnica de cada anuncio, ej. `lead-inm-1234`);
   - enlace del **anuncio original** (Finca Raíz, Metrocuadrado…);
   - **celular** que aparece en el anuncio;
   - si no tiene ninguno: **ciudad + barrio o descripción** (tipo, precio aproximado…).
2. **Quién lo pide:** nombre, correo para responder, relación con el inmueble (propietario, apoderado, arrendatario, familiar, otro) y motivo.
3. **Declaración de veracidad y autorización** para usar esos datos solo para atender la solicitud.

## Qué pasa después

| Situación | Resultado |
| --- | --- |
| El código, el enlace original o el celular coinciden **exactamente** con un anuncio | Se oculta **de inmediato** (retiro preventivo) y queda en la lista negra para que el cazador no lo vuelva a publicar |
| Se dio el enlace de un portal que Origgo aún no tiene | Se bloquea su identificador: el cazador no lo publicará |
| Solo datos aproximados (ciudad, barrio, descripción) | **No se oculta nada**; el panel muestra los candidatos para que el administrador decida |

Cada solicitud recibe un **radicado** (`HD-AAAAMMDD-XXXX`) y una **fecha límite de 15 días hábiles** (art. 15 de la Ley 1581). El cálculo no descuenta festivos, así que el plazo nunca queda más largo que el legal.

## En el panel (`/admin` → pestaña Retiros)

- Lista de solicitudes con estado (`recibida`, `resuelta`, `rechazada`) y días restantes.
- Al abrir una solicitud se ven los datos de quien pide, cómo identificó el anuncio y los inmuebles encontrados.
- **Retirar:** oculta y bloquea los inmuebles marcados; la solicitud queda `resuelta`.
- **Rechazar:** revierte el retiro preventivo (el anuncio vuelve a verse); la solicitud queda `rechazada`.
- **Buscador:** acepta código, enlace (de Origgo o del portal), celular o texto libre ("apartamento laureles medellín").
- **Reindexar búsqueda:** llena el índice de los inmuebles guardados antes del 2026-09-25 (o tras rotar la clave de cifrado). Se hace por tandas de 200 y solo escribe lo que cambió. **Hay que usarlo una vez** después del despliegue.
- Todo queda en la auditoría (`admin_auditoria`).

## Cómo se busca sin buscador de pago

Firestore no busca texto libre. Al guardar cada inmueble (ingesta) se agregan:

- `indice_busqueda`: palabras sin tildes de ciudad, barrio, tipo, operación, portal, título y código → consulta `array-contains`.
- `enlace_huella`: SHA-256 del enlace original normalizado → consulta `==`.
- `telefono_huella`: **índice ciego** (HMAC-SHA256 con una clave derivada de la de cifrado): encuentra los anuncios de un celular sin guardar el número en claro.

## Datos personales (minimización)

- Del celular del anuncio, la solicitud guarda solo la huella y los 2 últimos dígitos.
- No se guarda la IP. La lista negra ya no guarda teléfono ni IP (antes sí).
- Nombre y correo de quien pide se conservan porque hacen falta para responder y como constancia del trámite.

## Pendientes

- Enviar por correo el acuse de recibo con el radicado y la respuesta final (Resend, gratis).
- Mostrar el enlace "¿Es tu inmueble? Pide el retiro" directamente en la ficha del anuncio.
