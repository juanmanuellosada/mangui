import {
  addMonths,
  subMonths,
  subDays,
  getDaysInMonth,
  parseISO,
  isAfter,
  isBefore,
  isEqual,
  startOfDay,
  addDays,
  format,
} from "date-fns"
import { es } from "date-fns/locale"
import { amountInCurrency } from "@/lib/money"
import { normalizeNote, extractKeyword } from "@/lib/rules"

// Minimal shape needed by nextCardPayment — avoids importing full DB types here.
interface CardPaymentAccount {
  closing_date: string | null
  due_date?: string | null
  currency: string
}

/**
 * Extracts the day-of-month (1-31) from a stored closing_date/due_date.
 * The cycle repeats monthly anchored on that day — only the day matters
 * for projecting other months (nextCloseDate/computeDueDate/currentCycleRange
 * below), the month/year of the anchor date itself is irrelevant.
 */
export function dayOfMonth(dateStr: string): number {
  return parseISO(dateStr).getDate()
}

interface CardPaymentStatement {
  account_id: string
  total_amount: number
  total_amount_usd: number
  due_date: string
  close_date: string
}

interface CardPaymentMovement {
  account_id: string
  type: string
  date: string
  amount: number
  converted_amount?: number | null
  original_currency?: string | null
}

/**
 * Suma un movimiento hacia la moneda de la cuenta (amountInCurrency de
 * @/lib/money), con original_currency ausente asumido igual a la cuenta
 * (movimientos legacy sin el campo cargado).
 */
function towardAccountCurrency(
  m: { amount: number; converted_amount?: number | null; original_currency?: string | null },
  accountCurrency: string
): number {
  return amountInCurrency(
    {
      amount: m.amount,
      converted_amount: m.converted_amount ?? null,
      original_currency: m.original_currency ?? accountCurrency,
    },
    accountCurrency
  )
}

/**
 * Si el movimiento fue importado a un resumen (`import_statement_id`),
 * pertenece al ciclo de ESE resumen (su close_date), no al que su propia
 * fecha proyectaría — el corte real del banco puede incluir un consumo
 * fechado unos días antes del cierre que calcula la app (mismo criterio que
 * `targetCloseDate` en `listCardCycles`, Tarea 0054). Devuelve null si el
 * movimiento no fue importado o si el resumen referenciado no es de esta
 * cuenta.
 */
function importedStatementCloseDate(
  m: { import_statement_id?: string | null },
  accountId: string,
  statementsById: Map<string, { account_id: string; close_date: string }>
): string | null {
  if (!m.import_statement_id) return null
  const stmt = statementsById.get(m.import_statement_id)
  if (stmt == null || stmt.account_id !== accountId) return null
  return stmt.close_date
}

/**
 * Signo neto de un movimiento hacia el total de un ciclo/resumen: un gasto
 * (`expense`) suma, una devolución/reintegro (`income`, ver is_refund en el
 * import de resúmenes) resta — así el total cuadra con el TOTAL A PAGAR real
 * del resumen, que ya netea la devolución.
 */
function signedAmount(type: string, amount: number): number {
  return type === "income" ? -amount : amount
}

/**
 * Returns the next card payment details for a given credit card account.
 * "A pagar" = the already-closed statement with the nearest due date.
 *
 * Logic:
 *  1. Look for the earliest pending statement with close_date <= ref (already closed).
 *  2. If none, sum the last closed cycle's movements as a fallback (expenses
 *     minus refunds — no import_statement_id grouping needed here, see comment
 *     inline: any statement that would qualify is already caught by step 1).
 *
 * @param accountId   The account's UUID.
 * @param account     The account row (needs closing_date / due_date).
 * @param statements  All pending card_statements (pre-filtered to "pendiente").
 * @param movements   All movements (e.g. from fetchAllMovements).
 * @param ref         Optional reference date (defaults to today).
 * @returns           { amount: number (positive, in the card's native currency),
 *                      dueDate: string | null (ISO date),
 *                      amountUSD: number (subtotal nativo en USD del mismo
 *                      ciclo/resumen, sin conversión — 0 si no hay consumos
 *                      en dólares) }
 */
export function nextCardPayment(
  accountId: string,
  account: CardPaymentAccount,
  statements: CardPaymentStatement[],
  movements: CardPaymentMovement[],
  ref?: Date
): { amount: number; dueDate: string | null; amountUSD: number } {
  const refDate = startOfDay(ref ?? new Date())
  const refStr = toDateString(refDate)

  // 1. Nearest pending statement that has already closed (close_date <= today)
  const closedPending = statements
    .filter((s) => s.account_id === accountId && s.close_date <= refStr)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null

  if (closedPending) {
    return {
      amount: closedPending.total_amount,
      dueDate: closedPending.due_date,
      amountUSD: closedPending.total_amount_usd,
    }
  }

  // 2. Fallback: sum the last CLOSED cycle from movements (not the open cycle)
  const closingDate = account.closing_date
  if (closingDate == null) {
    return { amount: 0, dueDate: null, amountUSD: 0 }
  }
  const closingDay = dayOfMonth(closingDate)

  // Determine the last closed cycle: go one day before the current open cycle start
  const open = currentCycleRange(closingDay, refDate)
  const prevRef = subDays(open.cycleStart, 1)
  const closed = currentCycleRange(closingDay, prevRef)

  // No se aplica acá el agrupamiento por import_statement_id (ver
  // importedStatementCloseDate/listCardCycles): cualquier resumen cuyo
  // close_date coincidiera con el de este ciclo cerrado (closedCloseDateStr,
  // siempre <= refStr) también cumpliría el filtro de closedPending arriba
  // (close_date <= refStr) y ya habría sido devuelto por la rama 1 — la
  // rama 1 intercepta siempre antes de llegar acá, así que agrupar por
  // import_statement_id en este fallback sería código inalcanzable.
  const closedTotal = movements
    .filter(
      (m) =>
        m.account_id === accountId &&
        (m.type === "expense" || m.type === "income") &&
        isInCycle(m.date, closed.cycleStart, closed.cycleEnd)
    )
    .reduce((sum, m) => sum + signedAmount(m.type, towardAccountCurrency(m, account.currency)), 0)

  // Subtotal nativo en USD del mismo ciclo (monto original, sin conversión —
  // mismo criterio que totalsByCurrency en listCardCycles).
  const closedTotalUSD = movements
    .filter(
      (m) =>
        m.account_id === accountId &&
        (m.type === "expense" || m.type === "income") &&
        m.original_currency === "USD" &&
        isInCycle(m.date, closed.cycleStart, closed.cycleEnd)
    )
    .reduce((sum, m) => sum + signedAmount(m.type, m.amount), 0)

  const dueDay = account.due_date != null ? dayOfMonth(account.due_date) : null
  // The due date shown must match the cycle whose amount we're showing
  // (closedTotal, from the last CLOSED cycle). If that due date hasn't
  // passed yet, show it — only roll to the open cycle's due date once
  // the closed cycle's payment is actually overdue.
  const dueDate =
    dueDay != null
      ? (() => {
          const closedDueDate = computeDueDate(closed.cycleEnd, dueDay, closingDay)
          const dueDateToShow = isBefore(closedDueDate, refDate)
            ? computeDueDate(open.cycleEnd, dueDay, closingDay)
            : closedDueDate
          return toDateString(dueDateToShow)
        })()
      : null

  return { amount: closedTotal, dueDate, amountUSD: closedTotalUSD }
}

/**
 * Returns the current open cycle summary for a credit card account.
 * "Resumen en curso" = the cycle that is still accumulating (not yet closed).
 *
 * @param accountId   The account's UUID.
 * @param account     The account row (needs closing_date / due_date).
 * @param movements   All movements for this account (expense and income/refund types).
 * @param ref         Optional reference date (defaults to today).
 * @returns           { amount, closeDate, dueDate } — ISO strings or null.
 */
export function currentCycleSummary(
  accountId: string,
  account: CardPaymentAccount,
  movements: CardPaymentMovement[],
  ref?: Date
): { amount: number; closeDate: string | null; dueDate: string | null } {
  const closingDate = account.closing_date
  if (closingDate == null) {
    return { amount: 0, closeDate: null, dueDate: null }
  }
  const closingDay = dayOfMonth(closingDate)

  const refDate = ref ?? new Date()
  const { cycleStart, cycleEnd } = currentCycleRange(closingDay, refDate)

  // No se aplica acá el agrupamiento por import_statement_id (ver
  // importedStatementCloseDate/listCardCycles): este ciclo está ABIERTO
  // (todavía acumulando), y un movimiento sólo lleva import_statement_id
  // después de importarse el resumen de un ciclo ya CERRADO — en la práctica
  // nunca hay un resumen importado apuntando al ciclo en curso, así que
  // agrupar siempre por fecha es equivalente y evita sumar un parámetro
  // `statements` a esta función y a sus dos llamadores (cron routes).
  const amount = movements
    .filter(
      (m) =>
        m.account_id === accountId &&
        (m.type === "expense" || m.type === "income") &&
        isInCycle(m.date, cycleStart, cycleEnd)
    )
    .reduce((sum, m) => sum + signedAmount(m.type, towardAccountCurrency(m, account.currency)), 0)

  const closeDate = toDateString(cycleEnd)

  const dueDay = account.due_date != null ? dayOfMonth(account.due_date) : null
  const dueDate =
    dueDay != null
      ? toDateString(computeDueDate(cycleEnd, dueDay, closingDay))
      : null

  return { amount, closeDate, dueDate }
}

/**
 * Clamp a day-of-month to the actual number of days in the given month.
 * e.g. day=31 for February → 28/29.
 */
function clampDayToMonth(year: number, month: number, day: number): number {
  const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1))
  return Math.min(day, daysInMonth)
}

/**
 * Returns the next closing date for a credit card given its closing_day.
 * "Next" means today or later. We compute the closest upcoming close date.
 *
 * @param closingDay  The day-of-month on which the card closes (1-31).
 * @param ref         Reference date (defaults to today).
 */
export function nextCloseDate(closingDay: number, ref: Date = new Date()): Date {
  const today = startOfDay(ref)
  const y = today.getFullYear()
  const m = today.getMonth() + 1 // 1-based

  // Try this month's close date
  const thisMonthDay = clampDayToMonth(y, m, closingDay)
  const thisMonthClose = startOfDay(new Date(y, m - 1, thisMonthDay))

  if (!isBefore(thisMonthClose, today)) {
    // This month's close is today or future
    return thisMonthClose
  }

  // Otherwise, next month
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  const nextMonthDay = clampDayToMonth(nextY, nextM, closingDay)
  return startOfDay(new Date(nextY, nextM - 1, nextMonthDay))
}

/**
 * Returns the previous closing date for a credit card given its closing_day.
 * "Previous" means strictly before today.
 */
export function previousCloseDate(closingDay: number, ref: Date = new Date()): Date {
  const today = startOfDay(ref)
  const y = today.getFullYear()
  const m = today.getMonth() + 1

  // Try this month's close date
  const thisMonthDay = clampDayToMonth(y, m, closingDay)
  const thisMonthClose = startOfDay(new Date(y, m - 1, thisMonthDay))

  if (isBefore(thisMonthClose, today)) {
    return thisMonthClose
  }

  // Otherwise last month's close
  const prevM = m === 1 ? 12 : m - 1
  const prevY = m === 1 ? y - 1 : y
  const prevDay = clampDayToMonth(prevY, prevM, closingDay)
  return startOfDay(new Date(prevY, prevM - 1, prevDay))
}

/**
 * Returns the due date for a given close date, given the card's due_day.
 * Due date is always after the close date, in the following month if due_day ≤ closing_day.
 *
 * Rule: If due_day > closing_day, due date is in the same month as close.
 *       If due_day ≤ closing_day, due date is in the month after close.
 *
 * @param closeDate   The closing date as a Date object.
 * @param dueDay      The day-of-month on which payment is due (1-31).
 * @param closingDay  The card's closing_day.
 */
export function computeDueDate(closeDate: Date, dueDay: number, closingDay: number): Date {
  const cm = closeDate.getMonth() + 1
  const cy = closeDate.getFullYear()

  let dueM: number
  let dueY: number

  if (dueDay > closingDay) {
    // Same month as close
    dueM = cm
    dueY = cy
  } else {
    // Following month
    dueM = cm === 12 ? 1 : cm + 1
    dueY = cm === 12 ? cy + 1 : cy
  }

  const clamped = clampDayToMonth(dueY, dueM, dueDay)
  return startOfDay(new Date(dueY, dueM - 1, clamped))
}

/**
 * Returns the date range for the current open cycle:
 * from: day after previous close (exclusive lower bound for filtering, but we use > in queries)
 * to: next close date (inclusive)
 */
export function currentCycleRange(
  closingDay: number,
  ref: Date = new Date()
): { cycleStart: Date; cycleEnd: Date } {
  const cycleEnd = nextCloseDate(closingDay, ref)
  const prevClose = previousCloseDate(closingDay, ref)

  // Cycle start: day after previous close
  const cycleStart = new Date(prevClose)
  cycleStart.setDate(prevClose.getDate() + 1)

  return { cycleStart, cycleEnd }
}

/**
 * Convert a Date to ISO date string (YYYY-MM-DD).
 */
export function toDateString(d: Date): string {
  return d.toISOString().split("T")[0]
}

/**
 * Check if a date string falls within an inclusive date range.
 */
export function isInCycle(dateStr: string, cycleStart: Date, cycleEnd: Date): boolean {
  const d = startOfDay(parseISO(dateStr))
  const s = startOfDay(cycleStart)
  const e = startOfDay(cycleEnd)
  return !isBefore(d, s) && !isAfter(d, e)
}

/**
 * Returns the month+year label for a billing cycle, matching the format
 * shown in the statements navigator (e.g. "junio 2026").
 * Derived from the cycle's close date, exactly as displayed in cards-list.tsx.
 */
export function formatStatementLabel(closeDate: Date): string {
  return format(closeDate, "MMMM yyyy", { locale: es })
}

// ── listCardCycles ─────────────────────────────────────────────────────────────

// Minimal shapes for listCardCycles inputs — subsets of the DB row types.
interface CycleAccount {
  closing_date: string | null
  due_date?: string | null
  currency: string
}

interface CycleMovement {
  id: string
  account_id: string
  type: string
  date: string
  amount: number
  converted_amount?: number | null
  original_currency?: string | null
  /** Statement this movement was imported into (`card_statements.id`), if any. */
  import_statement_id?: string | null
}

/** Recurrente de tarjeta activa (recurring_transactions con is_card_recurring=true, status='active'), ya filtrada a esta cuenta por el caller. */
export interface CardRecurring {
  id: string
  amount: number
  currency: "ARS" | "USD"
  note: string | null
  day_of_month: number | null
  category_id: string | null
}

/**
 * Ocurrencia VIRTUAL de una recurrente proyectada en un ciclo futuro (solo
 * display — el cron de recurrentes crea el movimiento real cuando llega la
 * fecha). Ver `projectRecurringsForCycle`.
 */
export interface CardCycleProjectedRecurring {
  isProjectedRecurring: true
  id: string
  recurringId: string
  date: string
  amount: number
  currency: "ARS" | "USD"
  note: string | null
  category_id: string | null
}

/**
 * Clave de comercio normalizado de una nota (mismo criterio que
 * normalizeMerchant en statement-import.ts / subscription_key): usada para
 * matchear una recurrente contra un movimiento real por comercio.
 */
function recurringMerchantKey(note: string | null): string {
  const normalized = normalizeNote(note ?? "")
  return extractKeyword(normalized) ?? normalized
}

/**
 * true si un movimiento (por comercio normalizado + moneda) matchea alguna
 * recurrente de tarjeta activa. Usado tanto para el dedup de la proyección
 * (no proyectar en un ciclo que ya tiene el consumo real) como para el badge
 * "Recurrente" sobre movimientos reales ya cargados (cards-list.tsx).
 */
export function matchesCardRecurring(
  m: { note?: string | null; original_currency?: string | null },
  recurrings: CardRecurring[]
): boolean {
  const key = recurringMerchantKey(m.note ?? null)
  if (key === "") return false
  const currency = m.original_currency === "USD" ? "USD" : "ARS"
  return recurrings.some((r) => r.currency === currency && recurringMerchantKey(r.note) === key)
}

/**
 * Proyecta una ocurrencia virtual por recurrente activa en un ciclo futuro
 * (cycleEnd > today) — salvo que el ciclo ya tenga un movimiento real de esa
 * misma recurrente (dedup por comercio+moneda, ver matchesCardRecurring). La
 * fecha se ancla en day_of_month, clampeado al mes del cierre del ciclo.
 */
function projectRecurringsForCycle(
  cycleEnd: Date,
  netMovements: { note?: string | null; original_currency?: string | null }[],
  recurrings: CardRecurring[],
  today: Date
): CardCycleProjectedRecurring[] {
  if (recurrings.length === 0 || !isAfter(cycleEnd, today)) return []

  const y = cycleEnd.getFullYear()
  const m = cycleEnd.getMonth() + 1

  return recurrings
    .filter((r) => !netMovements.some((mv) => matchesCardRecurring(mv, [r])))
    .map((r) => {
      const day = clampDayToMonth(y, m, r.day_of_month ?? cycleEnd.getDate())
      return {
        isProjectedRecurring: true as const,
        id: `projected-recurring-${r.id}-${toDateString(cycleEnd)}`,
        recurringId: r.id,
        date: toDateString(startOfDay(new Date(y, m - 1, day))),
        amount: r.amount,
        currency: r.currency,
        note: r.note,
        category_id: r.category_id,
      }
    })
}

interface CycleStatement {
  id: string
  account_id: string
  close_date: string
  due_date: string
  status: string
  total_amount: number
  total_amount_usd: number
  stamp_tax: number
  paid_amount: number | null
  paid_amount_usd: number | null
  paid_date: string | null
  paid_from_account_id: string | null
  paid_from_account_id_usd: string | null
}

export interface CardCycle {
  /** ISO date string of the cycle's closing date */
  closeDate: string
  /** ISO date string of the payment due date (null if card has no due_day) */
  dueDate: string | null
  /** Inclusive start of the cycle (day after the previous close) */
  cycleStart: Date
  /** Inclusive end of the cycle (the close date itself) */
  cycleEnd: Date
  /** Movements whose date falls within this cycle */
  movements: CycleMovement[]
  /**
   * Ocurrencias virtuales de recurrentes de tarjeta activas proyectadas en
   * este ciclo (solo si cycleEnd > today) — ver `projectRecurringsForCycle`.
   * Vacío cuando no se pasó `recurrings` a listCardCycles. Ya están
   * deduplicadas contra movimientos reales del ciclo y sumadas en `total` /
   * `totalsByCurrency`.
   */
  projectedRecurrings: CardCycleProjectedRecurring[]
  /**
   * Suma en la moneda de la cuenta (amountInCurrency de @/lib/money) de los
   * gastos del ciclo MENOS las devoluciones/reintegros (is_refund, cargados
   * como type='income') — un gasto USD sin converted_amount ("USD puro") no
   * se cuenta acá, aparece aparte en totalsByCurrency. Incluye las
   * proyecciones de recurrentes (`projectedRecurrings`). Total autocalculado;
   * para ciclos pagados preferir statement.total_amount.
   */
  total: number
  /**
   * Per-currency subtotals computed from expense movements minus refunds
   * (type='income'), grouped by original_currency and summed using the
   * ORIGINAL amount (not converted_amount). Incluye las proyecciones de
   * recurrentes. Zero when the currency has no movements in the cycle.
   */
  totalsByCurrency: { ARS: number; USD: number }
  /**
   * The matching card_statements row, if a payment has been registered for
   * this cycle. null when the cycle is virtual (not yet paid).
   */
  statement: CycleStatement | null
}

/**
 * Returns the ordered list of billing cycles for a credit-card account.
 *
 * Order: oldest → newest (chronological). The UI defaults the selected
 * index to the current open cycle (the last element whose cycleEnd >= today
 * or simply the last element when all cycles are in the past).
 *
 * Range covered:
 *  - From the cycle that contains the earliest movement for this account.
 *  - Up to the current open cycle (always included, even if empty).
 *  - Plus any future cycles that contain at least one movement (installments
 *    landing in the future).
 *
 * @param accountId   The credit-card account's UUID.
 * @param account     The account row (needs closing_date / due_date).
 * @param movements   All movements for the user (filtered internally to this account).
 * @param statements  All card_statements for this account (may be a superset).
 * @param ref         Optional reference date for "today" (defaults to now).
 * @param recurrings  Recurrentes de tarjeta activas de esta cuenta (is_card_recurring=true,
 *                     status='active'), proyectadas como ocurrencias virtuales en los ciclos
 *                     futuros (ver CardCycle.projectedRecurrings). Opcional, default [].
 */
export function listCardCycles(
  accountId: string,
  account: CycleAccount,
  movements: CycleMovement[],
  statements: CycleStatement[],
  ref?: Date,
  recurrings: CardRecurring[] = []
): CardCycle[] {
  const closingDate = account.closing_date
  if (closingDate == null) return []
  const closingDay = dayOfMonth(closingDate)
  const dueDay = account.due_date != null ? dayOfMonth(account.due_date) : null

  const today = startOfDay(ref ?? new Date())

  // Filter movements belonging to this account
  const accountMovements = movements.filter((m) => m.account_id === accountId)

  if (accountMovements.length === 0) {
    // No movements: return only the current open cycle (empty, salvo recurrentes proyectadas)
    const { cycleStart, cycleEnd } = currentCycleRange(closingDay, today)
    const dueDate =
      dueDay != null ? toDateString(computeDueDate(cycleEnd, dueDay, closingDay)) : null
    const stmt = statements.find(
      (s) => s.account_id === accountId && s.close_date === toDateString(cycleEnd)
    ) ?? null
    const projectedRecurrings = projectRecurringsForCycle(cycleEnd, [], recurrings, today)
    const totalsByCurrency = { ARS: 0, USD: 0 }
    for (const p of projectedRecurrings) totalsByCurrency[p.currency] += p.amount
    const total = projectedRecurrings.reduce(
      (sum, p) => sum + towardAccountCurrency({ amount: p.amount, converted_amount: null, original_currency: p.currency }, account.currency),
      0
    )
    return [{ closeDate: toDateString(cycleEnd), dueDate, cycleStart, cycleEnd, movements: [], projectedRecurrings, total, totalsByCurrency, statement: stmt }]
  }

  // Lookup usado tanto para el ciclo más viejo (abajo) como para el
  // agrupamiento por resumen más adelante (targetCloseDate).
  const statementsById = new Map(statements.map((s) => [s.id, s]))

  // Fecha "efectiva" de un movimiento para determinar a qué ciclo pertenece:
  // si fue importado a un resumen, el close_date de ESE resumen (igual que
  // targetCloseDate más abajo); si no, su propia fecha. Evita crear un ciclo
  // vacío antes del primero real cuando el movimiento más viejo por fecha en
  // realidad quedó agrupado en un resumen posterior (ver Tarea Bug 3).
  function effectiveDate(m: CycleMovement): string {
    return importedStatementCloseDate(m, accountId, statementsById) ?? m.date
  }

  // Find the oldest EFFECTIVE date to determine the earliest cycle
  const oldestDate = accountMovements
    .map((m) => effectiveDate(m))
    .sort()[0]

  // Build the cycle that contains the oldest movement
  const oldestMovementDate = startOfDay(parseISO(oldestDate))
  const firstCycleRange = currentCycleRange(closingDay, oldestMovementDate)
  let cursor = firstCycleRange.cycleEnd // we'll walk forward from here

  // Find the latest date we need to cover:
  //   max(today, latest future movement date)
  const latestMovementDate = accountMovements
    .map((m) => startOfDay(parseISO(m.date)))
    .reduce((latest, d) => (isAfter(d, latest) ? d : latest), today)

  // The walk must always reach at least the cycle containing the oldest
  // movement (firstCycleRange.cycleEnd) — if that cycle hasn't closed yet
  // relative to "today" (e.g. the oldest movement is the only one and it's
  // still within the current open cycle), latestMovementDate alone could be
  // before it, which would make the loop below exit before its first
  // iteration and return an empty cycle list.
  const coverageEnd = isAfter(firstCycleRange.cycleEnd, latestMovementDate)
    ? firstCycleRange.cycleEnd
    : latestMovementDate

  // First pass: compute cycle boundaries only (no movement assignment yet) —
  // needed up front so imported movements can be matched against the full
  // set of close dates the walk will produce (see targetCloseDate below).
  const bounds: { cycleStart: Date; cycleEnd: Date; closeDateStr: string }[] = []
  while (!isAfter(cursor, coverageEnd)) {
    const cycleEnd = cursor
    // cycleStart = day after previous close
    const prevClose = new Date(cycleEnd)
    prevClose.setMonth(prevClose.getMonth() - 1)
    // clamp previous close to valid day
    const prevCloseClamped = startOfDay(new Date(
      prevClose.getFullYear(),
      prevClose.getMonth(),
      Math.min(closingDay, getDaysInMonth(prevClose))
    ))
    const cycleStart = addDays(prevCloseClamped, 1)
    bounds.push({ cycleStart, cycleEnd, closeDateStr: toDateString(cycleEnd) })

    // Advance to the next cycle end: same day next month (clamped)
    const nextCycleEndRaw = addMonths(cycleEnd, 1)
    const nextY = nextCycleEndRaw.getFullYear()
    const nextM = nextCycleEndRaw.getMonth() + 1
    cursor = startOfDay(new Date(nextY, nextM - 1, Math.min(closingDay, getDaysInMonth(new Date(nextY, nextM - 1)))))
  }

  // A movement imported into a statement (`import_statement_id` set) belongs
  // to that statement's cycle (its close_date), not to whichever cycle its
  // own date would fall into — the bank's real cut-off can include a
  // purchase dated a few days before the app's computed close date. The
  // movement's own date is never changed, only which cycle it's grouped
  // into. Falls back to date-based grouping when the statement isn't found
  // or its close_date isn't among the cycles just built.
  const closeDatesInRange = new Set(bounds.map((b) => b.closeDateStr))

  function targetCloseDate(m: CycleMovement): string | null {
    const closeDate = importedStatementCloseDate(m, accountId, statementsById)
    return closeDate != null && closeDatesInRange.has(closeDate) ? closeDate : null
  }

  const cycles: CardCycle[] = bounds.map(({ cycleStart, cycleEnd, closeDateStr }) => {
    const cycleMovements = accountMovements.filter((m) => {
      const forced = targetCloseDate(m)
      return forced != null ? forced === closeDateStr : isInCycle(m.date, cycleStart, cycleEnd)
    })

    // Gastos y devoluciones/reintegros (is_refund, cargados como type='income')
    // del ciclo — el total y los subtotales por moneda restan los reintegros
    // para cuadrar con el TOTAL A PAGAR real del resumen (ver signedAmount).
    const netMovements = cycleMovements.filter((m) => m.type === "expense" || m.type === "income")

    const projectedRecurrings = projectRecurringsForCycle(cycleEnd, netMovements, recurrings, today)

    const total =
      netMovements.reduce((sum, m) => sum + signedAmount(m.type, towardAccountCurrency(m, account.currency)), 0) +
      projectedRecurrings.reduce(
        (sum, p) => sum + towardAccountCurrency({ amount: p.amount, converted_amount: null, original_currency: p.currency }, account.currency),
        0
      )

    const totalsByCurrency: { ARS: number; USD: number } = { ARS: 0, USD: 0 }
    for (const m of netMovements) {
      const cur = m.original_currency === "USD" ? "USD" : "ARS"
      totalsByCurrency[cur] += signedAmount(m.type, m.amount)
    }
    for (const p of projectedRecurrings) {
      totalsByCurrency[p.currency] += p.amount
    }

    const dueDate =
      dueDay != null ? toDateString(computeDueDate(cycleEnd, dueDay, closingDay)) : null

    const stmt =
      statements.find(
        (s) => s.account_id === accountId && s.close_date === closeDateStr
      ) ?? null

    return { closeDate: closeDateStr, dueDate, cycleStart, cycleEnd, movements: cycleMovements, projectedRecurrings, total, totalsByCurrency, statement: stmt }
  })

  return cycles
}

/**
 * Índice dentro de `cycles` (ordenados de más viejo a más nuevo) que debe
 * mostrarse por default al abrir el detalle de una tarjeta: el "A pagar" —
 * el ciclo ya cerrado más reciente que todavía no fue pagado. Si no hay
 * ninguno pendiente (todos pagados, o ningún ciclo cerró todavía), cae al
 * ciclo en curso.
 */
export function defaultCycleIndex(cycles: CardCycle[], ref?: Date): number {
  if (cycles.length === 0) return 0
  const todayStr = toDateString(startOfDay(ref ?? new Date()))
  for (let i = cycles.length - 1; i >= 0; i--) {
    const c = cycles[i]
    const isPaid = c.statement?.status === "pagado"
    if (toDateString(c.cycleEnd) <= todayStr && !isPaid) return i
  }
  const openIndex = cycles.findIndex((c) => toDateString(c.cycleEnd) > todayStr)
  return openIndex !== -1 ? openIndex : cycles.length - 1
}
