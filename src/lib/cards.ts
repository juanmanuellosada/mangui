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
 * Returns the next card payment details for a given credit card account.
 * "A pagar" = the already-closed statement with the nearest due date.
 *
 * Logic:
 *  1. Look for the earliest pending statement with close_date <= ref (already closed).
 *  2. If none, sum the last closed cycle's expense movements as a fallback.
 *
 * @param accountId   The account's UUID.
 * @param account     The account row (needs closing_date / due_date).
 * @param statements  All pending card_statements (pre-filtered to "pendiente").
 * @param movements   All movements (e.g. from fetchAllMovements).
 * @param ref         Optional reference date (defaults to today).
 * @returns           { amount: number (positive, in the card's native currency),
 *                      dueDate: string | null (ISO date) }
 */
export function nextCardPayment(
  accountId: string,
  account: CardPaymentAccount,
  statements: CardPaymentStatement[],
  movements: CardPaymentMovement[],
  ref?: Date
): { amount: number; dueDate: string | null } {
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
    }
  }

  // 2. Fallback: sum the last CLOSED cycle from movements (not the open cycle)
  const closingDate = account.closing_date
  if (closingDate == null) {
    return { amount: 0, dueDate: null }
  }
  const closingDay = dayOfMonth(closingDate)

  // Determine the last closed cycle: go one day before the current open cycle start
  const open = currentCycleRange(closingDay, refDate)
  const prevRef = subDays(open.cycleStart, 1)
  const closed = currentCycleRange(closingDay, prevRef)

  const closedTotal = movements
    .filter(
      (m) =>
        m.account_id === accountId &&
        m.type === "expense" &&
        isInCycle(m.date, closed.cycleStart, closed.cycleEnd)
    )
    .reduce((sum, m) => sum + towardAccountCurrency(m, account.currency), 0)

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

  return { amount: closedTotal, dueDate }
}

/**
 * Returns the current open cycle summary for a credit card account.
 * "Resumen en curso" = the cycle that is still accumulating (not yet closed).
 *
 * @param accountId   The account's UUID.
 * @param account     The account row (needs closing_date / due_date).
 * @param movements   All movements for this account (expense type).
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

  const amount = movements
    .filter(
      (m) =>
        m.account_id === accountId &&
        m.type === "expense" &&
        isInCycle(m.date, cycleStart, cycleEnd)
    )
    .reduce((sum, m) => sum + towardAccountCurrency(m, account.currency), 0)

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
   * Suma en la moneda de la cuenta (amountInCurrency de @/lib/money) de los
   * movimientos de gasto del ciclo — un gasto USD sin converted_amount ("USD
   * puro") no se cuenta acá, aparece aparte en totalsByCurrency. Total
   * autocalculado; para ciclos pagados preferir statement.total_amount.
   */
  total: number
  /**
   * Per-currency subtotals computed from expense movements, grouped by
   * original_currency and summed using the ORIGINAL amount (not converted_amount).
   * Zero when the currency has no movements in the cycle.
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
 */
export function listCardCycles(
  accountId: string,
  account: CycleAccount,
  movements: CycleMovement[],
  statements: CycleStatement[],
  ref?: Date
): CardCycle[] {
  const closingDate = account.closing_date
  if (closingDate == null) return []
  const closingDay = dayOfMonth(closingDate)
  const dueDay = account.due_date != null ? dayOfMonth(account.due_date) : null

  const today = startOfDay(ref ?? new Date())

  // Filter movements belonging to this account
  const accountMovements = movements.filter((m) => m.account_id === accountId)

  if (accountMovements.length === 0) {
    // No movements: return only the current open cycle (empty)
    const { cycleStart, cycleEnd } = currentCycleRange(closingDay, today)
    const dueDate =
      dueDay != null ? toDateString(computeDueDate(cycleEnd, dueDay, closingDay)) : null
    const stmt = statements.find(
      (s) => s.account_id === accountId && s.close_date === toDateString(cycleEnd)
    ) ?? null
    return [{ closeDate: toDateString(cycleEnd), dueDate, cycleStart, cycleEnd, movements: [], total: 0, totalsByCurrency: { ARS: 0, USD: 0 }, statement: stmt }]
  }

  // Find the oldest movement date to determine the earliest cycle
  const oldestDate = accountMovements
    .map((m) => m.date)
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

  const cycles: CardCycle[] = []

  // Walk month by month until we've passed the latest date we need to cover
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

    const cycleMovements = accountMovements.filter((m) =>
      isInCycle(m.date, cycleStart, cycleEnd)
    )

    const expenseMovements = cycleMovements.filter((m) => m.type === "expense")

    const total = expenseMovements
      .reduce((sum, m) => sum + towardAccountCurrency(m, account.currency), 0)

    const totalsByCurrency: { ARS: number; USD: number } = { ARS: 0, USD: 0 }
    for (const m of expenseMovements) {
      const cur = m.original_currency === "USD" ? "USD" : "ARS"
      totalsByCurrency[cur] += m.amount
    }

    const closeDateStr = toDateString(cycleEnd)
    const dueDate =
      dueDay != null ? toDateString(computeDueDate(cycleEnd, dueDay, closingDay)) : null

    const stmt =
      statements.find(
        (s) => s.account_id === accountId && s.close_date === closeDateStr
      ) ?? null

    cycles.push({ closeDate: closeDateStr, dueDate, cycleStart, cycleEnd, movements: cycleMovements, total, totalsByCurrency, statement: stmt })

    // Advance to the next cycle end: same day next month (clamped)
    const nextCycleEndRaw = addMonths(cycleEnd, 1)
    const nextY = nextCycleEndRaw.getFullYear()
    const nextM = nextCycleEndRaw.getMonth() + 1
    cursor = startOfDay(new Date(nextY, nextM - 1, Math.min(closingDay, getDaysInMonth(new Date(nextY, nextM - 1)))))
  }

  return cycles
}
