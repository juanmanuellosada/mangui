import type { ParsedStatement, ParsedStatementLine } from "@/lib/ai/statement-schema"
import {
  normalizeMerchant,
  buildStatementPayload,
  type StatementReviewLine,
  type StatementImportPayload,
} from "@/lib/statement-import"

/**
 * Movimiento ya cargado en el ciclo del resumen, reducido a lo que necesita
 * el diff. IMPORTANTE: `description` NO es simplemente `movements.note` — para
 * un movimiento de cuota, `movements.note` queda NULL en la base (el import
 * guarda el comercio en `installment_purchases.description`, ver
 * buildStatementPayload en statement-import.ts). Quien arma este array
 * (Grupo 3, UI) es responsable de resolver ese join (`note` para
 * gastos/suscripciones simples, `installment_purchases.description` para
 * cuotas vía `installment_purchase_id`) antes de llamar a
 * reconcileStatement, así esta función se mantiene pura y no depende del
 * shape de la base.
 */
export interface ReconcileMovement {
  id: string
  description: string
  amount: number
  currency: "ARS" | "USD"
  /** 'income' = devolución/reintegro (ver ParsedStatementLine.is_refund); 'expense' = gasto normal. */
  type: "expense" | "income"
  installment_number: number | null
  installment_total: number | null
}

/** Línea del PDF que matchea un movimiento cargado por comercio (y cuota), pero con importe distinto. */
export interface StatementMismatch {
  line: ParsedStatementLine
  movement: ReconcileMovement
}

export interface ReconcileResult {
  /** Líneas del PDF sin movimiento equivalente cargado. */
  missing: ParsedStatementLine[]
  /** Movimientos cargados sin línea equivalente en el PDF. */
  extra: ReconcileMovement[]
  /** Matchean por comercio (y cuota) pero difieren en el importe — se muestran ambos montos. */
  mismatched: StatementMismatch[]
}

/** Tolerancia de comparación de montos numeric(18,2): evita falsos "diferencia de monto" por precisión de floats. */
const AMOUNT_EPSILON = 0.005

function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < AMOUNT_EPSILON
}

function lineType(line: ParsedStatementLine): "expense" | "income" {
  return line.is_refund ? "income" : "expense"
}

/**
 * Clave de matching de una línea del PDF: comercio normalizado (misma
 * normalizeMerchant que purchase_key, ver statement-import.ts) + moneda +
 * tipo (gasto vs devolución) + número de cuota cuando la línea es una cuota
 * (D4 del design: cuotas matchean por comercio + installment_number, no por
 * installment_total). No incluye el importe a propósito: el importe se
 * compara aparte para distinguir "ya cargado" (Paso 1) de "diferencia de
 * monto" (Paso 2).
 */
function lineMatchKey(line: ParsedStatementLine): string {
  const installment = line.installment_number != null ? String(line.installment_number) : "-"
  return `${normalizeMerchant(line.description)}|${line.currency}|${lineType(line)}|${installment}`
}

function movementMatchKey(movement: ReconcileMovement): string {
  const installment = movement.installment_number != null ? String(movement.installment_number) : "-"
  return `${normalizeMerchant(movement.description)}|${movement.currency}|${movement.type}|${installment}`
}

function removeFromArray<T>(arr: T[], item: T): void {
  const idx = arr.indexOf(item)
  if (idx !== -1) arr.splice(idx, 1)
}

/**
 * Función PURA (sin I/O): compara el resumen extraído del PDF (`parsed`)
 * contra los movimientos ya cargados en el ciclo de ese resumen
 * (`cycleMovements`) y devuelve el diff usado por la pantalla de "Corroborar
 * con IA" (D1 del design).
 *
 * Matching en dos pasos, por comercio normalizado + moneda + tipo (gasto vs
 * devolución) + número de cuota cuando aplica:
 * 1. Match exacto (misma clave Y mismo importe) → la línea ya está cargada,
 *    no aparece en el resultado.
 * 2. Misma clave pero importe distinto → "diferencia de monto" (mismatched),
 *    mostrando la línea del PDF y el movimiento cargado (ambos importes).
 *
 * Lo que del PDF no encontró ni match exacto ni de clave queda en `missing`;
 * lo que de los movimientos cargados no encontró match queda en `extra`.
 */
export function reconcileStatement(parsed: ParsedStatement, cycleMovements: ReconcileMovement[]): ReconcileResult {
  const remainingLines = [...parsed.lines]
  const remainingMovements = [...cycleMovements]
  const mismatched: StatementMismatch[] = []

  // Paso 1: match exacto (misma clave y mismo importe) → ya cargado, no se lista.
  for (const line of parsed.lines) {
    const key = lineMatchKey(line)
    const idx = remainingMovements.findIndex(
      (m) => movementMatchKey(m) === key && amountsEqual(m.amount, line.amount)
    )
    if (idx === -1) continue
    remainingMovements.splice(idx, 1)
    removeFromArray(remainingLines, line)
  }

  // Paso 2: misma clave, importe distinto → diferencia de monto.
  for (const line of [...remainingLines]) {
    const key = lineMatchKey(line)
    const idx = remainingMovements.findIndex((m) => movementMatchKey(m) === key)
    if (idx === -1) continue
    const [movement] = remainingMovements.splice(idx, 1)
    mismatched.push({ line, movement })
    removeFromArray(remainingLines, line)
  }

  return { missing: remainingLines, extra: remainingMovements, mismatched }
}

// ── Aplicación reconciliable de lo faltante (Grupo 2, D2/tarea 2.2) ─────────

/** Payload de `import_card_statement` en modo aditivo: NO dispara el DELETE previo de movimientos simples (ver migración 0056_statement_reconcile_additive.sql). */
export type ReconcileApplyPayload = StatementImportPayload & { additive: true }

export interface BuildReconcileApplyPayloadInput {
  account_id: string
  /** Moneda de la cuenta tarjeta (siempre ARS en la práctica). */
  account_currency: "ARS" | "USD"
  close_date: string
  due_date: string
  total_amount: number
  total_amount_usd: number
  stamp_tax: number
  /**
   * Subconjunto de `missing` (líneas del PDF) que el usuario tildó para
   * agregar, ya convertidas a `StatementReviewLine` (con `selected: true` y
   * `category_id` resuelto) por quien arma la pantalla de diff (Grupo 3, UI)
   * — mismo shape que usa el import para reusar el componente de fila.
   */
  linesToApply: StatementReviewLine[]
  /** Tabla "Cuotas a vencer" del PDF corroborado, ver BuildStatementPayloadInput. */
  upcoming_installments_table?: number[] | null
}

/**
 * Arma el payload para aplicar SOLO lo que el usuario tildó del diff, en modo
 * aditivo (tarea 2.2). Reusa `buildStatementPayload` tal cual —la misma
 * expansión/proyección de cuotas por `close_date` + tabla "Cuotas a vencer"
 * que el import— así una cuota tildada agrega también sus cuotas futuras sin
 * duplicar esa lógica; lo único que agrega esta función es `additive: true`,
 * que le indica a la RPC (migración 0056) que NO borre los movimientos
 * simples ya cargados del resumen antes de insertar `lines`.
 *
 * Idempotencia (tarea 2.3): como el diff (`reconcileStatement`) siempre
 * recalcula qué falta contra lo YA cargado, re-corroborar el mismo resumen no
 * vuelve a ofrecer como "falta" lo que ya se agregó (no hay nada tildable
 * para duplicar). Para cuotas, aunque se re-aplicara la misma línea, el
 * upsert por `(purchase_key, installment_number)` de la RPC reconcilia en
 * vez de duplicar, en ambos modos (additive o no).
 */
export function buildReconcileApplyPayload(input: BuildReconcileApplyPayloadInput): ReconcileApplyPayload {
  const payload = buildStatementPayload({
    account_id: input.account_id,
    account_currency: input.account_currency,
    close_date: input.close_date,
    due_date: input.due_date,
    total_amount: input.total_amount,
    total_amount_usd: input.total_amount_usd,
    stamp_tax: input.stamp_tax,
    lines: input.linesToApply,
    upcoming_installments_table: input.upcoming_installments_table,
  })
  return { ...payload, additive: true }
}
