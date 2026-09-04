/**
 * Servidor HTTP local ultra liviano (0 dependencias) para previsualizar hunter-portal-showcase
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
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

const server = http.createServer((req, res) => {
  let rutaRelativa = req.url.split('?')[0];
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
    
    // Cabeceras de seguridad DevSecOps y protección contra inyección
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    });
    
    fs.createReadStream(rutaArchivo).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Portal Showcase activo en: http://localhost:${PORT}`);
});
