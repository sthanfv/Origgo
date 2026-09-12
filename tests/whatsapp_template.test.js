/**
 * 🧪 TEST UNITARIO: PLANTILLA DE WHATSAPP DE ALTA CONVERSIÓN
 * tests/whatsapp_template.test.js
 * 
 * Valida que los enlaces hacia WhatsApp contengan la plantilla de comprador
 * directo pre-redactada y codificada de forma segura con URI encoding.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

function generarUrlWhatsApp(waNum, tipoInmueble, ubicacion) {
  const tipo = tipoInmueble ? tipoInmueble.toLowerCase() : 'inmueble';
  const textoMensaje = `Buen día, le escribo con respecto a su publicación del ${tipo} en ${ubicacion}. Me gustaría conocer más detalles sobre la propiedad y coordinar una visita. Quedo atento a su respuesta, muchas gracias.`;
  const mensajeWa = encodeURIComponent(textoMensaje);
  return `https://wa.me/${waNum}?text=${mensajeWa}`;
}

describe('Plantilla Formal de WhatsApp (Pilar 4.3)', () => {
  it('Debe generar la URL de WhatsApp con el mensaje formal y respetuoso codificado', () => {
    const url = generarUrlWhatsApp('573101234567', 'Apartamento', 'El Poblado, Medellín');

    assert.ok(url.startsWith('https://wa.me/573101234567?text='));
    assert.ok(url.includes('Buen%20d%C3%ADa'));
    assert.ok(url.includes('coordinar%20una%20visita'));
    assert.ok(url.includes('El%20Poblado'));
    assert.ok(!url.includes('recursos%20listos')); // CERO mención de dinero o liquidez
    assert.ok(!url.includes('cierre%20r%C3%A1pido')); // CERO presión de tiempo
  });

  it('Debe manejar tipos de inmuebles no definidos usando fallback', () => {
    const url = generarUrlWhatsApp('573009876543', null, 'Bogotá');
    assert.ok(url.includes('del%20inmueble%20en%20Bogot%C3%A1'));
  });

  it('No debe contener caracteres no escapados que rompan la URL', () => {
    const url = generarUrlWhatsApp('573151112233', 'Casa Campestre', 'Chía & Cajicá');
    assert.ok(!url.includes(' ')); // No debe haber espacios en blanco sin codificar
    assert.ok(url.includes('Ch%C3%ADa%20%26%20Cajic%C3%A1'));
  });
});
