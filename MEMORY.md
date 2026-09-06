# MEMORY.md — Origgo (Showcase y Ledger de Oportunidades Directas)

Última actualización: 2026-09-06 18:55 (GMT-5)

---

## 1. Qué cambió

1. Se terminó la limpieza visual solicitada tras la auditoría: las plantillas de `index.html` y los módulos frontend ya no generan atributos `style="..."`.
2. Se movieron estilos de skeletons, botones de contacto, drawer desbloqueado, paginación, resumen de checkout, recovery y menú lateral a clases CSS.
3. Se agregó `styles/16-utilities.css` como módulo final de utilidades visuales para ocultación inicial, iconos, recovery y compactación de bloques.
4. Se creó `registrarLogDesarrollo` en `modules/00-security.js` para que `console.log/warn/error/info/debug` solo se emita en `localhost`, `file:` o `?debug=origgo`.
5. Se reemplazaron los registros directos de consola en sesión, API, desbloqueo, checkout, listeners y bienvenida.
6. Se fortaleció el estado de error de carga de datos: el mensaje del error se escapa antes de entrar al DOM y usa clases CSS.
7. Se recompilaron los artefactos públicos `app.js`, `app.min.js`, `style.css`, `style.min.css` y el paquete `dist/`.
8. Se mantuvo `dist/` como salida generada del build, ignorada por Git, porque `vercel.json` lo usa como paquete público seguro; eliminarlo del build expondría de nuevo carpetas internas si Vercel sirviera la raíz.

---

## 2. Por qué cambió

- El usuario pidió ejecutar el plan de implementación de mejoras frontend derivado de la auditoría y probarlo antes de subirlo.
- La mezcla de estilos embebidos con JS/HTML complicaba mantenimiento visual, tema claro/oscuro y revisión de seguridad.
- Los mensajes visibles en consola podían revelar nombres internos de flujos de sesión, pagos y Wompi a usuarios finales.
- La propuesta de eliminar `dist/` fue revisada y descartada por seguridad, ya que este proyecto despliega deliberadamente desde `dist/`.

---

## 3. Archivos afectados

- `index.html`: estilos embebidos reemplazados por clases CSS en marca, checkout, recovery, perfil, legal y menú lateral.
- `modules/00-security.js`: helper de consola de desarrollo.
- `modules/01-state.js`: registros de sesión protegidos y coronas VIP sin estilo embebido.
- `modules/02-toast.js`: barra de progreso animada sin `style="animation-duration"`.
- `modules/03-api.js`: error de carga con HTML escapado y clases CSS.
- `modules/04-filters.js`: contador de ciudad con clase CSS.
- `modules/06-cards.js`: skeletons, estados, botones y paginación sin estilos embebidos.
- `modules/07-unlock.js`: drawer y botones post-desbloqueo con clases CSS.
- `modules/08-checkout.js`: resumen de inmueble del modal con clases CSS.
- `modules/10-listeners.js`: acordeón de recovery controlado por clases y registros protegidos.
- `modules/11-welcome.js`: registro de portapapeles protegido.
- `styles/02-base.css`: clases de animación secuencial para letras de marca.
- `styles/06-bento-grid.css`: clases de retraso visual para entrada y skeletons.
- `styles/08-slideup.css`: clases visuales de botones, estados, skeletons, resumen y paginación.
- `styles/14-toast.css`: barra lista para animación controlada desde JS.
- `styles/16-utilities.css`: nuevo módulo final de utilidades visuales.
- `app.js` y `app.min.js`: artefactos JavaScript regenerados.
- `style.css` y `style.min.css`: artefactos CSS regenerados.
- `dist/`: paquete público regenerado por `scripts/build.js` sin carpetas privadas.
- `README.md`: estructura de 16 módulos CSS y despliegue seguro desde `dist/`.
- `ARCHITECTURE.md`: conteos reales, consola de desarrollo y decisión sobre `dist/`.
- `docs/REPORTE_AUDITORIA_DEVSECOPS_REMEDIACIONES.md`: nuevo hallazgo de estilos embebidos y consola visible.

---

## 4. Decisiones técnicas tomadas

- Se priorizó remover estilos embebidos sin alterar backend, pagos, cifrado ni contratos de API.
- Se creó un logger cliente silencioso en producción en vez de eliminar diagnósticos útiles para desarrollo local.
- El toast usa animación nativa del navegador para conservar pausa/reanudación sin generar estilos inline.
- `styles/16-utilities.css` se agregó como módulo final para que `.is-hidden` prevalezca sobre reglas previas y pueda ser sobreescrito por estados inline existentes de la lógica actual cuando sea necesario.
- `dist/` no se eliminó del build porque es una barrera de exposición; está ignorado por Git y se genera como paquete público conectado a `vercel.json`.

---

## 5. Estado actual del sistema

- `npm run build`: aprobado tras agregar 16 módulos CSS.
- `npm run lint`: aprobado, 8 fases DevSecOps completas.
- `npm run typecheck --if-present`: aprobado; no hay script TypeScript definido.
- `npm audit --omit=dev`: aprobado con 0 vulnerabilidades.
- `npm test`: aprobado; recompila y valida las 8 fases DevSecOps.
- Pruebas puntuales de consola: producción simulada limpia y desarrollo local activo.
- Búsqueda QA: sin `style="..."` en `index.html`, `modules/`, `dist/index.html` ni `dist/app.js`.
- Búsqueda QA: sin `console.log/warn/error/info/debug` directo en frontend compilado ni modular.
- Estado de cierre: listo para commit y push; el backend, pagos, cifrado y contratos de API permanecen sin cambios funcionales.
