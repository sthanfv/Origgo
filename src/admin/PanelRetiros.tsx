import { useCallback, useEffect, useState, type FormEvent } from 'react';

/**
 * Pestaña "Retiros" del panel: solicitudes de retiro de anuncios (Habeas Data) y buscador.
 * - Cola de solicitudes con radicado, plazo legal (15 días hábiles) y estado.
 * - Buscador por código, enlace (de Origgo o del portal original), celular o texto.
 * - Resolver: "Retirar" los inmuebles elegidos o "Rechazar" (revierte el retiro preventivo).
 * - "Reindexar": llena el índice de búsqueda de los inmuebles guardados antes de que existiera.
 * API: lib/admin/retiros.js.
 */

type AuthFetch = (ruta: string, opciones?: RequestInit) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface Inmueble {
  id: string;
  titulo: string;
  ciudad: string;
  barrio: string;
  precio: string;
  portal: string;
  activo: boolean;
  coincidencia?: string;
}

interface Solicitud {
  radicado: string;
  estado: 'recibida' | 'resuelta' | 'rechazada';
  creada_ms: number;
  vence_ms: number;
  solicitante: { nombre: string; correo: string; relacion: string };
  motivo: string;
  identificacion: {
    referencia: string | null;
    enlace_original: string | null;
    telefono_final: string | null;
    ciudad: string | null;
    barrio: string | null;
    descripcion: string | null;
  };
  coincidencias: string[];
  candidatos: string[];
  retiro_preventivo: string[];
}

const fecha = (ms: number) =>
  new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const diasRestantes = (ms: number) => Math.ceil((ms - Date.now()) / 86400000);

export function PanelRetiros({
  authFetch,
  onError,
}: {
  authFetch: AuthFetch;
  onError: (e: unknown) => void;
}) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [abierta, setAbierta] = useState<Solicitud | null>(null);
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<Inmueble[]>([]);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    try {
      const d = await authFetch('/api/admin/retiros');
      setSolicitudes(d.solicitudes || []);
    } catch (e) {
      onError(e);
    }
  }, [authFetch, onError]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const buscar = async (q: string) => {
    if (!q.trim()) return;
    setOcupado(true);
    try {
      const d = await authFetch(`/api/admin/buscar?q=${encodeURIComponent(q.trim())}`);
      setResultados(d.resultados || []);
      setAviso(
        d.resultados?.length ? '' : 'Sin resultados. Si el inmueble es antiguo, usa "Reindexar".',
      );
    } catch (e) {
      onError(e);
    } finally {
      setOcupado(false);
    }
  };

  const abrir = (s: Solicitud) => {
    setAbierta(s);
    setNota('');
    setElegidos(new Set([...s.coincidencias, ...s.retiro_preventivo]));
    const id = s.identificacion;
    const q =
      id.referencia ||
      id.enlace_original ||
      [id.ciudad, id.barrio, id.descripcion].filter(Boolean).join(' ');
    setConsulta(q || '');
    setResultados([]);
    if (s.coincidencias.length || s.candidatos.length) {
      // Muestra primero lo que ya encontró el sistema.
      Promise.all(
        [...s.coincidencias, ...s.candidatos].map((c) =>
          authFetch(`/api/admin/buscar?q=${encodeURIComponent(c)}`),
        ),
      )
        .then((rs) => {
          const vistos = new Map<string, Inmueble>();
          rs.forEach((r) => (r.resultados || []).forEach((x: Inmueble) => vistos.set(x.id, x)));
          setResultados(Array.from(vistos.values()));
        })
        .catch(onError);
    } else if (q) {
      buscar(q);
    }
  };

  const resolver = async (accion: 'retirar' | 'rechazar') => {
    if (!abierta) return;
    if (accion === 'retirar' && elegidos.size === 0) {
      setAviso('Elige al menos un inmueble para retirar.');
      return;
    }
    setOcupado(true);
    try {
      await authFetch('/api/admin/retiros', {
        method: 'POST',
        body: JSON.stringify({
          radicado: abierta.radicado,
          accion,
          ids: Array.from(elegidos),
          nota,
        }),
      });
      setAviso(
        accion === 'retirar'
          ? 'Solicitud resuelta: inmuebles retirados.'
          : 'Solicitud rechazada: se revirtió el retiro preventivo.',
      );
      setAbierta(null);
      await cargar();
    } catch (e) {
      onError(e);
    } finally {
      setOcupado(false);
    }
  };

  const reindexar = async () => {
    setOcupado(true);
    let cursor: string | null = null;
    let total = 0;
    try {
      do {
        const d: { actualizados: number; siguiente: string | null } = await authFetch(
          '/api/admin/reindexar',
          {
            method: 'POST',
            body: JSON.stringify({ cursor }),
          },
        );
        total += d.actualizados;
        cursor = d.siguiente;
        setAviso(`Reindexando… ${total} inmuebles actualizados`);
      } while (cursor);
      setAviso(`Índice listo: ${total} inmuebles actualizados.`);
    } catch (e) {
      onError(e);
    } finally {
      setOcupado(false);
    }
  };

  const alternar = (id: string) => {
    const s = new Set(elegidos);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setElegidos(s);
  };

  const pendientes = solicitudes.filter((s) => s.estado === 'recibida');

  return (
    <section className="adm-panel">
      <div className="adm-panel-cabecera">
        <div>
          <h2>Retiros (Habeas Data)</h2>
          <p>
            {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'} · plazo legal: 15 días
            hábiles
          </p>
        </div>
        <button className="adm-btn" type="button" onClick={reindexar} disabled={ocupado}>
          Reindexar búsqueda
        </button>
      </div>

      {aviso && <p className="adm-alerta">{aviso}</p>}

      <form
        className="adm-retiros-buscador"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          buscar(consulta);
        }}
      >
        <input
          className="adm-input"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Código, enlace, celular o texto (ej.: apartamento laureles medellín)"
          aria-label="Buscar inmuebles"
        />
        <button className="adm-btn adm-btn-primario" type="submit" disabled={ocupado}>
          Buscar
        </button>
      </form>

      {abierta && (
        <div className="adm-retiro-detalle">
          <div className="adm-retiro-cabecera">
            <strong>{abierta.radicado}</strong>
            <span>
              vence {fecha(abierta.vence_ms)} ({diasRestantes(abierta.vence_ms)} días)
            </span>
          </div>
          <p>
            <b>{abierta.solicitante.nombre}</b> ({abierta.solicitante.relacion}) ·{' '}
            {abierta.solicitante.correo} · motivo: {abierta.motivo}
          </p>
          <p className="adm-retiro-identificacion">
            {abierta.identificacion.referencia && (
              <>Referencia: {abierta.identificacion.referencia}. </>
            )}
            {abierta.identificacion.enlace_original && (
              <>Enlace original: {abierta.identificacion.enlace_original}. </>
            )}
            {abierta.identificacion.telefono_final && (
              <>Celular terminado en {abierta.identificacion.telefono_final}. </>
            )}
            {abierta.identificacion.ciudad && (
              <>
                Zona: {abierta.identificacion.ciudad} {abierta.identificacion.barrio}{' '}
                {abierta.identificacion.descripcion}.
              </>
            )}
          </p>
          <textarea
            className="adm-input"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota interna (qué se hizo y por qué)"
            maxLength={500}
          />
          <div className="adm-retiro-acciones">
            <button
              className="adm-btn adm-btn-primario"
              type="button"
              onClick={() => resolver('retirar')}
              disabled={ocupado}
            >
              Retirar {elegidos.size} inmueble{elegidos.size === 1 ? '' : 's'}
            </button>
            <button
              className="adm-btn"
              type="button"
              onClick={() => resolver('rechazar')}
              disabled={ocupado}
            >
              Rechazar
            </button>
            <button className="adm-btn" type="button" onClick={() => setAbierta(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {resultados.length > 0 && (
        <ul className="adm-retiro-resultados">
          {resultados.map((r) => (
            <li key={r.id}>
              <label>
                {abierta && (
                  <input
                    type="checkbox"
                    checked={elegidos.has(r.id)}
                    onChange={() => alternar(r.id)}
                  />
                )}
                <span>
                  <b>{r.titulo || r.id}</b> · {r.barrio}, {r.ciudad} · {r.precio} · {r.portal}
                  <small>
                    {' '}
                    {r.id} · {r.activo ? 'visible' : 'oculto'}
                    {r.coincidencia ? ` · coincide por ${r.coincidencia}` : ''}
                  </small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <ul className="adm-retiro-lista">
        {solicitudes.length === 0 && <li className="adm-vacio">No hay solicitudes de retiro.</li>}
        {solicitudes.map((s) => (
          <li key={s.radicado}>
            <button
              type="button"
              onClick={() => abrir(s)}
              className={abierta?.radicado === s.radicado ? 'activa' : ''}
            >
              <strong>{s.radicado}</strong>
              <span className={`adm-estado adm-estado-${s.estado}`}>{s.estado}</span>
              <span>{s.solicitante.nombre}</span>
              <span>
                {s.estado === 'recibida'
                  ? `vence en ${diasRestantes(s.vence_ms)} días`
                  : fecha(s.creada_ms)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
