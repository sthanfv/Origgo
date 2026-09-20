import React from 'react';
import { useLanguage } from '../i18n';
import { inyectarOndaRipple } from '../utils/ripple';

interface MobileBottomBarProps {
  isDarkMode: boolean;
  isSideMenuOpen: boolean;
  onToggleTheme: () => void;
  onOpenVipModal: () => void;
  onToggleSideMenu: () => void;
  onScrollToSearch: () => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  isDarkMode,
  isSideMenuOpen,
  onToggleTheme,
  onOpenVipModal,
  onToggleSideMenu,
  onScrollToSearch,
}) => {
  const { t, isEn } = useLanguage();

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, isHeavy = false) => {
    inyectarOndaRipple(e.currentTarget, e, isHeavy);
  };

  return (
    <nav className="mobile-bottom-bar" id="mobileBottomBar">
      <button 
        type="button"
        className="mobile-nav-btn active" 
        id="btnNavHome" 
        data-nav="home"
        onPointerDown={(e) => handlePointerDown(e)}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <i className="fa-solid fa-house"></i>
        <span data-i18n="nav_home">{t('nav_home', 'Inicio')}</span>
      </button>

      <button 
        type="button"
        className="mobile-nav-btn" 
        id="btnNavSearch" 
        data-nav="search"
        onPointerDown={(e) => handlePointerDown(e)}
        onClick={onScrollToSearch}
      >
        <i className="fa-solid fa-magnifying-glass"></i>
        <span data-i18n="nav_search">{t('nav_search', 'Buscar')}</span>
      </button>

      <button 
        type="button"
        className="mobile-nav-btn" 
        id="btnThemeToggleMobile" 
        data-nav="theme"
        onPointerDown={(e) => handlePointerDown(e)}
        onClick={onToggleTheme}
        aria-label="Alternar tema de color"
      >
        <i className={isDarkMode ? "fa-solid fa-sun" : "fa-solid fa-moon"}></i>
        <span data-i18n="nav_theme">{t('nav_theme', 'Tema')}</span>
      </button>

      <button 
        type="button"
        className="mobile-nav-btn" 
        id="btnNavVip" 
        data-nav="vip"
        onPointerDown={(e) => handlePointerDown(e, true)}
        onClick={onOpenVipModal}
      >
        <i className="fa-solid fa-bolt" style={{ color: '#F59E0B' }}></i>
        <span data-i18n="nav_credits">{t('nav_credits', 'Créditos')}</span>
      </button>

      <button 
        type="button"
        className={`mobile-nav-btn ${isSideMenuOpen ? 'active is-active' : ''}`} 
        id="btnNavMenuBottom" 
        data-nav="menu"
        aria-label={isSideMenuOpen ? (isEn ? "Close side menu" : "Cerrar menú lateral") : (isEn ? "Open side menu" : "Abrir menú lateral")}
        aria-expanded={isSideMenuOpen}
        onPointerDown={(e) => handlePointerDown(e)}
        onClick={onToggleSideMenu}
      >
        <div className={`animated-hamburger ${isSideMenuOpen ? 'is-active' : ''}`} aria-hidden="true">
          <span className="hamburger-bar bar-1"></span>
          <span className="hamburger-bar bar-2"></span>
          <span className="hamburger-bar bar-3"></span>
        </div>
        <span data-i18n="nav_menu">
          {isSideMenuOpen ? (isEn ? 'Close' : 'Cerrar') : t('nav_menu', 'Menú')}
        </span>
      </button>
    </nav>
  );
};
