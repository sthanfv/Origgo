import React from 'react';
import { useLanguage } from '../i18n';
import { inyectarOndaRipple } from '../utils/ripple';

interface SiteHeaderProps {
  isDarkMode: boolean;
  isSideMenuOpen: boolean;
  isPushActive: boolean;
  userCredits: number;
  onToggleSideMenu: () => void;
  onToggleTheme: () => void;
  onTogglePush: () => void;
  onOpenVipModal: () => void;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  isDarkMode,
  isSideMenuOpen,
  isPushActive,
  userCredits,
  onToggleSideMenu,
  onToggleTheme,
  onTogglePush,
  onOpenVipModal,
}) => {
  const { lang, setLang, t, isEn } = useLanguage();

  return (
    <header className="site-header" id="siteHeader">
      <div className="site-header-inner">
        {/* Lado Izquierdo: Espaciador en PC / Menú exclusivo para Android y móviles */}
        <div className="header-left-nav header-spacer">
          <button 
            type="button" 
            className={`btn-menu-pill btn-mobile-only ${isSideMenuOpen ? 'is-active' : ''}`}
            id="btnMenuPill"
            onClick={(e) => {
              inyectarOndaRipple(e.currentTarget, e);
              onToggleSideMenu();
            }}
            aria-label={isSideMenuOpen ? (isEn ? "Close navigation menu" : "Cerrar menú de navegación") : (isEn ? "Open navigation menu" : "Abrir menú de navegación")}
            aria-expanded={isSideMenuOpen}
          >
            <span className="menu-hamburger-icon">
              <span className="bar-top"></span>
              <span className="bar-mid"></span>
              <span className="bar-bot"></span>
            </span>
            <span className="menu-pill-text">
              {isSideMenuOpen ? (isEn ? 'Close' : 'Cerrar') : t('nav_menu', 'Menú')}
            </span>
          </button>
        </div>

        {/* Centro: Isotipo y Logotipo Oficial de Origgo con animación cinemática */}
        <div 
          className="brand-badge notranslate" 
          id="brandBadge" 
          translate="no"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          role="button"
          tabIndex={0}
          aria-label="Origgo Inicio"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        >
          <div className="brand-text-block notranslate" translate="no">
            <h1 className="brand-title notranslate" aria-label="Origgo" translate="no">
              <span className="brand-initial-o-wrap notranslate" aria-hidden="true" translate="no">
                <img 
                  src="/assets/img/origgo-icon.svg" 
                  alt="" 
                  className="brand-icon-o" 
                  width="44" 
                  height="44" 
                />
              </span>
              <span className="brand-letters-riggo notranslate" aria-hidden="true" translate="no">
                <span className="brand-letter brand-letter-1 notranslate" translate="no">r</span>
                <span className="brand-letter brand-letter-2 notranslate" translate="no">i</span>
                <span className="brand-letter brand-letter-3 notranslate" translate="no">g</span>
                <span className="brand-letter brand-letter-4 notranslate" translate="no">g</span>
                <span className="brand-letter brand-letter-5 notranslate" translate="no">o</span>
              </span>
            </h1>
          </div>
        </div>

        {/* Lado Derecho: Acciones Tácticas (Idioma, Push, Tema, VIP) */}
        <div className="nav-actions">
          {/* Selector Bilingüe ES / EN */}
          <div className="lang-switch" id="langSwitchHeader" role="group" aria-label="Selector de idioma">
            <button 
              type="button" 
              className={`lang-btn ${lang === 'es' ? 'active' : ''}`} 
              data-lang="es" 
              title="Español" 
              aria-label="Español" 
              aria-pressed={lang === 'es'}
              onClick={(e) => {
                inyectarOndaRipple(e.currentTarget, e);
                setLang('es');
              }}
            >
              <span className="lang-code">ES</span>
            </button>
            <span className="lang-divider">/</span>
            <button 
              type="button" 
              className={`lang-btn ${lang === 'en' ? 'active' : ''}`} 
              data-lang="en" 
              title="English" 
              aria-label="English" 
              aria-pressed={lang === 'en'}
              onClick={(e) => {
                inyectarOndaRipple(e.currentTarget, e);
                setLang('en');
              }}
            >
              <span className="lang-code">EN</span>
            </button>
          </div>

          <button 
            type="button" 
            className="btn-push-subscribe" 
            id="btnPushSubscribe" 
            title={isPushActive ? (isEn ? "Push Alerts Active" : "Alertas Push Activas") : (isEn ? "Enable Web Push Alerts" : "Activar Alertas Inmediatas Web Push")} 
            aria-label="Notificaciones Push"
            onClick={(e) => {
              inyectarOndaRipple(e.currentTarget, e);
              onTogglePush();
            }}
            style={{ color: isPushActive ? 'var(--accent-emerald)' : undefined }}
          >
            <i className={isPushActive ? "fa-solid fa-bell" : "fa-regular fa-bell"}></i>
          </button>

          <button 
            type="button" 
            className="btn-theme-toggle" 
            id="btnThemeToggle" 
            title={isEn ? "Toggle Light / Dark Theme" : "Cambiar a Modo Claro / Oscuro"} 
            aria-label="Cambiar tema de color"
            onClick={(e) => {
              inyectarOndaRipple(e.currentTarget, e);
              onToggleTheme();
            }}
          >
            <i className={isDarkMode ? "fa-solid fa-sun" : "fa-solid fa-moon"}></i>
          </button>

          <button 
            type="button" 
            className="btn-vip-header" 
            id="btnVipHeader"
            onClick={(e) => {
              inyectarOndaRipple(e.currentTarget, e, true);
              onOpenVipModal();
            }}
            title={t('vip_btn_title', 'Ver créditos y planes')}
          >
            <i className="fa-solid fa-bolt" style={{ color: '#F59E0B' }}></i>
            <span className="btn-vip-text">
              {userCredits > 0 ? `${userCredits} ${isEn ? (userCredits === 1 ? 'Credit' : 'Credits') : (userCredits === 1 ? 'Crédito' : 'Créditos')}` : t('vip_btn_default', 'Créditos / Planes')}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
