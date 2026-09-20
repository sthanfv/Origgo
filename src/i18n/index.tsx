import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dictEs } from './dictEs';
import { dictEn } from './dictEn';

export type Language = 'es' | 'en';

const TASA_CAMBIO_USD_COP = 4100;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  isEn: boolean;
  formatUSD: (copStr: string | number) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'es',
  setLang: () => {},
  t: (key: string, fallback?: string) => fallback || key,
  isEn: false,
  formatUSD: () => '',
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem('origgo_lang');
      if (stored === 'en') return 'en';
      if (stored === 'es') return 'es';
    } catch {}
    // El idioma predeterminado de la plataforma es estrictamente español
    return 'es';
  });

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem('origgo_lang', newLang);
      document.documentElement.lang = newLang;
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key: string, fallback = ''): string => {
    const dict = lang === 'en' ? dictEn : dictEs;
    return dict[key] !== undefined ? dict[key] : (fallback || key);
  }, [lang]);

  const formatUSD = useCallback((copVal: string | number): string => {
    if (!copVal) return '';
    const clean = String(copVal).replace(/[^0-9]/g, '');
    const num = Number(clean);
    if (isNaN(num) || num <= 0) return '';
    const usd = Math.round(num / TASA_CAMBIO_USD_COP);
    const usdFormatted = usd.toLocaleString('en-US');
    return lang === 'en' ? `≈ $${usdFormatted} USD` : `~$${usdFormatted} USD`;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isEn: lang === 'en', formatUSD }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
