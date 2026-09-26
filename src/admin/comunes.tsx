import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Piezas comunes del panel (sistema de diseño): hoja de detalle, etiqueta de estado y formatos.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PeticionPanel = (ruta: string, opciones?: RequestInit) => Promise<any>;

export const pesos = (centavos: number) =>
  (centavos / 100).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });

export const fechaCorta = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

export const fechaHora = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('es-CO', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

type Tono = 'verde' | 'dorado' | 'rojo' | 'tenue';

export function Etiqueta({ tono, children }: { tono: Tono; children: ReactNode }) {
  return <span className={`adm-etiqueta adm-etiqueta-${tono}`}>{children}</span>;
}

/**
 * Hoja de detalle: en el teléfono sube desde abajo y ocupa la pantalla; en el computador se
 * abre a la derecha. Se cierra con la X, con Escape o tocando el fondo.
 */
export function Hoja({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTecla);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alTecla);
      document.body.style.overflow = '';
    };
  }, [onCerrar]);

  return (
    <div className="adm-hoja-fondo" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <section className="adm-hoja" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="adm-hoja-cabecera">
          <h2>{titulo}</h2>
          <button className="adm-icono-btn" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="adm-hoja-cuerpo">{children}</div>
      </section>
    </div>
  );
}

/** Fila "dato: valor" de una ficha. */
export function Dato({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <div className="adm-dato">
      <span>{nombre}</span>
      <strong>{children}</strong>
    </div>
  );
}

/** Estados de las órdenes de Wompi, en español. */
export const ESTADOS_ORDEN: Record<
  string,
  { texto: string; tono: 'verde' | 'dorado' | 'rojo' | 'tenue' }
> = {
  PENDING: { texto: 'Pendiente', tono: 'dorado' },
  APPROVED: { texto: 'Aprobado', tono: 'verde' },
  DECLINED: { texto: 'Rechazado', tono: 'rojo' },
  VOIDED: { texto: 'Anulado', tono: 'tenue' },
  EXPIRED: { texto: 'Vencido', tono: 'tenue' },
  FRAUD_SUSPECT: { texto: 'Sospecha de fraude', tono: 'rojo' },
};

export function EtiquetaEstado({ estado }: { estado: string }) {
  const e = ESTADOS_ORDEN[estado] || { texto: estado, tono: 'tenue' as const };
  return <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>;
}
