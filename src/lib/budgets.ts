import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfWeek,
  endOfWeek,
  startOfQuarter,
  endOfQuarter,
  addDays,
  differenceInCalendarDays,
  parseISO,
  getDay,
  format,
} from "date-fns"
import { es } from "date-fns/locale"
import type { Tables, Enums } from "@/lib/database.types"

export type Budget = Tables<"budgets">
export type BudgetPeriod = Enums<"budget_period">
export type BudgetStatus = Enums<"budget_status">

export const BUDGETS_KEY = ["budgets"] as const

/**
 * Compute the active window {from, to} as ISO date strings for a given period.
 *
 * - weekly: current week anchored to the same weekday as start_date
 * - biweekly: 14-day cycle counting forward from start_date
 * - monthly: current calendar month (ignores start_date anchor)
 * - quarterly: current 3-month block (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec)
 * - annual: current calendar year (ignores start_date anchor)
 */
export function currentWindow(
  period: BudgetPeriod,
  startDate: string,
  ref: Date = new Date()
): { from: string; to: string } {
  const anchor = parseISO(startDate)

  switch (period) {
    case "weekly": {
      // Anchor weekday (0=Sun, 1=Mon, ...)
      const anchorDow = getDay(anchor)
      // Find the most recent occurrence of that weekday ≤ ref
      let from = new Date(ref)
      from.setHours(0, 0, 0, 0)
      while (getDay(from) !== anchorDow) {
        from = addDays(from, -1)
      }
      const to = addDays(from, 6)
      return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
    }

    case "biweekly": {
      // Count 14-day blocks from anchor forward until we find the one containing ref
      const refTime = new Date(ref)
      refTime.setHours(0, 0, 0, 0)
      const anchorTime = new Date(anchor)
      anchorTime.setHours(0, 0, 0, 0)

      // Days elapsed from anchor
      const msPerDay = 86400000
      const daysElapsed = Math.floor((refTime.getTime() - anchorTime.getTime()) / msPerDay)
      // Handle ref before anchor (negative block)
      const blockIndex = Math.floor(daysElapsed / 14)
      const from = addDays(anchorTime, blockIndex * 14)
      const to = addDays(from, 13)
      return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
    }

    case "monthly": {
      const from = startOfMonth(ref)
      const to = endOfMonth(ref)
      return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
    }

    case "quarterly": {
      const m = ref.getMonth() // 0-based
      const quarterStartMonth = Math.floor(m / 3) * 3
      const from = new Date(ref.getFullYear(), quarterStartMonth, 1)
      const to = endOfMonth(new Date(ref.getFullYear(), quarterStartMonth + 2, 1))
      return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
    }

    case "annual": {
      const from = startOfYear(ref)
      const to = endOfYear(ref)
      return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
    }
  }
}

/**
 * Returns the active window {from, to} for a budget, as ISO date strings.
 *
 * Three cases:
 *   1. is_recurring AND period set → rolling calendar occurrence via currentWindow().
 *   2. is_recurring AND period NULL (custom) → advance [start_date, end_date] by its
 *      own duration (end-start+1 days) until the window contains ref.
 *   3. NOT is_recurring → fixed [start_date, end_date].
 */
export function activeBudgetWindow(
  budget: Budget,
  ref: Date = new Date()
): { from: string; to: string } {
  // Case 1: recurring with a preset period
  if (budget.is_recurring && budget.period !== null) {
    return currentWindow(budget.period, budget.start_date, ref)
  }

  // For cases 2 & 3 we need end_date. Fall back to start_date if somehow missing.
  const endDate = budget.end_date ?? budget.start_date

  // Case 3: non-recurring → fixed window
  if (!budget.is_recurring) {
    return { from: budget.start_date, to: endDate }
  }

  // Case 2: recurring with custom (NULL period) → roll [start_date, end_date] forward
  // by (duration) days until the window contains ref.
  const anchor = parseISO(budget.start_date)
  const anchorEnd = parseISO(endDate)
  // Duration in days is inclusive: end - start + 1 days per occurrence.
  const duration = differenceInCalendarDays(anchorEnd, anchor) + 1

  const refTime = new Date(ref)
  refTime.setHours(0, 0, 0, 0)
  const anchorTime = new Date(anchor)
  anchorTime.setHours(0, 0, 0, 0)

  const daysElapsed = differenceInCalendarDays(refTime, anchorTime)
  // blockIndex can be negative if ref < anchor (edge case: show first window)
  const blockIndex = Math.max(0, Math.floor(daysElapsed / duration))

  const from = addDays(anchorTime, blockIndex * duration)
  const to = addDays(from, duration - 1)
  return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
}

/**
 * Returns the CURRENT calendar period window for a preset period.
 * Used by the form to auto-fill desde-hasta when a preset is chosen.
 *
 * - weekly    → Mon–Sun of the week containing ref (ISO week, Monday anchor).
 * - biweekly  → 14-day fortnight: 1–14 or 15–end of month based on ref day.
 * - monthly   → 1st–last day of ref's month.
 * - quarterly → first–last day of the calendar quarter containing ref.
 * - annual    → Jan 1–Dec 31 of ref's year.
 */
export function calendarPeriodWindow(
  period: BudgetPeriod,
  ref: Date = new Date()
): { from: string; to: string } {
  switch (period) {
    case "weekly": {
      // ISO week: Monday → Sunday
      const from = startOfWeek(ref, { weekStartsOn: 1 })
      const to = endOfWeek(ref, { weekStartsOn: 1 })
      return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
    }

    case "biweekly": {
      // Simple calendar fortnight: day 1–14 or day 15–end of month.
      const day = ref.getDate()
      const year = ref.getFullYear()
      const month = ref.getMonth()
      if (day <= 14) {
        const from = new Date(year, month, 1)
        const to = new Date(year, month, 14)
        return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
      } else {
        const from = new Date(year, month, 15)
        const to = endOfMonth(ref)
        return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
      }
    }

    case "monthly": {
      const from = startOfMonth(ref)
      const to = endOfMonth(ref)
      return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
    }

    case "quarterly": {
      const from = startOfQuarter(ref)
      const to = endOfQuarter(ref)
      return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
    }

    case "annual": {
      const from = startOfYear(ref)
      const to = endOfYear(ref)
      return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }
    }
  }
}

export type BudgetProgressStatus = "on_track" | "near" | "exceeded"

export interface BudgetProgress {
  spent: number
  /** Límite efectivo (baseLimit + carry). Se mantiene por compatibilidad con consumidores existentes. */
  limit: number
  /** Límite configurado en el presupuesto, sin sobrante acumulado. */
  baseLimit: number
  /** Sobrante positivo del período anterior acumulado (0 si no aplica rollover). */
  carry: number
  /** baseLimit + carry. */
  effectiveLimit: number
  percent: number
  remaining: number
  status: BudgetProgressStatus
}

type MovementRow = {
  type: string
  is_future: boolean
  date: string
  category_id: string | null
  account_id: string
  amount: number
  converted_amount: number | null
  original_currency: string
}

/**
 * Compute spent vs limit for a budget given a movements array.
 *
 * spent = sum of EXPENSE movements where:
 *   - is_future = false
 *   - date ∈ currentWindow(period, start_date)
 *   - category_id ∈ category_ids OR category_ids is empty (= all)
 *   - account_id ∈ account_ids OR account_ids is empty (= all)
 *   - amount = converted_amount if present else amount (both in budget's currency assumption)
 */
function spentInWindow(
  budget: Budget,
  movements: MovementRow[],
  window: { from: string; to: string }
): number {
  return movements.reduce((acc, m) => {
    if (m.type !== "expense") return acc
    if (m.is_future) return acc
    if (m.date < window.from || m.date > window.to) return acc
    if (budget.category_ids.length > 0 && !budget.category_ids.includes(m.category_id ?? "")) return acc
    if (budget.account_ids.length > 0 && !budget.account_ids.includes(m.account_id)) return acc

    // Prefer converted_amount (already in account currency) otherwise use raw amount
    const effectiveAmount = m.converted_amount !== null ? m.converted_amount : m.amount
    return acc + effectiveAmount
  }, 0)
}

export function computeBudgetProgress(
  budget: Budget,
  movements: MovementRow[],
  ref: Date = new Date()
): BudgetProgress {
  const window = activeBudgetWindow(budget, ref)
  const spent = spentInWindow(budget, movements, window)

  // Rollover: solo suma sobrante POSITIVO del período INMEDIATO ANTERIOR,
  // y solo si ese período anterior existió dentro de la vida del budget
  // (si no, es el primer período y no hay nada que arrastrar).
  let carry = 0
  if (budget.rollover_enabled && budget.is_recurring) {
    const prevWindow = activeBudgetWindow(budget, addDays(parseISO(window.from), -1))
    if (prevWindow.to >= budget.start_date) {
      const prevSpent = spentInWindow(budget, movements, prevWindow)
      carry = Math.max(0, budget.limit_amount - prevSpent)
    }
  }

  const baseLimit = budget.limit_amount
  const effectiveLimit = baseLimit + carry
  const percent = effectiveLimit > 0 ? Math.min((spent / effectiveLimit) * 100, 999) : 0
  const remaining = effectiveLimit - spent
  const threshold = budget.alert_threshold ?? 80
  const status: BudgetProgressStatus =
    percent > 100 ? "exceeded" : percent >= threshold ? "near" : "on_track"

  return { spent, limit: effectiveLimit, baseLimit, carry, effectiveLimit, percent, remaining, status }
}

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  annual: "Anual",
}

export function periodLabel(period: BudgetPeriod | null): string {
  if (period === null) return "Personalizado"
  return PERIOD_LABELS[period]
}

/**
 * Returns a human-readable scope label.
 * If budget.category_ids and account_ids are both empty → "Global"
 * Otherwise lists category names (up to 2) + account names (up to 1)
 */
export function scopeLabel(
  budget: Budget,
  lookup: {
    categories: { id: string; name: string }[]
    accounts: { id: string; name: string }[]
  }
): string {
  const catNames = budget.category_ids
    .map((id) => lookup.categories.find((c) => c.id === id)?.name)
    .filter(Boolean) as string[]

  const accNames = budget.account_ids
    .map((id) => lookup.accounts.find((a) => a.id === id)?.name)
    .filter(Boolean) as string[]

  const parts = [...catNames, ...accNames]
  if (parts.length === 0) return "Global"

  // Show up to 2 parts then "+N más"
  if (parts.length <= 2) return parts.join(", ")
  return `${parts.slice(0, 2).join(", ")} +${parts.length - 2} más`
}

/** Window label in short format (e.g. "1 may. – 31 may.") */
export function windowLabel(period: BudgetPeriod | null, startDate: string, ref: Date = new Date()): string {
  // For custom-range budgets without a period preset, show start date only
  if (period === null) {
    return format(parseISO(startDate), "d MMM yyyy", { locale: es })
  }
  const w = currentWindow(period, startDate, ref)
  const from = parseISO(w.from)
  const to = parseISO(w.to)

  // Same month: "1–31 may."
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    const monthName = format(from, "MMM", { locale: es })
    return `${from.getDate()}–${to.getDate()} ${monthName}.`
  }

  return `${format(from, "d MMM", { locale: es })}. – ${format(to, "d MMM", { locale: es })}.`
}
