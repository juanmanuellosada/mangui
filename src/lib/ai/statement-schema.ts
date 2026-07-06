import { z } from "zod"

/** Una línea de consumo dentro de un resumen de tarjeta. */
export const parsedStatementLineSchema = z.object({
  description: z.string(),
  /** YYYY-MM-DD */
  date: z.string(),
  amount: z.number(),
  currency: z.enum(["ARS", "USD"]),
  /** Equivalente en pesos si el PDF lo muestra (líneas en USD); si no, null. */
  amount_ars: z.number().nullable().default(null),
  installment_number: z.number().int().nullable().default(null),
  installment_total: z.number().int().nullable().default(null),
  /** true si es un cargo mensual recurrente de un servicio (Netflix, Spotify, etc.) sin cuotas. */
  is_subscription: z.boolean().default(false),
  category_hint: z.string().nullable().default(null),
})

export type ParsedStatementLine = z.infer<typeof parsedStatementLineSchema>

/** Resumen de tarjeta de crédito interpretado por la IA a partir del PDF. */
export const parsedStatementSchema = z.object({
  bank: z.string().nullable().default(null),
  /** Últimos 4 dígitos o nombre de la tarjeta, para sugerir la cuenta del usuario. */
  account_hint: z.string().nullable().default(null),
  close_date: z.string().nullable().default(null),
  due_date: z.string().nullable().default(null),
  total_ars: z.number().nullable().default(null),
  total_usd: z.number().nullable().default(null),
  stamp_tax: z.number().nullable().default(null),
  lines: z.array(parsedStatementLineSchema),
})

export type ParsedStatement = z.infer<typeof parsedStatementSchema>
