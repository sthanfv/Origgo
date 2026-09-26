import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cierre de sesión por inactividad del panel (OWASP Session Management / NIST 800-63B).
 *
 * El servidor es quien manda (lib/admin/sesion.js: 15 min sin peticiones cierran la sesión).
 * Este hook es la parte visible y la coordinación entre pestañas:
 *   - Cuenta la actividad real (mouse, teclado, toque, desplazamiento) de TODAS las pestañas
 *     del panel: la marca de tiempo se comparte por localStorage.
 *   - Mientras hay actividad, envía un "latido" al servidor cada 4 min para que la sesión no
 *     venza aunque el administrador solo esté leyendo.
 *   - A 2 min del cierre muestra un aviso con cuenta regresiva. Con el aviso abierto, mover el
 *     mouse NO basta: hay que pulsar "Seguir conectado" (como en la banca en línea).
 *   - Al vencer, o al pulsar "Salir" en cualquier pestaña, se cierra en todas (BroadcastChannel).
 *   - Usa marcas de tiempo, no contadores: los navegadores frenan los temporizadores de las
 *     pestañas en segundo plano, y al volver se detecta de inmediato si ya venció.
 */

const CLAVE_ACTIVIDAD = 'origgo-admin-actividad';
const CANAL = 'origgo-admin-sesion';
const LATIDO_CADA_MS = 4 * 60 * 1000;
const REGISTRAR_CADA_MS = 5 * 1000;
const EVENTOS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'mousemove'] as const;

function leerActividad(): number {
  try {
    return Number(localStorage.getItem(CLAVE_ACTIVIDAD)) || 0;
  } catch {
    return 0;
  }
}

function guardarActividad(ms: number) {
  try {
    localStorage.setItem(CLAVE_ACTIVIDAD, String(ms));
  } catch {
    // Navegación privada o almacenamiento bloqueado: se usa solo la memoria de esta pestaña.
  }
}

interface Opciones {
  activo: boolean;
  inactividadMs?: number;
  avisoMs?: number;
  /** Renueva la sesión en el servidor (GET /api/admin/estado?latido=1). */
  onLatido: () => Promise<void>;
  /** Cierra la sesión (servidor + Google). `origen` indica si vino de otra pestaña. */
  onCerrar: (motivo: 'inactividad' | 'otra-pestana') => void;
}

export function useSesionInactividad({
  activo,
  inactividadMs = 15 * 60 * 1000,
  avisoMs = 2 * 60 * 1000,
  onLatido,
  onCerrar,
}: Opciones) {
  const [segundosAviso, setSegundosAviso] = useState<number | null>(null);
  const ultimaLocal = useRef(Date.now());
  const ultimoLatido = useRef(Date.now());
  const ultimoRegistro = useRef(0);
  const avisoVisible = useRef(false);
  const canal = useRef<BroadcastChannel | null>(null);
  const cerrando = useRef(false);

  const ultimaActividad = () => Math.max(ultimaLocal.current, leerActividad());

  const registrarActividad = useCallback(
    (forzar = false) => {
      if (avisoVisible.current && !forzar) return;
      const ahora = Date.now();
      ultimaLocal.current = ahora;
      if (forzar || ahora - ultimoRegistro.current > REGISTRAR_CADA_MS) {
        ultimoRegistro.current = ahora;
        guardarActividad(ahora);
      }
      if (ahora - ultimoLatido.current > LATIDO_CADA_MS) {
        ultimoLatido.current = ahora;
        onLatido().catch(() => {});
      }
    },
    [onLatido],
  );

  const cerrar = useCallback(
    (motivo: 'inactividad' | 'otra-pestana') => {
      if (cerrando.current) return;
      cerrando.current = true;
      avisoVisible.current = false;
      setSegundosAviso(null);
      if (motivo === 'inactividad') canal.current?.postMessage('salir');
      onCerrar(motivo);
    },
    [onCerrar],
  );

  useEffect(() => {
    if (!activo) return;
    cerrando.current = false;
    ultimaLocal.current = Date.now();
    ultimoLatido.current = Date.now();
    guardarActividad(Date.now());

    try {
      canal.current = new BroadcastChannel(CANAL);
      canal.current.onmessage = (e) => {
        if (e.data === 'salir') cerrar('otra-pestana');
        if (e.data === 'seguir') {
          avisoVisible.current = false;
          setSegundosAviso(null);
        }
      };
    } catch {
      canal.current = null;
    }

    const alActuar = () => registrarActividad();
    EVENTOS.forEach((ev) => window.addEventListener(ev, alActuar, { passive: true }));

    const revisar = () => {
      const restante = inactividadMs - (Date.now() - ultimaActividad());
      if (restante <= 0) {
        cerrar('inactividad');
      } else if (restante <= avisoMs) {
        avisoVisible.current = true;
        setSegundosAviso(Math.ceil(restante / 1000));
      } else if (avisoVisible.current) {
        // Otra pestaña registró actividad: se quita el aviso.
        avisoVisible.current = false;
        setSegundosAviso(null);
      }
    };
    const intervalo = window.setInterval(revisar, 1000);
    document.addEventListener('visibilitychange', revisar);

    return () => {
      EVENTOS.forEach((ev) => window.removeEventListener(ev, alActuar));
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', revisar);
      canal.current?.close();
      canal.current = null;
    };
  }, [activo, inactividadMs, avisoMs, registrarActividad, cerrar]);

  /** "Seguir conectado": renueva en el servidor y en todas las pestañas. */
  const seguir = useCallback(async () => {
    avisoVisible.current = false;
    setSegundosAviso(null);
    ultimoLatido.current = Date.now();
    registrarActividad(true);
    canal.current?.postMessage('seguir');
    await onLatido();
  }, [onLatido, registrarActividad]);

  /** Salida manual: avisa a las demás pestañas. */
  const avisarSalida = useCallback(() => canal.current?.postMessage('salir'), []);

  return { segundosAviso, seguir, avisarSalida };
}
