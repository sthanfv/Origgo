/**
 * Suite de endurecimiento de superficie HTTP local.
 * Verifica que el servidor de preview no publique fuentes ni secretos.
 */

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = String(3180 + Math.floor(Math.random() * 400));
const BASE_URL = `http://127.0.0.1:${PORT}`;

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function esperarServidor() {
  let ultimoError = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/index.html`);
      if (res.ok) return;
    } catch (err) {
      ultimoError = err;
    }
    await esperar(200);
  }
  throw ultimoError || new Error('Servidor local no respondió a tiempo');
}

async function run() {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  server.stdout.on('data', chunk => { stdout += chunk.toString(); });
  server.stderr.on('data', chunk => { stderr += chunk.toString(); });

  try {
    await esperarServidor();

    const rutasBloqueadas = [
      '/.env',
      '/service-account.json',
      '/modules/01-state.js',
      '/lib/db.js',
      '/scripts/validate.js',
      '/node_modules/zod/package.json',
      '/package.json',
      '/vercel.json',
      '/app.js.map',
      '/data/local_db.json'
    ];

    for (const ruta of rutasBloqueadas) {
      const res = await fetch(`${BASE_URL}${ruta}`);
      assert.strictEqual(res.status, 404, `${ruta} debe responder 404`);
    }

    const resIndex = await fetch(`${BASE_URL}/index.html`);
    assert.strictEqual(resIndex.status, 200, 'index.html debe ser público');
    assert.notStrictEqual(resIndex.headers.get('access-control-allow-origin'), '*', 'No debe existir CORS abierto para estáticos');

    const resData = await fetch(`${BASE_URL}/data/inmobiliario.json`);
    assert.strictEqual(resData.status, 200, 'Dataset público inmobiliario debe servirse correctamente');

    console.log('✅ Endurecimiento HTTP local verificado: secretos bloqueados y assets públicos disponibles.');
  } catch (err) {
    console.error(stdout);
    console.error(stderr);
    throw err;
  } finally {
    server.kill();
  }
}

run().catch(err => {
  console.error('❌ Fallo en test de hardening HTTP:', err);
  process.exit(1);
});
