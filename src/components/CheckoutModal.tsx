import React, { useState } from 'react';
import { LeadItem, UserSession } from '../types';
import { useLanguage } from '../i18n';
import { iniciarSesionConPin } from '../services/auth';
import { crearOrdenPagoBackend, desplegarWidgetWompi, ProductTypeId } from '../services/wompi';

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

type ModalPlanOption = ProductTypeId | 'welcome_free';

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
    userSession ? 'cuenta' : 'comprar'
  );
  const [selectedPlan, setSelectedPlan] = useState<ModalPlanOption>('pack_10_leads');
  const [selectedCityCoverage, setSelectedCityCoverage] = useState(selectedLead?.ciudad || 'Bogotá');
  const [phoneInput, setPhoneInput] = useState(userSession?.phone || '');
  const [pinInput, setPinInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Manejo de inicio de sesión con PIN + PoW en backend (Pestaña Restaurar Cuenta)
  const handleRestorePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanPhone = phoneInput.replace(/[^\d]/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage(
        isEn
          ? 'Please enter a valid 10-digit WhatsApp number'
          : 'Ingresa un número de WhatsApp válido (10 dígitos)'
      );
      return;
    }

    if (!pinInput.trim()) {
      setErrorMessage(
        isEn
          ? 'Please enter your access PIN or payment reference'
          : 'Ingresa tu Código de Acceso (PIN) o Referencia'
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await iniciarSesionConPin(cleanPhone, pinInput.trim());
      if (res.ok && res.user) {
        onSessionUpdate({ ...res.user, token: res.token });
        setSuccessMessage(
          isEn ? 'Account restored successfully' : '✓ Cuenta y créditos restaurados correctamente'
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

  // Manejo de desbloqueo gratis de bienvenida ($0)
  const handleUnlockGratisBienvenida = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanPhone = (userSession?.phone || phoneInput).replace(/[^\d]/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage(
        isEn
          ? 'Enter your WhatsApp number to activate your free unlock'
          : 'Ingresa tu WhatsApp de 10 dígitos para activar tu desbloqueo de bienvenida'
      );
      return;
    }

    setIsLoading(true);
    try {
      // Guardar el teléfono para recordar al usuario localmente
      if (!userSession) {
        onSessionUpdate({
          phone: cleanPhone,
          credits: 0,
          verified: true,
        });
      }

      setSuccessMessage(
        isEn
          ? '✓ Welcome gift activated! Unlocking contact...'
          : '✓ ¡Regalo de bienvenida activado! Revelando contacto...'
      );

      setTimeout(() => {
        if (selectedLead) {
          onConfirmUnlock(selectedLead);
        }
        onClose();
      }, 800);
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

    const cleanPhone = (userSession?.phone || phoneInput).replace(/[^\d]/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage(
        isEn
          ? 'WhatsApp number is required to back up your credits'
          : 'Ingresa tu número de WhatsApp para vincular y respaldar tus créditos'
      );
      return;
    }

    setIsLoading(true);
    try {
      const orden = await crearOrdenPagoBackend({
        productType: selectedPlan,
        celular: cleanPhone,
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
            phone: cleanPhone,
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
      className="modal-backdrop checkout-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card checkout-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Botón Circular de Cierre */}
        <button
          type="button"
          className="btn-modal-close"
          onClick={onClose}
          aria-label={isEn ? 'Close modal' : 'Cerrar modal'}
        >
          &times;
        </button>

        {/* Cabecera del Modal */}
        <div className="checkout-modal-header">
          <div className="checkout-badge-pill">
            <i className="fa-solid fa-shield-halved"></i>{' '}
            <span>{isEn ? 'WOMPI SECURE PAYMENT GATEWAY' : 'PASARELA DE PAGO SEGURA WOMPI'}</span>
          </div>
          <h2 className="checkout-modal-title">
            {isEn ? 'Direct Owners Unlock' : 'Desbloqueo de Propietarios Directos'}
          </h2>
          <p className="checkout-modal-subtitle">
            {isEn
              ? 'No intermediaries, no agency commissions, no forced subscriptions.'
              : 'Sin intermediarios, comisiones de agencia ni mensualidades forzosas.'}
          </p>
        </div>

        {/* Resumen del Inmueble Seleccionado */}
        {selectedLead && (
          <div className="modal-lead-summary-card">
            <div className="modal-lead-thumb-wrap">
              <img
                src={selectedLead.imagen}
                alt={selectedLead.titulo}
                className="modal-lead-thumb"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=400&q=80';
                }}
              />
            </div>
            <div className="modal-lead-info-col">
              <div className="modal-lead-row">
                <span className="lead-row-label">{isEn ? 'Property:' : 'Inmueble:'}</span>
                <span className="lead-row-val font-bold">{selectedLead.titulo}</span>
              </div>
              <div className="modal-lead-row">
                <span className="lead-row-label">{isEn ? 'Location:' : 'Ubicación:'}</span>
                <span className="lead-row-val">
                  {selectedLead.ciudad} • {selectedLead.barrio || 'Estrato 4'}
                </span>
              </div>
              <div className="modal-lead-row">
                <span className="lead-row-label">{isEn ? 'Listed Price:' : 'Precio Publicado:'}</span>
                <span className="lead-row-val text-emerald font-extrabold" style={{ color: 'var(--accent-emerald, #10B981)', fontWeight: 800 }}>
                  {selectedLead.precio}
                </span>
              </div>
              <div className="modal-lead-row">
                <span className="lead-row-label">{isEn ? 'Unit Rate:' : 'Valor Unitario:'}</span>
                <span className="lead-row-val font-bold">
                  {selectedLead.precio_m2 || '$ 2.469.136 / m²'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Barra de Pestañas */}
        <div className="checkout-tabs-bar">
          <button
            type="button"
            className={`checkout-tab-btn ${activeTab === 'cuenta' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('cuenta');
              setErrorMessage(null);
            }}
          >
            <i className="fa-solid fa-crown" style={{ color: '#F59E0B' }}></i>{' '}
            <span>{isEn ? 'My Membership' : 'Mi Membresía'}</span>
          </button>
          <button
            type="button"
            className={`checkout-tab-btn ${activeTab === 'comprar' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('comprar');
              setErrorMessage(null);
            }}
          >
            <i className="fa-solid fa-cart-shopping"></i>{' '}
            <span>{isEn ? 'Buy Plans' : 'Comprar Planes'}</span>
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
        </div>

        {/* Mensajes de Alerta y Estado */}
        {errorMessage && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: 10,
              padding: '8px 12px',
              marginBottom: 12,
              fontSize: '0.78rem',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              borderRadius: 10,
              padding: '8px 12px',
              marginBottom: 12,
              fontSize: '0.78rem',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <i className="fa-solid fa-circle-check"></i>
            <span>{successMessage}</span>
          </div>
        )}

        {/* PESTAÑA 1: COMPRAR PLANES */}
        {activeTab === 'comprar' && (
          <div>
            <div className="pricing-options-grid">
              {/* Opción de Bienvenida: 1 Desbloqueo Gratis ($0) */}
              <label
                className={`pricing-option-card welcome-card ${selectedPlan === 'welcome_free' ? 'active-option' : ''}`}
                onClick={() => setSelectedPlan('welcome_free')}
              >
                <div className="featured-ribbon" style={{ background: '#059669' }}>
                  🎁 {isEn ? 'WELCOME ($0)' : 'BIENVENIDA ($0)'}
                </div>
                <div className="option-header-row">
                  <span className="option-name">{isEn ? '1 Free Unlock' : '1 Desbloqueo Gratis'}</span>
                  <span className="option-price">$ 0</span>
                </div>
                <p className="option-desc">
                  {isEn
                    ? 'Try it free. 1 direct contact as a welcome gift by entering your active WhatsApp.'
                    : 'Pruébalo sin pagar. 1 contacto directo de regalo ingresando tu WhatsApp y Correo.'}
                </p>
              </label>

              {/* Opción Individual */}
              <label
                className={`pricing-option-card ${selectedPlan === 'single_lead' ? 'active-option' : ''}`}
                onClick={() => setSelectedPlan('single_lead')}
              >
                <div className="option-header-row">
                  <span className="option-name">{isEn ? 'Single Unlock' : 'Desbloqueo Individual'}</span>
                  <span className="option-price">$ 5.000</span>
                </div>
                <p className="option-desc">
                  {isEn
                    ? '1 verified direct owner contact. Ideal for a one-time purchase.'
                    : '1 Contacto verificado del propietario directo. Ideal para compra puntual.'}
                </p>
              </label>

              {/* Opción 10 Contactos (Destacado) */}
              <label
                className={`pricing-option-card ${selectedPlan === 'pack_10_leads' ? 'active-option' : ''}`}
                onClick={() => setSelectedPlan('pack_10_leads')}
              >
                <div className="featured-ribbon">⭐ {isEn ? 'MOST POPULAR (-30%)' : 'MÁS POPULAR (-30%)'}</div>
                <div className="option-header-row">
                  <span className="option-name">{isEn ? '10 Contacts Pack' : 'Bolsa 10 Contactos'}</span>
                  <span className="option-price">$ 35.000</span>
                </div>
                <p className="option-desc">
                  {isEn
                    ? '$3,500 per lead. Credits never expire and stay bound to your PIN.'
                    : '$3.500 por contacto. Los créditos no vencen y quedan asociados a tu PIN.'}
                </p>
              </label>

              {/* Plan Pro Ciudad */}
              <label
                className={`pricing-option-card ${selectedPlan === 'subscription_city' ? 'active-option' : ''}`}
                onClick={() => setSelectedPlan('subscription_city')}
              >
                <div className="option-header-row">
                  <span className="option-name">{isEn ? 'City Pro Plan' : 'Plan Pro Ciudad'}</span>
                  <span className="option-price">
                    $ 89.000 <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>/ mes</span>
                  </span>
                </div>
                <p className="option-desc">
                  {isEn
                    ? 'Unlimited 30-day access to all direct owners in your city.'
                    : 'Acceso ilimitado por 30 días a todos los propietarios directos de tu ciudad.'}
                </p>
              </label>

              {/* Plan Nacional VIP */}
              <label
                className={`pricing-option-card ${selectedPlan === 'subscription_national' ? 'active-option' : ''}`}
                onClick={() => setSelectedPlan('subscription_national')}
              >
                <div className="option-header-row">
                  <span className="option-name">{isEn ? 'National VIP Plan' : 'Plan Nacional VIP'}</span>
                  <span className="option-price">
                    $ 149.000 <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>/ mes</span>
                  </span>
                </div>
                <p className="option-desc">
                  {isEn
                    ? 'Full coverage across all Colombia + Exclusive price drop alerts.'
                    : 'Acceso total en toda Colombia + Radar exclusivo de rebajas de precio.'}
                </p>
              </label>
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
                    <option value="Bogotá">Bogotá D.C.</option>
                    <option value="Medellín">Medellín / Valle de Aburrá</option>
                    <option value="Cali">Cali</option>
                    <option value="Barranquilla">Barranquilla</option>
                    <option value="Cartagena">Cartagena</option>
                    <option value="Bucaramanga">Bucaramanga</option>
                    <option value="Pereira">Pereira / Eje Cafetero</option>
                    <option value="Santa Marta">Santa Marta</option>
                  </select>
                </div>
              </div>
            )}

            {/* Banner de Advertencia de WhatsApp Real */}
            <div className="checkout-phone-alert">
              <div className="phone-alert-icon">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div className="phone-alert-body">
                <strong>
                  {isEn ? 'Attention: Enter your REAL, active WhatsApp' : 'Atención: Ingresa tu WhatsApp REAL y activo'}
                </strong>
                <p>
                  {isEn
                    ? 'This number is your unique security key. If you enter an invalid number, you will not be able to access your credits or recover your PIN. No spam or unsolicited calls.'
                    : 'Este número es tu identificador único de seguridad. Si ingresas un número falso o equivocado, no podrás acceder a tus créditos ni recuperar tu PIN. El sistema no realiza llamadas ni spam.'}
                </p>
              </div>
            </div>

            {/* Formulario de WhatsApp */}
            <div className="checkout-form-group">
              <label className="checkout-form-label">
                <i className="fa-brands fa-whatsapp" style={{ color: '#22C55E' }}></i>
                <span>
                  {isEn
                    ? 'Authentication WhatsApp (10 digits):'
                    : 'WhatsApp de Autenticación (10 dígitos):'}
                </span>
              </label>
              <div className="checkout-input-wrapper">
                <span className="checkout-input-prefix">+57</span>
                <input
                  type="tel"
                  className="checkout-text-input"
                  placeholder="3228128201"
                  value={phoneInput}
                  maxLength={10}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/[^\d]/g, ''))}
                />
              </div>
              <span className="checkout-input-help">
                {isEn
                  ? 'Your credits will be locked to this mobile number so you can use them from any phone or PC.'
                  : 'Tus créditos quedarán sellados con este celular para que los uses desde cualquier teléfono o PC.'}
              </span>
            </div>

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
                  <span>{isEn ? 'Processing...' : 'Procesando...'}</span>
                </>
              ) : selectedPlan === 'welcome_free' ? (
                <>
                  <i className="fa-solid fa-unlock"></i>
                  <span>{isEn ? 'Activate Free Welcome Unlock ($0)' : 'Activar Desbloqueo Gratis de Bienvenida ($0)'}</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-lock"></i>
                  <span>{isEn ? 'Continue to Secure Payment with Wompi' : 'Continuar al Pago Seguro con Wompi'}</span>
                </>
              )}
            </button>

            {/* Leyenda Legal y Sellos Oficiales */}
            <div className="checkout-legal-notice">
              <i className="fa-solid fa-shield-halved" style={{ color: 'var(--accent-emerald)', marginRight: 4 }}></i>
              {isEn ? (
                <>By continuing, you agree to the Terms of Service and Privacy Policy.</>
              ) : (
                <>Al continuar, autorizas el tratamiento de datos y aceptas los Términos de Servicio (v1.0) y Política de Privacidad.</>
              )}
            </div>

            <div className="checkout-operator-card">
              <i className="fa-solid fa-building-columns" style={{ fontSize: '1.1rem', color: 'var(--accent-emerald)' }}></i>
              <div>
                <strong>{isEn ? 'Official Merchant of Record:' : 'Operador de Cobro Oficial:'}</strong>{' '}
                {isEn
                  ? 'Your payment is safely processed through SFC certified gateways in favor of our registered operator Desmulta.'
                  : 'Tu pago se procesa de forma segura a través de pasarela certificada y vigilada por la Superintendencia Financiera a nombre de nuestro comercio operador registrado Desmulta.'}
              </div>
            </div>

            <div className="checkout-guarantee-badges">
              <span>
                <i className="fa-solid fa-shield"></i>{' '}
                {isEn ? 'Secure Wompi Gateway (SFC Regulated)' : 'Pasarela Segura Wompi (Vigilada SFC)'}
              </span>
              <span>
                <i className="fa-solid fa-bolt"></i>{' '}
                {isEn ? 'Instant Activation' : 'Activación Instantánea'}
              </span>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: RESTAURAR CUENTA */}
        {activeTab === 'tengo-pin' && (
          <form onSubmit={handleRestorePin} style={{ textAlign: 'left' }}>
            <p className="checkout-modal-subtitle" style={{ textAlign: 'left', marginBottom: 14 }}>
              {isEn
                ? 'If you previously bought credits on another device, enter your registered WhatsApp and your access PIN (or Wompi payment reference) to instantly restore your balance.'
                : 'Si ya adquiriste créditos o un plan en otro dispositivo o navegador, ingresa tu número de WhatsApp y tu Código de Acceso (PIN) o Referencia de Pago.'}
            </p>

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
                  placeholder="3228128201"
                  value={phoneInput}
                  maxLength={10}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/[^\d]/g, ''))}
                />
              </div>
            </div>

            <div className="checkout-form-group">
              <label className="checkout-form-label">
                <i className="fa-solid fa-key" style={{ color: 'var(--accent-emerald)' }}></i>
                <span>{isEn ? 'Access PIN or Payment Ref:' : 'Código de Acceso (PIN) o Ref. Wompi:'}</span>
              </label>
              <div className="checkout-input-wrapper">
                <input
                  type="text"
                  className="checkout-text-input"
                  placeholder="Ej: 7492 o Ref. de pago"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  style={{ textAlign: 'center', letterSpacing: '0.15em', fontSize: '1.05rem' }}
                />
              </div>
              <span className="checkout-input-help">
                {isEn
                  ? 'Includes zero-knowledge client-side Proof-of-Work acceleration.'
                  : 'Valida criptográficamente tu PIN contra el backend serverless.'}
              </span>
            </div>

            <button
              type="submit"
              className="btn-confirm-wompi"
              disabled={isLoading}
              style={{ marginTop: 14 }}
            >
              {isLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span>{isEn ? 'Verifying...' : 'Verificando con PoW...'}</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-arrows-rotate"></i>
                  <span>{isEn ? 'Restore My Credits' : 'Restaurar Mis Créditos'}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* PESTAÑA 3: MI MEMBRESÍA (PERFIL ACTIVO) */}
        {activeTab === 'cuenta' && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid var(--accent-emerald)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-emerald)',
                  fontSize: '1.3rem',
                }}
              >
                <i className="fa-solid fa-user-shield"></i>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>
                  +57 {userSession?.phone || phoneInput || '3001234567'}
                </h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                  {isEn ? 'Verified Account' : 'Cuenta Verificada'}
                </span>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-surface, rgba(255, 255, 255, 0.04))',
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>
                {isEn ? 'Available Unlocks' : 'Desbloqueos Disponibles'}
              </span>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-emerald)', margin: '4px 0' }}>
                {userCredits}
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {isEn
                  ? 'Active credits without expiration date'
                  : 'Créditos activos sin fecha de caducidad'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn-confirm-wompi"
                style={{ flex: 2, marginBottom: 0 }}
                onClick={() => setActiveTab('comprar')}
              >
                <i className="fa-solid fa-plus"></i>
                <span>{isEn ? 'Get More Credits' : 'Adquirir Más Créditos'}</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  borderRadius: 12,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
                <span>{isEn ? 'Sign Out' : 'Salir'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
