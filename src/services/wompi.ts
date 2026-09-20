/**
 * 💳 SERVICIO DE PASARELA DE PAGOS WOMPI
 * Origgo Intelligence — Adaptador React / Vite
 * 
 * Gestiona la carga dinámica del SDK Wompi Widget, la creación criptográfica
 * de órdenes con firma de integridad SHA-256 y la conciliación post-pago.
 */

import { apiFetch, generarUUIDv4 } from './api';

export type ProductTypeId = 'single_lead' | 'pack_10_leads' | 'subscription_city' | 'subscription_national';

export interface ParametrosOrdenWompi {
  productType: ProductTypeId;
  celular: string;
  ciudad?: string;
  lang?: 'es' | 'en';
}

export interface RespuestaOrdenWompi {
  ok: boolean;
  reference: string;
  amountInCents: number;
  currency: string;
  publicKey: string;
  signature?: string;
  integritySignature?: string;
  productName: string;
  redirectUrl?: string;
  error?: string;
}

let wompiScriptPromesa: Promise<boolean> | null = null;

/**
 * Carga de forma asíncrona y segura el script oficial del widget de Wompi.
 */
export function cargarScriptWompi(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as any).WidgetCheckout) return Promise.resolve(true);

  if (wompiScriptPromesa) return wompiScriptPromesa;

  wompiScriptPromesa = new Promise((resolve) => {
    const scriptExistente = document.getElementById('wompi-widget-script');
    if (scriptExistente) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'wompi-widget-script';
    script.src = 'https://checkout.wompi.co/widget.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('[wompi] No se pudo cargar el script del widget desde el CDN.');
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return wompiScriptPromesa;
}

/**
 * Crea una orden de pago en el backend y obtiene la firma HMAC-SHA256 requerida.
 */
export async function crearOrdenPagoBackend(
  parametros: ParametrosOrdenWompi
): Promise<RespuestaOrdenWompi> {
  const { productType, celular, ciudad = 'Bogota', lang = 'es' } = parametros;

  return await apiFetch<RespuestaOrdenWompi>(
    '/api/payments/create-order',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': generarUUIDv4(),
      },
      body: JSON.stringify({
        productType,
        celular: celular.replace(/[^\d]/g, ''),
        ciudad,
        lang,
      }),
    },
    { maxReintentos: 1, timeoutMs: 10000 }
  );
}

/**
 * Abre el modal de checkout oficial de Wompi y escucha el resultado de la transacción.
 */
export async function desplegarWidgetWompi(
  orden: RespuestaOrdenWompi,
  onFinish: (resultado: { reference: string; status: 'APPROVED' | 'DECLINED' | 'ERROR' | 'CLOSED' }) => void
): Promise<void> {
  const scriptCargado = await cargarScriptWompi();
  if (!scriptCargado || !(window as any).WidgetCheckout) {
    throw new Error('El script de Wompi no está disponible en este momento');
  }

  const checkout = new (window as any).WidgetCheckout({
    currency: orden.currency || 'COP',
    amountInCents: orden.amountInCents,
    reference: orden.reference,
    publicKey: orden.publicKey,
    signature: {
      integrity: orden.signature || orden.integritySignature || '',
    },
    redirectUrl: orden.redirectUrl || window.location.origin,
  });

  checkout.open((result: any) => {
    const transaction = result?.transaction;
    const status = transaction?.status || 'CLOSED';
    onFinish({
      reference: orden.reference,
      status: status === 'APPROVED' ? 'APPROVED' : status === 'DECLINED' ? 'DECLINED' : 'CLOSED',
    });
  });
}
