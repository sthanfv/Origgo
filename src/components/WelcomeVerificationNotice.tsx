import React from 'react';

interface WelcomeVerificationNoticeProps {
  emailInput: string;
  isEn: boolean;
  isLoading: boolean;
  onBack: () => void;
  onResend: () => void;
}

/**
 * Sub-estado visual informativo tras solicitar el crédito de cortesía de bienvenida.
 * Notifica al usuario que debe revisar su bandeja de entrada para activar con 1 clic.
 */
export const WelcomeVerificationNotice: React.FC<WelcomeVerificationNoticeProps> = ({
  emailInput,
  isEn,
  isLoading,
  onBack,
  onResend,
}) => {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '1.5rem 1rem',
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid var(--accent-emerald)',
        borderRadius: 14,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.2)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <i className="fa-regular fa-envelope-open" style={{ fontSize: '1.8rem', color: 'var(--accent-emerald)' }}></i>
      </div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>
        {isEn ? 'Verification Link Sent!' : '¡Enlace de Activación Enviado!'}
      </h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 auto 12px auto', maxWidth: 380 }}>
        {isEn
          ? 'We sent a 1-click activation link and your security PIN to:'
          : 'Enviamos un enlace de activación de 1 clic y tu PIN de seguridad a:'}
      </p>
      <div
        style={{
          background: 'var(--bg-card-inner, rgba(0,0,0,0.3))',
          border: '1px solid var(--border-subtle)',
          padding: '8px 12px',
          borderRadius: 8,
          fontWeight: 800,
          color: 'var(--accent-emerald)',
          fontSize: '0.9rem',
          marginBottom: 14,
          display: 'inline-block',
        }}
      >
        {emailInput}
      </div>
      <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', lineHeight: 1.4, margin: '0 auto 16px auto' }}>
        {isEn
          ? '🔒 Open the email on this device and click the button to activate your 1 free unlock immediately.'
          : '🔒 Abre el correo en este dispositivo y toca el botón para activar tu crédito de cortesía y ver al propietario de inmediato.'}
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button
          type="button"
          className="btn-modal-back"
          style={{ marginTop: 0 }}
          onClick={onBack}
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span>{isEn ? 'Change Email / Phone' : 'Corregir Datos'}</span>
        </button>
        <button
          type="button"
          className="btn-confirm-wompi"
          style={{ marginBottom: 0, padding: '0.6rem 1rem', width: 'auto' }}
          onClick={onResend}
          disabled={isLoading}
        >
          <i className="fa-solid fa-paper-plane"></i>
          <span>{isEn ? 'Resend' : 'Reenviar Enlace'}</span>
        </button>
      </div>
    </div>
  );
};
