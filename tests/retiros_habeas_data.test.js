/**
 * 🧪 RETIRO DE ANUNCIOS (HABEAS DATA) E ÍNDICE DE BÚSQUEDA
 * tests/retiros_habeas_data.test.js
 *
 * Valida:
 * 1. Índice: palabras sin tildes, huella de enlace estable y huella ciega del celular.
 * 2. Solicitud con identificación exacta (referencia o celular) → radicado, plazo de 15 días
 *    hábiles y retiro preventivo inmediato.
 * 3. Solicitud solo con datos aproximados → no se oculta nada; quedan candidatos para revisión.
 * 4. Sin datos de quien pide → rechazo.
 * 5. Rechazar una solicitud en el panel revierte el retiro preventivo.
 * 6. Reindexar llena el índice de inmuebles guardados antes de que existiera.
 *
 * Corre en modo memoria (sin credenciales de Firestore): no toca producción.
 */
process.env.NODE_ENV = 'test';
process.env.FIRESTORE_DESACTIVADO = '1';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../lib/db');
const { resetRateLimiter } = require('../lib/rate-limiter');
const { encryptLeadContact, obtenerKeyRingLeads } = require('../lib/crypto');
const indice = require('../lib/indice-busqueda');
const { buscarInmuebles } = require('../lib/busqueda-inmuebles');
const retiros = require('../lib/retiros');
const { reindexarTanda } = require('../lib/admin/retiros');
const takedownHandler = require('../lib/support/takedown');

function crearRes() {
  return {
    statusCode: 200,
    data: null,
    setHeader() {},
    status(c) { this.statusCode = c; return this; },
    json(d) { this.data = d; return this; },
    end() { return this; },
  };
}

const SOLICITANTE = { nombre: 'Ana Pérez', correo: 'ana@example.com', relacion: 'propietario', acepta: true };
const sufijo = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** Guarda un inmueble como lo deja la ingesta (con índice). */
async function sembrarInmueble({ id, ciudad = 'Medellín', barrio = 'Laureles', telefono = '3104445566', enlace } = {}) {
  const { keys, activeKid } = obtenerKeyRingLeads();
  const contacto = { telefono, enlace: enlace || `https://www.fincaraiz.com.co/inmueble/${id}` };
  const lead = {
    id,
    titulo: `Apartamento en Venta — ${ciudad}`,
    ciudad,
    barrio,
    tipo_inmueble: 'Apartamento',
    tipo_operacion: 'Venta',
    portal: 'Finca Raíz',
    precio: '$ 450.000.000',
    activo: true,
    contacto_cifrado: encryptLeadContact(contacto, keys[activeKid], activeKid),
  };
  await db.leadsRef.doc(id).set({ ...lead, ...indice.camposIndice(lead, contacto) });
  return lead;
}

async function pedirRetiro(body) {
  const res = crearRes();
  await takedownHandler({ method: 'POST', headers: { 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` }, body }, res);
  return res;
}

describe('🛡️ Retiro de anuncios (Habeas Data) e índice de búsqueda', () => {
  beforeEach(() => resetRateLimiter());

  it('1. el índice normaliza palabras, enlaces y celulares', () => {
    const tokens = indice.tokensInmueble({ id: 'lead-inm-3001', ciudad: 'Medellín', barrio: 'El Poblado', titulo: 'Casa en Venta' });
    for (const t of ['medellin', 'poblado', 'casa', 'venta', 'lead-inm-3001', '3001']) assert.ok(tokens.includes(t), t);
    assert.ok(!tokens.includes('el') && !tokens.includes('en'), 'sin palabras vacías');
    assert.equal(
      indice.huellaEnlace('https://www.fincaraiz.com.co/inmueble/123/?utm=x'),
      indice.huellaEnlace('http://fincaraiz.com.co/inmueble/123')
    );
    assert.equal(indice.huellaTelefono('+57 310 444 5566'), indice.huellaTelefono('3104445566'));
    assert.ok(!indice.huellaTelefono('3104445566').includes('3104445566'), 'la huella no contiene el número');
  });

  it('2. referencia exacta → radicado, plazo legal y retiro preventivo', async () => {
    const id = `lead-inm-${sufijo()}`;
    await sembrarInmueble({ id });
    const res = await pedirRetiro({ ...SOLICITANTE, referencia: `https://origgo.online/?lead=${id}`, motivo: 'ya_vendido' });

    assert.equal(res.statusCode, 200);
    assert.match(res.data.radicado, /^HD-\d{8}-[A-Z2-9]{4}$/);
    assert.equal(res.data.estado, 'retirado_preventivamente');
    assert.equal((await db.leadsRef.doc(id).get()).data().activo, false);
    assert.equal(await db.isLeadBlacklisted(id), true);

    const solicitud = await retiros.obtenerSolicitud(res.data.radicado);
    assert.deepEqual(solicitud.coincidencias, [id]);
    assert.equal(solicitud.solicitante.correo, 'ana@example.com');
  });

  it('3. el celular del anuncio encuentra el inmueble sin guardar el número', async () => {
    const id = `lead-inm-${sufijo()}`;
    await sembrarInmueble({ id, telefono: '3157778899' });
    const res = await pedirRetiro({ ...SOLICITANTE, telefono: '315 777 8899' });

    assert.equal(res.data.estado, 'retirado_preventivamente');
    const solicitud = await retiros.obtenerSolicitud(res.data.radicado);
    assert.ok(solicitud.coincidencias.includes(id));
    assert.equal(solicitud.identificacion.telefono_final, '99');
    assert.ok(!JSON.stringify(solicitud).includes('3157778899'), 'el celular no se guarda en claro');
  });

  it('4. solo ciudad y barrio → nada se oculta; quedan candidatos para el panel', async () => {
    const barrio = `Barrio${sufijo()}`;
    const id = `lead-inm-${sufijo()}`;
    await sembrarInmueble({ id, ciudad: 'Envigado', barrio });
    const res = await pedirRetiro({ ...SOLICITANTE, ciudad: 'Envigado', barrio, motivo: 'no_autorice' });

    assert.equal(res.data.estado, 'en_revision');
    assert.equal(res.data.retirados, 0);
    assert.equal((await db.leadsRef.doc(id).get()).data().activo, true);
    const solicitud = await retiros.obtenerSolicitud(res.data.radicado);
    assert.ok(solicitud.candidatos.includes(id));
  });

  it('5. sin nombre, correo o aceptación → rechazo', async () => {
    const res = await pedirRetiro({ referencia: 'lead-inm-1', correo: 'no-es-correo', acepta: true, nombre: 'Ana' });
    assert.equal(res.statusCode, 400);
    assert.equal(res.data.error, 'DATOS_SOLICITANTE_REQUERIDOS');
  });

  it('6. el plazo es de 15 días hábiles (sin sábados ni domingos)', () => {
    const viernes = Date.UTC(2026, 8, 25, 15); // viernes 25 de septiembre de 2026
    assert.equal(new Date(retiros.sumarDiasHabiles(viernes)).toISOString().slice(0, 10), '2026-10-16');
  });

  it('7. rechazar en el panel revierte el retiro preventivo', async () => {
    const id = `lead-inm-${sufijo()}`;
    await sembrarInmueble({ id });
    const res = await pedirRetiro({ ...SOLICITANTE, referencia: id });
    const solicitud = await retiros.obtenerSolicitud(res.data.radicado);
    await retiros.restaurarInmuebles(solicitud.retiro_preventivo);
    assert.equal((await db.leadsRef.doc(id).get()).data().activo, true);
    assert.equal(await db.isLeadBlacklisted(id), false);
  });

  it('8. reindexar llena el índice de inmuebles viejos y el buscador los encuentra', async () => {
    const id = `lead-inm-${sufijo()}`;
    const barrio = `Viejo${sufijo()}`;
    const { keys, activeKid } = obtenerKeyRingLeads();
    await db.leadsRef.doc(id).set({
      id,
      titulo: 'Casa en Arriendo — Cali',
      ciudad: 'Cali',
      barrio,
      activo: true,
      contacto_cifrado: encryptLeadContact({ telefono: '3001112233', enlace: 'https://metrocuadrado.com/x/99' }, keys[activeKid], activeKid),
    });
    assert.equal((await buscarInmuebles(barrio)).resultados.length, 0, 'sin índice no aparece');

    const r = await reindexarTanda(null);
    assert.ok(r.actualizados >= 1);
    assert.equal(r.siguiente, null);
    assert.deepEqual((await buscarInmuebles(`cali ${barrio}`)).resultados.map((x) => x.id), [id]);
    assert.deepEqual((await buscarInmuebles('300 111 2233')).resultados.map((x) => x.id), [id]);
    assert.deepEqual((await buscarInmuebles('https://www.metrocuadrado.com/x/99/')).resultados.map((x) => x.id), [id]);
  });
});
