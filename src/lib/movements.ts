import type { Tables, Enums } from "@/lib/database.types"

export type Movement = Tables<"movements">
export type MovementType = Enums<"movement_type">
export type Currency = Enums<"currency">

/** dollar_type on movements includes 'tarjeta' in addition to the rate_type enum */
export type DollarType = "oficial" | "blue" | "mep" | "ccl" | "tarjeta"

export const DOLLAR_TYPE_LABELS: Record<DollarType, string> = {
  oficial: "Oficial",
  blue: "Blue",
  mep: "MEP",
  ccl: "CCL",
  tarjeta: "Tarjeta",
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  income: "Ingreso",
  expense: "Gasto",
}

/** Query keys for TanStack Query cache invalidation */
export const MOVEMENTS_KEY = ["movements"] as const
export const TRANSFERS_KEY = ["transfers"] as const
export const ACCOUNTS_KEY = ["accounts"] as const
export const BALANCES_KEY = ["account_balances"] as const
export const CATEGORIES_KEY = ["categories"] as const
