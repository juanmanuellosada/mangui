import { parseISO, isAfter, startOfDay } from "date-fns"

/**
 * Returns true when the given ISO date string is strictly after today
 * (i.e. is_future = true). Mirrors isInstallmentFuture from installments.ts
 * but is a shared utility for movements and transfers.
 */
export function isFutureDate(dateStr: string): boolean {
  const today = startOfDay(new Date())
  const d = startOfDay(parseISO(dateStr))
  return isAfter(d, today)
}
