import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, RefreshCw, Search } from 'lucide-react';
import {
  Dato,
  Etiqueta,
  EtiquetaEstado,
  fechaHora,
  Hoja,
  pesos,
  type PeticionPanel,
} from './comunes';

/**
 * Sección Pagos: órdenes de Wompi con totales, filtro por estado, búsqueda por referencia y
 * ficha con "¿se entregó?" y "Conciliar con Wompi" (consulta la pasarela real y acredita una
 * sola vez; lib/admin/pagos.js).
 */

interface Orden {
  referencia: string;
  producto: string;
  montoCentavos: number;
  estado: string;
  telefono: string | null;
  email: string | null;
  creada: string | null;
  transaccion: string | null;
}

interface Totales {
  ventas30dCentavos: number;
  aprobadas30d: number;
  pendientes: number;
  sospechas: number;
}

interface Entrega {
  entregado: boolean;
  origen?: string | null;
  fecha?: string | null;
  creditos?: number;
  plan?: string | null;
}

const FILTROS: { id: string; texto: string }[] = [
  { id: '', texto: 'Todos' },
  { id: 'PENDING', texto: 'Pendientes' },
  { id: 'APPROVED', texto: 'Aprobados' },
  { id: 'FRAUD_SUSPECT', texto: 'Sospechas' },
  { id: 'DECLINED', texto: 'Rechazados' },
];

const RESULTADO: Record<string, string> = {
  acreditado: 'Wompi confirmó el pago: se acreditó al cliente.',
  ya_entregado: 'El pago ya estaba entregado; no se acreditó dos veces.',
  no_aprobada: 'Wompi no tiene este pago como aprobado.',
  monto_discrepante: 'El monto pagado es menor al del producto: quedó como sospecha de fraude.',
};

function FichaPago({
  referencia,
  peticion,
  onError,
  onCambio,
}: {
  referencia: string;
  peticion: PeticionPanel;
  onError: (e: unknown) => void;
  onCambio: () => void;
}) {
  const [orden, setOrden] = useState<Orden | null>(null);
  const [entrega, setEntrega] = useState<Entrega | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    peticion(`/api/admin/pago?ref=${encodeURIComponent(referencia)}`)
      .then((d) => {
        setOrden(d.orden);
        setEntrega(d.entrega);
      })
      .catch(onError);
  }, [referencia, peticion, onError]);

  const conciliar = async () => {
    setOcupado(true);
    setAviso('');
    try {
      const d = await peticion('/api/admin/pago', {
        method: 'POST',
        body: JSON.stringify({ ref: referencia }),
      });
      setAviso(RESULTADO[d.resultado] || 'Consulta hecha.');
      if (d.orden) setOrden(d.orden);
      if (d.entrega) setEntrega(d.entrega);
      onCambio();
    } catch (e) {
      onError(e);
    } finally {
      setOcupado(false);
    }
  };

  if (!orden) return <div className="adm-esqueleto" />;
  return (
    <>
      <div className="adm-ficha">
        <Dato nombre="Referencia">
          <span className="adm-mono">{orden.referencia}</span>
        </Dato>
        <Dato nombre="Producto">{orden.producto}</Dato>
        <Dato nombre="Monto">{pesos(orden.montoCentavos)}</Dato>
        <Dato nombre="Estado">
          <EtiquetaEstado estado={orden.estado} />
        </Dato>
        <Dato nombre="Cliente">{orden.telefono || '—'}</Dato>
        <Dato nombre="Correo">{orden.email || '—'}</Dato>
        <Dato nombre="Creada">{fechaHora(orden.creada)}</Dato>
        <Dato nombre="¿Se entregó?">
          {entrega?.entregado ? (
            <Etiqueta tono="verde">
              Sí · {entrega.origen} · {fechaHora(entrega.fecha)}
            </Etiqueta>
          ) : (
            <Etiqueta tono="dorado">No</Etiqueta>
          )}
        </Dato>
      </div>
      {aviso && <p className="adm-alerta">{aviso}</p>}
      <button
        className="adm-btn adm-btn-primario adm-btn-ancho"
        onClick={conciliar}
        disabled={ocupado}
      >
        <RefreshCw size={16} aria-hidden="true" />{' '}
        {ocupado ? 'Consultando a Wompi…' : 'Conciliar con Wompi'}
      </button>
      <p className="adm-nota">
        Consulta el pago real en Wompi. Si está aprobado y aún no se entregó, lo acredita; nunca
        acredita dos veces.
      </p>
    </>
  );
}

export function PanelPagos({
  peticion,
  onError,
}: {
  peticion: PeticionPanel;
  onError: (e: unknown) => void;
}) {
  const [ordenes, setOrdenes] = useState<Orden[] | null>(null);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [estado, setEstado] = useState('');
  const [consulta, setConsulta] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(
    async (q = '') => {
      try {
        const params = new URLSearchParams();
        if (estado) params.set('estado', estado);
        if (q) params.set('q', q);
        const d = await peticion(`/api/admin/pagos${params.toString() ? `?${params}` : ''}`);
        setOrdenes(d.ordenes || []);
        if (!q) setTotales(d.totales);
      } catch (e) {
        onError(e);
      }
    },
    [peticion, onError, estado],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <section className="adm-seccion">
      {totales && (
        <div className="adm-resumen-cifras adm-cifras-pagos">
          <div className="adm-cifra adm-cifra-estatica">
            <span className="adm-cifra-valor adm-verde">{pesos(totales.ventas30dCentavos)}</span>
            <span className="adm-cifra-etiqueta">Ventas · 30 días ({totales.aprobadas30d})</span>
          </div>
          <button className="adm-cifra" onClick={() => setEstado('PENDING')}>
            <span className="adm-cifra-valor adm-dorado">{totales.pendientes}</span>
            <span className="adm-cifra-etiqueta">Pendientes</span>
          </button>
          <button className="adm-cifra" onClick={() => setEstado('FRAUD_SUSPECT')}>
            <span className="adm-cifra-valor adm-rojo">{totales.sospechas}</span>
            <span className="adm-cifra-etiqueta">Sospechas de fraude</span>
          </button>
        </div>
      )}

      <form
        className="adm-buscador"
        onSubmit={(e) => {
          e.preventDefault();
          cargar(consulta.trim());
        }}
      >
        <Search size={18} aria-hidden="true" />
        <input
          className="adm-input"
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Referencia (HNT-…)"
          aria-label="Buscar pago por referencia"
        />
        <button className="adm-btn adm-btn-primario">Buscar</button>
      </form>

      <div
        className="adm-segmentos adm-segmentos-desplazables"
        role="group"
        aria-label="Filtrar por estado"
      >
        {FILTROS.map((f) => (
          <button
            key={f.id || 'todos'}
            className={estado === f.id ? 'adm-segmento activo' : 'adm-segmento'}
            onClick={() => setEstado(f.id)}
          >
            {f.texto}
          </button>
        ))}
      </div>

      {ordenes === null ? (
        <div className="adm-esqueleto" />
      ) : ordenes.length === 0 ? (
        <p className="adm-vacio">No hay pagos con este filtro.</p>
      ) : (
        <ul className="adm-lista">
          {ordenes.map((o) => (
            <li key={o.referencia}>
              <button className="adm-lista-item" onClick={() => setAbierta(o.referencia)}>
                <span className="adm-lista-principal">
                  <strong>{o.producto || 'Orden'}</strong>
                  <small>
                    {fechaHora(o.creada)} · {o.telefono || 'sin celular'}
                  </small>
                </span>
                <span className="adm-lista-lado">
                  <span className="adm-lista-cifra">{pesos(o.montoCentavos)}</span>
                  <EtiquetaEstado estado={o.estado} />
                </span>
                <ChevronRight size={18} aria-hidden="true" className="adm-lista-flecha" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {abierta && (
        <Hoja titulo="Pago" onCerrar={() => setAbierta(null)}>
          <FichaPago
            referencia={abierta}
            peticion={peticion}
            onError={onError}
            onCambio={() => cargar()}
          />
        </Hoja>
      )}
    </section>
  );
}
