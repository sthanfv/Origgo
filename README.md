# 🏛️ Hunter Pro Intelligence — Portal Showcase ($0 Cost)
## Fachada Web de Alta Gama con Renderizador Agnóstico y Pasarela Wompi

Este repositorio contiene la interfaz pública desacoplada e independiente diseñada para mostrar oportunidades directas y arbitraje a clientes finales (agentes inmobiliarios top e inversionistas).

---

## 🎯 Principios de Diseño y Arquitectura

1. **Aislamiento Total del Backend:** Este proyecto es 100% independiente del scraper (`ofertas-hunter-pro`). Consume únicamente archivos estáticos `.json` exportados, garantizando que el servidor del celular Samsung Galaxy J7 permanezca invisible y protegido de ataques DDoS o tráfico masivo.
2. **Estética Shadcn UI / Bento Grid:** Fondo claro `#F8FAFC`, bordes ultra finos `#E2E8F0` y tipografías pesadas para precios, transmitiendo solidez de software institucional o financiero.
3. **El Gancho Acquire.com (Efecto Blur):** Los datos clave (m², barrio, precio, descuento) son visibles, pero el teléfono y el enlace directo están ofuscados mediante filtro CSS.
4. **Checkout Wompi Integrado:** Modal que invoca el widget oficial de Wompi Bancolombia en modo Sandbox/Producción para suscripciones recurrentes ($89.000 COP/mes).
5. **Renderizador Agnóstico (Dynamic Key Mapping):** Lee dinámicamente las etiquetas `columna_variable_1` y `columna_variable_2` de cualquier JSON (`inmobiliario.json`, `vehiculos.json`) sin tocar una sola línea de código en el frontend.

---

## 📂 Estructura de Archivos

```
hunter-portal-showcase/
├── index.html        # Maquetación principal con Bento Grid y Modal Wompi
├── style.css         # Estilos corporativos Shadcn UI y clases de desenfoque
├── app.js            # Renderizador universal agnóstico e integración Wompi
├── config.js         # Llaves públicas Wompi y configuración de contacto
├── package.json      # Configuración de paquete para despliegues Vercel
├── README.md         # Documentación de instalación y uso
└── data/
    ├── inmobiliario.json  # Feed de oportunidades de bienes raíces (FSBO)
    └── vehiculos.json     # Feed de oportunidades automotrices (Flipping)
```

---

## 🚀 Despliegue Inmediato a $0 Costo

* **En Vercel:** Conectar este directorio a un nuevo proyecto en Vercel (framework preset: "Other"). Despliega en 10 segundos con HTTPS automático.
* **En GitHub Pages:** Subir a una rama `gh-pages` o activar GitHub Pages desde la raíz.
* **Prueba Local:**
  ```bash
  npx serve -l 5000 .
  ```
  O abrir directamente `index.html` en el navegador.
