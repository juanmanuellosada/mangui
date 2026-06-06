import {
  addMonths,
  subMonths,
  getDaysInMonth,
  parseISO,
  isAfter,
  isBefore,
  isEqual,
  startOfDay,
} from "date-fns"

// Minimal shape needed by nextCardPayment — avoids importing full DB types here.
interface CardPaymentAccount {
  closing_day: number | null
  due_day?: number | null
}

interface CardPaymentStatement {
  account_id: string
  total_amount: number
  due_date: string
}

interface CardPaymentMovement {
  account_id: string
  type: string
  date: string
  amount: number
  converted_amount?: number | null
}

/**
 * Returns the next card payment details for a given credit card account.
 *
 * Logic (mirrors the dashboard AccountsPreview):
 *  1. Look for the earliest pending statement for this account.
 *  2. If none, sum current-cycle expense movements as a fallback.
 *
 * @param accountId   The account's UUID.
 * @param account     The account row (needs closing_day / due_day).
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
  // 1. Nearest pending statement
  const pendingStatement = statements
    .filter((s) => s.account_id === accountId)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null

  if (pendingStatement) {
    return {
      amount: pendingStatement.total_amount,
      dueDate: pendingStatement.due_date,
    }
  }

  // 2. Fallback: current cycle total from movements
  const closingDay = account.closing_day
  if (closingDay == null) {
    return { amount: 0, dueDate: null }
  }

  const { cycleStart, cycleEnd } = currentCycleRange(closingDay, ref)
  const cycleTotal = movements
    .filter(
      (m) =>
        m.account_id === accountId &&
        m.type === "expense" &&
        isInCycle(m.date, cycleStart, cycleEnd)
    )
    .reduce((sum, m) => sum + (m.converted_amount ?? m.amount), 0)

  return { amount: cycleTotal, dueDate: null }
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
