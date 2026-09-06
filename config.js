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
    publicKey: "pub_test_PQAm6bjXtS4ScbCpBU058xY0v1TPFXfA", // Llave Sandbox oficial del comercio Wompi
    entorno: "sandbox" // "sandbox" o "produccion"
  },

  // Canales de contacto y soporte comercial
  contacto: {
    whatsapp: "573001234567",
    mensajeWhatsapp: "Hola, deseo activar mi suscripción a la Terminal VIP de Origgo."
  }
};

// Exportación compatible tanto con navegador (window) como con Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = PORTAL_CONFIG;
} else {
  window.PORTAL_CONFIG = PORTAL_CONFIG;
}