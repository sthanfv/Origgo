import React from 'react';
import { LeadItem } from '../types';
import { BentoCard } from './BentoCard';
import { useLanguage } from '../i18n';
import { inyectarOndaRipple } from '../utils/ripple';

const ITEMS_PER_PAGE = 15;

interface BentoGridProps {
  leads: LeadItem[];
  currentPage: number;
  onPageChange: (page: number) => void;
  unlockedMap: Record<string, {
    phone: string;
    portal?: string;
    link?: string;
    realTitle?: string;
    realLocation?: string;
  }>;
  onUnlock: (item: LeadItem, index: number) => void;
  onResetFilters: () => void;
}

export const BentoGrid: React.FC<BentoGridProps> = ({
  leads,
  currentPage,
  onPageChange,
  unlockedMap,
  onUnlock,
  onResetFilters,
}) => {
  const { t, isEn } = useLanguage();

  const totalPages = Math.max(1, Math.ceil(leads.length / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, leads.length);
  const currentLeads = leads.slice(startIndex, endIndex);

  const scrollToCatalogTop = () => {
    const el = document.getElementById('catalogHeaderRow');
    if (el) {
      const topOffset = el.getBoundingClientRect().top + window.pageYOffset - 90;
      window.scrollTo({ top: topOffset, behavior: 'smooth' });
    }
  };

  const handlePageSelect = (page: number, e?: React.MouseEvent) => {
    if (e) inyectarOndaRipple(e.currentTarget as HTMLElement, e);
    onPageChange(page);
    scrollToCatalogTop();
  };

  // Generar lista concisa de números de página
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, safePage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <section className="showcase-container" id="catalogShowcaseSection">
      {/* Cabecera del Catálogo */}
      <div className="catalog-header-row" id="catalogHeaderRow">
        <div className="catalog-title-group">
          <span className="catalog-eyebrow">{t('catalog_eyebrow', 'PORTAFOLIO VERIFICADO')}</span>
          <h2 className="catalog-heading" id="catalogHeading">
            {t('catalog_heading', 'Inmuebles Directos en Colombia')}
          </h2>
        </div>
        <div className="catalog-meta-controls">
          <span className="catalog-count-pill" id="catalogCountPill">
            <span className="status-pulse"></span>
            <span id="catalogCountText">
              {leads.length}{' '}
              {leads.length === 1
                ? t('catalog_count_single', 'oportunidad directa')
                : t('catalog_count_suffix', 'oportunidades directas')}
              {leads.length > ITEMS_PER_PAGE && (
                <span style={{ opacity: 0.75, marginLeft: '4px', fontWeight: 600 }}>
                  ({startIndex + 1}–{endIndex})
                </span>
              )}
            </span>
          </span>
          <span className="catalog-freshness" id="catalogFreshness">
            <span className="freshness-dot"></span>
            <span id="catalogFreshnessText">
              {isEn ? 'Updated just now' : 'Actualizado hace un momento'}
            </span>
          </span>
        </div>
      </div>

      {/* Grid Bento */}
      {leads.length > 0 ? (
        <>
          <div className="bento-grid" id="bentoGridContainer">
            {currentLeads.map((item, index) => {
              const isUnlocked = !!unlockedMap[item.id];
              const unlockedData = unlockedMap[item.id];

              return (
                <BentoCard
                  key={item.id}
                  item={item}
                  index={index}
                  isUnlocked={isUnlocked}
                  unlockedData={unlockedData}
                  onUnlock={onUnlock}
                />
              );
            })}
          </div>

          {/* Controles de Paginación Táctiles (Desktop & Mobile) */}
          {totalPages > 1 && (
            <div className="pagination-controls" id="catalogPaginationControls" role="navigation" aria-label="Paginación del catálogo">
              <button
                type="button"
                className="btn-pagination"
                id="btnPaginationPrev"
                disabled={safePage <= 1}
                onClick={(e) => handlePageSelect(safePage - 1, e)}
                aria-label={isEn ? "Go to previous page" : "Ir a la página anterior"}
              >
                <i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
                <span>{isEn ? 'Previous' : 'Anterior'}</span>
              </button>

              <div className="pagination-pages-list">
                {getPageNumbers().map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    className={`btn-page-number ${pageNum === safePage ? 'active' : ''}`}
                    onClick={(e) => handlePageSelect(pageNum, e)}
                    aria-label={`${isEn ? 'Page' : 'Página'} ${pageNum}`}
                    aria-current={pageNum === safePage ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <span className="pagination-info">
                {isEn ? `Page ${safePage} of ${totalPages}` : `Página ${safePage} de ${totalPages}`}
              </span>

              <button
                type="button"
                className="btn-pagination"
                id="btnPaginationNext"
                disabled={safePage >= totalPages}
                onClick={(e) => handlePageSelect(safePage + 1, e)}
                aria-label={isEn ? "Go to next page" : "Ir a la página siguiente"}
              >
                <span>{isEn ? 'Next' : 'Siguiente'}</span>
                <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
              </button>
            </div>
          )}
        </>
      ) : (
        <div 
          style={{ 
            textAlign: 'center', 
            padding: '4rem 1.5rem', 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-card)', 
            borderRadius: '2rem',
            margin: '2rem 0'
          }}
        >
          <i className="fa-solid fa-filter-circle-xmark" style={{ fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: '1rem' }}></i>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
            {t('catalog_empty_title', 'No se encontraron oportunidades en esta zona')}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
            {t('catalog_empty_desc', 'No hay inmuebles directos con los filtros activos. Puedes explorar otras ciudades o reiniciar los filtros.')}
          </p>
          <button 
            type="button" 
            className="btn-unlock-lead btn-action-primary"
            style={{ width: 'auto', padding: '0.75rem 1.5rem', margin: '0 auto' }}
            onClick={onResetFilters}
          >
            {t('catalog_btn_reset', 'Reiniciar todos los filtros')}
          </button>
        </div>
      )}
    </section>
  );
};
