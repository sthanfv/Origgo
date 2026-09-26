import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n';
import { TEXTOS_LEGALES_ORIGGO_EN } from '../i18n/legalEn';

export type LegalTabKey = 'terminos' | 'exoneracion' | 'privacidad' | 'reembolsos';

interface LegalModalProps {
  isOpen: boolean;
  initialTab?: LegalTabKey;
  onClose: () => void;
}

const LEGAL_DATA_ES: Record<LegalTabKey, {
  titulo: string;
  subtitulo: string;
  badge: string;
  icono: string;
  sections: Array<{
    title: string;
    icon: string;
    text: React.ReactNode;
    type?: 'warning' | 'highlight' | 'default';
  }>;
}> = {
  terminos: {
    titulo: 'Términos y Condiciones de Uso',
    subtitulo: 'Terminal de agregación de fuentes públicas — Versión 2026.1',
    badge: 'Terminal de Inteligencia y Agregación',
    icono: 'fa-solid fa-file-contract',
    sections: [
      {
        title: '1. Naturaleza del Software: Terminal de Inteligencia y Agregación',
        icon: 'fa-solid fa-server',
        text: 'Origgo es un software de monitoreo algorítmico, clasificación analítica y terminal de inteligencia de mercado en Colombia. Origgo no es una agencia inmobiliaria, ni corredores, comisionistas ni un repositorio exclusivo de inmuebles. No representamos a compradores ni vendedores, no custodiamos llaves, no fijamos precios ni intervenimos en visitas, arras o contratos de compraventa/arrendamiento. Nuestra función tecnológica consiste en estructurar datos públicos abiertos y conectar directamente a compradores con anunciantes para posibilitar el trato directo.'
      },
      {
        title: '2. Indexación de Fuentes Públicas y Ausencia de Exclusividad',
        icon: 'fa-solid fa-network-wired',
        text: 'Los datos, enlaces e información mostrados provienen de fuentes abiertas y públicas de libre acceso en internet, recopilados mediante algoritmos de indexación referencial. Origgo no reclama exclusividad, mandato comercial ni titularidad jurídica sobre los inmuebles ni sobre las imágenes públicas referenciadas.'
      },
      {
        title: '3. Créditos de Consulta Analítica y Ejecución Instantánea',
        icon: 'fa-solid fa-bolt',
        text: 'Cada crédito adquirido habilita la consulta analítica y visualización directa del contacto y canal verificado del anunciante. Conforme al Art. 47 numeral 1 de la Ley 1480 de 2011, al consultar un contacto el servicio digital se ejecuta de forma instantánea y definitiva.'
      },
      {
        title: '4. Precios Claros y Pasarela Oficial Wompi',
        icon: 'fa-solid fa-lock',
        text: 'Todos los precios están expresados en pesos colombianos (COP). Los pagos se procesan de forma cifrada a través de Wompi Bancolombia (entidad vigilada por la SFC), sin cargos ocultos ni renovaciones automáticas forzadas.'
      }
    ]
  },
  exoneracion: {
    titulo: 'Seguridad, Diligencia y Exoneración',
    subtitulo: 'Recomendaciones esenciales para compradores y propietarios',
    badge: 'Diligencia Debida',
    icono: 'fa-solid fa-shield-halved',
    sections: [
      {
        title: '1. Verificación Física y Tradición del Inmueble',
        icon: 'fa-solid fa-circle-exclamation',
        type: 'warning',
        text: 'Aconsejamos visitar siempre el inmueble en persona, constatar la identidad del vendedor y solicitar un Certificado de Tradición y Libertad reciente ante la Oficina de Registro (SNR) antes de entregar dineros o firmar promesas de compraventa.'
      },
      {
        title: '2. Software Neutral y Acuerdos entre Particulares',
        icon: 'fa-solid fa-scale-balanced',
        text: 'Como software neutral de búsqueda e inteligencia, Origgo no responde por vicios ocultos, modificaciones unilaterales de precio, estado del predio o acuerdos privados celebrados entre las partes.'
      },
      {
        title: '3. Marcas de Terceros y Propiedad Intelectual',
        icon: 'fa-solid fa-copyright',
        text: 'Las marcas, nombres o signos distintivos que aparezcan incidentalmente en imágenes de fuentes públicas pertenecen a sus respectivos titulares. Origgo no tiene vinculación, alianza ni patrocinio con portales o competidores externos.'
      },
      {
        title: '4. Uso Prohibido y Protección Anti-Spam',
        icon: 'fa-solid fa-user-lock',
        text: 'El acceso es para uso personal o comercial legítimo de trato directo. Queda prohibida la extracción masiva automatizada (scraping), la reventa de datos y el envío de spam o acoso a los propietarios.'
      }
    ]
  },
  privacidad: {
    titulo: 'Política de Tratamiento de Datos Personales',
    subtitulo: 'Régimen de Habeas Data (Ley 1581 de 2012) — Transparencia Total',
    badge: 'Habeas Data (SIC)',
    icono: 'fa-solid fa-user-shield',
    sections: [
      {
        title: '1. Finalidad Exclusiva del Tratamiento',
        icon: 'fa-solid fa-database',
        text: 'Los datos suministrados (WhatsApp y correo) se recolectan únicamente para: (i) vincular y custodiar tus créditos, (ii) emitir comprobantes y enlaces de acceso seguro (Magic Link), y (iii) soporte técnico. Cero venta de datos y cero spam publicitario.'
      },
      {
        title: '2. Cifrado Militar AES-256',
        icon: 'fa-solid fa-key',
        text: 'Los teléfonos de propietarios se custodian cifrados mediante estándar AES-256-GCM. La navegación se encuentra protegida con HTTPS/TLS y cabeceras de seguridad OWASP.'
      },
      {
        title: '3. Derechos del Titular (Habeas Data)',
        icon: 'fa-solid fa-id-card',
        text: 'Conforme a la Ley 1581 de 2012, los titulares pueden solicitar la actualización o supresión de sus datos de contacto públicos directamente a través de los canales de autogestión de la plataforma o vía WhatsApp oficial.'
      },
      {
        title: '4. Retiro de Anuncios (Habeas Data)',
        icon: 'fa-solid fa-shield-cat',
        type: 'highlight',
        text: 'Si eres el propietario (o su apoderado) y quieres retirar un anuncio, usa "Retirar Inmueble" en el Centro de Auto-Soporte. Identifica el anuncio con su enlace, el código que aparece en su ficha técnica, el enlace del anuncio original o el celular publicado en él, e indica tu nombre y un correo. Recibirás un número de radicado. Si el anuncio queda identificado con exactitud, lo ocultamos de inmediato mientras revisamos la solicitud; respondemos en máximo 15 días hábiles (Ley 1581 de 2012, art. 15). Los datos de la solicitud solo se usan para atenderla.'
      }
    ]
  },
  reembolsos: {
    titulo: 'Garantía de Saldo, Retracto y PQR',
    subtitulo: 'Régimen Comercial y Tecnológico Colombiano',
    badge: 'Garantía y Reversión',
    icono: 'fa-solid fa-rotate-left',
    sections: [
      {
        title: '1. Tu Saldo Nunca se Pierde',
        icon: 'fa-solid fa-shield-halved',
        text: 'Los créditos adquiridos no caducan. Si limpias el navegador o cambias de dispositivo, puedes recuperarlos en segundos desde "Restaurar Cuenta" con tu número de WhatsApp.'
      },
      {
        title: '2. Derecho de Retracto y Reversión del Pago',
        icon: 'fa-solid fa-arrow-rotate-left',
        text: 'Para paquetes con créditos sin consumir, puedes ejercer derecho de retracto dentro de los 5 días hábiles siguientes al pago (Art. 47 Ley 1480). Ante cobros duplicados o fallas técnicas, aplica reversión del pago conforme al Decreto 587 de 2016.'
      },
      {
        title: '3. Peticiones, Quejas y Reclamos (PQR)',
        icon: 'fa-solid fa-headset',
        text: 'Para consultas sobre transacciones de saldo o pagos Wompi, comunícate con la referencia de pago al canal oficial de WhatsApp de Origgo. Atención rápida y personalizada.'
      }
    ]
  }
};

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  initialTab = 'terminos',
  onClose,
}) => {
  const { isEn } = useLanguage();
  const [activeTab, setActiveTab] = useState<LegalTabKey>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Escuchar tecla Escape para cerrar modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentDataEs = LEGAL_DATA_ES[activeTab];
  const currentDataEn = TEXTOS_LEGALES_ORIGGO_EN[activeTab];

  return (
    <div 
      className="modal-backdrop active" 
      id="modalLegalOverlay"
      style={{ display: 'flex', pointerEvents: 'auto', zIndex: 100000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="modal-card legal-modal-card" 
        id="legalModalCard"
        style={{ position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          type="button" 
          className="btn-modal-close" 
          id="btnLegalCloseIcon" 
          aria-label={isEn ? "Close information window" : "Cerrar ventana de información"}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <i className="fa-solid fa-xmark" style={{ pointerEvents: 'none' }}></i>
        </button>

        <div className="modal-header-tag" id="legalHeaderTag">
          <i className={isEn ? currentDataEn.icono : currentDataEs.icono}></i> 
          <span>{isEn ? currentDataEn.badge : currentDataEs.badge}</span>
        </div>
        <h2 className="modal-title" id="legalModalTitle">
          {isEn ? currentDataEn.titulo : currentDataEs.titulo}
        </h2>
        <p className="modal-subtitle" id="legalModalSubtitle">
          {isEn ? currentDataEn.subtitulo : currentDataEs.subtitulo}
        </p>

        {/* Pestañas de Navegación del Modal Legal */}
        <div className="legal-tabs-bar" role="tablist">
          <button 
            type="button" 
            className={`legal-tab-btn ${activeTab === 'terminos' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminos')}
          >
            <i className="fa-solid fa-file-contract"></i> <span>{isEn ? 'How It Works' : 'Cómo Funciona'}</span>
          </button>
          <button 
            type="button" 
            className={`legal-tab-btn ${activeTab === 'exoneracion' ? 'active' : ''}`}
            onClick={() => setActiveTab('exoneracion')}
          >
            <i className="fa-solid fa-shield-halved"></i> <span>{isEn ? 'Security' : 'Seguridad'}</span>
          </button>
          <button 
            type="button" 
            className={`legal-tab-btn ${activeTab === 'privacidad' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacidad')}
          >
            <i className="fa-solid fa-user-shield"></i> <span>{isEn ? 'Your Data' : 'Tus Datos'}</span>
          </button>
          <button 
            type="button" 
            className={`legal-tab-btn ${activeTab === 'reembolsos' ? 'active' : ''}`}
            onClick={() => setActiveTab('reembolsos')}
          >
            <i className="fa-solid fa-rotate-left"></i> <span>{isEn ? 'Balance Guarantee' : 'Garantía de Saldo'}</span>
          </button>
        </div>

        {/* Contenedor de contenido dinámico */}
        <div className="legal-content-box" id="legalContentBox">
          {isEn ? (
            <div dangerouslySetInnerHTML={{ __html: currentDataEn.html }} />
          ) : (
            currentDataEs.sections.map((sec, idx) => (
              <div 
                key={idx} 
                className={`legal-section ${sec.type === 'warning' ? 'legal-section-warning' : sec.type === 'highlight' ? 'legal-section-highlight' : ''}`}
              >
                <div className="legal-section-badge">
                  <i className={sec.icon}></i> {sec.title}
                </div>
                <p>{sec.text}</p>
              </div>
            ))
          )}
        </div>

        {/* Acciones del Modal */}
        <div className="legal-modal-actions">
          <a 
            href="https://wa.me/573001234567?text=Hola%2C%20tengo%20una%20consulta%20sobre%20Origgo" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn-legal-support" 
            id="btnLegalSupport"
          >
            <i className="fa-brands fa-whatsapp"></i> <span>{isEn ? 'WhatsApp Support' : 'Soporte por WhatsApp'}</span>
          </a>
          <button 
            type="button" 
            className="btn-legal-accept" 
            id="btnLegalCancel"
            onClick={onClose}
          >
            <i className="fa-solid fa-check"></i> <span>{isEn ? 'Understood' : 'Entendido'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
