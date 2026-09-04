/**
 * 🔐 MÓDULO CRIPTOGRÁFICO Y GESTIÓN DE SESIONES JWT (ZERO-DEPENDENCY)
 * Hunter Pro Intelligence — Arquitectura DevSecOps Estándar Desmulta
 * 
 * Implementa cifrado simétrico AES-256-GCM, tokens JWT firmados con HMAC-SHA256,
 * comparación en tiempo constante (timingSafeEqual) y generación de PIN de respaldo.
 */

const crypto = require('crypto');

/**
 * Cifra datos confidenciales de contacto con AES-256-GCM.
 * @param {object} datos - { telefono, enlace, portal }
 * @param {string} claveHex - Llave simétrica de 256 bits (64 hex)
 * @returns {string} Cadena en formato "iv:authTag:ciphertext"
 */
function encryptLeadContact(datos, claveHex) {
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

  return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * Descifra la información de contacto de un lead utilizando AES-256-GCM.
 * @param {string} contactoCifrado - "iv:authTag:ciphertext"
 * @param {string} claveHex - Llave simétrica de 256 bits
 * @returns {object|null} Objeto { telefono, enlace, portal } o null si falla
 */
function decryptLeadContact(contactoCifrado, claveHex) {
  if (!contactoCifrado || typeof contactoCifrado !== 'string') return null;
  if (!claveHex || claveHex.length !== 64) {
    console.error('[crypto] Error: LEADS_ENCRYPTION_KEY ausente o de longitud incorrecta');
    return null;
  }

  try {
    const partes = contactoCifrado.split(':');
    if (partes.length !== 3) return null;

    const [ivHex, authTagHex, cipherHex] = partes;
    const key = Buffer.from(claveHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
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
 * Genera un PIN legible y seguro para el usuario (ej. "HNT-7492").
 * @returns {string}
 */
function generatePin() {
  const digitos = Math.floor(1000 + Math.random() * 9000);
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
  normalizePhone
};
