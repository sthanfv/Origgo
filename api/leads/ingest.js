/**
 * 📥 ENDPOINT BLINDADO DE INGESTA DE LEADS DESDE HARDWARE LOCAL
 * POST /api/leads/ingest
 * Origgo Intelligence — Arquitectura DevSecOps Estándar Desmulta
 * 
 * Recibe lotes de hasta 100 leads provenientes de la base SQLite local (Transactional Outbox)
 * del hardware Samsung Galaxy J7. Valida autenticación por token secreto mediante comparación
 * en tiempo constante, verifica integridad de datos, descarta anuncios desindexados por solicitud
 * de titulares (Notice & Takedown) y realiza inserción atómica en Firestore o almacén local.
 */

const crypto = require('crypto');
require('../../lib/env');
const db = require('../../lib/db');
const { encryptLeadContact, CURRENT_KID } = require('../../lib/crypto');
const { aplicarCorsSeguro } = require('../../lib/cors');
const { checkRateLimitAsync } = require('../../lib/rate-limiter');
const { invalidarCatalogo, desactivarLeads, reconciliarActivos } = require('../../lib/catalogo');
const { obtenerIdsListaNegra } = require('../../lib/support/blacklist');

/**
 * Valida un token entrante comparándolo en tiempo constante contra el valor esperado.
 * @param {string} tokenEntrante
 * @param {string} tokenEsperado
 * @returns {boolean}
 */
function verificarTokenEnTiempoConstante(tokenEntrante, tokenEsperado) {
  if (!tokenEntrante || !tokenEsperado) return false;
  const bufEntrante = Buffer.from(String(tokenEntrante).trim());
  const bufEsperado = Buffer.from(String(tokenEsperado).trim());
  if (bufEntrante.length !== bufEsperado.length) return false;
  return crypto.timingSafeEqual(bufEntrante, bufEsperado);
}

/**
 * Limpia y normaliza un precio numérico.
 * @param {number|string} val
 * @returns {number}
 */
function extraerPrecioNumerico(val) {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (!val) return 0;
  const limpio = String(val).replace(/[^\d]/g, '');
  return parseInt(limpio, 10) || 0;
}

/**
 * Manejador principal serverless para la ingesta de leads.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
async function handler(req, res) {
  if (aplicarCorsSeguro(req, res)) return;

  try {
    // 1. Restricción estricta de método HTTP
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({
        success: false,
        error: 'Método no permitido. Solo se acepta POST.'
      });
    }

    // 2. Control de saturación (Rate Limiting para ingesta: 60 peticiones por minuto por IP)
    const permitido = await checkRateLimitAsync(req, res, {
      prefix: 'ingest_leads',
      maxRequests: 60,
      windowMs: 60000,
      error: 'LIMITE_INGESTA_EXCEDIDO',
      message: 'Límite de peticiones de ingesta excedido. Intente más tarde.'
    });
    if (!permitido) return;

    // 3. Autenticación por token secreto
    const tokenEntrante = req.headers['x-origgo-ingest-token'] || 
      (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null);

    const tokenEsperado = process.env.INGEST_SECRET_KEY;

    if (!tokenEsperado || !verificarTokenEnTiempoConstante(tokenEntrante, tokenEsperado)) {
      return res.status(401).json({
        success: false,
        error: 'Token de ingesta no autorizado o ausente'
      });
    }

    // 4. Extracción y validación del lote de leads (soporte para body en string o JSON)
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        return res.status(400).json({
          success: false,
          error: 'Cuerpo de petición inválido. JSON malformado.'
        });
      }
    }
    body = body || {};
    const items = Array.isArray(body) ? body : (Array.isArray(body.leads) ? body.leads : null);
    // [2026-09-25] El cazador publica solo cambios: además de inmuebles nuevos/modificados puede
    // enviar `retirados` (se desactivan) y, en su primera publicación, `idsVigentes` con
    // `reconciliar: true` (se desactiva todo lo activo que no esté en el catálogo real).
    const retirados = Array.isArray(body.retirados) ? body.retirados.map((x) => String(x).trim()).filter(Boolean) : [];
    const reconciliar = body.reconciliar === true && Array.isArray(body.idsVigentes);
    if (retirados.length > 100 || (reconciliar && body.idsVigentes.length > 1000)) {
      return res.status(413).json({ success: false, error: 'Demasiados identificadores en una sola petición' });
    }

    if (!items || (items.length === 0 && retirados.length === 0 && !reconciliar)) {
      return res.status(400).json({
        success: false,
        error: 'Cuerpo de petición inválido. Se requiere un arreglo de leads no vacío.'
      });
    }

    // Límite de 100 leads por lote para prevenir cuellos de botella en funciones serverless
    if (items.length > 100) {
      return res.status(413).json({
        success: false,
        error: 'El lote excede el límite máximo permitido de 100 leads por petición'
      });
    }

    const encryptionKey = process.env.LEADS_ENCRYPTION_KEY;
    const leadsAptos = [];
    let desindexadosOmitidos = 0;
    let invalidosOmitidos = 0;

    // Lista negra de una sola vez y desde caché (antes: 1 lectura de Firestore por inmueble).
    const listaNegra = items.length > 0 ? new Set(await obtenerIdsListaNegra()) : new Set();

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        invalidosOmitidos++;
        continue;
      }

      const id = item.id ? String(item.id).trim() : '';
      const titulo = item.titulo ? String(item.titulo).trim() : '';
      const precioRaw = extraerPrecioNumerico(item.precio_raw || item.precio);

      if (!id || !titulo || precioRaw <= 0) {
        invalidosOmitidos++;
        continue;
      }

      // 5. Filtro de salvaguarda: desindexación por solicitud de titular (Notice & Takedown)
      const estaDesindexado = listaNegra.has(id);
      if (estaDesindexado) {
        desindexadosOmitidos++;
        continue;
      }

      // 6. Integridad criptográfica: contacto cifrado en reposo
      let contactoCifrado = item.contacto_cifrado || null;
      if (!contactoCifrado && (item.telefono_propietario || item.telefono || item.phone)) {
        if (encryptionKey && encryptionKey.length === 64) {
          try {
            contactoCifrado = encryptLeadContact({
              telefono: item.telefono_propietario || item.telefono || item.phone,
              enlace: item.enlace || item.url || null,
              portal: item.portal || 'Directo'
            }, encryptionKey, CURRENT_KID);
          } catch (_) {}
        }
      }

      // Si aún carece de contacto cifrado y no se pudo generar, descartar por integridad
      if (!contactoCifrado) {
        invalidosOmitidos++;
        continue;
      }

      const registroLimpio = {
        ...item,
        id,
        titulo,
        precio_raw: precioRaw,
        precio: item.precio || `$ ${precioRaw.toLocaleString('es-CO')}`,
        contacto_cifrado: contactoCifrado,
        // Sin esto el catálogo público (que filtra activo == true) no mostraba lo ingerido.
        activo: true
      };

      // Limpieza estricta: nunca asignar undefined para compatibilidad con Firestore
      delete registroLimpio.telefono_propietario;
      delete registroLimpio.telefono;
      delete registroLimpio.phone;
      delete registroLimpio.url;
      delete registroLimpio.enlace;

      leadsAptos.push(registroLimpio);
    }

    // 7. Persistencia atómica en Firestore / almacén local
    const resultado = await db.upsertLeadsBatch(leadsAptos);
    const desactivados = await desactivarLeads(retirados);
    const reconciliados = reconciliar ? await reconciliarActivos(body.idsVigentes) : 0;

    // La vitrina muestra los cambios de inmediato (sin esperar a que venza la caché).
    if (resultado.count > 0 || desactivados > 0 || reconciliados > 0) await invalidarCatalogo();

    return res.status(200).json({
      success: true,
      procesados: resultado.count,
      desactivados,
      reconciliados,
      desindexadosOmitidos,
      invalidosOmitidos,
      ids: resultado.ids
    });
  } catch (err) {
    console.error('[api/leads/ingest] Error no controlado en ingesta:', err);
    return res.status(500).json({
      success: false,
      error: 'ERROR_INTERNO_INGESTA',
      message: err.message
    });
  }
}

module.exports = handler;
