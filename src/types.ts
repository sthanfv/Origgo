export interface LeadItem {
  id: string;
  titulo: string;
  titulo_en?: string;
  ubicacion: string;
  ciudad: string;
  barrio: string;
  tipo_operacion: 'venta' | 'arriendo' | string;
  tipo_inmueble: string;
  tipo_inmueble_en?: string;
  imagen: string;
  imagenes?: string[];
  dato_1?: string;
  dato_2?: string;
  precio_m2?: string;
  precio: string;
  precio_raw?: number;
  precio_usd?: number;
  rebaja?: string;
  ahorro_spread?: string;
  spread_arbitraje?: string;
  urgencia?: string;
  urgencia_en?: string;
  urgencia_tipo?: string;
  descuento_arbitraje?: number;
  mediana_sector_m2?: string;
  dias_en_mercado?: number;
  senales_urgencia?: string[];
  timestamp_ms?: number;
  fecha_relativa?: string;
  portal?: string;
  telefono_bloqueado?: string;
  enlace_bloqueado?: string;
  contacto_cifrado?: string;
  detalles?: string;
  detalles_en?: string;
  // Estado de desbloqueo en tiempo de ejecución
  unlocked?: boolean;
  unlockedPhone?: string;
  unlockedContactName?: string;
  unlockedPortal?: string;
  unlockedLink?: string;
  unlockedRealTitle?: string;
  unlockedRealLocation?: string;
}

/** Sesión de usuario autenticado en la plataforma */
export interface UserSession {
  phone: string;
  email?: string | null;
  credits: number;
  plan?: string;
  planCity?: string;
  planExpiresAt?: string | null;
  unlockedLeads?: string[];
  token?: string;
  verified?: boolean;
}

/** Información revelada de un propietario directo tras desbloqueo */
export interface UnlockedContactInfo {
  telefono?: string;
  telefonoDisplay?: string;
  telLlamar?: string;
  enlace?: string;
  portal?: string;
  tituloOriginal?: string;
  ubicacionCompleta?: string;
  siguientesPasos?: Array<{ paso: string; detalle: string }>;
}

export interface CatalogConfig {
  titulo_modulo: string;
  subtitulo: string;
  columna_variable_1: string;
  columna_variable_2: string;
  precio_membresia_cop: number;
  total_sectores_monitoreados: number;
  actualizado_en: string;
}

export interface FilterState {
  ciudad: string;
  tipoOperacion: 'todos' | 'venta' | 'arriendo';
  busqueda: string;
  soloRebajas: boolean;
  soloArbitraje: boolean;
  rangoPrecioMax: number;
}

export interface TestResultItem {
  id: string;
  category: string;
  name: string;
  status: 'passed' | 'failed' | 'warning';
  durationMs: number;
  detail: string;
}

export interface ArchitectureMetric {
  title: string;
  category: string;
  origgoCurrent: string;
  industry2026: string;
  ratingScore: number; // 0-10
  status: 'critical' | 'acceptable' | 'superior';
  recommendation: string;
}
