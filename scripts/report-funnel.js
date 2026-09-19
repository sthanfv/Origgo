#!/usr/bin/env node
/**
 * 📊 REPORTE DE EMBUDO DE CONVERSIÓN Y TELEMETRÍA COMERCIAL (scripts/report-funnel.js)
 * Herramienta de auditoría CRO y diagnóstico de fugas de conversión para Origgo.
 * 
 * Uso:
 *   node scripts/report-funnel.js                      # Reporte en consola últimos 7 días
 *   node scripts/report-funnel.js --dias=14            # Reporte en consola últimos 14 días
 *   node scripts/report-funnel.js --send-telegram      # Despachar reporte directamente a Telegram
 *   node scripts/report-funnel.js --export-csv         # Exportar métricas a CSV (funnel-metrics.csv)
 *   node scripts/report-funnel.js --json               # Salida JSON cruda para automatizaciones
 */

const fs = require('fs');
const path = require('path');

// Cargar variables de entorno del proyecto
require('../lib/env');

const {
  obtenerMetricasEmbudo,
  generarReporteTelegramMarkdown,
  despacharReporteTelegram
} = require('../lib/funnel');

async function main() {
  const args = process.argv.slice(2);

  // Parsear argumentos
  let dias = 7;
  let sendTelegram = false;
  let exportCsv = false;
  let rutaCsv = path.join(process.cwd(), 'funnel-metrics.csv');
  let salidaJson = false;

  for (const arg of args) {
    if (arg.startsWith('--dias=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (!isNaN(val) && val > 0) dias = val;
    } else if (arg === '--send-telegram') {
      sendTelegram = true;
    } else if (arg === '--export-csv' || arg === '--csv') {
      exportCsv = true;
    } else if (arg.startsWith('--export-csv=')) {
      exportCsv = true;
      rutaCsv = path.resolve(arg.split('=')[1]);
    } else if (arg === '--json') {
      salidaJson = true;
    }
  }

  try {
    const metricas = await obtenerMetricasEmbudo({ dias });

    if (salidaJson) {
      console.log(JSON.stringify(metricas, null, 2));
      return;
    }

    const reporteTexto = generarReporteTelegramMarkdown(metricas);

    // Imprimir en consola de forma legible
    console.log('\n============================================================');
    console.log(reporteTexto.replace(/\*/g, '').replace(/`/g, ''));
    console.log('============================================================\n');

    // Despacho a Telegram si fue solicitado
    if (sendTelegram) {
      console.log('📡 Despachando reporte a Telegram...');
      const enviado = await despacharReporteTelegram(metricas);
      if (enviado) {
        console.log('✅ ¡Reporte enviado con éxito al canal de Telegram!');
      } else {
        console.warn('⚠️ No se pudo enviar a Telegram. Verifica TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en .env');
      }
    }

    // Exportación a archivo CSV si fue solicitada
    if (exportCsv) {
      const lineasCsv = [
        'Metrica,Valor',
        `Dias Consultados,${metricas.diasConsultados}`,
        `Visitas Unicas Vitrina,${metricas.visitas}`,
        `Interes Activo (Clic Desbloqueo),${metricas.interes}`,
        `Intentos Totales,${metricas.intentosTotal}`,
        `Intentos Freemium,${metricas.intentosFreemium}`,
        `Intentos Pago Wompi,${metricas.intentosPago}`,
        `Conversiones Ganadas,${metricas.conversionesTotal}`,
        `Conversiones Freemium (1er Desbloqueo),${metricas.conversionesFreemium}`,
        `Conversiones Pago Wompi,${metricas.conversionesPago}`,
        `Ingresos Totales COP,${metricas.ingresosCop}`,
        `Tasa Interes (%),${metricas.ratios?.tasaInteresPct || 0}`,
        `Tasa Intento (%),${metricas.ratios?.tasaIntentoPct || 0}`,
        `Tasa Cierre (%),${metricas.ratios?.tasaCierrePct || 0}`,
        `Tasa Conversion Global (%),${metricas.ratios?.tasaConversionGlobalPct || 0}`,
        `Fuga Vitrina a Interes (%),${metricas.ratios?.fugaVisitaAInteresPct || 0}`,
        `Fuga Interes a Intento (%),${metricas.ratios?.fugaInteresAIntentoPct || 0}`,
        `Fuga Intento a Conversion (%),${metricas.ratios?.fugaIntentoAConversionPct || 0}`
      ];

      fs.writeFileSync(rutaCsv, lineasCsv.join('\n'), 'utf8');
      console.log(`📁 Métricas exportadas exitosamente a CSV: ${rutaCsv}`);
    }

  } catch (error) {
    console.error('💥 Error generando reporte del embudo:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
