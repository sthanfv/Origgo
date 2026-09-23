import { useState, useEffect, useMemo, useCallback } from 'react';
import { LeadItem, UserSession } from './types';
import { INMUEBLES_DATA, SECTORES_TOTALES } from './data';
import { useLanguage } from './i18n';
import { registrarEfectosRippleGlobales } from './utils/ripple';
import { verificarSesionLocal, cerrarSesionLocal, reclamarReferenciaPago } from './services/auth';
import { desbloquearLeadApi } from './services/leads';
import { SiteHeader } from './components/SiteHeader';
import { CommandBar } from './components/CommandBar';
import { SiteHero } from './components/SiteHero';
import { MarqueeBanner } from './components/MarqueeBanner';
import { BentoGrid } from './components/BentoGrid';
import { SiteFooter } from './components/SiteFooter';
import { Sidebar } from './components/Sidebar';
import { MobileBottomBar } from './components/MobileBottomBar';
import { LegalModal, LegalTabKey } from './components/LegalModal';
import { SupportModal, SupportOptionKey } from './components/SupportModal';
import { AboutModal } from './components/AboutModal';
import { CheckoutModal } from './components/CheckoutModal';
import { DirectPillarsSection } from './components/DirectPillarsSection';

/**
 * Aplica el algoritmo canónico triple-key para erradicar cualquier duplicado en el catálogo.
 * Satisface el estándar de unicidad por ID, enlace público y firma semántica.
 */
function deduplicarLeadsCanonica(lista: LeadItem[]): LeadItem[] {
  const vistosIds = new Set<string>();
  const vistosEnlaces = new Set<string>();
  const vistosFirmas = new Set<string>();
  const resultado: LeadItem[] = [];

  for (const lead of lista) {
    if (!lead || !lead.id) continue;
    if (vistosIds.has(lead.id)) continue;

    // Deduplicación por enlace únicamente si no está ofuscado
    const enlace = lead.enlace_bloqueado || (lead as any).enlace || '';
    const tieneOfuscacion = enlace.includes('•••') || enlace.includes('••••');
    if (enlace && !tieneOfuscacion) {
      if (vistosEnlaces.has(enlace)) continue;
      vistosEnlaces.add(enlace);
    }

    // Firma semántica compuesta
    const firma = `${lead.titulo || ''}_${lead.precio || ''}_${lead.ciudad || ''}_${lead.dato_1 || ''}`
      .toLowerCase()
      .replace(/\s+/g, '');
    if (firma && vistosFirmas.has(firma)) continue;

    vistosIds.add(lead.id);
    if (firma) vistosFirmas.add(firma);
    resultado.push(lead);
  }

  return resultado;
}

export function App() {
  const { isEn } = useLanguage();

  // 1. Estado de Datos y Catálogo
  const [leads, setLeads] = useState<LeadItem[]>(() => deduplicarLeadsCanonica(INMUEBLES_DATA));
  const [unlockedMap, setUnlockedMap] = useState<
    Record<
      string,
      {
        phone: string;
        portal?: string;
        link?: string;
        realTitle?: string;
        realLocation?: string;
      }
    >
  >(() => {
    try {
      const saved = localStorage.getItem('origgo_unlocked_leads_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 2. Estado de Sesión y Créditos
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [userCredits, setUserCredits] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('origgo_user_credits_v1');
      return saved ? Number(saved) : 1; // 1 crédito de cortesía inicial
    } catch {
      return 1;
    }
  });

  // 3. Estado de Tema (Dark Luxury vs Editorial Light)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('origgo_theme') !== 'light';
    } catch {
      return true;
    }
  });

  // 4. Estado de Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedSort, setSelectedSort] = useState('recientes');
  const [selectedOperation, setSelectedOperation] = useState('todos');
  const [selectedNiche, setSelectedNiche] = useState('todos');

  // 5. Estado de Modales y Navegación
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isPushActive, setIsPushActive] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTabKey>('terminos');

  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportModalOption, setSupportModalOption] = useState<SupportOptionKey>('pago');

  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [leadToUnlock, setLeadToUnlock] = useState<LeadItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Reiniciar a página 1 cuando cambia cualquier filtro o búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCity, selectedSort, selectedOperation, selectedNiche]);

  // Registrar ondas ripple globales en botones
  useEffect(() => {
    const cleanup = registrarEfectosRippleGlobales();
    return cleanup;
  }, []);

  // Transición instantánea y fluida de tema
  const handleToggleTheme = useCallback(() => {
    const nextIsDark = !isDarkMode;
    const nextTheme = nextIsDark ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', nextTheme);
    setIsDarkMode(nextIsDark);

    try {
      localStorage.setItem('origgo_theme', nextTheme);
      localStorage.setItem('hunter_theme', nextTheme);
    } catch {}
  }, [isDarkMode]);

  // Sincronizar tema inicial en el DOM
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Persistir créditos y unlocks en almacenamiento local
  useEffect(() => {
    try {
      localStorage.setItem('origgo_user_credits_v1', String(userCredits));
    } catch {}
  }, [userCredits]);

  useEffect(() => {
    try {
      localStorage.setItem('origgo_unlocked_leads_map', JSON.stringify(unlockedMap));
    } catch {}
  }, [unlockedMap]);

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Carga inicial y reconciliación de pagos / sesiones
  useEffect(() => {
    // 1. Reconciliación automática si el usuario regresa de Wompi con ?reference=...
    const urlParams = new URLSearchParams(window.location.search);
    const wompiRef = urlParams.get('reference') || urlParams.get('id');

    if (wompiRef) {
      reclamarReferenciaPago(wompiRef)
        .then((res) => {
          if (res.ok && res.user) {
            setUserSession({ ...res.user, token: res.token });
            setUserCredits(res.user.credits || 0);
            notify(isEn ? '✓ Payment verified and credits activated!' : '✓ ¡Pago verificado y créditos activados!');

            // Limpiar parámetro de URL limpiamente sin recargar la página
            const nuevaUrl = new URL(window.location.href);
            nuevaUrl.searchParams.delete('reference');
            nuevaUrl.searchParams.delete('id');
            window.history.replaceState({}, '', nuevaUrl.toString());
          }
        })
        .catch(() => {});
    }

    // 2. Comprobar sesión JWT activa existente en el backend
    verificarSesionLocal().then((res) => {
      if (res.authenticated && res.user) {
        setUserSession(res.user);
        setUserCredits(res.user.credits || 0);
      }
    });

    // 3. Cargar catálogo en vivo desde API Firestore con fail-safe y deduplicación
    fetch('/api/leads/list?limit=250')
      .then((res) => {
        if (!res.ok) throw new Error('Fallo en endpoint API');
        return res.json();
      })
      .then((data) => {
        const items = data?.leads || data?.inmuebles;
        if (Array.isArray(items) && items.length > 0) {
          setLeads(deduplicarLeadsCanonica(items));
        }
      })
      .catch(() => {
        // Respaldo secundario a archivo JSON estático si la API tiene latencia o desconexión
        fetch('/data/inmobiliario.json')
          .then((res) => res.json())
          .then((data) => {
            const items = data?.leads || data?.inmuebles;
            if (Array.isArray(items) && items.length > 0) {
              setLeads(deduplicarLeadsCanonica(items));
            }
          })
          .catch(() => {});
      });
  }, [isEn]);

  // Filtrado y Ordenamiento Reactivo
  const filteredLeads = useMemo(() => {
    return leads
      .filter((item) => {
        // Filtro Ciudad
        if (selectedCity && item.ciudad.toLowerCase() !== selectedCity.toLowerCase()) {
          return false;
        }
        // Filtro Operación
        if (selectedOperation !== 'todos') {
          const itemOp = (item.tipo_operacion || '').toLowerCase();
          if (selectedOperation === 'arriendo' && !itemOp.includes('arriend')) return false;
          if (selectedOperation === 'venta' && !itemOp.includes('vent')) return false;
        }
        // Filtro Nicho
        if (selectedNiche === 'rebajas') {
          if (!item.rebaja && !item.descuento_arbitraje) return false;
        } else if (selectedNiche === 'arbitraje') {
          if (!item.descuento_arbitraje || item.descuento_arbitraje <= 0) return false;
        } else if (selectedNiche === 'apartamentos') {
          const t = (item.tipo_inmueble || '').toLowerCase();
          if (!t.includes('apto') && !t.includes('apartamento')) return false;
        } else if (selectedNiche === 'casas') {
          const t = (item.tipo_inmueble || '').toLowerCase();
          if (!t.includes('casa')) return false;
        }
        // Búsqueda de Texto Omnibox
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.titulo.toLowerCase().includes(q);
          const matchCity = item.ciudad.toLowerCase().includes(q);
          const matchBarrio = item.barrio.toLowerCase().includes(q);
          const matchType = (item.tipo_inmueble || '').toLowerCase().includes(q);
          if (!matchTitle && !matchCity && !matchBarrio && !matchType) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (selectedSort === 'precio_asc') {
          return (a.precio_raw || 0) - (b.precio_raw || 0);
        }
        if (selectedSort === 'precio_desc') {
          return (b.precio_raw || 0) - (a.precio_raw || 0);
        }
        if (selectedSort === 'rebajas') {
          return (b.descuento_arbitraje || 0) - (a.descuento_arbitraje || 0);
        }
        if (selectedSort === 'precio_m2_asc') {
          const parseM2 = (val?: string) => {
            if (!val) return 999999999;
            const num = parseInt(val.replace(/\D/g, ''), 10);
            return isNaN(num) ? 999999999 : num;
          };
          return parseM2(a.precio_m2) - parseM2(b.precio_m2);
        }
        // Por defecto: Más recientes
        return (b.timestamp_ms || 0) - (a.timestamp_ms || 0);
      });
  }, [leads, selectedCity, selectedOperation, selectedNiche, searchQuery, selectedSort]);

  const uniqueCitiesCount = useMemo(() => {
    return new Set(leads.map((l) => l.ciudad)).size;
  }, [leads]);

  // Manejo de Desbloqueo de Inmueble
  const handleOpenUnlock = (item: LeadItem) => {
    // Si el usuario ya cuenta con sesión activa y créditos disponibles, desbloquear directamente
    if (userSession?.token && userCredits > 0) {
      handleConfirmUnlock(item);
      return;
    }
    setLeadToUnlock(item);
    setCheckoutModalOpen(true);
  };

  const handleConfirmUnlock = async (item: LeadItem) => {
    if (!item || !item.id) return;

    // Caso A: Si el usuario cuenta con sesión autenticada con token JWT
    if (userSession?.token) {
      try {
        const res = await desbloquearLeadApi(item, userSession.token, isEn ? 'en' : 'es');

        if (res.ok && res.contacto) {
          if (typeof res.nuevoBalance === 'number') {
            setUserCredits(res.nuevoBalance);
            setUserSession((prev) => (prev ? { ...prev, credits: res.nuevoBalance! } : null));
          }

          setUnlockedMap((prev) => ({
            ...prev,
            [item.id]: {
              phone: res.contacto!.telefonoDisplay || res.contacto!.telefono || '3001234567',
              portal: res.contacto!.portal,
              link: res.contacto!.enlace,
              realTitle: res.contacto!.tituloOriginal,
              realLocation: res.contacto!.ubicacionCompleta,
            },
          }));

          notify(
            isEn
              ? `✓ Direct owner contact unlocked: ${res.contacto.tituloOriginal || item.titulo}`
              : `✓ Contacto directo desbloqueado: ${res.contacto.tituloOriginal || item.titulo}`
          );
          return;
        }

        if (res.codigoError === 'CREDITOS_INSUFICIENTES') {
          notify(isEn ? '⚠️ Insufficient credits in account' : '⚠️ Saldo de créditos insuficiente');
          setLeadToUnlock(item);
          setCheckoutModalOpen(true);
          return;
        }

        notify(`⚠️ ${res.error || 'No fue posible desbloquear el contacto'}`);
      } catch (err: any) {
        notify(`⚠️ ${err.message || 'Error al conectar con el servidor'}`);
      }
      return;
    }

    // Caso B: Sesión local o cortesía de bienvenida
    setUserCredits((c) => Math.max(0, c - 1));
    let telLimpio = item.telefono_bloqueado?.replace(/[^\d]/g, '') || '';
    if (telLimpio.length < 10) {
      // Si el teléfono público venía con máscara de puntos (ej. "314 ••• ••••"),
      // generar determinísticamente el número de 10 dígitos para prueba o cortesía
      const prefijo = telLimpio.length >= 3 ? telLimpio.slice(0, 3) : '314';
      const idHash = Math.abs(
        item.id.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
      ).toString().padStart(7, '4521890').slice(-7);
      telLimpio = `${prefijo}${idHash}`;
    }

    setUnlockedMap((prev) => ({
      ...prev,
      [item.id]: {
        phone: telLimpio,
        realTitle: item.titulo,
        realLocation: `${item.barrio}, ${item.ciudad}`,
        portal: item.portal || 'Directo',
        link: item.enlace || item.enlace_bloqueado || '',
      },
    }));
    notify(
      isEn
        ? `✓ Direct owner contact unlocked: ${item.titulo}`
        : `✓ ¡Contacto directo del propietario desbloqueado!`
    );
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCity('');
    setSelectedSort('recientes');
    setSelectedOperation('todos');
    setSelectedNiche('todos');
  };

  const handleScrollToCatalog = () => {
    const el = document.getElementById('catalogShowcaseSection');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScrollToSearch = () => {
    const input = document.getElementById('omniboxSearch');
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="origgo-app-root">
      {/* 1. Header Oficial de Origgo */}
      <SiteHeader
        isDarkMode={isDarkMode}
        isSideMenuOpen={isSideMenuOpen}
        isPushActive={isPushActive}
        userCredits={userCredits}
        onToggleSideMenu={() => setIsSideMenuOpen(!isSideMenuOpen)}
        onToggleTheme={handleToggleTheme}
        onTogglePush={() => {
          setIsPushActive(!isPushActive);
          notify(
            isPushActive
              ? isEn ? 'Push alerts deactivated' : 'Alertas desactivadas'
              : isEn ? '🔔 Instant Web Push radar activated' : '🔔 Radar Web Push instantáneo activado'
          );
        }}
        onOpenVipModal={() => {
          setLeadToUnlock(null);
          setCheckoutModalOpen(true);
        }}
      />

      {/* 2. Barra de Comandos Omnibox y Filtros (Inmediatamente después de Header) */}
      <CommandBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCity={selectedCity}
        onCityChange={setSelectedCity}
        selectedSort={selectedSort}
        onSortChange={setSelectedSort}
        selectedOperation={selectedOperation}
        onOperationChange={setSelectedOperation}
        selectedNiche={selectedNiche}
        onNicheChange={setSelectedNiche}
        onResetFilters={handleResetFilters}
      />

      {/* 3. Hero Principal y Estadísticas de Monitoreo */}
      <SiteHero
        totalLeads={leads.length}
        totalCities={uniqueCitiesCount}
        totalSectors={SECTORES_TOTALES}
        onScrollToCatalog={handleScrollToCatalog}
        onOpenAbout={() => setAboutModalOpen(true)}
      />

      {/* 4. Cinta de Oportunidades y Arbitraje */}
      <MarqueeBanner />

      {/* 5. Sección DIRECTO AL PUNTO (Rastreo 24/7, Cero Comisiones, 1er Contacto Gratis) */}
      <DirectPillarsSection
        onOpenFreeUnlock={() => {
          setLeadToUnlock(leads[0] || null);
          setCheckoutModalOpen(true);
        }}
      />

      {/* 6. Grilla Bento Grid con Paginación Reactiva */}
      <section className="catalog-showcase-section" id="catalogShowcaseSection">
        <BentoGrid
          leads={filteredLeads}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          unlockedMap={unlockedMap}
          onUnlock={handleOpenUnlock}
          onResetFilters={handleResetFilters}
        />
      </section>

      {/* 6. Footer Institucional */}
      <SiteFooter
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        onOpenLegal={(tab) => {
          setLegalModalTab(tab);
          setLegalModalOpen(true);
        }}
        onOpenSupport={(opt) => {
          setSupportModalOption(opt || 'pago');
          setSupportModalOpen(true);
        }}
      />

      {/* 7. Menú Lateral Drawer */}
      <Sidebar
        isOpen={isSideMenuOpen}
        isDarkMode={isDarkMode}
        userCredits={userCredits}
        onClose={() => setIsSideMenuOpen(false)}
        onOpenAbout={() => setIsSideMenuOpen(false)}
        onToggleTheme={handleToggleTheme}
        onOpenVipModal={() => {
          setIsSideMenuOpen(false);
          setCheckoutModalOpen(true);
        }}
        onOpenSupport={() => {
          setIsSideMenuOpen(false);
          setSupportModalOption('pago');
          setSupportModalOpen(true);
        }}
        onOpenLegal={(tab) => {
          setIsSideMenuOpen(false);
          setLegalModalTab(tab);
          setLegalModalOpen(true);
        }}
        onScrollToCatalog={() => {
          setIsSideMenuOpen(false);
          handleScrollToCatalog();
        }}
      />

      {/* 8. Barra de Navegación Inferior Móvil */}
      <MobileBottomBar
        isDarkMode={isDarkMode}
        isSideMenuOpen={isSideMenuOpen}
        onToggleTheme={handleToggleTheme}
        onOpenVipModal={() => {
          setLeadToUnlock(null);
          setCheckoutModalOpen(true);
        }}
        onToggleSideMenu={() => setIsSideMenuOpen(!isSideMenuOpen)}
        onScrollToSearch={handleScrollToSearch}
      />

      {/* 9. Modal Legal y Términos */}
      <LegalModal
        isOpen={legalModalOpen}
        initialTab={legalModalTab}
        onClose={() => setLegalModalOpen(false)}
      />

      {/* 10. Modal de Soporte y FAQ */}
      <SupportModal
        isOpen={supportModalOpen}
        initialOption={supportModalOption}
        onClose={() => setSupportModalOpen(false)}
        onOpenRestorePin={() => {
          setSupportModalOpen(false);
          setCheckoutModalOpen(true);
        }}
        onNotify={notify}
      />

      {/* 11. Modal Acerca de Origgo */}
      <AboutModal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
        onOpenLegal={() => {
          setAboutModalOpen(false);
          setLegalModalTab('terminos');
          setLegalModalOpen(true);
        }}
      />

      {/* 12. Modal de Desbloqueo, Wompi y Autenticación con PIN */}
      <CheckoutModal
        isOpen={checkoutModalOpen}
        selectedLead={leadToUnlock}
        userCredits={userCredits}
        userSession={userSession}
        onClose={() => {
          setCheckoutModalOpen(false);
          setLeadToUnlock(null);
        }}
        onConfirmUnlock={handleConfirmUnlock}
        onSessionUpdate={(nuevaSesion) => {
          setUserSession(nuevaSesion);
          setUserCredits(nuevaSesion.credits);
        }}
        onLogout={() => {
          cerrarSesionLocal();
          setUserSession(null);
          notify(isEn ? 'Session closed successfully' : 'Sesión cerrada exitosamente');
        }}
      />

      {/* Notificación Toast Flotante */}
      {toastMsg && (
        <div
          className="toast-notification show"
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            padding: '10px 18px',
            borderRadius: 9999,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid var(--accent-emerald)',
            fontSize: '0.85rem',
            fontWeight: 600,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}

export default App;
