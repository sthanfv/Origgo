# 🏛️ ARCHITECTURE.md — Hunter Pro Intelligence (Showcase & Ledger)
## Arquitectura de Alta Disponibilidad, Resiliencia Financiera y Desacoplamiento Modular (Estándar Desmulta)

---

## 1. Visión General y Filosofía de Diseño

El portal comercial `hunter-portal-showcase` es la fachada pública decoupled y de coste $0 diseñada para que inversionistas y agentes inmobiliarios capturen oportunidades directas de propietarios (FSBO) y vehículos en Colombia con margen de arbitraje comercial.

A diferencia de las aplicaciones web tradicionales monolíticas, este sistema está concebido para **operar con éxito en un "mundo caótico"** caracterizado por:
- Cortes intermitentes de red y micro-desconexiones en conexiones móviles.
- Picos masivos de tráfico o intentos coordinados de denegación de servicio (DDoS).
- Intentos maliciosos de suplantación de identidad (fuerza bruta a credenciales).
- Fraude financiero (manipulación de referencias de pago o firmas adulteradas).
- Caídas o latencias temporales en la nube de Google Cloud Firestore o pasarelas externas (Wompi).

---

## 2. Diagrama de Arquitectura Multicapa

```
                                  ┌──────────────────────────────┐
                                  │      CLIENTE WEB / PWA       │
                                  │   (Vainilla JS Modular +     │
                                  │    Caché Offline Seguro)     │
                                  └──────────────┬───────────────┘
                                                 │ HTTPS + x-trace-id
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CAPA 1: EDGE & PERMISSIONS (vercel.json)                                                       │
│  • Cabeceras OWASP: HSTS (max-age 2 años, preload), X-Content-Type: nosniff, Frame: DENY.     │
│  • Políticas de Caché CDN: max-age=300 con stale-while-revalidate para JSON y 86400 para CSS/JS│
│  • Permissions-Policy: camera=(), microphone=(), geolocation=()                                │
└────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                 │ Peticiones Entrantes
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CAPA 2: RATE LIMITING & MITIGACIÓN ANTI-DDOS (api/lib/rate-limiter.js)                         │
│  • Ventana deslizante en memoria por IP y clave secundaria (celular).                         │
│  • Límites estrictos: 12 órdenes/min, 8 logins PIN/15 min, 30 unlocks/min, 60 webhooks/min.   │
│  • Cabeceras de trazabilidad: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After.          │
└────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                 │ Tráfico Filtrado
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CAPA 3: SERVICIOS SERVERLESS Y MOTOR FINANCIERO (api/)                                         │
│  • create-order.js:  Generación determinista de orden y firma de integridad SHA-256 Wompi.     │
│  • webhook-wompi.js: Validación HMAC dinámica en tiempo constante (timingSafeEqual).           │
│  • session.js:       Reconciliación server-to-server con Wompi API ante reclamo de referencia. │
│  • unlock.js:        Deducción atómica de crédito y descifrado AES-256-GCM en memoria volátil. │
│  • balance.js:       Consulta de estado reactivo y leads desbloqueados para renderizado instant.│
└────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                 │ Operaciones Criptográficas y Datos
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CAPA 4: PERSISTENCIA Y RESILIENCIA CON BACKOFF EXPONENCIAL (api/lib/db.js)                     │
│  • Google Cloud Firestore: Modo primario de producción con soporte multi-región.               │
│  • Fallback Transaccional: Archivo transaccional local atómico para entornos serverless.       │
│  • Circuit Breaker & Retry: withRetry() con 3 intentos, backoff exponencial y jitter aleatorio.│
│  • Autenticación Zero-Trust: Erradicación absoluta de bypass por dígitos de celular.          │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Principios DevSecOps y Blindaje Financiero

### 3.1 Reconciliación Server-to-Server Oficial con Wompi
- **Problema previo**: Un atacante podía enviar cualquier referencia sintética (`HNT-3001234567-VIPNAC-...`) y el sistema le otorgaba acceso VIP ilimitado sin haber cobrado un solo peso.
- **Solución implementada**: `api/auth/session.js` consulta de manera síncrona y segura a la API oficial de Wompi (`https://production.wompi.co/v1/transactions?reference=...`) usando la llave secreta privada `WOMPI_PRIVATE_KEY`. Solo cuando la pasarela responde con estado formal `APPROVED` y se verifica que el monto cobrado coincide al centavo con el valor legal de la orden, se acredita la membresía.

### 3.2 Erradicación Total del Bypass de PIN
- **Problema previo**: Se permitía autenticar como usuario si el PIN coincidía con los últimos 4 dígitos del celular.
- **Solución implementada**: Eliminación total del fallback. La autenticación exige el PIN aleatorio criptográfico de 4 dígitos generado al momento del registro, o el token JWT firmado con HMAC-SHA256.

### 3.3 Tolerancia a Fallos de Red y Caos (Exponential Backoff + Jitter)
Toda interacción crítica con la capa de base de datos se ejecuta a través del envoltorio `withRetry`:
$$\text{delay} = \min(200 \times 2^{\text{intento}}, 2000) + \text{random}(0, 150) \text{ ms}$$
Esto previene el fenómeno de "rebaño atronador" (*thundering herd problem*) ante micro-cortes de red en la infraestructura de Google Cloud.

---

## 4. Modularización del Código Fuente (< 500 Líneas)

Para garantizar un mantenimiento ágil y prevenir la creación de archivos gigantes monolíticos:

### 4.1 Módulos JavaScript (`modules/`):
| Archivo | Responsabilidad | Líneas |
| :--- | :--- | :---: |
| `01-state.js` | Estado global reactivo, JWT en `localStorage`, login PIN y planes VIP. | 297 |
| `02-toast.js` | Notificaciones flotantes luxury con ambient glow, micro-barra y swipe. | 227 |
| `03-api.js` | Cliente HTTP centralizado, generación de `x-trace-id` y carga de datasets. | 41 |
| `04-filters.js` | Normalización de texto fonético, omnibox y filtrado de ciudades. | 180 |
| `05-carousel.js`| Carruseles fotográficos táctiles y drawer slide-up de detalles. | 105 |
| `06-cards.js` | Renderizado Bento Grid, skeletons, badges y formateo de precios. | 481 |
| `07-unlock.js` | Desbloqueo atómico de propietarios, actualización DOM y WhatsApp. | 264 |
| `08-checkout.js`| Modal de compra Wompi, selector de planes y widget checkout. | 325 |
| `09-ui-effects.js`| Háptica táctil, ondas ripple, parallax GPU y menú off-canvas. | 248 |
| `10-listeners.js`| Vinculación de eventos DOM, atajos de teclado y orquestación. | 463 |

### 4.2 Módulos CSS (`styles/`):
Divididos en 14 submódulos semánticos (`01-tokens.css` a `14-toast.css`), todos inferiores a 475 líneas, que se compilan deterministamente mediante `scripts/build.js` generando `style.min.css` (80.6 KB, -30% de peso).

---

## 5. Suite de Validación DevSecOps (8 Fases)

Respaldada por `npm test` antes de cada commit:
1. Sintaxis estricta con `node --check` en 23 archivos JS y lambdas serverless.
2. Integridad de estilos CSS, balance de llaves y presencia de selectores críticos.
3. Marcado HTML y cabeceras de seguridad globales OWASP en `vercel.json`.
4. Contratos de datos JSON y firmas criptográficas AES-256-GCM.
5. Suite automatizada de pasarela Wompi y ledger (12/12 pruebas al 100%).
6. Auditoría antifraude: prueba de inyección de referencia falsa rechazada con 403.
7. Auditoría de autenticación: verificación de que el bypass de PIN esté 100% erradicado.
8. Auditoría de modularidad: confirmación de que ningún módulo exceda las 500 líneas.
