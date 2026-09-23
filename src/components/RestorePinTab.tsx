import React from 'react';

interface RestorePinTabProps {
  phoneInput: string;
  setPhoneInput: (val: string) => void;
  pinInput: string;
  setPinInput: (val: string) => void;
  isLoading: boolean;
  isRecoverPinOpen: boolean;
  setIsRecoverPinOpen: (val: boolean) => void;
  recoverEmailInput: string;
  setRecoverEmailInput: (val: string) => void;
  handleRestorePin: (e: React.FormEvent) => void;
  handleRecuperarPin: (e?: React.SyntheticEvent) => void;
  renderStatusAlert: () => React.ReactNode;
  onClose: () => void;
  setErrorMessage: (val: string | null) => void;
  setSuccessMessage: (val: string | null) => void;
  isEn: boolean;
}

/**
 * Pestaña modular para inicio de sesión por PIN o referencia Wompi,
 * y recuperación segura de PIN vía correo electrónico.
 */
export const RestorePinTab: React.FC<RestorePinTabProps> = ({
  phoneInput,
  setPhoneInput,
  pinInput,
  setPinInput,
  isLoading,
  isRecoverPinOpen,
  setIsRecoverPinOpen,
  recoverEmailInput,
  setRecoverEmailInput,
  handleRestorePin,
  handleRecuperarPin,
  renderStatusAlert,
  onClose,
  setErrorMessage,
  setSuccessMessage,
  isEn,
}) => {
  return (
    <form onSubmit={handleRestorePin}>
      <div className="checkout-form-group">
        <label className="checkout-form-label">
          <i className="fa-brands fa-whatsapp" style={{ color: '#22C55E' }}></i>
          <span>{isEn ? 'Registered WhatsApp:' : 'WhatsApp Registrado:'}</span>
        </label>
        <div className="checkout-input-wrapper">
          <span className="checkout-input-prefix">+57</span>
          <input
            type="tel"
            className="checkout-text-input"
            placeholder={isEn ? 'e.g. 300 123 4567' : 'Ej: 300 123 4567'}
            value={phoneInput}
            maxLength={10}
            onChange={(e) => {
              setPhoneInput(e.target.value.replace(/[^\d]/g, ''));
              setErrorMessage(null);
            }}
          />
        </div>
      </div>

      <div className="checkout-form-group">
        <label className="checkout-form-label">
          <i className="fa-solid fa-key" style={{ color: 'var(--accent-emerald)' }}></i>
          <span>{isEn ? 'Access PIN or Wompi Ref:' : 'Código de Acceso (PIN) o Ref. Wompi:'}</span>
        </label>
        <div className="checkout-input-wrapper">
          <input
            type="text"
            className="checkout-text-input"
            placeholder="Ej: 7492 o Ref. de pago"
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value);
              setErrorMessage(null);
            }}
            style={{ textAlign: 'center', letterSpacing: '0.15em', fontSize: '1.05rem' }}
          />
        </div>
        <span className="checkout-input-help">
          {isEn
            ? 'Verifies your PIN cryptographically against Google Cloud Firestore.'
            : 'Valida tu PIN criptográficamente contra Google Cloud Firestore.'}
        </span>
      </div>

      {/* Sub-bloque: Recuperación de PIN si se le olvidó */}
      <div style={{ textAlign: 'right', margin: '4px 0 12px 0' }}>
        <button
          type="button"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-emerald)',
            fontSize: '0.76rem',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
          }}
          onClick={() => {
            setIsRecoverPinOpen(!isRecoverPinOpen);
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
        >
          {isEn ? 'Forgot your PIN? Recover by email' : '¿Olvidaste tu PIN? Recupéralo por correo'}
        </button>
      </div>

      {isRecoverPinOpen && (
        <div
          style={{
            background: 'var(--bg-card-inner, rgba(0,0,0,0.3))',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '12px',
            marginBottom: 14,
          }}
        >
          <label className="checkout-form-label" style={{ fontSize: '0.76rem' }}>
            <i className="fa-regular fa-envelope" style={{ color: 'var(--accent-emerald)' }}></i>
            <span>{isEn ? 'Enter your registered email:' : 'Ingresa tu correo registrado:'}</span>
          </label>
          <div className="checkout-input-wrapper" style={{ marginTop: 4 }}>
            <input
              type="email"
              className="checkout-text-input"
              placeholder="tu.correo@ejemplo.com"
              value={recoverEmailInput}
              onChange={(e) => setRecoverEmailInput(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-confirm-wompi"
            style={{ marginTop: 8, padding: '0.6rem', fontSize: '0.78rem' }}
            onClick={handleRecuperarPin}
            disabled={isLoading}
          >
            <i className="fa-solid fa-paper-plane"></i>{' '}
            <span>{isEn ? 'Send My PIN by Email' : 'Enviar Mi PIN al Correo'}</span>
          </button>
        </div>
      )}

      {/* Mensaje de Alerta y Estado sobre el botón */}
      {renderStatusAlert()}

      <button
        type="submit"
        className="btn-confirm-wompi"
        disabled={isLoading}
        style={{ marginTop: 6 }}
      >
        {isLoading ? (
          <>
            <i className="fa-solid fa-circle-notch fa-spin"></i>
            <span>{isEn ? 'Verifying...' : 'Verificando con Firestore...'}</span>
          </>
        ) : (
          <>
            <i className="fa-solid fa-arrows-rotate"></i>
            <span>{isEn ? 'Restore My Credits' : 'Restaurar Mis Créditos'}</span>
          </>
        )}
      </button>

      <button type="button" className="btn-modal-back" onClick={onClose}>
        <i className="fa-solid fa-arrow-left"></i>
        <span>{isEn ? 'Cancel and back to catalog' : '← Cancelar y volver al catálogo'}</span>
      </button>
    </form>
  );
};
