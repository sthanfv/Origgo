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
