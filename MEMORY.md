# MEMORY.md — Origgo (Showcase y Ledger de Oportunidades Directas)

Última actualización: 2026-09-06 17:30 (GMT-5)

---

## 1. Qué cambió

1. Se integraron los retoques visuales de tarjetas provenientes de la copia local ubicada en `C:\Users\Sthan\Escritorio\origgo-—-terminal-de-oportunidades-directas-y-arbitraje`.
2. Se añadió deslizamiento táctil a los carruseles de tarjetas con umbral horizontal, cancelación ante desplazamiento vertical y protección contra inicialización duplicada.
3. Se elevó la jerarquía visual del botón `Ver Anuncio` en tarjetas desbloqueadas mediante la clase `btn-view-ad-direct`.
4. Se mantuvo la sanitización de enlaces cliente: el botón de anuncio solo se renderiza desde `contactoSeguro.enlace`, generado por `sanitizarContactoCliente(contacto)`.
5. Se agregó microinteracción de destello al botón `Desbloquear`, desactivada para oportunidades cerradas y para usuarios con `prefers-reduced-motion`.
6. Se recompilaron los artefactos públicos `app.js`, `app.min.js`, `style.css`, `style.min.css` y el paquete `dist/`.
7. Se sincronizó documentación en `README.md`, `ARCHITECTURE.md` y `docs/REPORTE_AUDITORIA_DEVSECOPS_REMEDIACIONES.md` para reflejar la arquitectura real tras las remediaciones DevSecOps.

---

## 2. Por qué cambió

- El usuario pidió continuar la aplicación de correcciones de auditoría y trasladar retoques visuales hechos por un compañero en una copia local del mismo repositorio.
- La copia local contenía mejoras útiles en tarjetas, pero no podía copiarse completa porque parte de su estado era anterior al endurecimiento de seguridad ya aplicado.
- Se eligió importar solo los cambios visuales compatibles y adaptarlos al flujo seguro actual para no reabrir exposición de enlaces, contactos ni lógica de desbloqueo.

---

## 3. Archivos afectados

- `modules/05-carousel.js`: nueva función `habilitarSwipeTactilCarrusel`.
- `modules/06-cards.js`: renderizado inicial del botón `Ver Anuncio` seguro y activación de deslizamiento por tarjeta.
- `modules/07-unlock.js`: actualización inmediata de tarjetas desbloqueadas con el mismo botón seguro y sin estilos embebidos duplicados.
- `modules/02-toast.js` y `modules/10-listeners.js`: comentarios técnicos normalizados a español.
- `styles/07-cards.css`: estilos táctiles de carrusel, microinteracción del botón de desbloqueo y nuevo botón `btn-view-ad-direct`.
- `styles/08-slideup.css` y `styles/15-welcome-modal.css`: comentarios CSS normalizados a español.
- `app.js` y `app.min.js`: artefactos JavaScript regenerados.
- `style.css` y `style.min.css`: artefactos CSS regenerados.
- `dist/`: paquete público regenerado por `scripts/build.js` sin carpetas privadas.
- `README.md`: estructura, módulos, salida `dist/`, recuperación por enlace temporal y conteos actualizados.
- `ARCHITECTURE.md`: rutas `lib/`, módulos actuales, lineamientos de tarjetas y enlaces seguros.
- `docs/REPORTE_AUDITORIA_DEVSECOPS_REMEDIACIONES.md`: seguimiento QA de tarjetas y enlaces desbloqueados.

---

## 4. Decisiones técnicas tomadas

- No se copió el repositorio local completo para evitar revertir endurecimientos ya validados en autenticación, pagos, CORS, secretos, build y exposición estática.
- El botón `Ver Anuncio` se ubicó antes de WhatsApp y llamada, siguiendo la intención visual de la copia local, pero sin usar `contacto.enlace` crudo.
- El gesto táctil se implementó con listeners pasivos y sin `preventDefault`, preservando el scroll vertical móvil.
- Los nuevos estilos se compactaron para respetar la regla interna de modularidad: ningún archivo en `modules/` ni `styles/` puede superar 500 líneas.
- La documentación se corrigió para eliminar rutas antiguas de librerías privadas y referencias al mecanismo anterior de recuperación.

---

## 5. Estado actual del sistema

- `npm run build`: aprobado.
- `npm run lint`: aprobado, 8 fases DevSecOps completas; `modules/07-unlock.js` quedó en 293 líneas.
- `npm run typecheck --if-present`: aprobado sin script TypeScript definido.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- `npm test`: aprobado, incluye build y validación completa.
- Estado de seguridad cliente: sin persistencia de PIN ni contactos desbloqueados en `localStorage`; enlaces de contacto renderizados desde sanitización central.
- Estado visual: tarjetas desbloqueadas muestran botón de anuncio con mayor jerarquía y carruseles con deslizamiento táctil.
