import type { SupabaseClient } from "@supabase/supabase-js"
import { addMonths, parseISO } from "date-fns"
import type { Database, Json } from "@/lib/database.types"
import type { ParsedStatement } from "@/lib/ai/statement-schema"
import { normalizeNote, extractKeyword } from "@/lib/rules"
import { toDateString } from "@/lib/cards"

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
  /**
   * YYYY-MM-DD. Para líneas en cuotas, es la fecha de la compra original:
   * se usa para purchase_key y start_date de la compra, pero NO para anclar
   * la fecha de cada cuota (eso se ancla al ciclo del resumen, ver
   * expandReviewLines).
   */
  date: string
  amount: number
  currency: "ARS" | "USD"
  /** Equivalente en pesos si el PDF lo mostró para esta línea. */
  amount_ars: number | null
  installment_number: number | null
  installment_total: number | null
  /** true si la IA clasificó la línea como suscripción recurrente (sin cuotas). Opcional/aditivo; default false. */
  is_subscription?: boolean
  /**
   * true si es una devolución/reintegro de impuestos (monto siempre positivo).
   * Se carga como ingreso (no gasto) y resta del total del ciclo. Opcional/
   * aditivo; default false. Nunca aplica a una línea en cuotas.
   */
  is_refund?: boolean
  /**
   * true si la devolución cancela el saldo del resumen ANTERIOR y por eso no
   * forma parte del TOTAL A PAGAR de éste (ver
   * ParsedStatementLine.settles_previous en @/lib/ai/statement-schema). Se
   * importa igual —es plata que el banco acreditó y sin ella el cargo que
   * devuelve queda como gasto fantasma en la tarjeta— pero no se cuenta al
   * comparar contra el total del PDF. Opcional/aditivo; default false.
   */
  settles_previous?: boolean
  /** Categoría elegida por el usuario (o sugerida y aceptada); null = sin categoría. */
  category_id: string | null
  /** false = el usuario deseleccionó esta línea (y, si es cuota, todas sus cuotas futuras); se excluye del payload. */
  selected: boolean
  /**
   * Toggle "crear como recurrente" (Grupo 4, D5). Tiene efecto en cualquier
   * línea de gasto simple (suscripción detectada por IA o no); se ignora en
   * cuota, donde no aplica. Opcional/aditivo; default false (no crea nada,
   * D5: nada automático).
   */
  createRecurring?: boolean
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
   * Tabla "Cuotas a vencer" del PDF (ver ParsedStatement.upcoming_installments
   * en @/lib/ai/statement-schema), reducida a sólo los montos en el mismo
   * orden en que figuran en el PDF. A qué ciclo corresponde el índice 0 lo
   * decide resolveTableStartOffset por aritmética: en Galicia (VISA y
   * Mastercard, verificado) es el ciclo SIGUIENTE al resumen leído; otros
   * bancos podrían incluir el ciclo actual. Cuando está presente es la fuente de verdad para el TOTAL
   * de cuotas proyectadas de cada ciclo FUTURO (ver capInstallmentOffsets):
   * algunos bancos terminan una cuota antes de lo que
   * installment_number/installment_total sugieren, y sin este override la
   * proyección por número queda corrida un mes. Opcional/aditivo: si es
   * null/undefined o no cubre un ciclo, ese ciclo cae al cálculo por número
   * (comportamiento previo).
   */
  upcoming_installments_table?: number[] | null
}

export interface StatementImportPayloadLine {
  date: string
  amount: number
  original_currency: "ARS" | "USD"
  converted_amount: number | null
  dollar_type: "tarjeta" | null
  category_id: string | null
  note: string
  /**
   * Sólo no-null si la línea es una suscripción confirmada como recurrente (D5).
   * `subscription_key` es aditivo (agregado para cerrar el hueco de idempotencia
   * de la recurrente): identifica la suscripción para que la RPC no duplique la
   * recurring_transactions si se reimporta el mismo resumen con el toggle activo.
   */
  create_recurring: { day_of_month: number; subscription_key: string } | null
  /** true = la RPC debe insertar el movimiento con type='income' (devolución/reintegro), no 'expense'. */
  is_refund: boolean
  /**
   * true = la RPC marca el movimiento con `settles_previous` (migración 0060),
   * para que `listCardCycles` lo deje fuera del total del ciclo. Ver
   * StatementReviewLine.settles_previous.
   */
  settles_previous: boolean
}

export interface StatementImportPayloadInstallment {
  installment_number: number
  installment_total: number
  date: string
  amount: number
  original_currency: "ARS" | "USD"
  converted_amount: number | null
  dollar_type: "tarjeta" | null
  category_id: string | null
  note: string | null
}

export interface StatementImportPayloadPurchase {
  purchase_key: string
  description: string
  total_amount: number
  installments_count: number
  start_date: string
  currency: "ARS" | "USD"
  category_id: string | null
  dollar_type: "tarjeta" | null
  note: string | null
  installments: StatementImportPayloadInstallment[]
}

export interface StatementImportPayload {
  account_id: string
  close_date: string
  due_date: string
  total_amount: number
  total_amount_usd: number
  stamp_tax: number
  lines: StatementImportPayloadLine[]
  installment_purchases: StatementImportPayloadPurchase[]
}

type LineKind = "installment" | "subscription" | "simple"

/** Clasificación tri-estado: cuota > suscripción > simple (prioridad exacta del spec). */
function classifyLine(line: StatementReviewLine): LineKind {
  if (line.installment_number != null && line.installment_total != null) return "installment"
  if (line.is_subscription === true) return "subscription"
  return "simple"
}

/**
 * "USD puro": una línea en moneda distinta de la cuenta (siempre una tarjeta
 * de crédito acá) siempre queda con converted_amount null, ignorando
 * `amount_ars` aunque el PDF lo traiga — el usuario paga esa línea en
 * dólares, así que el equivalente en pesos del resumen no debe sumar a los
 * totales en pesos de la app (rompería "USD puro", ver @/lib/money). No hay
 * cotización manual que pedir.
 */
function resolveConversion(
  line: Pick<StatementReviewLine, "currency" | "amount" | "amount_ars">,
  accountCurrency: "ARS" | "USD"
): { converted_amount: number | null; dollar_type: "tarjeta" | null } {
  if (line.currency === accountCurrency) return { converted_amount: null, dollar_type: null }
  return { converted_amount: null, dollar_type: "tarjeta" }
}

/**
 * Comercio normalizado de una descripción de línea de resumen (misma
 * normalización que purchase_key/subscription_key). Exportada para que
 * statement-reconcile.ts (Grupo 1, corroborar con IA) matchee líneas del PDF
 * contra movimientos cargados con el MISMO criterio que el import, sin
 * duplicar la lógica.
 */
export function normalizeMerchant(description: string): string {
  const normalized = normalizeNote(description)
  return extractKeyword(normalized) ?? normalized
}

/**
 * Clave de identidad de compra (D2, Tarea 3.1): comercio normalizado (misma
 * normalizeNote/extractKeyword que rules.ts) + fecha de compra original +
 * total de cuotas. Determinística: reimportar un resumen posterior de la
 * misma compra produce la misma clave, permitiendo a la RPC reconciliar por
 * (purchase_key, installment_number) en vez de duplicar.
 */
export function buildPurchaseKey(description: string, purchaseDate: string, installmentTotal: number): string {
  return `${normalizeMerchant(description)}|${purchaseDate}|${installmentTotal}`
}

/**
 * Clave de identidad de suscripción (idempotencia de la recurrente creada por
 * el import, D5): comercio normalizado (misma normalizeNote/extractKeyword que
 * purchase_key) + cuenta. A diferencia de purchase_key, no lleva fecha ni
 * cuotas: una suscripción es "este comercio recurrente en esta tarjeta", así
 * que reimportar el mismo resumen (u otro que traiga la misma suscripción)
 * produce la misma clave y la RPC puede evitar crear una recurring_transactions
 * duplicada.
 */
export function buildSubscriptionKey(description: string, accountId: string): string {
  return `${normalizeMerchant(description)}|${accountId}`
}

/** Extrae el día del mes de un string YYYY-MM-DD sin pasar por Date (evita corrimientos de huso horario). */
function dayOfMonthFromISODate(dateStr: string): number {
  return Number(dateStr.slice(8, 10))
}

/**
 * Determina, para cada compra en cuotas, hasta qué cycleOffset proyectar una
 * ocurrencia futura, usando la tabla "Cuotas a vencer" del PDF (cuando está
 * presente) en vez de asumir que la cuota sigue hasta installment_total.
 *
 * La tabla es la fuente de verdad para el TOTAL por ciclo; el detalle (qué
 * compra puntual termina en qué mes) es una aproximación greedy: en cada
 * ciclo futuro cubierto por la tabla, si la suma "naive" de cuotas todavía
 * activas excede el total de la tabla, se van cortando compras —empezando
 * por las que tienen MENOS cuotas restantes, que son las candidatas más
 * probables a estar ya dadas de baja por el banco (ver ejemplo real:
 * ARFINANZAS/PROYECTOKAINO en "5/6" que el banco da por terminadas)— hasta
 * acercarse al total esperado. Una compra cortada en un ciclo queda cortada
 * para siempre (una cuota que el banco no cobra no vuelve a aparecer más
 * adelante). Si la tabla no cubre todos los ciclos que la proyección por
 * número alcanzaría, esos ciclos siguen con el cálculo por número (fallback).
 *
 * Devuelve un Map<purchaseKey, últimoCycleOffset a proyectar>.
 */
const TABLE_EPSILON = 0.01

/**
 * A qué cycleOffset corresponde el PRIMER monto de la tabla "Cuotas a
 * vencer". Galicia (verificado contra resúmenes reales de VISA y Mastercard)
 * la arranca en el primer ciclo FUTURO: el primer monto es lo que va a
 * cobrar el mes que viene, NO lo que estás por pagar en este resumen. Los
 * títulos de mes de la tabla no sirven para deducirlo (VISA con cierre 30-jul
 * titula la primera columna "Agosto/26" y Mastercard con cierre 28-may la
 * titula "Junio-26"), así que se calibra con la aritmética del propio
 * resumen: si el primer monto coincide con el total de cuotas del ciclo
 * SIGUIENTE, la tabla arranca en el ciclo siguiente (offset 1); si coincide
 * con el total de cuotas de ESTE resumen, arranca en el actual (offset 0,
 * formato de otros bancos). Ante la duda gana offset 1, que es lo observado
 * en la realidad: asumir 0 de más recorta las compras un mes antes de tiempo
 * y borra la última cuota de cada plan.
 */
function resolveTableStartOffset(
  purchases: { amount: number; naiveLastOffset: number }[],
  table: number[]
): number {
  const first = table[0]
  if (first == null) return 1
  const round2 = (n: number) => Math.round(n * 100) / 100
  // Toda compra en cuotas del resumen aporta su cuota en el ciclo leído.
  const currentSum = round2(purchases.reduce((sum, p) => sum + p.amount, 0))
  const nextSum = round2(
    purchases.filter((p) => p.naiveLastOffset >= 1).reduce((sum, p) => sum + p.amount, 0)
  )
  if (Math.abs(first - nextSum) <= TABLE_EPSILON) return 1
  if (Math.abs(first - currentSum) <= TABLE_EPSILON) return 0
  return 1
}

function capInstallmentOffsets(
  purchases: { purchaseKey: string; amount: number; naiveLastOffset: number }[],
  table: number[] | null | undefined
): Map<string, number> {
  const capped = new Map<string, number>()
  for (const p of purchases) capped.set(p.purchaseKey, p.naiveLastOffset)
  if (!table || table.length === 0) return capped

  const EPSILON = TABLE_EPSILON
  const startOffset = resolveTableStartOffset(purchases, table)
  const lastCoveredOffset = table.length - 1 + startOffset
  for (let offset = Math.max(1, startOffset); offset <= lastCoveredOffset; offset++) {
    const target = table[offset - startOffset]
    const active = purchases.filter((p) => capped.get(p.purchaseKey)! >= offset)
    const activeSum = Math.round(active.reduce((sum, p) => sum + p.amount, 0) * 100) / 100
    let excess = Math.round((activeSum - target) * 100) / 100
    if (excess <= EPSILON) continue

    const sorted = [...active].sort((a, b) => a.naiveLastOffset - b.naiveLastOffset || a.amount - b.amount)
    for (const p of sorted) {
      if (excess <= EPSILON) break
      capped.set(p.purchaseKey, offset - 1)
      excess = Math.round((excess - p.amount) * 100) / 100
    }
  }
  return capped
}

interface ExpandedLine {
  /** 0 = el resumen leído; N>0 = el N-ésimo ciclo futuro (un mes por ciclo). */
  cycleOffset: number
  kind: LineKind
  line: StatementReviewLine
  /** Sólo para kind "installment". */
  installmentNumber?: number
  installmentTotal?: number
  purchaseKey?: string
  /** Fecha real de esta ocurrencia: line.date para simple/suscripción, proyectada para cuotas. */
  date: string
}

/**
 * Expande cada línea seleccionada en una o más "ocurrencias": una para
 * líneas simples/suscripción, y una por cada cuota desde installment_number
 * hasta installment_total para líneas en cuotas (Tarea 3.2, D1/D3) — el monto
 * de cuota es siempre el leído (cuota fija) y la fecha se ancla al CICLO DEL
 * RESUMEN importado (close_date), no a la fecha de la compra original: la
 * cuota leída (installment_number) cae en close_date, y cada cuota futura
 * suma un mes más (N+1 = close_date + 1 mes, etc.). Así la cuota queda en el
 * mismo ciclo que el resumen que la trajo, y al reimportar el resumen
 * siguiente la cuota N+1 real proyecta la misma fecha (close_date + 1 mes)
 * que ese nuevo cierre, permitiendo reconciliar por
 * purchase_key + installment_number sin duplicar (Tarea 3.6).
 *
 * El rango N..installment_total a proyectar por compra puede acortarse por
 * capInstallmentOffsets cuando input.upcoming_installments_table trae la
 * tabla "Cuotas a vencer" del PDF: esa tabla manda sobre el número de cuota
 * para el TOTAL de cada ciclo futuro.
 *
 * Es la única fuente de verdad para clasificación, purchase_key y proyección:
 * tanto buildStatementPayload como groupStatementPreviewByCycle la reusan. Por
 * eso corregir una línea (categoría/descripción/monto/incluir) se propaga
 * automáticamente a todas sus cuotas futuras (Tarea 3.4) — no existe un
 * estado separado para las cuotas proyectadas, siempre se derivan de la misma
 * StatementReviewLine en el momento de construir el payload/preview.
 */
function expandReviewLines(input: BuildStatementPayloadInput): ExpandedLine[] {
  const installmentLines = input.lines.filter((l) => l.selected && classifyLine(l) === "installment")
  const cappedOffsets = capInstallmentOffsets(
    installmentLines.map((line) => {
      const total = line.installment_total!
      return {
        purchaseKey: buildPurchaseKey(line.description, line.date, total),
        amount: line.amount,
        naiveLastOffset: total - line.installment_number!,
      }
    }),
    input.upcoming_installments_table
  )

  const expanded: ExpandedLine[] = []
  for (const line of input.lines) {
    if (!line.selected) continue
    const kind = classifyLine(line)
    if (kind === "installment") {
      const n = line.installment_number!
      const total = line.installment_total!
      const purchaseKey = buildPurchaseKey(line.description, line.date, total)
      const lastOffset = cappedOffsets.get(purchaseKey) ?? total - n
      for (let i = n; i <= total; i++) {
        const cycleOffset = i - n
        if (cycleOffset > lastOffset) break
        expanded.push({
          cycleOffset,
          kind,
          line,
          installmentNumber: i,
          installmentTotal: total,
          purchaseKey,
          date: toDateString(addMonths(parseISO(input.close_date), cycleOffset)),
        })
      }
    } else {
      expanded.push({ cycleOffset: 0, kind, line, date: line.date })
    }
  }
  return expanded
}

/**
 * Función pura: arma el payload que espera la RPC import_card_statement a
 * partir del resumen revisado por el usuario. Excluye las líneas
 * deseleccionadas; las líneas simples/suscripción van a `lines` (con
 * create_recurring cuando el usuario confirmó el toggle, sin importar si la
 * IA la clasificó como suscripción o no); las líneas en cuotas se
 * reconstruyen como `installment_purchases`, proyectando desde la cuota
 * leída hasta la última (Tareas 3.1-3.2).
 *
 * "USD puro" (ver resolveConversion): una línea cross-currency siempre queda
 * con converted_amount null, ignorando `amount_ars` del PDF — no lanza, no
 * requiere cotización manual.
 */
export function buildStatementPayload(input: BuildStatementPayloadInput): StatementImportPayload {
  const expanded = expandReviewLines(input)

  const lines: StatementImportPayloadLine[] = expanded
    .filter((e) => e.kind !== "installment")
    .map((e) => {
      const { converted_amount, dollar_type } = resolveConversion(e.line, input.account_currency)
      const create_recurring =
        e.line.createRecurring === true
          ? {
              day_of_month: dayOfMonthFromISODate(e.line.date),
              subscription_key: buildSubscriptionKey(e.line.description, input.account_id),
            }
          : null
      return {
        date: e.line.date,
        amount: e.line.amount,
        original_currency: e.line.currency,
        converted_amount,
        dollar_type,
        category_id: e.line.category_id,
        note: e.line.description,
        create_recurring,
        is_refund: e.line.is_refund === true,
        settles_previous: e.line.settles_previous === true,
      }
    })

  const purchasesByKey = new Map<string, StatementImportPayloadPurchase>()
  for (const e of expanded) {
    if (e.kind !== "installment") continue
    const { converted_amount, dollar_type } = resolveConversion(e.line, input.account_currency)

    let purchase = purchasesByKey.get(e.purchaseKey!)
    if (!purchase) {
      purchase = {
        purchase_key: e.purchaseKey!,
        description: e.line.description,
        // Cuota fija (D3): el total es aproximado (cuota leída × total de cuotas).
        total_amount: Math.round(e.line.amount * e.installmentTotal! * 100) / 100,
        installments_count: e.installmentTotal!,
        start_date: e.line.date,
        currency: e.line.currency,
        category_id: e.line.category_id,
        dollar_type,
        note: null,
        installments: [],
      }
      purchasesByKey.set(e.purchaseKey!, purchase)
    }

    purchase.installments.push({
      installment_number: e.installmentNumber!,
      installment_total: e.installmentTotal!,
      date: e.date,
      amount: e.line.amount,
      original_currency: e.line.currency,
      converted_amount,
      dollar_type,
      category_id: e.line.category_id,
      note: null,
    })
  }

  return {
    account_id: input.account_id,
    close_date: input.close_date,
    due_date: input.due_date,
    total_amount: input.total_amount,
    total_amount_usd: input.total_amount_usd,
    stamp_tax: input.stamp_tax,
    lines,
    installment_purchases: Array.from(purchasesByKey.values()),
  }
}

// ── Preview agrupada por resumen/ciclo (Tarea 3.3) ───────────────────────────

export interface StatementPreviewLine {
  kind: "simple" | "subscription" | "installment"
  description: string
  date: string
  amount: number
  currency: "ARS" | "USD"
  category_id: string | null
  /** Sólo para kind "installment". */
  installment_number?: number
  installment_total?: number
  purchase_key?: string
  /**
   * true si es una devolución/reintegro (ver StatementReviewLine.is_refund):
   * resta del subtotal del grupo en vez de sumar (mismo neteo que cards.ts
   * aplica sobre los movimientos guardados). Nunca aplica a una cuota.
   */
  is_refund?: boolean
  /**
   * true si esta fila es una proyección informativa de una recurrente
   * confirmada (`createRecurring`) mostrada en un ciclo futuro para
   * visualizar cómo va a quedar el resumen. NO se persiste en el import (el
   * cron de recurrentes la genera sola cada mes): incluirla en
   * buildStatementPayload la duplicaría. No cuenta como "ítem a crear".
   */
  projectedRecurring?: true
}

export interface StatementPreviewGroup {
  /** 0 = el resumen leído (close_date/due_date reales); N>0 = el N-ésimo ciclo futuro proyectado. */
  cycleOffset: number
  closeDate: string
  dueDate: string
  lines: StatementPreviewLine[]
  /**
   * Subtotal por moneda (ARS/USD), sumado con el monto original de cada línea
   * (sin convertir) — mismo criterio que el pago de resúmenes reales (ver
   * `listCardCycles` en `@/lib/cards`), para no mezclar montos de distinta
   * moneda en un único número sin sentido. Los reintegros (`is_refund`) restan
   * en vez de sumar, igual que `signedAmount` en `@/lib/cards`.
   */
  totalsByCurrency: { ARS: number; USD: number }
}

/**
 * Agrupa las líneas seleccionadas por resumen/ciclo (Tarea 3.3): el ciclo
 * leído (offset 0) más un grupo por cada ciclo futuro que reciba cuotas
 * proyectadas, para que el Grupo 4 la muestre y permita aprobar resumen por
 * resumen. Los ciclos futuros son siempre mensuales (un mes por ciclo,
 * consistente con la proyección de cuotas), así que su período se deriva
 * sumando N meses a close_date/due_date del resumen leído.
 *
 * Además, cada línea con `createRecurring === true` recibe una fila
 * `projectedRecurring` (solo visual) en los ciclos futuros ya generados por
 * cuotas, o en el ciclo siguiente si no hay ninguno — así el usuario ve cómo
 * va a quedar el próximo resumen. Es puramente informativo: no se persiste
 * (buildStatementPayload no la reusa) y no suma al subtotal del grupo.
 */
export function groupStatementPreviewByCycle(input: BuildStatementPayloadInput): StatementPreviewGroup[] {
  const expanded = expandReviewLines(input)
  const byOffset = new Map<number, StatementPreviewLine[]>()

  for (const e of expanded) {
    const list = byOffset.get(e.cycleOffset) ?? []
    list.push({
      kind: e.kind,
      description: e.line.description,
      date: e.date,
      amount: e.line.amount,
      currency: e.line.currency,
      category_id: e.line.category_id,
      installment_number: e.installmentNumber,
      installment_total: e.installmentTotal,
      purchase_key: e.purchaseKey,
      is_refund: e.line.is_refund === true,
    })
    byOffset.set(e.cycleOffset, list)
  }

  const recurringLines = input.lines.filter(
    (l) => l.selected && l.createRecurring === true && classifyLine(l) !== "installment"
  )
  if (recurringLines.length > 0) {
    const existingFutureOffsets = Array.from(byOffset.keys())
      .filter((o) => o > 0)
      .sort((a, b) => a - b)
    const targetOffsets = existingFutureOffsets.length > 0 ? existingFutureOffsets : [1]
    for (const offset of targetOffsets) {
      const list = byOffset.get(offset) ?? []
      for (const line of recurringLines) {
        list.push({
          kind: classifyLine(line) === "subscription" ? "subscription" : "simple",
          description: line.description,
          date: toDateString(addMonths(parseISO(line.date), offset)),
          amount: line.amount,
          currency: line.currency,
          category_id: line.category_id,
          projectedRecurring: true,
        })
      }
      byOffset.set(offset, list)
    }
  }

  return Array.from(byOffset.keys())
    .sort((a, b) => a - b)
    .map((offset) => {
      const groupLines = byOffset.get(offset)!
      const closeDate =
        offset === 0 ? input.close_date : toDateString(addMonths(parseISO(input.close_date), offset))
      const dueDate = offset === 0 ? input.due_date : toDateString(addMonths(parseISO(input.due_date), offset))
      const totalsByCurrency = { ARS: 0, USD: 0 }
      for (const l of groupLines) {
        if (l.projectedRecurring) continue
        // Mismo neteo que signedAmount en cards.ts: un reintegro resta.
        totalsByCurrency[l.currency] += l.is_refund ? -l.amount : l.amount
      }
      totalsByCurrency.ARS = Math.round(totalsByCurrency.ARS * 100) / 100
      totalsByCurrency.USD = Math.round(totalsByCurrency.USD * 100) / 100

      return {
        cycleOffset: offset,
        closeDate,
        dueDate,
        lines: groupLines,
        totalsByCurrency,
      }
    })
}

// ── Chequeo de suma opcional (Tarea 3.5) ─────────────────────────────────────

export interface UpcomingInstallmentsCheck {
  expectedTotal: number
  projectedTotal: number
  matches: boolean
  /** projectedTotal - expectedTotal */
  difference: number
}

/**
 * Chequeo de suma opcional: compara la suma de las cuotas proyectadas hacia
 * ciclos futuros ("a vencer", cycleOffset > 0 — no incluye la cuota del
 * ciclo leído) contra el total que a veces trae el PDF en una tabla agregada
 * de cuotas a vencer. Es sólo una validación/warning para la UI — nunca se
 * usa como fuente del monto de cada cuota (D3: el monto siempre es el de la
 * cuota leída). `expectedTotal` es opcional porque el extractor de IA no
 * expone hoy ese dato del PDF; si no viene, no hay nada que chequear.
 */
export function checkUpcomingInstallmentsTotal(
  input: BuildStatementPayloadInput,
  expectedTotal: number | null | undefined
): UpcomingInstallmentsCheck | null {
  if (expectedTotal == null) return null

  const projectedTotal =
    Math.round(
      expandReviewLines(input)
        .filter((e) => e.kind === "installment" && e.cycleOffset > 0)
        .reduce((sum, e) => sum + e.line.amount, 0) * 100
    ) / 100
  const difference = Math.round((projectedTotal - expectedTotal) * 100) / 100

  return { expectedTotal, projectedTotal, matches: difference === 0, difference }
}

// ── saveImportedStatement ────────────────────────────────────────────────────

export interface SaveImportedStatementResult {
  statement_id: string
  movements_created: number
  /** Bajas aplicadas por "Corroborar con IA" (payload.deletions, migración 0059). Ausente en RPCs viejas. */
  movements_deleted?: number
  /** Correcciones de importe aplicadas (payload.amount_updates, migración 0059). Ausente en RPCs viejas. */
  movements_updated?: number
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
