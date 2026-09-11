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
  const textoMensaje = `Hola, vi su publicación del ${tipo} en ${ubicacion}. Soy comprador directo con recursos listos para cierre rápido. ¿Aún está disponible para visitarlo?`;
  const mensajeWa = encodeURIComponent(textoMensaje);
  return `https://wa.me/${waNum}?text=${mensajeWa}`;
}

describe('Plantilla de Alta Conversión WhatsApp (Pilar 4.3)', () => {
  it('Debe generar la URL de WhatsApp con el mensaje de comprador directo codificado', () => {
    const url = generarUrlWhatsApp('573101234567', 'Apartamento', 'El Poblado, Medellín');

    assert.ok(url.startsWith('https://wa.me/573101234567?text='));
    assert.ok(url.includes('comprador%20directo'));
    assert.ok(url.includes('recursos%20listos'));
    assert.ok(url.includes('El%20Poblado'));
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
