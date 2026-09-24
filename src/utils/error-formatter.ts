/**
 * 🛡️ FORMATEADOR Y HUMANIZADOR DE ERRORES — ORIGGO INTELLIGENCE
 * Transforma códigos internos de backend, estados HTTP y excepciones de red
 * en mensajes empáticos, comprensibles, seguros y 100% orientados al usuario final.
 * 
 * Regla: CERO exposición de códigos técnicos (EMAIL_YA_RECLAMADO, LIMITE_EXCEDIDO, etc.) en UI.
 */

interface ErrorDictEntry {
  es: string;
  en: string;
}

/**
 * Diccionario canónico de códigos técnicos de backend a mensajes amigables y presentables.
 */
const DICCIONARIO_ERRORES: Record<string, ErrorDictEntry> = {
  // Reclamos de cortesía freemium y barreras Anti-Sybil
  EMAIL_YA_RECLAMADO: {
    es: 'Este correo electrónico ya utilizó su crédito de cortesía gratuito. Si ya tienes una cuenta, puedes ingresar con tu PIN o seleccionar un plan.',
    en: 'This email address has already claimed its free welcome gift. If you already have an account, log in with your PIN or pick a plan.'
  },
  DISPOSITIVO_YA_RECLAMADO: {
    es: 'Este dispositivo ya utilizó su regalo de cortesía. Puedes restaurar tu cuenta existente con tu PIN o adquirir un paquete de contactos.',
    en: 'This device has already claimed a free welcome credit. You can restore your account with your PIN or choose a contact package.'
  },
  CREDITO_YA_RECLAMADO: {
    es: 'Este número de WhatsApp ya utilizó su crédito de bienvenida. Ingresa con tu PIN o recarga tu saldo cuando desees.',
    en: 'This WhatsApp number has already claimed its welcome credit. Log in with your PIN or top up your balance anytime.'
  },
  LIMITE_EXCEDIDO: {
    es: 'Has alcanzado el límite temporal de intentos permitidos desde tu red por ahora. Por tu seguridad, intenta de nuevo en unos minutos.',
    en: 'You have reached the temporary request limit from your network. For security, please try again in a few minutes.'
  },
  TOO_MANY_REQUESTS: {
    es: 'Demasiadas solicitudes en poco tiempo. Por favor espera un momento antes de volver a intentar.',
    en: 'Too many requests in a short time. Please wait a moment before trying again.'
  },
  IP_BLOCKED: {
    es: 'Acceso pausado temporalmente por políticas de seguridad de red. Por favor intenta en unos instantes.',
    en: 'Access temporarily restricted by network security policies. Please try again shortly.'
  },

  // Activación de Enlace Mágico y Tokens de Bienvenida
  TOKEN_EXPIRADO: {
    es: 'El enlace de activación ha caducado por seguridad. Solicita un nuevo enlace para activar tu cortesía.',
    en: 'The activation link has expired for security reasons. Please request a new link to activate your gift.'
  },
  TOKEN_INVALIDO: {
    es: 'El enlace de activación no es válido o ya fue utilizado. Puedes solicitar un nuevo acceso cuando desees.',
    en: 'The activation link is invalid or has already been used. You can request a new link anytime.'
  },
  TOKEN_YA_USADO: {
    es: 'Este enlace de activación ya fue utilizado. Tu cuenta se encuentra activa y puedes ingresar con tu PIN.',
    en: 'This activation link has already been used. Your account is active and you can log in with your PIN.'
  },
  ERROR_ENVIO_CORREO: {
    es: 'No pudimos entregar el correo de activación en este momento. Por favor verifica que tu dirección esté bien escrita o intenta de nuevo en unos minutos.',
    en: 'Could not deliver the activation email at this time. Please verify your email address or try again in a few minutes.'
  },

  // Autenticación por Celular y PIN / Referencias Wompi
  PIN_INCORRECTO: {
    es: 'El número de WhatsApp o el PIN ingresado no coinciden. Verifica los datos o solicita tu PIN por correo.',
    en: 'The WhatsApp number or PIN entered does not match. Please verify your details or recover your PIN by email.'
  },
  CREDENTIALS_INVALID: {
    es: 'Los datos de ingreso no son válidos. Verifica tu número de WhatsApp y tu PIN de 4 dígitos.',
    en: 'The login credentials are not valid. Please check your WhatsApp number and 4-digit PIN.'
  },
  USUARIO_NO_ENCONTRADO: {
    es: 'No encontramos una cuenta activa para este número. Puedes reclamar tu cortesía o adquirir un paquete.',
    en: 'We could not find an active account for this number. You can claim a welcome gift or select a package.'
  },
  CORREO_NO_REGISTRADO: {
    es: 'No encontramos ninguna cuenta asociada a este correo. Verifica que esté bien escrito o regístrate con tu celular.',
    en: 'No account found with this email. Please check the spelling or register with your mobile number.'
  },
  TRANSACCION_NO_ENCONTRADA: {
    es: 'No encontramos la transacción de pago indicada. Verifica la referencia o intenta nuevamente.',
    en: 'The specified payment transaction was not found. Please verify the reference and try again.'
  },
  TRANSACCION_NO_APROBADA: {
    es: 'La transacción no fue aprobada por la pasarela de pagos. Por favor intenta con otro medio de pago.',
    en: 'The payment transaction was not approved by the payment gateway. Please try with another payment method.'
  },
  REFERENCIA_YA_USADA: {
    es: 'Esta referencia de pago ya fue acreditada previamente en otra sesión.',
    en: 'This payment reference has already been credited to another session.'
  },

  // Validación de campos de identidad
  CELULAR_INVALIDO: {
    es: 'El número de celular no es válido. Debe tener 10 dígitos y comenzar por 3 (ej: 300 123 4567).',
    en: 'The mobile number is invalid. It must have 10 digits and start with 3 (e.g., 300 123 4567).'
  },
  CORREO_INVALIDO: {
    es: 'Ingresa un correo electrónico válido (ej: tu.correo@ejemplo.com).',
    en: 'Please enter a valid email address (e.g., user@example.com).'
  },
  EMAIL_INVALIDO: {
    es: 'Ingresa un correo electrónico válido (ej: tu.correo@ejemplo.com).',
    en: 'Please enter a valid email address (e.g., user@example.com).'
  },
  DOMINIO_DESECHABLE: {
    es: 'Por seguridad, no se admiten correos temporales ni desechables. Usa una dirección de correo activa.',
    en: 'For security reasons, temporary or disposable emails are not permitted. Please use an active email.'
  },

  // Desbloqueo de Inmuebles y Créditos
  SALDO_INSUFICIENTE: {
    es: 'No tienes créditos suficientes para desbloquear este contacto. Selecciona un plan o bolsa de contactos.',
    en: 'You do not have enough credits to unlock this contact. Select a plan or contact package.'
  },
  CREDITOS_INSUFICIENTES: {
    es: 'No tienes créditos suficientes en tu saldo. Puedes recargar créditos o activar un plan de cobertura.',
    en: 'Insufficient credits in your balance. You can top up credits or activate a coverage plan.'
  },
  PLAN_CIUDAD_DIFERENTE: {
    es: 'Tu membresía activa cubre una ciudad diferente a la de este inmueble. Adquiere créditos individuales o cobertura nacional.',
    en: 'Your active membership covers a different city. Purchase single credits or national coverage to unlock.'
  },
  CUOTA_DIARIA_EXCEDIDA: {
    es: 'Has alcanzado la cuota diaria de desbloqueos de tu membresía. Tu saldo diario se renovará a la medianoche.',
    en: 'You have reached your daily membership unlock limit. Your quota will renew at midnight.'
  },
  INMUEBLE_DESINDEXADO: {
    es: 'Esta publicación ya no se encuentra disponible o fue retirada directamente por su propietario.',
    en: 'This listing is no longer available or was removed directly by its owner.'
  },
  LEAD_NO_ENCONTRADO: {
    es: 'El inmueble seleccionado no está disponible en este momento.',
    en: 'The selected property is currently unavailable.'
  },
  CONTACTO_NO_DISPONIBLE: {
    es: 'Los datos directos de este inmueble se encuentran temporalmente en proceso de verificación.',
    en: 'Direct contact details for this property are currently under verification.'
  },
  CONTACTO_NO_DESCIFRABLE: {
    es: 'No fue posible descifrar los datos de contacto en este momento. Intenta de nuevo más tarde.',
    en: 'Could not decrypt contact information at this moment. Please try again later.'
  },

  // Servidor y Conectividad
  ERROR_INTERNO: {
    es: 'Ocurrió un inconveniente temporal en el servidor. Por favor intenta nuevamente en unos momentos.',
    en: 'A temporary server issue occurred. Please try again in a few moments.'
  },
  ERROR_INTERNO_CONCILIACION: {
    es: 'Ocurrió una pausa temporal conciliando tu pago. Por favor espera unos instantes mientras se confirma.',
    en: 'A temporary pause occurred reconciling your payment. Please wait a moment while it confirms.'
  },
  JSON_MALFORMADO: {
    es: 'La información enviada no tiene un formato válido. Revisa los datos ingresados.',
    en: 'The submitted information is not in a valid format. Please check your entered data.'
  },
  METODO_NO_PERMITIDO: {
    es: 'Operación no permitida en este recurso.',
    en: 'Operation not permitted on this resource.'
  },
  DATOS_INVALIDOS: {
    es: 'Por favor verifica la información ingresada e intenta nuevamente.',
    en: 'Please check the information entered and try again.'
  }
};

/**
 * Normaliza y humaniza cualquier error (objeto Error, string técnico, código HTTP o código de backend).
 * 
 * @param error - Instancia de Error, objeto con { error, message }, o string de error
 * @param isEn - Indica si el mensaje de salida debe presentarse en inglés
 * @returns Cadena de texto elegante, amigable y apta para lectura humana
 */
export function humanizarError(error: unknown, isEn: boolean = false): string {
  if (!error) {
    return isEn ? 'An unexpected error occurred. Please try again.' : 'Ocurrió un error inesperado. Por favor intenta de nuevo.';
  }

  // 1. Extraer el código crudo o mensaje
  let raw = '';
  if (typeof error === 'string') {
    raw = error.trim();
  } else if (typeof error === 'object' && error !== null) {
    const errObj = error as any;
    // Si viene con código explícito o status
    raw = errObj.code || errObj.error || errObj.message || String(error);
  }

  // 2. Limpiar prefijos habituales como "Error: " o "HTTP 409: "
  raw = raw.replace(/^Error:\s*/i, '').trim();
  raw = raw.replace(/^HTTP\s+\d{3}:\s*/i, '').trim();

  // 3. Comprobación directa en diccionario de códigos internos
  const codigoUpper = raw.toUpperCase().replace(/\s+/g, '_');
  if (DICCIONARIO_ERRORES[codigoUpper]) {
    return isEn ? DICCIONARIO_ERRORES[codigoUpper].en : DICCIONARIO_ERRORES[codigoUpper].es;
  }

  // 4. Búsqueda por subcadena de códigos conocidos (ej: "EMAIL_YA_RECLAMADO" dentro de mensaje)
  for (const [key, val] of Object.entries(DICCIONARIO_ERRORES)) {
    if (raw.includes(key)) {
      return isEn ? val.en : val.es;
    }
  }

  // 5. Tratamiento de fallos de red / conectividad
  const rawLower = raw.toLowerCase();
  if (
    rawLower.includes('failed to fetch') ||
    rawLower.includes('networkerror') ||
    rawLower.includes('load failed') ||
    rawLower.includes('abort') ||
    rawLower.includes('timeout') ||
    rawLower.includes('econnrefused')
  ) {
    return isEn
      ? 'Could not connect to the server. Please check your internet connection and try again.'
      : 'No pudimos conectar con los servidores. Verifica tu conexión a internet e inténtalo de nuevo.';
  }

  // 6. Tratamiento de errores 429 cuota / rate-limit
  if (rawLower.includes('429') || rawLower.includes('rate limit') || rawLower.includes('demasiadas peticiones')) {
    return isEn
      ? 'You have reached the temporary request limit. Please wait a few moments before trying again.'
      : 'Has alcanzado el límite temporal de solicitudes. Por favor espera unos momentos antes de reintentar.';
  }

  // 7. Si ya es una frase legible para humanos (contiene espacios y minúsculas), retornarla limpia
  const tieneEspacios = /\s/.test(raw);
  const tieneMinusculas = /[a-z]/.test(raw);
  const esSnakeCode = /^[A-Z0-9_]{3,}$/.test(raw);

  if (tieneEspacios && tieneMinusculas && !esSnakeCode) {
    return raw;
  }

  // 8. Fallback elegante y presentable si solo vino un identificador crudo desconocido
  return isEn
    ? 'Could not complete the operation at this time. Please check your details and try again.'
    : 'No fue posible completar la solicitud en este momento. Por favor verifica tus datos e intenta de nuevo.';
}
