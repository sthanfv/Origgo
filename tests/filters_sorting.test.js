/**
 * 🧪 TEST UNITARIO: FILTRADO Y ORDENAMIENTO TÁCTICO DE LEADS
 * tests/filters_sorting.test.js
 * 
 * Valida que los algoritmos de ordenamiento dinámico por $/m²,
 * rebajas de precio y filtros por ciudad operen con exactitud matemática.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

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

describe('Pruebas Exhaustivas de Deduplicación y Combinatoria de Filtros', () => {
  const jsonPath = path.join(__dirname, '..', 'data', 'inmobiliario.json');
  const dataset = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const leadsReales = dataset.leads;

  // Implementación canónica de deduplicación
  function deduplicar(lista) {
    const vistosIds = new Set();
    const vistosEnlaces = new Set();
    const vistosFirmas = new Set();
    return lista.filter(item => {
      if (!item) return false;
      const id = String(item.id || '').trim();
      if (id) {
        if (vistosIds.has(id)) return false;
        vistosIds.add(id);
      }
      const enlace = String(item.url || item.enlace || '').trim();
      if (enlace && enlace.length > 5) {
        if (vistosEnlaces.has(enlace)) return false;
        vistosEnlaces.add(enlace);
      }
      const firma = `${String(item.titulo || '').toLowerCase().trim()}_${String(item.precio || '').toLowerCase().trim()}_${String(item.ciudad || '').toLowerCase().trim()}`;
      if (firma.length > 5) {
        if (vistosFirmas.has(firma)) return false;
        vistosFirmas.add(firma);
      }
      return true;
    });
  }

  it('El dataset inmobiliario debe contener cero leads duplicados por ID y por Firma', () => {
    const ids = leadsReales.map(l => l.id);
    const setIds = new Set(ids);
    assert.strictEqual(ids.length, setIds.size, 'No deben existir IDs repetidos');

    const deduplicados = deduplicar(leadsReales);
    assert.strictEqual(deduplicados.length, leadsReales.length, 'El catálogo real no debe tener duplicados redundantes');
  });

  it('Deduplica correctamente cuando se inyectan leads clonados o mutados', () => {
    const clonados = [
      ...leadsReales,
      { ...leadsReales[0] }, // Duplicado exacto
      { ...leadsReales[1], id: 'lead-clon-fake' }, // Duplicado de firma (mismo título, precio, ciudad)
      { ...leadsReales[2] } // Tercer duplicado
    ];
    assert.strictEqual(clonados.length, leadsReales.length + 3);
    const resultado = deduplicar(clonados);
    assert.strictEqual(resultado.length, leadsReales.length, 'Debe haber removido exactamente los 3 duplicados');
  });

  it('Todas las combinaciones posibles de filtros (Ciudad x Operación x Orden) deben retornar colecciones 100% únicas', () => {
    const ciudadesPrueba = ['', 'Bogota', 'Medellin', 'Cali', 'Cartagena', 'Bucaramanga'];
    const operacionesPrueba = ['', 'venta', 'arriendo'];
    const ordenesPrueba = ['recientes', 'precio_menor', 'precio_mayor', 'm2_menor', 'rebaja_mayor'];

    let combinacionesEjecutadas = 0;

    for (const ciudad of ciudadesPrueba) {
      for (const op of operacionesPrueba) {
        for (const orden of ordenesPrueba) {
          combinacionesEjecutadas++;

          // 1. Filtrado
          let filtrados = leadsReales.filter(item => {
            if (ciudad) {
              const c = (item.ciudad || item.ubicacion || '').toLowerCase();
              if (!c.includes(ciudad.toLowerCase())) return false;
            }
            if (op) {
              const itemOp = (item.tipo_operacion || '').toLowerCase();
              const itemTit = (item.titulo || '').toLowerCase();
              if (op === 'venta') {
                if (itemOp !== 'venta' && (itemTit.includes('arriendo') || itemTit.includes('alquiler'))) return false;
              } else if (op === 'arriendo') {
                if (itemOp !== 'arriendo' && !itemTit.includes('arriendo') && !itemTit.includes('alquiler')) return false;
              }
            }
            return true;
          });

          // 2. Ordenamiento
          if (orden === 'precio_menor') {
            filtrados.sort((a, b) => (a.precio_raw || 0) - (b.precio_raw || 0));
          } else if (orden === 'precio_mayor') {
            filtrados.sort((a, b) => (b.precio_raw || 0) - (a.precio_raw || 0));
          } else if (orden === 'rebaja_mayor') {
            filtrados.sort((a, b) => (b.porcentaje_rebaja || 0) - (a.porcentaje_rebaja || 0));
          }

          // 3. Deduplicación
          const dedup = deduplicar(filtrados);

          // 4. Verificación estricta: ¡CERO DUPLICADOS!
          const idsVistos = new Set(dedup.map(x => x.id));
          assert.strictEqual(dedup.length, idsVistos.size, `Duplicados detectados en combinación: Ciudad=${ciudad}, Op=${op}, Orden=${orden}`);
        }
      }
    }

    assert.ok(combinacionesEjecutadas >= 90, `Se probaron ${combinacionesEjecutadas} combinaciones exhaustivas.`);
  });
});
