import { ArchitectureMetric, TestResultItem, LeadItem } from './types';
import rawData from '../public/data/inmobiliario.json';

export const INMUEBLES_DATA: LeadItem[] = ((rawData as unknown as { leads: LeadItem[] }).leads || []) as LeadItem[];


export const ARCHITECTURE_METRICS: ArchitectureMetric[] = [
  {
    title: 'Sistema de Build y Empaquetado',
    category: 'Ingeniería de Software',
    origgoCurrent: 'Script artesanal en Node.js que concatena cadenas de texto (modules/00 a 16) con regex.',
    industry2026: 'Vite / Turbopack / esbuild con compilación nativa en Rust/Go, Tree-Shaking y HMR.',
    ratingScore: 3.5,
    status: 'critical',
    recommendation: 'Migrar a Vite + ESM con import/export deterministas para evitar colisiones globales.'
  },
  {
    title: 'Estructura de Componentes UI & DOM',
    category: 'Frontend & Mantenibilidad',
    origgoCurrent: 'index.html monolítico (77 KB) manipulado mediante cadenas HTML e innerHTML mutable.',
    industry2026: 'Componentes reactivos tipados (React 19 / Astro / Vue) con CSS modular (Tailwind v4 / Shadcn).',
    ratingScore: 4.8,
    status: 'critical',
    recommendation: 'Extraer tarjetas, modales de Wompi y filtros en componentes reactivos aislados.'
  },
  {
    title: 'Gobernanza de Tipos & Detección de Errores',
    category: 'Seguridad en Tiempo de Compilación',
    origgoCurrent: 'JavaScript Vanilla sin tipado estricto en el frontend; validación Zod en endpoints API.',
    industry2026: 'TypeScript 5+ estricto end-to-end (tRPC / contratos Zod compartidos entre front y backend).',
    ratingScore: 5.2,
    status: 'critical',
    recommendation: 'Activar TypeScript (tsc --noEmit) como guardián en pre-commit para erradicar undefined.'
  },
  {
    title: 'Criptografía y Protección de Contactos',
    category: 'Seguridad y Privacidad',
    origgoCurrent: 'AES-256-GCM con rotación manual de claves y almacenamiento efímero en memoria volátil de JS.',
    industry2026: 'Row-Level Security (Postgres RLS en Supabase) + Vault Cloud KMS + JWT HttpOnly.',
    ratingScore: 8.5,
    status: 'superior',
    recommendation: 'Excelente ingenio de secreto comercial; migrar memoria volátil a Redis Upstash para soportar multi-instancias serverless.'
  },
  {
    title: 'Rendimiento y Tiempo de Carga (Core Web Vitals)',
    category: 'Experiencia de Usuario',
    origgoCurrent: 'Carga instantánea (<100ms), 0 dependencies runtime pesadas, View Transitions nativas aceleradas por GPU.',
    industry2026: 'Portales corporativos sobrecargados de scripts de analítica con 3-5s de First Contentful Paint.',
    ratingScore: 9.6,
    status: 'superior',
    recommendation: 'Preservar esta ligereza extrema; no sobrecargar con librerías pesadas al modernizar.'
  },
  {
    title: 'Costo de Infraestructura ($/Mes)',
    category: 'Finanzas y Operaciones (FinOps)',
    origgoCurrent: '$0 USD/mes usando Vercel Serverless Hobby, Firebase Free Tier y Wompi nativo.',
    industry2026: 'Altos costos en clústeres Kubernetes, Datadog y AWS RDS ($500 - $5,000 USD/mes).',
    ratingScore: 10.0,
    status: 'superior',
    recommendation: 'Mantener la arquitectura Free-Tier / Edge sin servidores fijos dedicados.'
  },
  {
    title: 'Búsqueda Geoespacial & Base de Datos',
    category: 'Datos y Escalabilidad',
    origgoCurrent: 'Dataset JSON local (150 leads) firmado con HMAC (.sig) + Firestore para balance de usuarios.',
    industry2026: 'PostgreSQL con PostGIS (búsqueda radial por coordenadas y mapas interactivos Mapbox).',
    ratingScore: 5.5,
    status: 'acceptable',
    recommendation: 'Apto para <500 inmuebles curados; para escalar a miles, migrar catálogo a Supabase PostGIS.'
  },
  {
    title: 'Resiliencia ante Ataques & DDoS',
    category: 'Ciberseguridad Defensiva',
    origgoCurrent: 'Prueba de Trabajo (Proof-of-Work) SHA-256 en cliente, rate limiting en memoria, Anti-Sybil.',
    industry2026: 'Cloudflare Bot Management + Turnstile Managed + WAF Edge distribuido.',
    ratingScore: 8.0,
    status: 'acceptable',
    recommendation: 'El PoW propio es muy creativo; complementarlo con Cloudflare Turnstile para reducir consumo de batería móvil.'
  }
];

export const INITIAL_TEST_RESULTS: TestResultItem[] = [
  {
    id: 't-1',
    category: 'Módulos JS Arquitectura (<500 líneas)',
    name: 'Auditoría Modular de 17 Submódulos',
    status: 'passed',
    durationMs: 42,
    detail: '17 submódulos verificados en /modules. Ninguno excede el umbral estricto de 500 líneas.'
  },
  {
    id: 't-2',
    category: 'CSS y Balance de Sintaxis',
    name: 'Compilación y Validación de Tokens CSS',
    status: 'passed',
    durationMs: 65,
    detail: '20 submódulos CSS compilados. 1,173 bloques balanceados y selectores críticos validados.'
  },
  {
    id: 't-3',
    category: 'Criptografía y Cifrado AES-256',
    name: 'Validación de Contratos de Datos y Cifrado',
    status: 'passed',
    durationMs: 98,
    detail: '150 propiedades verificadas con payloads iv:tag:cipher íntegros. Teléfonos ofuscados en reposo.'
  },
  {
    id: 't-4',
    category: 'Integración Wompi y Ledger',
    name: 'Prueba Unitaria de Pasarela e Idempotencia',
    status: 'passed',
    durationMs: 140,
    detail: 'Validación HMAC timingSafeEqual, balance atómico, prevención de replay y reclamos huérfanos.'
  },
  {
    id: 't-5',
    category: 'Auditoría Antifraude en Reclamos',
    name: 'Claim Reference Fraud Detection',
    status: 'passed',
    durationMs: 80,
    detail: 'Referencias falsificadas o reutilizadas devuelven HTTP 404/409 de forma determinista.'
  },
  {
    id: 't-6',
    category: 'Seguridad de Autenticación',
    name: 'Erradicación de Bypass de PIN y Brute-Force',
    status: 'passed',
    durationMs: 110,
    detail: 'Bloqueo tras 5 intentos erróneos, claims mínimos en JWT y eliminación de llaves maestras.'
  },
  {
    id: 't-7',
    category: 'TypeScript & Typecheck',
    name: 'Verificación Estricta de Tipos (tsc --noEmit)',
    status: 'passed',
    durationMs: 310,
    detail: 'Modelos tipados en TypeScript 2026 sin fugas de tipo any ni discrepancias de propiedades.'
  }
];
