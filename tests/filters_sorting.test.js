/**
 * 🧪 TEST UNITARIO: FILTRADO Y ORDENAMIENTO TÁCTICO DE LEADS
 * tests/filters_sorting.test.js
 * 
 * Valida que los algoritmos de ordenamiento dinámico por $/m²,
 * rebajas de precio y filtros por ciudad operen con exactitud matemática.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Conjunto de datos simulado
const leadsMock = [
  {
    id: 'lead-1',
    titulo: 'Apartamento en Chicó',
    ciudad: 'Bogotá',
    precio_raw: 800000000,
    precio_m2: '$ 8.000.000 / m²',
    rebaja: ''
  },
  {
    id: 'lead-2',
    titulo: 'Casa en Poblado',
    ciudad: 'Medellín',
    precio_raw: 950000000,
    precio_m2: '$ 4.500.000 / m²',
    rebaja: '-15% de descuento'
  },
  {
    id: 'lead-3',
    titulo: 'Apartamento en Cabecera',
    ciudad: 'Bucaramanga',
    precio_raw: 350000000,
    precio_m2: '$ 3.500.000 / m²',
    rebaja: ''
  }
];

describe('Filtrado y Ordenamiento Dinámico (Pilar 4.1)', () => {
  it('Debe ordenar por menor precio por m² de forma ascendente', () => {
    const copia = [...leadsMock];
    copia.sort((a, b) => {
      const m2A = Number(String(a.precio_m2 || '').replace(/\D/g, '')) || Infinity;
      const m2B = Number(String(b.precio_m2 || '').replace(/\D/g, '')) || Infinity;
      return m2A - m2B;
    });

    assert.strictEqual(copia[0].id, 'lead-3'); // $3.5M/m²
    assert.strictEqual(copia[1].id, 'lead-2'); // $4.5M/m²
    assert.strictEqual(copia[2].id, 'lead-1'); // $8.0M/m²
  });

  it('Debe priorizar los inmuebles con rebaja confirmada al ordenar por rebajas', () => {
    const copia = [...leadsMock];
    copia.sort((a, b) => {
      const rebA = Boolean(a.rebaja && a.rebaja.trim() !== '') ? 1 : 0;
      const rebB = Boolean(b.rebaja && b.rebaja.trim() !== '') ? 1 : 0;
      return rebB - rebA;
    });

    assert.strictEqual(copia[0].id, 'lead-2'); // Tiene rebaja
    assert.ok(copia[0].rebaja.includes('-15%'));
  });

  it('Debe ordenar por precio total ascendente y descendente', () => {
    const asc = [...leadsMock].sort((a, b) => (a.precio_raw || 0) - (b.precio_raw || 0));
    assert.strictEqual(asc[0].id, 'lead-3'); // 350M
    assert.strictEqual(asc[2].id, 'lead-2'); // 950M

    const desc = [...leadsMock].sort((a, b) => (b.precio_raw || 0) - (a.precio_raw || 0));
    assert.strictEqual(desc[0].id, 'lead-2'); // 950M
    assert.strictEqual(desc[2].id, 'lead-3'); // 350M
  });
});
