/**
 * 🧠 MOTOR DE RETENCIÓN Y CICLO DE VIDA DE CLIENTES (LIFECYCLE & RETENTION)
 * Archivo: lib/retention.js
 * Estándar Ecosistema Desmulta (< 500 líneas).
 */

const db = require('./db');

// Tipos de campañas de retención
const CAMPAÑAS = {
  LOW_BALANCE: 'low_balance_upsell',
  EXPIRING_SOON: 'plan_expiring_soon',
  EXPIRED_RESCUE: 'plan_expired_rescue'
};

/**
 * Evalúa a un usuario y determina si califica para alguna campaña de retención.
 * @param {object} user Documento del usuario
 * @param {Date} [ahora=new Date()]
 * @returns {object|null} Objeto de acción { action, campaign, creditsToGrant, templateData } o null
 */
function evaluarSegmentoUsuario(user, ahora = new Date()) {
  if (!user || !user.phone) return null;

  const hoyMs = ahora.getTime();

  // 1. Regla Anti-Spam: Si ya recibió un impacto de retención en los últimos 15 días, ignorar
  if (user.lastRetentionImpactAt) {
    const ultimoImpactoMs = new Date(user.lastRetentionImpactAt).getTime();
    const diasDesdeImpacto = (hoyMs - ultimoImpactoMs) / (1000 * 60 * 60 * 24);
    if (diasDesdeImpacto < 15) {
      return null;
    }
  }

  // -------------------------------------------------------------
  // SEGMENTO B: Plan Pro por vencer en 3 días (72 horas)
  // -------------------------------------------------------------
  if (user.plan && user.plan !== 'free' && user.planExpiresAt) {
    const expiraMs = new Date(user.planExpiresAt).getTime();
    const horasRestantes = (expiraMs - hoyMs) / (1000 * 60 * 60);

    // Si le quedan entre 0 y 72 horas para vencer
    if (horasRestantes > 0 && horasRestantes <= 72) {
      return {
        action: 'ENVIAR_RECORDATORIO_RENOVACION',
        campaign: CAMPAÑAS.EXPIRING_SOON,
        type: 'renewal_prompt',
        creditsToGrant: 0,
        horasRestantes: Math.round(horasRestantes),
        plan: user.plan,
        planCity: user.planCity || 'Todas las ciudades'
      };
    }

    // -----------------------------------------------------------
    // SEGMENTO C: Plan Pro recién vencido (hace 1 a 4 días) -> Rescate
    // -----------------------------------------------------------
    const horasVencido = (hoyMs - expiraMs) / (1000 * 60 * 60);
    if (horasVencido > 0 && horasVencido <= 96) {
      // Verificar regla dura de 45 días contra abuso de créditos de rescate
      let puedeRecibirCreditos = true;
      if (user.lastRescueCreditAt) {
        const ultimoRescateMs = new Date(user.lastRescueCreditAt).getTime();
        const diasDesdeRescate = (hoyMs - ultimoRescateMs) / (1000 * 60 * 60 * 24);
        if (diasDesdeRescate < 45) {
          puedeRecibirCreditos = false;
        }
      }

      return {
        action: 'ENVIAR_OFERTA_RESCATE',
        campaign: CAMPAÑAS.EXPIRED_RESCUE,
        type: 'rescue_credits',
        creditsToGrant: puedeRecibirCreditos ? 2 : 0,
        horasVencido: Math.round(horasVencido),
        plan: user.plan,
        planCity: user.planCity || 'Todas las ciudades'
      };
    }
  }

  // -------------------------------------------------------------
  // SEGMENTO A: Paquete de créditos agotándose (Saldo <= 2 y gastó >= 5)
  // -------------------------------------------------------------
  const creditosActuales = Number(user.credits || 0);
  const desbloqueadosTotal = Array.isArray(user.unlockedLeads) ? user.unlockedLeads.length : 0;

  // Si ha desbloqueado al menos 5 oportunidades y le quedan 1 o 2 créditos
  if (creditosActuales > 0 && creditosActuales <= 2 && desbloqueadosTotal >= 5) {
    return {
      action: 'ENVIAR_UPSELL_PLAN_PRO',
      campaign: CAMPAÑAS.LOW_BALANCE,
      type: 'low_balance',
      creditsToGrant: 0,
      creditosActuales,
      desbloqueadosTotal
    };
  }

  return null;
}

/**
 * Procesa la cola de usuarios y genera los tokens de retención correspondientes.
 * @param {Array<object>} usuarios Lista de usuarios a evaluar
 * @returns {Promise<{ procesados: number, impactados: number, acciones: Array<object> }>}
 */
async function procesarLoteRetencion(usuarios = []) {
  if (!Array.isArray(usuarios)) return { procesados: 0, impactados: 0, acciones: [] };

  const accionesTomadas = [];
  let impactados = 0;

  for (const user of usuarios) {
    const evaluacion = evaluarSegmentoUsuario(user);
    if (!evaluacion) continue;

    try {
      // 1. Generar Magic Token seguro con la configuración de la campaña
      const tokenRes = await db.createRetentionToken(user.phone, {
        type: evaluacion.type,
        creditsToGrant: evaluacion.creditsToGrant,
        campaign: evaluacion.campaign,
        metadata: {
          plan: evaluacion.plan || null,
          planCity: evaluacion.planCity || null
        }
      });

      // 2. Marcar en el usuario la estampa de impacto para no hacer spam en 15 días
      await (db.updateUser || db.updateUserPreferences)(user.phone, {
        lastRetentionImpactAt: new Date().toISOString()
      });

      accionesTomadas.push({
        phone: user.phone,
        email: user.email || null,
        campaign: evaluacion.campaign,
        action: evaluacion.action,
        token: tokenRes.token,
        creditsToGrant: evaluacion.creditsToGrant,
        expiresAt: tokenRes.expiresAt
      });

      impactados++;
    } catch (err) {
      console.warn(`[Retention] Error procesando usuario ${user.phone}: ${err.message}`);
    }
  }

  return {
    procesados: usuarios.length,
    impactados,
    acciones: accionesTomadas
  };
}

module.exports = {
  CAMPAÑAS,
  evaluarSegmentoUsuario,
  procesarLoteRetencion
};
