import React from 'react';
import { useLanguage } from '../i18n';

export const MarqueeBanner: React.FC = () => {
  const { t } = useLanguage();

  const items = [
    { title: t('marquee_direct_title', '0% Comisión'), sub: t('marquee_direct_sub', 'Trato directo') },
    { title: t('marquee_alerts_title', 'Alertas < 3 Min'), sub: t('marquee_alerts_sub', 'Tiempo real') },
    { title: t('marquee_arbitrage_title', 'Margen Arbitraje'), sub: t('marquee_arbitrage_sub', 'Bajo mediana') },
    { title: t('marquee_access_title', 'Acceso Abierto'), sub: t('marquee_access_sub', 'Avisos reales') }
  ];

  return (
    <section className="trust-marquee-container" id="trustMarqueeSection">
      <div className="marquee-track">
        {/* Grupo 1 */}
        <div className="marquee-group">
          {items.map((item, idx) => (
            <div key={idx} className="marquee-item">
              <span className="marquee-title">{item.title}</span>
              <span className="marquee-sub">{item.sub}</span>
              <span className="marquee-dot"></span>
            </div>
          ))}
        </div>
        {/* Grupo 2 (Duplicado para loop infinito sin saltos) */}
        <div className="marquee-group" aria-hidden="true">
          {items.map((item, idx) => (
            <div key={`dup-${idx}`} className="marquee-item">
              <span className="marquee-title">{item.title}</span>
              <span className="marquee-sub">{item.sub}</span>
              <span className="marquee-dot"></span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
