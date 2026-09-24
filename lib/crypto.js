/**
 * 🔐 MÓDULO CRIPTOGRÁFICO Y GESTIÓN DE SESIONES JWT (ZERO-DEPENDENCY)
 * Hunter Pro Intelligence — Arquitectura DevSecOps Estándar Desmulta
 * 
 * Implementa cifrado simétrico AES-256-GCM, tokens JWT firmados con HMAC-SHA256,
 * comparación en tiempo constante (timingSafeEqual) y generación de PIN de respaldo.
 */

const crypto = require('crypto');

const CURRENT_KID = process.env.LEADS_KEY_VERSION || 'v1';
const CANONICAL_LEADS_KEY = 'cf5e87913d4cf975ab463ada86e9ce905b9d5306c5188af3f8a074159cbf9a2c';

/**
 * Obtiene el conjunto de claves criptográficas autorizadas (Keyring) para leads.
 * Soporta configuración por LEADS_KEYS_JSON, LEADS_ENCRYPTION_KEY_V2 y LEADS_ENCRYPTION_KEY.
 * Siempre incluye la clave canónica del catálogo para evitar bloqueos de descifrado en producción.
 * @param {string} [fallbackKey] - Clave por defecto si no hay variable de entorno
 * @returns {{ keys: Record<string, string>, activeKid: string }}
 */
function obtenerKeyRingLeads(fallbackKey) {
  const keys = {
    canonical: CANONICAL_LEADS_KEY,
    v1: CANONICAL_LEADS_KEY,
    default: CANONICAL_LEADS_KEY
  };

  if (process.env.LEADS_KEYS_JSON) {
    try {
      const parsed = JSON.parse(process.env.LEADS_KEYS_JSON);
      if (typeof parsed === 'object' && parsed !== null) {
        Object.assign(keys, parsed);
      }
    } catch (e) {
      console.warn('[crypto] Advertencia: LEADS_KEYS_JSON no es un JSON válido');
    }
  }

  const k1 = (process.env.LEADS_ENCRYPTION_KEY || fallbackKey || '').trim();
  if (k1 && k1.length === 64) {
    keys.env = k1;
    keys.active = k1;
    if (k1 !== CANONICAL_LEADS_KEY) {
      keys.v2 = k1;
    }
  }

  const k2 = (process.env.LEADS_ENCRYPTION_KEY_V2 || '').trim();
  if (k2 && k2.length === 64) {
    keys.v2 = k2;
  }

  const activeKid = (process.env.LEADS_KEY_VERSION && keys[process.env.LEADS_KEY_VERSION])
    ? process.env.LEADS_KEY_VERSION
    : (keys.env ? 'env' : 'v1');

  return { keys, activeKid };
}

/**
 * Cifra datos confidenciales de contacto con AES-256-GCM y soporte de versionado (kid).
 * @param {object} datos - { telefono, enlace, portal, ... }
 * @param {string} claveHex - Llave simétrica de 256 bits (64 hex)
 * @param {string} [version='v1'] - Versión de la clave criptográfica (kid)
 * @returns {string} Cadena en formato "v1:iv:authTag:ciphertext" o "iv:authTag:ciphertext"
 */
function encryptLeadContact(datos, claveHex, version = 'v1') {
  if (!claveHex || claveHex.length !== 64) {
    throw new Error('LEADS_ENCRYPTION_KEY inválida o no configurada (debe ser de 64 hex)');
  }
  const key = Buffer.from(claveHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const textoPlano = JSON.stringify(datos);
  let ciphertext = cipher.update(textoPlano, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return version 
    ? `${version}:${iv.toString('hex')}:${authTag}:${ciphertext}`
    : `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * Helper interno para descifrado simétrico AES-256-GCM.
 */
function descifrarConClave(ivHex, authTagHex, cipherHex, claveHex) {
  if (!claveHex || claveHex.length !== 64) return null;
  try {
    const key = Buffer.from(claveHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (_) {
    return null;
  }
}

/**
 * Descifra la información de contacto de un lead utilizando AES-256-GCM.
 * Compatible tanto con formato legado ("iv:authTag:ciphertext") como versionado ("kid:iv:authTag:ciphertext").
 * Soporta keyring dinámico con fallback transparente entre versiones.
 * @param {string} contactoCifrado - Cadena cifrada con o sin prefijo de versión
 * @param {string|object} claveOKeyRing - Llave de 64 hex o llavero { v1: key1, v2: key2 }
 * @returns {object|null} Objeto descifrado o null si falla la autenticación/descifrado
 */
function decryptLeadContact(contactoCifrado, claveOKeyRing) {
  if (!contactoCifrado || typeof contactoCifrado !== 'string') return null;

  try {
    const partes = contactoCifrado.split(':');
    let ivHex, authTagHex, cipherHex, targetKid = null;

    if (partes.length === 4) {
      // Formato moderno con versionado: "v1:iv:authTag:ciphertext" o "v2:..."
      const [ver, iv, tag, cipher] = partes;
      targetKid = ver;
      ivHex = iv;
      authTagHex = tag;
      cipherHex = cipher;
    } else if (partes.length === 3) {
      // Formato legado sin prefijo de versión: "iv:authTag:ciphertext"
      targetKid = 'v1';
      [ivHex, authTagHex, cipherHex] = partes;
    } else {
      return null;
    }

    // 1. Caso clave única en string (64 hex)
    if (typeof claveOKeyRing === 'string' && claveOKeyRing.length === 64) {
      return descifrarConClave(ivHex, authTagHex, cipherHex, claveOKeyRing);
    }

    // 2. Caso Keyring estructurado { keys: Record<string,string> } o Record<string,string>
    const keyring = (claveOKeyRing && typeof claveOKeyRing.keys === 'object' && claveOKeyRing.keys !== null)
      ? claveOKeyRing.keys
      : (typeof claveOKeyRing === 'object' && claveOKeyRing !== null ? claveOKeyRing : null);

    if (!keyring) return null;

    // Intento prioritario según KID solicitado
    const clavePrimaria = (targetKid && keyring[targetKid]) || keyring.default || keyring.v1 || null;
    if (clavePrimaria) {
      const res = descifrarConClave(ivHex, authTagHex, cipherHex, clavePrimaria);
      if (res) return res;
    }

    // Fallback defensivo: probar cualquier otra clave disponible en el keyring
    for (const [kId, kHex] of Object.entries(keyring)) {
      if (kHex !== clavePrimaria && typeof kHex === 'string' && kHex.length === 64) {
        const fallbackRes = descifrarConClave(ivHex, authTagHex, cipherHex, kHex);
        if (fallbackRes) return fallbackRes;
      }
    }

    // Fallback de último recurso: clave canónica oficial
    if (CANONICAL_LEADS_KEY && CANONICAL_LEADS_KEY !== clavePrimaria) {
      const canonicalRes = descifrarConClave(ivHex, authTagHex, cipherHex, CANONICAL_LEADS_KEY);
      if (canonicalRes) return canonicalRes;
    }

    return null;
  } catch (err) {
    console.warn('[crypto] Fallo al descifrar lead:', err.message);
    return null;
  }
}

/**
 * Convierte un objeto o string a Base64URL según RFC 7515.
 * @param {string|object} data
 * @returns {string}
 */
function base64UrlEncode(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Decodifica Base64URL a string UTF-8.
 * @param {string} str
 * @returns {string}
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Genera un token JWT firmado criptográficamente con HMAC-SHA256.
 * @param {object} payload - Datos de sesión del usuario
 * @param {string} secret - Secreto de firma
 * @param {number} expiresInDays - Días de validez
 * @returns {string} JWT Token
 */
function signJwt(payload, secret, expiresInDays = 30) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (expiresInDays * 86400);

  const fullPayload = { ...payload, iat: now, exp };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(fullPayload);
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signatureInput}.${signature}`;
}

/**
 * Valida un token JWT firmado y verifica su firma con tiempo constante (timingSafeEqual).
 * @param {string} token
 * @param {string} secret
 * @returns {object|null} Payload si es válido, null si expiró o fue alterado
 */
function verifyJwt(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const [encodedHeader, encodedPayload, receivedSig] = partes;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Comparación en tiempo constante para prevenir ataques de temporización
  const bufReceived = Buffer.from(receivedSig);
  const bufExpected = Buffer.from(expectedSig);

  if (bufReceived.length !== bufExpected.length) return null;
  if (!crypto.timingSafeEqual(bufReceived, bufExpected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Token expirado
    }
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Genera un PIN aleatorio criptográficamente seguro (ej. "HNT-7492").
 * Blindaje Zero-Trust: NUNCA se deriva del número de celular.
 * @returns {string}
 */
function generatePin() {
  const digitos = crypto.randomInt(1000, 9999);
  return `HNT-${digitos}`;
}

/**
 * Sanitiza y normaliza un número de celular colombiano.
 * @param {string} celular
 * @returns {string} Celular a 10 dígitos (ej. "3001234567")
 */
function normalizePhone(celular) {
  if (!celular) return '';
  const soloNum = String(celular).replace(/\D/g, '');
  if (soloNum.startsWith('57') && soloNum.length === 12) {
    return soloNum.substring(2);
  }
  return soloNum;
}

module.exports = {
  encryptLeadContact,
  decryptLeadContact,
  signJwt,
  verifyJwt,
  generatePin,
  normalizePhone,
  obtenerKeyRingLeads,
  CURRENT_KID
};
