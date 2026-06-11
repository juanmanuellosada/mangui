import type { Enums } from "@/lib/database.types"

export type RateType = Enums<"rate_type">

/** Shape returned by https://dolarapi.com/v1/dolares */
interface DolarApiItem {
  casa: string
  nombre: string
  compra: number | null
  venta: number | null
  fechaActualizacion: string
}

export interface RateData {
  buy: number
  sell: number
  fetchedAt: string
}

export type RatesMap = Partial<Record<Exclude<RateType, "manual">, RateData>>

// Map DolarAPI "casa" field to our rate_type enum
const CASA_MAP: Record<string, Exclude<RateType, "manual">> = {
  oficial: "oficial",
  blue: "blue",
  bolsa: "mep",
  contadoconliqui: "ccl",
}

/**
 * Fetches current exchange rates from DolarAPI.
 * Cached at the Next.js fetch layer for 30 minutes (1800s).
 */
export async function fetchDolarRates(): Promise<RatesMap> {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares", {
      next: { revalidate: 1800 },
    })
    if (!res.ok) throw new Error(`DolarAPI responded ${res.status}`)
    const data: DolarApiItem[] = await res.json()

    const map: RatesMap = {}
    for (const item of data) {
      const rateType = CASA_MAP[item.casa.toLowerCase()]
      if (!rateType) continue
      map[rateType] = {
        buy: item.compra ?? 0,
        sell: item.venta ?? 0,
        fetchedAt: item.fechaActualizacion,
      }
    }
    return map
  } catch (err) {
    console.error("[dolar] fetchDolarRates failed:", err)
    return {}
  }
}

/**
 * Returns the RateData for a specific rate_type from DolarAPI.
 * Returns null when rate_type is 'manual' (caller must supply manual_rate).
 */
export async function getRateData(
  rateType: RateType
): Promise<RateData | null> {
  if (rateType === "manual") return null
  const rates = await fetchDolarRates()
  return rates[rateType] ?? null
}

/**
 * Returns the conversion rate for `fromCurrency` → the other currency.
 * Returns `null` when no usable rate is available (missing API data, zero, or
 * manual with no valid manualRate), so callers can surface an explicit error
 * instead of silently computing a wrong number.
 */
export function getConversionRate(
  rateType: RateType,
  rates: RatesMap,
  manualRate: number | null,
  fromCurrency: "ARS" | "USD"
): number | null {
  if (rateType === "manual") {
    return manualRate != null && manualRate > 0 ? manualRate : null
  }
  const data = rates[rateType as keyof RatesMap]
  if (!data) return null
  const r = fromCurrency === "ARS" ? data.sell : data.buy
  return r != null && r > 0 ? r : null
}

/**
 * Converts an amount between ARS and USD.
 * Returns `null` when the required rate is unavailable (instead of silently
 * falling back to rate = 1 and producing a wrong number).
 *
 * @param amount       - the amount in `fromCurrency`
 * @param fromCurrency - 'ARS' | 'USD'
 * @param toCurrency   - 'ARS' | 'USD'
 * @param rateType     - which rate to use for conversion
 * @param manualRate   - required when rateType === 'manual'
 * @param ratesMap     - pre-fetched rates map (optional, avoids a second fetch)
 */
export async function convertAmount(
  amount: number,
  fromCurrency: "ARS" | "USD",
  toCurrency: "ARS" | "USD",
  rateType: RateType,
  manualRate?: number | null,
  ratesMap?: RatesMap
): Promise<number | null> {
  if (fromCurrency === toCurrency) return amount
  const map = rateType === "manual" ? ({} as RatesMap) : (ratesMap ?? (await fetchDolarRates()))
  const rate = getConversionRate(rateType, map, manualRate ?? null, fromCurrency)
  if (rate == null) return null
  return fromCurrency === "ARS" && toCurrency === "USD" ? amount / rate : amount * rate
}
