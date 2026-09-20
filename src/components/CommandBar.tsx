import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n';

interface CommandBarProps {
  searchQuery: string;
  selectedCity: string;
  selectedSort: string;
  selectedOperation: string;
  selectedNiche: string;
  onSearchChange: (q: string) => void;
  onCityChange: (city: string) => void;
  onSortChange: (sort: string) => void;
  onOperationChange: (op: string) => void;
  onNicheChange: (niche: string) => void;
  onResetFilters: () => void;
}

const CITIES = [
  { id: '', name: 'Colombia (Todas)', enName: 'Colombia (All)', icon: 'fa-solid fa-earth-americas' },
  { id: 'Santa Marta', name: 'Santa Marta', enName: 'Santa Marta', icon: 'fa-solid fa-umbrella-beach' },
  { id: 'Bogotá', name: 'Bogotá D.C.', enName: 'Bogota D.C.', icon: 'fa-solid fa-city' },
  { id: 'Medellín', name: 'Medellín / Envigado', enName: 'Medellin / Envigado', icon: 'fa-solid fa-mountain-city' },
  { id: 'Cali', name: 'Cali', enName: 'Cali', icon: 'fa-solid fa-tree-city' },
  { id: 'Barranquilla', name: 'Barranquilla', enName: 'Barranquilla', icon: 'fa-solid fa-anchor' },
  { id: 'Cartagena', name: 'Cartagena', enName: 'Cartagena', icon: 'fa-solid fa-monument' },
  { id: 'Bucaramanga', name: 'Bucaramanga', enName: 'Bucaramanga', icon: 'fa-solid fa-building' },
  { id: 'Pereira', name: 'Pereira / Eje Cafetero', enName: 'Pereira / Coffee Region', icon: 'fa-solid fa-mug-hot' },
  { id: 'Ibagué', name: 'Ibagué', enName: 'Ibague', icon: 'fa-solid fa-music' }
];

export const CommandBar: React.FC<CommandBarProps> = ({
  searchQuery,
  selectedCity,
  selectedSort,
  selectedOperation,
  selectedNiche,
  onSearchChange,
  onCityChange,
  onSortChange,
  onOperationChange,
  onNicheChange,
  onResetFilters,
}) => {
  const { t, isEn } = useLanguage();
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [opDropdownOpen, setOpDropdownOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setCityDropdownOpen(false);
        setSortDropdownOpen(false);
        setOpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const SORTS = [
    { id: 'recientes', name: t('sort_recent', 'Más Recientes'), icon: 'fa-solid fa-bolt' },
    { id: 'precio_m2_asc', name: t('sort_m2_asc', 'Menor $/m²'), icon: 'fa-solid fa-calculator' },
    { id: 'rebajas', name: t('sort_rebajas', 'Rebaja Reciente'), icon: 'fa-solid fa-tag' },
    { id: 'precio_asc', name: t('sort_price_asc', 'Precio: Menor a Mayor'), icon: 'fa-solid fa-arrow-up-1-9' },
    { id: 'precio_desc', name: t('sort_price_desc', 'Precio: Mayor a Menor'), icon: 'fa-solid fa-arrow-down-9-1' }
  ];

  const OPERATIONS = [
    { id: 'todos', name: t('filter_op_all', 'Todas las operaciones'), icon: 'fa-solid fa-tag' },
    { id: 'venta', name: t('filter_op_sale', 'En Venta'), icon: 'fa-solid fa-house-chimney' },
    { id: 'arriendo', name: t('filter_op_rent', 'En Arriendo'), icon: 'fa-solid fa-key' }
  ];

  const foundCity = CITIES.find(c => c.id === selectedCity);
  const currentCityLabel = foundCity ? (isEn ? foundCity.enName : foundCity.name) : t('filter_all_cities', 'Todas las Ciudades');
  const currentSortLabel = SORTS.find(s => s.id === selectedSort)?.name || t('sort_recent', 'Más Recientes');
  const currentOpLabel = OPERATIONS.find(o => o.id === selectedOperation)?.name || t('filter_op_all', 'Operación');

  const hasActiveFilters = searchQuery !== '' || selectedCity !== '' || selectedOperation !== 'todos' || selectedNiche !== 'todos';

  return (
    <div className="command-bar-wrapper" ref={containerRef} id="commandBarWrapper">
      <div className="command-bar-container">
        {/* Caja de Búsqueda Omnibox */}
        <div className="cmd-search-box">
          <i className="fa-solid fa-magnifying-glass cmd-search-icon"></i>
          <input 
            type="text" 
            id="omniboxSearch" 
            className="cmd-search-input" 
            placeholder={t('search_placeholder', 'Buscar por barrio, ciudad o palabra clave...')} 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {searchQuery && (
            <button 
              type="button" 
              id="cmdSearchClear" 
              className="cmd-search-clear" 
              title={t('search_clear', 'Limpiar búsqueda')} 
              aria-label={t('search_clear', 'Limpiar búsqueda')}
              onClick={() => onSearchChange('')}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>

        {/* Grupo de Filtros Desplegables */}
        <div className="cmd-filters-group">
          {/* Dropdown Ciudad */}
          <div className="cmd-filter-pill-dropdown-wrapper">
            <button 
              type="button" 
              className={`cmd-filter-pill ${selectedCity ? 'active' : ''}`}
              id="cmdFilterLocation" 
              aria-expanded={cityDropdownOpen} 
              title={t('filter_all_cities', 'Filtrar por ciudad')}
              onClick={() => {
                setCityDropdownOpen(!cityDropdownOpen);
                setSortDropdownOpen(false);
                setOpDropdownOpen(false);
              }}
            >
              <i className="fa-solid fa-location-dot"></i>
              <span id="cmdFilterLocationLabel">{currentCityLabel}</span>
              <i className="fa-solid fa-chevron-down cmd-dropdown-arrow"></i>
            </button>
            {cityDropdownOpen && (
              <div className="cmd-dropdown-menu" id="cmdLocationDropdown" style={{ display: 'flex' }}>
                {CITIES.map((c) => (
                  <div 
                    key={c.id} 
                    className={`cmd-dropdown-item ${selectedCity === c.id ? 'active' : ''}`}
                    onClick={() => {
                      onCityChange(c.id);
                      setCityDropdownOpen(false);
                    }}
                  >
                    <i className={c.icon}></i>
                    <span>{isEn ? c.enName : c.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dropdown Ordenamiento */}
          <div className="cmd-filter-pill-dropdown-wrapper">
            <button 
              type="button" 
              className={`cmd-filter-pill ${selectedSort !== 'recientes' ? 'active' : ''}`}
              id="cmdFilterSort" 
              aria-expanded={sortDropdownOpen} 
              title={t('sort_placeholder', 'Ordenar')}
              onClick={() => {
                setSortDropdownOpen(!sortDropdownOpen);
                setCityDropdownOpen(false);
                setOpDropdownOpen(false);
              }}
            >
              <i className="fa-solid fa-arrow-down-wide-short"></i>
              <span id="cmdFilterSortLabel">{currentSortLabel}</span>
              <i className="fa-solid fa-chevron-down cmd-dropdown-arrow"></i>
            </button>
            {sortDropdownOpen && (
              <div className="cmd-dropdown-menu" id="cmdSortDropdown" style={{ display: 'flex' }}>
                {SORTS.map((s) => (
                  <div 
                    key={s.id} 
                    className={`cmd-dropdown-item ${selectedSort === s.id ? 'active' : ''}`}
                    onClick={() => {
                      onSortChange(s.id);
                      setSortDropdownOpen(false);
                    }}
                  >
                    <i className={s.icon}></i>
                    <span>{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dropdown Operación (Venta / Arriendo) */}
          <div className="cmd-filter-pill-dropdown-wrapper">
            <button 
              type="button" 
              className={`cmd-filter-pill ${selectedOperation !== 'todos' ? 'active' : ''}`}
              id="cmdFilterOperation" 
              aria-expanded={opDropdownOpen} 
              title={t('filter_op_all', 'Tipo de operación')}
              onClick={() => {
                setOpDropdownOpen(!opDropdownOpen);
                setCityDropdownOpen(false);
                setSortDropdownOpen(false);
              }}
            >
              <i className="fa-solid fa-tag"></i>
              <span>{currentOpLabel}</span>
              <i className="fa-solid fa-chevron-down cmd-dropdown-arrow"></i>
            </button>
            {opDropdownOpen && (
              <div className="cmd-dropdown-menu" id="cmdOperationDropdown" style={{ display: 'flex' }}>
                {OPERATIONS.map((o) => (
                  <div 
                    key={o.id} 
                    className={`cmd-dropdown-item ${selectedOperation === o.id ? 'active' : ''}`}
                    onClick={() => {
                      onOperationChange(o.id);
                      setOpDropdownOpen(false);
                    }}
                  >
                    <i className={o.icon}></i>
                    <span>{o.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón de limpiar filtros activos */}
          {hasActiveFilters && (
            <button 
              type="button" 
              className="cmd-filter-pill" 
              style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              onClick={onResetFilters}
              title={t('catalog_btn_reset', 'Restablecer todos los filtros')}
            >
              <i className="fa-solid fa-filter-circle-xmark"></i>
              <span>{isEn ? 'Reset Filters' : 'Limpiar Filtros'}</span>
            </button>
          )}
        </div>

        {/* Pestañas de Nicho / Oportunidades */}
        <div className="cmd-niche-group">
          <button 
            type="button" 
            className={`cmd-niche-tab ${selectedNiche === 'todos' ? 'active' : ''}`}
            onClick={() => onNicheChange('todos')}
          >
            <i className="fa-solid fa-layer-group"></i> <span>{isEn ? 'All' : 'Todos'}</span>
          </button>
          <button 
            type="button" 
            className={`cmd-niche-tab ${selectedNiche === 'rebajas' ? 'active' : ''}`}
            onClick={() => onNicheChange('rebajas')}
          >
            <i className="fa-solid fa-arrow-trend-down"></i> <span>{isEn ? 'Price Drops' : 'Rebajas Urgentes'}</span>
          </button>
          <button 
            type="button" 
            className={`cmd-niche-tab ${selectedNiche === 'arbitraje' ? 'active' : ''}`}
            onClick={() => onNicheChange('arbitraje')}
          >
            <i className="fa-solid fa-chart-line"></i> <span>{isEn ? 'Arbitrage' : 'Arbitraje'}</span>
          </button>
          <button 
            type="button" 
            className={`cmd-niche-tab ${selectedNiche === 'apartamentos' ? 'active' : ''}`}
            onClick={() => onNicheChange('apartamentos')}
          >
            <i className="fa-solid fa-building"></i> <span>{isEn ? 'Apartments' : 'Apartamentos'}</span>
          </button>
          <button 
            type="button" 
            className={`cmd-niche-tab ${selectedNiche === 'casas' ? 'active' : ''}`}
            onClick={() => onNicheChange('casas')}
          >
            <i className="fa-solid fa-house"></i> <span>{isEn ? 'Houses' : 'Casas'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
