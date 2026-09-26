import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import {
  Dato,
  Etiqueta,
  EtiquetaEstado,
  fechaCorta,
  Hoja,
  pesos,
  type PeticionPanel,
} from './comunes';

/**
 * Sección Clientes: buscar por celular o correo, ver la ficha y ajustar créditos o plan.
 * Cada ajuste exige motivo y queda en la auditoría (lib/admin/clientes.js). Nunca muestra el PIN.
 */

interface Cliente {
  telefono: string;
  email: string | null;
  creditos: number;
  plan: 'free' | 'city' | 'national';
  planCiudad: string | null;
  planVence: string | null;
  desbloqueados: number;
  creado: string | null;
}

interface OrdenCliente {
  referencia: string;
  producto: string;
  montoCentavos: number;
  estado: string;
  creada: string | null;
}

const NOMBRE_PLAN = { free: 'Gratis', city: 'Ciudad', national: 'Nacional' };

function EtiquetaPlan({ c }: { c: Cliente }) {
  if (c.plan === 'free') return <Etiqueta tono="tenue">Gratis</Etiqueta>;
  const vencido = c.planVence && Date.parse(c.planVence) < Date.now();
  return (
    <Etiqueta tono={vencido ? 'rojo' : 'verde'}>
      {NOMBRE_PLAN[c.plan]}
      {c.planCiudad ? ` · ${c.planCiudad}` : ''}
      {vencido ? ' (vencido)' : ''}
    </Etiqueta>
  );
}

function FichaCliente({
  telefono,
  peticion,
  onError,
  onCambio,
}: {
  telefono: string;
  peticion: PeticionPanel;
  onError: (e: unknown) => void;
  onCambio: (c: Cliente) => void;
}) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [ordenes, setOrdenes] = useState<OrdenCliente[]>([]);
  const [delta, setDelta] = useState('');
  const [plan, setPlan] = useState<'free' | 'city' | 'national'>('city');
  const [ciudad, setCiudad] = useState('');
  const [dias, setDias] = useState('30');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    peticion(`/api/admin/cliente?tel=${encodeURIComponent(telefono)}`)
      .then((d) => {
        setCliente(d.cliente);
        setOrdenes(d.ordenes || []);
      })
      .catch(onError);
  }, [telefono, peticion, onError]);

  const ajustar = async (e: FormEvent, cuerpo: Record<string, unknown>, texto: string) => {
    e.preventDefault();
    if (motivo.trim().length < 3) {
      setAviso('Escribe el motivo del ajuste (queda en la auditoría).');
      return;
    }
    if (!window.confirm(texto)) return;
    setOcupado(true);
    try {
      const d = await peticion('/api/admin/cliente', {
        method: 'POST',
        body: JSON.stringify({ tel: telefono, motivo, ...cuerpo }),
      });
      setCliente(d.cliente);
      onCambio(d.cliente);
      setDelta('');
      setMotivo('');
      setAviso('Cambio guardado y registrado en la auditoría.');
    } catch (err) {
      onError(err);
    } finally {
      setOcupado(false);
    }
  };

  if (!cliente) return <div className="adm-esqueleto" />;
  const n = Math.trunc(Number(delta));

  return (
    <>
      <div className="adm-ficha">
        <Dato nombre="Celular">{cliente.telefono}</Dato>
        <Dato nombre="Correo">{cliente.email || '—'}</Dato>
        <Dato nombre="Créditos">{cliente.creditos}</Dato>
        <Dato nombre="Plan">
          <EtiquetaPlan c={cliente} />
        </Dato>
        <Dato nombre="Plan vence">{fechaCorta(cliente.planVence)}</Dato>
        <Dato nombre="Contactos desbloqueados">{cliente.desbloqueados}</Dato>
        <Dato nombre="Cliente desde">{fechaCorta(cliente.creado)}</Dato>
      </div>

      {aviso && <p className="adm-alerta">{aviso}</p>}

      <label className="adm-campo">
        <span>Motivo del ajuste (obligatorio)</span>
        <input
          className="adm-input"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej.: compensación por falla del 25 de septiembre"
          maxLength={300}
        />
      </label>

      <form
        className="adm-subformulario"
        onSubmit={(e) =>
          ajustar(
            e,
            { accion: 'creditos', delta: n },
            `¿${n > 0 ? 'Sumar' : 'Restar'} ${Math.abs(n)} crédito(s)?`,
          )
        }
      >
        <h3>Créditos</h3>
        <div className="adm-fila-form">
          <input
            className="adm-input"
            type="number"
            inputMode="numeric"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="+5 o -2"
            aria-label="Créditos a sumar o restar"
          />
          <button className="adm-btn adm-btn-primario" disabled={ocupado || !n}>
            Aplicar
          </button>
        </div>
      </form>

      <form
        className="adm-subformulario"
        onSubmit={(e) =>
          ajustar(
            e,
            { accion: 'plan', plan, ciudad, dias: Number(dias) },
            plan === 'free'
              ? '¿Quitar el plan y dejarlo en Gratis?'
              : `¿Activar plan ${NOMBRE_PLAN[plan]} por ${dias} días?`,
          )
        }
      >
        <h3>Plan</h3>
        <div className="adm-fila-form">
          <select
            className="adm-input"
            value={plan}
            onChange={(e) => setPlan(e.target.value as typeof plan)}
          >
            <option value="city">Ciudad</option>
            <option value="national">Nacional</option>
            <option value="free">Gratis (quitar plan)</option>
          </select>
          {plan === 'city' && (
            <input
              className="adm-input"
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              placeholder="Ciudad"
            />
          )}
          {plan !== 'free' && (
            <input
              className="adm-input adm-input-corto"
              type="number"
              inputMode="numeric"
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              aria-label="Días"
            />
          )}
          <button className="adm-btn adm-btn-primario" disabled={ocupado}>
            Guardar
          </button>
        </div>
      </form>

      <h3 className="adm-resumen-titulo">Órdenes</h3>
      {ordenes.length === 0 ? (
        <p className="adm-vacio">Sin órdenes registradas.</p>
      ) : (
        <ul className="adm-lista">
          {ordenes.map((o) => (
            <li key={o.referencia} className="adm-lista-item adm-lista-item-estatico">
              <span className="adm-lista-principal">
                <strong>{o.producto || o.referencia}</strong>
                <small>
                  {fechaCorta(o.creada)} · {pesos(o.montoCentavos)}
                </small>
              </span>
              <EtiquetaEstado estado={o.estado} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function PanelClientes({
  peticion,
  onError,
}: {
  peticion: PeticionPanel;
  onError: (e: unknown) => void;
}) {
  const [consulta, setConsulta] = useState('');
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  const buscar = useCallback(
    async (q = '') => {
      try {
        const d = await peticion(`/api/admin/clientes${q ? `?q=${encodeURIComponent(q)}` : ''}`);
        setClientes(d.clientes || []);
      } catch (e) {
        onError(e);
      }
    },
    [peticion, onError],
  );

  useEffect(() => {
    buscar();
  }, [buscar]);

  return (
    <section className="adm-seccion">
      <form
        className="adm-buscador"
        onSubmit={(e) => {
          e.preventDefault();
          buscar(consulta.trim());
        }}
      >
        <Search size={18} aria-hidden="true" />
        <input
          className="adm-input"
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Celular o correo del cliente"
          aria-label="Buscar cliente"
        />
        <button className="adm-btn adm-btn-primario">Buscar</button>
      </form>
      <p className="adm-nota">
        {consulta ? 'Resultado de la búsqueda' : 'Últimos 50 clientes registrados'}
      </p>

      {clientes === null ? (
        <div className="adm-esqueleto" />
      ) : clientes.length === 0 ? (
        <p className="adm-vacio">No se encontraron clientes.</p>
      ) : (
        <ul className="adm-lista">
          {clientes.map((c) => (
            <li key={c.telefono}>
              <button className="adm-lista-item" onClick={() => setAbierto(c.telefono)}>
                <span className="adm-lista-principal">
                  <strong>{c.telefono}</strong>
                  <small>{c.email || 'Sin correo'}</small>
                </span>
                <span className="adm-lista-lado">
                  <span className="adm-lista-cifra">{c.creditos} cr.</span>
                  <EtiquetaPlan c={c} />
                </span>
                <ChevronRight size={18} aria-hidden="true" className="adm-lista-flecha" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <Hoja titulo={`Cliente ${abierto}`} onCerrar={() => setAbierto(null)}>
          <FichaCliente
            telefono={abierto}
            peticion={peticion}
            onError={onError}
            onCambio={(c) =>
              setClientes((lista) => (lista || []).map((x) => (x.telefono === c.telefono ? c : x)))
            }
          />
        </Hoja>
      )}
    </section>
  );
}
