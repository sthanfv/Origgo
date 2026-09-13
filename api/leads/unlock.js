/**
 * 🔓 ENDPOINT DE DESBLOQUEO SEGURO DE CONTACTOS FSBO
 * POST /api/leads/unlock
 * 
 * Verifica el balance de créditos del usuario o plan VIP,
 * descuenta 1 crédito de forma atómica (si no ha sido desbloqueado previamente),
 * y descifra en memoria el teléfono y enlace real utilizando AES-256-GCM.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../../lib/db');
const { signJwt, verifyJwt, decryptLeadContact } = require('../../lib/crypto');
const { checkRateLimitAsync } = require('../../lib/rate-limiter');
const { aplicarCorsSeguro } = require('../../lib/cors');
const { unlockLeadSchema, validateBody } = require('../../lib/validation');
const { requireEnv } = require('../../lib/env');
const { obtenerLeadPorId } = require('../../lib/leads');
const { ejecutarConIdempotencia } = require('../../lib/idempotency');

const JWT_SECRET = requireEnv('JWT_SECRET', {
  testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232'
});
const LEADS_ENCRYPTION_KEY = requireEnv('LEADS_ENCRYPTION_KEY', {
  testFallback: 'cf5e87913d4cf975ab463ada86e9ce905b9d5306c5188af3f8a074159cbf9a2c'
});

/**
 * Verifica la integridad HMAC-SHA256 de un archivo de datos.
 * Si el archivo .sig no existe, se permite (compatibilidad hacia atrás).
 * Si existe y no coincide, rechaza los datos.
 * @param {string} dataset - Nombre del archivo (ej. "inmobiliario.json")
 * @returns {{ valido: boolean, razon: string }}
 */
function verificarIntegridadDataset(dataset) {
  const dataDir = path.join(__dirname, '..', '..', 'data');
  const rutaJson = path.join(dataDir, dataset);
  const rutaSig = rutaJson + '.sig';

  // Si no existe archivo de firma, permitir (compatibilidad)
  if (!fs.existsSync(rutaSig)) {
    return { valido: true, razon: 'sin_firma' };
  }

  try {
    const contenido = fs.readFileSync(rutaJson, 'utf8');
    const firmaEsperada = fs.readFileSync(rutaSig, 'utf8').trim();

    const firmaCalculada = crypto
      .createHmac('sha256', LEADS_ENCRYPTION_KEY)
      .update(contenido)
      .digest('hex');

    // Comparación en tiempo constante para prevenir ataques de temporización
    const bufEsperada = Buffer.from(firmaEsperada);
    const bufCalculada = Buffer.from(firmaCalculada);

    if (bufEsperada.length !== bufCalculada.length) {
      return { valido: false, razon: 'longitud_firma_invalida' };
    }

    const coincide = crypto.timingSafeEqual(bufEsperada, bufCalculada);
    return { valido: coincide, razon: coincide ? 'firma_valida' : 'firma_no_coincide' };
  } catch (e) {
    return { valido: false, razon: 'error_verificacion' };
  }
}

const HOSTS_ANUNCIOS_PERMITIDOS = [
  'fincaraiz.com.co',
  'metrocuadrado.com',
  'tucarro.com.co',
  'mercadolibre.com.co'
];

function hostPermitido(hostname, hostsPermitidos) {
  return hostsPermitidos.some(host => hostname === host || hostname.endsWith(`.${host}`));
}

function sanitizarUrlServidor(urlRaw, hostsPermitidos) {
  const valor = String(urlRaw || '').trim();
  if (!valor) return null;

  try {
    const url = new URL(valor);
    if (url.protocol !== 'https:') return null;
    if (!hostPermitido(url.hostname.toLowerCase(), hostsPermitidos)) return null;
    return url.href;
  } catch (e) {
    return null;
  }
}

function ciudadLeadOficial(lead) {
  return String(lead?.ciudad || lead?.ubicacion || lead?.barrio || '').trim();
}

function portalSeguro(portalRaw) {
  const portal = String(portalRaw || 'fincaraiz').replace(/[^a-z0-9 ._-]/gi, '').trim();
  return (portal || 'fincaraiz').slice(0, 40).toUpperCase();
}

/**
 * Determina el saludo cortés formal según la hora local de Colombia (UTC-5).
 * @param {Date} [fecha]
 * @returns {string} 'Buen día', 'Buenas tardes' o 'Buenas noches'
 */
function obtenerSaludoHorario(fecha = new Date()) {
  try {
    const hora = fecha.toLocaleString('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false });
    const h = parseInt(hora, 10);
    if (h >= 5 && h < 12) return 'Buen día';
    if (h >= 12 && h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  } catch (e) {
    return 'Buen día';
  }
}

module.exports = async function handler(req, res) {
  aplicarCorsSeguro(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 🛡️ Rate Limiting: máx 30 desbloqueos por minuto por IP con Upstash Redis
  if (!(await checkRateLimitAsync(req, res, { prefix: 'leads_unlock', maxRequests: 30, windowMs: 60 * 1000 }))) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utilice POST.' });
  }

  try {
    // Parsear el cuerpo tempranamente para detectar idioma preferido
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'JSON malformado' });
      }
    }
    const earlyLang = (body && body.lang) || ((req.headers['accept-language'] || '').includes('en') ? 'en' : 'es');
    const isEarlyEn = earlyLang === 'en';

    // 1. Validar autenticación por JWT
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return res.status(401).json({ 
        error: isEarlyEn ? 'Not authenticated. Please acquire credits or enter your PIN.' : 'No autenticado. Por favor adquiere créditos o ingresa tu PIN.' 
      });
    }

    const session = verifyJwt(token, JWT_SECRET);
    if (!session || !session.phone) {
      return res.status(401).json({ 
        error: isEarlyEn ? 'Session expired or invalid. Please log in again with your WhatsApp and PIN.' : 'Sesión expirada o inválida. Inicia sesión nuevamente con tu WhatsApp y PIN.' 
      });
    }

    // 🛡️ Validación estricta con Zod
    const validation = validateBody(unlockLeadSchema, body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: validation.message,
        issues: validation.issues 
      });
    }

    const { leadId, contactoCifrado, leadCity, lang = 'es' } = validation.data;
    const isEn = lang === 'en';

    const leadCatalogo = obtenerLeadPorId(leadId);
    const permiteContactoDePrueba = process.env.NODE_ENV === 'test' && contactoCifrado;

    // Verificar integridad HMAC-SHA256 del dataset si existe firma
    if (leadCatalogo && leadCatalogo.dataset) {
      const integridad = verificarIntegridadDataset(leadCatalogo.dataset);
      if (!integridad.valido) {
        console.error(`[unlock] INTEGRIDAD COMPROMETIDA: ${leadCatalogo.dataset} → ${integridad.razon}`);
        return res.status(403).json({
          ok: false,
          error: 'INTEGRIDAD_COMPROMETIDA',
          message: isEn ? 'Catalog data integrity compromised. Unlock rejected for security.' : 'Los datos del catálogo han sido alterados. Desbloqueo rechazado por seguridad.'
        });
      }
    }

    if (!leadCatalogo && !permiteContactoDePrueba) {
      return res.status(404).json({
        ok: false,
        error: 'LEAD_NO_ENCONTRADO',
        message: isEn ? 'The requested property does not exist in the official catalog.' : 'El lead solicitado no existe en el catálogo oficial.'
      });
    }

    const contactoCifradoOficial = permiteContactoDePrueba ? contactoCifrado : (leadCatalogo?.contacto_cifrado || '');
    const leadCityOficial = permiteContactoDePrueba && leadCity ? leadCity : ciudadLeadOficial(leadCatalogo);

    if (!contactoCifradoOficial) {
      return res.status(404).json({
        ok: false,
        error: 'CONTACTO_NO_DISPONIBLE',
        message: isEn ? 'This property has no private contact available for unlock.' : 'Este lead no tiene contacto privado disponible para desbloqueo.'
      });
    }

    // 3. Descifrar el contacto en memoria antes de tocar el ledger para evitar cargos fallidos
    let contactoDescifrado = null;
    const keysToTry = [LEADS_ENCRYPTION_KEY].filter(Boolean);

    for (const k of keysToTry) {
      try {
        contactoDescifrado = decryptLeadContact(contactoCifradoOficial, k);
        if (contactoDescifrado) break;
      } catch (e) {}
    }

    if (!contactoDescifrado) {
      return res.status(500).json({
        ok: false,
        error: 'CONTACTO_NO_DESCIFRABLE',
        message: isEn ? 'Unable to decrypt property contact. Zero credits deducted.' : 'No fue posible descifrar el contacto del lead. No se descontaron créditos.'
      });
    }

    const headers = req.headers || {};
    const idempotencyKey = String(headers['idempotency-key'] || headers['Idempotency-Key'] || headers['IDEMPOTENCY-KEY'] || '').trim();
    const esIdempotente = Boolean(idempotencyKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey));

    const procesarDesbloqueo = async () => {
      // 3. Ejecutar desbloqueo en el ledger con rehidratación stateless desde sesión
      const resultado = await db.unlockLead(session.phone, leadId, session, leadCityOficial);

      if (!resultado.success) {
        return {
          esError: true,
          error: resultado.error,
          message: resultado.message,
          credits: resultado.credits || 0
        };
      }

      // 4. Normalizar teléfono y enlace original del inmueble
      const rawTel = contactoDescifrado?.telefono || '';
      const telLimpio = rawTel.replace(/\D/g, '');
      const esCelularValido = !rawTel.includes('...') && telLimpio.length >= 10 && (telLimpio.startsWith('573') || telLimpio.startsWith('3'));

      let whatsappUrl = null;
      let telLlamar = null;
      let telefonoDisplay = rawTel;

      if (esCelularValido) {
        const waNum = telLimpio.startsWith('57') ? telLimpio : `57${telLimpio}`;
        const cel10 = telLimpio.startsWith('57') ? telLimpio.substring(2) : telLimpio;
        telefonoDisplay = `+57 ${cel10.substring(0, 3)} ${cel10.substring(3, 6)} ${cel10.substring(6)}`;
        telLlamar = `+${waNum}`;

        // Plantilla Formal y Respetuosa para contacto directo con propietarios de alto patrimonio
        const ubicacion = contactoDescifrado?.barrioOriginal || leadCatalogo?.barrio || leadCatalogo?.ciudad || (lang === 'en' ? 'your area' : 'su zona');
        const tipoRaw = (leadCatalogo?.tipo_inmueble || 'inmueble').toLowerCase();
        const mapeoTipoEn = {
          'apartamento': 'apartment',
          'casa': 'house',
          'lote': 'lot / land',
          'oficina': 'office',
          'local': 'commercial property',
          'bodega': 'warehouse',
          'finca': 'country estate',
          'edificio': 'building',
          'consultorio': 'medical / office suite'
        };
        const tipo = lang === 'en' ? (mapeoTipoEn[tipoRaw] || tipoRaw || 'property') : tipoRaw;
        let textoMensaje = '';
        if (lang === 'en') {
          textoMensaje = `Hello, I am contacting you regarding your property listing for the ${tipo} in ${ubicacion}. I would like to get more details and schedule a viewing if possible. Thank you.`;
        } else {
          const saludo = obtenerSaludoHorario();
          textoMensaje = `${saludo}, le escribo con respecto a su publicación del ${tipo} en ${ubicacion}. Me gustaría conocer más detalles sobre la propiedad y coordinar una visita, de ser posible. Quedo atento a su respuesta, muchas gracias.`;
        }
        const mensajeWa = encodeURIComponent(textoMensaje);
        whatsappUrl = `https://wa.me/${waNum}?text=${mensajeWa}`;
      } else if (rawTel) {
        telefonoDisplay = rawTel.includes('...')
          ? (lang === 'en' ? `${rawTel} (Direct Link)` : `${rawTel} (Enlace Directo)`)
          : rawTel;
      } else {
        telefonoDisplay = lang === 'en' ? 'Available in Original Listing' : 'Disponible en Anuncio Original';
      }

      const enlace = sanitizarUrlServidor(contactoDescifrado?.enlace, HOSTS_ANUNCIOS_PERMITIDOS) || 'https://www.fincaraiz.com.co';
      const portal = portalSeguro(contactoDescifrado?.portal || leadCatalogo?.portal || leadCatalogo?.dataset);

      // 6. Emitir nuevo JWT firmado con el estado actualizado (Stateless Signed Token)
      const userPayload = resultado.user || {};
      const newToken = signJwt({
        phone: session.phone,
        credits: resultado.credits,
        unlockedLeads: resultado.unlockedLeads || [],
        plan: userPayload.plan || session.plan || 'free',
        planCity: userPayload.planCity || session.planCity || null,
        planExpiresAt: userPayload.planExpiresAt || session.planExpiresAt || null,
        role: 'buyer'
      }, JWT_SECRET, 30);

      const siguientesPasos = lang === 'en' ? [
        {
          paso: 1,
          clave: 'contact',
          titulo: 'Direct Outreach',
          accion: 'Send pre-formatted WhatsApp message or place direct phone call to owner.'
        },
        {
          paso: 2,
          clave: 'tour',
          titulo: 'Schedule Viewing',
          accion: 'Request additional photos or video walkthrough and coordinate an on-site visit.'
        },
        {
          paso: 3,
          clave: 'closing',
          titulo: 'Direct Closing (0% Commission)',
          accion: 'Review Title Certificate (Certificado de Tradición y Libertad) and agree terms with zero agency fees.'
        }
      ] : [
        {
          paso: 1,
          clave: 'contact',
          titulo: 'Contacto Inmediato',
          accion: 'Envía el mensaje de WhatsApp preparado o realiza llamada directa al propietario.'
        },
        {
          paso: 2,
          clave: 'tour',
          titulo: 'Agendar Visita',
          accion: 'Pide fotos o videos adicionales y agenda visita presencial al inmueble.'
        },
        {
          paso: 3,
          clave: 'closing',
          titulo: 'Cierre Directo (0% Comisión)',
          accion: 'Verifica el Certificado de Tradición y Libertad y acuerda el precio sin intermediarios.'
        }
      ];

      return {
        ok: true,
        leadId,
        alreadyUnlocked: resultado.alreadyUnlocked,
        creditsRemaining: resultado.credits,
        unlockedLeads: resultado.unlockedLeads,
        token: newToken,
        planBenefit: Boolean(resultado.planBenefit),
        dailyUnlocksRemaining: resultado.dailyUnlocksRemaining,
        contacto: {
          telefono: rawTel || telefonoDisplay,
          telefonoDisplay: telefonoDisplay || rawTel,
          telLlamar,
          esCelularValido,
          whatsappUrl,
          enlace,
          portal,
          nota: lang === 'en'
            ? 'Direct with verified owner. We recommend reviewing the title certificate before closing.'
            : 'Directo con propietario verificado. Recomendamos verificar certificado de tradición.'
        },
        datosRevelados: {
          tituloOriginal: contactoDescifrado?.tituloOriginal || null,
          barrioOriginal: contactoDescifrado?.barrioOriginal || null,
          ubicacionCompleta: contactoDescifrado?.ubicacionCompleta || null
        },
        siguientesPasos
      };
    };

    const respuestaFinal = esIdempotente
      ? await ejecutarConIdempotencia(`unlock:${session.phone}:${idempotencyKey}`, procesarDesbloqueo, { ttlSegundos: 300 })
      : await procesarDesbloqueo();

    if (respuestaFinal.esError) {
      const isEn = lang === 'en';
      if (respuestaFinal.error === 'CUOTA_DIARIA_EXCEDIDA') {
        return res.status(429).json({
          ok: false,
          error: 'CUOTA_DIARIA_EXCEDIDA',
          message: isEn
            ? 'You have reached the fair use limit of 35 daily unlocks. For security, your quota resets tomorrow at 00:00.'
            : (respuestaFinal.message || 'Has alcanzado la cuota de uso justo de 35 contactos diarios. Por seguridad y prevención de intermediación masiva, tu cuota se reiniciará mañana a las 00:00.'),
          credits: respuestaFinal.credits || 0
        });
      }
      if (respuestaFinal.error === 'PLAN_CIUDAD_DIFERENTE') {
        return res.status(403).json({
          ok: false,
          error: 'PLAN_CIUDAD_DIFERENTE',
          message: isEn
            ? 'Your Pro City Pass does not cover this municipality. Individual credits required.'
            : (respuestaFinal.message || 'Tu Plan Pro Ciudad no cubre este municipio. Requiere créditos individuales.'),
          credits: respuestaFinal.credits || 0
        });
      }
      if (respuestaFinal.error === 'SALDO_INSUFICIENTE') {
        return res.status(402).json({
          ok: false,
          error: 'SALDO_INSUFICIENTE',
          message: isEn
            ? 'Insufficient credits to unlock this property. Top up your balance or acquire a pass.'
            : 'No tienes créditos suficientes. Adquiere un pase individual o una bolsa con descuento.',
          credits: respuestaFinal.credits
        });
      }
      return res.status(400).json({ ok: false, error: respuestaFinal.error });
    }

    return res.status(200).json(respuestaFinal);
  } catch (error) {
    console.error('[unlock] Error en desbloqueo:', error);
    return res.status(500).json({ error: 'Error procesando el desbloqueo del inmueble.' });
  }
};
