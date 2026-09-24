import React from 'react';
import { LeadItem } from '../types';

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
  userCredits?: number;
  selectedLead?: LeadItem | null;
  onGoToBuy?: () => void;
}

/**
 * Pestaña modular para acceso rápido con PIN de 4 dígitos y confirmación de desbloqueo,
 * sin jerga técnica y con recuperación asistida por correo.
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
  userCredits = 0,
  selectedLead = null,
  onGoToBuy,
}) => {
  return (
    <form onSubmit={handleRestorePin}>
      {/* Banner Informativo si el usuario cuenta con saldo reconocido */}
      {userCredits > 0 && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid var(--accent-emerald)',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textAlign: 'left',
          }}
        >
          <i className="fa-solid fa-bolt" style={{ color: '#F59E0B', fontSize: '1.25rem', flexShrink: 0 }}></i>
          <div>
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'block' }}>
              {isEn
                ? `You have ${userCredits} credit available`
                : `Tienes ${userCredits} ${userCredits === 1 ? 'crédito disponible' : 'créditos disponibles'}`}
            </strong>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {isEn
                ? 'Enter your 4-digit PIN to confirm the unlock instantly.'
                : 'Ingresa tu PIN de 4 dígitos para confirmar el desbloqueo directo.'}
            </span>
          </div>
        </div>
      )}

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
          <span>{isEn ? '4-Digit Access PIN:' : 'Código PIN de 4 dígitos:'}</span>
        </label>
        <div className="checkout-input-wrapper">
          <input
            type="text"
            className="checkout-text-input"
            placeholder="Ej: 8731"
            value={pinInput}
            maxLength={12}
            onChange={(e) => {
              setPinInput(e.target.value);
              setErrorMessage(null);
            }}
            style={{ textAlign: 'center', letterSpacing: '0.15em', fontSize: '1.05rem', fontWeight: 700 }}
          />
        </div>
        <span className="checkout-input-help">
          {isEn
            ? 'Enter the 4-digit PIN you received in your email.'
            : 'Ingresa el PIN de 4 dígitos que recibiste en tu correo.'}
        </span>
      </div>

      {/* Sub-bloque: Recuperación de PIN si no lo recuerda */}
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
            <span>{isEn ? 'Verifying PIN...' : 'Verificando PIN...'}</span>
          </>
        ) : (
          <>
            <i className="fa-solid fa-unlock-keyhole"></i>
            <span>
              {selectedLead && userCredits > 0
                ? (isEn ? 'Unlock Contact with My Credit' : 'Desbloquear Contacto con Mi Crédito')
                : (isEn ? 'Access My Account' : 'Entrar a Mi Cuenta')}
            </span>
          </>
        )}
      </button>

      {/* Enlace para nuevos usuarios si desean ver planes o regalo */}
      {onGoToBuy && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '0.74rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 4,
            }}
            onClick={onGoToBuy}
          >
            {isEn ? 'New to Origgo? See plans & free unlock' : '¿Aún no tienes cuenta? Ver planes y cortesía gratis'}
          </button>
        </div>
      )}

      <button type="button" className="btn-modal-back" onClick={onClose}>
        <i className="fa-solid fa-arrow-left"></i>
        <span>{isEn ? 'Cancel and back to catalog' : '← Cancelar y volver al catálogo'}</span>
      </button>
    </form>
  );
};
