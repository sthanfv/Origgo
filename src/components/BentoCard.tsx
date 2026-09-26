import React, { useState } from 'react';
import { urlSegura } from '../utils/url-segura';
import { LeadItem } from '../types';
import { useLanguage } from '../i18n';
import { inyectarOndaRipple } from '../utils/ripple';

interface BentoCardProps {
  item: LeadItem;
  index: number;
  isUnlocked: boolean;
  unlockedData?: {
    phone: string;
    portal?: string;
    link?: string;
    realTitle?: string;
    realLocation?: string;
  };
  onUnlock: (item: LeadItem, index: number) => void;
}

/**
 * "Hace X horas" calculado en el navegador desde la fecha real de captura (timestamp_ms).
 * [2026-09-25] El cazador ya no guarda el texto "Hace 2 horas": se volvía viejo y obligaba a
 * reescribir los 150 inmuebles en cada publicación. Si falta la fecha, usa el texto antiguo.
 */
function tiempoRelativo(timestampMs?: number, fechaTexto?: string, isEn?: boolean): string {
  const ms = Number(timestampMs);
  if (!ms || Number.isNaN(ms)) return formatearFechaRelativa(fechaTexto, isEn);
  const min = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (min < 2) return isEn ? 'Just now' : '⚡ Justo ahora';
  if (min < 60) return isEn ? `${min}m ago` : `Hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return isEn ? `${horas}h ago` : `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return isEn ? `${dias}d ago` : `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  return isEn ? 'Recent' : 'Captado recientemente';
}

function formatearFechaRelativa(fecha?: string, isEn?: boolean): string {
  if (!fecha) return isEn ? 'Recent' : 'Reciente';
  if (!isEn) return fecha;
  const mMin = fecha.match(/(\d+)\s*(?:m|minutos|min)/i);
  if (mMin) return `${mMin[1]}m ago`;
  const mHoras = fecha.match(/(\d+)\s*(?:h|horas|hora)/i);
  if (mHoras) return `${mHoras[1]}h ago`;
  const mDias = fecha.match(/(\d+)\s*(?:d|días|dia|dias)/i);
  if (mDias) return `${mDias[1]}d ago`;
  return fecha.replace(/^Hace\s+/i, '').trim() + ' ago';
}

function formatearDatoSpecs(dato?: string, isEn?: boolean): string {
  if (!dato) return '';
  if (!isEn) {
    return dato
      .replace(/(\d+)\s*Beds?/gi, '$1 Hab')
      .replace(/(\d+)\s*Baths?/gi, '$1 Baños')
      .replace(/(\d+)\s*Parkings?/gi, '$1 Garajes');
  }
  return dato
    .replace(/(\d+)\s*Hab/gi, '$1 Beds')
    .replace('1 Beds', '1 Bed')
    .replace(/(\d+)\s*Baño[s]?/gi, '$1 Baths')
    .replace('1 Baths', '1 Bath')
    .replace(/(\d+)\s*Garaje[s]?/gi, '$1 Parking')
    .replace('1 Parkings', '1 Parking');
}

export const BentoCard: React.FC<BentoCardProps> = React.memo(({
  item,
  index,
  isUnlocked,
  unlockedData,
  onUnlock,
}) => {
  const { t, isEn, formatUSD } = useLanguage();
  const [activeSlide, setActiveSlide] = useState(0);
  const [isSlideupOpen, setIsSlideupOpen] = useState(false);

  const fotos = item.imagenes && item.imagenes.length > 0 ? item.imagenes : [item.imagen];

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSlide((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSlide((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
  };

  const phoneClean = unlockedData?.phone ? unlockedData.phone.replace(/\D/g, '') : '';
  const usdPrice = formatUSD(item.precio_raw || item.precio);

  const [isRevealed, setIsRevealed] = useState(false);
  const cardRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setIsRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsRevealed(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: '350px 0px 250px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <article 
      ref={cardRef}
      className={`bento-card ${isRevealed ? 'revealed' : ''} ${isUnlocked ? 'card-unlocked' : ''}`}
      style={{ '--enter-delay': `${(index % 6) * 0.05}s` } as React.CSSProperties}
      id={`card-${item.id}`}
      data-lead-id={item.id}
      data-ciudad={item.ciudad}
      data-tipo={item.tipo_inmueble}
    >
      {/* Media Wrapper */}
      <div 
        className="card-media-wrapper"
        onClick={() => setIsSlideupOpen(!isSlideupOpen)}
      >
        {fotos.length > 1 ? (
          <div className="carousel-track" id={`carousel-${index}`}>
            {fotos.map((foto, fIdx) => (
              <div 
                key={fIdx} 
                className={`carousel-slide ${fIdx === activeSlide ? 'active' : ''}`}
              >
                <img 
                  src={foto} 
                  alt={`${item.titulo} - Foto ${fIdx + 1}`} 
                  className="carousel-img"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80";
                  }}
                />
              </div>
            ))}
            <button 
              type="button"
              className="carousel-nav-btn prev"
              onClick={handlePrevSlide}
              title={isEn ? "Previous Photo" : "Foto Anterior"}
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button 
              type="button"
              className="carousel-nav-btn next"
              onClick={handleNextSlide}
              title={isEn ? "Next Photo" : "Siguiente Foto"}
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
            <div className="carousel-dots">
              {fotos.map((_, dotIdx) => (
                <span 
                  key={dotIdx} 
                  className={`carousel-dot ${dotIdx === activeSlide ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlide(dotIdx);
                  }}
                ></span>
              ))}
            </div>
          </div>
        ) : (
          <img 
            src={fotos[0]} 
            alt={item.titulo} 
            className="card-static-img"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80";
            }}
          />
        )}

        {fotos.length > 1 && (
          <span className="carousel-photo-badge">
            <i className="fa-regular fa-image"></i> {activeSlide + 1}/{fotos.length}
          </span>
        )}

        {/* Gradiente de fusión exacto de Origgo */}
        <div className="card-media-gradient"></div>

        <div className="card-floating-badges">
          <span className="badge-time-pill">
            <i className="fa-regular fa-clock"></i> 
            <span className="time-relative-text">
              {tiempoRelativo(item.timestamp_ms, item.fecha_relativa, isEn)}
            </span>
          </span>
          {item.urgencia && (
            <span className={`badge-status-pill ${item.urgencia_tipo || 'urgente'}`}>
              <i className="fa-solid fa-bolt"></i> {isEn && item.urgencia_en ? item.urgencia_en : item.urgencia}
            </span>
          )}
          {isUnlocked && (
            <span className="badge-status-pill arbitraje" style={{ background: 'hsla(158, 64%, 48%, 0.18)', color: 'var(--accent-emerald)' }}>
              <i className="fa-solid fa-unlock"></i> {t('card_unlocked_badge', 'Desbloqueado')}
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="card-body">
        <div>
          <div className="card-price-row">
            <div className="price-main" style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.35rem' }}>
              <span className="price-number">{item.precio}</span>
              {usdPrice && (
                <span className="card-price-usd" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {usdPrice}
                </span>
              )}
            </div>
            <button 
              type="button"
              className="btn-specs-pill"
              onClick={() => setIsSlideupOpen(!isSlideupOpen)}
              title={t('slideup_title', 'Ver Ficha')}
            >
              {isEn ? 'Specs' : 'Ficha'} <i className="fa-solid fa-chevron-up"></i>
            </button>
          </div>

          <div className="card-location">
            <i className="fa-solid fa-location-dot"></i>
            <span>
              {unlockedData?.realLocation || `${(isEn && item.tipo_inmueble_en ? item.tipo_inmueble_en : item.tipo_inmueble) || (item.tipo_operacion === 'arriendo' ? (isEn ? 'Rent' : 'Arriendo') : (isEn ? 'Sale' : 'Venta'))} · ${item.barrio}, ${item.ciudad}`}
            </span>
          </div>

          <h3 
            className="card-title" 
            title={unlockedData?.realTitle || (isEn && item.titulo_en ? item.titulo_en : item.titulo)}
            onClick={() => setIsSlideupOpen(!isSlideupOpen)}
          >
            {unlockedData?.realTitle || (isEn && item.titulo_en ? item.titulo_en : item.titulo)}
          </h3>

          {(item.dato_1 || item.dato_2) && (
            <div 
              className="card-specs-inline"
              onClick={() => setIsSlideupOpen(!isSlideupOpen)}
              title={isEn ? "Click to view full specs" : "Click para ver ficha completa"}
            >
              <i className="fa-solid fa-ruler-combined"></i>
              <span>{[formatearDatoSpecs(item.dato_1, isEn), formatearDatoSpecs(item.dato_2, isEn)].filter(Boolean).join(' · ')}</span>
            </div>
          )}

          {isUnlocked && unlockedData?.phone && (
            <div className="card-contact-phone-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.75rem', background: 'var(--accent-emerald-bg)', border: '1px solid var(--accent-emerald)', borderRadius: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                <i className="fa-solid fa-phone" style={{ marginRight: 6 }}></i>
                <strong>{unlockedData.phone}</strong>
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-user-check"></i> {isEn ? 'Owner' : 'Dueño'}
              </span>
            </div>
          )}
        </div>

        <div className="card-bottom-row">
          {isUnlocked && !phoneClean ? (
            // Desbloqueado sin teléfono en el anuncio: se lleva al anuncio original, sin inventar números.
            <a
              href={urlSegura(unlockedData?.link) || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-unlock-lead"
              style={{ width: '100%', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <i className="fa-solid fa-arrow-up-right-from-square"></i> {isEn ? 'View Original Ad' : 'Ver Anuncio Original'}
            </a>
          ) : isUnlocked ? (
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              <a 
                href={`https://wa.me/${phoneClean}?text=Hola%2C%20vi%20tu%20anuncio%20directo%20en%20Origgo`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-unlock-lead"
                onPointerDown={(e) => inyectarOndaRipple(e.currentTarget, e)}
                style={{ flex: 1, background: '#10B981', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <i className="fa-brands fa-whatsapp"></i> {t('card_whatsapp', 'WhatsApp')}
              </a>
              <a 
                href={`tel:${unlockedData?.phone}`} 
                className="btn-unlock-lead"
                onPointerDown={(e) => inyectarOndaRipple(e.currentTarget, e)}
                style={{ flex: 1, background: 'var(--bg-card-inner)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <i className="fa-solid fa-phone"></i> {t('card_call', 'Llamar')}
              </a>
            </div>
          ) : (
            <button 
              type="button" 
              className="btn-unlock-lead btn-action-primary"
              onPointerDown={(e) => inyectarOndaRipple(e.currentTarget, e)}
              onClick={() => onUnlock(item, index)}
            >
              <i className="fa-solid fa-unlock-keyhole"></i>
              <span>{t('card_unlock_btn', 'Desbloquear Contacto Directo')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Slideup Overlay Integrado */}
      <div className={`card-slideup-overlay ${isSlideupOpen ? 'active' : ''}`}>
        <div className="slideup-header">
          <div className="slideup-title">
            <i className="fa-solid fa-circle-info"></i> {t('slideup_title', 'Ficha Técnica Directa')}
          </div>
          <button 
            type="button" 
            className="btn-slideup-close" 
            onClick={() => setIsSlideupOpen(false)}
            title={t('slideup_close_title', 'Cerrar Ficha')}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="slideup-body">
          <div className="slideup-specs-grid">
            {item.precio_m2 && (
              <div className="slideup-spec-card">
                <span className="slideup-spec-key"><i className="fa-solid fa-calculator"></i> {isEn ? 'Value / m²' : 'Valor por m²'}</span>
                <span className="slideup-spec-val">{item.precio_m2}</span>
              </div>
            )}
            {item.descuento_arbitraje && (
              <div className="slideup-spec-card highlight-arbitrage">
                <span className="slideup-spec-key"><i className="fa-solid fa-chart-line"></i> {isEn ? 'Arbitrage Margin' : 'Margen Arbitraje'}</span>
                <span className="slideup-spec-val">-{item.descuento_arbitraje}% {isEn ? 'vs Median' : 'vs Mediana'}</span>
              </div>
            )}
            <div className="slideup-spec-card">
              <span className="slideup-spec-key"><i className="fa-solid fa-building-flag"></i> {isEn ? 'Source Portal' : 'Portal Origen'}</span>
              <span className="slideup-spec-val">{item.portal || (isEn ? 'Direct' : 'Directo')}</span>
            </div>
            {/* Código visible (estándar de portales): permite pedir el retiro del anuncio exacto (Habeas Data). */}
            <div className="slideup-spec-card">
              <span className="slideup-spec-key"><i className="fa-solid fa-hashtag"></i> {isEn ? 'Listing code' : 'Código del inmueble'}</span>
              <span className="slideup-spec-val" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', userSelect: 'all' }}>{item.id}</span>
            </div>
            {item.dato_1 && (
              <div className="slideup-spec-card">
                <span className="slideup-spec-key"><i className="fa-solid fa-ruler-combined"></i> {t('slideup_spec_area', 'Área')}</span>
                <span className="slideup-spec-val">{formatearDatoSpecs(item.dato_1, isEn)}</span>
              </div>
            )}
            {item.dato_2 && (
              <div className="slideup-spec-card">
                <span className="slideup-spec-key"><i className="fa-solid fa-bed"></i> {t('slideup_spec_rooms', 'Distribución')}</span>
                <span className="slideup-spec-val">{formatearDatoSpecs(item.dato_2, isEn)}</span>
              </div>
            )}
          </div>

          <div style={{ background: 'var(--glass-metrics-bg)', border: '1px solid var(--border-subtle)', borderRadius: '0.95rem', padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <i className="fa-solid fa-shield-halved"></i> {t('slideup_trust_badge', 'Trato Directo con el Propietario')}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
              {t('slideup_trust_desc', 'Inmueble publicado directamente por su propietario legítimo. Cero comisiones inmobiliarias y sin sobrecostos de intermediación, listo para llamada o WhatsApp directo.')}
            </p>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
            {isUnlocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {phoneClean && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <a 
                    href={`https://wa.me/${phoneClean}?text=Hola%2C%20vi%20tu%20anuncio%20directo%20en%20Origgo`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn-unlock-lead"
                    onPointerDown={(e) => inyectarOndaRipple(e.currentTarget, e)}
                    style={{ flex: 1, background: '#10B981', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <i className="fa-brands fa-whatsapp"></i> {t('card_whatsapp', 'WhatsApp')}
                  </a>
                  <a 
                    href={`tel:${unlockedData?.phone}`} 
                    className="btn-unlock-lead"
                    onPointerDown={(e) => inyectarOndaRipple(e.currentTarget, e)}
                    style={{ flex: 1, background: 'var(--bg-card-inner)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <i className="fa-solid fa-phone"></i> {t('card_call', 'Llamar')}
                  </a>
                </div>
                )}
                {urlSegura(unlockedData?.link) && (
                  <a
                    href={urlSegura(unlockedData.link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-unlock-lead"
                    onPointerDown={(e) => inyectarOndaRipple(e.currentTarget, e)}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem' }}
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square"></i> {isEn ? 'View Original Source Ad' : 'Ver Anuncio Original'}
                  </a>
                )}
              </div>
            ) : (
              <button 
                type="button" 
                className="btn-unlock-lead btn-action-primary"
                onPointerDown={(e) => inyectarOndaRipple(e.currentTarget, e)}
                onClick={() => onUnlock(item, index)}
              >
                <i className="fa-solid fa-unlock-keyhole"></i> {t('slideup_cta_btn', 'Desbloquear Contacto del Dueño')}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
});
