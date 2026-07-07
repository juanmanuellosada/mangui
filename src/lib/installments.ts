import type { Tables } from "@/lib/database.types"
import { addMonths, parseISO, isAfter, startOfDay } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { isInCycle, type CardCycle } from "@/lib/cards"

export type InstallmentPurchase = Tables<"installment_purchases">
export type Movement = Tables<"movements">
export type CardStatement = Tables<"card_statements">

/** Query key for installment purchases */
export const INSTALLMENTS_KEY = ["installments"] as const

/**
 * Given a date string and the list of cycles for the card, returns whether that date
 * falls in a cycle whose statement has status "pagado".
 */
export function isDateInPaidCycle(dateStr: string, cycles: CardCycle[]): boolean {
  for (const cycle of cycles) {
    if (
      cycle.statement?.status === "pagado" &&
      isInCycle(dateStr, cycle.cycleStart, cycle.cycleEnd)
    ) {
      return true
    }
  }
  return false
}

/** All movements (cuotas) belonging to an installment purchase, ordered by installment number. */
export async function fetchInstallmentMovements(purchaseId: string): Promise<Movement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .eq("installment_purchase_id", purchaseId)
    .order("installment_number")
  if (error) throw error
  return data
}

/**
 * Expense + income movements for a card account — used to compute its
 * billing cycles. Income incluye devoluciones/reintegros (is_refund), que
 * listCardCycles necesita para netear el total (ver signedAmount en cards.ts).
 */
export async function fetchAllMovementsForAccount(accountId: string): Promise<Movement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .eq("account_id", accountId)
    .in("type", ["expense", "income"])
  if (error) throw error
  return data
}

/** Card statements for an account — used to compute its billing cycles. */
export async function fetchStatementsForAccount(accountId: string): Promise<CardStatement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("card_statements")
    .select("*")
    .eq("account_id", accountId)
  if (error) throw error
  return data
}

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
