import {
  startOfMonth,
  endOfMonth,
  subMonths,
  parseISO,
  format,
} from "date-fns"
import type { Tables, Enums } from "@/lib/database.types"

export type Goal = Tables<"goals">
export type GoalType = Enums<"goal_type">
export type GoalStatus = Enums<"goal_status">

export const GOALS_KEY = ["goals"] as const

type MovementRow = {
  type: string
  is_future: boolean
  date: string
  category_id: string | null
  account_id: string
  amount: number
  converted_amount: number | null
}

// ── Saving progress ───────────────────────────────────────────────────────────

export interface SavingProgress {
  accumulated: number
  target: number
  percent: number  // 0–100 (clamped)
  reached: boolean
}

/**
 * Compute saving goal progress.
 *
 * accumulated = sum of INCOME movements (is_future=false) in scope since goal.created_at
 * scope: if category_id set → match; if account_id set → match; else all movements
 */
export function computeSavingProgress(
  goal: Goal,
  movements: MovementRow[]
): SavingProgress {
  const createdAt = goal.created_at.split("T")[0] // ISO date

  const accumulated = movements.reduce((acc, m) => {
    if (m.type !== "income") return acc
    if (m.is_future) return acc
    if (m.date < createdAt) return acc
    if (goal.category_id && m.category_id !== goal.category_id) return acc
    if (goal.account_id && m.account_id !== goal.account_id) return acc

    const effectiveAmount = m.converted_amount !== null ? m.converted_amount : m.amount
    return acc + effectiveAmount
  }, 0)

  const target = goal.target_amount ?? 0
  const percent = target > 0 ? Math.min((accumulated / target) * 100, 100) : 0
  const reached = target > 0 ? accumulated >= target : false

  return { accumulated, target, percent, reached }
}

// ── Reduction progress ────────────────────────────────────────────────────────

export interface ReductionProgress {
  currentMonthSpend: number
  baseline: number
  reductionPct: number   // how much less we're spending vs baseline (positive = good)
  targetPct: number      // the target reduction %
  met: boolean
}

/**
 * Compute reduction goal progress for the current calendar month.
 *
 * currentMonthSpend = sum of EXPENSE movements this calendar month in the category
 * baseline = goal.baseline_amount
 * reductionPct = (baseline - currentMonthSpend) / baseline * 100
 * targetPct = goal.target_percent OR derived from target_amount
 */
export function computeReductionProgress(
  goal: Goal,
  movements: MovementRow[],
  ref: Date = new Date()
): ReductionProgress {
  const from = format(startOfMonth(ref), "yyyy-MM-dd")
  const to = format(endOfMonth(ref), "yyyy-MM-dd")

  const currentMonthSpend = movements.reduce((acc, m) => {
    if (m.type !== "expense") return acc
    if (m.is_future) return acc
    if (m.date < from || m.date > to) return acc
    if (goal.category_id && m.category_id !== goal.category_id) return acc
    if (goal.account_id && m.account_id !== goal.account_id) return acc

    const effectiveAmount = m.converted_amount !== null ? m.converted_amount : m.amount
    return acc + effectiveAmount
  }, 0)

  const baseline = goal.baseline_amount ?? 0

  const reductionPct =
    baseline > 0 ? ((baseline - currentMonthSpend) / baseline) * 100 : 0

  let targetPct = goal.target_percent ?? 0
  if (!targetPct && goal.target_amount !== null && baseline > 0) {
    targetPct = (1 - goal.target_amount / baseline) * 100
  }

  const met = reductionPct >= targetPct

  return { currentMonthSpend, baseline, reductionPct, targetPct, met }
}

// ── Baseline suggestion ───────────────────────────────────────────────────────

/**
 * Suggest a baseline by averaging monthly EXPENSE in the category
 * over the last ~3 completed months.
 */
export function suggestBaseline(
  goal: Pick<Goal, "category_id" | "account_id">,
  movements: MovementRow[],
  ref: Date = new Date()
): number {
  const months: number[] = []

  for (let i = 1; i <= 3; i++) {
    const monthDate = subMonths(ref, i)
    const from = format(startOfMonth(monthDate), "yyyy-MM-dd")
    const to = format(endOfMonth(monthDate), "yyyy-MM-dd")

    const spend = movements.reduce((acc, m) => {
      if (m.type !== "expense") return acc
      if (m.is_future) return acc
      if (m.date < from || m.date > to) return acc
      if (goal.category_id && m.category_id !== goal.category_id) return acc
      if (goal.account_id && m.account_id !== goal.account_id) return acc

      const effectiveAmount = m.converted_amount !== null ? m.converted_amount : m.amount
      return acc + effectiveAmount
    }, 0)

    months.push(spend)
  }

  if (months.length === 0) return 0
  return Math.round(months.reduce((a, b) => a + b, 0) / months.length)
}

// ── Monthly series ─────────────────────────────────────────────────────────────

export interface MonthPoint {
  month: string   // "yyyy-MM" label
  amount: number
}

/**
 * Returns an array of { month, amount } for trending:
 * - saving: cumulative INCOME in scope up to end of each month
 * - reduction: per-month EXPENSE in scope
 */
export function monthlySeries(
  goal: Goal,
  movements: MovementRow[],
  monthsBack = 6,
  ref: Date = new Date()
): MonthPoint[] {
  const result: MonthPoint[] = []

  // Build months from oldest to newest
  const months: { from: string; to: string; label: string }[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = subMonths(ref, i)
    months.push({
      from: format(startOfMonth(d), "yyyy-MM-dd"),
      to: format(endOfMonth(d), "yyyy-MM-dd"),
      label: format(d, "MMM"),
    })
  }

  if (goal.type === "saving") {
    // cumulative: sum all INCOME from created_at up to end of each month
    for (const { to, label } of months) {
      const createdAt = goal.created_at.split("T")[0]
      const cumulative = movements.reduce((acc, m) => {
        if (m.type !== "income") return acc
        if (m.is_future) return acc
        if (m.date < createdAt || m.date > to) return acc
        if (goal.category_id && m.category_id !== goal.category_id) return acc
        if (goal.account_id && m.account_id !== goal.account_id) return acc

        const amt = m.converted_amount !== null ? m.converted_amount : m.amount
        return acc + amt
      }, 0)
      result.push({ month: label, amount: cumulative })
    }
  } else {
    // per-month spend
    for (const { from, to, label } of months) {
      const spend = movements.reduce((acc, m) => {
        if (m.type !== "expense") return acc
        if (m.is_future) return acc
        if (m.date < from || m.date > to) return acc
        if (goal.category_id && m.category_id !== goal.category_id) return acc
        if (goal.account_id && m.account_id !== goal.account_id) return acc

        const amt = m.converted_amount !== null ? m.converted_amount : m.amount
        return acc + amt
      }, 0)
      result.push({ month: label, amount: spend })
    }
  }

  return result
}
