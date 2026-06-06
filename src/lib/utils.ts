import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns true when an error from Supabase is a row-level security denial.
 * Postgres error code 42501 = insufficient_privilege.
 */
export function isRlsDenial(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as Record<string, unknown>
  if (e.code === "42501") return true
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : ""
  return msg.includes("row-level security") || msg.includes("new row violates")
}

/**
 * Formats a monetary amount using es-AR locale.
 * currency: 'ARS' | 'USD'
 *
 * es-AR Intl yields:
 *   ARS → "$ 1.234,56"   (peso argentino)
 *   USD → "US$ 1.234,56" (dólar estadounidense)
 */
export function formatCurrency(amount: number, currency: "ARS" | "USD"): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
