/**
 * 🌐 MÓDULO DE RED Y CLIENTE API (modules/03-api.js)
 * Comunicación HTTP centralizada, inyección de x-trace-id y carga de datasets.
 * Estándar Ecosistema Desmulta DevSecOps.
 */

function generarTraceId() {
  return 'hnt_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
}

/**
 * Intenta descargar un JSON con timeout controlado.
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<any>}
 */
async function fetchConTimeout(url, timeoutMs = 4000) {
  const controlador = new AbortController();
  const idTimer = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controlador.signal, cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(idTimer);
  }
}

/**
 * Carga un archivo JSON y realiza el mapeo dinámico de llaves en la interfaz.
 * Soporta carga primaria en tiempo real desde Cloudflare R2 con fail-safe local inmediato.
 * @param {string} rutaJson
 */
async function cargarDatos(rutaJson) {
  const container = document.getElementById("bentoGridContainer");
  if (container) {
    container.innerHTML = generarHtmlSkeletons();
  }

  let json = null;
  const urlR2 = typeof window !== 'undefined' && window.PORTAL_CONFIG && window.PORTAL_CONFIG.catalogoR2Url;

  // 1. Intentar cargar desde Cloudflare R2 (catálogo más reciente en tiempo real)
  if (urlR2 && rutaJson.includes('inmobiliario.json')) {
    try {
      json = await fetchConTimeout(urlR2, 4000);
      registrarLogDesarrollo('info', 'Catálogo cargado en tiempo real desde Cloudflare R2');
    } catch (errR2) {
      registrarLogDesarrollo('warn', 'Fallback activado: R2 no disponible, cargando local', errR2.message);
    }
  }

  // 2. Si R2 no está disponible o falla, cargar desde ruta local (Fail-Safe)
  if (!json) {
    try {
      const res = await fetch(rutaJson);
      if (!res.ok) throw new Error(`HTTP ${res.status}: No se pudo cargar el dataset.`);
      json = await res.json();
    } catch (err) {
      registrarLogDesarrollo('error', 'Error cargando dataset local:', err);
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
      return;
    }
  }

  datosActuales = json;
  limiteVisible = 6;
  renderizarInterfaz(json);
  aplicarFiltrosOmnibox();
}
