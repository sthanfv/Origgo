// Vista previa del panel SOLO en desarrollo (npm run dev): /admin.html?vista=login|codigo|sin-acceso|panel
// Permite revisar el diseño de cada pantalla sin iniciar sesión, con datos de ejemplo.
// En el build de producción `import.meta.env.DEV` es false y este modo no existe.

export type VistaPrevia = 'login' | 'codigo' | 'sin-acceso' | 'panel';

export function vistaPrevia(): VistaPrevia | null {
  if (!import.meta.env.DEV) return null;
  const v = new URLSearchParams(window.location.search).get('vista');
  return v === 'login' || v === 'codigo' || v === 'sin-acceso' || v === 'panel' ? v : null;
}

const CIUDADES = ['Medellín', 'Bogotá', 'Cali', 'Envigado', 'Barranquilla', 'Bucaramanga'];
const TIPOS = ['Apartamento en Venta', 'Casa en Venta', 'Apartamento en Arriendo', 'Lote en Venta'];

export function leadsDeEjemplo() {
  return Array.from({ length: 47 }, (_, i) => ({
    id: `demo-${i + 1}`,
    titulo: `${TIPOS[i % TIPOS.length]} — ${CIUDADES[i % CIUDADES.length]}`,
    ciudad: CIUDADES[i % CIUDADES.length],
    precio: `$ ${((i % 9) + 2) * 97}.500.000`,
    portal: i % 2 ? 'Metrocuadrado' : 'Finca Raíz',
    activo: i % 7 !== 3,
    destacado: i % 11 === 0,
  }));
}

export function resumenDeEjemplo() {
  const ahora = Date.now();
  return {
    catalogo: { total: 1284, visibles: 1150, ocultos: 134, destacados: 12 },
    retiros: { pendientes: 2, porVencer: 1 },
    cazador: { ultima_ms: ahora - 38 * 60 * 1000, procesados: 4 },
    alertas: [
      {
        nivel: 'aviso' as const,
        seccion: 'retiros' as const,
        texto: '1 solicitud de retiro vence en 3 días o menos.',
      },
      {
        nivel: 'aviso' as const,
        seccion: 'retiros' as const,
        texto:
          'Falta reconstruir el índice de búsqueda (Retiros → "Reindexar búsqueda"), una sola vez.',
      },
    ],
  };
}

const CLIENTES_EJEMPLO = [
  {
    telefono: '3104445566',
    email: 'laura.gomez@example.com',
    creditos: 7,
    plan: 'city',
    planCiudad: 'Medellín',
    planVence: new Date(Date.now() + 12 * 864e5).toISOString(),
    desbloqueados: 14,
    creado: '2026-08-02T15:00:00Z',
  },
  {
    telefono: '3157778899',
    email: null,
    creditos: 0,
    plan: 'free',
    planCiudad: null,
    planVence: null,
    desbloqueados: 1,
    creado: '2026-09-10T20:00:00Z',
  },
  {
    telefono: '3001112233',
    email: 'inversiones.ruiz@example.com',
    creditos: 25,
    plan: 'national',
    planCiudad: null,
    planVence: new Date(Date.now() - 2 * 864e5).toISOString(),
    desbloqueados: 61,
    creado: '2026-07-18T13:00:00Z',
  },
];

const ORDENES_EJEMPLO = [
  {
    referencia: 'HNT-3104445566-VIPCIU_medellin-MUHQ1-A1',
    producto: 'Plan Ciudad (Medellín)',
    montoCentavos: 8900000,
    estado: 'APPROVED',
    telefono: '3104445566',
    email: 'laura.gomez@example.com',
    creada: new Date(Date.now() - 3 * 864e5).toISOString(),
    transaccion: 'trx-1',
  },
  {
    referencia: 'HNT-3157778899-1CR-MUHQ2-B2',
    producto: '1 crédito',
    montoCentavos: 500000,
    estado: 'PENDING',
    telefono: '3157778899',
    email: null,
    creada: new Date(Date.now() - 40 * 60e3).toISOString(),
    transaccion: null,
  },
  {
    referencia: 'HNT-3001112233-10CR-MUHQ3-C3',
    producto: '10 créditos',
    montoCentavos: 3500000,
    estado: 'FRAUD_SUSPECT',
    telefono: '3001112233',
    email: 'inversiones.ruiz@example.com',
    creada: new Date(Date.now() - 864e5).toISOString(),
    transaccion: 'trx-3',
  },
];

/** Respuestas de ejemplo de la API del panel para la vista previa (solo desarrollo). */
export async function respuestaDeEjemplo(ruta: string, opciones: RequestInit = {}) {
  await new Promise((r) => setTimeout(r, 250));
  const url = new URL(ruta, 'http://local');
  const post = (opciones.method || 'GET') === 'POST';
  switch (url.pathname) {
    case '/api/admin/clientes':
      return { ok: true, clientes: CLIENTES_EJEMPLO };
    case '/api/admin/cliente': {
      const tel = post ? JSON.parse(String(opciones.body)).tel : url.searchParams.get('tel');
      const cliente = CLIENTES_EJEMPLO.find((c) => c.telefono === tel) || CLIENTES_EJEMPLO[0];
      return {
        ok: true,
        cliente,
        ordenes: ORDENES_EJEMPLO.filter((o) => o.telefono === cliente.telefono),
      };
    }
    case '/api/admin/pagos': {
      const estado = url.searchParams.get('estado');
      return {
        ok: true,
        totales: { ventas30dCentavos: 8900000, aprobadas30d: 1, pendientes: 1, sospechas: 1 },
        ordenes: estado ? ORDENES_EJEMPLO.filter((o) => o.estado === estado) : ORDENES_EJEMPLO,
      };
    }
    case '/api/admin/pago': {
      const ref = post ? JSON.parse(String(opciones.body)).ref : url.searchParams.get('ref');
      const orden = ORDENES_EJEMPLO.find((o) => o.referencia === ref) || ORDENES_EJEMPLO[0];
      return {
        ok: true,
        resultado: post ? 'ya_entregado' : undefined,
        orden,
        entrega:
          orden.estado === 'APPROVED'
            ? { entregado: true, origen: 'webhook', fecha: orden.creada }
            : { entregado: false },
      };
    }
    case '/api/admin/retiros':
      return { ok: true, solicitudes: [] };
    case '/api/admin/cazador':
    case '/api/admin/auditoria':
    case '/api/admin/precios':
      return operacionDeEjemplo(url.pathname);
    default:
      return { ok: true, resultados: [] };
  }
}

/** Respuestas de ejemplo de Cazador, Auditoría y Precios (solo desarrollo). */
export function operacionDeEjemplo(ruta: string) {
  const ahora = Date.now();
  if (ruta.startsWith('/api/admin/cazador')) {
    return {
      ok: true,
      latido_ms: ahora - 2 * 60e3,
      ultima: { ultima_ms: ahora - 38 * 60e3, procesados: 4 },
      activos: 1150,
      publicaciones: [
        { id: 'a', ms: ahora - 38 * 60e3, procesados: 4, desactivados: 1 },
        { id: 'b', ms: ahora - 5 * 3600e3, procesados: 2 },
        { id: 'c', ms: ahora - 26 * 3600e3, procesados: 150, reconciliados: 12 },
      ],
    };
  }
  if (ruta.startsWith('/api/admin/auditoria')) {
    return {
      ok: true,
      entradas: [
        {
          id: '1',
          ts: ahora - 5 * 60e3,
          accion: 'ajuste_creditos',
          email: 'admin@ejemplo.com',
          detalle: { telefono: '3104445566', delta: 5, motivo: 'compensación' },
        },
        {
          id: '2',
          ts: ahora - 3600e3,
          accion: 'editar_precios',
          email: 'admin@ejemplo.com',
          detalle: { pack_10_leads: { antes: 3500000, despues: 4000000 } },
        },
        {
          id: '3',
          ts: ahora - 2 * 3600e3,
          accion: 'ingreso_2fa',
          email: 'admin@ejemplo.com',
          detalle: { metodo: 'correo' },
        },
      ],
    };
  }
  const base = {
    single_lead: {
      nombre: 'Desbloqueo de Contacto Individual',
      montoCentavos: 500000,
      creditos: 1,
      dias: 0,
      tipo: 'credito',
    },
    pack_10_leads: {
      nombre: 'Bolsa de 10 Contactos Directos (-30% Desc.)',
      montoCentavos: 3500000,
      creditos: 10,
      dias: 0,
      tipo: 'credito',
    },
    subscription_city: {
      nombre: 'Plan Pro Ciudad — Acceso Ilimitado 30 Días',
      montoCentavos: 8900000,
      creditos: 0,
      dias: 30,
      tipo: 'suscripcion_ciudad',
    },
    subscription_national: {
      nombre: 'Plan Nacional VIP — Radar Total y Rebajas',
      montoCentavos: 14900000,
      creditos: 0,
      dias: 30,
      tipo: 'suscripcion_nacional',
    },
  };
  return { ok: true, precios: base, base };
}
