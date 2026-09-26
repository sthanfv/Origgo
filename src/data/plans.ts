import { ProductTypeId } from '../services/wompi';

export type ModalPlanOption = ProductTypeId | 'welcome_free';

export interface PlanOptionItem {
  id: ModalPlanOption;
  nameEs: string;
  nameEn: string;
  price: string;
  period?: string;
  descEs: string;
  descEn: string;
  ribbon?: { text: string; bg?: string };
}

export const MODAL_PLANS: PlanOptionItem[] = [
  {
    id: 'welcome_free',
    nameEs: '1 Desbloqueo Gratis',
    nameEn: '1 Free Unlock',
    price: '$ 0',
    descEs: '1 contacto verificado de regalo. Pruébalo sin costo.',
    descEn: '1 verified direct owner contact. Try it at zero cost.',
    ribbon: { text: '🎁 BIENVENIDA (GRATIS)', bg: '#059669' },
  },
  {
    id: 'single_lead',
    nameEs: 'Desbloqueo Individual',
    nameEn: 'Single Unlock',
    price: '$ 5.000',
    descEs: '1 contacto verificado directo del dueño. Pago puntual.',
    descEn: '1 verified contact directly from the owner. Single purchase.',
  },
  {
    id: 'pack_10_leads',
    nameEs: 'Bolsa 10 Contactos',
    nameEn: '10 Contacts Pack',
    price: '$ 35.000',
    descEs: '$3.500 por contacto. Créditos sin vencimiento.',
    descEn: '$3,500 per lead. Credits never expire.',
    ribbon: { text: '⭐ MÁS POPULAR (-30%)' },
  },
  {
    id: 'subscription_city',
    nameEs: 'Plan Pro Ciudad',
    nameEn: 'City Pro Plan',
    price: '$ 89.000',
    period: '/ mes',
    descEs: '30 días ilimitados para propietarios directos de tu ciudad.',
    descEn: '30 days unlimited access to direct owners in your city.',
  },
  {
    id: 'subscription_national',
    nameEs: 'Plan Nacional VIP',
    nameEn: 'National VIP Plan',
    price: '$ 149.000',
    period: '/ mes',
    descEs: 'Acceso total en toda Colombia + radar de rebajas.',
    descEn: 'Total Colombia coverage + exclusive price drop alerts.',
  },
];

/** Precios públicos que llegan del panel (api/leads/list.js → publico.precios). */
export type PreciosPublicos = Partial<
  Record<ProductTypeId, { montoCentavos: number; creditos: number; dias: number }>
>;

/** "$ 35.000" (es) o "$35,000" (en) a partir de centavos. */
export function formatoPrecio(centavos: number, isEn = false): string {
  const pesos = Math.round(centavos / 100);
  return isEn ? `$${pesos.toLocaleString('en-US')}` : `$ ${pesos.toLocaleString('es-CO')}`;
}

/**
 * Planes con los precios vigentes del panel. Si no llegan (sin conexión), se usan los escritos
 * arriba como respaldo.
 */
export function planesConPrecios(precios?: PreciosPublicos | null): PlanOptionItem[] {
  if (!precios) return MODAL_PLANS;
  return MODAL_PLANS.map((plan) => {
    const p = plan.id === 'welcome_free' ? undefined : precios[plan.id];
    if (!p) return plan;
    const actualizado: PlanOptionItem = { ...plan, price: formatoPrecio(p.montoCentavos) };
    if (plan.id === 'pack_10_leads' && p.creditos > 0) {
      const porContacto = Math.round(p.montoCentavos / p.creditos / 100).toLocaleString('es-CO');
      actualizado.nameEs = `Bolsa ${p.creditos} Contactos`;
      actualizado.nameEn = `${p.creditos} Contacts Pack`;
      actualizado.descEs = `$${porContacto} por contacto. Créditos sin vencimiento.`;
      actualizado.descEn = `$${porContacto} per lead. Credits never expire.`;
    }
    if (
      (plan.id === 'subscription_city' || plan.id === 'subscription_national') &&
      p.dias &&
      p.dias !== 30
    ) {
      actualizado.period = `/ ${p.dias} días`;
    }
    return actualizado;
  });
}
