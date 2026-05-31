import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
