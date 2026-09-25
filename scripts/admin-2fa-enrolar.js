#!/usr/bin/env node
/**
 * 🔢 Enrolamiento del segundo factor (TOTP) del panel de administración.
 *
 * Genera un secreto TOTP nuevo y 8 códigos de respaldo de un solo uso:
 *   - Guarda ADMIN_TOTP_SECRET y ADMIN_BACKUP_CODES (solo huellas SHA-256) en el .env.
 *   - Crea ADMIN_2FA_ENROLAMIENTO.html (ignorado por Git) con el código QR para la app
 *     autenticadora y los códigos de respaldo en claro, para guardarlos.
 * No imprime ningún secreto en la terminal.
 *
 * Uso:
 *   node scripts/admin-2fa-enrolar.js            → primera vez
 *   node scripts/admin-2fa-enrolar.js --forzar   → reemplaza un secreto existente (el anterior deja de servir)
 *
 * Después: escanear el QR, guardar los códigos, BORRAR el .html y copiar las dos variables a Vercel.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const {
  generarSecreto,
  generarCodigosRespaldo,
  hashCodigoRespaldo,
  uriOtpauth,
} = require('../lib/admin/totp');

const RAIZ = path.join(__dirname, '..');
const RUTA_ENV = path.join(RAIZ, '.env');
const RUTA_HTML = path.join(RAIZ, 'ADMIN_2FA_ENROLAMIENTO.html');

function fijarVariable(contenido, clave, valor) {
  const linea = `${clave}=${valor}`;
  const patron = new RegExp(`^${clave}=.*$`, 'm');
  return patron.test(contenido) ? contenido.replace(patron, linea) : `${contenido.trimEnd()}\n${linea}\n`;
}

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function main() {
  const forzar = process.argv.includes('--forzar');
  if (process.env.ADMIN_TOTP_SECRET && !forzar) {
    throw new Error('Ya hay un ADMIN_TOTP_SECRET en el .env. Usa --forzar para reemplazarlo.');
  }
  const cuenta = (process.env.ADMIN_EMAILS || 'admin').split(',')[0].trim();

  const secreto = generarSecreto();
  const codigos = generarCodigosRespaldo(8);
  const huellas = codigos.map(hashCodigoRespaldo).join(',');
  const uri = uriOtpauth(secreto, cuenta);
  const qr = await QRCode.toDataURL(uri, { margin: 2, width: 280 });

  let env = fs.existsSync(RUTA_ENV) ? fs.readFileSync(RUTA_ENV, 'utf8') : '';
  if (!/^# Panel de administración: segundo factor/m.test(env)) {
    env = `${env.trimEnd()}\n\n# Panel de administración: segundo factor (TOTP) — generado con scripts/admin-2fa-enrolar.js\n`;
  }
  env = fijarVariable(env, 'ADMIN_TOTP_SECRET', secreto);
  env = fijarVariable(env, 'ADMIN_BACKUP_CODES', huellas);
  fs.writeFileSync(RUTA_ENV, env);

  const clave = secreto.replace(/(.{4})/g, '$1 ').trim();
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Enrolamiento 2FA — Origgo Admin</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:32px auto;padding:0 16px;color:#111}
code{background:#f1f1f1;padding:2px 6px;border-radius:6px}.alerta{background:#fff4e5;border:1px solid #f0a020;padding:12px;border-radius:10px}
ol li{margin-bottom:8px}.codigos{columns:2;font-family:monospace;font-size:1.1rem}</style></head><body>
<h1>Segundo factor del panel Origgo</h1>
<p class="alerta"><strong>Confidencial.</strong> Cualquiera con este archivo puede generar tus códigos. Bórralo en cuanto termines.</p>
<ol>
<li>Abre <strong>Google Authenticator</strong> (o Microsoft Authenticator / Authy) → <strong>+</strong> → <strong>Escanear código QR</strong>:</li>
</ol>
<p><img src="${qr}" alt="Código QR del segundo factor" width="280" height="280"></p>
<p>Si no puedes escanear, elige "Ingresar clave de configuración": cuenta <code>${escapar(cuenta)}</code>, clave <code>${escapar(clave)}</code>, tipo "Basada en el tiempo".</p>
<ol start="2">
<li>Guarda estos <strong>códigos de respaldo</strong> en un lugar seguro (papel o gestor de contraseñas). Cada uno sirve <strong>una sola vez</strong> si pierdes el celular:</li>
</ol>
<div class="codigos">${codigos.map((c) => `<div>${escapar(c)}</div>`).join('')}</div>
<ol start="3">
<li>Copia <code>ADMIN_TOTP_SECRET</code> y <code>ADMIN_BACKUP_CODES</code> de tu <code>.env</code> a Vercel → Settings → Environment Variables (Production) y haz Redeploy.</li>
<li><strong>Borra este archivo.</strong></li>
</ol></body></html>`;
  fs.writeFileSync(RUTA_HTML, html);

  console.log('✔ Segundo factor generado.');
  console.log('  1. Abre ADMIN_2FA_ENROLAMIENTO.html (en la carpeta del proyecto), escanea el QR y guarda los códigos de respaldo.');
  console.log('  2. Copia ADMIN_TOTP_SECRET y ADMIN_BACKUP_CODES del .env a Vercel y haz Redeploy.');
  console.log('  3. Borra ADMIN_2FA_ENROLAMIENTO.html.');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
