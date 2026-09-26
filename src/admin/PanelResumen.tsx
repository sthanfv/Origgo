import { AlertTriangle, Bot, Building2, Eye, EyeOff, Info, ShieldAlert, Star } from 'lucide-react';

/**
 * Pantalla de inicio del panel (patrón de paneles profesionales): primero las alertas que piden
 * una acción, luego las cifras reales y el estado del cazador. Cada tarjeta lleva a su sección.
 * Datos: GET /api/admin/resumen (lib/admin/resumen.js).
 */

export type Seccion =
  | 'resumen'
  | 'catalogo'
  | 'clientes'
  | 'pagos'
  | 'retiros'
  | 'vitrina'
  | 'cazador'
  | 'precios'
  | 'auditoria';

export interface DatosResumen {
  catalogo: { total: number; visibles: number; ocultos: number; destacados: number };
  retiros: { pendientes: number; porVencer: number };
  cazador: { ultima_ms: number; procesados: number } | null;
  alertas: { nivel: 'critica' | 'aviso' | 'info'; seccion: Seccion; texto: string }[];
}

function haceCuanto(ms: number) {
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

const ICONO_ALERTA = { critica: ShieldAlert, aviso: AlertTriangle, info: Info };

export function PanelResumen({
  datos,
  cargando,
  onIr,
  onFiltroCatalogo,
}: {
  datos: DatosResumen | null;
  cargando: boolean;
  onIr: (s: Seccion) => void;
  onFiltroCatalogo: (f: 'todos' | 'visibles' | 'ocultos' | 'destacados') => void;
}) {
  if (!datos) {
    return (
      <section className="adm-resumen" aria-busy={cargando}>
        <div className="adm-esqueleto adm-esqueleto-alto" />
        <div className="adm-resumen-cifras">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="adm-esqueleto" />
          ))}
        </div>
      </section>
    );
  }

  const cifras = [
    {
      etiqueta: 'Inmuebles',
      valor: datos.catalogo.total,
      Icono: Building2,
      filtro: 'todos' as const,
      tono: '',
    },
    {
      etiqueta: 'Visibles',
      valor: datos.catalogo.visibles,
      Icono: Eye,
      filtro: 'visibles' as const,
      tono: 'adm-verde',
    },
    {
      etiqueta: 'Ocultos',
      valor: datos.catalogo.ocultos,
      Icono: EyeOff,
      filtro: 'ocultos' as const,
      tono: 'adm-rojo',
    },
    {
      etiqueta: 'Destacados',
      valor: datos.catalogo.destacados,
      Icono: Star,
      filtro: 'destacados' as const,
      tono: 'adm-dorado',
    },
  ];

  return (
    <section className="adm-resumen">
      <div className="adm-resumen-bloque">
        <h2 className="adm-resumen-titulo">Pendientes</h2>
        {datos.alertas.length === 0 ? (
          <p className="adm-resumen-todo-bien">Todo en orden: no hay nada pendiente.</p>
        ) : (
          <ul className="adm-alertas">
            {datos.alertas.map((a, i) => {
              const Icono = ICONO_ALERTA[a.nivel];
              return (
                <li key={i}>
                  <button
                    className={`adm-alerta-item adm-alerta-${a.nivel}`}
                    onClick={() => onIr(a.seccion)}
                  >
                    <Icono size={18} aria-hidden="true" />
                    <span>{a.texto}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="adm-resumen-bloque">
        <h2 className="adm-resumen-titulo">Catálogo</h2>
        <div className="adm-resumen-cifras">
          {cifras.map(({ etiqueta, valor, Icono, filtro, tono }) => (
            <button key={etiqueta} className="adm-cifra" onClick={() => onFiltroCatalogo(filtro)}>
              <Icono size={18} aria-hidden="true" className="adm-cifra-icono" />
              <span className={`adm-cifra-valor ${tono}`}>{valor.toLocaleString('es-CO')}</span>
              <span className="adm-cifra-etiqueta">{etiqueta}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="adm-resumen-dos">
        <button className="adm-tarjeta-dato" onClick={() => onIr('retiros')}>
          <ShieldAlert size={20} aria-hidden="true" />
          <span className="adm-tarjeta-dato-titulo">Retiros (Habeas Data)</span>
          <strong>{datos.retiros.pendientes}</strong>
          <span className="adm-tarjeta-dato-nota">
            {datos.retiros.pendientes === 0
              ? 'Sin solicitudes pendientes'
              : `pendiente${datos.retiros.pendientes === 1 ? '' : 's'} · ${datos.retiros.porVencer} por vencer`}
          </span>
        </button>
        <div className="adm-tarjeta-dato">
          <Bot size={20} aria-hidden="true" />
          <span className="adm-tarjeta-dato-titulo">Cazador (teléfono)</span>
          <strong>{datos.cazador ? haceCuanto(datos.cazador.ultima_ms) : 'Sin datos'}</strong>
          <span className="adm-tarjeta-dato-nota">
            {datos.cazador
              ? `Última publicación · ${datos.cazador.procesados} inmueble${datos.cazador.procesados === 1 ? '' : 's'} guardado${datos.cazador.procesados === 1 ? '' : 's'}`
              : 'Aparecerá con la próxima publicación'}
          </span>
        </div>
      </div>
    </section>
  );
}
