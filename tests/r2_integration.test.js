/**
 * 🧪 PRUEBA UNITARIA: INTEGRACIÓN CLOUDFLARE R2 EN EL FRONTEND
 * tests/r2_integration.test.js
 * 
 * Valida:
 * 1. Declaración de catalogoR2Url en config.js.
 * 2. Disponibilidad y tiempo de respuesta del catálogo en la CDN de Cloudflare R2.
 * 3. Validez del contrato de datos JSON obtenido desde R2.
 * 4. Disponibilidad del archivo de firma criptográfica HMAC en R2.
 */

const test = require('node:test');
const assert = require('node:assert');
const https = require('https');
const PORTAL_CONFIG = require('../config');

test('Suite DevSecOps Integración Cloudflare R2 Frontend', async (t) => {
  await t.test('1. config.js debe declarar catalogoR2Url como URL HTTPS válida', () => {
    assert.ok(PORTAL_CONFIG.catalogoR2Url, 'catalogoR2Url debe existir en PORTAL_CONFIG');
    assert.ok(PORTAL_CONFIG.catalogoR2Url.startsWith('https://'), 'catalogoR2Url debe ser HTTPS');
    assert.ok(PORTAL_CONFIG.catalogoR2Url.includes('r2.dev'), 'catalogoR2Url debe apuntar a la CDN r2.dev');
  });

  await t.test('2. Catálogo en Cloudflare R2 debe responder HTTP 200 con JSON válido', async () => {
    const url = PORTAL_CONFIG.catalogoR2Url;
    const t0 = Date.now();

    const resultado = await new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: 5000 }, (res) => {
        let cuerpo = '';
        res.on('data', chunk => cuerpo += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            contentType: res.headers['content-type'],
            body: cuerpo,
            latenciaMs: Date.now() - t0
          });
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout de lectura en Cloudflare R2'));
      });
    });

    assert.strictEqual(resultado.status, 200, `R2 debe responder HTTP 200 (obtenido ${resultado.status})`);
    assert.ok(resultado.latenciaMs < 3000, `Latencia R2 aceptable (< 3000ms, obtenida: ${resultado.latenciaMs}ms)`);

    const json = JSON.parse(resultado.body);
    assert.ok(Array.isArray(json.leads), 'El catálogo debe contener arreglo de leads');
    assert.ok(json.leads.length > 0, `El catálogo debe tener leads (obtenidos: ${json.leads.length})`);
    assert.ok(typeof json.config === 'object', 'El catálogo debe incluir objeto config');
  });

  await t.test('3. Firma criptográfica HMAC .sig debe estar disponible en R2', async () => {
    const urlSig = `${PORTAL_CONFIG.catalogoR2Url}.sig`;

    const resultadoSig = await new Promise((resolve, reject) => {
      https.get(urlSig, { timeout: 5000 }, (res) => {
        let cuerpo = '';
        res.on('data', chunk => cuerpo += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: cuerpo.trim() }));
      }).on('error', reject);
    });

    assert.strictEqual(resultadoSig.status, 200, 'Firma .sig en R2 debe responder HTTP 200');
    assert.strictEqual(resultadoSig.body.length, 64, 'La firma HMAC debe ser un hash hexadecimal de 64 caracteres');
  });
});
