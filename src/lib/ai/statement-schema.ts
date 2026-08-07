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
  /**
   * true si la línea es una devolución/reintegro de impuestos o percepciones
   * (monto siempre positivo, ver extract-statement.ts). Se carga como ingreso
   * y se resta del total importado para que cuadre con el TOTAL A PAGAR del
   * resumen, que ya neteó la devolución.
   */
  is_refund: z.boolean().default(false),
  category_hint: z.string().nullable().default(null),
})

export type ParsedStatementLine = z.infer<typeof parsedStatementLineSchema>

/** Un mes de la tabla "Cuotas a vencer" del resumen (ver parsedStatementSchema.upcoming_installments). */
export const upcomingInstallmentEntrySchema = z.object({
  /** Mes tal como figura en el PDF (ej. "Agosto/26"), sólo informativo. */
  month: z.string(),
  /** Total de cuotas a vencer de ese mes. */
  amount: z.number(),
})

export type UpcomingInstallmentEntry = z.infer<typeof upcomingInstallmentEntrySchema>

/** Resumen de tarjeta de crédito interpretado por la IA a partir del PDF. */
export const parsedStatementSchema = z.object({
  bank: z.string().nullable().default(null),
  /** Índice (0-based) de la tarjeta del usuario que mejor coincide con el resumen, dentro de la lista numerada que se le mandó al modelo. null si ninguna coincide o no hay lista. */
  account_idx: z.number().int().nullable().default(null),
  /** Respaldo de account_idx: últimos 4 dígitos o nombre de la tarjeta tal como se mencionan en el PDF, para cuando el índice no vino o quedó fuera de rango. */
  account_hint: z.string().nullable().default(null),
  close_date: z.string().nullable().default(null),
  due_date: z.string().nullable().default(null),
  total_ars: z.number().nullable().default(null),
  total_usd: z.number().nullable().default(null),
  stamp_tax: z.number().nullable().default(null),
  lines: z.array(parsedStatementLineSchema),
  /**
   * Tabla "Cuotas a vencer" del resumen (si el PDF la trae): un total de
   * cuotas por mes, en el mismo orden cronológico en que aparece en el PDF,
   * SIN interpretar a qué ciclo corresponde cada mes (los títulos de mes de
   * Galicia no son confiables: con cierre 30-jul la primera columna se
   * titula "Agosto/26" y con cierre 28-may, "Junio-26"). A qué cycleOffset
   * corresponde el primer monto lo resuelve capInstallmentOffsets por
   * aritmética (ver resolveTableStartOffset en statement-import.ts): en los
   * resúmenes reales de Galicia arranca en el ciclo SIGUIENTE. Se usa para
   * que la proyección de cuotas futuras coincida exacto con lo que el banco
   * va a cobrar (algunos bancos terminan una cuota antes de lo que
   * installment_number/installment_total sugieren). null si el PDF no trae
   * esta tabla.
   */
  upcoming_installments: z.array(upcomingInstallmentEntrySchema).nullable().default(null),
})

export type ParsedStatement = z.infer<typeof parsedStatementSchema>
