# Panel de administración de Origgo (`/admin`)

Panel para operar el negocio sin tocar código: todo lee y escribe en **Firestore**, que es la fuente de la verdad.
Página aparte del sitio público (`admin.html` + `src/admin/`), con `noindex`.

## Seguridad: 4 capas, verificadas en el servidor en cada acción

| Capa | Qué se comprueba | Dónde |
| --- | --- | --- |
| 1. Cuenta de Google | Token de Firebase firmado por Google (RS256), del proyecto correcto y vigente | `lib/admin-auth.js` |
| 2. Correo autorizado | Correo verificado y presente en `ADMIN_EMAILS` | `lib/admin-auth.js` |
| 3. Rol de administrador | Custom claim `admin: true` en la cuenta de Firebase | `lib/admin-auth.js` |
| 4. Código 2FA (TOTP) | Código de la app autenticadora → cookie `HttpOnly; Secure; SameSite=Strict` de 8 h ligada al uid | `lib/admin/dos-factores.js`, `lib/admin/sesion.js` |

Además: máx. 5 intentos de código cada 15 min, cada código sirve una sola vez, y todo queda en `admin_auditoria`.
No se usa `firebase-admin/auth` en Vercel (falla con `ERR_REQUIRE_ESM`); ver hito 110 de `MEMORY.md`.

## Sesión (estándar OWASP / NIST 800-63B)

- **15 minutos sin actividad** cierran la sesión; lo exige el servidor (`lib/admin/sesion.js`), no solo la página.
- **2 minutos antes** aparece el aviso "¿Sigues ahí?" con cuenta regresiva: "Seguir conectado" o "Cerrar sesión".
- **Máximo 8 horas** desde que se verificó el código, aunque haya actividad.
- **Pestañas sincronizadas:** la actividad en una cuenta para todas; salir en una sale en todas.
- **Cerrar la pestaña o el navegador** cierra la sesión (cookie de sesión y Firebase con persistencia de sesión).

## Operación

| Tarea | Cómo |
| --- | --- |
| Dar o quitar el rol de administrador | `node scripts/admin-rol.js` (a los correos de `ADMIN_EMAILS`) · `node scripts/admin-rol.js --quitar correo@...` |
| Configurar la app autenticadora | `node scripts/admin-2fa-enrolar.js` → abrir `ADMIN_2FA_ENROLAMIENTO.html`, escanear, guardar los códigos y borrar el archivo |
| Perdí el celular | Entrar con un **código de respaldo** (archivo "NO TOCAR - Codigos de respaldo ORIGGO" en el Escritorio), luego `node scripts/admin-2fa-enrolar.js --forzar` y actualizar `ADMIN_TOTP_SECRET` y `ADMIN_BACKUP_CODES` en Vercel |
| Olvidé la contraseña | El panel no tiene contraseña propia: se entra con Google. La recuperación es la de la cuenta de Google (enlace en la pantalla de entrada) |
| Revisar el diseño sin iniciar sesión | `npm run dev` y abrir `/admin.html?vista=login`, `?vista=codigo`, `?vista=sin-acceso` o `?vista=panel` (solo en desarrollo; se elimina del build) |
| Probar la animación del código | En `?vista=codigo`, `123456` simula un código correcto (anillo con check) y cualquier otro, uno incorrecto (sacudida en rojo). Solo en desarrollo |

Variables en Vercel (Production): `ADMIN_EMAILS`, `ADMIN_TOTP_SECRET`, `ADMIN_BACKUP_CODES`.
Límite del plan Hobby: `api/` debe tener como máximo **12 funciones**; toda ruta nueva del panel va como acción de `api/admin.js`.

## Cuota gratuita de Firestore (incidente del 2026-09-25)

El plan gratis (Spark) permite **50.000 lecturas y 20.000 escrituras al día**; se restablece a las **2:00 a. m. hora de Colombia**. Si se agota, Firestore responde `RESOURCE_EXHAUSTED`, el panel muestra "Se agotó la cuota diaria gratuita…" y la vitrina sirve la última copia buena.

| Consumidor | Antes | Ahora |
| --- | --- | --- |
| Lista negra (el cazador la pide cada 3 min) | hasta ~74.000 lecturas/día | caché de 24 h que se renueva al registrar un retiro (con 30 min y ~970 registros de prueba se agotó la cuota otra vez el 2026-09-25; lista vaciada) |
| Catálogo público (`/api/leads/list`) | ~150–300 lecturas por visita no cacheada | caché 15 min → máx. ~14.400/día; se renueva al cambiar algo en el panel |
| `npm test` | escribía y leía Firestore de producción | base en memoria (`FIRESTORE_DESACTIVADO=1`) |

Caché: `lib/cache.js` (memoria de la función → Upstash → Firestore), con copia de respaldo de 24 h y pausa de 2 min tras un fallo de cuota.

## Módulos: hechos y pendientes

El estándar es que toda función del sitio que requiera operación humana se gestione desde el panel. Las llaves, las copias de seguridad y los servidores **no** van aquí: siguen en las consolas de Google, Vercel y GitHub.

| Módulo | Estado | Datos | Notas |
| --- | --- | --- | --- |
| Catálogo (ocultar, destacar, eliminar, buscar, filtrar, paginar) | ✅ Hecho | `leads` | |
| Vitrina (contador de la portada) | ✅ Hecho | `config/showcase` | |
| Solicitudes de retiro de anuncios (Habeas Data) | ✅ Hecho (2026-09-25) | `solicitudes_retiro`, `blacklisted_leads` | Pestaña **Retiros**: cola con radicado y plazo, buscador, retirar/rechazar, reindexar. Ver [RETIRO_DE_ANUNCIOS.md](RETIRO_DE_ANUNCIOS.md) |
| Auditoría (ver quién hizo qué) | ⏳ Pendiente | `admin_auditoria` | Ya se registra; falta la vista |
| Métricas del embudo | ⏳ Pendiente | `funnel_daily_metrics` | |
| Notificaciones push | ⏳ Pendiente | `push_subscriptions` | Enviar alertas desde el panel |
| Usuarios, créditos y órdenes | ⏸ Depende del pivote | `users`, `transactions`, `orders` | Con "buscador que enlaza" desaparece la venta de contactos; definir después del pivote |
| Edición completa de un inmueble (formulario) | ⏳ Pendiente | `leads` | Hoy la API ya acepta los campos editables; falta el formulario |

## Pendientes técnicos detectados (prioridad)

1. **Crítico — modo memoria permanente en `lib/db.js`:** al primer error de cuota, la función cambia a una base en memoria **hasta que Vercel la reinicie**, aunque la cuota ya se haya restablecido. Mientras tanto, un pago (webhook de Wompi), créditos o desbloqueos se guardarían en memoria y **se perderían**. Corregir: pausa temporal (reintentar Firestore tras unos minutos) y que las escrituras críticas respondan 503 (Wompi reintenta el webhook) en vez de guardar en memoria.
2. **Cazador:** guardar localmente la última lista negra buena; hoy, si la consulta falla, usa una lista vacía y podría republicar anuncios retirados.
3. **Cazador:** `publisher_web.js` tiene una clave de cifrado de respaldo escrita en el código (`LEADS_ENCRYPTION_KEY`). Quitarla, rotar la clave y dejarla solo en variables de entorno.
