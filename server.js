/**
 * Servidor HTTP local ultra liviano (0 dependencias) para previsualizar hunter-portal-showcase
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// Carga automática de variables desde .env si existe
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          process.env[key] = val;
        }
      }
    });

    // Mapeo automático de alias en memoria para Firebase SDK sin duplicar en .env
    if (process.env.FIREBASE_API_KEY) process.env.apiKey = process.env.FIREBASE_API_KEY;
    if (process.env.FIREBASE_AUTH_DOMAIN) process.env.authDomain = process.env.FIREBASE_AUTH_DOMAIN;
    if (process.env.FIREBASE_PROJECT_ID) process.env.projectId = process.env.FIREBASE_PROJECT_ID;
    if (process.env.FIREBASE_STORAGE_BUCKET) process.env.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
    if (process.env.FIREBASE_MESSAGING_SENDER_ID) process.env.messagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID;
    if (process.env.FIREBASE_APP_ID) process.env.appId = process.env.FIREBASE_APP_ID;
  } catch (e) {
    console.warn('[server] Error leyendo .env:', e.message);
  }
}

const PORT = 3000;
const HOST = '0.0.0.0';
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer(async (req, res) => {
  const [rutaPath, queryString] = req.url.split('?');
  let rutaRelativa = rutaPath;

  // Manejador de rutas serverless /api/*
  if (rutaRelativa.startsWith('/api/')) {
    let apiFilePath = path.join(__dirname, rutaRelativa);
    if (!apiFilePath.endsWith('.js')) {
      apiFilePath += '.js';
    }

    if (fs.existsSync(apiFilePath) && fs.statSync(apiFilePath).isFile()) {
      // Decorar response con métodos express-like
      res.status = function(code) {
        res.statusCode = code;
        return res;
      };
      res.json = function(data) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
        return res;
      };

      // Decorar request con query params
      req.query = {};
      if (queryString) {
        const params = new URLSearchParams(queryString);
        for (const [key, value] of params.entries()) {
          req.query[key] = value;
        }
      }

      // Parsear body en POST / PUT / PATCH
      let bodyData = '';
      req.on('data', chunk => {
        bodyData += chunk;
      });

      req.on('end', async () => {
        try {
          if (bodyData && req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
            req.body = JSON.parse(bodyData);
          } else if (bodyData) {
            req.body = bodyData;
          } else {
            req.body = {};
          }

          // Invocación del endpoint con telemetría de diagnóstico
          console.log(`📡 [API Request] ${req.method} ${rutaRelativa}`, {
            query: req.query,
            body: typeof req.body === 'object' ? Object.keys(req.body) : req.body
          });
          delete require.cache[require.resolve(apiFilePath)];
          const handler = require(apiFilePath);
          if (typeof handler === 'function') {
            await handler(req, res);
          } else if (handler && typeof handler.default === 'function') {
            await handler.default(req, res);
          } else {
            res.status(500).json({ error: 'Handler inválido en endpoint' });
          }
        } catch (err) {
          console.error(`[API Error] ${rutaRelativa}:`, err);
          if (!res.writableEnded) {
            res.status(500).json({ error: err.message || 'Error interno del servidor' });
          }
        }
      });
      return;
    }
  }

  if (rutaRelativa === '/' || rutaRelativa === '') rutaRelativa = '/index.html';
  
  // Blindaje DevSecOps: Sanitización estricta contra Path Traversal
  const rutaArchivo = path.normalize(path.join(__dirname, rutaRelativa));
  if (!rutaArchivo.startsWith(__dirname)) {
    res.writeHead(403, { 
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.end('403 Acceso Denegado: Ruta fuera de los límites del servidor.');
  }
  
  fs.stat(rutaArchivo, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.end('404 No encontrado');
    }
    
    const ext = path.extname(rutaArchivo).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    // Cabeceras de seguridad DevSecOps
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    });
    
    fs.createReadStream(rutaArchivo).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Portal Showcase activo en: http://localhost:${PORT}`);
});
