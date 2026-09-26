/**
 * Devuelve la URL solo si es http(s); si no, cadena vacía.
 *
 * Los enlaces de los anuncios vienen de datos raspados de otros portales (fuente no confiable).
 * Un enlace `javascript:…` o `data:…` en un href ejecutaría código al hacer clic (XSS), así que
 * todo enlace externo debe pasar por aquí antes de mostrarse.
 */
export function urlSegura(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(String(url).trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}
