/**
 * 🌐 MÓDULO DE RED Y CLIENTE API (modules/03-api.js)
 * Comunicación HTTP centralizada, inyección de x-trace-id, cola de reintentos
 * exponencial y fail-safe resiliente para la terminal de oportunidades.
 * Estándar Ecosistema Desmulta DevSecOps.
 */

function generarTraceId() {
  return 'hnt_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
}

/**
 * Realiza peticiones fetch con cola de reintentos, backoff exponencial y jitter aleatorio.
 * @param {string} url
 * @param {RequestInit} [opciones]
 * @param {object} [config]
 * @param {number} [config.maxReintentos]
 * @param {number} [config.delayBaseMs]
 * @param {number} [config.factorBackoff]
 * @param {number} [config.jitterMs]
 * @param {number} [config.timeoutMs]
 * @returns {Promise<any>}
 */
async function fetchConReintentos(url, opciones = {}, {
  maxReintentos = 2,
  delayBaseMs = 800,
  factorBackoff = 2,
  jitterMs = 300,
  timeoutMs = 4500
} = {}) {
  let ultimoError = null;

  for (let intento = 0; intento <= maxReintentos; intento++) {
    const controlador = new AbortController();
    const timerId = setTimeout(() => controlador.abort(), timeoutMs);

    try {
      const traceId = generarTraceId();
      const headers = new Headers(opciones.headers || {});
      if (!headers.has('x-trace-id')) headers.set('x-trace-id', traceId);

      const res = await fetch(url, {
        ...opciones,
        headers,
        signal: controlador.signal
      });

      clearTimeout(timerId);

      // Si el servidor responde 4xx (salvo 429), no reintentar pues la petición es errónea
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(`HTTP ${res.status}: Petición no recuperable`);
        }
        throw new Error(`HTTP ${res.status}: Error de servidor`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timerId);
      ultimoError = err;

      // Si se agotaron los intentos, salir del bucle
      if (intento === maxReintentos) break;

      // Calcular backoff exponencial con jitter para no saturar la red
      const espera = (delayBaseMs * Math.pow(factorBackoff, intento)) + Math.floor(Math.random() * jitterMs);
      registrarLogDesarrollo('warn', `[fetchConReintentos] Reintento ${intento + 1}/${maxReintentos} en ${espera}ms para ${url}:`, err.message);
      await new Promise(resolve => setTimeout(resolve, espera));
    }
  }

  // Notificar al Perro Guardián ante agotamiento de cola de reintentos
  if (typeof reportarFalloCliente === 'function') {
    reportarFalloCliente({
      tipo: 'FETCH_REINTENTOS_AGOTADOS',
      mensaje: `Fallo persistente tras ${maxReintentos + 1} intentos: ${ultimoError?.message || 'Error desconocido'}`,
      origen: url
    });
  }

  throw ultimoError;
}

/**
 * Valida que los datos recibidos cumplan con el contrato estructural mínimo de Origgo.
 * @param {any} datos
 * @returns {boolean}
 */
function validarContratoCatalogo(datos) {
  if (!datos || typeof datos !== 'object') return false;
  if (!Array.isArray(datos.leads) || datos.leads.length === 0) return false;
  const primerLead = datos.leads[0];
  return Boolean(primerLead && primerLead.id && primerLead.contacto_cifrado);
}

/**
 * Carga un archivo JSON y realiza el mapeo dinámico de llaves en la interfaz.
 * Soporta carga primaria en tiempo real desde Cloudflare R2 con fail-safe local inmediato y reintentos.
 * @param {string} rutaJson
 */
async function cargarDatos(rutaJson) {
  const container = document.getElementById("bentoGridContainer");
  if (container) {
    container.innerHTML = generarHtmlSkeletons();
  }

  let json = null;
  const urlR2 = typeof window !== 'undefined' && window.PORTAL_CONFIG && window.PORTAL_CONFIG.catalogoR2Url;

  // 1. Intentar cargar desde Cloudflare R2 con reintento rápido (catálogo en vivo)
  if (urlR2 && rutaJson.includes('inmobiliario.json')) {
    try {
      const r2Data = await fetchConReintentos(urlR2, { cache: 'no-cache' }, {
        maxReintentos: 1,
        delayBaseMs: 500,
        timeoutMs: 3500
      });
      if (validarContratoCatalogo(r2Data)) {
        json = r2Data;
        registrarLogDesarrollo('info', 'Catálogo cargado en tiempo real desde Cloudflare R2');
      }
    } catch (errR2) {
      registrarLogDesarrollo('warn', 'Fallback activado: R2 no disponible, cargando local', errR2.message);
    }
  }

  // 2. Si R2 falla o no valida, cargar desde ruta local empaquetada (Fail-Safe con 2 reintentos)
  if (!json) {
    try {
      const localData = await fetchConReintentos(rutaJson, {}, {
        maxReintentos: 2,
        delayBaseMs: 800,
        timeoutMs: 4000
      });
      if (validarContratoCatalogo(localData)) {
        json = localData;
      } else {
        throw new Error('El catálogo de oportunidades no tiene una estructura válida.');
      }
    } catch (err) {
      registrarLogDesarrollo('error', 'Error crítico cargando dataset local:', err);
      if (typeof reportarFalloCliente === 'function') {
        reportarFalloCliente({
          tipo: 'CARGA_CATALOGO_FALLIDA',
          mensaje: err.message,
          origen: 'modules/03-api.js:cargarDatos'
        });
      }

      if (container) {
        const detalleError = typeof escaparHtml === 'function'
          ? escaparHtml(err.message)
          : String(err.message || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        container.innerHTML = `
          <div class="error-state-msg">
            <p class="error-state-title">Error de conexión con la terminal de oportunidades.</p>
            <p class="error-state-detail">${detalleError}</p>
            <button type="button" class="btn-retry-catalog" onclick="cargarDatos('${escaparHtml(rutaJson)}')">
              <i class="fa-solid fa-rotate-right"></i> Reintentar Conexión
            </button>
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
