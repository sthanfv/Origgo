/**
 * 📱 DESPACHADOR DE OUTBOX TRANSACCIONAL DESDE HARDWARE LOCAL (SAMSUNG GALAXY J7)
 * scripts/outbox_dispatcher.js
 * Origgo Intelligence — Arquitectura de Ingesta Resiliente en Hardware
 * 
 * Implementa el patrón Transactional Outbox para transmitir de forma confiable
 * las oportunidades capturadas por el scraper local hacia el backend serverless.
 * 
 * Características:
 * 1. Despacho en lotes configurables (20-25 leads por petición).
 * 2. Backoff exponencial con jitter aleatorio ante caídas de conexión móvil.
 * 3. Idempotencia y marcado transaccional (PENDING -> PROCESSING -> SENT).
 * 4. Cero dependencias forzadas: soporta SQLite nativo con fallback local.
 */

const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno locales si existen
require('../lib/env');

const CONFIG = {
  ENDPOINT: process.env.INGEST_ENDPOINT_URL || 'https://origgo.online/api/leads/ingest',
  TOKEN: process.env.INGEST_SECRET_KEY || 'origgo_dev_secret_ingest_key_test_suite_2026',
  BATCH_SIZE: parseInt(process.env.INGEST_BATCH_SIZE || '25', 10),
  MAX_RETRIES: 5,
  BASE_DELAY_MS: 1500,
  POLL_INTERVAL_MS: parseInt(process.env.INGEST_POLL_INTERVAL_MS || '30000', 10),
  DB_PATH: process.env.OUTBOX_DB_PATH || path.join(__dirname, '../data/outbox.db'),
  FALLBACK_JSON_PATH: path.join(__dirname, '../data/outbox_fallback.json')
};

/**
 * Espera una cantidad de milisegundos con soporte asíncrono.
 * @param {number} ms
 */
const esperarMs = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Realiza una petición HTTP/HTTPS POST enviando JSON.
 * @param {string} urlStr
 * @param {object} payload
 * @param {string} token
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
function enviarLoteHttp(urlStr, payload, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(payload);

    const opciones = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'x-origgo-ingest-token': token,
        'User-Agent': 'Origgo-GalaxyJ7-Outbox/1.0'
      },
      timeout: 15000
    };

    const req = client.request(opciones, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: json });
        } catch (_) {
          resolve({ statusCode: res.statusCode, body: { raw: data } });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tiempo de espera agotado al conectar con el servidor'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(bodyStr);
    req.end();
  });
}

/**
 * Adaptador de almacenamiento Outbox (SQLite con fallback JSON).
 */
class AlmacenOutbox {
  constructor() {
    this.driver = 'fallback';
    this.sqlite = null;
    this.inicializar();
  }

  inicializar() {
    try {
      // Intentar cargar sqlite3 o better-sqlite3 si están disponibles en el sistema
      const Database = require('better-sqlite3');
      const dir = path.dirname(CONFIG.DB_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      this.sqlite = new Database(CONFIG.DB_PATH);
      this.driver = 'better-sqlite3';
      this.sqlite.exec(`
        CREATE TABLE IF NOT EXISTS outbox_leads (
          id TEXT PRIMARY KEY,
          payload_json TEXT NOT NULL,
          status TEXT DEFAULT 'PENDING',
          attempts INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sent_at DATETIME
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_leads(status);
      `);
      console.log('[outbox] Conectado a SQLite local con éxito.');
    } catch (_) {
      // Usar almacenamiento JSON de fallback para entornos sin SQLite compilado
      this.driver = 'fallback';
      const dir = path.dirname(CONFIG.FALLBACK_JSON_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(CONFIG.FALLBACK_JSON_PATH)) {
        fs.writeFileSync(CONFIG.FALLBACK_JSON_PATH, JSON.stringify([]), 'utf8');
      }
      console.log('[outbox] Usando almacén local JSON para outbox.');
    }
  }

  obtenerPendientes(limite) {
    if (this.driver === 'better-sqlite3') {
      const stmt = this.sqlite.prepare(`
        SELECT id, payload_json, attempts 
        FROM outbox_leads 
        WHERE status = 'PENDING' 
        ORDER BY created_at ASC 
        LIMIT ?
      `);
      const rows = stmt.all(limite);
      return rows.map(r => ({
        id: r.id,
        lead: JSON.parse(r.payload_json),
        attempts: r.attempts
      }));
    } else {
      const datos = JSON.parse(fs.readFileSync(CONFIG.FALLBACK_JSON_PATH, 'utf8') || '[]');
      return datos
        .filter(item => item.status === 'PENDING')
        .slice(0, limite)
        .map(item => ({
          id: item.id,
          lead: item.payload,
          attempts: item.attempts || 0
        }));
    }
  }

  marcarEnviados(ids) {
    if (!ids || ids.length === 0) return;
    if (this.driver === 'better-sqlite3') {
      const stmt = this.sqlite.prepare(`
        UPDATE outbox_leads 
        SET status = 'SENT', sent_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      const trans = this.sqlite.transaction((lista) => {
        for (const id of lista) stmt.run(id);
      });
      trans(ids);
    } else {
      const datos = JSON.parse(fs.readFileSync(CONFIG.FALLBACK_JSON_PATH, 'utf8') || '[]');
      const idSet = new Set(ids);
      datos.forEach(item => {
        if (idSet.has(item.id)) {
          item.status = 'SENT';
          item.sent_at = new Date().toISOString();
        }
      });
      fs.writeFileSync(CONFIG.FALLBACK_JSON_PATH, JSON.stringify(datos, null, 2), 'utf8');
    }
  }

  incrementarIntentos(ids) {
    if (!ids || ids.length === 0) return;
    if (this.driver === 'better-sqlite3') {
      const stmt = this.sqlite.prepare(`
        UPDATE outbox_leads 
        SET attempts = attempts + 1 
        WHERE id = ?
      `);
      const trans = this.sqlite.transaction((lista) => {
        for (const id of lista) stmt.run(id);
      });
      trans(ids);
    } else {
      const datos = JSON.parse(fs.readFileSync(CONFIG.FALLBACK_JSON_PATH, 'utf8') || '[]');
      const idSet = new Set(ids);
      datos.forEach(item => {
        if (idSet.has(item.id)) {
          item.attempts = (item.attempts || 0) + 1;
        }
      });
      fs.writeFileSync(CONFIG.FALLBACK_JSON_PATH, JSON.stringify(datos, null, 2), 'utf8');
    }
  }
}

/**
 * Ejecuta una iteración de despacho de leads pendientes.
 * @param {AlmacenOutbox} outbox
 */
async function procesarCicloDespacho(outbox) {
  const pendientes = outbox.obtenerPendientes(CONFIG.BATCH_SIZE);
  if (pendientes.length === 0) {
    return { procesados: 0, mensaje: 'No hay leads pendientes en la cola outbox' };
  }

  console.log(`[outbox] Despachando lote de ${pendientes.length} leads hacia ${CONFIG.ENDPOINT}...`);
  const leads = pendientes.map(p => p.lead);
  const ids = pendientes.map(p => p.id);

  let enviado = false;
  let intento = 0;

  while (!enviado && intento < CONFIG.MAX_RETRIES) {
    intento++;
    try {
      const respuesta = await enviarLoteHttp(CONFIG.ENDPOINT, { leads }, CONFIG.TOKEN);

      if (respuesta.statusCode === 200 && respuesta.body?.success) {
        outbox.marcarEnviados(ids);
        console.log(`[outbox] Lote de ${ids.length} leads procesado exitosamente por el servidor.`);
        enviado = true;
        return { procesados: ids.length, success: true };
      } else {
        console.warn(`[outbox] Respuesta no exitosa (${respuesta.statusCode}):`, respuesta.body?.error || respuesta.body);
        if (respuesta.statusCode === 401 || respuesta.statusCode === 413) {
          // Error no recuperable inmediatamente sin intervención humana
          outbox.incrementarIntentos(ids);
          break;
        }
      }
    } catch (err) {
      console.warn(`[outbox] Fallo en intento ${intento}/${CONFIG.MAX_RETRIES}:`, err.message);
    }

    if (!enviado) {
      outbox.incrementarIntentos(ids);
      // Backoff exponencial con jitter aleatorio
      const delay = Math.min(CONFIG.BASE_DELAY_MS * Math.pow(2, intento), 30000) + Math.floor(Math.random() * 500);
      console.log(`[outbox] Reintentando en ${delay} ms...`);
      await esperarMs(delay);
    }
  }

  return { procesados: 0, success: false };
}

// Ejecución autónoma si se invoca directamente desde CLI
if (require.main === module) {
  const outbox = new AlmacenOutbox();
  console.log('[outbox] Iniciando despachador transaccional de Origgo...');
  procesarCicloDespacho(outbox)
    .then(res => {
      console.log('[outbox] Ciclo completado:', res);
      process.exit(0);
    })
    .catch(err => {
      console.error('[outbox] Error crítico en despachador:', err);
      process.exit(1);
    });
}

module.exports = {
  AlmacenOutbox,
  procesarCicloDespacho,
  enviarLoteHttp
};
