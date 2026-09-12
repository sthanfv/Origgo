/**
 * 🧪 TEST UNITARIO: PLANTILLA DE WHATSAPP DE ALTA CONVERSIÓN
 * tests/whatsapp_template.test.js
 * 
 * Valida que los enlaces hacia WhatsApp contengan la plantilla de comprador
 * directo pre-redactada y codificada de forma segura con URI encoding.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

function obtenerSaludoHorario(fecha = new Date()) {
  try {
    const hora = fecha.toLocaleString('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false });
    const h = parseInt(hora, 10);
    if (h >= 5 && h < 12) return 'Buen día';
    if (h >= 12 && h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  } catch (e) {
    return 'Buen día';
  }
}

function generarUrlWhatsApp(waNum, tipoInmueble, ubicacion, fecha = new Date()) {
  const tipo = tipoInmueble ? tipoInmueble.toLowerCase() : 'inmueble';
  const saludo = obtenerSaludoHorario(fecha);
  const textoMensaje = `${saludo}, le escribo con respecto a su publicación del ${tipo} en ${ubicacion}. Me gustaría conocer más detalles sobre la propiedad y coordinar una visita, de ser posible. Quedo atento a su respuesta, muchas gracias.`;
  const mensajeWa = encodeURIComponent(textoMensaje);
  return `https://wa.me/${waNum}?text=${mensajeWa}`;
}

describe('Plantilla Formal de WhatsApp (Pilar 4.3)', () => {
  it('Debe generar la URL de WhatsApp con el mensaje formal y respetuoso codificado', () => {
    const fechaManana = new Date('2026-09-12T14:00:00Z'); // 09:00 AM Colombia
    const url = generarUrlWhatsApp('573101234567', 'Apartamento', 'El Poblado, Medellín', fechaManana);

    assert.ok(url.startsWith('https://wa.me/573101234567?text='));
    assert.ok(url.includes('Buen%20d%C3%ADa'));
    assert.ok(url.includes('coordinar%20una%20visita%2C%20de%20ser%20posible'));
    assert.ok(url.includes('El%20Poblado'));
    assert.ok(!url.includes('recursos%20listos')); // CERO mención de dinero o liquidez
    assert.ok(!url.includes('cierre%20r%C3%A1pido')); // CERO presión de tiempo
  });

  it('Debe alternar entre Buen día, Buenas tardes y Buenas noches según horario de Colombia', () => {
    const manana = new Date('2026-09-12T13:00:00Z'); // 08:00 Colombia -> Buen día
    const tarde = new Date('2026-09-12T19:00:00Z');  // 14:00 Colombia -> Buenas tardes
    const noche = new Date('2026-09-13T02:00:00Z');  // 21:00 Colombia -> Buenas noches

    assert.strictEqual(obtenerSaludoHorario(manana), 'Buen día');
    assert.strictEqual(obtenerSaludoHorario(tarde), 'Buenas tardes');
    assert.strictEqual(obtenerSaludoHorario(noche), 'Buenas noches');
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
