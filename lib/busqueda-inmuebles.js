/**
 * 🔎 Buscador de inmuebles para retiros (Habeas Data) y el panel de administración.
 *
 * Entiende lo que escribiría una persona o el administrador:
 *   - una referencia de Origgo ("lead-inm-3001", "3001") o un enlace de Origgo;
 *   - el enlace del anuncio original (Finca Raíz, Metrocuadrado…);
 *   - el celular que aparece en el anuncio (se busca por su huella, nunca en claro);
 *   - texto libre ("apartamento laureles medellín").
 * Usa los campos de lib/indice-busqueda.js: cada búsqueda cuesta pocas lecturas.
 */
const db = require('./db');
const {
  tokenizar,
  huellaEnlace,
  huellaTelefono,
  telefonoNormalizado,
} = require('./indice-busqueda');

/**
 * Extrae un identificador de inmueble (referencia o número de anuncio) de un texto o enlace.
 * @param {string} input
 * @returns {string|null} Identificador saneado o null si es texto sin identificador.
 */
function extraerIdentificadorInmueble(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  if (str.length === 0) return null;

  // 1. Parámetro en URL o fragmento (lead=, id=, leadId=)
  if (str.includes('lead=') || str.includes('leadId=') || str.includes('id=')) {
    const m = str.match(/(?:lead|id|leadId)=([^&#\s]+)/i);
    if (m && m[1]) return decodeURIComponent(m[1]).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  }

  // 2. URL completa (Finca Raíz, Metrocuadrado, Origgo)
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const urlObj = new URL(str);
      const pLead = urlObj.searchParams.get('lead') || urlObj.searchParams.get('id');
      if (pLead) return pLead.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);

      const pathMatch = urlObj.pathname.match(/([a-zA-Z]{0,4}\d{5,12}|lead-inm-[a-zA-Z0-9_-]+)/i);
      if (pathMatch) return pathMatch[1].slice(0, 80);

      const cleanPath = urlObj.pathname
        .replace(/^\/+|\/+$/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(-60);
      if (cleanPath.length >= 4) return cleanPath;
    } catch (_) {}
  }

  // 3. Referencia directa de Origgo o de portales (lead-inm-XXX, fr_XXX, HNT-XXX, MCXXXX)
  const idDirectoMatch = str.match(/(?:lead-inm-[a-zA-Z0-9_-]+|fr_\d+|hnt-[a-zA-Z0-9_-]+|mc\d{5,10})/i);
  if (idDirectoMatch) return idDirectoMatch[0].slice(0, 80);

  // 4. Número de anuncio de 5 a 12 dígitos
  const numMatch = str.match(/\b(\d{5,12})\b/);
  if (numMatch) return numMatch[1];

  // 5. Identificador simple de 3 a 50 caracteres sin espacios
  if (!str.includes(' ') && /^[a-zA-Z0-9_-]{3,50}$/.test(str)) return str;

  // Texto libre sin identificador reconocible ("Hola, por favor bajen mi casa…")
  return null;
}

/** Datos públicos de un inmueble para mostrar en el panel (jamás el contacto). */
function resumen(id, datos, coincidencia) {
  return {
    id,
    titulo: datos.titulo || '',
    ciudad: datos.ciudad || '',
    barrio: datos.barrio || '',
    tipo_inmueble: datos.tipo_inmueble || '',
    precio: datos.precio || '',
    portal: datos.portal || '',
    imagen: datos.imagen || '',
    activo: datos.activo !== false,
    timestamp_ms: datos.timestamp_ms || null,
    coincidencia,
  };
}

function refInmuebles() {
  const ref = db.leadsRef;
  if (!ref) throw Object.assign(new Error('FIRESTORE_NO_DISPONIBLE'), { status: 503 });
  return ref;
}

async function porId(id) {
  const doc = await refInmuebles().doc(String(id)).get();
  return doc.exists ? resumen(String(id), doc.data(), 'referencia') : null;
}

async function porCampo(campo, valor, coincidencia, limite = 20) {
  const snap = await refInmuebles().where(campo, '==', valor).limit(limite).get();
  return snap.docs.map((d) => resumen(d.id, d.data(), coincidencia));
}

/**
 * Coincidencias EXACTAS (referencia, enlace original o celular). Son las que justifican
 * retirar un anuncio de inmediato como medida preventiva.
 * @param {{ ids?: string[], enlace?: string, telefono?: string }} datos
 * @returns {Promise<Object[]>} Resúmenes sin repetir.
 */
async function buscarExactas({ ids = [], enlace = '', telefono = '' } = {}) {
  const encontrados = new Map();
  for (const id of ids.filter(Boolean)) {
    const candidatos = /^\d+$/.test(id) ? [id, `lead-inm-${id}`] : [id];
    for (const c of candidatos) {
      const r = await porId(c);
      if (r) encontrados.set(r.id, r);
    }
  }
  const hEnlace = enlace ? huellaEnlace(enlace) : '';
  if (hEnlace) for (const r of await porCampo('enlace_huella', hEnlace, 'enlace')) encontrados.set(r.id, r);
  const hTelefono = telefono ? huellaTelefono(telefono) : '';
  if (hTelefono) for (const r of await porCampo('telefono_huella', hTelefono, 'telefono')) encontrados.set(r.id, r);
  return Array.from(encontrados.values());
}

/**
 * Búsqueda por texto: consulta la palabra más específica (la más larga) con `array-contains`
 * y ordena por cuántas de las palabras buscadas coinciden.
 */
async function buscarTexto(texto, limite = 30) {
  const tokens = tokenizar(texto);
  if (tokens.length === 0) return [];
  const ancla = [...tokens].sort((a, b) => b.length - a.length)[0];
  const snap = await refInmuebles().where('indice_busqueda', 'array-contains', ancla).limit(200).get();
  const puntuados = snap.docs.map((d) => {
    const datos = d.data();
    const indice = new Set(datos.indice_busqueda || []);
    const aciertos = tokens.filter((t) => indice.has(t)).length;
    return { r: resumen(d.id, datos, aciertos === tokens.length ? 'texto' : 'parcial'), aciertos };
  });
  puntuados.sort((a, b) => b.aciertos - a.aciertos);
  return puntuados.slice(0, limite).map((p) => p.r);
}

/**
 * Busca inmuebles a partir de lo que escriba el administrador o el solicitante.
 * @param {string} consulta
 * @returns {Promise<{ tipo: 'enlace'|'telefono'|'referencia'|'texto'|'vacia', resultados: Object[] }>}
 */
async function buscarInmuebles(consulta, { limite = 30 } = {}) {
  const q = String(consulta || '').trim().slice(0, 300);
  if (!q) return { tipo: 'vacia', resultados: [] };

  if (/^https?:\/\//i.test(q)) {
    const id = extraerIdentificadorInmueble(q);
    const resultados = await buscarExactas({ ids: id ? [id] : [], enlace: q });
    return { tipo: 'enlace', resultados };
  }
  if (telefonoNormalizado(q) && /^[\d\s()+-]+$/.test(q)) {
    return { tipo: 'telefono', resultados: await buscarExactas({ telefono: q }) };
  }
  if (/^(lead-inm-[\w-]+|\d{3,12})$/i.test(q)) {
    const exactas = await buscarExactas({ ids: [q] });
    if (exactas.length) return { tipo: 'referencia', resultados: exactas };
  }
  return { tipo: 'texto', resultados: await buscarTexto(q, limite) };
}

module.exports = {
  extraerIdentificadorInmueble,
  buscarExactas,
  buscarTexto,
  buscarInmuebles,
  resumen,
};
