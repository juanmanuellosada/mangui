import { z } from "zod"
import type { Tables } from "@/lib/database.types"
import type { DollarType } from "@/lib/movements"

export type MovementFormValues = {
  type: "income" | "expense"
  amount: number
  original_currency: "ARS" | "USD"
  account_id: string
  category_id: string | null
  date: string
  note: string
  tags: string[]
  is_future: boolean
  // cross-currency
  dollar_type: DollarType | null
  converted_amount: number | null
  // cuotas — only meaningful for expense + tarjeta_credito
  cuotas: number
}

export const movementSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  original_currency: z.enum(["ARS", "USD"]),
  account_id: z.string().min(1, "Seleccioná una cuenta"),
  category_id: z.string().nullable(),
  date: z.string().min(1, "Seleccioná una fecha"),
  note: z.string(),
  tags: z.array(z.string()),
  is_future: z.boolean(),
  dollar_type: z
    .enum(["oficial", "blue", "mep", "ccl", "tarjeta"])
    .nullable(),
  converted_amount: z.coerce.number().nullable(),
  cuotas: z.coerce.number().int().min(1).max(60),
})

export type PendingAttachments = {
  factura: File | null
  recibo: File | null
  comprobante: File | null
}

export type MovementMode = "income" | "expense" | "transfer"

/** Convert a DB movement row to form default values */
export function movementToFormValues(
  movement: Tables<"movements">
): MovementFormValues {
  return {
    type: movement.type,
    amount: movement.amount,
    original_currency: movement.original_currency,
    account_id: movement.account_id,
    category_id: movement.category_id,
    date: movement.date,
    note: movement.note ?? "",
    tags: movement.tags ?? [],
    is_future: movement.is_future,
    dollar_type: (movement.dollar_type as DollarType | null) ?? null,
    converted_amount: movement.converted_amount ?? null,
    cuotas: 1,
  }
}
