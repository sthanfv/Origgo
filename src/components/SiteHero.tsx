import React from 'react';
import { useLanguage } from '../i18n';
import { inyectarOndaRipple } from '../utils/ripple';

interface SiteHeroProps {
  totalLeads: number;
  totalCities: number;
  totalSectors: number;
  onScrollToCatalog: () => void;
  onOpenAbout: () => void;
  /** Inmuebles detectados en las últimas 24 h (para decir "hoy" solo si es verdad). */
  leadsHoy?: number;
  /** Textos editables desde el panel (Vitrina); si faltan, se usan los de siempre. */
  vitrina?: { counterLabel?: string; counterValue?: string; heroTitulo?: string; heroSubtitulo?: string };
}

/** El título se inserta como HTML: el texto del panel se escapa para que no pueda inyectar código. */
function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export const SiteHero: React.FC<SiteHeroProps> = ({
  totalLeads,
  totalCities,
  totalSectors,
  onScrollToCatalog,
  onOpenAbout,
  vitrina = {},
  leadsHoy = 0,
}) => {
  const { t, isEn } = useLanguage();
  // Los textos del panel están en español: en inglés se mantienen los traducidos.
  // Cifras reales: "hoy" solo con lo detectado en las últimas 24 h; si no, el total disponible.
  const cifraContador = vitrina.counterValue || String(leadsHoy > 0 ? leadsHoy : totalLeads);
  const textoContador = vitrina.counterLabel
    ? vitrina.counterLabel.toUpperCase()
    : leadsHoy > 0
      ? 'OPORTUNIDADES DETECTADAS HOY'
      : 'OPORTUNIDADES DIRECTAS DISPONIBLES';

  return (
    <>
      <section className="hero-container-outer" id="heroSection">
        <div className="hero-macro-card">
          <div className="hero-side-bg hero-side-left"></div>
          <div className="hero-side-bg hero-side-right"></div>
          <div className="hero-backdrop-gradient"></div>
          
          <div className="hero-center-content">
            <div className="hero-eyebrow-tag">
              <span className="status-pulse"></span>
              <span className="eyebrow-text" id="badgeSectoresHero">
                {isEn 
                  ? `${leadsHoy > 0 ? `${leadsHoy} OPPORTUNITIES DETECTED TODAY` : `${totalLeads} DIRECT OPPORTUNITIES AVAILABLE`} • AI ORIGGO FINDER`
                  : `${cifraContador} ${textoContador} • IA ORIGGO FINDER`}
              </span>
              <button 
                type="button" 
                className="eyebrow-about-btn notranslate" 
                id="btnHeroOpenAbout" 
                title={t('hero_about_pill_text', '¿Qué es Origgo?')}
                onClick={onOpenAbout}
              >
                <i className="fa-solid fa-circle-question"></i> <span>{t('hero_about_pill_text', '¿Qué es Origgo?')}</span>
              </button>
            </div>

            <h1 
              className="hero-macro-title" 
              id="heroTitle"
              dangerouslySetInnerHTML={{ 
                __html: isEn 
                  ? 'Properties for sale <span class="editorial-italic">directly</span> from owners' 
                  : vitrina.heroTitulo
                    ? escaparHtml(vitrina.heroTitulo)
                    : 'Inmuebles en venta <span class="editorial-italic">directo</span> de sus dueños' 
              }}
            />

            <p className="hero-macro-subtitle" id="heroSubtitle">
              {!isEn && vitrina.heroSubtitulo ? vitrina.heroSubtitulo : t('hero_subtitle', 'El primer sistema de inteligencia artificial que rastrea portales inmobiliarios y redes sociales en tiempo real, detectando y conectando directamente con propietarios que no quieren intermediarios ni pagar comisiones.')}
            </p>

            <div className="hero-cta-wrapper">
              <button 
                type="button" 
                className="btn-hero-cta" 
                id="btnHeroCta"
                onPointerDown={(e) => inyectarOndaRipple(e.currentTarget, e)}
                onClick={onScrollToCatalog}
              >
                <span>{t('hero_cta', 'Ver Inmuebles Directos Disponibles')}</span>
                <i className="fa-solid fa-chevron-down"></i>
              </button>
            </div>

            <div className="hero-live-stats" id="heroLiveStats">
              <div className="hero-stat-item">
                <span className="hero-stat-number">{totalLeads}</span>
                <span className="hero-stat-label">{t('stat_leads_total', 'Propietarios Directos')}</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat-item">
                <span className="hero-stat-number">{totalCities}</span>
                <span className="hero-stat-label">{t('stat_ciudades', 'Ciudades Activas')}</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat-item">
                <span className="hero-stat-number">{totalSectors}</span>
                <span className="hero-stat-label">{t('stat_sectores', 'Sectores Monitoreados')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
