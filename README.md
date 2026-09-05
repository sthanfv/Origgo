# 🏛️ Hunter Pro Intelligence — Portal Showcase ($0 Cost)
## Fachada Web de Alta Gama con Renderizador Agnóstico, Pasarela Wompi y Ledger Criptográfico

Este repositorio contiene la interfaz pública desacoplada e independiente diseñada para mostrar oportunidades directas y arbitraje a clientes finales (agentes inmobiliarios top e inversionistas).

---

## 🎯 Principios de Diseño y Arquitectura (Estándar Ecosistema Desmulta)

1. **Aislamiento Total del Backend:** Este proyecto es 100% independiente del scraper (`ofertas-hunter-pro`). Consume únicamente archivos estáticos `.json` exportados, garantizando que el servidor del celular Samsung Galaxy J7 permanezca invisible y protegido de ataques DDoS o tráfico masivo.
2. **Criptografía Zero-Trust en Reposo:** Los teléfonos y enlaces reales de los propietarios directos se cifran en origen con **AES-256-GCM** (`iv:authTag:ciphertext`). El JSON público únicamente expone el teléfono ofuscado (`+57 ••• ••••`).
3. **Desbloqueo en Memoria y Sesiones JWT:** El descifrado ocurre estrictamente en el backend serverless (`/api/leads/unlock`) tras validar un token JWT firmado (HMAC-SHA256) emitido al usuario verificado por celular y PIN.
4. **Pasarela Wompi e Idempotencia:** Integración oficial con Wompi Bancolombia (Sandbox y Producción) con validación criptográfica de firmas de integridad SHA-256 y eventos mediante `crypto.timingSafeEqual`, previniendo ataques de timing y doble acreditación.
5. **Reconciliación Server-to-Server Oficial:** El reclamo de referencias de pago verifica directamente con la API oficial de Wompi usando la llave privada antes de acreditar créditos o membresías, cerrando cualquier intento de fraude.
6. **Resiliencia ante el Caos:** Envoltorio `withRetry` con backoff exponencial y jitter aleatorio en operaciones críticas de base de datos, absorbiendo caídas de red o picos de latencia.
7. **Rate Limiting Anti-DDoS:** Middleware en memoria que protege endpoints financieros y autenticación contra ataques de fuerza bruta y saturación.
8. **Arquitectura Modular (< 500 líneas por módulo):** Frontend y estilos 100% particionados en módulos especializados bajo `modules/` y `styles/`.
9. **Estética Glassmorphic & Bento Grid:** Modo oscuro y claro, visualización ejecutiva con carruseles bajo demanda, ambient glow y modal de checkout nativo.

---

## 📂 Estructura de Archivos Modular

```
hunter-portal-showcase/
├── index.html                  # Maquetación principal con Bento Grid y Modal de Checkout
├── style.css                   # Hoja de estilos ensamblada deterministamente
├── style.min.css               # Hoja de estilos compilada y balanceada (80.6 KB, -30%)
├── app.js                      # Controlador orquestador del frontend
├── app.min.js                  # Script compilado y minificado (-15%)
├── config.js                   # Configuración y llaves públicas de cliente
├── package.json                # Dependencias, scripts de build y tests
├── README.md                   # Documentación técnica completa
├── MEMORY.md                   # Bitácora de memoria persistente del sistema
├── ARCHITECTURE.md             # Arquitectura técnica en 4 capas y estándares OWASP
├── vercel.json                 # Cabeceras globales OWASP (HSTS, nosniff, DENY) y caché
├── .env.example                # Plantilla de variables de entorno de producción
├── modules/                    # Módulos JavaScript especializados (< 500 líneas)
│   ├── 01-state.js             # Estado reactivo, localStorage, sesión JWT y PIN
│   ├── 02-toast.js             # Notificaciones toast flotantes luxury con ambient glow
│   ├── 03-api.js               # Cliente HTTP centralizado con x-trace-id
│   ├── 04-filters.js           # Búsqueda fonética inteligente, omnibox y ciudades
│   ├── 05-carousel.js          # Carruseles fotográficos táctiles y drawer de detalles
│   ├── 06-cards.js             # Renderizado Bento Grid, skeletons y formateo de precios
│   ├── 07-unlock.js            # Desbloqueo atómico de leads y enlace seguro a WhatsApp
│   ├── 08-checkout.js          # Modal de pago, selección de planes y widget Wompi
│   ├── 09-ui-effects.js        # Háptica táctil, ondas ripple, parallax GPU y temas
│   └── 10-listeners.js         # Event listeners del DOM, atajos de teclado y arranque
├── styles/                     # Módulos CSS especializados (< 475 líneas)
│   ├── 01-tokens.css           # Fuentes y tokens de diseño HSL
│   ├── 02-base.css             # Reseteo y tipografía global
│   ├── 03-header.css           # Cabecera institucional y branding
│   ├── 04-command-bar.css      # Barra táctica y omnibox
│   ├── 05-hero.css             # Hero en cápsula y cinta editorial
│   ├── 06-bento-grid.css       # Contenedor Bento Grid
│   ├── 07-cards.css            # Cuerpo de tarjetas y carruseles
│   ├── 08-slideup.css          # Drawer slide-up de detalles
│   ├── 09-checkout-modal.css   # Modal de checkout Wompi
│   ├── 10-checkout-plans.css   # Selector de planes y precios
│   ├── 11-mobile.css           # Responsividad móvil y navegación inferior PWA
│   ├── 12-sidebar.css          # Menú lateral off-canvas
│   ├── 13-footer.css           # Footer institucional y legal
│   └── 14-toast.css            # Notificaciones toast con ambient glow
├── api/                        # Funciones Serverless en Vercel
│   ├── lib/
│   │   ├── crypto.js           # Cifrado AES-256-GCM, tokens JWT y comparación constante
│   │   ├── db.js               # Ledger de usuarios, créditos y reintentos exponenciales
│   │   └── rate-limiter.js     # Middleware de limitación de tasa en memoria
│   ├── payments/
│   │   ├── create-order.js     # Creación de orden y firma de integridad Wompi
│   │   └── webhook-wompi.js    # Receptor de eventos Wompi con validación HMAC
│   ├── auth/
│   │   └── session.js          # Inicio de sesión por PIN y reconciliación Wompi
│   ├── leads/
│   │   └── unlock.js           # Desbloqueo de leads con deducción atómica de crédito
│   └── user/
│       └── balance.js          # Consulta de saldo, perfil y leads desbloqueados
├── scripts/
│   ├── build.js                # Compilador y ensamblador modular de CSS y JS
│   ├── validate.js             # Suite de validación DevSecOps en 8 fases
│   └── test_ledger_wompi.js    # Suite de pruebas unitarias de ledger y pagos
└── data/
    ├── inmobiliario.json       # Feed de oportunidades de bienes raíces selladas y cifradas
    └── vehiculos.json          # Feed de oportunidades automotrices (Flipping)
```

---

## ⚙️ Variables de Entorno (Vercel)

Para el funcionamiento seguro del backend serverless en producción, configure las siguientes variables en el panel de Vercel (**Settings > Environment Variables**):

| Variable | Tipo | Descripción |
| :--- | :--- | :--- |
| `LEADS_ENCRYPTION_KEY` | Crítico (32 bytes hex) | Llave simétrica AES-256 para cifrado y descifrado de datos de contacto. |
| `JWT_SECRET` | Crítico (string seguro) | Clave secreta para firma y verificación de tokens de sesión. |
| `WOMPI_PUBLIC_KEY` | Público | Llave pública de Wompi (`pub_test_...` o `pub_prod_...`). |
| `WOMPI_PRIVATE_KEY` | Privado | Llave privada de Wompi para consultas API y reconciliación server-to-server. |
| `WOMPI_INTEGRITY_SECRET` | Crítico | Secreto de integridad provisto por Wompi para firmas SHA-256 de órdenes. |
| `WOMPI_EVENTS_SECRET` | Crítico | Secreto para validar autenticidad de firmas en webhooks. |
| `FIREBASE_PROJECT_ID` | Opcional | ID de proyecto Firebase/Firestore si se usa persistencia en la nube. |
| `FIREBASE_SERVICE_ACCOUNT` | Opcional | JSON credencial de cuenta de servicio de Firebase codificado en Base64. |

---

## 🧪 Validación y Pruebas Automatizadas (8 Fases DevSecOps)

El proyecto cuenta con una suite automatizada de 8 fases respaldada por Git Hooks (`husky`):

```bash
# Ejecutar compilación y suite completa de pruebas:
npm test
```

Fases evaluadas en cada commit y push:
1. **Sintaxis de JavaScript**: 23 archivos validados con `node --check` (lambdas en `api/`, submódulos en `modules/` y compilados).
2. **Integridad y balance CSS**: 14 submódulos verificados, balance de llaves y selectores críticos.
3. **Marcado HTML y Seguridad OWASP**: Doctype, meta tags, recursos físicos y cabeceras de seguridad en `vercel.json`.
4. **Contratos de datos JSON**: Validación de estructura AES-256 (`iv:tag:cipher`) en 52 oportunidades.
5. **Suite de integración Wompi y ledger**: 12/12 pruebas al 100% de pasarela, idempotencia y criptografía.
6. **Auditoría Antifraude en Reconciliación**: Rechazo formal de reclamos con referencias falsas o no aprobadas.
7. **Auditoría de PIN Estricto**: Confirmación de erradicación total del bypass de autenticación por dígitos de celular.
8. **Auditoría de Modularidad Arquitectónica**: Verificación de que ningún archivo en `modules/` ni en `styles/` exceda 500 líneas.

---

## 🚀 Despliegue en Vercel

1. Clonar el repositorio y configurar variables en Vercel.
2. Los endpoints dentro de `api/` se despliegan automáticamente como funciones Serverless de Node.js.
3. Las páginas estáticas y recursos optimizados se sirven desde Vercel Edge CDN con compresión Brotli y cabeceras OWASP.
