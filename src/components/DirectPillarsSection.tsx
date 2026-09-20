import React from 'react';
import { useLanguage } from '../i18n';

interface DirectPillarsSectionProps {
  onOpenFreeUnlock: () => void;
}

export const DirectPillarsSection: React.FC<DirectPillarsSectionProps> = ({ onOpenFreeUnlock }) => {
  const { isEn } = useLanguage();

  return (
    <section className="direct-pillars-outer" id="directPillarsSection">
      <div className="direct-pillars-card">
        {/* Badge Superior */}
        <div className="direct-tag">
          <i className="fa-solid fa-bolt"></i>
          <span>{isEn ? 'STRAIGHT TO THE POINT' : 'DIRECTO AL PUNTO'}</span>
        </div>

        {/* Título y Subtítulo de Impacto */}
        <h2 className="direct-title">
          {isEn ? 'We track and filter the market for you.' : 'Nosotros rastreamos y filtramos el mercado por ti.'}
          <br />
          <span className="direct-title-green">
            {isEn ? 'You deal directly with the verified owner.' : 'Tú negocias directo con el dueño real.'}
          </span>
        </h2>

        {/* Párrafo Explicativo */}
        <p className="direct-desc">
          {isEn
            ? 'Finding a home should not mean wasting weeks calling middlemen or navigating seas of duplicate ads. We scan Colombia 24/7, strip out 3%–4% agency commissions, and deliver only verified direct opportunities.'
            : 'Buscar vivienda no debería ser perder semanas llamando a intermediarios ni navegando en un mar de anuncios repetidos. Escaneamos Colombia las 24 horas, descartamos comisiones del 3%–4% y te entregamos solo oportunidades reales y verificadas.'}
        </p>

        {/* 3 Pilares Estratégicos */}
        <div className="direct-pillars-grid">
          {/* Pilar 1 */}
          <div className="direct-pillar-item">
            <div className="pillar-icon-box">
              <i className="fa-solid fa-satellite-dish"></i>
            </div>
            <div className="pillar-content">
              <strong className="pillar-title">{isEn ? '24/7 Tracking' : 'Rastreo 24/7'}</strong>
              <p className="pillar-text">
                {isEn
                  ? 'We continuously scan hundreds of open sources so you do not have to check multiple real estate portals every day.'
                  : 'Escaneamos cientos de fuentes continuas. No tienes que revisar portales todos los días.'}
              </p>
            </div>
          </div>

          {/* Pilar 2 */}
          <div className="direct-pillar-item">
            <div className="pillar-icon-box">
              <i className="fa-solid fa-user-shield"></i>
            </div>
            <div className="pillar-content">
              <strong className="pillar-title">{isEn ? 'Zero Commissions' : 'Cero Comisiones'}</strong>
              <p className="pillar-text">
                {isEn
                  ? 'Save between $10M and $30M in broker fees by closing agreements peer-to-peer.'
                  : 'Ahorra entre $10M y $30M en comisiones de corretaje negociando de tú a tú.'}
              </p>
            </div>
          </div>

          {/* Pilar 3 */}
          <div className="direct-pillar-item">
            <div className="pillar-icon-box">
              <i className="fa-solid fa-gift"></i>
            </div>
            <div className="pillar-content">
              <strong className="pillar-title">{isEn ? '1st Contact Free' : '1er Contacto Gratis'}</strong>
              <p className="pillar-text">
                {isEn
                  ? 'Test the service at zero cost: unlock a real private owner with your WhatsApp number.'
                  : 'Prueba el servicio sin costo: desbloquea un propietario real con tu WhatsApp.'}
              </p>
              <button 
                type="button" 
                className="btn-try-free-unlock"
                onClick={onOpenFreeUnlock}
              >
                {isEn ? 'Try 1st Unlock Free' : 'Probar 1er Desbloqueo'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
