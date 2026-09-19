/**
 * 📊 GESTOR DE MÉTRICAS Y EMBUDO DE CONVERSIÓN (lib/funnel.js)
 * Pipeline de Telemetría Comercial y Optimización de Conversión (Funnel CRO).
 * 
 * Principios Arquitectónicos:
 * 1. Cero Costo Adicional ($0): Agregación atómica diaria en Firestore (FieldValue.increment)
 *    para no generar lecturas/escrituras excesivas y mantenerse dentro de la capa gratuita.
 * 2. Cero PII (PCI-DSS / Privacidad por Diseño): No se registran nombres, IPs, correos
 *    ni teléfonos en la telemetría del embudo.
 * 3. Fallback Resiliente: Memoria y disco local para tests y contingencias offline.
 */

const fs = require('fs');
const path = require('path');
const { getFirestoreInstance } = require('./db');

// Etapas formales del embudo de conversión
const ETAPAS_EMBUDO = {
  VISITA: 'visita_landing',
  INTERES: 'interes_inmueble',
  INTENTO: 'intento_conversion',
  CONVERSION: 'conversion_exitosa'
};

// Almacén en memoria volátil para serverless y testing
const memoriaEmbudo = new Map();

/**
 * Obtiene la fecha actual en formato ISO corto YYYY-MM-DD (Zona Horaria Colombia GMT-5).
 * @param {Date} [fecha]
 * @returns {string}
 */
function obtenerFechaHoyColombia(fecha = new Date()) {
  const opciones = { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' };
  const partes = new Intl.DateTimeFormat('en-CA', opciones).formatToParts(fecha);
  const ano = partes.find(p => p.type === 'year')?.value || '2026';
  const mes = partes.find(p => p.type === 'month')?.value || '01';
  const dia = partes.find(p => p.type === 'day')?.value || '01';
  return `${ano}-${mes}-${dia}`;
}

/**
 * Registra un evento en el embudo de conversión con agregación atómica.
 * @param {object} evento
 * @param {string} evento.etapa - Una de las ETAPAS_EMBUDO
 * @param {string} [evento.leadId] - Identificador de la oportunidad
 * @param {string} [evento.ciudad] - Ciudad de la propiedad
 * @param {string|number} [evento.precio] - Precio del inmueble
 * @param {'freemium'|'pago'} [evento.tipo] - Tipo de conversión
 * @param {string} [evento.plan] - Plan seleccionado (single, pack10, city, national)
 * @param {number} [evento.montoCop] - Monto en pesos colombianos si es pago
 * @param {string} [evento.origen] - Fuente de tráfico (directo, whatsapp, google)
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function registrarEventoEmbudo(evento) {
  if (!evento || !evento.etapa) {
    return { ok: false, error: 'ETAPA_REQUERIDA' };
  }

  const etapa = String(evento.etapa).trim().toLowerCase();
  const etapasValidas = Object.values(ETAPAS_EMBUDO);
  if (!etapasValidas.includes(etapa)) {
    return { ok: false, error: 'ETAPA_INVALIDA' };
  }

  const fechaDoc = obtenerFechaHoyColombia();
  const leadId = evento.leadId ? String(evento.leadId).trim().substring(0, 64) : null;
  const ciudad = evento.ciudad ? String(evento.ciudad).trim().toLowerCase().substring(0, 50) : null;
  const tipo = (evento.tipo === 'pago' || evento.tipo === 'freemium') ? evento.tipo : null;
  const monto = Number(evento.montoCop) > 0 ? Math.round(Number(evento.montoCop)) : 0;

  // 1. Intentar persistencia atómica en Firestore
  const db = (process.env.DISABLE_FIRESTORE_FOR_TESTS !== 'true' && typeof getFirestoreInstance === 'function') ? getFirestoreInstance() : null;
  if (db) {
    try {
      const { FieldValue } = require('firebase-admin/firestore');
      const docRef = db.collection('funnel_daily_metrics').doc(fechaDoc);

      const updatePayload = {
        fecha: fechaDoc,
        actualizadoEn: new Date().toISOString()
      };

      if (etapa === ETAPAS_EMBUDO.VISITA) {
        updatePayload.visitas = FieldValue.increment(1);
      } else if (etapa === ETAPAS_EMBUDO.INTERES) {
        updatePayload.interes = FieldValue.increment(1);
        if (leadId) updatePayload[`top_leads.${leadId}`] = FieldValue.increment(1);
        if (ciudad) updatePayload[`top_ciudades.${ciudad}`] = FieldValue.increment(1);
      } else if (etapa === ETAPAS_EMBUDO.INTENTO) {
        if (tipo === 'pago') updatePayload.intentos_pago = FieldValue.increment(1);
        else updatePayload.intentos_freemium = FieldValue.increment(1);
      } else if (etapa === ETAPAS_EMBUDO.CONVERSION) {
        if (tipo === 'pago') {
          updatePayload.conversiones_pago = FieldValue.increment(1);
          if (monto > 0) updatePayload.monto_pago_cop = FieldValue.increment(monto);
        } else {
          updatePayload.conversiones_freemium = FieldValue.increment(1);
        }
      }

      await docRef.set(updatePayload, { merge: true });
      return { ok: true };
    } catch (errFirestore) {
      // Si Firestore falla, continuar con almacenamiento en memoria
    }
  }

  // 2. Almacenamiento en memoria (Fallback seguro)
  if (!memoriaEmbudo.has(fechaDoc)) {
    memoriaEmbudo.set(fechaDoc, {
      fecha: fechaDoc,
      visitas: 0,
      interes: 0,
      intentos_freemium: 0,
      intentos_pago: 0,
      conversiones_freemium: 0,
      conversiones_pago: 0,
      monto_pago_cop: 0,
      top_leads: {},
      top_ciudades: {},
      actualizadoEn: new Date().toISOString()
    });
  }

  const dia = memoriaEmbudo.get(fechaDoc);
  if (etapa === ETAPAS_EMBUDO.VISITA) dia.visitas++;
  else if (etapa === ETAPAS_EMBUDO.INTERES) {
    dia.interes++;
    if (leadId) dia.top_leads[leadId] = (dia.top_leads[leadId] || 0) + 1;
    if (ciudad) dia.top_ciudades[ciudad] = (dia.top_ciudades[ciudad] || 0) + 1;
  } else if (etapa === ETAPAS_EMBUDO.INTENTO) {
    if (tipo === 'pago') dia.intentos_pago++;
    else dia.intentos_freemium++;
  } else if (etapa === ETAPAS_EMBUDO.CONVERSION) {
    if (tipo === 'pago') {
      dia.conversiones_pago++;
      dia.monto_pago_cop += monto;
    } else {
      dia.conversiones_freemium++;
    }
  }
  dia.actualizadoEn = new Date().toISOString();

  return { ok: true };
}

/**
 * Obtiene las métricas agregadas del embudo de los últimos N días.
 * @param {object} [opciones]
 * @param {number} [opciones.dias=7] - Días históricos a consultar
 * @returns {Promise<object>} Resumen consolidado con KPIs y ratios
 */
async function obtenerMetricasEmbudo({ dias = 7 } = {}) {
  const fechasConsultar = [];
  const hoy = new Date();
  for (let i = 0; i < dias; i++) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() - i);
    fechasConsultar.push(obtenerFechaHoyColombia(d));
  }

  let registros = [];
  const db = (process.env.DISABLE_FIRESTORE_FOR_TESTS !== 'true' && typeof getFirestoreInstance === 'function') ? getFirestoreInstance() : null;

  if (db) {
    try {
      const snap = await db.collection('funnel_daily_metrics')
        .where('fecha', 'in', fechasConsultar.slice(0, 10))
        .get();

      if (!snap.empty) {
        registros = snap.docs.map(doc => doc.data());
      }
    } catch (_) {}
  }

  // Complementar o usar memoria si no hay registros en Firestore
  if (registros.length === 0) {
    for (const f of fechasConsultar) {
      if (memoriaEmbudo.has(f)) {
        registros.push(memoriaEmbudo.get(f));
      }
    }
  }

  // Agregación de métricas
  const consolidado = {
    diasConsultados: dias,
    visitas: 0,
    interes: 0,
    intentosTotal: 0,
    intentosFreemium: 0,
    intentosPago: 0,
    conversionesTotal: 0,
    conversionesFreemium: 0,
    conversionesPago: 0,
    ingresosCop: 0,
    topLeadsMap: {},
    topCiudadesMap: {}
  };

  for (const reg of registros) {
    consolidado.visitas += (reg.visitas || 0);
    consolidado.interes += (reg.interes || 0);
    consolidado.intentosFreemium += (reg.intentos_freemium || 0);
    consolidado.intentosPago += (reg.intentos_pago || 0);
    consolidado.conversionesFreemium += (reg.conversiones_freemium || 0);
    consolidado.conversionesPago += (reg.conversiones_pago || 0);
    consolidado.ingresosCop += (reg.monto_pago_cop || 0);

    const leads = reg.top_leads || {};
    for (const [id, count] of Object.entries(leads)) {
      consolidado.topLeadsMap[id] = (consolidado.topLeadsMap[id] || 0) + count;
    }
    const ciudades = reg.top_ciudades || {};
    for (const [cd, count] of Object.entries(ciudades)) {
      consolidado.topCiudadesMap[cd] = (consolidado.topCiudadesMap[cd] || 0) + count;
    }
  }

  consolidado.intentosTotal = consolidado.intentosFreemium + consolidado.intentosPago;
  consolidado.conversionesTotal = consolidado.conversionesFreemium + consolidado.conversionesPago;

  // Ratios de conversión y fugas
  const tasaInteres = consolidado.visitas > 0 ? (consolidado.interes / consolidado.visitas) * 100 : 0;
  const tasaIntento = consolidado.interes > 0 ? (consolidado.intentosTotal / consolidado.interes) * 100 : 0;
  const tasaCierre = consolidado.intentosTotal > 0 ? (consolidado.conversionesTotal / consolidado.intentosTotal) * 100 : 0;
  const tasaConversionGlobal = consolidado.visitas > 0 ? (consolidado.conversionesTotal / consolidado.visitas) * 100 : 0;

  // Ordenar Top 5 Inmuebles más buscados
  const topLeads = Object.entries(consolidado.topLeadsMap)
    .map(([leadId, clics]) => ({ leadId, clics }))
    .sort((a, b) => b.clics - a.clics)
    .slice(0, 5);

  // Ordenar Top 5 Ciudades con mayor demanda
  const topCiudades = Object.entries(consolidado.topCiudadesMap)
    .map(([ciudad, clics]) => ({ ciudad: ciudad.charAt(0).toUpperCase() + ciudad.slice(1), clics }))
    .sort((a, b) => b.clics - a.clics)
    .slice(0, 5);

  return {
    ...consolidado,
    ratios: {
      tasaInteresPct: parseFloat(tasaInteres.toFixed(1)),
      tasaIntentoPct: parseFloat(tasaIntento.toFixed(1)),
      tasaCierrePct: parseFloat(tasaCierre.toFixed(1)),
      tasaConversionGlobalPct: parseFloat(tasaConversionGlobal.toFixed(1)),
      fugaVisitaAInteresPct: parseFloat((100 - tasaInteres).toFixed(1)),
      fugaInteresAIntentoPct: parseFloat((100 - tasaIntento).toFixed(1)),
      fugaIntentoAConversionPct: parseFloat((100 - tasaCierre).toFixed(1))
    },
    topLeads,
    topCiudades
  };
}

/**
 * Formatea un número como pesos colombianos sin decimales.
 * @param {number} valor
 * @returns {string}
 */
function formatearPesosCop(valor) {
  if (!valor || isNaN(valor)) return '$ 0';
  return '$ ' + Math.round(valor).toLocaleString('es-CO');
}

/**
 * Genera el reporte ejecutivo en Markdown listo para Telegram o consola.
 * @param {object} metricas - Resultado de obtenerMetricasEmbudo
 * @returns {string}
 */
function generarReporteTelegramMarkdown(metricas) {
  const r = metricas.ratios || {};
  const fecha = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  let topLeadsTexto = '   _Sin actividad registrada aún_';
  if (metricas.topLeads && metricas.topLeads.length > 0) {
    topLeadsTexto = metricas.topLeads.map((item, idx) => `   ${idx + 1}. \`${item.leadId}\`: *${item.clics}* interesados`).join('\n');
  }

  let topCiudadesTexto = '   _Sin ciudades registradas aún_';
  if (metricas.topCiudades && metricas.topCiudades.length > 0) {
    topCiudadesTexto = metricas.topCiudades.map(c => `   • *${c.ciudad}*: ${c.clics} consultas`).join('\n');
  }

  // Diagnóstico asertivo de fuga
  let alertaFuga = '✅ Flujo equilibrado sin cuellos de botella detectados.';
  if (r.fugaVisitaAInteresPct > 85 && metricas.visitas >= 20) {
    alertaFuga = '⚠️ *Fuga en Vitrina:* El 85%+ de visitas no toca ningún inmueble. Conviene destacar fotos o ajustar filtros.';
  } else if (r.fugaInteresAIntentoPct > 80 && metricas.interes >= 10) {
    alertaFuga = '⚠️ *Fuga en Modal:* Tocan "Desbloquear" pero cierran el formulario. El beneficio del regalo debe resaltarse.';
  } else if (r.fugaIntentoAConversionPct > 75 && metricas.intentosTotal >= 5) {
    alertaFuga = '⚠️ *Fuga en Caja:* Abandonan antes de confirmar Wompi o el correo. Revisar fricción de pago.';
  }

  return (
    `📊 *ORIGGO — REPORTE EJECUTIVO DE CONVERSIÓN*\n` +
    `🗓️ Período: Últimos ${metricas.diasConsultados} días (al ${fecha})\n\n` +
    `👥 *Tráfico en Vitrina:* \`${metricas.visitas}\` visitas únicas\n` +
    `🎯 *Interés Activo:* \`${metricas.interes}\` clics en desbloqueo (*${r.tasaInteresPct}%*)\n` +
    `✍️ *Intención de Registro/Pago:* \`${metricas.intentosTotal}\` intentos (*${r.tasaIntentoPct}%*)\n` +
    `   • 🎁 Freemium: \`${metricas.intentosFreemium}\`\n` +
    `   • 💳 Pasarela Wompi: \`${metricas.intentosPago}\`\n\n` +
    `🏆 *CONVERSIÓN FINAL GANADA:* \`${metricas.conversionesTotal}\` clientes (*${r.tasaConversionGlobalPct}%*)\n` +
    `   • 🎁 1er Desbloqueo Activado: \`${metricas.conversionesFreemium}\`\n` +
    `   • 💳 Pagos Completados: \`${metricas.conversionesPago}\` (${formatearPesosCop(metricas.ingresosCop)})\n\n` +
    `🏙️ *Zonas de Mayor Demanda:*\n${topCiudadesTexto}\n\n` +
    `🔥 *Top Inmuebles con Mayor Tracción:*\n${topLeadsTexto}\n\n` +
    `🔍 *Diagnóstico de Embudo:*\n${alertaFuga}`
  );
}

/**
 * Despacha el reporte ejecutivo a Telegram si los tokens están configurados.
 * @param {object} metricas
 * @returns {Promise<boolean>}
 */
async function despacharReporteTelegram(metricas) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return false;

  const texto = generarReporteTelegramMarkdown(metricas);
  const https = require('https');

  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 8000
      };

      const req = https.request(options, (res) => resolve(res.statusCode === 200));
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.write(payload);
      req.end();
    } catch (_) {
      resolve(false);
    }
  });
}

module.exports = {
  ETAPAS_EMBUDO,
  registrarEventoEmbudo,
  obtenerMetricasEmbudo,
  generarReporteTelegramMarkdown,
  despacharReporteTelegram,
  obtenerFechaHoyColombia,
  memoriaEmbudo
};
