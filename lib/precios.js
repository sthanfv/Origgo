/**
 * 💲 Precios y planes de Origgo: editables desde el panel (Firestore `config/precios`).
 *
 * Antes estaban escritos en 5 archivos del servidor y 2 de la web; cambiar un precio exigía
 * programar y publicar. Ahora la base de datos es la fuente de la verdad y estos valores base
 * solo se usan si el documento no existe o Firestore falla (el sitio nunca se queda sin precios).
 *
 * Seguridad de cobro: cada orden guarda su monto al crearse (api/payments/create-order.js), así
 * que cambiar un precio no afecta los pagos ya iniciados; el webhook exige que se pague al menos
 * ese monto.
 */
const db = require('./db');
const { obtenerConCache, invalidarCache } = require('./cache');

const CACHE_PRECIOS = 'precios';

/** Valores base (los que regían al pasar los precios a la base de datos, 2026-09-26). */
const PRECIOS_BASE = Object.freeze({
  single_lead: {
    nombre: 'Desbloqueo de Contacto Individual',
    nombreEn: 'Single Direct Contact Unlock',
    montoCentavos: 500000,
    creditos: 1,
    dias: 0,
    tipo: 'credito',
    codigo: '1CR',
  },
  pack_10_leads: {
    nombre: 'Bolsa de 10 Contactos Directos (-30% Desc.)',
    nombreEn: '10 Direct Contacts Pack (-30% Off)',
    montoCentavos: 3500000,
    creditos: 10,
    dias: 0,
    tipo: 'credito',
    codigo: '10CR',
  },
  subscription_city: {
    nombre: 'Plan Pro Ciudad — Acceso Ilimitado 30 Días',
    nombreEn: 'Pro City Pass — 30 Days Unlimited Access',
    montoCentavos: 8900000,
    creditos: 0,
    dias: 30,
    tipo: 'suscripcion_ciudad',
    codigo: 'VIPCIU',
  },
  subscription_national: {
    nombre: 'Plan Nacional VIP — Radar Total y Rebajas',
    nombreEn: 'National VIP Pass — All-Colombia Radar & Price Drops',
    montoCentavos: 14900000,
    creditos: 0,
    dias: 30,
    tipo: 'suscripcion_nacional',
    codigo: 'VIPNAC',
  },
});

const PRODUCTOS = Object.keys(PRECIOS_BASE);
const LIMITES = {
  montoCentavos: [100000, 100000000], // $1.000 a $1.000.000
  creditos: [0, 1000],
  dias: [1, 366],
};

/** Mezcla lo guardado sobre la base (campos editables solamente). */
function combinar(guardado) {
  const precios = {};
  for (const id of PRODUCTOS) {
    const base = PRECIOS_BASE[id];
    const g = (guardado && guardado[id]) || {};
    precios[id] = {
      ...base,
      nombre: typeof g.nombre === 'string' && g.nombre.trim() ? g.nombre.trim() : base.nombre,
      montoCentavos: Number.isInteger(g.montoCentavos) ? g.montoCentavos : base.montoCentavos,
      creditos: base.tipo === 'credito' && Number.isInteger(g.creditos) ? g.creditos : base.creditos,
      dias: base.tipo !== 'credito' && Number.isInteger(g.dias) ? g.dias : base.dias,
    };
  }
  return precios;
}

async function cargarDesdeFirestore() {
  const doc = await db.coleccion('config').doc('precios').get();
  return combinar(doc.exists ? doc.data() : null);
}

/**
 * Precios vigentes (caché de 1 h compartida; se borra al guardar desde el panel).
 * @returns {Promise<Record<string, Object>>}
 */
async function obtenerPrecios() {
  try {
    const { valor } = await obtenerConCache(CACHE_PRECIOS, 60 * 60, cargarDesdeFirestore);
    return valor;
  } catch (err) {
    console.warn('[precios] Se usan los precios base:', err.message);
    return combinar(null);
  }
}

/**
 * Valida los cambios del panel. Devuelve el objeto a guardar o lanza un error con status 400.
 */
function validarCambios(entrada) {
  const limpio = {};
  for (const id of PRODUCTOS) {
    const e = entrada && entrada[id];
    if (!e) continue;
    const base = PRECIOS_BASE[id];
    const item = {};
    const monto = Math.round(Number(e.montoCentavos));
    if (!Number.isInteger(monto) || monto < LIMITES.montoCentavos[0] || monto > LIMITES.montoCentavos[1]) {
      throw Object.assign(new Error(`Precio no válido para "${base.nombre}" (entre $1.000 y $1.000.000).`), { status: 400 });
    }
    item.montoCentavos = monto;
    if (base.tipo === 'credito') {
      const c = Math.trunc(Number(e.creditos));
      if (!Number.isInteger(c) || c < 1 || c > LIMITES.creditos[1]) {
        throw Object.assign(new Error(`Créditos no válidos para "${base.nombre}" (1 a 1000).`), { status: 400 });
      }
      item.creditos = c;
    } else {
      const d = Math.trunc(Number(e.dias));
      if (!Number.isInteger(d) || d < LIMITES.dias[0] || d > LIMITES.dias[1]) {
        throw Object.assign(new Error(`Días no válidos para "${base.nombre}" (1 a 366).`), { status: 400 });
      }
      item.dias = d;
    }
    if (typeof e.nombre === 'string' && e.nombre.trim()) item.nombre = e.nombre.replace(/[<>]/g, '').trim().slice(0, 80);
    limpio[id] = item;
  }
  if (Object.keys(limpio).length === 0) throw Object.assign(new Error('No hay cambios de precios.'), { status: 400 });
  return limpio;
}

async function guardarPrecios(cambios, email) {
  const limpio = validarCambios(cambios);
  await db
    .coleccion('config')
    .doc('precios')
    .set({ ...limpio, actualizado_ms: Date.now(), actualizado_por: email }, { merge: true });
  await invalidarCache(CACHE_PRECIOS);
  return limpio;
}

/** Producto a partir del código de la referencia HNT-[celular]-[código]-… (pagos sin orden guardada). */
function productoPorCodigo(precios, codigo) {
  const c = String(codigo || '');
  if (c === '10CR') return precios.pack_10_leads;
  if (c.startsWith('VIPCIU')) return precios.subscription_city;
  if (c === 'VIPNAC') return precios.subscription_national;
  return precios.single_lead;
}

/** Beneficio que entrega un producto (créditos o plan) en el formato de db.acreditarPagoUnaVez. */
function beneficio(producto, ciudad) {
  if (producto.tipo === 'suscripcion_ciudad') return { creditos: 0, planData: { plan: 'city', city: ciudad || 'Colombia', days: producto.dias } };
  if (producto.tipo === 'suscripcion_nacional') return { creditos: 0, planData: { plan: 'national', days: producto.dias } };
  return { creditos: producto.creditos, planData: null };
}

/** Versión pública (sin campos internos) para la web. */
function preciosPublicos(precios) {
  const r = {};
  for (const id of PRODUCTOS) {
    const p = precios[id];
    r[id] = { nombre: p.nombre, nombreEn: p.nombreEn, montoCentavos: p.montoCentavos, creditos: p.creditos, dias: p.dias };
  }
  return r;
}

module.exports = {
  PRECIOS_BASE,
  PRODUCTOS,
  CACHE_PRECIOS,
  obtenerPrecios,
  validarCambios,
  guardarPrecios,
  productoPorCodigo,
  beneficio,
  preciosPublicos,
  combinar,
};
