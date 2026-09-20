import React from 'react';
import { useLanguage } from '../i18n';
import { inyectarOndaRipple } from '../utils/ripple';

interface SidebarProps {
  isOpen: boolean;
  isDarkMode: boolean;
  userCredits: number;
  onClose: () => void;
  onOpenAbout: () => void;
  onToggleTheme: () => void;
  onOpenVipModal: () => void;
  onOpenSupport: () => void;
  onOpenLegal: (tab: 'terminos' | 'exoneracion' | 'privacidad' | 'reembolsos') => void;
  onScrollToCatalog: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  isDarkMode,
  userCredits,
  onClose,
  onOpenAbout,
  onToggleTheme,
  onOpenVipModal,
  onOpenSupport,
  onOpenLegal,
  onScrollToCatalog,
}) => {
  const { lang, setLang, t, isEn } = useLanguage();

  return (
    <>
      <aside className={`side-menu ${isOpen ? 'active' : ''}`} id="sideMenu">
        <div className="side-menu-header">
          <div className="side-menu-brand" aria-label="Origgo">
            <div className="brand-text-block">
              <span className="brand-title" style={{ fontSize: '1.6rem' }}>
                <span className="brand-initial-o-wrap" style={{ width: 38, height: 38 }}>
                  <img 
                    src="/assets/img/origgo-icon.svg" 
                    alt="" 
                    className="brand-icon-o" 
                    width="38" 
                    height="38" 
                  />
                </span>
                <span className="brand-letters-riggo">
                  <span className="brand-letter" style={{ opacity: 1, transform: 'none' }}>r</span>
                  <span className="brand-letter" style={{ opacity: 1, transform: 'none' }}>i</span>
                  <span className="brand-letter" style={{ opacity: 1, transform: 'none' }}>g</span>
                  <span className="brand-letter" style={{ opacity: 1, transform: 'none' }}>g</span>
                  <span className="brand-letter" style={{ opacity: 1, transform: 'none' }}>o</span>
                </span>
              </span>
            </div>
          </div>
          <button 
            type="button"
            className="btn-close-menu" 
            id="btnCloseSideMenu" 
            aria-label={isEn ? "Close Menu" : "Cerrar Menú"}
            onClick={onClose}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Selector de idioma en menú lateral */}
        <div className="side-menu-lang-row">
          <span className="side-menu-lang-label">{t('menu_lang_label', 'Idioma / Language')}</span>
          <div className="side-lang-switch" role="group" aria-label="Selector de idioma">
            <button 
              type="button" 
              className={`side-lang-btn ${lang === 'es' ? 'active' : ''}`} 
              data-lang="es" 
              aria-pressed={lang === 'es'}
              onClick={(e) => {
                inyectarOndaRipple(e.currentTarget, e);
                setLang('es');
              }}
            >
              <span className="side-lang-code">ES</span>
              <span className="side-lang-name">Español</span>
            </button>
            <button 
              type="button" 
              className={`side-lang-btn ${lang === 'en' ? 'active' : ''}`} 
              data-lang="en" 
              aria-pressed={lang === 'en'}
              onClick={(e) => {
                inyectarOndaRipple(e.currentTarget, e);
                setLang('en');
              }}
            >
              <span className="side-lang-code">EN</span>
              <span className="side-lang-name">English</span>
            </button>
          </div>
        </div>

        {/* Bloque de Estado de Cuenta / Saldo */}
        <div 
          style={{ 
            margin: '0.85rem 1.25rem', 
            padding: '0.85rem 1rem', 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-card)', 
            borderRadius: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
              {isEn ? 'Available Balance:' : 'Tu Saldo Activo:'}
            </span>
            <strong style={{ fontSize: '1.05rem', color: 'var(--accent-emerald)' }}>
              {userCredits} {isEn ? (userCredits === 1 ? 'Credit' : 'Credits') : (userCredits === 1 ? 'Crédito' : 'Créditos')}
            </strong>
          </div>
          <button 
            type="button" 
            className="btn-vip-header" 
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            onClick={(e) => {
              inyectarOndaRipple(e.currentTarget, e, true);
              onClose();
              onOpenVipModal();
            }}
          >
            <i className="fa-solid fa-plus"></i> {isEn ? 'Top up' : 'Recargar'}
          </button>
        </div>

        {/* Navegación del Menú Lateral */}
        <nav className="side-menu-nav">
          <a 
            href="#" 
            className="side-menu-link active"
            onClick={(e) => {
              e.preventDefault();
              onClose();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <i className="fa-solid fa-chart-pie"></i> <span>{t('menu_dashboard', 'Dashboard Principal')}</span>
          </a>

          <a 
            href="#" 
            className="side-menu-link" 
            onClick={(e) => {
              e.preventDefault();
              onClose();
              onOpenAbout();
            }}
          >
            <i className="fa-solid fa-circle-info"></i> <span>{t('menu_about', '¿Qué es Origgo?')}</span>
          </a>

          <a 
            href="#" 
            className="side-menu-link" 
            onClick={(e) => {
              e.preventDefault();
              onClose();
              onScrollToCatalog();
            }}
          >
            <i className="fa-solid fa-building"></i> <span>{t('menu_direct_leads', 'Inmuebles Directos')}</span>
          </a>

          <a 
            href="#" 
            className="side-menu-link" 
            onClick={(e) => {
              e.preventDefault();
              onToggleTheme();
            }}
          >
            <i className={isDarkMode ? "fa-solid fa-sun" : "fa-solid fa-moon"}></i> 
            <span>{isDarkMode ? (isEn ? 'Light Mode' : 'Modo Claro') : (isEn ? 'Dark Mode' : 'Modo Oscuro')}</span>
          </a>

          <a 
            href="#" 
            className="side-menu-link" 
            onClick={(e) => {
              e.preventDefault();
              onClose();
              onOpenVipModal();
            }}
          >
            <i className="fa-solid fa-crown side-menu-icon-vip" style={{ color: '#F59E0B' }}></i> 
            <span>{t('menu_vip', 'Desbloqueo VIP')}</span>
          </a>

          <a 
            href="#" 
            className="side-menu-link" 
            onClick={(e) => {
              e.preventDefault();
              onClose();
              onOpenSupport();
            }}
          >
            <i className="fa-solid fa-headset" style={{ color: 'var(--accent-emerald)' }}></i> 
            <span>{t('menu_autosoporte', 'Centro de Auto-Soporte')}</span>
          </a>

          <a 
            href="https://wa.me/573001234567?text=Hola%2C%20necesito%20soporte%20en%20Origgo" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="side-menu-link"
          >
            <i className="fa-brands fa-whatsapp side-menu-icon-whatsapp" style={{ color: '#25D366' }}></i> 
            <span>{t('menu_support', 'Soporte VIP WhatsApp')}</span>
          </a>

          <a 
            href="#" 
            className="side-menu-link" 
            onClick={(e) => {
              e.preventDefault();
              onClose();
              onOpenLegal('terminos');
            }}
          >
            <i className="fa-solid fa-scale-balanced"></i> <span>{t('menu_terms', 'Términos & Exoneración')}</span>
          </a>
        </nav>

        <p className="side-menu-footnote" style={{ marginTop: 'auto', paddingTop: '1.5rem', color: 'var(--text-dim)', fontSize: '0.74rem' }}>
          Origgo v1.0<br />
          {isEn ? 'Direct Owner Properties in Colombia' : 'Inmuebles Directos de Propietario en Colombia'}
        </p>
      </aside>

      {/* Overlay oscuro para cerrar menú */}
      <div 
        className={`menu-overlay ${isOpen ? 'active' : ''}`} 
        id="sideMenuOverlay"
        onClick={onClose}
      ></div>
    </>
  );
};
