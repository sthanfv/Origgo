/**
 * 🔓 SERVICIO DE DESBLOQUEO CRIPTOGRÁFICO DE LEADS
 * Origgo Intelligence — Adaptador React / Vite
 * 
 * Gestiona el consumo atómico de créditos y el descifrado seguro
 * en memoria de contactos de propietarios directos mediante AES-256-GCM.
 */

import { apiFetch, generarUUIDv4 } from './api';
import { LeadItem, UnlockedContactInfo } from '../types';

/** Resultado de la operación de desbloqueo */
export interface ResultadoDesbloqueo {
  ok: boolean;
  leadId?: string;
  contacto?: UnlockedContactInfo;
  nuevoBalance?: number;
  error?: string;
  codigoError?: 'CREDITOS_INSUFICIENTES' | 'PLAN_CIUDAD_DIFERENTE' | 'CUOTA_EXCEDIDA' | 'NO_AUTENTICADO' | 'ERROR_SERVIDOR';
}

/**
 * Solicita al backend el descifrado del contacto de un propietario directo.
 * @param lead Inmueble a desbloquear
 * @param token Token JWT del usuario activo
 * @param lang Idioma preferido ('es' o 'en')
 */
export async function desbloquearLeadApi(
  lead: LeadItem,
  token: string,
  lang: 'es' | 'en' = 'es'
): Promise<ResultadoDesbloqueo> {
  if (!token) {
    return {
      ok: false,
      codigoError: 'NO_AUTENTICADO',
      error: lang === 'en' ? 'Authentication required to unlock' : 'Debes iniciar sesión para desbloquear',
    };
  }

  try {
    const respuesta = await apiFetch<{
      ok: boolean;
      leadId: string;
      contacto: {
        telefono: string;
        telefonoDisplay: string;
        telLlamar: string;
        enlace?: string;
        portal?: string;
      };
      datosRevelados?: {
        tituloOriginal?: string;
        ubicacionCompleta?: string;
      };
      siguientesPasos?: Array<{ paso: string; detalle: string }>;
      nuevoBalance?: number;
      error?: string;
    }>(
      '/api/leads/unlock',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': generarUUIDv4(),
        },
        body: JSON.stringify({
          leadId: lead.id,
          contactoCifrado: lead.contacto_cifrado || '',
          leadCity: lead.ciudad || lead.ubicacion || lead.barrio || '',
          lang,
        }),
      },
      { maxReintentos: 1, timeoutMs: 9000 }
    );

    if (respuesta.ok && respuesta.contacto) {
      const contactoCompleto: UnlockedContactInfo = {
        telefono: respuesta.contacto.telefono,
        telefonoDisplay: respuesta.contacto.telefonoDisplay,
        telLlamar: respuesta.contacto.telLlamar,
        enlace: respuesta.contacto.enlace,
        portal: respuesta.contacto.portal,
        tituloOriginal: respuesta.datosRevelados?.tituloOriginal,
        ubicacionCompleta: respuesta.datosRevelados?.ubicacionCompleta,
        siguientesPasos: respuesta.siguientesPasos,
      };

      return {
        ok: true,
        leadId: respuesta.leadId,
        contacto: contactoCompleto,
        nuevoBalance: (respuesta as any).creditsRemaining ?? respuesta.nuevoBalance,
      };
    }

    return {
      ok: false,
      error: respuesta.error || 'No fue posible descifrar el contacto',
      codigoError: 'ERROR_SERVIDOR',
    };
  } catch (err: any) {
    const status = err?.status;
    const msg = err?.message || '';

    if (status === 402 || msg.includes('402') || msg.includes('insuficientes')) {
      return {
        ok: false,
        codigoError: 'CREDITOS_INSUFICIENTES',
        error: lang === 'en' ? 'Insufficient credits in account' : 'Saldo de créditos insuficiente',
      };
    }

    if (status === 403 && (msg.includes('CIUDAD') || msg.includes('ciudad'))) {
      return {
        ok: false,
        codigoError: 'PLAN_CIUDAD_DIFERENTE',
        error: lang === 'en' ? 'Your active plan does not cover this city' : 'Tu membresía no cubre esta ciudad',
      };
    }

    if (status === 429 || msg.includes('429') || msg.includes('CUOTA')) {
      return {
        ok: false,
        codigoError: 'CUOTA_EXCEDIDA',
        error: lang === 'en' ? 'Daily fair usage quota reached' : 'Cuota de uso justo diaria alcanzada',
      };
    }

    return {
      ok: false,
      codigoError: 'ERROR_SERVIDOR',
      error: msg || 'Error de conexión con el servidor',
    };
  }
}
