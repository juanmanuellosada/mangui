import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addDays,
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

export type BudgetProgressStatus = "on_track" | "near" | "exceeded"

export interface BudgetProgress {
  spent: number
  limit: number
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
export function computeBudgetProgress(
  budget: Budget,
  movements: MovementRow[],
  ref: Date = new Date()
): BudgetProgress {
  const window = currentWindow(budget.period, budget.start_date, ref)

  const spent = movements.reduce((acc, m) => {
    if (m.type !== "expense") return acc
    if (m.is_future) return acc
    if (m.date < window.from || m.date > window.to) return acc
    if (budget.category_ids.length > 0 && !budget.category_ids.includes(m.category_id ?? "")) return acc
    if (budget.account_ids.length > 0 && !budget.account_ids.includes(m.account_id)) return acc

    // Prefer converted_amount (already in account currency) otherwise use raw amount
    const effectiveAmount = m.converted_amount !== null ? m.converted_amount : m.amount
    return acc + effectiveAmount
  }, 0)

  const limit = budget.limit_amount
  const percent = limit > 0 ? Math.min((spent / limit) * 100, 999) : 0
  const remaining = limit - spent
  const status: BudgetProgressStatus =
    percent > 100 ? "exceeded" : percent >= 80 ? "near" : "on_track"

  return { spent, limit, percent, remaining, status }
}

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  annual: "Anual",
}

export function periodLabel(period: BudgetPeriod): string {
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
export function windowLabel(period: BudgetPeriod, startDate: string, ref: Date = new Date()): string {
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
