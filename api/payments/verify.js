const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Falta ID de transacción' });

  try {
    const isProd = process.env.NODE_ENV === 'production' && !process.env.WOMPI_PUBLIC_KEY?.includes('test');
    const host = isProd ? 'production.wompi.co' : 'sandbox.wompi.co';
    
    const data = await new Promise((resolve, reject) => {
      https.get(https:// + host + /v1/transactions/ + id, (response) => {
        let body = '';
        response.on('data', (chunk) => body += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });

    if (data && data.data && data.data.reference) {
      return res.status(200).json({ ok: true, reference: data.data.reference, status: data.data.status });
    } else {
      return res.status(404).json({ error: 'Transacción no encontrada en Wompi' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Error al consultar Wompi' });
  }
};
