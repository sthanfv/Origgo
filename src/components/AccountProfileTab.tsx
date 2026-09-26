import React from 'react';
import { LeadItem, UserSession } from '../types';

interface AccountProfileTabProps {
  userSession: UserSession | null;
  phoneInput: string;
  userCredits: number;
  selectedLead: LeadItem | null;
  isEn: boolean;
  onConfirmUnlock: (lead: LeadItem) => void;
  onClose: () => void;
  onGoToBuy: () => void;
  onLogout: () => void;
}

/**
 * Pestaña modular para el perfil activo del usuario:
 * Muestra saldo de créditos, estado verificado, desbloqueo directo y cierre de sesión.
 */
export const AccountProfileTab: React.FC<AccountProfileTabProps> = ({
  userSession,
  phoneInput,
  userCredits,
  selectedLead,
  isEn,
  onConfirmUnlock,
  onClose,
  onGoToBuy,
  onLogout,
}) => {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid var(--accent-emerald)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-emerald)',
            fontSize: '1.2rem',
          }}
        >
          <i className="fa-solid fa-user-shield"></i>
        </div>
        <div style={{ textAlign: 'left' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)' }}>
            {userSession?.phone || phoneInput ? `+57 ${userSession?.phone || phoneInput}` : isEn ? 'No phone yet' : 'Sin celular registrado'}
          </h4>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
            {isEn ? 'Verified Account' : 'Cuenta Verificada'}
          </span>
        </div>
      </div>

      <div
        style={{
          background: 'var(--bg-surface, rgba(255, 255, 255, 0.04))',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontSize: '0.74rem',
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 800,
          }}
        >
          {isEn ? 'Available Unlocks' : 'Desbloqueos Disponibles'}
        </span>
        <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--accent-emerald)', margin: '2px 0' }}>
          {userCredits}
        </div>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          {isEn
            ? 'Active credits without expiration date'
            : 'Créditos activos sin fecha de caducidad'}
        </span>
      </div>

      {/* Desbloqueo Directo con 1 Crédito si hay un inmueble seleccionado */}
      {selectedLead && userCredits > 0 && (
        <button
          type="button"
          className="btn-confirm-wompi"
          style={{ marginBottom: 12, background: 'var(--accent-emerald)', color: '#FFFFFF' }}
          onClick={() => {
            onConfirmUnlock(selectedLead);
            onClose();
          }}
        >
          <i className="fa-solid fa-unlock-keyhole"></i>
          <span>
            {isEn ? 'Unlock Property (1 Credit)' : 'Desbloquear Inmueble (1 Crédito)'}
          </span>
        </button>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          className="btn-confirm-wompi"
          style={{ flex: 2, marginBottom: 0, padding: '0.7rem 1rem' }}
          onClick={onGoToBuy}
        >
          <i className="fa-solid fa-plus"></i>
          <span>{isEn ? 'Get More Credits' : 'Adquirir Más Créditos'}</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          style={{
            flex: 1,
            background: 'transparent',
            border: '1px solid #ef4444',
            color: '#ef4444',
            borderRadius: 10,
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <i className="fa-solid fa-arrow-right-from-bracket"></i>
          <span>{isEn ? 'Sign Out' : 'Salir'}</span>
        </button>
      </div>

      <button type="button" className="btn-modal-back" onClick={onClose}>
        <i className="fa-solid fa-arrow-left"></i>
        <span>{isEn ? 'Cancel and back to catalog' : '← Cancelar y volver al catálogo'}</span>
      </button>
    </div>
  );
};
