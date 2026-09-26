import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Activity, Radio } from 'lucide-react';
import { Dato, Etiqueta, fechaHora, pesos, type PeticionPanel } from './comunes';

/**
 * Secciones de operación del panel: Cazador (estado del teléfono), Auditoría (quién hizo qué y
 * cuándo) y Precios (editables; la web y los cobros los leen de la base de datos).
 * API: lib/admin/operacion.js.
 */

type Props = { peticion: PeticionPanel; onError: (e: unknown) => void };

function haceCuanto(ms: number | null | undefined) {
  if (!ms) return 'sin datos';
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
}

// ── Cazador ────────────────────────────────────────────────────────────────────────

interface Publicacion {
  id: string;
  ms: number;
  procesados: number;
  desactivados?: number;
  reconciliados?: number;
  invalidos?: number;
}

export function PanelCazador({ peticion, onError }: Props) {
  const [d, setD] = useState<{
    latido_ms: number | null;
    ultima: { ultima_ms: number; procesados: number } | null;
    publicaciones: Publicacion[];
    activos: number;
  } | null>(null);

  const cargar = useCallback(() => {
    peticion('/api/admin/cazador').then(setD).catch(onError);
  }, [peticion, onError]);
  useEffect(cargar, [cargar]);

  if (!d) return <div className="adm-esqueleto" />;
  const enLinea = d.latido_ms !== null && Date.now() - d.latido_ms < 15 * 60 * 1000;

  return (
    <section className="adm-seccion">
      <div className="adm-resumen-dos">
        <div className="adm-tarjeta-dato">
          <Radio size={20} aria-hidden="true" />
          <span className="adm-tarjeta-dato-titulo">Teléfono (Samsung J7)</span>
          <strong>
            <Etiqueta tono={enLinea ? 'verde' : d.latido_ms ? 'rojo' : 'tenue'}>
              {enLinea ? 'En línea' : d.latido_ms ? 'Sin contacto' : 'Sin datos aún'}
            </Etiqueta>
          </strong>
          <span className="adm-tarjeta-dato-nota">Último contacto {haceCuanto(d.latido_ms)}</span>
        </div>
        <div className="adm-tarjeta-dato">
          <Activity size={20} aria-hidden="true" />
          <span className="adm-tarjeta-dato-titulo">Última publicación de cambios</span>
          <strong>{haceCuanto(d.ultima?.ultima_ms)}</strong>
          <span className="adm-tarjeta-dato-nota">
            {d.activos.toLocaleString('es-CO')} inmuebles visibles en la web
          </span>
        </div>
      </div>
      <p className="adm-nota">
        El teléfono consulta la vitrina en cada ciclo (último contacto) y solo publica cuando hay
        inmuebles nuevos, cambiados o retirados. Si no hay contacto en más de 15 minutos, revisa que
        esté encendido y con internet.
      </p>

      <h2 className="adm-resumen-titulo">Publicaciones recientes</h2>
      {d.publicaciones.length === 0 ? (
        <p className="adm-vacio">Aún no hay publicaciones registradas.</p>
      ) : (
        <ul className="adm-lista">
          {d.publicaciones.map((p) => (
            <li key={p.id} className="adm-lista-item adm-lista-item-estatico">
              <span className="adm-lista-principal">
                <strong>{fechaHora(new Date(p.ms).toISOString())}</strong>
                <small>
                  {p.procesados} guardado{p.procesados === 1 ? '' : 's'}
                  {p.desactivados
                    ? ` · ${p.desactivados} retirado${p.desactivados === 1 ? '' : 's'}`
                    : ''}
                  {p.reconciliados
                    ? ` · ${p.reconciliados} alineado${p.reconciliados === 1 ? '' : 's'}`
                    : ''}
                  {p.invalidos ? ` · ${p.invalidos} descartado${p.invalidos === 1 ? '' : 's'}` : ''}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Auditoría ──────────────────────────────────────────────────────────────────────

const ACCIONES: Record<string, string> = {
  ingreso_2fa: 'Entró al panel',
  codigo_2fa_rechazado: 'Código rechazado',
  codigo_correo_enviado: 'Pidió código por correo',
  salida: 'Cerró sesión',
  editar_inmueble: 'Editó un inmueble',
  eliminar_inmueble: 'Eliminó un inmueble',
  editar_vitrina: 'Editó la vitrina',
  editar_precios: 'Cambió precios',
  retiro_aprobado: 'Aprobó un retiro',
  retiro_rechazado: 'Rechazó un retiro',
  reindexar_busqueda: 'Reconstruyó la búsqueda',
  ajuste_creditos: 'Ajustó créditos',
  cambio_plan: 'Cambió un plan',
  conciliar_pago: 'Concilió un pago',
};

interface Entrada {
  id: string;
  ts: number;
  accion: string;
  email?: string;
  detalle?: Record<string, unknown>;
}

function resumenDetalle(d?: Record<string, unknown>) {
  if (!d) return '';
  return Object.entries(d)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ')
    .slice(0, 220);
}

export function PanelAuditoria({ peticion, onError }: Props) {
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    peticion('/api/admin/auditoria')
      .then((d) => setEntradas(d.entradas || []))
      .catch(onError);
  }, [peticion, onError]);

  if (!entradas) return <div className="adm-esqueleto" />;
  const visibles = filtro ? entradas.filter((e) => e.accion === filtro) : entradas;
  const acciones = Array.from(new Set(entradas.map((e) => e.accion)));

  return (
    <section className="adm-seccion">
      <p className="adm-nota">
        Últimas 100 acciones del panel: quién, qué y cuándo. Nada se puede borrar desde aquí.
      </p>
      <div
        className="adm-segmentos adm-segmentos-desplazables"
        role="group"
        aria-label="Filtrar por acción"
      >
        <button
          className={!filtro ? 'adm-segmento activo' : 'adm-segmento'}
          onClick={() => setFiltro('')}
        >
          Todas
        </button>
        {acciones.map((a) => (
          <button
            key={a}
            className={filtro === a ? 'adm-segmento activo' : 'adm-segmento'}
            onClick={() => setFiltro(a)}
          >
            {ACCIONES[a] || a}
          </button>
        ))}
      </div>
      {visibles.length === 0 ? (
        <p className="adm-vacio">Sin acciones registradas.</p>
      ) : (
        <ul className="adm-lista">
          {visibles.map((e) => (
            <li key={e.id} className="adm-lista-item adm-lista-item-estatico">
              <span className="adm-lista-principal">
                <strong>{ACCIONES[e.accion] || e.accion}</strong>
                <small>
                  {fechaHora(new Date(e.ts).toISOString())} · {e.email || 'sistema'}
                </small>
                {e.detalle && (
                  <small className="adm-detalle-auditoria">{resumenDetalle(e.detalle)}</small>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Precios ────────────────────────────────────────────────────────────────────────

interface Producto {
  nombre: string;
  montoCentavos: number;
  creditos: number;
  dias: number;
  tipo: string;
}

const ORDEN_PRODUCTOS = [
  'single_lead',
  'pack_10_leads',
  'subscription_city',
  'subscription_national',
];

export function PanelPrecios({ peticion, onError }: Props) {
  const [precios, setPrecios] = useState<Record<string, Producto> | null>(null);
  const [edicion, setEdicion] = useState<
    Record<string, { nombre: string; pesos: string; creditos: string; dias: string }>
  >({});
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');

  const aplicar = (p: Record<string, Producto>) => {
    setPrecios(p);
    const e: typeof edicion = {};
    for (const id of ORDEN_PRODUCTOS) {
      e[id] = {
        nombre: p[id].nombre,
        pesos: String(Math.round(p[id].montoCentavos / 100)),
        creditos: String(p[id].creditos),
        dias: String(p[id].dias),
      };
    }
    setEdicion(e);
  };

  useEffect(() => {
    peticion('/api/admin/precios')
      .then((d) => aplicar(d.precios))
      .catch(onError);
  }, [peticion, onError]);

  const guardar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!precios) return;
    const cambios: Record<string, unknown> = {};
    const lineas: string[] = [];
    for (const id of ORDEN_PRODUCTOS) {
      const e = edicion[id];
      const p = precios[id];
      const monto = Math.round(Number(e.pesos) * 100);
      const cambio =
        monto !== p.montoCentavos ||
        e.nombre.trim() !== p.nombre ||
        (p.tipo === 'credito' ? Number(e.creditos) !== p.creditos : Number(e.dias) !== p.dias);
      if (!cambio) continue;
      cambios[id] =
        p.tipo === 'credito'
          ? { nombre: e.nombre, montoCentavos: monto, creditos: Number(e.creditos) }
          : { nombre: e.nombre, montoCentavos: monto, dias: Number(e.dias) };
      lineas.push(`• ${e.nombre}: ${pesos(p.montoCentavos)} → ${pesos(monto)}`);
    }
    if (lineas.length === 0) {
      setAviso('No hay cambios para guardar.');
      return;
    }
    if (
      !window.confirm(
        `¿Guardar estos precios?\n\n${lineas.join('\n')}\n\nLos pagos ya iniciados conservan su precio.`,
      )
    )
      return;
    setOcupado(true);
    setAviso('');
    try {
      const d = await peticion('/api/admin/precios', {
        method: 'PUT',
        body: JSON.stringify(cambios),
      });
      aplicar(d.precios);
      setAviso('Precios guardados. La web los mostrará en unos minutos.');
    } catch (e) {
      onError(e);
    } finally {
      setOcupado(false);
    }
  };

  if (!precios) return <div className="adm-esqueleto" />;

  return (
    <form className="adm-seccion" onSubmit={guardar}>
      <p className="adm-nota">
        Estos precios los usan la web y los cobros de Wompi. Un cambio no afecta los pagos que ya se
        iniciaron.
      </p>
      {aviso && <p className="adm-alerta">{aviso}</p>}
      {ORDEN_PRODUCTOS.map((id) => {
        const p = precios[id];
        const e = edicion[id];
        if (!e) return null;
        const actualizar = (campo: keyof typeof e, valor: string) =>
          setEdicion((x) => ({ ...x, [id]: { ...x[id], [campo]: valor } }));
        return (
          <fieldset key={id} className="adm-precio">
            <legend>{p.tipo === 'credito' ? 'Créditos' : 'Plan'}</legend>
            <label className="adm-campo">
              <span>Nombre</span>
              <input
                className="adm-input"
                value={e.nombre}
                maxLength={80}
                onChange={(ev) => actualizar('nombre', ev.target.value)}
              />
            </label>
            <div className="adm-fila-form">
              <label className="adm-campo">
                <span>Precio (pesos)</span>
                <input
                  className="adm-input"
                  type="number"
                  inputMode="numeric"
                  min={1000}
                  max={1000000}
                  step={100}
                  value={e.pesos}
                  onChange={(ev) => actualizar('pesos', ev.target.value)}
                />
              </label>
              {p.tipo === 'credito' ? (
                <label className="adm-campo">
                  <span>Créditos</span>
                  <input
                    className="adm-input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1000}
                    value={e.creditos}
                    onChange={(ev) => actualizar('creditos', ev.target.value)}
                  />
                </label>
              ) : (
                <label className="adm-campo">
                  <span>Días</span>
                  <input
                    className="adm-input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={366}
                    value={e.dias}
                    onChange={(ev) => actualizar('dias', ev.target.value)}
                  />
                </label>
              )}
            </div>
            <Dato nombre="Así se verá">{pesos(Math.round(Number(e.pesos) * 100) || 0)}</Dato>
          </fieldset>
        );
      })}
      <button className="adm-btn adm-btn-primario adm-btn-ancho" disabled={ocupado}>
        {ocupado ? 'Guardando…' : 'Guardar precios'}
      </button>
    </form>
  );
}
