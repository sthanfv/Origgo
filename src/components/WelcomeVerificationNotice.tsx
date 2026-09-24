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
      className="welcome-verification-card"
      style={{
        textAlign: 'center',
        padding: '1.75rem 1.25rem',
        background: 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.15) 0%, rgba(6, 26, 20, 0.75) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.35)',
        borderRadius: 18,
        marginBottom: 12,
        boxShadow: '0 12px 30px -8px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.2)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          boxShadow: '0 0 16px rgba(16, 185, 129, 0.25)',
        }}
      >
        <i className="fa-regular fa-envelope-open" style={{ fontSize: '1.6rem', color: 'var(--accent-emerald)' }}></i>
      </div>

      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
        {isEn ? 'Verification Link Sent!' : '¡Enlace de Activación Enviado!'}
      </h3>

      <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 auto 12px auto', maxWidth: 380 }}>
        {isEn
          ? 'We sent a 1-click activation link and your security PIN to:'
          : 'Enviamos un enlace de activación de 1 clic y tu PIN de seguridad a:'}
      </p>

      <div
        style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          padding: '8px 16px',
          borderRadius: 9999,
          fontWeight: 800,
          color: 'var(--accent-emerald)',
          fontSize: '0.92rem',
          marginBottom: 14,
          display: 'inline-block',
          wordBreak: 'break-all',
          letterSpacing: '0.02em',
        }}
      >
        {emailInput}
      </div>

      <p style={{ fontSize: '0.76rem', color: 'var(--text-dim)', lineHeight: 1.45, margin: '0 auto 18px auto', maxWidth: 420 }}>
        {isEn
          ? '🔒 Open the email on this device and click the button to activate your 1 free unlock immediately.'
          : '🔒 Abre el correo en este dispositivo y toca el botón para activar tu crédito de cortesía y ver al propietario de inmediato.'}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
          width: '100%',
        }}
      >
        <button
          type="button"
          className="btn-modal-back"
          style={{
            margin: 0,
            height: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: '0.82rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
          onClick={onBack}
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span>{isEn ? 'Change Email / Phone' : 'Corregir Datos'}</span>
        </button>

        <button
          type="button"
          className="btn-confirm-wompi"
          style={{
            margin: 0,
            height: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: '0.82rem',
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
          onClick={onResend}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <i className="fa-solid fa-circle-notch fa-spin"></i>
              <span>{isEn ? 'Sending...' : 'Reenviando...'}</span>
            </>
          ) : (
            <>
              <i className="fa-solid fa-paper-plane"></i>
              <span>{isEn ? 'Resend Link' : 'Reenviar Enlace'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
