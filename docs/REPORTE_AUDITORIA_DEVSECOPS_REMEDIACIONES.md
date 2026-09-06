# Reporte de Auditoría DevSecOps y Remediaciones

Fecha: 2026-09-06  
Estado: Remediado y validado con `npm test` y `npm audit --omit=dev`.

## 1. Exposición de archivos internos en producción/local

**Hallazgo:** El servidor local y la configuración de despliegue podían publicar código fuente, `.env`, `service-account.json`, módulos internos y dependencias si el directorio raíz era usado como salida estática.

**Gravedad:** Crítica

**Vector de Ataque y Flujo de Reproducción Paso a Paso:**
1. Abrir el sitio desplegado o local.
2. Solicitar rutas como `/.env`, `/service-account.json`, `/modules/01-state.js`, `/lib/db.js` o `/node_modules/zod/package.json`.
3. Leer secretos, estructura del backend o lógica de negocio si el servidor responde `200`.

**Impacto en el Negocio:** Filtración de credenciales, arquitectura interna, llaves de servicio, endpoints sensibles y lógica antifraude.

**Código de Remediación Exacto:**
- `vercel.json` usa `"outputDirectory": "dist"`.
- `scripts/build.js` genera `dist/` copiando solo assets públicos y excluyendo `.env`, `api`, `lib`, `modules`, `node_modules`, `local_db.json` y `ledger_store.json`.
- `server.js` bloquea rutas internas antes de servir archivos:

```js
const bloqueado = /(^|[\\/])(\.git|node_modules|api|lib|scripts|modules|\.husky)([\\/]|$)|(^|[\\/])(\.env.*|package(-lock)?\.json|firebase\.json|firestore\.rules|vercel\.json)|service-account.*\.json$|\.(md|map|pem)$|local_db\.json$/i;
if (rel.startsWith('..') || path.isAbsolute(rel) || bloqueado.test(rel)) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  return res.end('404 No encontrado');
}
```

Prueba integrada: `scripts/test_security_hardening.js`.

## 2. PIN y contactos persistidos o expuestos en estado cliente

**Hallazgo:** El frontend guardaba datos de usuario y contactos desbloqueados en `localStorage`, y el JWT podía transportar `pin` legible en payload.

**Gravedad:** Alta

**Vector de Ataque y Flujo de Reproducción Paso a Paso:**
1. Comprar o iniciar sesión.
2. Abrir DevTools.
3. Leer `localStorage.hunter_user_data`, `hunter_unlocked_contacts` o decodificar el payload JWT.
4. Extraer PIN/contactos o reutilizar datos para impersonación local.

**Impacto en el Negocio:** Exposición de credenciales permanentes y PII de propietarios, pérdida de confianza y abuso de contactos pagados.

**Código de Remediación Exacto:**
- `modules/01-state.js` conserva solo `hunter_pro_token` y borra caches anteriores.
- `api/auth/session.js`, `api/leads/unlock.js` y `api/user/balance.js` ya no incluyen `pin` en JWT ni respuestas persistentes.
- La recuperación por correo cambió a enlace temporal firmado:

```js
const recoveryToken = signJwt({
  purpose: 'recover_session',
  phone: user.phone,
  email: normEmail,
  nonce: crypto.randomUUID(),
  role: 'recovery'
}, JWT_SECRET, 15 / (24 * 60));
```

Prueba integrada: `scripts/test_ledger_wompi.js` valida que webhook y recuperación no devuelvan PIN.

## 3. XSS/attribute injection en toasts y enlaces de contacto

**Hallazgo:** Valores controlables por dataset, caché o API podían entrar en `innerHTML`, `href`, `tel:` o `window.open` sin validación de esquema/host.

**Gravedad:** Alta

**Vector de Ataque y Flujo de Reproducción Paso a Paso:**
1. Manipular caché/estado local o respuesta API con `javascript:alert(1)` en `contacto.enlace`.
2. Renderizar una tarjeta desbloqueada.
3. Hacer clic en “Ver Anuncio” o “WhatsApp”.

**Impacto en el Negocio:** XSS reflejado/almacenado en cliente, robo de sesión, phishing y redirecciones maliciosas desde UI confiable.

**Código de Remediación Exacto:**
- `modules/00-security.js` centraliza sanitización:

```js
function sanitizarUrlCliente(urlRaw, hostsPermitidos) {
  const url = new URL(String(urlRaw || '').trim(), window.location.origin);
  if (url.protocol !== 'https:') return '';
  if (!hostPermitido(url.hostname.toLowerCase(), hostsPermitidos)) return '';
  return escaparHtml(url.href);
}
```

- `modules/06-cards.js` y `modules/07-unlock.js` usan `sanitizarContactoCliente(contacto)`.
- `modules/02-toast.js` escapa `titulo`, `mensaje` y `actionText` antes de usar `innerHTML`.

Prueba QA: la suite de sintaxis y validación se ejecuta en `scripts/validate.js`; los flujos de contacto quedan cubiertos por sanitización central reutilizada.

## 4. Manipulación cliente de `contactoCifrado` y ciudad del lead

**Hallazgo:** `/api/leads/unlock` confiaba en `contactoCifrado` y `leadCity` enviados por el navegador.

**Gravedad:** Alta

**Vector de Ataque y Flujo de Reproducción Paso a Paso:**
1. Obtener un JWT válido.
2. Enviar `POST /api/leads/unlock` con `leadId` arbitrario y `contactoCifrado`/`leadCity` manipulados.
3. Intentar desbloquear datos que no pertenecen al catálogo oficial o forzar cobertura de ciudad.

**Impacto en el Negocio:** Bypass de lógica de créditos/cobertura, abuso de plan ciudad y entrega de contactos no autorizados.

**Código de Remediación Exacto:**
- `lib/leads.js` indexa `data/inmobiliario.json` y `data/vehiculos.json`.
- `api/leads/unlock.js` resuelve el lead desde servidor y descifra antes de descontar:

```js
const leadCatalogo = obtenerLeadPorId(leadId);
if (!leadCatalogo && process.env.NODE_ENV !== 'test') {
  return res.status(404).json({ ok: false, error: 'LEAD_NO_ENCONTRADO' });
}
const contactoCifradoOficial = leadCatalogo?.contacto_cifrado || '';
```

Prueba integrada: `scripts/test_ledger_wompi.js` valida desbloqueo, doble clic, plan ciudad y no doble cobro.

## 5. Doble creación/reclamo de órdenes y secuestro de sesión post-pago

**Hallazgo:** El checkout podía disparar múltiples órdenes por clics repetidos y `claim_reference` podía emitir sesión sobre cuentas existentes sin sesión/PIN si la referencia era aprobada.

**Gravedad:** Alta

**Vector de Ataque y Flujo de Reproducción Paso a Paso:**
1. Pulsar repetidamente “Pagar” o automatizar llamadas a `/api/payments/create-order`.
2. Reusar una referencia aprobada de una cuenta existente.
3. Intentar obtener token sin conocer el PIN.

**Impacto en el Negocio:** Órdenes duplicadas, conciliaciones inconsistentes y posible toma de sesión si se abusa del flujo post-pago.

**Código de Remediación Exacto:**
- `modules/08-checkout.js` genera `Idempotency-Key` y bloquea concurrencia con `pagoWompiEnProgreso`.
- `api/payments/create-order.js` exige UUID v1-v5 y guarda `accountExistedAtOrderCreation`.
- `api/auth/session.js` exige sesión vigente o PIN para cuentas preexistentes:

```js
const puedeEmitirToken = !cuentaExistiaAlCrearOrden || sesionActual?.phone === celular || Boolean(pinValido);
if (!puedeEmitirToken) {
  return res.status(202).json({ ok: true, requiresLogin: true });
}
```

Prueba integrada: `scripts/test_ledger_wompi.js` cubre idempotencia de orden, webhook duplicado y protección de cuentas existentes.

## 6. Configuración insegura de secretos y dependencia vulnerable

**Hallazgo:** Había fallbacks de secretos fuera de pruebas y `npm audit` reportaba `uuid <11.1.1` por cadena transitiva de `firebase-admin`.

**Gravedad:** Media

**Vector de Ataque y Flujo de Reproducción Paso a Paso:**
1. Desplegar sin variables reales.
2. La app podría usar secretos de prueba o una dependencia con CVE conocido.
3. Un atacante reduce el costo de romper integridad o explota paquetes vulnerables en superficie indirecta.

**Impacto en el Negocio:** Firmas predecibles, malas configuraciones en producción y deuda de cumplimiento.

**Código de Remediación Exacto:**
- `lib/env.js` exige `requireEnv` y rechaza credenciales `test_`, `pub_test_`, `prv_test_` en producción.
- `package.json` agrega override seguro:

```json
"overrides": {
  "uuid": "^11.1.1"
}
```

Pruebas:
- `npm audit --omit=dev`: 0 vulnerabilidades.
- `npm test`: 8 fases DevSecOps completas.
