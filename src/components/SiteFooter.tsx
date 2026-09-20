import React from 'react';
import { useLanguage } from '../i18n';

interface SiteFooterProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenLegal: (tab: 'terminos' | 'exoneracion' | 'privacidad' | 'reembolsos') => void;
  onOpenSupport: (tab?: 'pago' | 'takedown' | 'cuenta') => void;
}

export const SiteFooter: React.FC<SiteFooterProps> = ({
  isDarkMode,
  onToggleTheme,
  onOpenLegal,
  onOpenSupport,
}) => {
  const { isEn } = useLanguage();

  return (
    <footer className="site-footer" id="siteFooter">
      <div className="footer-container">
        {/* Columna 1: Identidad Institucional */}
        <div className="footer-brand-column">
          <div className="footer-logo-row">
            <div className="footer-brand-title" aria-label="Origgo">
              <img 
                src="/assets/img/origgo-logo.svg" 
                alt="Origgo" 
                className="footer-logo-img" 
                width="120" 
                height="40" 
              />
            </div>
          </div>
          <p className="footer-bio">
            {isEn
              ? 'Direct connection platform with property owners in Colombia. No intermediaries, no agency commissions and with verified opportunities in real time.'
              : 'Plataforma de conexión directa con propietarios de inmuebles en Colombia. Sin intermediarios, sin comisiones de agencia y con oportunidades verificadas en tiempo real.'}
          </p>
          <div className="footer-status-line">
            <span className="footer-status-dot"></span>
            <span>
              {isEn
                ? 'Continuous monitoring in major cities and real estate investment hubs.'
                : 'Monitoreo continuo en principales ciudades y polos de inversión inmobiliaria.'}
            </span>
          </div>
        </div>

        {/* Columna 2: Información y Seguridad */}
        <div className="footer-nav-column">
          <h4 className="footer-heading">
            {isEn ? 'INFORMATION & SECURITY' : 'INFORMACIÓN Y SEGURIDAD'}
          </h4>
          <ul className="footer-link-list">
            <li>
              <button 
                type="button" 
                className="footer-text-link" 
                id="btnOpenTerminos"
                onClick={() => onOpenLegal('terminos')}
              >
                {isEn ? 'How It Works' : 'Cómo Funciona'}
              </button>
            </li>
            <li>
              <button 
                type="button" 
                className="footer-text-link" 
                id="btnOpenPrivacidad"
                onClick={() => onOpenLegal('privacidad')}
              >
                {isEn ? 'Your Data' : 'Tus Datos'}
              </button>
            </li>
            <li>
              <button 
                type="button" 
                className="footer-text-link" 
                id="btnOpenReembolsos"
                onClick={() => onOpenLegal('reembolsos')}
              >
                {isEn ? 'Balance Guarantee' : 'Garantía de Saldo'}
              </button>
            </li>
            <li>
              <a 
                href="https://www.sic.gov.co" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="footer-text-link"
              >
                <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.72rem', marginRight: 4 }}></i>
                {isEn ? 'Superintendence of Industry and Commerce (SIC)' : 'Superintendencia de Industria y Comercio (SIC)'}
              </a>
            </li>
            <li>
              <span className="footer-text-muted" style={{ fontStyle: 'italic', fontSize: '0.74rem' }}>
                {isEn ? 'No commissions or brokerage' : 'Sin comisiones ni intermediación'}
              </span>
            </li>
          </ul>
        </div>

        {/* Columna 3: Soporte y Contacto */}
        <div className="footer-nav-column">
          <h4 className="footer-heading">
            {isEn ? 'SUPPORT & CONTACT' : 'SOPORTE Y CONTACTO'}
          </h4>
          <ul className="footer-link-list">
            <li>
              <button 
                type="button" 
                className="footer-text-link" 
                id="btnOpenAutoSoporte"
                onClick={() => onOpenSupport('pago')}
              >
                <i className="fa-solid fa-headset" style={{ color: 'var(--accent-emerald, #10B981)', marginRight: 6 }}></i>
                <span>{isEn ? 'Self-Support Center' : 'Centro de Auto-Soporte'}</span>
              </button>
            </li>
            <li>
              <a 
                href="https://wa.me/573001234567" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="footer-text-link"
              >
                <i className="fa-brands fa-whatsapp" style={{ color: '#25D366', marginRight: 6 }}></i>
                <span>{isEn ? 'VIP WhatsApp Support' : 'Soporte VIP WhatsApp'}</span>
              </a>
            </li>
            <li>
              <a 
                href="https://t.me/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="footer-text-link"
              >
                <i className="fa-brands fa-telegram" style={{ color: '#0088cc', marginRight: 6 }}></i>
                <span>{isEn ? 'Telegram Channel' : 'Canal de Telegram'}</span>
              </a>
            </li>
            <li>
              <span className="footer-text-muted" style={{ fontStyle: 'italic', fontSize: '0.74rem' }}>
                {isEn ? 'Direct support via WhatsApp' : 'Atención directa por WhatsApp'}
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Barra Inferior Discreta y Profesional con Botón Modo Visual */}
      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <div className="footer-theme-row">
            <button 
              type="button" 
              className="btn-footer-theme-pill" 
              id="btnThemeToggleFooter" 
              onClick={onToggleTheme}
              title={isEn ? "Toggle Visual Mode" : "Cambiar Modo Visual"} 
              aria-label="Cambiar modo visual"
            >
              <i className={isDarkMode ? "fa-solid fa-sun" : "fa-solid fa-moon"}></i>
              <span>{isEn ? 'Visual Mode' : 'Modo Visual'}</span>
            </button>
          </div>
          
          <p className="footer-copyright-text">
            {isEn
              ? '© 2026 Origgo. Direct connection between buyers and owners without intermediaries.'
              : '© 2026 Origgo. Conexión directa entre compradores y propietarios sin intermediarios.'}
          </p>
          
          <p className="footer-disclaimer">
            <strong>{isEn ? 'Trust Notice:' : 'Aviso de Confianza:'}</strong>{' '}
            {isEn
              ? 'Origgo is a tool to connect buyers directly with property owners. We do not charge commissions or take part in negotiations. We always recommend reviewing property legal documentation before making agreements.'
              : 'Origgo es una herramienta para conectar compradores directamente con propietarios. No cobramos comisiones ni participamos en las negociaciones. Te recomendamos siempre revisar la documentación del inmueble antes de hacer acuerdos.'}
          </p>
        </div>
      </div>
    </footer>
  );
};
