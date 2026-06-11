import { parseISO, isAfter, startOfDay } from "date-fns"

export const AR_TZ = "America/Argentina/Buenos_Aires"

/** Today's date in Argentina timezone as yyyy-MM-dd (works on client and server). */
export function todayAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: AR_TZ })
}

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
