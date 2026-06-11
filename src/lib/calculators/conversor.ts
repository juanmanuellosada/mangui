export type Direction = "ars_to_usd" | "usd_to_ars"

/**
 * Convierte usando compra/venta del tipo de dólar.
 * - ARS→USD: comprás dólares a la VENTA (sell) → usd = ars / sell
 * - USD→ARS: vendés dólares a la COMPRA (buy)  → ars = usd * buy
 * Devuelve 0 si la tasa no es válida.
 */
export function convertDolar(amount: number, dir: Direction, rate: { buy: number; sell: number }): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  if (dir === "ars_to_usd") return rate.sell > 0 ? amount / rate.sell : 0
  return rate.buy > 0 ? amount * rate.buy : 0
}

export const DOLAR_TYPES = [
  { key: "oficial", label: "Oficial" },
  { key: "blue", label: "Blue" },
  { key: "mep", label: "MEP" },
  { key: "ccl", label: "CCL" },
] as const

export type DolarKey = (typeof DOLAR_TYPES)[number]["key"]
