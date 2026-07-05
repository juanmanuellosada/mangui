import { parseISO, subDays, format } from "date-fns"
import { amountInCurrency } from "@/lib/money"

/**
 * Moneda objetivo asumida para el baseline histórico y el candidato: la app
 * no tiene una noción de "moneda de la detección de gastos inusuales", así
 * que se asume ARS (moneda de cuenta por defecto). Un gasto USD sin
 * converted_amount ("USD puro") no se cuenta ni en el promedio histórico ni
 * como candidato — no se mezcla con la comparación en ARS.
 */
const UNUSUAL_CHARGE_CURRENCY = "ARS"

/** Minimum number of prior same-category expenses required to have a baseline. */
export const MIN_HISTORY = 5

/** Candidate must be this many times the historical average to qualify as unusual. */
export const UNUSUAL_FACTOR = 3

/** Look-back window (days) used to build the category's historical average. */
export const HISTORY_DAYS = 90

/**
 * Minimum amount (ARS-equivalent, ver UNUSUAL_CHARGE_CURRENCY) the candidate
 * itself must reach to qualify as unusual — avoids flagging categories where even
 * a 3x jump is still a trivially small sum (noise).
 */
export const MIN_AMOUNT = 5000

export interface UnusualChargeMovement {
  id: string
  type: string
  is_future: boolean
  date: string // yyyy-MM-dd
  category_id: string | null
  amount: number
  converted_amount: number | null
  original_currency: string
}

export interface UnusualChargeResult {
  isUnusual: boolean
  avg: number
  ratio: number
}

/**
 * Compares a candidate expense against its category's historical average
 * (prior ~90 days) to detect an unusually large charge.
 *
 * `historical` may be any set of movements (e.g. a user's last 12 months) —
 * this function filters it down internally to the same category, excludes
 * the candidate itself, and restricts to the HISTORY_DAYS window before it.
 *
 * Returns null when the rule doesn't apply (not an expense, future movement,
 * no category, or not enough history to establish a baseline). Otherwise
 * returns the computed average/ratio and whether it crosses both the
 * UNUSUAL_FACTOR multiple and the MIN_AMOUNT floor.
 */
export function detectUnusualCharge(
  candidate: UnusualChargeMovement,
  historical: UnusualChargeMovement[],
  opts?: {
    minHistory?: number
    unusualFactor?: number
    minAmount?: number
    historyDays?: number
  }
): UnusualChargeResult | null {
  if (candidate.type !== "expense" || candidate.is_future) return null
  if (!candidate.category_id) return null

  const minHistory = opts?.minHistory ?? MIN_HISTORY
  const unusualFactor = opts?.unusualFactor ?? UNUSUAL_FACTOR
  const minAmount = opts?.minAmount ?? MIN_AMOUNT
  const historyDays = opts?.historyDays ?? HISTORY_DAYS

  const cutoff = format(subDays(parseISO(candidate.date), historyDays), "yyyy-MM-dd")

  const sameCategory = historical.filter(
    (m) =>
      m.id !== candidate.id &&
      m.category_id === candidate.category_id &&
      m.date >= cutoff &&
      m.date < candidate.date
  )

  if (sameCategory.length < minHistory) return null

  const avg =
    sameCategory.reduce((sum, m) => sum + amountInCurrency(m, UNUSUAL_CHARGE_CURRENCY), 0) /
    sameCategory.length
  if (avg <= 0) return null

  const candidateAmount = amountInCurrency(candidate, UNUSUAL_CHARGE_CURRENCY)
  const ratio = candidateAmount / avg
  const isUnusual = ratio > unusualFactor && candidateAmount >= minAmount

  return { isUnusual, avg, ratio }
}
