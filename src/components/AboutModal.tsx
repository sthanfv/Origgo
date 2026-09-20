import React from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLegal: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  onOpenLegal,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="modal-backdrop active" 
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="modal-card" 
        style={{ maxWidth: 620, width: '92%', maxHeight: '88vh', overflowY: 'auto', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-emerald-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-emerald)' }}>
              <i className="fa-solid fa-circle-question" style={{ fontSize: '1.2rem' }}></i>
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                ¿Qué es Origgo?
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Terminal de Inteligencia y Conexión Directa en Colombia
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-modal-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }} 
            aria-label="Cerrar modal"
            style={{ position: 'relative', top: 'auto', right: 'auto' }}
          >
            <i className="fa-solid fa-xmark" style={{ pointerEvents: 'none' }}></i>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--bg-surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-emerald)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fa-solid fa-handshake"></i> 1. Trato 100% Directo con el Propietario
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              Origgo monitorea fuentes públicas en tiempo real para extraer exclusivamente propiedades publicadas por sus propios dueños. Elimina intermediarios y ahorra las comisiones de agencia (entre 3% y 6%).
            </p>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-emerald)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fa-solid fa-satellite-dish"></i> 2. Detección Temprana y Arbitraje
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              Nuestro algoritmo calcula la mediana de precio por m² de cada sector y clasifica rebajas urgentes y oportunidades bajo precio de mercado para inversores y compradores.
            </p>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: 14, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-emerald)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fa-solid fa-shield-halved"></i> 3. Transparencia y Diligencia Legal
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              Origgo no cobra comisiones de corretaje ni interviene en la negociación o firma de escrituras. Siempre recomendamos verificar el Certificado de Tradición y Libertad del predio.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
          <button 
            type="button" 
            onClick={() => {
              onClose();
              onOpenLegal();
            }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-emerald)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <i className="fa-solid fa-scale-balanced"></i> Ver Términos Legales Completos
          </button>

          <button 
            type="button" 
            className="btn-confirm-wompi"
            onClick={onClose}
            style={{ width: 'auto', padding: '8px 18px', fontSize: '0.85rem' }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
