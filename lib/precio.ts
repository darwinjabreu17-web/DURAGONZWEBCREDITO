/**
 * Interpreta lo que el usuario escribió en un campo de precio.
 *
 * - Si escribió un número normal (ej. "1.25"), lo devuelve tal cual.
 * - Si escribió un porcentaje (ej. "30%" o "30"), calcula:
 *     precioCosto + (precioCosto * porcentaje / 100)
 *
 * Uso típico: se llama en el evento onBlur (cuando el usuario sale del campo)
 * o cuando presiona Enter, NUNCA mientras escribe cada letra.
 */
export function resolverPrecioDesdeTexto(textoIngresado: string, precioCosto: number): number {
  const texto = textoIngresado.trim();

  if (texto === '') return 0;

  // Si termina en %, es un margen sobre el costo.
  if (texto.endsWith('%')) {
    const porcentaje = parseFloat(texto.slice(0, -1).replace(',', '.'));
    if (isNaN(porcentaje)) return precioCosto;
    return Number((precioCosto + (precioCosto * porcentaje) / 100).toFixed(2));
  }

  // Si no tiene %, es un precio directo.
  const numero = parseFloat(texto.replace(',', '.'));
  if (isNaN(numero)) return precioCosto;
  return Number(numero.toFixed(2));
}
