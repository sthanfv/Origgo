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
