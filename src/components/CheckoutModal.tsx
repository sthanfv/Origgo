import React, { useState } from 'react';
import { LeadItem, UserSession } from '../types';
import { useLanguage } from '../i18n';
import {
  iniciarSesionConPin,
  solicitarCreditoBienvenidaApi,
  recuperarPinPorEmailApi,
} from '../services/auth';
import { crearOrdenPagoBackend, desplegarWidgetWompi } from '../services/wompi';
import { MODAL_PLANS, ModalPlanOption } from '../data/plans';
import { LeadSummaryMini } from './LeadSummaryMini';
import { WelcomeVerificationNotice } from './WelcomeVerificationNotice';
import { RestorePinTab } from './RestorePinTab';
import { AccountProfileTab } from './AccountProfileTab';

interface CheckoutModalProps {
  isOpen: boolean;
  selectedLead: LeadItem | null;
  userCredits: number;
  userSession: UserSession | null;
  onClose: () => void;
  onConfirmUnlock: (lead: LeadItem) => void;
  onSessionUpdate: (session: UserSession) => void;
  onLogout: () => void;
}

const DOMINIOS_DESECHABLES = [
  'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
  'yopmail.com', 'trashmail.com', 'temp-mail.org', 'dispostable.com',
];

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  selectedLead,
  userCredits,
  userSession,
  onClose,
  onConfirmUnlock,
  onSessionUpdate,
  onLogout,
}) => {
  const { isEn } = useLanguage();
  const [activeTab, setActiveTab] = useState<'comprar' | 'tengo-pin' | 'cuenta'>(
    userSession && userCredits > 0 ? 'cuenta' : 'comprar'
  );
  const [selectedPlan, setSelectedPlan] = useState<ModalPlanOption>('welcome_free');
  const [selectedCityCoverage, setSelectedCityCoverage] = useState(selectedLead?.ciudad || 'Bogotá');
  const [phoneInput, setPhoneInput] = useState(() => {
    return userSession?.phone || localStorage.getItem('origgo_auth_phone') || '';
  });
  const [emailInput, setEmailInput] = useState(() => {
    return localStorage.getItem('origgo_auth_email') || '';
  });
  const [pinInput, setPinInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estados para verificación de correo y recuperación de PIN
  const [isWelcomeVerificationSent, setIsWelcomeVerificationSent] = useState(false);
  const [isRecoverPinOpen, setIsRecoverPinOpen] = useState(false);
  const [recoverEmailInput, setRecoverEmailInput] = useState('');

  // Sincronizar estado cuando se abre el modal
  React.useEffect(() => {
    if (isOpen) {
      if (userSession && userCredits > 0) {
        setActiveTab('cuenta');
      } else {
        setActiveTab('comprar');
      }
      if (userSession?.phone) {
        setPhoneInput(userSession.phone);
      } else {
        const savedPhone = localStorage.getItem('origgo_auth_phone');
        if (savedPhone) setPhoneInput(savedPhone);
      }
      const savedEmail = localStorage.getItem('origgo_auth_email');
      if (savedEmail) setEmailInput(savedEmail);

      setErrorMessage(null);
      setSuccessMessage(null);
      setIsWelcomeVerificationSent(false);
      setIsRecoverPinOpen(false);
    }
  }, [isOpen, userSession, userCredits]);

  // Escuchar tecla Escape para cerrar el modal
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Renderizar alerta de estado o error visible
  const renderStatusAlert = () => {
    if (!errorMessage && !successMessage) return null;
    const isErr = !!errorMessage;
    return (
      <div
        style={{
          background: isErr ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${isErr ? '#ef4444' : '#10b981'}`,
          borderRadius: 10,
          padding: '10px 14px',
          margin: '10px 0',
          fontSize: '0.82rem',
          fontWeight: 700,
          color: isErr ? '#ef4444' : '#10b981',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <i
          className={isErr ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check'}
          style={{ fontSize: '1.05rem', flexShrink: 0 }}
        ></i>
        <span>{errorMessage || successMessage}</span>
      </div>
    );
  };

  // Validaciones comunes de identidad
  const validarCamposIdentidad = (exigirEmail: boolean = true) => {
    const cleanPhone = phoneInput.replace(/[^\d]/g, '');
    if (cleanPhone.length !== 10 || !cleanPhone.startsWith('3')) {
      setErrorMessage(
        isEn
          ? 'Please enter a valid 10-digit Colombian mobile number (starts with 3)'
          : 'Ingresa un número de celular válido de Colombia (10 dígitos iniciando en 3)'
      );
      return null;
    }

    if (exigirEmail) {
      const cleanEmail = emailInput.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!cleanEmail || !emailRegex.test(cleanEmail)) {
        setErrorMessage(
          isEn
            ? 'Please enter a valid email address (e.g. user@example.com)'
            : 'Ingresa un correo electrónico válido (ej: tu.correo@ejemplo.com)'
        );
        return null;
      }

      const dominio = cleanEmail.split('@')[1] || '';
      if (DOMINIOS_DESECHABLES.some((d) => dominio.includes(d))) {
        setErrorMessage(
          isEn
            ? 'Disposable email addresses are not allowed for security reasons'
            : 'Por seguridad, no se permiten correos temporales ni desechables'
        );
        return null;
      }
      return { cleanPhone, cleanEmail };
    }

    return { cleanPhone, cleanEmail: '' };
  };

  // Manejo de inicio de sesión con PIN (Pestaña Restaurar Cuenta)
  const handleRestorePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const val = validarCamposIdentidad(false);
    if (!val) return;

    if (!pinInput.trim()) {
      setErrorMessage(
        isEn
          ? 'Please enter your access PIN or payment reference'
          : 'Ingresa tu Código de Acceso (PIN) o Referencia de Wompi'
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await iniciarSesionConPin(val.cleanPhone, pinInput.trim());
      if (res.ok && res.user) {
        onSessionUpdate({ ...res.user, token: res.token });
        setSuccessMessage(
          isEn ? '✓ Account and credits restored successfully' : '✓ Cuenta y créditos restaurados correctamente'
        );
        setTimeout(() => {
          if (selectedLead && (res.user?.credits || 0) > 0) {
            onConfirmUnlock(selectedLead);
          }
          onClose();
        }, 900);
      } else {
        setErrorMessage(
          res.error || (isEn ? 'Invalid WhatsApp or PIN' : 'WhatsApp o PIN no válido')
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isEn ? 'Connection error' : 'Error de conexión con el servidor'));
    } finally {
      setIsLoading(false);
    }
  };

  // Solicitar recuperación de PIN por correo
  const handleRecuperarPin = async (e?: React.SyntheticEvent) => {
    if (e?.preventDefault) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = recoverEmailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(
        isEn ? 'Please enter your registered email' : 'Ingresa tu correo electrónico registrado'
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await recuperarPinPorEmailApi(cleanEmail, isEn ? 'en' : 'es');
      if (res.ok) {
        setSuccessMessage(
          isEn
            ? '✓ Recovery email sent! Check your inbox for your access PIN'
            : '✓ ¡Correo de recuperación enviado! Revisa tu bandeja de entrada'
        );
      } else {
        setErrorMessage(res.error || (isEn ? 'Could not send PIN' : 'No se pudo enviar el PIN'));
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isEn ? 'Server error' : 'Error en el servidor'));
    } finally {
      setIsLoading(false);
    }
  };

  // Manejo de desbloqueo gratis de bienvenida ($0) con Doble Opt-In por correo
  const handleUnlockGratisBienvenida = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const val = validarCamposIdentidad(true);
    if (!val) return;

    setIsLoading(true);
    try {
      const res = await solicitarCreditoBienvenidaApi({
        celular: val.cleanPhone,
        email: val.cleanEmail,
        leadId: selectedLead?.id,
        lang: isEn ? 'en' : 'es',
      });

      if (res.ok && res.pendingVerification) {
        localStorage.setItem('origgo_auth_phone', val.cleanPhone);
        localStorage.setItem('origgo_auth_email', val.cleanEmail);
        if (selectedLead) {
          localStorage.setItem('origgo_pending_lead_id', selectedLead.id);
        }
        setIsWelcomeVerificationSent(true);
        return;
      }

      if (res.alreadyClaimed) {
        setErrorMessage(
          isEn
            ? '⚠️ This device or email already claimed its welcome gift. Use Restore Account or pick a plan.'
            : '⚠️ Este dispositivo o correo ya utilizó su crédito de cortesía. Restaura tu cuenta con tu PIN o adquiere un plan.'
        );
        return;
      }

      setErrorMessage(res.error || res.message || 'No fue posible procesar la solicitud');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de comunicación con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  // Manejo de orden y pasarela Wompi
  const handlePagarWompi = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (selectedPlan === 'welcome_free') {
      return handleUnlockGratisBienvenida();
    }

    const val = validarCamposIdentidad(true);
    if (!val) return;

    localStorage.setItem('origgo_auth_phone', val.cleanPhone);
    localStorage.setItem('origgo_auth_email', val.cleanEmail);

    setIsLoading(true);
    try {
      const orden = await crearOrdenPagoBackend({
        productType: selectedPlan,
        celular: val.cleanPhone,
        ciudad: selectedPlan === 'subscription_city' ? selectedCityCoverage : selectedLead?.ciudad || 'Bogotá',
        lang: isEn ? 'en' : 'es',
      });

      if (!orden.ok || (!orden.signature && !orden.integritySignature)) {
        throw new Error(
          orden.error ||
            (isEn ? 'Could not initiate Wompi transaction' : 'No se pudo iniciar la transacción con Wompi')
        );
      }

      await desplegarWidgetWompi(orden, (resultado) => {
        if (resultado.status === 'APPROVED') {
          setSuccessMessage(
            isEn ? 'Payment approved! Activating credits...' : '¡Pago aprobado! Acreditando saldo...'
          );

          let creditsToAdd = 1;
          if (selectedPlan === 'pack_10_leads') creditsToAdd = 10;
          if (selectedPlan === 'subscription_city') creditsToAdd = 999;
          if (selectedPlan === 'subscription_national') creditsToAdd = 9999;

          onSessionUpdate({
            phone: val.cleanPhone,
            credits: userCredits + creditsToAdd,
            token: localStorage.getItem('origgo_auth_jwt_token') || undefined,
          });

          setTimeout(() => {
            if (selectedLead) {
              onConfirmUnlock(selectedLead);
            }
            onClose();
          }, 1200);
        }
      });
    } catch (err: any) {
      setErrorMessage(
        err.message || (isEn ? 'Error opening Wompi gateway' : 'Error al abrir la pasarela de pagos Wompi')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop checkout-modal-backdrop active"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        pointerEvents: 'auto',
        zIndex: 100000,
        padding: '1.25rem 1rem 3.5rem 1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card checkout-modal-card"
        style={{
          pointerEvents: 'auto',
          margin: '0 auto',
          maxWidth: 510,
          width: '100%',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón Circular de Cierre */}
        <button
          type="button"
          className="btn-modal-close"
          style={{ pointerEvents: 'auto', zIndex: 100, cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label={isEn ? 'Close modal' : 'Cerrar modal'}
        >
          <i className="fa-solid fa-xmark" style={{ pointerEvents: 'none' }}></i>
        </button>

        {/* Cabecera del Modal */}
        <div className="checkout-modal-header" style={{ paddingRight: '2.5rem', marginBottom: 12 }}>
          <div className="checkout-badge-pill" style={{ marginBottom: 6 }}>
            <i className="fa-solid fa-shield-halved"></i>{' '}
            <span>{isEn ? 'WOMPI & RESEND ZERO-TRUST SECURITY' : 'SEGURIDAD ZERO-TRUST WOMPI & RESEND'}</span>
          </div>
          <h2 className="checkout-modal-title" style={{ fontSize: '1.25rem', marginBottom: 4 }}>
            {isEn ? 'Direct Owners Unlock' : 'Desbloqueo de Propietarios Directos'}
          </h2>
          <p className="checkout-modal-subtitle" style={{ fontSize: '0.78rem', margin: 0 }}>
            {isEn
              ? 'No intermediaries, no agency commissions, verified owners.'
              : 'Sin intermediarios, comisiones de agencia ni mensualidades forzosas.'}
          </p>
        </div>

        {/* Resumen Compacto del Inmueble Seleccionado */}
        {selectedLead && <LeadSummaryMini lead={selectedLead} />}

        {/* Pestañas de Navegación */}
        <div className="checkout-tabs-nav" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={`checkout-tab-btn ${activeTab === 'comprar' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('comprar');
              setIsWelcomeVerificationSent(false);
              setErrorMessage(null);
            }}
          >
            <i className="fa-solid fa-cart-shopping"></i>{' '}
            <span>{isEn ? 'Plans & Welcome' : 'Planes y Cortesía'}</span>
          </button>
          <button
            type="button"
            className={`checkout-tab-btn ${activeTab === 'tengo-pin' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('tengo-pin');
              setErrorMessage(null);
            }}
          >
            <i className="fa-solid fa-key"></i>{' '}
            <span>{isEn ? 'Restore Account' : 'Restaurar Cuenta'}</span>
          </button>
          {userSession && userCredits > 0 && (
            <button
              type="button"
              className={`checkout-tab-btn ${activeTab === 'cuenta' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('cuenta');
                setErrorMessage(null);
              }}
            >
              <i className="fa-solid fa-user-check"></i>{' '}
              <span>{isEn ? 'My Account' : 'Mi Cuenta'}</span>
            </button>
          )}
        </div>

        {/* PESTAÑA 1: COMPRAR PLANES / BIENVENIDA */}
        {activeTab === 'comprar' && (
          <div>
            {isWelcomeVerificationSent ? (
              <WelcomeVerificationNotice
                emailInput={emailInput}
                isEn={isEn}
                isLoading={isLoading}
                onBack={() => setIsWelcomeVerificationSent(false)}
                onResend={handleUnlockGratisBienvenida}
              />
            ) : (
              /* VISTA NORMAL DE PLANES Y FORMULARIO */
              <>
                <div className="pricing-options-grid">
                  {MODAL_PLANS.map((plan) => (
                    <label
                      key={plan.id}
                      className={`pricing-option-card ${plan.id === 'welcome_free' ? 'welcome-card' : ''} ${selectedPlan === plan.id ? 'active-option' : ''}`}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      {plan.ribbon && (
                        <div className="featured-ribbon" style={plan.ribbon.bg ? { background: plan.ribbon.bg } : undefined}>
                          {plan.ribbon.text}
                        </div>
                      )}
                      <div className="option-header-row">
                        <span className="option-name">{isEn ? plan.nameEn : plan.nameEs}</span>
                        <span className="option-price">
                          {plan.price}
                          {plan.period && <span style={{ fontSize: '0.7rem', fontWeight: 600 }}> {plan.period}</span>}
                        </span>
                      </div>
                      <p className="option-desc">{isEn ? plan.descEn : plan.descEs}</p>
                    </label>
                  ))}
                </div>

                {/* Selector de Ciudad (Solo si se elige Plan Pro Ciudad) */}
                {selectedPlan === 'subscription_city' && (
                  <div className="checkout-form-group" style={{ marginBottom: 12 }}>
                    <label className="checkout-form-label">
                      <i className="fa-solid fa-location-dot" style={{ color: 'var(--accent-emerald)' }}></i>
                      <span>{isEn ? 'Unlimited Coverage City:' : 'Ciudad de Cobertura Ilimitada:'}</span>
                    </label>
                    <div className="checkout-input-wrapper">
                      <select
                        className="checkout-text-input"
                        value={selectedCityCoverage}
                        onChange={(e) => setSelectedCityCoverage(e.target.value)}
                        style={{ background: 'transparent', cursor: 'pointer' }}
                      >
                        {['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Pereira', 'Santa Marta'].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Formulario de WhatsApp */}
                <div className="checkout-form-group" style={{ margin: '14px 0 8px 0' }}>
                  <label className="checkout-form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="fa-brands fa-whatsapp" style={{ color: '#22C55E', fontSize: '1.05rem' }}></i>
                      <strong>{isEn ? 'WhatsApp Number:' : 'Celular (WhatsApp):'}</strong>
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                      {isEn ? '10 digits' : '10 dígitos (inicia en 3)'}
                    </span>
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

                {/* Formulario de Correo Electrónico (Obligatorio para identidad y seguridad) */}
                <div className="checkout-form-group" style={{ margin: '0 0 10px 0' }}>
                  <label className="checkout-form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="fa-regular fa-envelope" style={{ color: 'var(--accent-emerald)', fontSize: '1.05rem' }}></i>
                      <strong>{isEn ? 'Email (PIN & Invoicing):' : 'Correo Electrónico (PIN y Factura):'}</strong>
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {isEn ? 'Zero spam guarantee' : 'Cero spam garantizado'}
                    </span>
                  </label>
                  <div className="checkout-input-wrapper">
                    <input
                      type="email"
                      className="checkout-text-input"
                      placeholder={isEn ? 'e.g. your.email@gmail.com' : 'Ej: tu.correo@gmail.com'}
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        setErrorMessage(null);
                      }}
                    />
                  </div>
                  <span className="checkout-input-help" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 4 }}>
                    {isEn
                      ? '🔒 Your 1-click Magic Link and security PIN will be delivered here.'
                      : '🔒 Tu Enlace Mágico de 1 clic y PIN de seguridad serán enviados aquí.'}
                  </span>
                </div>

                {/* Mensaje de Alerta y Estado sobre el botón */}
                {renderStatusAlert()}

                {/* Botón Principal Wompi / Desbloqueo Gratis */}
                <button
                  type="button"
                  className="btn-confirm-wompi"
                  onClick={handlePagarWompi}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      <span>{isEn ? 'Securing Request...' : 'Procesando con Seguridad...'}</span>
                    </>
                  ) : selectedPlan === 'welcome_free' ? (
                    <>
                      <i className="fa-solid fa-gift"></i>
                      <span>{isEn ? 'Activate 1 Free Unlock ($0 COP)' : 'Activar Desbloqueo de Cortesía ($0 COP)'}</span>
                    </>
                  ) : selectedPlan === 'single_lead' ? (
                    <>
                      <i className="fa-solid fa-lock"></i>
                      <span>{isEn ? 'Pay Single Unlock ($5,000 COP)' : 'Pagar Desbloqueo Individual ($5.000 COP)'}</span>
                    </>
                  ) : selectedPlan === 'pack_10_leads' ? (
                    <>
                      <i className="fa-solid fa-star"></i>
                      <span>{isEn ? 'Pay 10 Contacts Pack ($35,000 COP)' : 'Pagar Bolsa 10 Contactos ($35.000 COP)'}</span>
                    </>
                  ) : selectedPlan === 'subscription_city' ? (
                    <>
                      <i className="fa-solid fa-city"></i>
                      <span>{isEn ? 'Activate City Pro ($89,000 COP)' : 'Activar Plan Pro Ciudad ($89.000 COP)'}</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-crown"></i>
                      <span>{isEn ? 'Activate National VIP ($149,000 COP)' : 'Activar Plan Nacional VIP ($149.000 COP)'}</span>
                    </>
                  )}
                </button>

                {/* Botón para volver atrás o cancelar sin trabas */}
                <button type="button" className="btn-modal-back" onClick={onClose}>
                  <i className="fa-solid fa-arrow-left"></i>
                  <span>{isEn ? 'Cancel and back to catalog' : '← Cancelar y volver al catálogo'}</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* PESTAÑA 2: RESTAURAR CUENTA / TENGO PIN */}
        {activeTab === 'tengo-pin' && (
          <RestorePinTab
            phoneInput={phoneInput}
            setPhoneInput={setPhoneInput}
            pinInput={pinInput}
            setPinInput={setPinInput}
            isLoading={isLoading}
            isRecoverPinOpen={isRecoverPinOpen}
            setIsRecoverPinOpen={setIsRecoverPinOpen}
            recoverEmailInput={recoverEmailInput}
            setRecoverEmailInput={setRecoverEmailInput}
            handleRestorePin={handleRestorePin}
            handleRecuperarPin={handleRecuperarPin}
            renderStatusAlert={renderStatusAlert}
            onClose={onClose}
            setErrorMessage={setErrorMessage}
            setSuccessMessage={setSuccessMessage}
            isEn={isEn}
          />
        )}

        {/* PESTAÑA 3: MI MEMBRESÍA (PERFIL ACTIVO) */}
        {activeTab === 'cuenta' && (
          <AccountProfileTab
            userSession={userSession}
            phoneInput={phoneInput}
            userCredits={userCredits}
            selectedLead={selectedLead}
            isEn={isEn}
            onConfirmUnlock={onConfirmUnlock}
            onClose={onClose}
            onGoToBuy={() => setActiveTab('comprar')}
            onLogout={onLogout}
          />
        )}
      </div>
    </div>
  );
};
