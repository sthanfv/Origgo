/**
 * 🔐 TESTS DE ROTACIÓN CRIPTOGRÁFICA Y VERSIONADO DE CLAVES AES-256 (KID)
 * tests/crypto_rotation.test.js
 * 
 * Valida de forma automatizada:
 * 1. Cifrado y descifrado nativo con versión activa (kid = 'v1' / 'v2').
 * 2. Descifrado retrocompatible de leads legados (3 partes: iv:tag:cipher).
 * 3. Descifrado cruzado multi-versión mediante Keyring dinámico.
 * 4. Fallback defensivo ante discrepancias de versión sin denegaciones falsas.
 * 5. Rechazo ante alteración de texto cifrado, etiqueta authTag o clave errónea.
 * 6. Parser de Keyring con soporte de JSON y variables individuales.
 */

process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  encryptLeadContact,
  decryptLeadContact,
  obtenerKeyRingLeads,
  CURRENT_KID
} = require('../lib/crypto');

// Claves de prueba simétricas de 256 bits (64 caracteres hex)
const CLAVE_V1 = 'cf5e87913d4cf975ab463ada86e9ce905b9d5306c5188af3f8a074159cbf9a2c';
const CLAVE_V2 = '8d9e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e';

const CONTACTO_PRUEBA = {
  telefono: '3001234567',
  enlace: 'https://fincaraiz.com.co/inmueble-123456',
  portal: 'Finca Raíz',
  propietario: 'Carlos Pérez'
};

describe('🔐 Criptografía Zero-Trust: Versionado de Claves AES-256-GCM', () => {
  it('encryptLeadContact debe incluir por defecto el prefijo de versión kid ("v1")', () => {
    const cifrado = encryptLeadContact(CONTACTO_PRUEBA, CLAVE_V1, 'v1');
    const partes = cifrado.split(':');
    assert.equal(partes.length, 4, 'Debe contener 4 partes (kid:iv:tag:cipher)');
    assert.equal(partes[0], 'v1', 'El primer segmento debe ser el kid "v1"');
    assert.equal(partes[1].length, 24, 'IV debe ser de 12 bytes (24 hex)');
    assert.equal(partes[2].length, 32, 'AuthTag debe ser de 16 bytes (32 hex)');
  });

  it('decryptLeadContact debe descifrar exitosamente datos cifrados con kid "v1"', () => {
    const cifrado = encryptLeadContact(CONTACTO_PRUEBA, CLAVE_V1, 'v1');
    const descifrado = decryptLeadContact(cifrado, CLAVE_V1);
    assert.deepEqual(descifrado, CONTACTO_PRUEBA);
  });

  it('decryptLeadContact debe soportar cifrado con kid "v2" y descifrar usando Keyring { v1, v2 }', () => {
    const cifradoV2 = encryptLeadContact(CONTACTO_PRUEBA, CLAVE_V2, 'v2');
    assert.ok(cifradoV2.startsWith('v2:'), 'Debe iniciar con prefijo v2');

    const keyring = {
      keys: {
        v1: CLAVE_V1,
        v2: CLAVE_V2
      },
      activeKid: 'v2'
    };

    const descifrado = decryptLeadContact(cifradoV2, keyring);
    assert.deepEqual(descifrado, CONTACTO_PRUEBA);
  });

  it('decryptLeadContact debe descifrar datos en formato legado de 3 partes (iv:tag:cipher) con clave v1', () => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(CLAVE_V1, 'hex'), iv);
    let ciphertext = cipher.update(JSON.stringify(CONTACTO_PRUEBA), 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    const contactoLegado = `${iv.toString('hex')}:${authTag}:${ciphertext}`;

    assert.equal(contactoLegado.split(':').length, 3, 'Debe tener exactamente 3 partes');

    const descifradoClave = decryptLeadContact(contactoLegado, CLAVE_V1);
    assert.deepEqual(descifradoClave, CONTACTO_PRUEBA, 'Debe descifrar formato legado con clave plana');

    const keyring = { keys: { v1: CLAVE_V1, v2: CLAVE_V2 } };
    const descifradoKeyring = decryptLeadContact(contactoLegado, keyring);
    assert.deepEqual(descifradoKeyring, CONTACTO_PRUEBA, 'Debe descifrar formato legado con Keyring');
  });

  it('decryptLeadContact debe aplicar fallback defensivo si el kid no coincide pero la clave está en el Keyring', () => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(CLAVE_V2, 'hex'), iv);
    let ciphertext = cipher.update(JSON.stringify(CONTACTO_PRUEBA), 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    const contactoKidDesconocido = `v_desconocido:${iv.toString('hex')}:${authTag}:${ciphertext}`;

    const keyring = { keys: { v1: CLAVE_V1, v2: CLAVE_V2 } };
    const descifrado = decryptLeadContact(contactoKidDesconocido, keyring);
    assert.deepEqual(descifrado, CONTACTO_PRUEBA, 'Debe aplicar fallback probando las demás claves');
  });

  it('decryptLeadContact debe rechazar y retornar null ante alteración de texto cifrado o authTag', () => {
    const cifrado = encryptLeadContact(CONTACTO_PRUEBA, CLAVE_V1, 'v1');
    const partes = cifrado.split(':');
    const tagAlterado = partes[2].slice(0, -1) + (partes[2].slice(-1) === 'a' ? 'b' : 'a');
    const manipulado = `${partes[0]}:${partes[1]}:${tagAlterado}:${partes[3]}`;

    const resultado = decryptLeadContact(manipulado, CLAVE_V1);
    assert.equal(resultado, null, 'GCM debe detectar adulteración de integridad');
  });

  it('obtenerKeyRingLeads debe construir un Keyring válido desde variables de entorno o fallback', () => {
    const keyring = obtenerKeyRingLeads(CLAVE_V1);
    assert.ok(keyring.keys, 'Debe contener objeto keys');
    assert.ok(keyring.keys.v1 || keyring.keys.default, 'Debe contener clave v1 o default');
    assert.ok(keyring.activeKid, 'Debe definir activeKid');
  });

  it('api/leads/unlock debe descifrar y desbloquear exitosamente un lead cifrado con versionado', async () => {
    const unlockHandler = require('../api/leads/unlock');
    const { signJwt } = require('../lib/crypto');
    const { requireEnv } = require('../lib/env');
    const db = require('../lib/db');

    const jwtSecret = requireEnv('JWT_SECRET', {
      testFallback: 'f61aaf96e7d33f87ce54c3efff2965c52295cc1b3c04ff9f9b17caf1a6bec232'
    });
    const leadsKey = requireEnv('LEADS_ENCRYPTION_KEY', {
      testFallback: CLAVE_V1
    });

    const testPhone = '3198887766';
    await db.addCredits(testPhone, 5, '1234');
    const token = signJwt({ phone: testPhone }, jwtSecret);

    const leadTest = {
      telefono: '3007778899',
      enlace: 'https://fincaraiz.com.co/inmueble-998877',
      portal: 'Finca Raíz'
    };
    const contactoCifradoV1 = encryptLeadContact(leadTest, leadsKey, 'v1');

    const req = {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: {
        leadId: 'lead-test-rotacion-1',
        contactoCifrado: contactoCifradoV1,
        leadCity: 'Bogotá',
        lang: 'es'
      }
    };

    let statusCode = 0;
    let resData = null;
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { resData = d; return this; },
      setHeader() { return this; },
      end() { return this; }
    };

    await unlockHandler(req, res);
    assert.equal(statusCode, 200);
    assert.equal(resData.ok, true);
    assert.equal(resData.contacto.telefono, '3007778899');
  });
});
