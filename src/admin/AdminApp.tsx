import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

/** Error de la API del panel con su código HTTP y código interno (ej. 2FA_REQUERIDO). */
class ErrorApi extends Error {
  constructor(
    mensaje: string,
    public status: number,
    public codigo?: string,
  ) {
    super(mensaje);
  }
}

type Fase = 'cargando' | 'login' | 'sin-acceso' | 'codigo' | 'panel';

/**
 * Panel de administración de Origgo.
 * Capas: Google → correo autorizado + custom claim `admin` → código TOTP (app autenticadora).
 * Toda acción va contra api/admin/*, que vuelve a verificar las cuatro capas en el servidor.
 */
export function AdminApp() {
  const [user, setUser] = useState<User | null>(null);
  const [fase, setFase] = useState<Fase>('cargando');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [config, setConfig] = useState<ShowcaseConfig>({});
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  /** fetch con el token de Google; la cookie del segundo factor viaja sola (HttpOnly). */
  const authFetch = useCallback(
    async (ruta: string, opciones: RequestInit = {}, refrescarToken = false) => {
      const actual = auth.currentUser;
      if (!actual) throw new ErrorApi('Sesión no iniciada.', 401);
      const token = await actual.getIdToken(refrescarToken);
      const headers = new Headers(opciones.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      if (opciones.body) headers.set('Content-Type', 'application/json');
      const res = await fetch(ruta, { ...opciones, headers, credentials: 'same-origin' });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new ErrorApi(datos.error || `Error ${res.status}`, res.status, datos.codigo);
      return datos;
    },
    [],
  );

  /** Traduce errores de la API a la fase correcta de la pantalla. */
  const manejarError = useCallback((e: unknown) => {
    if (e instanceof ErrorApi && e.codigo === '2FA_REQUERIDO') {
      setFase('codigo');
      return;
    }
    if (e instanceof ErrorApi && e.status === 403) {
      setFase('sin-acceso');
    }
    setError((e as Error).message);
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
      setFase('panel');
    } catch (e) {
      manejarError(e);
    }
  }, [authFetch, manejarError]);

  /** Tras entrar con Google: ¿ya pasó el segundo factor en este navegador? */
  const revisarEstado = useCallback(async () => {
    setError('');
    try {
      // Refresca el token para que traiga el custom claim `admin` recién asignado.
      const estado = await authFetch('/api/admin/estado', {}, true);
      if (estado.dosFactores) {
        await cargar();
      } else {
        setFase('codigo');
        if (!estado.configurado) {
          setError('El segundo factor aún no está configurado en el servidor (ADMIN_TOTP_SECRET).');
        }
      }
    } catch (e) {
      manejarError(e);
      if (!(e instanceof ErrorApi && e.codigo === '2FA_REQUERIDO')) setFase('sin-acceso');
    }
  }, [authFetch, cargar, manejarError]);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        if (!u) {
          setFase('login');
          setLeads([]);
        }
      }),
    [],
  );

  useEffect(() => {
    if (user) revisarEstado();
  }, [user, revisarEstado]);

  const entrar = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError('No se pudo iniciar sesión: ' + (e as Error).message);
    }
  };

  const salir = async () => {
    try {
      await authFetch('/api/admin/salir', { method: 'POST', body: '{}' });
    } catch {
      // Aunque falle, se cierra la sesión de Google.
    }
    await signOut(auth);
  };

  const verificarCodigo = async (ev: FormEvent) => {
    ev.preventDefault();
    setOcupado(true);
    setError('');
    try {
      await authFetch('/api/admin/verificar', {
        method: 'POST',
        body: JSON.stringify({ codigo: codigo.trim() }),
      });
      setCodigo('');
      await cargar();
    } catch (e) {
      manejarError(e);
    } finally {
      setOcupado(false);
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
      manejarError(e);
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
      manejarError(e);
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
      manejarError(e);
    } finally {
      setOcupado(false);
    }
  };

  if (fase === 'cargando') return <div className="admin-centro">Cargando…</div>;

  if (fase === 'login' || !user) {
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

  if (fase === 'sin-acceso') {
    return (
      <div className="admin-centro">
        <div className="admin-login">
          <h1>Sin acceso</h1>
          <p>La cuenta {user.email} no tiene permiso para usar el panel.</p>
          {error && <p className="admin-error">{error}</p>}
          <button className="admin-btn" onClick={salir}>
            Salir
          </button>
        </div>
      </div>
    );
  }

  if (fase === 'codigo') {
    return (
      <div className="admin-centro">
        <form className="admin-login" onSubmit={verificarCodigo}>
          <h1>Verificación en dos pasos</h1>
          <p>Escribe el código de 6 dígitos de tu app autenticadora (o un código de respaldo).</p>
          <input
            className="admin-codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            inputMode="text"
            autoComplete="one-time-code"
            autoFocus
            maxLength={11}
            placeholder="123456"
            aria-label="Código de verificación"
          />
          <button
            className="admin-btn admin-btn-primary"
            type="submit"
            disabled={ocupado || codigo.trim().length < 6}
          >
            Verificar
          </button>
          {error && <p className="admin-error">{error}</p>}
          <button className="admin-btn admin-btn-enlace" type="button" onClick={salir}>
            Usar otra cuenta
          </button>
        </form>
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
          <button className="admin-btn" onClick={salir}>
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
