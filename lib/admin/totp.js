/**
 * 🔢 Segundo factor del panel: TOTP (RFC 6238) y códigos de respaldo.
 *
 * Compatible con Google Authenticator, Microsoft Authenticator, Authy, etc.:
 * HMAC-SHA1, pasos de 30 s y 6 dígitos. Sin dependencias (solo `crypto` de Node).
 * Se acepta el paso anterior y el siguiente (±30 s) para tolerar desfases de reloj.
 */
const crypto = require('crypto');

const ALFABETO_B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PASO_S = 30;
const DIGITOS = 6;
const VENTANA = 1;

/** Decodifica Base32 (RFC 4648), ignorando espacios, guiones y relleno. */
function base32Decodificar(texto) {
  const limpio = String(texto).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let valor = 0;
  const salida = [];
  for (const c of limpio) {
    const i = ALFABETO_B32.indexOf(c);
    if (i < 0) throw new Error('secreto base32 inválido');
    valor = ((valor << 5) | i) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      salida.push((valor >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(salida);
}

/** Codifica bytes en Base32 (RFC 4648) sin relleno. */
function base32Codificar(buf) {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const b of buf) {
    valor = ((valor << 8) | b) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO_B32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO_B32[(valor << (5 - bits)) & 31];
  return salida;
}

/** HOTP (RFC 4226) para un contador dado. */
function hotp(secreto, contador, digitos = DIGITOS) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(contador));
  const hmac = crypto.createHmac('sha1', secreto).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0x0f;
  const binario =
    ((hmac[off] & 0x7f) << 24) | (hmac[off + 1] << 16) | (hmac[off + 2] << 8) | hmac[off + 3];
  return String(binario % 10 ** digitos).padStart(digitos, '0');
}

/** Paso de tiempo TOTP para un instante (ms). */
function pasoActual(ahoraMs = Date.now()) {
  return Math.floor(ahoraMs / 1000 / PASO_S);
}

/**
 * Verifica un código TOTP.
 * @param {string} secretoBase32 Secreto compartido (Base32).
 * @param {string} codigo Código de 6 dígitos escrito por el administrador.
 * @param {number} [ahoraMs] Instante de referencia (inyectable en pruebas).
 * @returns {number|null} El paso que coincidió (para impedir su reutilización) o null.
 */
function verificarTotp(secretoBase32, codigo, ahoraMs = Date.now()) {
  const limpio = String(codigo || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(limpio)) return null;
  const secreto = base32Decodificar(secretoBase32);
  const actual = pasoActual(ahoraMs);
  let coincidencia = null;
  // Se recorren todos los pasos de la ventana (sin salir antes) para no filtrar tiempos.
  for (let d = -VENTANA; d <= VENTANA; d++) {
    const esperado = hotp(secreto, actual + d);
    if (crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(limpio)) && coincidencia === null) {
      coincidencia = actual + d;
    }
  }
  return coincidencia;
}

/** Genera un secreto TOTP nuevo (160 bits, Base32). */
function generarSecreto() {
  return base32Codificar(crypto.randomBytes(20));
}

/** Normaliza un código de respaldo (mayúsculas, sin guiones ni espacios). */
function normalizarCodigoRespaldo(codigo) {
  return String(codigo || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Genera códigos de respaldo de un solo uso con formato XXXXX-XXXXX (40 bits cada uno). */
function generarCodigosRespaldo(cantidad = 8) {
  return Array.from({ length: cantidad }, () => {
    const h = crypto.randomBytes(5).toString('hex').toUpperCase();
    return `${h.slice(0, 5)}-${h.slice(5)}`;
  });
}

/** Huella SHA-256 de un código de respaldo (lo único que se guarda). */
function hashCodigoRespaldo(codigo) {
  return crypto.createHash('sha256').update(normalizarCodigoRespaldo(codigo)).digest('hex');
}

/** ¿Tiene forma de código de respaldo (10 caracteres hex)? */
function pareceCodigoRespaldo(codigo) {
  return /^[0-9A-F]{10}$/.test(normalizarCodigoRespaldo(codigo));
}

/** URI estándar para registrar el secreto en una app autenticadora (código QR). */
function uriOtpauth(secreto, cuenta, emisor = 'Origgo Admin') {
  const etiqueta = `${encodeURIComponent(emisor)}:${encodeURIComponent(cuenta)}`;
  const params = new URLSearchParams({
    secret: secreto,
    issuer: emisor,
    algorithm: 'SHA1',
    digits: String(DIGITOS),
    period: String(PASO_S),
  });
  return `otpauth://totp/${etiqueta}?${params.toString()}`;
}

module.exports = {
  base32Codificar,
  base32Decodificar,
  hotp,
  pasoActual,
  verificarTotp,
  generarSecreto,
  generarCodigosRespaldo,
  hashCodigoRespaldo,
  pareceCodigoRespaldo,
  uriOtpauth,
};
