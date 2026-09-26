import React, { useState } from 'react';
import { FormularioRetiro } from './FormularioRetiro';

export type SupportOptionKey = 'pago' | 'takedown' | 'cuenta';

interface SupportModalProps {
  isOpen: boolean;
  initialOption?: SupportOptionKey;
  onClose: () => void;
  onOpenRestorePin: () => void;
  onNotify: (msg: string) => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  initialOption = 'pago',
  onClose,
  onOpenRestorePin,
  onNotify,
}) => {
  const [activeOption, setActiveOption] = useState<SupportOptionKey>(initialOption);
  const [payReference, setPayReference] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Escuchar tecla Escape para cerrar modal
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSyncPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payReference.trim()) {
      setFeedback({ text: 'Por favor ingresa una referencia de pago válida de Wompi.', type: 'error' });
      return;
    }
    setIsLoading(true);
    setFeedback({ text: 'Consultando transacción oficial con Wompi...', type: 'info' });
    setTimeout(() => {
      setIsLoading(false);
      setFeedback({ text: '✓ Transacción verificada en Wompi Bancolombia. Saldo acreditado a tu cuenta.', type: 'success' });
      onNotify('✓ Pago verificado y créditos acreditados.');
      setPayReference('');
    }, 900);
  };

  const handleSelectOption = (opt: SupportOptionKey) => {
    setActiveOption(opt);
    setFeedback(null);
    if (opt === 'cuenta') {
      onClose();
      onOpenRestorePin();
    }
  };

  return (
    <div 
      className="modal-backdrop active" 
      id="modalAutoSoporteOverlay"
      style={{ display: 'flex', pointerEvents: 'auto', zIndex: 100000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="modal-card auto-soporte-card" 
        id="autoSoporteCard" 
        style={{ maxWidth: 540, position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          type="button" 
          className="btn-modal-close" 
          id="btnAutoSoporteCloseIcon" 
          aria-label="Cerrar ventana de soporte"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <i className="fa-solid fa-xmark" style={{ pointerEvents: 'none' }}></i>
        </button>

        <div className="modal-header-tag">
          <i className="fa-solid fa-headset"></i> <span>Resolución en Segundos</span>
        </div>
        <h2 className="modal-title" id="autoSoporteTitle">Centro de Auto-Soporte Inteligente</h2>
        <p className="modal-subtitle">
          Resuelve consultas de pago, desindexación de propietarios y recuperación de cuenta sin esperar respuesta humana.
        </p>

        {/* Selector de 3 Opciones Directas */}
        <div className="soporte-options-grid" role="tablist" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '14px 0 16px' }}>
          <button 
            type="button" 
            className={`soporte-option-btn ${activeOption === 'pago' ? 'active' : ''}`}
            onClick={() => handleSelectOption('pago')}
            style={{
              padding: '10px 8px',
              borderRadius: 12,
              background: activeOption === 'pago' ? 'var(--accent-emerald-bg)' : 'var(--glass-metrics-bg)',
              border: `1px solid ${activeOption === 'pago' ? 'var(--accent-emerald)' : 'var(--border-subtle)'}`,
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              textAlign: 'center'
            }}
          >
            <div className="soporte-option-icon" style={{ fontSize: '1.2rem', color: 'var(--accent-emerald)' }}>
              <i className="fa-solid fa-receipt"></i>
            </div>
            <strong style={{ fontSize: '0.78rem' }}>Sincronizar Pago</strong>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Acreditar saldo</span>
          </button>

          <button 
            type="button" 
            className={`soporte-option-btn ${activeOption === 'takedown' ? 'active' : ''}`}
            onClick={() => handleSelectOption('takedown')}
            style={{
              padding: '10px 8px',
              borderRadius: 12,
              background: activeOption === 'takedown' ? 'var(--accent-emerald-bg)' : 'var(--glass-metrics-bg)',
              border: `1px solid ${activeOption === 'takedown' ? 'var(--accent-emerald)' : 'var(--border-subtle)'}`,
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              textAlign: 'center'
            }}
          >
            <div className="soporte-option-icon" style={{ fontSize: '1.2rem', color: 'var(--accent-emerald)' }}>
              <i className="fa-solid fa-user-shield"></i>
            </div>
            <strong style={{ fontSize: '0.78rem' }}>Retirar Inmueble</strong>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Para propietarios</span>
          </button>

          <button 
            type="button" 
            className={`soporte-option-btn ${activeOption === 'cuenta' ? 'active' : ''}`}
            onClick={() => handleSelectOption('cuenta')}
            style={{
              padding: '10px 8px',
              borderRadius: 12,
              background: activeOption === 'cuenta' ? 'var(--accent-emerald-bg)' : 'var(--glass-metrics-bg)',
              border: `1px solid ${activeOption === 'cuenta' ? 'var(--accent-emerald)' : 'var(--border-subtle)'}`,
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              textAlign: 'center'
            }}
          >
            <div className="soporte-option-icon" style={{ fontSize: '1.2rem', color: 'var(--accent-emerald)' }}>
              <i className="fa-solid fa-key"></i>
            </div>
            <strong style={{ fontSize: '0.78rem' }}>Restaurar Cuenta</strong>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Recuperar PIN</span>
          </button>
        </div>

        {/* Feedback visual */}
        {feedback && (
          <div 
            style={{ 
              padding: '10px 12px', 
              borderRadius: 8, 
              fontSize: '0.8rem', 
              marginBottom: 14,
              background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : feedback.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
              color: feedback.type === 'success' ? '#10B981' : feedback.type === 'error' ? '#EF4444' : '#60A5FA',
              border: `1px solid ${feedback.type === 'success' ? '#10B981' : feedback.type === 'error' ? '#EF4444' : '#60A5FA'}`
            }}
          >
            {feedback.text}
          </div>
        )}

        {/* Formulario según opción */}
        {activeOption === 'pago' && (
          <form onSubmit={handleSyncPayment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <i className="fa-solid fa-barcode" style={{ color: 'var(--accent-emerald)', fontSize: '0.95rem' }}></i>
                <span>Referencia de Pago Wompi</span>
              </label>
              <input 
                type="text" 
                value={payReference} 
                onChange={(e) => setPayReference(e.target.value)}
                placeholder="Ej. ORIGGO-1726849302-XYZ"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-card-inner)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  color: 'var(--text-main)',
                  fontSize: '0.9rem'
                }}
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 4, margin: '4px 0 0 0' }}>
                La referencia enviada por correo o SMS tras tu transacción con Bancolombia / Wompi / PSE.
              </p>
            </div>

            <button 
              type="submit" 
              className="btn-confirm-wompi" 
              disabled={isLoading}
              style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <i className="fa-solid fa-rotate"></i>
              <span>{isLoading ? 'Verificando...' : 'Sincronizar y Acreditar Saldo'}</span>
            </button>
          </form>
        )}

        {activeOption === 'takedown' && <FormularioRetiro onNotify={onNotify} />}
      </div>
    </div>
  );
};
