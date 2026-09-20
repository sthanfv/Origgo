/**
 * 🌐 CLIENTE DE RED Y API CENTRALIZADO
 * Origgo Intelligence — Adaptador React / Vite
 * 
 * Gestiona peticiones HTTP seguras, inyección de x-trace-id, reintentos
 * exponenciales con jitter aleatorio y resolución de cabeceras de autenticación.
 */

/**
 * Genera un identificador de rastreo único para auditoría y observabilidad.
 * @returns Cadena con prefijo hnt_
 */
export function generarTraceId(): string {
  return 'hnt_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
}

/**
 * Genera un identificador universal único (UUIDv4) para llaves de idempotencia.
 * @returns Cadena UUIDv4 determinista
 */
export function generarUUIDv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Opciones de configuración para la cola de reintentos */
export interface OpcionesReintento {
  maxReintentos?: number;
  delayBaseMs?: number;
  factorBackoff?: number;
  jitterMs?: number;
  timeoutMs?: number;
}

/**
 * Ejecuta una petición HTTP con reintentos exponenciales y jitter.
 * @param url Ruta o endpoint relativo/absoluto
 * @param opciones Opciones estándar de RequestInit
 * @param config Configuración del ciclo de reintentos
 */
export async function apiFetch<T = any>(
  url: string,
  opciones: RequestInit = {},
  config: OpcionesReintento = {}
): Promise<T> {
  const {
    maxReintentos = 2,
    delayBaseMs = 700,
    factorBackoff = 2,
    jitterMs = 250,
    timeoutMs = 8000,
  } = config;

  let ultimoError: Error | null = null;

  for (let intento = 0; intento <= maxReintentos; intento++) {
    const controlador = new AbortController();
    const timerId = setTimeout(() => controlador.abort(), timeoutMs);

    try {
      const headers = new Headers(opciones.headers || {});
      if (!headers.has('x-trace-id')) {
        headers.set('x-trace-id', generarTraceId());
      }

      // Inyectar token de sesión persistente si existe en localStorage
      if (!headers.has('Authorization')) {
        try {
          const tokenGuardado = localStorage.getItem('origgo_auth_jwt_token');
          if (tokenGuardado) {
            headers.set('Authorization', `Bearer ${tokenGuardado}`);
          }
        } catch {
          // localStorage no disponible en entornos aislados
        }
      }

      const respuesta = await fetch(url, {
        ...opciones,
        headers,
        signal: controlador.signal,
      });

      clearTimeout(timerId);

      // Si el servidor responde con 4xx (excepto 429 cuota/rate-limit), no tiene sentido reintentar
      if (!respuesta.ok) {
        let detalleError = `HTTP ${respuesta.status}`;
        try {
          const errorJson = await respuesta.json();
          if (errorJson?.error || errorJson?.message) {
            detalleError = errorJson.error || errorJson.message;
          }
        } catch {
          // Cuerpo no es JSON
        }

        if (respuesta.status >= 400 && respuesta.status < 500 && respuesta.status !== 429) {
          const err = new Error(detalleError);
          (err as any).status = respuesta.status;
          throw err;
        }

        const err = new Error(detalleError);
        (err as any).status = respuesta.status;
        throw err;
      }

      return (await respuesta.json()) as T;
    } catch (err: any) {
      clearTimeout(timerId);
      ultimoError = err;

      // Si es un error 4xx no recuperable, no esperar reintentos
      if (err?.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }

      if (intento === maxReintentos) {
        break;
      }

      const espera = delayBaseMs * Math.pow(factorBackoff, intento) + Math.floor(Math.random() * jitterMs);
      await new Promise((resolve) => setTimeout(resolve, espera));
    }
  }

  throw ultimoError || new Error('Fallo de conexión tras agotar reintentos');
}
