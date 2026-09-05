/**
 * 🌐 MÓDULO DE RED Y CLIENTE API (modules/03-api.js)
 * Comunicación HTTP centralizada, inyección de x-trace-id y carga de datasets.
 * Estándar Ecosistema Desmulta DevSecOps.
 */

function generarTraceId() {
  return 'hnt_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
}

/**
 * Carga un archivo JSON y realiza el mapeo dinámico de llaves en la interfaz.
 * @param {string} rutaJson
 */
async function cargarDatos(rutaJson) {
  const container = document.getElementById("bentoGridContainer");
  if (container) {
    container.innerHTML = generarHtmlSkeletons();
  }

  try {
    const res = await fetch(rutaJson);
    if (!res.ok) throw new Error(`HTTP ${res.status}: No se pudo cargar el dataset.`);
    const json = await res.json();
    datosActuales = json;
    limiteVisible = 6;
    renderizarInterfaz(json);
    aplicarFiltrosOmnibox();
  } catch (err) {
    console.error("Error cargando dataset:", err);
    if (container) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: #F43F5E;">
          <p style="font-weight: 800; font-size: 1.1rem;">Error de conexión con la terminal de datos.</p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">${err.message}</p>
        </div>
      `;
    }
  }
}
