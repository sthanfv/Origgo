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
 * Consulta el catálogo mediante el endpoint serverless paginado (/api/leads/list).
 * Soporta filtros en backend, ordenamiento, particionamiento en lotes de 15 items
 * y fallback automático a contingencia local offline.
 * @param {object} [opciones]
 * @param {number} [opciones.page=1]
 * @param {number} [opciones.limit=15]
 * @param {string} [opciones.city='']
 * @param {string} [opciones.operation='']
 * @param {string} [opciones.search='']
 * @param {string} [opciones.sort='recientes']
 * @param {boolean} [opciones.reset=false]
 * @param {boolean} [opciones.append=false]
 */
async function consultarCatalogoPaginado({
  page = 1,
  limit = 15,
  city = (typeof filtroCiudadActivo !== 'undefined' ? filtroCiudadActivo : ''),
  operation = (typeof filtroOperacionActivo !== 'undefined' ? filtroOperacionActivo : ''),
  search = (typeof textoBusquedaActivo !== 'undefined' ? textoBusquedaActivo : ''),
  sort = (typeof criterioOrdenActivo !== 'undefined' ? criterioOrdenActivo : 'recientes'),
  reset = false,
  append = false
} = {}) {
  const container = document.getElementById("bentoGridContainer");
  if (container && (page === 1 || reset) && !append) {
    container.innerHTML = typeof generarHtmlSkeletons === 'function' ? generarHtmlSkeletons(6) : '';
  }

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort: String(sort || 'recientes')
  });
  if (city) queryParams.set('city', city);
  if (operation) queryParams.set('operation', operation);
  if (search) queryParams.set('search', search);

  const url = `/api/leads/list?${queryParams.toString()}`;

  try {
    const data = await fetchConReintentos(url, { cache: 'no-cache' }, {
      maxReintentos: 2,
      delayBaseMs: 500,
      timeoutMs: 3500
    });

    if (!data || !data.ok || !Array.isArray(data.leads)) {
      throw new Error(data?.error || 'Respuesta inválida del catálogo serverless.');
    }

    if (data.ciudades && typeof sincronizarDropdownCiudades === 'function') {
      sincronizarDropdownCiudades(data.ciudades);
    }

    if (append && datosActuales && Array.isArray(datosActuales.leads)) {
      datosActuales.leads.push(...data.leads);
      datosActuales.page = data.page;
      datosActuales.hayMas = data.hayMas;
      datosActuales.totalPages = data.totalPages;
      datosActuales.total = data.total;
    } else {
      datosActuales = {
        config: data.config || (datosActuales?.config || {}),
        leads: data.leads,
        total: data.total,
        totalPages: data.totalPages,
        page: data.page,
        hayMas: data.hayMas,
        ciudades: data.ciudades
      };
    }

    paginaActual = data.page;
    limiteVisible = limit;

    if (typeof renderizarInterfaz === 'function') {
      renderizarInterfaz(datosActuales);
    }
    return data;
  } catch (err) {
    registrarLogDesarrollo('warn', '[consultarCatalogoPaginado] Fallback a contingencia local offline:', err.message);
    return await cargarDatosLocalFallback('./data/inmobiliario.json');
  }
}

/**
 * Fallback resiliente offline que carga el dataset estático local ante fallos de conexión.
 * @param {string} rutaJson
 */
async function cargarDatosLocalFallback(rutaJson) {
  const container = document.getElementById("bentoGridContainer");
  try {
    const localData = await fetchConReintentos(rutaJson, {}, {
      maxReintentos: 1,
      delayBaseMs: 600,
      timeoutMs: 3500
    });
    if (validarContratoCatalogo(localData)) {
      if (Array.isArray(localData.leads) && typeof deduplicarLeads === 'function') {
        localData.leads = deduplicarLeads(localData.leads);
      }
      datosActuales = localData;
      limiteVisible = 15;
      paginaActual = 1;
      if (typeof renderizarInterfaz === 'function') renderizarInterfaz(localData);
      return localData;
    }
    throw new Error('Estructura de catálogo local inválida');
  } catch (fallbackErr) {
    registrarLogDesarrollo('error', '[cargarDatosLocalFallback] Falló la carga local de emergencia:', fallbackErr);
    if (container) {
      const errTxt = typeof escaparHtml === 'function' ? escaparHtml(fallbackErr.message) : String(fallbackErr.message || '');
      container.innerHTML = `
        <div class="error-state-msg">
          <p class="error-state-title">Terminal de oportunidades fuera de línea.</p>
          <p class="error-state-detail">${errTxt}</p>
          <button type="button" class="btn-retry-catalog" onclick="consultarCatalogoPaginado({ page: 1, reset: true })">
            <i class="fa-solid fa-rotate-right"></i> Reintentar Conexión
          </button>
        </div>
      `;
    }
  }
}

/**
 * Carga un archivo JSON y realiza el mapeo dinámico de llaves en la interfaz.
 * Soporta carga primaria serverless con fallback local inmediato ante fallos de red.
 * @param {string} rutaJson
 */
async function cargarDatos(rutaJson) {
  if (typeof rutaJson === 'string' && rutaJson.includes('inmobiliario.json')) {
    return await consultarCatalogoPaginado({ page: 1, reset: true });
  }
  return await cargarDatosLocalFallback(rutaJson);
}

if (typeof window !== 'undefined') {
  window.consultarCatalogoPaginado = consultarCatalogoPaginado;
  window.cargarDatos = cargarDatos;
}
