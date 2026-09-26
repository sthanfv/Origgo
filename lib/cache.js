/**
 * 🧊 Caché de lecturas para proteger la cuota gratuita de Firestore (plan Spark).
 *
 * Por qué existe: la cuota gratis es de 50.000 lecturas al día. El catálogo público leía
 * ~150–300 documentos en CADA visita, y el cazador pedía la lista negra completa cada 3
 * minutos. El 2026-09-25 se agotó la cuota y el panel dejó de funcionar.
 *
 * Estándar aplicado: Firestore sigue siendo la fuente de la verdad, pero las lecturas
 * públicas se sirven desde una copia en caché que se renueva cada cierto tiempo:
 *   1. Memoria de la función (instancias calientes de Vercel): sin costo.
 *   2. Upstash Redis (compartida entre instancias): 1 comando por petición.
 *   3. Firestore: solo cuando la copia venció.
 * Si Firestore falla (p. ej. cuota agotada), se entrega la última copia buena ("respaldo",
 * válida 24 h) marcada como `obsoleto`, en vez de dejar el sitio sin datos.
 */
const PREFIJO = 'cache:v1:';
const RESPALDO_SEG = 24 * 60 * 60;
/** Tras un fallo de cuota, no se reintenta la fuente durante este tiempo (evita demoras inútiles). */
const PAUSA_TRAS_FALLO_MS = 2 * 60 * 1000;

const memoria = new Map(); // clave → { valor, expira }
const enCurso = new Map(); // clave → Promise (evita cargar lo mismo en paralelo)
const pausas = new Map(); // clave → instante (ms) hasta el que no se consulta la fuente

async function comandoRedis(comando, timeoutMs = 2000) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || typeof fetch === 'undefined') return null;
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(comando),
      signal: controlador.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}

async function leerRedis(clave) {
  const r = await comandoRedis(['GET', PREFIJO + clave]);
  if (!r || typeof r.result !== 'string') return undefined;
  try {
    return JSON.parse(r.result);
  } catch {
    return undefined;
  }
}

/** ¿El error es de cuota agotada o de base de datos no disponible? */
function esErrorDeCuota(err) {
  if (!err) return false;
  const texto = `${err.message || ''} ${err.details || ''}`;
  return err.code === 8 || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(texto);
}

/**
 * Devuelve el valor en caché o lo carga desde la fuente.
 * @template T
 * @param {string} clave Nombre de la caché (ej. 'catalogo-publico').
 * @param {number} ttlSeg Segundos de validez de la copia compartida (Upstash).
 * @param {() => Promise<T>} cargar Lectura real (Firestore). Solo se llama si la copia venció.
 * @param {{ memoriaSeg?: number }} [opciones] Validez de la copia en memoria de la función.
 * @returns {Promise<{ valor: T, origen: 'memoria'|'upstash'|'fuente'|'respaldo', obsoleto: boolean }>}
 */
async function obtenerConCache(clave, ttlSeg, cargar, opciones = {}) {
  const memoriaSeg = opciones.memoriaSeg ?? Math.min(ttlSeg, 300);
  const ahora = Date.now();
  const enMemoria = memoria.get(clave);
  if (enMemoria && enMemoria.expira > ahora) {
    return { valor: enMemoria.valor, origen: 'memoria', obsoleto: false };
  }

  const compartido = await leerRedis(clave);
  if (compartido !== undefined) {
    memoria.set(clave, { valor: compartido, expira: ahora + memoriaSeg * 1000 });
    return { valor: compartido, origen: 'upstash', obsoleto: false };
  }

  const enPausa = (pausas.get(clave) || 0) > ahora;
  if (!enPausa && !enCurso.has(clave)) {
    enCurso.set(
      clave,
      (async () => {
        try {
          const valor = await cargar();
          memoria.set(clave, { valor, expira: Date.now() + memoriaSeg * 1000 });
          const texto = JSON.stringify(valor);
          await Promise.all([
            comandoRedis(['SET', PREFIJO + clave, texto, 'EX', String(ttlSeg)]),
            comandoRedis(['SET', `${PREFIJO}respaldo:${clave}`, texto, 'EX', String(RESPALDO_SEG)]),
          ]);
          return { valor, origen: 'fuente', obsoleto: false };
        } finally {
          enCurso.delete(clave);
        }
      })(),
    );
  }

  try {
    if (enPausa) throw new Error('FUENTE_EN_PAUSA');
    return await enCurso.get(clave);
  } catch (err) {
    if (esErrorDeCuota(err) || (err && err.message === 'FIRESTORE_NO_DISPONIBLE')) {
      if (!enPausa) pausas.set(clave, Date.now() + PAUSA_TRAS_FALLO_MS);
    }
    // Fuente caída o sin cuota: servir la última copia buena si existe.
    if (enMemoria) return { valor: enMemoria.valor, origen: 'respaldo', obsoleto: true };
    const respaldo = await leerRedis(`respaldo:${clave}`);
    if (respaldo !== undefined) return { valor: respaldo, origen: 'respaldo', obsoleto: true };
    throw err;
  }
}

/** Borra la copia (memoria + Upstash) para que la próxima lectura traiga datos frescos. */
async function invalidarCache(clave) {
  memoria.delete(clave);
  pausas.delete(clave); // un cambio explícito permite reintentar la fuente de inmediato
  await comandoRedis(['DEL', PREFIJO + clave]);
}

/** Solo para pruebas. */
function limpiarCacheMemoria() {
  memoria.clear();
  enCurso.clear();
  pausas.clear();
}

module.exports = { obtenerConCache, invalidarCache, esErrorDeCuota, limpiarCacheMemoria };
