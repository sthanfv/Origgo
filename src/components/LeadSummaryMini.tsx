import React from 'react';
import { LeadItem } from '../types';

interface LeadSummaryMiniProps {
  lead: LeadItem;
}

export const LeadSummaryMini: React.FC<LeadSummaryMiniProps> = ({ lead }) => {
  return (
    <div
      className="modal-lead-summary-card"
      style={{
        padding: '8px 12px',
        gap: 10,
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        className="modal-lead-thumb-wrap"
        style={{ width: 56, height: 56, minWidth: 56, borderRadius: 10, overflow: 'hidden' }}
      >
        <img
          src={lead.imagen}
          alt={lead.titulo}
          className="modal-lead-thumb"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=400&q=80';
          }}
        />
      </div>
      <div className="modal-lead-info-col" style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.84rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {lead.titulo}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {lead.ciudad} • {lead.barrio || 'Directo'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ color: 'var(--accent-emerald, #10B981)', fontWeight: 900, fontSize: '0.92rem' }}>
            {lead.precio}
          </span>
          {lead.descuento_arbitraje && (
            <span
              style={{
                fontSize: '0.68rem',
                color: 'var(--accent-emerald)',
                background: 'hsla(158, 64%, 48%, 0.14)',
                padding: '2px 6px',
                borderRadius: 6,
                fontWeight: 700,
              }}
            >
              -{lead.descuento_arbitraje}% vs Mediana
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
