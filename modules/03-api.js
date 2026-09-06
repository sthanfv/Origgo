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
    registrarLogDesarrollo('error', 'Error cargando dataset:', err);
    if (container) {
      const detalleError = typeof escaparHtml === 'function'
        ? escaparHtml(err.message)
        : String(err.message || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      container.innerHTML = `
        <div class="error-state-msg">
          <p class="error-state-title">Error de conexión con la terminal de datos.</p>
          <p class="error-state-detail">${detalleError}</p>
        </div>
      `;
    }
  }
}

