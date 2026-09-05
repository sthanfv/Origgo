# 🧠 MEMORY.md — Origgo (Showcase & Ledger de Oportunidades Directas)

Última actualización: 2026-09-05 09:15 (GMT-5)

---

## 1. ¿Qué cambió?

1. **Migración Integral a la Marca Comercial "Origgo"**:
   - Diagnóstico: La denominación anterior ("Hunter Pro") proyectaba una imagen técnica agresiva asociada a scraping o bots, inapropiada para clientes finales, inversionistas y constructoras.
   - Solución de Identidad:
     - Adopción de la marca **Origgo** (del latín *origo*, raíz y fuente directa).
     - Composición tipográfica display sensible: Inicial "O" destacada en mayúscula (`.brand-initial-o`) con animación reveal, y terminación "riggo" en minúsculas (`.brand-letters-riggo`) con gradiente esmeralda (`#34D399` a `#10B981`) y `text-transform: none`.
     - Actualización en cabecera principal, menú lateral off-canvas, pie de página institucional, modal de bienvenida, notificaciones toast y cláusulas legales.

2. **Metadatos, SEO, PWA y Configuración de Plataforma**:
   - `index.html`: Actualizados `<title>`, `<meta description>`, OpenGraph, Twitter Cards y enlaces canónicos hacia `https://origgo.vercel.app/`.
   - `config.js`: `nombrePlataforma: "Origgo"`, `tagline: "Terminal de Oportunidades Directas y Arbitraje"` y mensajes de WhatsApp.
   - `manifest.json`: PWA nombrada como `Origgo — Oportunidades Directas y Arbitraje`.
   - `sw.js`: Caché PWA actualizado a `origgo-v1`.

3. **Suavizado Institucional del Isotipo (Logo)**:
   - Diagnóstico: Las rotaciones de 360° continuas del radar tipo sónar militar generaban ruido visual innecesario.
   - Solución: Se reemplazó la rotación acelerada por una micro-respiración áurea reposada y elegante (`animOriggoAura` a 5s) preservando la geometría circular de la "O" y la precisión del núcleo óptico.

4. **Sincronización Git y Remoto**:
   - Repositorio remoto reconectado a `https://github.com/sthanfv/Origgo.git`.

5. **Modularidad Desmulta y Suite DevSecOps**:
   - Todos los 11 módulos JS y 15 módulos CSS permanecen estrictamente `< 500 líneas` (`02-base.css` en 285 líneas).
   - Suite de 8 fases `npm test` aprobada al 100% con 0 errores.

---

## 2. ¿Por qué cambió?

- **Estrategia Comercial de Alta Gama**: Origgo posiciona la plataforma como una terminal respetada de arbitraje y trato directo entre particulares, ocultando la ingeniería de extracción interna.
- **Armonía Tipográfica Solicitada**: La combinación de O mayúscula y cuerpo en minúsculas proyecta calidez, modernidad y máxima legibilidad corporativa.

---

## 3. Archivos Afectados

- `styles/02-base.css`: Reglas `.brand-title`, `.brand-initial-o`, `.brand-letters-riggo` y animaciones áureas de isotipo (285 líneas).
- `index.html`: Metadatos SEO, OpenGraph, cabecera, footer y side-menu adaptados a Origgo.
- `config.js`: Nombre institucional y mensajes de soporte.
- `manifest.json`: Nombre PWA y descripción.
- `sw.js`: Caché `origgo-v1`.
- `modules/02-toast.js`: Título por defecto de notificaciones.
- `modules/08-checkout.js`: Mensaje de WhatsApp comercial.
- `modules/10-listeners.js`: Textos legales y exoneración bajo el nombre Origgo.
- `modules/11-welcome.js`: CTA de exploración de oportunidades directas.
- `style.css` y `style.min.css`: Recompilados (91.7 KB minificado, -29%).
- `app.js` y `app.min.js`: Recompilados (109.7 KB minificado, -14%).
- `MEMORY.md`: Bitácora actualizada.

---

## 4. Decisiones Técnicas Tomadas

- **Preservación del Ledger y Criptografía**: No se alteraron llaves AES-256-GCM ni tokens de sesión existentes para garantizar cero pérdida de datos durante la transición de marca.
- **Continuidad de Selectores Críticos**: Se mantuvieron intactas las referencias a `.brand-iso-svg` y `.brand-logo-container` garantizando compatibilidad con la suite de auditoría DevSecOps.

---

## 5. Estado Actual del Sistema

- **Validación Automatizada (`npm test`)**: 8/8 Fases Aprobadas al 100% (0 errores).
- **Límite de Líneas**: Ningún archivo supera las 500 líneas en `modules/` ni en `styles/`.
- **Identidad de Marca**: Origgo desplegado con elegancia tipográfica y animaciones reposadas.
- **Seguridad**: AES-256-GCM, firma HMAC-SHA256 y hashing SHA-256 preservados intactos.
