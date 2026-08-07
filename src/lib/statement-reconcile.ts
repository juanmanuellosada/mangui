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

/** Corrección de importe de un movimiento ya cargado al valor que figura en el PDF (migración 0059). */
export interface ReconcileAmountUpdate {
  id: string
  amount: number
}

/**
 * Payload de `import_card_statement` en modo aditivo: NO dispara el DELETE
 * previo de movimientos simples (ver migración 0056_statement_reconcile_additive.sql).
 * `deletions` y `amount_updates` (migración 0059) son las bajas y correcciones
 * de importe que el usuario tildó en el diff, y se aplican en la MISMA
 * transacción que las altas: o queda todo el resumen corregido, o no queda nada.
 */
export type ReconcileApplyPayload = StatementImportPayload & {
  additive: true
  /** IDs de movimientos cargados que el PDF no tiene y el usuario decidió eliminar. */
  deletions: string[]
  /** Movimientos cargados cuyo importe se corrige al del PDF. */
  amount_updates: ReconcileAmountUpdate[]
}

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
  /**
   * Movimientos cargados que el usuario tildó para ELIMINAR porque el PDF no
   * los tiene (sección "sobra" del diff). Opcional/aditivo: sin esta clave el
   * comportamiento es el de antes (no se borra nada).
   */
  deletions?: ReconcileMovement[]
  /**
   * Diferencias de importe que el usuario tildó para CORREGIR: el movimiento
   * cargado pasa a valer lo que dice el PDF, que es la fuente de verdad de lo
   * que hay que pagar. Opcional/aditivo.
   */
  amountFixes?: StatementMismatch[]
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
  return {
    ...payload,
    additive: true,
    deletions: (input.deletions ?? []).map((m) => m.id),
    amount_updates: (input.amountFixes ?? []).map((m) => ({ id: m.movement.id, amount: m.line.amount })),
  }
}

// ── Plan de corroboración: qué se va a hacer y cómo quedan los importes ─────

export interface CurrencyTotals {
  ARS: number
  USD: number
}

/** Cómo queda una moneda después de aplicar el plan, contra lo que dice el PDF. */
export interface ReconcileTotalsRow {
  currency: "ARS" | "USD"
  /** Suma de lo cargado hoy en el ciclo (gastos − reintegros), mismo neteo que cards.ts. */
  current: number
  /** Suma proyectada después de aplicar altas, correcciones y bajas tildadas. */
  after: number
  /** Lo que hay que pagar según el PDF (total declarado si vino; si no, suma de sus líneas). */
  pdf: number
  /** after − pdf (0 = el resumen queda clavado con el PDF). */
  difference: number
  matches: boolean
  /** true si el total de esta moneda del PDF salió de sumar sus líneas porque el PDF no declaró total. */
  pdfFromLines: boolean
}

export interface ReconcilePlan {
  /** Líneas del PDF tildadas para agregar (sólo la ocurrencia de ESTE resumen). */
  additions: number
  /** Diferencias de importe tildadas para corregir al monto del PDF. */
  fixes: number
  /** Movimientos cargados tildados para eliminar. */
  deletions: number
  /**
   * Compras en cuotas de este resumen cuyas cuotas FUTURAS se recalculan
   * (upsert idempotente): no cambian nada de este ciclo, reparan la
   * proyección de los que vienen.
   */
  reprojected: number
  /** true si no hay ninguna operación tildada. */
  empty: boolean
  /** Una fila por moneda con movimiento (o con total en el PDF). */
  totals: ReconcileTotalsRow[]
  /** true si TODAS las monedas quedan clavadas con el PDF después de aplicar. */
  allMatch: boolean
}

export interface BuildReconcilePlanInput {
  parsed: ParsedStatement
  /** Movimientos del ciclo tal como están cargados hoy (los mismos que se le pasaron a reconcileStatement). */
  cycleMovements: ReconcileMovement[]
  /** Líneas faltantes tildadas para agregar. */
  additions: StatementReviewLine[]
  /** Diferencias de importe tildadas para corregir. */
  fixes: StatementMismatch[]
  /** Movimientos tildados para eliminar. */
  deletions: ReconcileMovement[]
  /** Cantidad de compras en cuotas cuyas cuotas futuras se van a recalcular. Opcional; default 0. */
  reprojections?: number
}

/** Mismo criterio de neteo que `signedAmount` en cards.ts: un reintegro (income) resta. */
function signedMovement(m: { amount: number; type: "expense" | "income" }): number {
  return m.type === "income" ? -m.amount : m.amount
}

function signedLine(l: { amount: number; is_refund?: boolean }): number {
  return l.is_refund === true ? -l.amount : l.amount
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Función PURA: proyecta cómo van a quedar los importes del resumen si se
 * aplica lo que el usuario tildó del diff, y los compara contra el PDF (la
 * fuente de verdad de lo que hay que pagar). Es lo que la pantalla muestra
 * ANTES de tocar nada: cuántos movimientos se agregan, cuántos se corrigen,
 * cuántos se eliminan, y con qué total queda cada moneda.
 *
 * Sólo cuenta la ocurrencia de ESTE ciclo de cada línea agregada: una cuota
 * tildada proyecta también sus cuotas futuras (ver buildReconcileApplyPayload),
 * pero ésas caen en resúmenes siguientes y no mueven el total de éste.
 */
export function buildReconcilePlan(input: BuildReconcilePlanInput): ReconcilePlan {
  const current: CurrencyTotals = { ARS: 0, USD: 0 }
  for (const m of input.cycleMovements) current[m.currency] += signedMovement(m)

  const after: CurrencyTotals = { ARS: current.ARS, USD: current.USD }
  for (const l of input.additions) after[l.currency] += signedLine(l)
  for (const d of input.deletions) after[d.currency] -= signedMovement(d)
  for (const f of input.fixes) {
    after[f.movement.currency] -= signedMovement(f.movement)
    after[f.line.currency] += signedLine(f.line)
  }

  // Total del PDF por moneda: el declarado en el encabezado manda; si el PDF
  // no lo trae (o la IA no lo leyó), se cae a la suma de sus propias líneas.
  const pdfLines: CurrencyTotals = { ARS: 0, USD: 0 }
  for (const l of input.parsed.lines) pdfLines[l.currency] += signedLine(l)
  const declared: Record<"ARS" | "USD", number | null> = {
    ARS: input.parsed.total_ars,
    USD: input.parsed.total_usd,
  }

  const currencies: ("ARS" | "USD")[] = ["ARS", "USD"]
  const totals: ReconcileTotalsRow[] = currencies
    .filter((c) => current[c] !== 0 || after[c] !== 0 || pdfLines[c] !== 0 || (declared[c] ?? 0) !== 0)
    .map((currency) => {
      const pdfFromLines = declared[currency] == null
      const pdf = round2(pdfFromLines ? pdfLines[currency] : declared[currency]!)
      const afterRounded = round2(after[currency])
      const difference = round2(afterRounded - pdf)
      return {
        currency,
        current: round2(current[currency]),
        after: afterRounded,
        pdf,
        difference,
        matches: Math.abs(difference) < AMOUNT_EPSILON,
        pdfFromLines,
      }
    })

  const reprojected = input.reprojections ?? 0
  return {
    additions: input.additions.length,
    fixes: input.fixes.length,
    deletions: input.deletions.length,
    reprojected,
    empty:
      input.additions.length === 0 &&
      input.fixes.length === 0 &&
      input.deletions.length === 0 &&
      reprojected === 0,
    totals,
    allMatch: totals.length > 0 && totals.every((t) => t.matches),
  }
}
