import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { leadsDeEjemplo, respuestaDeEjemplo, resumenDeEjemplo, vistaPrevia } from './vista-previa';
import { PanelRetiros } from './PanelRetiros';
import { PanelResumen, type DatosResumen, type Seccion } from './PanelResumen';
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldAlert,
  Store,
  Users,
} from 'lucide-react';
import { PanelClientes } from './PanelClientes';
import { PanelPagos } from './PanelPagos';
import { Hoja } from './comunes';

/** Secciones del panel: menú lateral (computador) y barra inferior (teléfono). */
const SECCIONES: { id: Seccion; nombre: string; Icono: typeof Building2 }[] = [
  { id: 'resumen', nombre: 'Resumen', Icono: LayoutDashboard },
  { id: 'catalogo', nombre: 'Catálogo', Icono: Building2 },
  { id: 'clientes', nombre: 'Clientes', Icono: Users },
  { id: 'pagos', nombre: 'Pagos', Icono: CreditCard },
  { id: 'retiros', nombre: 'Retiros', Icono: ShieldAlert },
  { id: 'vitrina', nombre: 'Vitrina', Icono: Store },
];

/** En el teléfono caben 4 secciones + "Más" (estándar de barras inferiores: máx. 5 botones). */
const EN_BARRA_MOVIL: Seccion[] = ['resumen', 'catalogo', 'clientes', 'pagos'];
import { useSesionInactividad } from './sesion-inactividad';

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
type Filtro = 'todos' | 'visibles' | 'ocultos' | 'destacados';
type Pestana = Seccion;

const POR_PAGINA = 20;
const RECUPERAR_GOOGLE = 'https://accounts.google.com/signin/recovery';
const CAPAS = ['Cuenta de Google', 'Correo autorizado', 'Rol de administrador', 'Código 2FA'];
const FILTROS: Filtro[] = ['todos', 'visibles', 'ocultos', 'destacados'];

/** Texto sin tildes y en minúsculas, para buscar "medellin" y encontrar "Medellín". */
function normalizar(texto: unknown): string {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Logo oficial de Google (colores de marca) para el botón de acceso. */
function LogoGoogle() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

/** Estado visual del código: escribiendo, verificando, correcto o incorrecto. */
type EstadoCodigo = 'normal' | 'verificando' | 'exito' | 'error';

const TEXTO_ESTADO: Record<EstadoCodigo, string> = {
  normal: '',
  verificando: 'Verificando el código…',
  exito: 'Código correcto',
  error: 'Código incorrecto',
};

/** ¿El sistema pide menos movimiento? Entonces las animaciones se acortan o se omiten. */
function prefiereMenosMovimiento() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Seis casillas para el código TOTP: avanzan solas, aceptan pegar y envían al completarse.
 * Animación (fiel a la referencia "OTP Verification" del propietario):
 *   - la casilla activa tiene borde grueso y un resplandor que la llena por dentro;
 *   - cada dígito entra con un rebote;
 *   - al completar, una onda de luz y desenfoque recorre las casillas mientras se verifica;
 *   - si es incorrecto, las casillas se sacuden en rojo.
 * El estado "verificado" (la tarjeta completa se transforma) está en la pantalla del código.
 * Solo CSS y respeta prefers-reduced-motion.
 */
function CasillasCodigo({
  valor,
  onCambio,
  onCompleto,
  deshabilitado,
  estado,
}: {
  valor: string;
  onCambio: (v: string) => void;
  onCompleto: (v: string) => void;
  deshabilitado: boolean;
  estado: EstadoCodigo;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // Tras un código incorrecto las casillas se vacían: el foco vuelve a la primera.
  useEffect(() => {
    if (estado === 'normal' && !deshabilitado && valor === '') refs.current[0]?.focus();
  }, [estado, deshabilitado, valor]);

  const fijar = (nuevo: string, enfocar: number) => {
    const limpio = nuevo.replace(/\D/g, '').slice(0, 6);
    onCambio(limpio);
    refs.current[Math.min(enfocar, 5)]?.focus();
    if (limpio.length === 6) onCompleto(limpio);
  };

  const alEscribir = (i: number, texto: string) => {
    const digitos = texto.replace(/\D/g, '');
    if (!digitos) return;
    fijar(valor.slice(0, i) + digitos, i + digitos.length);
  };

  const alTecla = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (valor[i]) {
        onCambio(valor.slice(0, i) + valor.slice(i + 1));
      } else if (i > 0) {
        onCambio(valor.slice(0, i - 1) + valor.slice(i));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs.current[i + 1]?.focus();
    }
  };

  const alPegar = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fijar(e.clipboardData.getData('text'), 5);
  };

  return (
    <div className="adm-otp" data-estado={estado}>
      <div className="adm-casillas" role="group" aria-label="Código de 6 dígitos">
        {Array.from({ length: 6 }, (_, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={valor[i] ? 'adm-casilla adm-casilla-llena' : 'adm-casilla'}
            style={{ '--i': i } as CSSProperties}
            value={valor[i] || ''}
            onChange={(e) => alEscribir(i, e.target.value)}
            onKeyDown={(e) => alTecla(i, e)}
            onPaste={alPegar}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            disabled={deshabilitado}
            autoFocus={i === 0}
            aria-label={`Dígito ${i + 1}`}
          />
        ))}
      </div>
      <span className="adm-solo-lector" role="status">
        {TEXTO_ESTADO[estado]}
      </span>
    </div>
  );
}

/** Marca de Origgo para las pantallas del panel. */
function Marca({ pequena = false }: { pequena?: boolean }) {
  return (
    <div className={pequena ? 'adm-marca adm-marca-pequena' : 'adm-marca'}>
      <img src="/assets/img/origgo-logo.svg" alt="Origgo" className="adm-logo" />
      <span className="adm-insignia">Admin</span>
    </div>
  );
}

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
  const [modoRespaldo, setModoRespaldo] = useState(false);
  const [estadoCodigo, setEstadoCodigo] = useState<EstadoCodigo>('normal');
  // Motivo del último cierre automático (se muestra en la pantalla de entrada).
  const [avisoSesion, setAvisoSesion] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [pagina, setPagina] = useState(1);
  const [pestana, setPestana] = useState<Pestana>('resumen');
  const [datosResumen, setDatosResumen] = useState<DatosResumen | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);

  const resumen = useMemo(
    () => ({
      total: leads.length,
      visibles: leads.filter((l) => l.activo !== false).length,
      ocultos: leads.filter((l) => l.activo === false).length,
      destacados: leads.filter((l) => l.destacado).length,
    }),
    [leads],
  );

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return leads.filter((l) => {
      if (filtro === 'visibles' && l.activo === false) return false;
      if (filtro === 'ocultos' && l.activo !== false) return false;
      if (filtro === 'destacados' && !l.destacado) return false;
      if (!q) return true;
      return [l.titulo, l.ciudad, l.portal, l.precio, l.id].some((v) => normalizar(v).includes(q));
    });
  }, [leads, busqueda, filtro]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  /** fetch con el token de Google; la cookie del segundo factor viaja sola (HttpOnly). */
  const authFetch = useCallback(
    async (ruta: string, opciones: RequestInit = {}, refrescarToken = false) => {
      const actual = auth.currentUser;
      if (!actual) throw new ErrorApi('Sesión no iniciada.', 401);
      const token = await actual.getIdToken(refrescarToken);
      const headers = new Headers(opciones.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      if (opciones.body) headers.set('Content-Type', 'application/json');
      const res = await fetch(ruta, {
        ...opciones,
        headers,
        credentials: 'same-origin',
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new ErrorApi(datos.error || `Error ${res.status}`, res.status, datos.codigo);
      return datos;
    },
    [],
  );

  /** Traduce errores de la API a la fase correcta de la pantalla. */
  const manejarError = useCallback((e: unknown) => {
    if (e instanceof ErrorApi && e.codigo === 'SESION_INACTIVA') {
      // El servidor ya la dio por cerrada: se sale también de Google y se explica por qué.
      setAvisoSesion(
        'Cerramos tu sesión tras 15 minutos sin actividad. Vuelve a entrar para continuar.',
      );
      setCodigo('');
      signOut(auth);
      return;
    }
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
      // Cuota de Firestore agotada: se entra al panel con el aviso, en vez de quedar atascado.
      if (e instanceof ErrorApi && e.codigo === 'CUOTA_AGOTADA') {
        setFase('panel');
        setError(e.message);
        return;
      }
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

  useEffect(() => {
    // Solo en desarrollo: /admin.html?vista=... muestra la pantalla con datos de ejemplo.
    // import.meta.env.DEV es false en producción: el compilador elimina este bloque y los datos de ejemplo.
    if (!import.meta.env.DEV) return;
    const vista = vistaPrevia();
    if (vista) {
      setUser({
        email: 'admin@ejemplo.com',
        photoURL: null,
      } as unknown as User);
      setLeads(leadsDeEjemplo());
      setConfig({
        counterLabel: 'Oportunidades detectadas',
        counterValue: '146',
      });
      setFase(vista);
    }
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (import.meta.env.DEV && vistaPrevia()) return;
        setUser(u);
        if (!u) {
          setFase('login');
          setLeads([]);
        }
      }),
    [],
  );

  useEffect(() => {
    if (user && !(import.meta.env.DEV && vistaPrevia())) revisarEstado();
  }, [user, revisarEstado]);

  const entrar = async () => {
    setError('');
    setAvisoSesion('');
    setOcupado(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (!/popup-closed|cancelled-popup/.test((e as Error).message || '')) {
        setError('No se pudo iniciar sesión con Google. Intenta de nuevo.');
      }
    } finally {
      setOcupado(false);
    }
  };

  const cerrarSesion = useCallback(
    async (mensajeSalida = '') => {
      try {
        await authFetch('/api/admin/salir', { method: 'POST', body: '{}' });
      } catch {
        // Aunque falle, se cierra la sesión de Google.
      }
      setCodigo('');
      setModoRespaldo(false);
      setEstadoCodigo('normal');
      setAvisoSesion(mensajeSalida);
      await signOut(auth);
    },
    [authFetch],
  );

  const latido = useCallback(async () => {
    const d = await authFetch('/api/admin/estado?latido=1');
    if (!d.dosFactores)
      throw new ErrorApi('La sesión se cerró por inactividad.', 401, 'SESION_INACTIVA');
  }, [authFetch]);

  const alCerrarPorInactividad = useCallback(
    (motivo: 'inactividad' | 'otra-pestana') => {
      cerrarSesion(
        motivo === 'inactividad'
          ? 'Cerramos tu sesión tras 15 minutos sin actividad. Vuelve a entrar para continuar.'
          : 'Se cerró la sesión desde otra pestaña.',
      );
    },
    [cerrarSesion],
  );

  const { segundosAviso, seguir, avisarSalida } = useSesionInactividad({
    activo: fase === 'panel',
    onLatido: latido,
    onCerrar: alCerrarPorInactividad,
  });

  const salir = async () => {
    avisarSalida();
    await cerrarSesion();
  };

  const verificarCodigo = async (valor: string) => {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    const conCasillas = !modoRespaldo;
    if (conCasillas) setEstadoCodigo('verificando');
    try {
      const verificacion =
        import.meta.env.DEV && vistaPrevia()
          ? // Vista previa (solo desarrollo): 123456 es correcto, cualquier otro es incorrecto.
            esperar(700).then(() => {
              if (valor !== '123456') throw new ErrorApi('Código incorrecto.', 401);
            })
          : authFetch('/api/admin/verificar', {
              method: 'POST',
              body: JSON.stringify({ codigo: valor.trim() }),
            });
      // La onda de las casillas se deja ver completa al menos una vez.
      await Promise.all([
        verificacion,
        esperar(conCasillas && !prefiereMenosMovimiento() ? 900 : 0),
      ]);
      // La tarjeta pasa a "Código verificado" con los dígitos aún visibles mientras se
      // desenfocan (como la referencia); se entra al panel con "Continuar".
      setEstadoCodigo('exito');
    } catch (e) {
      manejarError(e);
      if (conCasillas) {
        // Las casillas se ponen en rojo y se sacuden antes de vaciarse.
        setEstadoCodigo('error');
        await esperar(prefiereMenosMovimiento() ? 0 : 650);
      }
      setCodigo('');
      setEstadoCodigo('normal');
    } finally {
      setOcupado(false);
    }
  };

  const continuarAlPanel = async () => {
    setOcupado(true);
    try {
      if (import.meta.env.DEV && vistaPrevia()) setFase('panel');
      else await cargar();
    } finally {
      setOcupado(false);
      setCodigo('');
      setEstadoCodigo('normal');
    }
  };

  const alEnviarCodigo = (ev: FormEvent) => {
    ev.preventDefault();
    verificarCodigo(codigo);
  };

  const irAFiltro = (f: Filtro) => {
    setFiltro(f);
    setPagina(1);
    setPestana('catalogo');
  };

  /** Cifras reales y alertas de la pantalla de inicio (GET /api/admin/resumen). */
  const cargarResumen = useCallback(async () => {
    if (import.meta.env.DEV && vistaPrevia()) {
      setDatosResumen(resumenDeEjemplo());
      return;
    }
    setCargandoResumen(true);
    try {
      setDatosResumen(await authFetch('/api/admin/resumen'));
    } catch (e) {
      manejarError(e);
    } finally {
      setCargandoResumen(false);
    }
  }, [authFetch, manejarError]);

  useEffect(() => {
    if (fase === 'panel' && pestana === 'resumen') cargarResumen();
  }, [fase, pestana, cargarResumen]);

  const seccionActual = SECCIONES.find((x) => x.id === pestana) || SECCIONES[0];
  const [masAbierto, setMasAbierto] = useState(false);
  // En la vista previa de desarrollo las secciones usan datos de ejemplo (nunca en producción).
  const peticionPanel = import.meta.env.DEV && vistaPrevia() ? respuestaDeEjemplo : authFetch;
  const irASeccion = (s: Seccion) => {
    setPestana(s);
    setMasAbierto(false);
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
      setMensaje('Cambio guardado.');
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
      await authFetch(`/api/admin/leads?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setMensaje('Inmueble eliminado.');
    } catch (e) {
      manejarError(e);
    } finally {
      setOcupado(false);
    }
  };

  const guardarConfig = async (ev: FormEvent) => {
    ev.preventDefault();
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await authFetch('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      setMensaje('Vitrina actualizada.');
    } catch (e) {
      manejarError(e);
    } finally {
      setOcupado(false);
    }
  };

  // ── Pantallas de acceso ────────────────────────────────────────────────────────────

  if (fase === 'cargando') {
    return (
      <div className="adm-fondo adm-centro">
        <div className="adm-cargando" role="status" aria-label="Cargando" />
      </div>
    );
  }

  if (fase === 'login' || !user) {
    return (
      <div className="adm-fondo adm-centro">
        <div className="adm-acceso-grid">
          <aside className="adm-lado-marca" aria-hidden="true">
            <span className="adm-eyebrow">Origgo Intelligence</span>
            <h2 className="adm-lado-titulo">
              Centro de control
              <br />
              <span className="adm-degradado">de tu vitrina</span>
            </h2>
            <p className="adm-lado-texto">
              Administra el catálogo de inmuebles directos y la portada pública desde un solo lugar.
            </p>
            <ul className="adm-beneficios">
              <li>Catálogo en tiempo real desde la base de datos</li>
              <li>Acceso protegido con 4 capas de seguridad</li>
              <li>Cada cambio queda registrado en la auditoría</li>
            </ul>
          </aside>
          <main className="adm-tarjeta-acceso">
            <Marca />
            <h1 className="adm-titulo">Panel de administración</h1>
            <p className="adm-subtitulo">Gestiona el catálogo y la vitrina de Origgo.</p>

            <button className="adm-btn-google" onClick={entrar} disabled={ocupado}>
              <LogoGoogle />
              {ocupado ? 'Abriendo Google…' : 'Continuar con Google'}
            </button>

            {avisoSesion && <p className="adm-alerta adm-alerta-info">{avisoSesion}</p>}
            {error && <p className="adm-alerta adm-alerta-error">{error}</p>}

            <div className="adm-capas" aria-label="Capas de seguridad del acceso">
              {CAPAS.map((capa, i) => (
                <span key={capa} className="adm-capa">
                  <span className="adm-capa-num">{i + 1}</span>
                  {capa}
                </span>
              ))}
            </div>

            <p className="adm-pie">
              Acceso restringido y auditado.{' '}
              <a href={RECUPERAR_GOOGLE} target="_blank" rel="noopener noreferrer">
                ¿No puedes entrar a tu cuenta de Google?
              </a>
            </p>
          </main>
        </div>
      </div>
    );
  }

  if (fase === 'sin-acceso') {
    return (
      <div className="adm-fondo adm-centro">
        <main className="adm-tarjeta-acceso">
          <Marca />
          <h1 className="adm-titulo">Sin acceso</h1>
          <p className="adm-subtitulo">
            La cuenta <strong>{user.email}</strong> no tiene permiso para usar este panel.
          </p>
          {error && <p className="adm-alerta adm-alerta-error">{error}</p>}
          <button className="adm-btn adm-btn-secundario adm-btn-ancho" onClick={salir}>
            Usar otra cuenta
          </button>
        </main>
      </div>
    );
  }

  if (fase === 'codigo') {
    return (
      <div className="adm-fondo adm-centro">
        <form
          className="adm-tarjeta-acceso adm-otp-tarjeta"
          data-estado={estadoCodigo}
          onSubmit={alEnviarCodigo}
        >
          <div className="adm-otp-vista-codigo" aria-hidden={estadoCodigo === 'exito'}>
            <Marca />
            <div className="adm-usuario-mini">
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt=""
                  className="adm-avatar"
                  referrerPolicy="no-referrer"
                />
              )}
              <span>{user.email}</span>
            </div>
            <h1 className="adm-titulo">Verificación en dos pasos</h1>
            <p className="adm-subtitulo">
              {modoRespaldo
                ? 'Escribe uno de tus códigos de respaldo (formato XXXXX-XXXXX).'
                : 'Abre tu app autenticadora y escribe el código de 6 dígitos de Origgo Admin.'}
            </p>

            {modoRespaldo ? (
              <input
                className="adm-input adm-input-respaldo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="XXXXX-XXXXX"
                maxLength={11}
                autoFocus
                autoComplete="off"
                aria-label="Código de respaldo"
                disabled={ocupado}
              />
            ) : (
              <CasillasCodigo
                valor={codigo}
                onCambio={setCodigo}
                onCompleto={verificarCodigo}
                deshabilitado={ocupado}
                estado={estadoCodigo}
              />
            )}

            {error && <p className="adm-alerta adm-alerta-error">{error}</p>}

            <button
              className="adm-btn adm-btn-primario adm-btn-ancho"
              type="submit"
              disabled={ocupado || (modoRespaldo ? codigo.trim().length < 10 : codigo.length < 6)}
            >
              {ocupado && estadoCodigo !== 'error' ? 'Verificando…' : 'Verificar'}
            </button>

            <div className="adm-enlaces">
              <button
                type="button"
                className="adm-enlace"
                onClick={() => {
                  setModoRespaldo(!modoRespaldo);
                  setCodigo('');
                  setError('');
                }}
              >
                {modoRespaldo
                  ? 'Usar la app autenticadora'
                  : '¿Perdiste el celular? Usa un código de respaldo'}
              </button>
              <button type="button" className="adm-enlace" onClick={salir}>
                Usar otra cuenta
              </button>
            </div>
          </div>

          {estadoCodigo === 'exito' && (
            // La tarjeta completa se transforma (referencia "OTP Verification"): resplandor
            // desde abajo, sello que crece con el check y el botón Continuar.
            <div className="adm-otp-vista-exito" role="status">
              <h1 className="adm-titulo adm-otp-aparece">Código verificado</h1>
              <p className="adm-subtitulo adm-otp-aparece">
                Tu sesión de administrador está activa en este dispositivo.
              </p>
              <div className="adm-otp-sello" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </div>
              <button
                type="button"
                className="adm-otp-continuar"
                onClick={continuarAlPanel}
                disabled={ocupado}
                autoFocus
              >
                {ocupado ? 'Entrando…' : 'Continuar'}
              </button>
            </div>
          )}
        </form>
      </div>
    );
  }

  // ── Panel ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="adm-fondo adm-app">
      {segundosAviso !== null && (
        // Aviso de cierre por inactividad (2 min antes). Mover el mouse no basta: hay que decidir.
        <div
          className="adm-modal-fondo"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="aviso-inactividad"
        >
          <div className="adm-modal">
            <h2 id="aviso-inactividad">¿Sigues ahí?</h2>
            <p>
              Por seguridad cerraremos tu sesión por inactividad en{' '}
              <strong className="adm-modal-cuenta">
                {Math.floor(segundosAviso / 60)}:{String(segundosAviso % 60).padStart(2, '0')}
              </strong>
            </p>
            <div className="adm-modal-acciones">
              <button
                className="adm-btn adm-btn-primario"
                onClick={() => seguir().catch(manejarError)}
                autoFocus
              >
                Seguir conectado
              </button>
              <button className="adm-btn adm-btn-secundario" onClick={salir}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Menú lateral (computador) */}
      <aside className="adm-lateral" aria-label="Menú del panel">
        <Marca pequena />
        <nav className="adm-lateral-nav">
          {SECCIONES.map(({ id, nombre, Icono }) => (
            <button
              key={id}
              className={pestana === id ? 'adm-lateral-item activo' : 'adm-lateral-item'}
              onClick={() => setPestana(id)}
              aria-current={pestana === id ? 'page' : undefined}
            >
              <Icono size={18} aria-hidden="true" />
              <span>{nombre}</span>
              {id === 'retiros' && (datosResumen?.retiros.pendientes || 0) > 0 && (
                <span className="adm-insignia-conteo">{datosResumen?.retiros.pendientes}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="adm-lateral-usuario">
          {user.photoURL && (
            <img src={user.photoURL} alt="" className="adm-avatar" referrerPolicy="no-referrer" />
          )}
          <span className="adm-usuario-correo">{user.email}</span>
          <button
            className="adm-icono-btn"
            onClick={salir}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div className="adm-principal">
        <header className="adm-cabecera">
          <div className="adm-cabecera-marca">
            <Marca pequena />
          </div>
          <h1 className="adm-cabecera-titulo">{seccionActual.nombre}</h1>
          <button
            className="adm-icono-btn adm-cabecera-salir"
            onClick={salir}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </header>

        <main className="adm-contenido">
          {error && <p className="adm-alerta adm-alerta-error">{error}</p>}
          {mensaje && <p className="adm-alerta adm-alerta-ok">{mensaje}</p>}

          {pestana === 'resumen' ? (
            <PanelResumen
              datos={datosResumen}
              cargando={cargandoResumen}
              onIr={setPestana}
              onFiltroCatalogo={irAFiltro}
            />
          ) : pestana === 'clientes' ? (
            <PanelClientes peticion={peticionPanel} onError={manejarError} />
          ) : pestana === 'pagos' ? (
            <PanelPagos peticion={peticionPanel} onError={manejarError} />
          ) : pestana === 'retiros' ? (
            <PanelRetiros authFetch={peticionPanel} onError={manejarError} />
          ) : pestana === 'vitrina' ? (
            <form className="adm-panel" onSubmit={guardarConfig}>
              <div className="adm-panel-cabecera">
                <div>
                  <h2>Vitrina</h2>
                  <p>Textos de la portada pública de Origgo.</p>
                </div>
              </div>
              <div className="adm-campos">
                <label className="adm-campo">
                  <span>Etiqueta del contador</span>
                  <input
                    className="adm-input"
                    value={config.counterLabel || ''}
                    onChange={(e) => setConfig({ ...config, counterLabel: e.target.value })}
                    placeholder="Ej. Oportunidades detectadas"
                  />
                </label>
                <label className="adm-campo">
                  <span>Número del contador</span>
                  <input
                    className="adm-input"
                    value={config.counterValue || ''}
                    onChange={(e) => setConfig({ ...config, counterValue: e.target.value })}
                    placeholder="Ej. 146"
                  />
                </label>
              </div>
              <div className="adm-panel-pie">
                <button className="adm-btn adm-btn-primario" type="submit" disabled={ocupado}>
                  {ocupado ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          ) : (
            <section className="adm-panel">
              <div className="adm-panel-cabecera">
                <div>
                  <h2>Catálogo</h2>
                  <p>
                    {datosResumen && datosResumen.catalogo.total > leads.length
                      ? `Se muestran los ${leads.length} más recientes de ${datosResumen.catalogo.total.toLocaleString('es-CO')} inmuebles.`
                      : `${leads.length} inmuebles en la base de datos (fuente de la verdad).`}
                  </p>
                </div>
                <button className="adm-btn adm-btn-secundario" onClick={cargar} disabled={ocupado}>
                  Recargar
                </button>
              </div>

              <div className="adm-herramientas">
                <input
                  className="adm-input adm-buscar"
                  type="search"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setPagina(1);
                  }}
                  placeholder="Buscar por título, ciudad, portal o precio…"
                  aria-label="Buscar inmuebles"
                />
                <div className="adm-segmentos" role="group" aria-label="Filtrar inmuebles">
                  {FILTROS.map((f) => (
                    <button
                      key={f}
                      aria-pressed={filtro === f}
                      className={filtro === f ? 'adm-segmento activo' : 'adm-segmento'}
                      onClick={() => {
                        setFiltro(f);
                        setPagina(1);
                      }}
                    >
                      {f[0].toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="adm-tabla-scroll">
                <table className="adm-tabla">
                  <thead>
                    <tr>
                      <th>Inmueble</th>
                      <th>Ciudad</th>
                      <th>Precio</th>
                      <th>Portal</th>
                      <th>Estado</th>
                      <th className="adm-th-acciones">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((l) => (
                      <tr key={l.id} className={l.activo === false ? 'adm-fila-oculta' : ''}>
                        <td data-label="Inmueble" className="adm-celda-titulo">
                          {l.titulo || '—'}
                          {l.destacado ? (
                            <span className="adm-estrella" title="Destacado">
                              {' '}
                              ★
                            </span>
                          ) : null}
                        </td>
                        <td data-label="Ciudad">{l.ciudad || '—'}</td>
                        <td data-label="Precio" className="adm-precio">
                          {l.precio || '—'}
                        </td>
                        <td data-label="Portal">{l.portal || '—'}</td>
                        <td data-label="Estado">
                          <span
                            className={l.activo === false ? 'adm-chip adm-chip-oculto' : 'adm-chip'}
                          >
                            {l.activo === false ? 'Oculto' : 'Visible'}
                          </span>
                        </td>
                        <td className="adm-acciones">
                          <button
                            className="adm-btn adm-btn-mini"
                            onClick={() => parchar(l.id, { activo: l.activo === false })}
                            disabled={ocupado}
                          >
                            {l.activo === false ? 'Mostrar' : 'Ocultar'}
                          </button>
                          <button
                            className="adm-btn adm-btn-mini"
                            onClick={() => parchar(l.id, { destacado: !l.destacado })}
                            disabled={ocupado}
                          >
                            {l.destacado ? 'Quitar ★' : 'Destacar'}
                          </button>
                          <button
                            className="adm-btn adm-btn-mini adm-btn-peligro"
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
                {leads.length === 0 && !error && (
                  <p className="adm-vacio">No hay inmuebles en la base de datos.</p>
                )}
                {leads.length > 0 && filtrados.length === 0 && (
                  <p className="adm-vacio">Ningún inmueble coincide con la búsqueda.</p>
                )}
              </div>

              {filtrados.length > 0 && (
                <nav className="adm-paginacion" aria-label="Paginación">
                  <span className="adm-paginacion-info">
                    {(paginaActual - 1) * POR_PAGINA + 1}–
                    {Math.min(paginaActual * POR_PAGINA, filtrados.length)} de {filtrados.length}
                  </span>
                  <div className="adm-paginacion-botones">
                    <button
                      className="adm-btn adm-btn-secundario"
                      onClick={() => setPagina(paginaActual - 1)}
                      disabled={paginaActual <= 1}
                    >
                      ← Anterior
                    </button>
                    <span className="adm-paginacion-pagina">
                      {paginaActual} / {totalPaginas}
                    </span>
                    <button
                      className="adm-btn adm-btn-secundario"
                      onClick={() => setPagina(paginaActual + 1)}
                      disabled={paginaActual >= totalPaginas}
                    >
                      Siguiente →
                    </button>
                  </div>
                </nav>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Barra inferior (teléfono): acceso con el pulgar a cada sección */}
      <nav className="adm-nav-inferior" aria-label="Secciones del panel">
        {SECCIONES.filter((x) => EN_BARRA_MOVIL.includes(x.id)).map(({ id, nombre, Icono }) => (
          <button
            key={id}
            className={pestana === id ? 'adm-nav-inferior-item activo' : 'adm-nav-inferior-item'}
            onClick={() => irASeccion(id)}
            aria-current={pestana === id ? 'page' : undefined}
          >
            <span className="adm-nav-inferior-icono">
              <Icono size={22} aria-hidden="true" />
            </span>
            <span>{nombre}</span>
          </button>
        ))}
        <button
          className={
            !EN_BARRA_MOVIL.includes(pestana)
              ? 'adm-nav-inferior-item activo'
              : 'adm-nav-inferior-item'
          }
          onClick={() => setMasAbierto(true)}
          aria-haspopup="dialog"
        >
          <span className="adm-nav-inferior-icono">
            <Menu size={22} aria-hidden="true" />
            {(datosResumen?.retiros.pendientes || 0) > 0 && (
              <span className="adm-insignia-conteo">{datosResumen?.retiros.pendientes}</span>
            )}
          </span>
          <span>Más</span>
        </button>
      </nav>

      {masAbierto && (
        <Hoja titulo="Más secciones" onCerrar={() => setMasAbierto(false)}>
          <ul className="adm-mas-lista">
            {SECCIONES.filter((x) => !EN_BARRA_MOVIL.includes(x.id)).map(
              ({ id, nombre, Icono }) => (
                <li key={id}>
                  <button className="adm-lista-item" onClick={() => irASeccion(id)}>
                    <Icono size={20} aria-hidden="true" />
                    <span className="adm-lista-principal">
                      <strong>{nombre}</strong>
                    </span>
                    {id === 'retiros' && (datosResumen?.retiros.pendientes || 0) > 0 && (
                      <span className="adm-insignia-conteo">
                        {datosResumen?.retiros.pendientes}
                      </span>
                    )}
                  </button>
                </li>
              ),
            )}
          </ul>
        </Hoja>
      )}
    </div>
  );
}
