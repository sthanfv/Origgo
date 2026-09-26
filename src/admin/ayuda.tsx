import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import type { Seccion } from './PanelResumen';

/**
 * Ayuda dentro de cada sección del panel: qué hace, cómo se usa y qué cuidar. Pensada para que
 * cualquier persona a la que se le entregue el panel sepa trabajar sin explicación previa.
 * Se muestra abierta la primera vez; si se cierra, se recuerda en este navegador.
 */

const AYUDA: Record<Seccion, { que: string; como: string[]; cuidado?: string }> = {
  resumen: {
    que: 'La pantalla de inicio: lo que necesita atención ahora y las cifras reales de Origgo.',
    como: [
      'Arriba están los pendientes (retiros por vencer, pagos sospechosos, el cazador sin publicar). Toca uno para ir a resolverlo.',
      'Las cifras del catálogo son reales (se cuentan en la base de datos). Tócalas para ver esos inmuebles.',
    ],
    cuidado: 'Si ves "Todo en orden", no hay nada urgente.',
  },
  catalogo: {
    que: 'Los inmuebles que muestra la web. La base de datos es la fuente de la verdad: lo que cambies aquí se ve en la web en minutos.',
    como: [
      'Busca por título, ciudad, portal o precio y filtra por visibles, ocultos o destacados.',
      'Ocultar: el inmueble deja de verse en la web, pero no se borra. Destacar: aparece primero.',
      'Eliminar lo borra para siempre (pide confirmar tu código).',
    ],
    cuidado: 'Prefiere Ocultar antes que Eliminar: ocultar se puede deshacer.',
  },
  clientes: {
    que: 'Las personas que compraron créditos o planes.',
    como: [
      'Busca por celular o correo. Toca un cliente para ver su saldo, plan y órdenes.',
      'Puedes sumar o restar créditos y cambiar o extender el plan (por ejemplo, para compensar una falla).',
    ],
    cuidado:
      'Cada ajuste exige escribir el motivo, pide confirmar tu código y queda en la Auditoría. El PIN del cliente nunca se muestra.',
  },
  pagos: {
    que: 'Las órdenes de pago de Wompi: cuánto se vendió, qué está pendiente y qué es sospechoso.',
    como: [
      'Filtra por estado o busca por la referencia (empieza por HNT-).',
      'En cada pago verás si ya se entregó al cliente.',
      'Si un cliente dice que pagó y no recibió nada, abre su pago y toca "Conciliar con Wompi": consulta el pago real y lo entrega si corresponde. Nunca entrega dos veces.',
    ],
    cuidado:
      '"Sospecha de fraude" significa que se pagó menos de lo que vale el producto: no se entregó nada. Revísalo antes de hacer cualquier ajuste manual.',
  },
  retiros: {
    que: 'Solicitudes de propietarios que piden quitar su anuncio (Habeas Data, Ley 1581). Es una obligación legal: hay 15 días hábiles para responder.',
    como: [
      'Abre una solicitud para ver quién la pide y cómo identificó el inmueble.',
      'Retirar: oculta y bloquea el inmueble para que el cazador no lo vuelva a publicar. Rechazar: si el retiro preventivo no correspondía, el anuncio vuelve a verse.',
      'El buscador encuentra inmuebles por código, enlace, celular o texto. "Reindexar búsqueda" se usa una sola vez (o si la búsqueda no encuentra inmuebles viejos).',
    ],
    cuidado:
      'Resuelve cada solicitud antes de su fecha de vencimiento y escribe una nota de lo que hiciste.',
  },
  vitrina: {
    que: 'Los textos de la portada de la web: el contador, el título y el subtítulo.',
    como: ['Escribe el texto y guarda. Si dejas un campo vacío, la web usa el texto de siempre.'],
    cuidado: 'Solo cambia la versión en español; en inglés se mantiene la traducción.',
  },
  precios: {
    que: 'Los precios de los productos. Los usan la web y los cobros de Wompi.',
    como: [
      'Cambia el precio (en pesos), los créditos de cada paquete o los días de cada plan, y guarda.',
      'Antes de guardar verás un resumen del cambio para confirmarlo.',
    ],
    cuidado:
      'Un cambio de precio no afecta los pagos que ya se iniciaron. Pide confirmar tu código y queda en la Auditoría.',
  },
  cazador: {
    que: 'El estado del teléfono (Samsung J7) que busca inmuebles en los portales y los publica en Origgo.',
    como: [
      '"En línea" significa que el teléfono se comunicó hace menos de 15 minutos.',
      'Las publicaciones recientes muestran cuántos inmuebles guardó o retiró en cada envío.',
    ],
    cuidado:
      'Si aparece "Sin contacto", revisa que el teléfono esté encendido, cargando y con internet.',
  },
  auditoria: {
    que: 'El registro de todo lo que se hace en el panel: quién, qué y cuándo.',
    como: [
      'Filtra por tipo de acción. Sirve para revisar cambios de precios, ajustes de saldo, ingresos al panel y retiros.',
    ],
    cuidado:
      'Nada se puede borrar desde aquí. Si ves un ingreso o un cambio que no reconoces, cierra la sesión y cambia la contraseña de Google.',
  },
};

function leerCerrada(seccion: Seccion) {
  try {
    return localStorage.getItem(`origgo-admin-ayuda-${seccion}`) === 'cerrada';
  } catch {
    return false;
  }
}

export function AyudaSeccion({ seccion }: { seccion: Seccion }) {
  const [abierta, setAbierta] = useState(() => !leerCerrada(seccion));
  const a = AYUDA[seccion];
  if (!a) return null;
  return (
    <details
      className="adm-ayuda"
      open={abierta}
      onToggle={(e) => {
        const abiertaAhora = (e.target as HTMLDetailsElement).open;
        setAbierta(abiertaAhora);
        try {
          localStorage.setItem(
            `origgo-admin-ayuda-${seccion}`,
            abiertaAhora ? 'abierta' : 'cerrada',
          );
        } catch {
          // Almacenamiento bloqueado: la ayuda simplemente vuelve a abrirse la próxima vez.
        }
      }}
    >
      <summary>
        <HelpCircle size={16} aria-hidden="true" />
        ¿Qué es esta sección y cómo se usa?
      </summary>
      <p>{a.que}</p>
      <ul>
        {a.como.map((paso) => (
          <li key={paso}>{paso}</li>
        ))}
      </ul>
      {a.cuidado && <p className="adm-ayuda-cuidado">{a.cuidado}</p>}
    </details>
  );
}
