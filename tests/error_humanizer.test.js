/**
 * 🧪 PRUEBAS UNITARIAS: HUMANIZACIÓN Y FORMATEO DE ERRORES (UI PRESENTABLE)
 * tests/error_humanizer.test.js
 * 
 * Valida que los códigos técnicos del backend (EMAIL_YA_RECLAMADO, LIMITE_EXCEDIDO, etc.)
 * sean transformados en mensajes empáticos, claros y elegantes para el usuario final.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('🎨 Humanizador de Errores para Interfaz de Usuario (UI Presentable)', async () => {
  const { humanizarError } = await import('../src/utils/error-formatter.ts');

  it('1. Debe transformar EMAIL_YA_RECLAMADO en una explicación empática en español', () => {
    const msg = humanizarError('EMAIL_YA_RECLAMADO');
    assert.ok(!msg.includes('EMAIL_YA_RECLAMADO'), 'No debe contener el código interno crudo');
    assert.match(msg, /correo electrónico ya utilizó su crédito de cortesía/i);
    assert.match(msg, /PIN/i);
  });

  it('2. Debe transformar LIMITE_EXCEDIDO en un mensaje comprensible sobre cuota temporal', () => {
    const msg = humanizarError('LIMITE_EXCEDIDO');
    assert.ok(!msg.includes('LIMITE_EXCEDIDO'), 'No debe contener el código crudo');
    assert.match(msg, /límite temporal de intentos permitidos/i);
  });

  it('3. Debe transformar DISPOSITIVO_YA_RECLAMADO correctamente', () => {
    const msg = humanizarError('DISPOSITIVO_YA_RECLAMADO');
    assert.ok(!msg.includes('DISPOSITIVO_YA_RECLAMADO'));
    assert.match(msg, /dispositivo ya utilizó su regalo/i);
  });

  it('4. Debe desempaquetar instancias Error que contienen prefijos como Error: o HTTP 409:', () => {
    const errObj = new Error('HTTP 409: EMAIL_YA_RECLAMADO');
    const msg = humanizarError(errObj);
    assert.ok(!msg.includes('EMAIL_YA_RECLAMADO'));
    assert.ok(!msg.includes('HTTP 409'));
    assert.match(msg, /correo electrónico ya utilizó/i);
  });

  it('5. Debe manejar errores de red o conectividad (Failed to fetch, NetworkError)', () => {
    const msg = humanizarError('TypeError: Failed to fetch');
    assert.match(msg, /conectar con los servidores/i);
  });

  it('6. Debe admitir traducción bilingüe al inglés cuando isEn = true', () => {
    const msgEn = humanizarError('EMAIL_YA_RECLAMADO', true);
    assert.ok(!msgEn.includes('EMAIL_YA_RECLAMADO'));
    assert.match(msgEn, /already claimed its free welcome gift/i);

    const limitEn = humanizarError('LIMITE_EXCEDIDO', true);
    assert.match(limitEn, /reached the temporary request limit/i);
  });

  it('7. Si el error ya es una oración natural y legible, debe respetarla', () => {
    const natural = 'Por favor verifica los datos del formulario.';
    const res = humanizarError(natural);
    assert.strictEqual(res, natural);
  });
});
