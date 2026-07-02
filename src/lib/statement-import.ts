import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/lib/database.types"
import type { ParsedStatement } from "@/lib/ai/statement-schema"

export type { ParsedStatement, ParsedStatementLine } from "@/lib/ai/statement-schema"

/** Error identificable lanzado por importStatementPdf (ej. para distinguir rate-limit de otros fallos). */
export class StatementImportError extends Error {
  code: "rate_limited" | "invalid_response"
  constructor(code: "rate_limited" | "invalid_response", message: string) {
    super(message)
    this.name = "StatementImportError"
    this.code = code
  }
}

/**
 * Sube un PDF de resumen de tarjeta a /api/ai/import-statement y devuelve el
 * ParsedStatement crudo interpretado por la IA (sin persistir nada todavía).
 */
export async function importStatementPdf(
  file: File,
  opts: { accounts: string[]; categories: { name: string; type: string }[] }
): Promise<ParsedStatement> {
  const form = new FormData()
  form.append("pdf", file, file.name || "resumen.pdf")
  form.append("accounts", JSON.stringify(opts.accounts))
  form.append("categories", JSON.stringify(opts.categories))

  const res = await fetch("/api/ai/import-statement", { method: "POST", body: form })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (res.status === 429) {
      throw new StatementImportError("rate_limited", data?.message ?? "Alcanzaste el límite diario de IA.")
    }
    throw new StatementImportError(
      "invalid_response",
      data?.message || data?.error || "No pude interpretar el resumen."
    )
  }
  return (await res.json()) as ParsedStatement
}

// ── buildStatementPayload ────────────────────────────────────────────────────

/** Una línea del resumen ya revisada por el usuario, lista para armar el payload. */
export interface StatementReviewLine {
  description: string
  /** YYYY-MM-DD */
  date: string
  amount: number
  currency: "ARS" | "USD"
  /** Equivalente en pesos si el PDF lo mostró para esta línea. */
  amount_ars: number | null
  installment_number: number | null
  installment_total: number | null
  /** Categoría elegida por el usuario (o sugerida y aceptada); null = sin categoría. */
  category_id: string | null
  /** false = el usuario deseleccionó esta línea; se excluye del payload. */
  selected: boolean
}

export interface BuildStatementPayloadInput {
  account_id: string
  /** Moneda de la cuenta tarjeta (siempre ARS en la práctica). */
  account_currency: "ARS" | "USD"
  close_date: string
  due_date: string
  total_amount: number
  total_amount_usd: number
  stamp_tax: number
  lines: StatementReviewLine[]
  /**
   * Cotización ARS por 1 USD a usar cuando una línea en moneda distinta de la
   * cuenta no trae `amount_ars` del PDF. Requerida en ese caso (el trigger de
   * integridad 0041 rechaza converted_amount NULL en líneas cross-currency).
   */
  rate?: number | null
}

export interface StatementImportPayloadLine {
  date: string
  amount: number
  original_currency: "ARS" | "USD"
  converted_amount: number | null
  dollar_type: "tarjeta" | null
  category_id: string | null
  note: string
}

export interface StatementImportPayload {
  account_id: string
  close_date: string
  due_date: string
  total_amount: number
  total_amount_usd: number
  stamp_tax: number
  lines: StatementImportPayloadLine[]
}

function buildLineNote(line: StatementReviewLine): string {
  if (line.installment_number != null && line.installment_total != null) {
    return `${line.description} (cuota ${line.installment_number}/${line.installment_total})`
  }
  return line.description
}

/**
 * Función pura: arma el payload que espera la RPC import_card_statement a
 * partir del resumen revisado por el usuario. Excluye las líneas
 * deseleccionadas, agrega la etiqueta de cuota a la nota, y resuelve
 * converted_amount/dollar_type para líneas en una moneda distinta de la
 * cuenta (USD en tarjeta ARS).
 *
 * Lanza si una línea cross-currency no trae `amount_ars` y no se pasó `rate`
 * (nunca deja converted_amount null en ese caso).
 */
export function buildStatementPayload(input: BuildStatementPayloadInput): StatementImportPayload {
  const lines: StatementImportPayloadLine[] = input.lines
    .filter((line) => line.selected)
    .map((line) => {
      const sameCurrency = line.currency === input.account_currency
      let converted_amount: number | null = null
      let dollar_type: "tarjeta" | null = null

      if (!sameCurrency) {
        dollar_type = "tarjeta"
        if (line.amount_ars != null) {
          converted_amount = line.amount_ars
        } else if (input.rate != null) {
          converted_amount = Math.round(line.amount * input.rate * 100) / 100
        } else {
          throw new Error(
            `No se pudo determinar converted_amount para la línea "${line.description}" (moneda ${line.currency} distinta de la cuenta): falta amount_ars y rate.`
          )
        }
      }

      return {
        date: line.date,
        amount: line.amount,
        original_currency: line.currency,
        converted_amount,
        dollar_type,
        category_id: line.category_id,
        note: buildLineNote(line),
      }
    })

  return {
    account_id: input.account_id,
    close_date: input.close_date,
    due_date: input.due_date,
    total_amount: input.total_amount,
    total_amount_usd: input.total_amount_usd,
    stamp_tax: input.stamp_tax,
    lines,
  }
}

// ── saveImportedStatement ────────────────────────────────────────────────────

export interface SaveImportedStatementResult {
  statement_id: string
  movements_created: number
}

/** Llama a la RPC import_card_statement con el payload ya armado. */
export async function saveImportedStatement(
  supabase: SupabaseClient<Database>,
  payload: StatementImportPayload
): Promise<SaveImportedStatementResult> {
  const { data, error } = await supabase.rpc("import_card_statement", {
    p_payload: payload as unknown as Json,
  })
  if (error) throw error
  return data as unknown as SaveImportedStatementResult
}
