import type { Tables } from "@/lib/database.types"
import { addMonths, parseISO, isAfter, startOfDay } from "date-fns"

export type InstallmentPurchase = Tables<"installment_purchases">
export type Movement = Tables<"movements">

/** Query key for installment purchases */
export const INSTALLMENTS_KEY = ["installments"] as const

/**
 * Compute per-installment amount and the last installment amount
 * so the sum is exactly equal to total.
 *
 * Strategy: floor to 2 decimal places, last cuota absorbs rounding.
 */
export function computeInstallmentAmounts(
  total: number,
  count: number
): { perAmount: number; lastAmount: number } {
  const perAmount = Math.floor((total / count) * 100) / 100
  const lastAmount = Math.round((total - perAmount * (count - 1)) * 100) / 100
  return { perAmount, lastAmount }
}

/**
 * Compute the date of installment i (1-based) starting from startDate.
 * Uses addMonths from date-fns: installment 1 = startDate, installment 2 = startDate + 1 month, etc.
 */
export function computeInstallmentDate(startDate: string, installmentIndex: number): string {
  const base = parseISO(startDate)
  const d = addMonths(base, installmentIndex - 1)
  return d.toISOString().split("T")[0]
}

/**
 * Determine is_future for a cuota based on its date.
 * is_future = true when the cuota date is strictly after today.
 */
export function isInstallmentFuture(dateStr: string): boolean {
  const today = startOfDay(new Date())
  const cuotaDate = startOfDay(parseISO(dateStr))
  return isAfter(cuotaDate, today)
}
