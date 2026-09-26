import React, { useState } from 'react';

/**
 * Formulario público de retiro de anuncios (Habeas Data — Ley 1581 de 2012).
 *
 * Pide lo necesario para ubicar el anuncio (el texto libre como "borren mi casa" no basta)
 * y para responder a quien lo pide. Muestra el resultado REAL del servidor: radicado,
 * fecha límite de respuesta (15 días hábiles) y si el anuncio ya quedó oculto.
 * Ver lib/support/takedown.js y docs/RETIRO_DE_ANUNCIOS.md.
 */

const estiloInput: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg-card-inner)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 10,
  color: 'var(--text-main)',
  fontSize: '0.9rem',
};

const estiloEtiqueta: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 700,
  color: 'var(--text-main)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 6,
};

const estiloAyuda: React.CSSProperties = { fontSize: '0.74rem', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 };

const estiloSeccion: React.CSSProperties = {
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '12px 14px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  background: 'var(--glass-metrics-bg)',
};

function Campo({ icono, etiqueta, ayuda, children }: { icono: string; etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={estiloEtiqueta}>
        <i className={`fa-solid ${icono}`} style={{ color: 'var(--accent-emerald)', fontSize: '0.95rem' }}></i>
        <span>{etiqueta}</span>
      </span>
      {children}
      {ayuda && <p style={estiloAyuda}>{ayuda}</p>}
    </label>
  );
}

interface Resultado {
  tipo: 'exito' | 'error';
  texto: string;
  radicado?: string;
}

export const FormularioRetiro: React.FC<{ onNotify: (msg: string) => void }> = ({ onNotify }) => {
  const [referencia, setReferencia] = useState('');
  const [enlace, setEnlace] = useState('');
  const [telefono, setTelefono] = useState('');
  const [sinEnlace, setSinEnlace] = useState(false);
  const [ciudad, setCiudad] = useState('');
  const [barrio, setBarrio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [relacion, setRelacion] = useState('propietario');
  const [motivo, setMotivo] = useState('ya_vendido');
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const identifica = referencia.trim() || enlace.trim() || telefono.trim() || (ciudad.trim() && (barrio.trim() || descripcion.trim()));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifica) {
      setResultado({ tipo: 'error', texto: 'Indica cómo identificar el anuncio: enlace, código, celular del anuncio, o ciudad y barrio.' });
      return;
    }
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch('/api/support?action=takedown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referencia, enlace, telefono, ciudad, barrio, descripcion, nombre, correo, relacion, motivo, acepta }),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok || !datos.ok) {
        setResultado({ tipo: 'error', texto: datos.message || 'No pudimos registrar la solicitud. Intenta de nuevo en unos minutos.' });
        return;
      }
      setResultado({ tipo: 'exito', texto: datos.message, radicado: datos.radicado });
      onNotify(`✓ Solicitud ${datos.radicado} registrada.`);
    } catch {
      setResultado({ tipo: 'error', texto: 'Sin conexión. Revisa tu internet e intenta de nuevo.' });
    } finally {
      setEnviando(false);
    }
  };

  if (resultado?.tipo === 'exito') {
    return (
      <div style={{ ...estiloSeccion, alignItems: 'center', textAlign: 'center', padding: '20px 16px' }} role="status">
        <i className="fa-solid fa-circle-check" style={{ fontSize: '2rem', color: 'var(--accent-emerald)' }}></i>
        <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Radicado {resultado.radicado}</strong>
        <p style={{ ...estiloAyuda, fontSize: '0.85rem' }}>{resultado.texto}</p>
        <p style={estiloAyuda}>Guarda este número: te responderemos al correo que indicaste.</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={estiloSeccion}>
        <strong style={{ fontSize: '0.86rem', color: 'var(--text-main)' }}>1. ¿Qué anuncio quieres retirar?</strong>
        <p style={{ ...estiloAyuda, marginTop: -6 }}>Con uno de estos datos basta. Así sabemos exactamente cuál es.</p>
        <Campo icono="fa-link" etiqueta="Enlace o código del anuncio en Origgo" ayuda="El código aparece en la ficha técnica del anuncio (ej.: lead-inm-1234).">
          <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="https://origgo.online/… o lead-inm-1234" style={estiloInput} maxLength={300} />
        </Campo>
        <Campo icono="fa-arrow-up-right-from-square" etiqueta="Enlace del anuncio original" ayuda="Finca Raíz, Metrocuadrado u otro portal donde publicaste.">
          <input type="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://www.fincaraiz.com.co/…" style={estiloInput} maxLength={300} />
        </Campo>
        <Campo icono="fa-phone" etiqueta="Celular que aparece en el anuncio" ayuda="Lo usamos solo para ubicar tus anuncios; no lo guardamos en claro.">
          <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="300 123 4567" style={estiloInput} maxLength={30} />
        </Campo>
        <button type="button" onClick={() => setSinEnlace(!sinEnlace)} style={{ background: 'none', border: 'none', color: 'var(--accent-emerald)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
          {sinEnlace ? '− Ocultar' : '+ No tengo ninguno de esos datos'}
        </button>
        {sinEnlace && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Campo icono="fa-city" etiqueta="Ciudad">
                <input type="text" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Medellín" style={estiloInput} maxLength={60} />
              </Campo>
              <Campo icono="fa-map-pin" etiqueta="Barrio">
                <input type="text" value={barrio} onChange={(e) => setBarrio(e.target.value)} placeholder="Laureles" style={estiloInput} maxLength={80} />
              </Campo>
            </div>
            <Campo icono="fa-house" etiqueta="Descripción" ayuda="Tipo de inmueble, precio aproximado, dirección aproximada… Lo revisaremos a mano.">
              <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Apartamento de 3 alcobas, 450 millones" style={estiloInput} maxLength={300} />
            </Campo>
          </>
        )}
      </div>

      <div style={estiloSeccion}>
        <strong style={{ fontSize: '0.86rem', color: 'var(--text-main)' }}>2. ¿Quién lo solicita?</strong>
        <Campo icono="fa-user" etiqueta="Nombre">
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" style={estiloInput} maxLength={80} required />
        </Campo>
        <Campo icono="fa-envelope" etiqueta="Correo para responderte">
          <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tucorreo@ejemplo.com" style={estiloInput} maxLength={254} required />
        </Campo>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo icono="fa-id-card" etiqueta="Tu relación">
            <select value={relacion} onChange={(e) => setRelacion(e.target.value)} style={estiloInput}>
              <option value="propietario">Propietario(a)</option>
              <option value="apoderado">Apoderado(a)</option>
              <option value="arrendatario">Arrendatario(a)</option>
              <option value="familiar">Familiar</option>
              <option value="otro">Otro</option>
            </select>
          </Campo>
          <Campo icono="fa-clipboard-question" etiqueta="Motivo">
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} style={estiloInput}>
              <option value="ya_vendido">Ya se vendió o arrendó</option>
              <option value="desistimiento">Ya no quiero vender ni arrendar</option>
              <option value="no_autorice">No autoricé esta publicación</option>
              <option value="datos_erroneos">Datos o precio incorrectos</option>
              <option value="privacidad">Privacidad y protección de datos</option>
            </select>
          </Campo>
        </div>
      </div>

      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} style={{ marginTop: 3 }} required />
        <span>
          Declaro que la información es cierta y que tengo relación con el inmueble. Autorizo a Origgo a usar estos datos solo para atender esta solicitud (Ley 1581 de 2012). Responderemos en máximo 15 días hábiles.
        </span>
      </label>

      {resultado?.tipo === 'error' && (
        <p role="alert" style={{ margin: 0, padding: '10px 12px', borderRadius: 10, fontSize: '0.82rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: '#FCA5A5', textAlign: 'left' }}>
          {resultado.texto}
        </p>
      )}

      <button type="submit" className="btn-confirm-wompi" disabled={enviando} style={{ marginTop: 4, background: '#EF4444', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <i className="fa-solid fa-shield-xmark"></i>
        <span>{enviando ? 'Enviando…' : 'Enviar solicitud de retiro'}</span>
      </button>
    </form>
  );
};
