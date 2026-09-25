import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

/** Inmueble del catálogo (Firestore `leads`). Se muestran solo campos no sensibles. */
interface Lead {
  id: string;
  titulo?: string;
  ciudad?: string;
  precio?: string;
  portal?: string;
  activo?: boolean;
  destacado?: boolean;
  [clave: string]: unknown;
}

/** Configuración editable de la vitrina (Firestore `config/showcase`). */
interface ShowcaseConfig {
  counterLabel?: string;
  counterValue?: string;
}

/**
 * Panel de administración de Origgo.
 * Acceso con Google; toda acción va contra las API seguras (api/admin/*), que verifican
 * el token y la lista de administradores. Firestore es la fuente de la verdad.
 */
export function AdminApp() {
  const [user, setUser] = useState<User | null>(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [config, setConfig] = useState<ShowcaseConfig>({});
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setCargandoAuth(false);
  }), []);

  /** fetch con el token de Google del usuario actual. */
  const authFetch = useCallback(async (ruta: string, opciones: RequestInit = {}) => {
    const actual = auth.currentUser;
    if (!actual) throw new Error('Sesión no iniciada.');
    const token = await actual.getIdToken();
    const headers = new Headers(opciones.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if (opciones.body) headers.set('Content-Type', 'application/json');
    const res = await fetch(ruta, { ...opciones, headers });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(datos.error || `Error ${res.status}`);
    return datos;
  }, []);

  const cargar = useCallback(async () => {
    setError('');
    setMensaje('');
    try {
      const [dLeads, dConfig] = await Promise.all([
        authFetch('/api/admin/leads'),
        authFetch('/api/admin/config'),
      ]);
      setLeads(dLeads.leads || []);
      setConfig(dConfig.config || {});
    } catch (e) {
      setError((e as Error).message);
    }
  }, [authFetch]);

  useEffect(() => {
    if (user) cargar();
  }, [user, cargar]);

  const entrar = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError('No se pudo iniciar sesión: ' + (e as Error).message);
    }
  };

  const parchar = async (id: string, cambios: Record<string, unknown>) => {
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await authFetch('/api/admin/leads', {
        method: 'PATCH',
        body: JSON.stringify({ id, cambios }),
      });
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...cambios } : l)));
      setMensaje('Guardado.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = async (id: string) => {
    if (!window.confirm('¿Eliminar este inmueble de forma permanente?')) return;
    setOcupado(true);
    setError('');
    try {
      await authFetch(`/api/admin/leads?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setMensaje('Inmueble eliminado.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const guardarConfig = async () => {
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await authFetch('/api/admin/config', { method: 'PUT', body: JSON.stringify(config) });
      setMensaje('Configuración guardada.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  if (cargandoAuth) return <div className="admin-centro">Cargando…</div>;

  if (!user) {
    return (
      <div className="admin-centro">
        <div className="admin-login">
          <h1>Panel Origgo</h1>
          <p>Acceso solo para administradores.</p>
          <button className="admin-btn admin-btn-primary" onClick={entrar}>
            Entrar con Google
          </button>
          {error && <p className="admin-error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-wrap">
      <header className="admin-header">
        <div>
          <strong>Panel Origgo</strong> — {user.email}
        </div>
        <div className="admin-acciones">
          <button className="admin-btn" onClick={cargar} disabled={ocupado}>
            Recargar
          </button>
          <button className="admin-btn" onClick={() => signOut(auth)}>
            Salir
          </button>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}
      {mensaje && <p className="admin-ok">{mensaje}</p>}

      <section className="admin-card">
        <h2>Vitrina</h2>
        <label className="admin-label">
          Etiqueta del contador
          <input
            value={config.counterLabel || ''}
            onChange={(e) => setConfig({ ...config, counterLabel: e.target.value })}
          />
        </label>
        <label className="admin-label">
          Número del contador
          <input
            value={config.counterValue || ''}
            onChange={(e) => setConfig({ ...config, counterValue: e.target.value })}
          />
        </label>
        <button className="admin-btn admin-btn-primary" onClick={guardarConfig} disabled={ocupado}>
          Guardar vitrina
        </button>
      </section>

      <section className="admin-card">
        <h2>Inmuebles ({leads.length})</h2>
        <div className="admin-tabla-scroll">
          <table className="admin-tabla">
            <thead>
              <tr>
                <th>Título</th>
                <th>Ciudad</th>
                <th>Precio</th>
                <th>Portal</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className={l.activo === false ? 'admin-oculto' : ''}>
                  <td>
                    {l.titulo || '—'}
                    {l.destacado ? ' ⭐' : ''}
                  </td>
                  <td>{l.ciudad || '—'}</td>
                  <td>{l.precio || '—'}</td>
                  <td>{l.portal || '—'}</td>
                  <td>{l.activo === false ? 'Oculto' : 'Visible'}</td>
                  <td className="admin-acciones">
                    <button
                      className="admin-btn"
                      onClick={() => parchar(l.id, { activo: l.activo === false })}
                      disabled={ocupado}
                    >
                      {l.activo === false ? 'Mostrar' : 'Ocultar'}
                    </button>
                    <button
                      className="admin-btn"
                      onClick={() => parchar(l.id, { destacado: !l.destacado })}
                      disabled={ocupado}
                    >
                      {l.destacado ? 'Quitar ⭐' : 'Destacar'}
                    </button>
                    <button
                      className="admin-btn admin-btn-peligro"
                      onClick={() => eliminar(l.id)}
                      disabled={ocupado}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leads.length === 0 && <p className="admin-vacio">No hay inmuebles en la base de datos.</p>}
      </section>
    </div>
  );
}
