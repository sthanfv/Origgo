# 🏛️ Hunter Pro Intelligence — Portal Showcase ($0 Cost)
## Fachada Web de Alta Gama con Renderizador Agnóstico, Pasarela Wompi y Ledger Criptográfico

Este repositorio contiene la interfaz pública desacoplada e independiente diseñada para mostrar oportunidades directas y arbitraje a clientes finales (agentes inmobiliarios top e inversionistas).

---

## 🎯 Principios de Diseño y Arquitectura

1. **Aislamiento Total del Backend:** Este proyecto es 100% independiente del scraper (`ofertas-hunter-pro`). Consume únicamente archivos estáticos `.json` exportados, garantizando que el servidor del celular Samsung Galaxy J7 permanezca invisible y protegido de ataques DDoS o tráfico masivo.
2. **Criptografía Zero-Trust en Reposo:** Los teléfonos y enlaces reales de los propietarios directos se cifran en origen con **AES-256-GCM** (`iv:authTag:ciphertext`). El JSON público únicamente expone el teléfono ofuscado (`+57 ••• ••••`).
3. **Desbloqueo en Memoria y Sesiones JWT:** El descifrado ocurre estrictamente en el backend serverless (`/api/leads/unlock`) tras validar un token JWT firmado (HMAC-SHA256) emitido al usuario verificado por celular y PIN.
4. **Pasarela Wompi e Idempotencia:** Integración oficial con Wompi Bancolombia (Sandbox y Producción) con validación criptográfica de firmas de integridad SHA-256 y eventos mediante `crypto.timingSafeEqual`, previniendo ataques de timing y doble acreditación.
5. **Ledger de Créditos Dual:** Soporte nativo para Google Cloud Firestore en producción y fallback transaccional atómico en disco (`/tmp` o archivo local), garantizando que el usuario nunca pague dos veces por el mismo lead.
6. **Estética Glassmorphic & Bento Grid:** Modo oscuro y claro, visualización ejecutiva con carruseles bajo demanda y modal de checkout nativo.

---

## 📂 Estructura de Archivos

```
hunter-portal-showcase/
├── index.html                  # Maquetación principal con Bento Grid y Modal de Checkout
├── style.css                   # Estilos completos Shadcn UI y Glassmorphism
├── style.min.css               # Hoja de estilos compilada y balanceada
├── app.js                      # Controlador del frontend, carruseles, sesión y checkout
├── config.js                   # Configuración y llaves públicas de cliente
├── package.json                # Dependencias, scripts de build y tests
├── README.md                   # Documentación técnica completa
├── .env.example                # Plantilla de variables de entorno de producción
├── api/                        # Funciones Serverless en Vercel
│   ├── lib/
│   │   ├── crypto.js           # Cifrado AES-256-GCM, tokens JWT y comparación constante
│   │   └── db.js               # Ledger de usuarios, créditos y transacciones
│   ├── payments/
│   │   ├── create-order.js     # Creación de orden y firma de integridad Wompi
│   │   └── webhook-wompi.js    # Receptor de eventos Wompi con validación HMAC
│   ├── auth/
│   │   └── session.js          # Inicio de sesión por celular + PIN o referencia
│   ├── leads/
│   │   └── unlock.js           # Desbloqueo de leads con deducción atómica de crédito
│   └── user/
│       └── balance.js          # Consulta de saldo, perfil y leads desbloqueados
├── scripts/
│   ├── build.js                # Compilador y minificador determinista de CSS
│   ├── validate.js             # Suite de validación en 6 fases pre-despliegue
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
| `WOMPI_PRIVATE_KEY` | Privado | Llave privada de Wompi para consultas API. |
| `WOMPI_INTEGRITY_SECRET` | Crítico | Secreto de integridad provisto por Wompi para firmas SHA-256 de órdenes. |
| `WOMPI_EVENTS_SECRET` | Crítico | Secreto para validar autenticidad de firmas en webhooks. |
| `FIREBASE_PROJECT_ID` | Opcional | ID de proyecto Firebase/Firestore si se usa persistencia en la nube. |
| `FIREBASE_SERVICE_ACCOUNT` | Opcional | JSON credencial de cuenta de servicio de Firebase codificado en Base64. |

---

## 🧪 Validación y Pruebas Automatizadas

El proyecto cuenta con una suite automatizada de 6 fases respaldada por Git Hooks (`husky`):

```bash
# Ejecutar compilación y suite completa de pruebas:
npm test
```

Fases evaluadas en cada commit y push:
1. Sintaxis de JavaScript y endpoints serverless en `api/`.
2. Integridad de estilos CSS y validación de selectores críticos.
3. Marcado HTML y presencia de recursos enlazados.
4. Contratos de datos JSON y verificación de estructura AES-256 (`iv:tag:cipher`).
5. Suite de integración de pasarela Wompi, idempotencia y ledger de créditos (8 pruebas).
6. Auditoría Zero-Trust de ausencia de secretos en código estático.

---

## 🚀 Despliegue en Vercel

1. Clonar el repositorio y configurar variables en Vercel.
2. Los endpoints dentro de `api/` se despliegan automáticamente como funciones Serverless de Node.js.
3. Las páginas estáticas y recursos optimizados se sirven desde Vercel Edge CDN con compresión Brotli.
