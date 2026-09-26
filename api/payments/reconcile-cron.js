/**
 * ⚡ TAREA PROGRAMADA DE CONCILIACIÓN AUTOMÁTICA (VERCEL CRON FAIL-SAFE)
 * GET / POST /api/payments/reconcile-cron
 * 
 * Arquitectura DevSecOps Estándar Desmulta:
 * 1. Protección estricta con secreto Bearer (CRON_SECRET) comparado en tiempo constante.
 * 2. Consulta de órdenes en estado PENDING con ventana de seguridad (2 min a 24 horas).
 * 3. Verificación server-to-server oficial con la API de Wompi mediante llave privada.
 * 4. Acreditación atómica e idempotente en el ledger para transacciones aprobadas.
 * 5. Despacho transaccional de comprobante bilingüe y Magic Link por Resend.
 * 6. Actualización de órdenes fallidas (DECLINED/VOIDED) y expiración de órdenes huérfanas (>24h).
 */

const crypto = require('crypto');
const db = require('../../lib/db');
const { obtenerPrecios, productoPorCodigo, beneficio, combinar } = require('../../lib/precios');
const { requireEnv } = require('../../lib/env');
const { despacharCorreoConfirmacion } = require('../../lib/email-templates');

/**
 * Valida la cabecera Authorization: Bearer <CRON_SECRET> en tiempo constante.
 * 
 * @param {Object} req - Objeto de petición HTTP entrante
 * @returns {boolean} Verdadero si la autorización es válida
 */
function validarAutenticacionCron(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = (req.headers && req.headers.authorization) || '';
  const tokenRecibido = authHeader.replace(/^Bearer\s+/i, '').trim();

  // En entorno de pruebas automatizadas, permitir secreto de testing
  if (process.env.NODE_ENV === 'test') {
    if (!cronSecret && tokenRecibido === 'test_cron_secret_2026') {
      return true;
    }
  }

  if (!cronSecret || !tokenRecibido) {
    return false;
  }

  const bufRecibido = Buffer.from(tokenRecibido);
  const bufEsperado = Buffer.from(cronSecret);

  if (bufRecibido.length !== bufEsperado.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufRecibido, bufEsperado);
}

/**
 * Infiere créditos y configuración de plan según la orden o el código en la referencia.
 * 
 * @param {Object} order - Orden recuperada de la base de datos
 * @returns {{ creditos: number, planData: Object|null, expectedAmount: number }}
 */
/**
 * Beneficio (créditos o plan) y monto exigido de una orden. Usa lo guardado en la orden al
 * crearla; si falta, lo deduce del código de la referencia con los precios del panel.
 * @param {Object} order
 * @param {Object} [precios] Precios vigentes (lib/precios.js); por defecto, los valores base.
 */
function resolverBeneficioOrden(order, precios = combinar(null)) {
  let creditos = order?.creditos !== undefined ? Number(order.creditos) : 0;
  let planData = null;
  let expectedAmount = Number(order?.amountInCents || 0);
  const diasOrden = Number(order?.dias) || 30;

  if (order?.tipo === 'suscripcion_ciudad') {
    planData = { plan: 'city', city: order.ciudad || 'Colombia', days: diasOrden };
  } else if (order?.tipo === 'suscripcion_nacional') {
    planData = { plan: 'national', days: diasOrden };
  } else if (order?.reference && order.reference.startsWith('HNT-')) {
    const partes = order.reference.split('-');
    if (partes.length >= 3) {
      const code = partes[2];
      const producto = productoPorCodigo(precios, code);
      const entrega = beneficio(producto, code.includes('_') ? code.split('_')[1] : null);
      planData = entrega.planData;
      creditos = producto.tipo === 'credito' ? (order.creditos !== undefined ? Number(order.creditos) : entrega.creditos) : 0;
      if (!expectedAmount) expectedAmount = producto.montoCentavos;
    }
  }

  return { creditos, planData, expectedAmount };
}

module.exports = async function handler(req, res) {
  // Configurar cabeceras de respuesta estándar
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return res.status(200).end();
  }

  // Vercel Cron invoca endpoints con método GET por defecto
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'METODO_NO_PERMITIDO',
      mensaje: 'Solo se permiten peticiones GET o POST para la conciliación programada.'
    });
  }

  // 🛡️ 1. Autenticación de cron job mediante Bearer Token
  if (!validarAutenticacionCron(req)) {
    console.warn('[reconcile-cron] Intento de acceso no autorizado al endpoint de conciliación');
    return res.status(401).json({
      ok: false,
      error: 'NO_AUTORIZADO',
      mensaje: 'Credenciales de cron inválidas o ausentes.'
    });
  }

  const metricas = {
    totalRevisadas: 0,
    aprobadas: 0,
    rechazadas: 0,
    pendientes: 0,
    expiradas: 0,
    omitidasPorRecientes: 0,
    errores: 0
  };

  const detalles = [];

  try {
    // 2. Recuperar órdenes en estado PENDING (lote de hasta 25 para evitar timeout serverless)
    const ordenesPendientes = await db.getPendingOrders(25);
    const preciosVigentes = await obtenerPrecios();
    metricas.totalRevisadas = ordenesPendientes.length;

    if (ordenesPendientes.length === 0) {
      return res.status(200).json({
        ok: true,
        mensaje: 'No hay órdenes pendientes para conciliar.',
        metricas,
        detalles
      });
    }

    const ahora = Date.now();
    const DOS_MINUTOS_MS = 2 * 60 * 1000;
    const VEINTICUATRO_HORAS_MS = 24 * 60 * 60 * 1000;

    const isProd = (process.env.WOMPI_PUBLIC_KEY || '').startsWith('pub_prod_');
    const wompiApiBase = isProd ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
    const privateKey = requireEnv('WOMPI_PRIVATE_KEY', { testFallback: 'prv_test_local_suite' });

    // 3. Procesar cada orden en serie para garantizar control fino del ancho de banda y latencias
    for (const orden of ordenesPendientes) {
      const ref = orden.reference;
      if (!ref) continue;

      const fechaCreacionMs = orden.createdAt ? new Date(orden.createdAt).getTime() : ahora;
      const edadMs = ahora - fechaCreacionMs;

      // 🛡️ Ventana Anti-Carreras: Si tiene menos de 2 minutos, omitir para no colisionar con el webhook
      if (edadMs < DOS_MINUTOS_MS) {
        metricas.omitidasPorRecientes++;
        detalles.push({
          reference: ref,
          accion: 'OMITIDA_POR_RECIENTE',
          edadSegundos: Math.round(edadMs / 1000)
        });
        continue;
      }

      // Si tiene más de 24 horas y sigue pendiente, se marca como EXPIRADA
      if (edadMs > VEINTICUATRO_HORAS_MS) {
        await db.updateOrderStatus(ref, 'EXPIRED', {
          expiredAt: new Date().toISOString(),
          reconciledBy: 'cron_timeout'
        });
        metricas.expiradas++;
        detalles.push({
          reference: ref,
          accion: 'MARCADA_EXPIRADA',
          edadHoras: (edadMs / (3600 * 1000)).toFixed(1)
        });
        continue;
      }

      // 4. Consulta server-to-server a la API oficial de Wompi
      try {
        const wompiUrl = `${wompiApiBase}/transactions?reference=${encodeURIComponent(ref)}`;
        const wompiRes = await fetch(wompiUrl, {
          headers: { Authorization: `Bearer ${privateKey}` }
        });

        if (!wompiRes.ok) {
          console.warn(`[reconcile-cron] Error HTTP ${wompiRes.status} consultando Wompi para ref ${ref}`);
          metricas.errores++;
          detalles.push({ reference: ref, accion: 'ERROR_WOMPI_HTTP', status: wompiRes.status });
          continue;
        }

        const jsonRes = await wompiRes.json();
        const listaTransacciones = Array.isArray(jsonRes.data)
          ? jsonRes.data
          : (jsonRes.data ? [jsonRes.data] : []);

        if (listaTransacciones.length === 0) {
          metricas.pendientes++;
          detalles.push({ reference: ref, accion: 'SIN_TRANSACCION_REGISTRADA' });
          continue;
        }

        // Buscar si existe alguna transacción APROBADA
        const trxAprobada = listaTransacciones.find(t => t.status === 'APPROVED');

        if (trxAprobada) {
          const { creditos, planData, expectedAmount } = resolverBeneficioOrden(orden, preciosVigentes);
          const montoPagado = Number(trxAprobada.amount_in_cents || 0);

          // 🛡️ Blindaje Antifraude: Verificar que el monto pagado no sea inferior al exigido
          if (expectedAmount > 0 && montoPagado < expectedAmount) {
            console.error(`🚨 [reconcile-cron:fraude] Monto discrepante para ref ${ref}. Pagado: ${montoPagado}, Exigido: ${expectedAmount}`);
            await db.updateOrderStatus(ref, 'FRAUD_SUSPECT', {
              montoPagado,
              expectedAmount,
              transactionId: trxAprobada.id,
              reconciledBy: 'cron'
            });
            metricas.errores++;
            detalles.push({ reference: ref, accion: 'RECHAZADA_POR_MONTO_DISCREPANTE' });
            continue;
          }

          // Obtener o generar PIN criptográfico del usuario
          let celular = orden.celular;
          if (!celular && ref.startsWith('HNT-')) {
            const partes = ref.split('-');
            if (partes.length >= 2 && partes[1].length === 10 && /^\d+$/.test(partes[1])) {
              celular = partes[1];
            }
          }

          if (!celular) {
            console.warn(`[reconcile-cron] No se pudo determinar celular para ref ${ref}`);
            metricas.errores++;
            detalles.push({ reference: ref, accion: 'ERROR_CELULAR_FALTANTE' });
            continue;
          }

          const emailCliente = trxAprobada.customer_email
            ? trxAprobada.customer_email.toLowerCase().trim()
            : (orden.email ? orden.email.toLowerCase().trim() : null);

          // Acreditar UNA sola vez (misma llave que el webhook y el reclamo del usuario)
          const { usuario: usuarioActualizado } = await db.acreditarPagoUnaVez({
            reference: ref,
            transactionId: trxAprobada.id,
            celular,
            creditos,
            planData,
            email: emailCliente,
            origen: 'cron',
            datos: { amountInCents: montoPagado, paymentMethod: trxAprobada.payment_method_type || null }
          });
          const pin = usuarioActualizado.pin;

          // Sincronizar preferencia de idioma en el perfil si viene en la orden
          if (orden.lang && (orden.lang === 'es' || orden.lang === 'en')) {
            await db.updateUserPreferences(celular, { preferredLang: orden.lang });
          }

          // Actualizar estado de la orden a APPROVED
          await db.updateOrderStatus(ref, 'APPROVED', {
            transactionId: trxAprobada.id,
            paymentMethod: trxAprobada.payment_method_type,
            reconciledAt: new Date().toISOString(),
            reconciledBy: 'cron',
            email: emailCliente,
            celular
          });

          // Despachar confirmación por correo si no se había enviado antes
          if (emailCliente && !orden.emailSent) {
            const enviado = await despacharCorreoConfirmacion({
              phone: celular,
              email: emailCliente,
              reference: ref,
              productName: orden.productName,
              amountInCents: montoPagado,
              pin,
              credits: usuarioActualizado.credits,
              plan: usuarioActualizado.plan,
              planCity: usuarioActualizado.planCity,
              lang: orden.lang || 'es'
            });

            if (enviado) {
              await db.updateOrderStatus(ref, 'APPROVED', { emailSent: true });
            }
          }

          metricas.aprobadas++;
          detalles.push({
            reference: ref,
            accion: 'ACREDITADA_Y_APROBADA',
            transactionId: trxAprobada.id,
            celular
          });
          continue;
        }

        // Si no está aprobada, verificar si tiene estado definitivo fallido
        const trxFallida = listaTransacciones.find(t => ['DECLINED', 'VOIDED', 'ERROR'].includes(t.status));
        if (trxFallida) {
          await db.updateOrderStatus(ref, trxFallida.status, {
            transactionId: trxFallida.id,
            paymentMethod: trxFallida.payment_method_type,
            reconciledAt: new Date().toISOString(),
            reconciledBy: 'cron'
          });
          metricas.rechazadas++;
          detalles.push({
            reference: ref,
            accion: `ACTUALIZADA_${trxFallida.status}`,
            transactionId: trxFallida.id
          });
          continue;
        }

        // Si todas las transacciones siguen en PENDING en Wompi
        metricas.pendientes++;
        detalles.push({ reference: ref, accion: 'CONTINUA_PENDIENTE_EN_WOMPI' });

      } catch (errLoop) {
        console.error(`[reconcile-cron] Error procesando ref ${ref}:`, errLoop.message);
        metricas.errores++;
        detalles.push({ reference: ref, accion: 'ERROR_PROCESAMIENTO', error: errLoop.message });
      }
    }

    return res.status(200).json({
      ok: true,
      ejecutadoEn: new Date().toISOString(),
      metricas,
      detalles
    });

  } catch (errGlobal) {
    console.error('[reconcile-cron] Error global en ciclo de conciliación:', errGlobal);
    return res.status(500).json({
      ok: false,
      error: 'ERROR_INTERNO_CONCILIACION',
      mensaje: errGlobal.message
    });
  }
};

// Reutilizado por el panel (lib/admin/pagos.js → "Conciliar con Wompi").
module.exports.resolverBeneficioOrden = resolverBeneficioOrden;
