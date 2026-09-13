/**
 * 🧪 TEST UNITARIO: POLÍTICA DE USO JUSTO (FAIR USAGE POLICY - 35 DESBLOQUEOS DIARIOS)
 * tests/fair_usage_quota.test.js
 * 
 * Valida que los usuarios con membresía ilimitada (Plan Nacional o Ciudad)
 * no puedan exceder los 35 desbloqueos diarios para prevenir el scraping masivo.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const db = require('../lib/db');

describe('🛡️ Política de Uso Justo (Fair Usage Policy - 35 desbloqueos/día)', () => {
  it('Debe permitir hasta 35 desbloqueos diarios y bloquear el 36 con error CUOTA_DIARIA_EXCEDIDA', async () => {
    const celularPrueba = '573009998877';

    // Activar Plan Nacional VIP
    await db.addCredits(celularPrueba, 0, '1234', { plan: 'national' });

    // Ejecutar 35 desbloqueos consecutivos
    for (let i = 1; i <= 35; i++) {
      const leadId = `lead-test-fair-${i}`;
      const res = await db.unlockLead(celularPrueba, leadId);
      assert.strictEqual(res.success, true, `Desbloqueo ${i} debió ser exitoso`);
      assert.strictEqual(res.planBenefit, true);
      assert.strictEqual(res.dailyUnlocksRemaining, 35 - i);
    }

    // El intento 36 DEBE ser rechazado por exceder la cuota diaria
    const intento36 = await db.unlockLead(celularPrueba, 'lead-test-fair-36');
    assert.strictEqual(intento36.success, false);
    assert.strictEqual(intento36.error, 'CUOTA_DIARIA_EXCEDIDA');
    assert.match(intento36.message, /35 contactos diarios/);

    // Un inmueble YA desbloqueado previamente (ej. lead-test-fair-1) sí se puede re-consultar sin error
    const reconsulta = await db.unlockLead(celularPrueba, 'lead-test-fair-1');
    assert.strictEqual(reconsulta.success, true);
    assert.strictEqual(reconsulta.alreadyUnlocked, true);
  });
});
