/**
 * 🛡️ MÓDULO DE VALIDACIÓN ESTRICTA CON ZOD — ORIGGO INTELLIGENCE
 * Estándar DevSecOps Ecosistema Desmulta (OWASP Top 10 - Prevención de Inyección y Validación de Entradas).
 * 
 * NOTA DEL DESARROLLADOR:
 * Este módulo centraliza todos los esquemas de validación de datos para los endpoints serverless.
 * Garantiza tipos estrictos, sanitización de caracteres, rechazo de formatos adulterados
 * y respuestas de error legibles en español con códigos de estado HTTP semánticos.
 */

const { z } = require('zod');

// Esquema estricto para número de teléfono celular en Colombia (10 dígitos exactos, formato móvil 3XXXXXXXXX)
const phoneSchema = z.string({
  required_error: 'El número de celular es obligatorio.',
  invalid_type_error: 'El número de celular debe ser una cadena de texto o números.'
})
  .trim()
  .transform(val => {
    const digits = val.replace(/\D/g, '');
    return digits.startsWith('57') && digits.length === 12 ? digits.substring(2) : digits;
  })
  .refine(val => val.length === 10, {
    message: 'El número de celular debe tener exactamente 10 dígitos.'
  })
  .refine(val => /^3\d{9}$/.test(val), {
    message: 'El número debe ser un celular móvil válido de Colombia (iniciando con 3).'
  });

// Esquema estricto para dirección de correo electrónico
const emailSchema = z.string({
  required_error: 'El correo electrónico es obligatorio.',
  invalid_type_error: 'El correo electrónico debe ser una cadena de texto.'
})
  .trim()
  .toLowerCase()
  .email('Ingresa una dirección de correo electrónico válida (ej: usuario@dominio.com).')
  .max(120, 'La dirección de correo no puede superar los 120 caracteres.');

// Esquema estricto para PIN de seguridad (4 a 6 dígitos o prefijo HNT opcional con o sin guion/espacio)
const pinSchema = z.string({
  required_error: 'El PIN de seguridad es obligatorio.',
  invalid_type_error: 'El PIN debe ser una cadena de texto o números.'
})
  .trim()
  .toUpperCase()
  .refine(val => /^(HNT)?[ -]?[0-9]{4,6}$/i.test(val), {
    message: 'El formato del PIN es inválido. Debe contener entre 4 y 6 dígitos (ej: 7489 o HNT-7489).'
  });

// Esquema para solicitud de recuperación de PIN por correo
const recoverPinSchema = z.object({
  email: emailSchema
}, {
  required_error: 'El cuerpo de la solicitud no puede estar vacío.'
});

// Esquema para inicio de sesión con WhatsApp y PIN
const sessionLoginSchema = z.object({
  celular: phoneSchema,
  pin: pinSchema
});

// Esquema para creación de orden de pago en Wompi
const createOrderSchema = z.object({
  productType: z.enum(['single_lead', 'pack_10_leads', 'subscription_city', 'subscription_national'], {
    errorMap: () => ({ message: 'El producto seleccionado no existe en el catálogo oficial.' })
  }),
  celular: phoneSchema,
  ciudad: z.string().trim().max(50, 'El nombre de la ciudad no puede superar los 50 caracteres.').optional().nullable()
}).refine(data => {
  if (data.productType === 'subscription_city') {
    return Boolean(data.ciudad && data.ciudad.trim().length > 0);
  }
  return true;
}, {
  message: 'Debe seleccionar una ciudad para activar el Plan Pro Ciudad.',
  path: ['ciudad']
});

// Esquema para desbloqueo de leads
const unlockLeadSchema = z.object({
  leadId: z.string({
    required_error: 'El identificador del lead (leadId) es obligatorio.'
  })
    .trim()
    .min(1, 'El identificador del lead no puede estar vacío.')
    .max(80, 'El identificador del lead es demasiado largo.'),
  contactoCifrado: z.any().optional(),
  leadCity: z.string().trim().max(60).optional().nullable()
});

/**
 * Función utilitaria para validar el cuerpo de una petición contra un esquema Zod.
 * Retorna { success: true, data } o { success: false, status: 400, error, message, issues }
 * 
 * @param {z.ZodSchema} schema 
 * @param {any} body 
 * @returns {{ success: true, data: any } | { success: false, status: number, error: string, message: string, issues: any[] }}
 */
function validateBody(schema, body) {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      status: 400,
      error: 'CUERPO_INVALIDO',
      message: 'El cuerpo de la solicitud debe ser un objeto JSON válido.',
      issues: []
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = (result.error && (result.error.issues || result.error.errors)) || [];
    const primerError = issues[0]?.message || 'Datos de entrada inválidos.';
    return {
      success: false,
      status: 400,
      error: 'VALIDACION_FALLIDA',
      message: primerError,
      issues: issues.map(err => ({
        campo: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
        mensaje: err.message
      }))
    };
  }

  return {
    success: true,
    data: result.data
  };
}

module.exports = {
  phoneSchema,
  emailSchema,
  pinSchema,
  recoverPinSchema,
  sessionLoginSchema,
  createOrderSchema,
  unlockLeadSchema,
  validateBody
};
