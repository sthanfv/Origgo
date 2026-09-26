/**
 * 🔑 SERVICIO DE AUTENTICACIÓN Y DESAFÍOS CRIPTOGRÁFICOS
 * Origgo Intelligence — Adaptador React / Vite
 * 
 * Orquesta la resolución de retos Proof-of-Work (PoW) en el navegador,
 * la validación de PIN + WhatsApp y la persistencia de tokens JWT.
 */

import { apiFetch } from './api';
import { UserSession } from '../types';

/** Estructura del reto de seguridad devuelto por el backend */
export interface DesafioSeguridad {
  salt: string;
  timestamp: number;
  expira: number;
  dificultad: number;
  signature: string;
  nonce?: number;
}

/**
 * Resuelve de forma computacional en el cliente el reto de Prueba de Trabajo (PoW).
 * @param desafio Reto emitido por el backend con salt y dificultad
 * @returns Nonce que satisface la dificultad de prefijo con ceros
 */
export async function resolverDesafioPoW(desafio: DesafioSeguridad): Promise<number> {
  if (!desafio || !desafio.salt) return 0;
  const dificultad = parseInt(String(desafio.dificultad), 10) || 3;
  const prefijoRequerido = '0'.repeat(dificultad);
  const salt = desafio.salt;

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    let nonce = 0;
    while (nonce < 1000000) {
      const datos = encoder.encode(`${salt}:${nonce}`);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', datos);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      if (hashHex.startsWith(prefijoRequerido)) {
        return nonce;
      }
      nonce++;
    }
  }
  return 0;
}

/**
 * Solicita y resuelve automáticamente el desafío de seguridad anti-fuerza bruta.
 * @returns Objeto con el reto y nonce resuelto
 */
export async function obtenerDesafioResuelto(): Promise<DesafioSeguridad | null> {
  try {
    const respuesta = await apiFetch<{ ok: boolean; challenge: DesafioSeguridad }>('/api/auth/challenge');
    if (!respuesta || !respuesta.challenge) return null;

    const nonce = await resolverDesafioPoW(respuesta.challenge);
    return {
      ...respuesta.challenge,
      nonce,
    };
  } catch (error) {
    console.warn('[auth] Error al obtener o resolver desafío de seguridad:', error);
    return null;
  }
}

/**
 * Inicia sesión mediante WhatsApp y PIN de 4 dígitos.
 * @param celular Número de WhatsApp de 10 dígitos
 * @param pin Código PIN asignado (ej. HNT-4821 o 4821)
 */
export async function iniciarSesionConPin(
  celular: string,
  pin: string
): Promise<{ ok: boolean; token?: string; user?: UserSession; error?: string }> {
  try {
    const retoResuelto = await obtenerDesafioResuelto();

    const payload: any = {
      action: 'login',
      celular: celular.replace(/[^\d]/g, ''),
      pin: pin.trim(),
    };

    if (retoResuelto) {
      payload.securityChallenge = retoResuelto;
    }

    const res = await apiFetch<{ ok: boolean; token: string; user: UserSession; error?: string }>(
      '/api/auth/session',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (res.ok && res.token) {
      localStorage.setItem('origgo_auth_jwt_token', res.token);
      localStorage.setItem('origgo_session_phone', res.user?.phone || celular);
      return { ok: true, token: res.token, user: res.user };
    }

    return { ok: false, error: res.error || 'Credenciales no válidas' };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Fallo de autenticación en el servidor' };
  }
}

/**
 * Reclama la acreditación de una sesión y créditos tras completar un pago en Wompi.
 * @param reference Referencia de la transacción de Wompi
 */
export async function reclamarReferenciaPago(
  reference: string
): Promise<{
  ok: boolean;
  token?: string;
  user?: UserSession;
  tempPin?: string;
  isNewUser?: boolean;
  error?: string;
  /** El pago se acreditó, pero la cuenta ya existía: hay que entrar con el PIN para verlo. */
  requiresLogin?: boolean;
  message?: string;
}> {
  try {
    const res = await apiFetch<{
      ok: boolean;
      token: string;
      user: UserSession;
      tempPin?: string;
      isNewUser?: boolean;
      error?: string;
      requiresLogin?: boolean;
      message?: string;
    }>('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'claim_reference',
        reference: reference.trim(),
      }),
    });

    if (res.ok && res.token) {
      localStorage.setItem('origgo_auth_jwt_token', res.token);
      if (res.user?.phone) {
        localStorage.setItem('origgo_session_phone', res.user.phone);
      }
      return res;
    }

    if (res.ok && res.requiresLogin) {
      return { ok: false, requiresLogin: true, message: res.message };
    }
    return { ok: false, error: res.error || 'No se pudo reclamar la orden de pago' };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Error al conectar con el ledger de pagos' };
  }
}

/**
 * Canjea un enlace de recuperación (?recovery_token=…) por una sesión. El servidor lo acepta
 * una sola vez y solo mientras está vigente.
 */
export async function recuperarSesionConEnlace(
  recoveryToken: string
): Promise<{ ok: boolean; token?: string; user?: UserSession; error?: string }> {
  try {
    const res = await apiFetch<{ ok: boolean; token?: string; user?: UserSession; message?: string; error?: string }>(
      '/api/auth/session',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recover_token', recoveryToken }),
      }
    );
    if (res.ok && res.token) {
      localStorage.setItem('origgo_auth_jwt_token', res.token);
      if (res.user?.phone) localStorage.setItem('origgo_session_phone', res.user.phone);
      return res;
    }
    return { ok: false, error: res.message || res.error || 'El enlace no es válido o ya se usó.' };
  } catch (err: any) {
    return { ok: false, error: err.message || 'El enlace no es válido o ya se usó.' };
  }
}

/**
 * Verifica si hay una sesión activa válida guardada en el navegador.
 */
export async function verificarSesionLocal(): Promise<{ authenticated: boolean; user?: UserSession }> {
  const token = localStorage.getItem('origgo_auth_jwt_token');
  if (!token) {
    return { authenticated: false };
  }

  try {
    const res = await apiFetch<{ authenticated: boolean; user?: UserSession }>('/api/auth/session', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.authenticated && res.user) {
      return { authenticated: true, user: { ...res.user, token } };
    }
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Cierra la sesión activa y limpia los registros locales.
 */
/**
 * Cierra la sesión en este navegador y borra TODO dato personal guardado: token, celular,
 * correo, créditos y los contactos desbloqueados (teléfonos de propietarios). Importante en
 * equipos compartidos: el siguiente usuario no debe ver nada del anterior.
 */
export function cerrarSesionLocal(): void {
  const CLAVES_PERSONALES = [
    'origgo_auth_jwt_token',
    'origgo_session_phone',
    'origgo_auth_phone',
    'origgo_auth_email',
    'origgo_user_credits_v1',
    'origgo_unlocked_leads_map',
    'origgo_pending_lead_id',
  ];
  try {
    CLAVES_PERSONALES.forEach((clave) => localStorage.removeItem(clave));
  } catch {}
}

/**
 * Obtiene o genera una huella digital determinista del dispositivo (DeviceId)
 * para prevención de ataques Sybil y multi-cuentas en regalos de bienvenida.
 */
export function obtenerDeviceId(): string {
  try {
    const almacenado = localStorage.getItem('origgo_device_fingerprint_v1');
    if (almacenado && almacenado.length >= 16) {
      return almacenado;
    }

    const componentes = [
      navigator.userAgent || '',
      navigator.language || '',
      screen.width + 'x' + screen.height,
      screen.colorDepth || '',
      new Date().getTimezoneOffset(),
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    ].join('###');

    // Generar hash simple determinista
    let hash = 0;
    for (let i = 0; i < componentes.length; i++) {
      hash = (hash << 5) - hash + componentes.charCodeAt(i);
      hash |= 0;
    }

    const fingerprint = 'dev_' + Math.abs(hash).toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    localStorage.setItem('origgo_device_fingerprint_v1', fingerprint);
    return fingerprint;
  } catch {
    return 'dev_anon_' + Date.now().toString(36);
  }
}

/**
 * Solicita el crédito de bienvenida ($0 COP) requiriendo Doble Opt-In por correo electrónico.
 */
export async function solicitarCreditoBienvenidaApi(params: {
  celular: string;
  email: string;
  leadId?: string;
  lang?: 'es' | 'en';
}): Promise<{
  ok: boolean;
  pendingVerification?: boolean;
  existingAccountWithCredits?: boolean;
  credits?: number;
  message?: string;
  error?: string;
  alreadyClaimed?: boolean;
}> {
  const deviceId = obtenerDeviceId();
  try {
    const res = await apiFetch<{
      ok: boolean;
      pendingVerification?: boolean;
      existingAccountWithCredits?: boolean;
      credits?: number;
      message?: string;
      error?: string;
      alreadyClaimed?: boolean;
    }>('/api/auth/welcome-credit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        celular: params.celular.replace(/[^\d]/g, ''),
        email: params.email.trim().toLowerCase(),
        deviceId,
        leadId: params.leadId,
        lang: params.lang || 'es',
      }),
    });
    return res;
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Error de conexión solicitando el crédito de bienvenida',
    };
  }
}

/**
 * Valida el token de verificación de bienvenida recibido en el enlace del correo electrónico.
 */
export async function verificarTokenBienvenidaApi(
  token: string,
  lang: 'es' | 'en' = 'es'
): Promise<{
  ok: boolean;
  token?: string;
  user?: UserSession;
  message?: string;
  error?: string;
}> {
  try {
    const res = await apiFetch<{
      ok: boolean;
      token?: string;
      user?: UserSession;
      message?: string;
      error?: string;
    }>('/api/auth/welcome-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token.trim(),
        lang,
      }),
    });

    if (res.ok && res.token) {
      localStorage.setItem('origgo_auth_jwt_token', res.token);
      if (res.user?.phone) {
        localStorage.setItem('origgo_session_phone', res.user.phone);
        localStorage.setItem('origgo_auth_phone', res.user.phone);
      }
      return res;
    }

    return { ok: false, error: res.error || 'Token de activación inválido o expirado' };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'No fue posible validar el token de activación',
    };
  }
}

/**
 * Solicita el reenvío del PIN de acceso y Magic Link al correo electrónico registrado.
 */
export async function recuperarPinPorEmailApi(
  email: string,
  lang: 'es' | 'en' = 'es'
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const res = await apiFetch<{ ok: boolean; message?: string; error?: string }>('/api/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        lang,
      }),
    });
    return res;
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Error solicitando recuperación de PIN',
    };
  }
}
