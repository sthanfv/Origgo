# 🔌 Guía Maestra de Integraciones Externas — Ecosistema Origgo ($0 Coste)

> **Estándar DevSecOps — Nivel 9.9 / 10**  
> Todas las integraciones seleccionadas operan estrictamente bajo **Niveles Gratuitos de por Vida (Free Tier)** o con herramientas nativas abiertas. Ningún servicio requiere pagos recurrentes ni tarjeta de crédito obligatoria para comenzar.

---

## 📑 Índice Rápido de Servicios

1. [Upstash Redis — Rate Limiter Distribuido Serverless](#1-upstash-redis--rate-limiter-distribuido-serverless)
2. [Healthchecks.io — Sonda de Supervivencia del Samsung Galaxy J7](#2-healthchecksio--sonda-de-supervivencia-del-samsung-galaxy-j7)
3. [Telegram — Bot y Canales Públicos de Tracción Orgánica](#3-telegram--bot-y-canales-públicos-de-tracción-orgánica)
4. [Web Push VAPID — Alertas Instantáneas PWA ($0 WhatsApp)](#4-web-push-vapid--alertas-instantáneas-pwa-0-whatsapp)
5. [Cloudflare R2 — Object Storage S3 Sin Egress Fee (Opcional)](#5-cloudflare-r2--object-storage-s3-sin-egress-fee-opcional)
6. [Wompi Colombia — Pasarela y Webhooks de Integridad](#6-wompi-colombia--pasarela-y-webhooks-de-integridad)

---

## 1. Upstash Redis — Rate Limiter Distribuido Serverless

### ¿Para qué sirve?
Vercel ejecuta funciones Serverless en múltiples contenedores efímeros. Un rate limiter en memoria local (`new Map()`) no comparte estado entre instancias; un atacante puede saltárselo enviando peticiones paralelas. Upstash Redis ofrece una base de datos Redis administrada con **interfaz HTTP REST pura**, ideal para Serverless porque no mantiene conexiones TCP persistentes.

- **Costo:** $0 / Gratis (Hasta 10,000 comandos diarios de por vida).

### Pasos exactos:
1. Entra a [https://console.upstash.com](https://console.upstash.com) e inicia sesión con tu cuenta de GitHub o Google.
2. En el panel principal, haz clic en el botón **"Create Database"**.
3. Configura los campos:
   - **Name:** `origgo-ratelimit`
   - **Type:** Regional
   - **Region:** Selecciona `us-east-1` (Norte de Virginia) — *Esta es la misma región donde Vercel ejecuta sus funciones serverless por defecto, reduciendo la latencia a < 15ms*.
   - **TLS (SSL):** Activado (Enabled).
4. Haz clic en **"Create"**.
5. En la pantalla de detalles de tu base de datos recién creada, baja hasta la sección **"REST API"**.
6. Verás dos pestañas: selecciona la pestaña **".env"**.
7. Copia las dos credenciales que aparecen:
   ```env
   UPSTASH_REDIS_REST_URL="https://tu-base-aqui.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="AXXXAAIncDF...=="
   ```

### ¿Dónde pegarlas?
- **En Producción (Vercel):**
  1. Ve a tu panel de Vercel: `https://vercel.com/dashboard`.
  2. Selecciona el proyecto **hunter-portal-showcase** (o **Origgo**).
  3. Ve a **Settings** > **Environment Variables**.
  4. Agrega:
     - `UPSTASH_REDIS_REST_URL` = (el valor que copiaste).
     - `UPSTASH_REDIS_REST_TOKEN` = (el valor que copiaste).
  5. Marca los entornos: **Production**, **Preview**, **Development**.
  6. Guarda los cambios y haz un *Redeploy* para que tomen efecto.
- **En Desarrollo Local (PC):**
  - Pégalas dentro de `C:\Workspace\hunter-portal-showcase\.env`.

---

## 2. Healthchecks.io — Sonda de Supervivencia del Samsung Galaxy J7

### ¿Para qué sirve?
El scraper corre en el teléfono físico Samsung Galaxy J7. Si el teléfono se apaga (corte de luz, batería agotada, cargador desconectado o Termux cerrado por el sistema), tú necesitas enterarte de inmediato sin estar mirando la pantalla del celular. Healthchecks.io es un "perro guardián inverso": el teléfono le envía un "ping" HTTP cada 15 minutos; si deja de recibirlo tras 30 minutos, Healthchecks te envía un correo o mensaje de alarma.

- **Costo:** $0 / Gratis (Hasta 20 chequeos gratuitos de por vida).

### Pasos exactos:
1. Ve a [https://healthchecks.io](https://healthchecks.io) y haz clic en **"Sign In"** o **"Register"** con tu correo.
2. Haz clic en el botón **"Add Check"**.
3. Configura el chequeo:
   - **Name:** `Origgo J7 Scraper Heartbeat`
   - **Tags:** `origgo, termux, j7`
   - Haz clic en el botón de engranaje (⚙️ / Edit Schedule):
     - **Period:** `30 minutes` (Frecuencia normal).
     - **Grace Time:** `15 minutes` (Tolerancia antes de detonar alerta).
4. Guarda los cambios.
5. En la lista verás una URL con este formato:
   `https://hc-ping.com/12345678-abcd-1234-abcd-1234567890ab`
6. Copia esa URL completa.
7. Ve a la pestaña **"Integrations"** en Healthchecks.io para configurar dónde recibir la alarma (tu correo electrónico, tu Telegram personal o Discord).

### ¿Dónde pegarla?
- **En el teléfono Samsung Galaxy J7 (Termux):**
  1. Abre el archivo `.env` del scraper:
     `/data/data/com.termux/files/home/ofertas-hunter-pro/.env`
  2. Agrega la línea:
     ```env
     WATCHDOG_PING_URL=https://hc-ping.com/tu-uuid-aqui
     ```
  3. Guarda el archivo y reinicia el servicio en PM2:
     ```bash
     pm2 restart scraper
     ```

---

## 3. Telegram — Bot y Canales Públicos de Tracción Orgánica

### ¿Para qué sirve?
Telegram cumple dos funciones críticas:
1. **Canal Privado VIP / Monitoreo:** Avisar al administrador cuando hay fallos de hardware (batería a 41 °C, cargador desconectado).
2. **Canales Públicos por Ciudad (`@OriggoBogota`, `@OriggoMedellin`):** Publicar oportunidades *ofuscadas* (sin teléfono, sin link directo al dueño) con botón de llamada a la acción hacia la web de Origgo para atraer usuarios orgánicos sin gastar un solo peso en publicidad.

- **Costo:** $0 / Gratis.

### Pasos exactos:

#### A. Crear el Bot con BotFather:
1. En tu app de Telegram, busca el usuario oficial `@BotFather`.
2. Envíale el comando: `/newbot`.
3. Dale un nombre legible: `Origgo Radar Bot`.
4. Dale un usuario único terminado en `bot`: `origgo_radar_bot`.
5. BotFather te responderá con tu **Token HTTP API**:
   `7891234567:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   *(Guarda este token, es tu `TELEGRAM_BOT_TOKEN`).*

#### B. Obtener tu Chat ID Privado:
1. Busca el bot `@userinfobot` en Telegram y pulsa **Start**.
2. Te responderá con tu `Id` numérico (ej: `987654321`).
   *(Guarda este número, es tu `TELEGRAM_CHAT_PRIVADO`).*

#### C. Crear Canales Públicos Segmentados:
1. En Telegram, ve al menú y selecciona **Nuevo Canal**.
2. Dale un nombre, ej: `Origgo Oportunidades Directas — Bogotá`.
3. Tipo de canal: **Público**.
4. Enlace permanente: `OriggoBogota`.
5. Una vez creado el canal, ve a los ajustes del canal > **Administradores** > **Añadir Administrador**.
6. Busca a tu bot recién creado (`@origgo_radar_bot`) y agrégalo con permisos para **Publicar Mensajes**.

### ¿Dónde pegarlo?
- **En el `.env` del teléfono (`ofertas-hunter-pro`):**
  ```env
  TELEGRAM_BOT_TOKEN=7891234567:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  TELEGRAM_CHAT_PRIVADO=987654321
  TELEGRAM_CANAL_BOGOTA=@OriggoBogota
  TELEGRAM_CANAL_MEDELLIN=@OriggoMedellin
  ```

---

## 4. Web Push VAPID — Alertas Instantáneas PWA ($0 WhatsApp)

### ¿Para qué sirve?
La API de WhatsApp Business cobra por cada plantilla iniciada por la empresa (conversaciones de marketing). Web Push Notifications utiliza el estándar de los navegadores (Chrome en Android, Safari en iOS, Firefox, Edge) para enviar notificaciones push directamente a la pantalla de bloqueo del celular del usuario sin costo alguno.

- **Costo:** $0 / Gratis (Ilimitadas, directas del navegador).

### Pasos exactos para generar las llaves:
1. Abre tu terminal PowerShell en la computadora.
2. Ejecuta el generador nativo de llaves VAPID:
   ```powershell
   npx web-push generate-vapid-keys
   ```
3. El comando imprimirá en pantalla:
   ```text
   =======================================
   Public Key:
   BEl62iXXXXX...XXXXXXXXXXXXXXXXXXXXXXXXXXXX
   Private Key:
   XXXXX...XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   =======================================
   ```

### ¿Dónde pegarlas?
- **En Vercel (Environment Variables de `hunter-portal-showcase`):**
  - `VAPID_PUBLIC_KEY` = (La clave pública generada).
  - `VAPID_PRIVATE_KEY` = (La clave privada generada).
  - `VAPID_SUBJECT` = `mailto:contacto@origgo.co`
- **En el Frontend (`config.js`):**
  - `window.HUNTER_CONFIG.vapidPublicKey = "BEl62iXXXXX...";`

---

## 5. Cloudflare R2 — Object Storage S3 Sin Egress Fee (Opcional)

### ¿Para qué sirve?
Actualmente, el scraper publica el archivo `data/inmobiliario.json` haciendo un commit a GitHub vía API, y Vercel redespliega la web. Aunque funciona, 96 commits al día saturan el historial de Git. Cloudflare R2 es compatible con la API de Amazon S3, pero **no cobra un solo centavo por transferencia de datos saliente (Egress $0)**. El scraper sube el JSON a R2 y la web lo lee directamente.

- **Costo:** $0 / Gratis (10 GB de almacenamiento y 10 millones de operaciones de lectura mensuales gratuitas).
- **Fallback Automático:** Si no configuras R2, el sistema sigue funcionando mediante la API de GitHub como hasta hoy.

### Pasos exactos:
1. Entra a [https://dash.cloudflare.com](https://dash.cloudflare.com) e inicia sesión.
2. En el menú lateral izquierdo, haz clic en **R2**.
3. Haz clic en **"Create bucket"**.
   - Nombre: `origgo-catalogos`
   - Ubicación: Automática.
4. Haz clic en **"Create Bucket"**.
5. En la configuración del bucket, en **"Settings"**, baja a **"Public access"** y activa **"Allow Public Access"** para obtener una URL pública (ej: `https://pub-xxxx.r2.dev`).
6. En el menú de R2 a la derecha, haz clic en **"Manage R2 API Tokens"** > **"Create API Token"**.
   - Permisos: **Object Read & Write**.
   - Buckets: Selecciona `origgo-catalogos`.
7. Guarda los valores:
   - Account ID
   - Access Key ID
   - Secret Access Key

### ¿Dónde pegarlas?
- **En el `.env` del teléfono (`ofertas-hunter-pro`):**
  ```env
  R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxx
  R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxx
  R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  R2_BUCKET_NAME=origgo-catalogos
  R2_PUBLIC_URL=https://pub-xxxx.r2.dev
  ```

---

## 6. Wompi Colombia — Pasarela y Webhooks de Integridad

### ¿Para qué sirve?
Recibir pagos con Nequi, PSE, Tarjetas de Crédito y Bancolombia para la compra de créditos y membresías.

- **Costo:** Comisión por transacción exitosa fijada por Wompi (sin costos fijos mensuales).

### Pasos exactos:
1. Entra a [https://comercios.wompi.co](https://comercios.wompi.co).
2. Ve a **Desarrolladores** > **Seguridad**:
   - Copia la **Llave pública** (`pub_prod_...` o `pub_test_...`).
   - Copia la **Llave privada** (`prv_prod_...` o `prv_test_...`).
   - Copia el **Secreto de Integridad** (para verificar que las órdenes no sean alteradas en el navegador).
   - Copia el **Secreto de Eventos** (para verificar la firma criptográfica del Webhook).
3. En la sección **URLs de Eventos**, configura la URL de producción de Vercel:
   `https://origgo.co/api/payments/webhook-wompi`

### ¿Dónde pegarlas?
- **En Vercel Environment Variables:**
  - `WOMPI_ENV` = `produccion` (o `sandbox` para pruebas).
  - `WOMPI_PUBLIC_KEY` = `pub_...`
  - `WOMPI_PRIVATE_KEY` = `prv_...`
  - `WOMPI_INTEGRITY_SECRET` = `...`
  - `WOMPI_EVENTS_SECRET` = `...`
