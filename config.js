/**
 * ⚙️ Configuración del Portal Público Showcase
 * Ecosistema Ofertas Hunter Pro — Interfaz de Alta Gama
 */

const PORTAL_CONFIG = {
  nombrePlataforma: "Origgo",
  tagline: "Terminal de Oportunidades Directas y Arbitraje",
  moneda: "COP",
  precioMembresiaCop: 89000,
  precioMembresiaFormateado: "$ 89.000 / mes",
  
  // Llave Pública Wompi (Modo Sandbox para pruebas seguras con Nequi, PSE y Tarjetas)
  wompi: {
    publicKey: "pub_test_PQAm6bJXtS4ScbCpBU058xY0vlTPFXfA", // Llave Sandbox oficial del comercio Wompi
    entorno: "sandbox" // "sandbox" o "produccion"
  },

  // Canales de contacto y soporte comercial
  contacto: {
    whatsapp: "573001234567",
    mensajeWhatsapp: "Hola, deseo activar mi suscripción a la Terminal VIP de Origgo."
  },

  // Catálogo en Vivo en Cloudflare R2 (Object Storage S3 en Tiempo Real sin Egress Fee)
  catalogoR2Url: "https://pub-040118b18ae247d7b4643d22289744b6.r2.dev/inmobiliario.json"
};

// Exportación compatible tanto con navegador (window) como con Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = PORTAL_CONFIG;
} else {
  window.PORTAL_CONFIG = PORTAL_CONFIG;
}