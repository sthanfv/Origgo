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

// Lista negra de dominios de correos temporales / desechables conocidos
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'yopmail.com', 'yopmail.fr', 'yopmail.net', 'mailinator.com', 'sharklasers.com',
  'dispostable.com', 'throwawaymail.com', 'getairmail.com', 'mohmal.com', 'fakeinbox.com',
  'trashmail.com', 'trashmail.net', 'trashmail.me', 'inboxbear.com', 'crazymailing.com',
  'burnermail.io', 'tempr.email', 'generator.email', 'emailondeck.com', 'mytemp.email',
  'tempail.com', 'temp-mail.org', 'temp-mail.io', 'mailpoof.com', 'dropmail.me',
  'nada.ltd', 'fakemailgenerator.com', 'fakemail.net', 'getnada.com', 'disposablemail.com'
]);

/**
 * Verifica si una dirección de correo pertenece a un proveedor temporal o desechable.
 * 
 * @param {string} email
 * @returns {boolean}
 */
function esCorreoDesechable(email) {
  if (!email || typeof email !== 'string') return false;
  const partes = email.trim().toLowerCase().split('@');
  if (partes.length !== 2) return false;
  const dominio = partes[1];
  return DISPOSABLE_EMAIL_DOMAINS.has(dominio);
}

/**
 * Canoniza y normaliza una dirección de correo electrónico eliminando puntos y alias (+).
 * Evita que un atacante use variaciones del mismo buzón (Ataque Sybil) en Gmail, Outlook o Yahoo.
 * 
 * @param {string} email
 * @returns {string}
 */
function normalizarEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const limpio = email.trim().toLowerCase();
  const partes = limpio.split('@');
  if (partes.length !== 2) return limpio;

  let [usuario, dominio] = partes;

  // Gmail y Googlemail: ignoran puntos y todo lo que esté después de '+'
  if (dominio === 'gmail.com' || dominio === 'googlemail.com') {
    dominio = 'gmail.com';
    usuario = usuario.split('+')[0].replace(/\./g, '');
    return `${usuario}@${dominio}`;
  }

  // Outlook, Hotmail, Live, Yahoo e iCloud: ignoran alias después de '+'
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'icloud.com'].includes(dominio)) {
    usuario = usuario.split('+')[0];
    return `${usuario}@${dominio}`;
  }

  return `${usuario}@${dominio}`;
}

// Esquema estricto para dirección de correo electrónico (anti-inyección XSS, caracteres maliciosos y anti-desechables)
const emailSchema = z.string({
  required_error: 'El correo electrónico es obligatorio.',
  invalid_type_error: 'El correo electrónico debe ser una cadena de texto.'
})
  .trim()
  .toLowerCase()
  .refine(val => !/[<>\/\\'";`*{}()\[\]|^~]/.test(val), {
    message: 'El correo electrónico contiene caracteres no permitidos o sospechosos de inyección.'
  })
  .email('Ingresa una dirección de correo electrónico válida (ej: usuario@dominio.com).')
  .max(120, 'La dirección de correo no puede superar los 120 caracteres.')
  .refine(val => !esCorreoDesechable(val), {
    message: 'No se permiten correos temporales o desechables. Ingresa un correo personal o corporativo válido.'
  });

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
  email: emailSchema,
  lang: z.enum(['es', 'en']).optional().default('es')
}, {
  required_error: 'El cuerpo de la solicitud no puede estar vacío.'
});

// Esquema para inicio de sesión con WhatsApp y PIN
const sessionLoginSchema = z.object({
  celular: phoneSchema,
  pin: pinSchema,
  lang: z.enum(['es', 'en']).optional().default('es'),
  turnstileToken: z.string().trim().min(1).max(2048).optional(),
  securityChallenge: z.object({
    salt: z.string().min(8).max(64),
    timestamp: z.number(),
    expira: z.number(),
    dificultad: z.number(),
    signature: z.string().min(32).max(128),
    nonce: z.union([z.number(), z.string().regex(/^\d+$/)])
  }).optional(),
  bypassChallenge: z.boolean().optional()
});

// Esquema para creación de orden de pago en Wompi
const createOrderSchema = z.object({
  productType: z.enum(['single_lead', 'pack_10_leads', 'subscription_city', 'subscription_national'], {
    errorMap: () => ({ message: 'El producto seleccionado no existe en el catálogo oficial.' })
  }),
  celular: phoneSchema,
  ciudad: z.string().trim().max(50, 'El nombre de la ciudad no puede superar los 50 caracteres.').optional().nullable(),
  lang: z.enum(['es', 'en']).optional().default('es')
}).refine(data => {
  if (data.productType === 'subscription_city') {
    return Boolean(data.ciudad && data.ciudad.trim().length > 0);
  }
  return true;
}, {
  message: 'Debe seleccionar una ciudad para activar el Plan Pro Ciudad.',
  path: ['ciudad']
});

// Esquema para suscripción a Web Push
const subscribePushSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url('El endpoint debe ser una URL válida.').startsWith('https://', 'El endpoint debe ser HTTPS.'),
    keys: z.object({
      p256dh: z.string().min(1, 'Clave p256dh requerida.'),
      auth: z.string().min(1, 'Clave auth requerida.')
    })
  }),
  ciudad: z.string().trim().max(50).optional().nullable(),
  lang: z.enum(['es', 'en']).optional().default('es')
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
  leadCity: z.string().trim().max(60).optional().nullable(),
  lang: z.enum(['es', 'en']).optional().default('es')
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

// Esquema para solicitud de 1 crédito gratis de bienvenida (Freemium tolerante a celular/phone con Device Fingerprint)
const welcomeCreditSchema = z.object({
  celular: phoneSchema.optional(),
  phone: phoneSchema.optional(),
  email: emailSchema,
  deviceId: z.string().trim().min(16, 'Identificador de dispositivo inválido.').max(128).optional(),
  lang: z.enum(['es', 'en']).optional().default('es')
}, {
  required_error: 'El cuerpo de la solicitud no puede estar vacío.'
}).refine(data => Boolean(data.celular || data.phone), {
  message: 'El número de celular es obligatorio.',
  path: ['celular']
}).transform(data => ({
  celular: data.celular || data.phone,
  email: data.email,
  deviceId: data.deviceId || null,
  lang: data.lang || 'es'
}));

// Esquema para verificación y activación de regalo de bienvenida (Doble Opt-In por correo)
const welcomeVerifySchema = z.object({
  token: z.string({
    required_error: 'El token de activación de bienvenida es obligatorio.'
  }).trim().min(16, 'Token de activación inválido o corrupto.').max(256),
  lang: z.enum(['es', 'en']).optional().default('es')
}, {
  required_error: 'El cuerpo de la solicitud no puede estar vacío.'
});

// Esquema para solicitud de envío de Magic Link por correo
const magicLinkRequestSchema = z.object({
  identifier: z.string({
    required_error: 'Debes ingresar tu correo o número de WhatsApp.'
  }).trim().min(3, 'El identificador debe tener al menos 3 caracteres.').max(120),
  lang: z.enum(['es', 'en']).optional().default('es')
}, {
  required_error: 'El cuerpo de la solicitud no puede estar vacío.'
});

// Esquema para inicio de sesión mediante Magic Token
const magicLoginSchema = z.object({
  token: z.string({
    required_error: 'El token de acceso rápido es obligatorio.'
  }).trim().min(16, 'Token inválido o corrupto.').max(256),
  lang: z.enum(['es', 'en']).optional().default('es')
}, {
  required_error: 'El cuerpo de la solicitud no puede estar vacío.'
});

module.exports = {
  phoneSchema,
  emailSchema,
  pinSchema,
  recoverPinSchema,
  sessionLoginSchema,
  createOrderSchema,
  unlockLeadSchema,
  subscribePushSchema,
  welcomeCreditSchema,
  welcomeVerifySchema,
  magicLinkRequestSchema,
  magicLoginSchema,
  validateBody,
  normalizarEmail,
  esCorreoDesechable
};

