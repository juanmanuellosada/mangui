/**
 * Regla central para sumar montos de movimientos hacia una moneda objetivo.
 *
 * Un movimiento en moneda `original_currency` aporta a un total en moneda
 * `target`:
 *   - `amount`            si original_currency === target
 *   - `converted_amount`  si original_currency !== target y converted_amount no es null
 *   - 0 (no se cuenta)    si original_currency !== target y converted_amount es null
 *
 * El último caso es el de un consumo "USD puro" (p. ej. una compra en dólares
 * sobre una tarjeta de crédito en ARS sin equivalente en pesos guardado): no
 * se mezcla con los totales en la moneda objetivo, aparece aparte por moneda.
 *
 * Única fuente de verdad para este cálculo — no reimplementar esta lógica en
 * otro lado, importar `amountInCurrency` en su lugar.
 */
export interface MoneyMovement {
  amount: number
  converted_amount: number | null
  original_currency: string
}

export function amountInCurrency(m: MoneyMovement, target: string): number {
  if (m.original_currency === target) return m.amount
  return m.converted_amount ?? 0
}
