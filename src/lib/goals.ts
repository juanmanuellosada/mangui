import {
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
  subMonths,
  parseISO,
  format,
  isAfter,
} from "date-fns"
import type { Tables, Enums, TablesInsert } from "@/lib/database.types"

// ── Re-exported DB types ──────────────────────────────────────────────────────

export type Goal = Tables<"goals">
export type GoalType = Enums<"goal_type">
export type GoalStatus = Enums<"goal_status">
export type GoalPeriod = Enums<"goal_period">

export const GOALS_KEY = ["goals"] as const

// ── Scope (multi account/category, resolved from goal_accounts/goal_categories) ─

/**
 * Resolved scope passed alongside a Goal when computing progress.
 * The query layer fetches the relation rows and resolves them here.
 */
export interface GoalScope {
  accountIds: string[]
  categoryIds: string[]
}

// ── Movement shape (same as before, kept compatible) ─────────────────────────

type MovementRow = {
  type: string
  is_future: boolean
  date: string
  category_id: string | null
  account_id: string
  amount: number
  converted_amount: number | null
}

// ── Progress types ────────────────────────────────────────────────────────────

export type GoalProgressStatus = "on_track" | "near" | "reached" | "exceeded"

/**
 * Unified progress shape returned by computeGoalProgress for all three types.
 *
 * - value:   the measured amount (income sum, net saving, or expense sum)
 * - target:  the target amount the progress is measured against
 * - percent: 0–∞ for income/reduction (not clamped); may be NEGATIVE for saving
 *            when expenses > income (neto negativo). The UI clamps the bar length
 *            to [0, 100] but shows the real percent value with a red color.
 * - status:  semantic state derived from percent and type
 */
export interface GoalProgress {
  value: number
  target: number
  percent: number
  status: GoalProgressStatus
}

// ── Period helpers (task 2.2) ─────────────────────────────────────────────────

/**
 * Given an ISO start date and a period preset, compute the ISO end date
 * (inclusive last day) of the period.
 *
 * For "custom" this returns start itself — the caller controls both dates freely.
 */
export function periodEnd(
  start: string,
  preset: Exclude<GoalPeriod, "custom">
): string {
  const d = parseISO(start)
  switch (preset) {
    case "weekly":
      // 7-day window: end = start + 6 days
      return format(addDays(d, 6), "yyyy-MM-dd")
    case "biweekly":
      // 14-day window
      return format(addDays(d, 13), "yyyy-MM-dd")
    case "monthly":
      // 1 calendar month forward, then back one day
      return format(addDays(addMonths(d, 1), -1), "yyyy-MM-dd")
    case "quarterly":
      // 3 calendar months forward, then back one day
      return format(addDays(addQuarters(d, 1), -1), "yyyy-MM-dd")
    case "annual":
      // 1 calendar year forward, then back one day
      return format(addDays(addYears(d, 1), -1), "yyyy-MM-dd")
  }
}

/**
 * Validate that a custom date range is valid (end must be strictly after start).
 * Returns true if valid.
 */
export function isValidCustomRange(start: string, end: string): boolean {
  return isAfter(parseISO(end), parseISO(start))
}

// ── Internal: advance start_date by one period increment ─────────────────────

function advancePeriod(start: string, period: GoalPeriod): string {
  const d = parseISO(start)
  switch (period) {
    case "weekly":
      return format(addWeeks(d, 1), "yyyy-MM-dd")
    case "biweekly":
      return format(addDays(d, 14), "yyyy-MM-dd")
    case "monthly":
      return format(addMonths(d, 1), "yyyy-MM-dd")
    case "quarterly":
      return format(addQuarters(d, 1), "yyyy-MM-dd")
    case "annual":
      return format(addYears(d, 1), "yyyy-MM-dd")
    case "custom":
      // For custom recurring goals: advance by the original duration (end - start + 1 days).
      // Caller is responsible for passing correct start; we just advance by 1 day as no-op fallback.
      return format(addDays(d, 1), "yyyy-MM-dd")
  }
}

// ── Internal: filter movements by scope and period range (task 2.4) ───────────

/**
 * Filter movements to those within [from, to] (ISO date strings, inclusive)
 * and within the given scope (account/category lists, or all if is_global).
 */
function filterMovements(
  movements: MovementRow[],
  options: {
    from: string
    to: string
    isGlobal: boolean
    scope: GoalScope
  }
): MovementRow[] {
  const { from, to, isGlobal, scope } = options
  return movements.filter((m) => {
    if (m.is_future) return false
    if (m.date < from || m.date > to) return false
    if (!isGlobal) {
      // Must match at least one account or one category in scope (if both lists are non-empty, AND logic)
      if (scope.accountIds.length > 0 && !scope.accountIds.includes(m.account_id)) return false
      if (scope.categoryIds.length > 0 && !scope.categoryIds.includes(m.category_id ?? "")) return false
    }
    return true
  })
}

function effectiveAmount(m: MovementRow): number {
  return m.converted_amount !== null ? m.converted_amount : m.amount
}

// ── Unified progress computation (task 2.3) ───────────────────────────────────

/**
 * Compute goal progress for any goal type.
 *
 * @param goal     - the goal row from the DB
 * @param movements - all movements for the user (filtering applied internally)
 * @param scope    - resolved account/category IDs from goal_accounts/goal_categories
 * @param ref      - reference date (defaults to today); used only to narrow
 *                   future-movement filtering (is_future is the primary guard)
 *
 * Status thresholds:
 *   income:    on_track <80% | near 80–99% | reached ≥100%
 *   saving:    on_track <80% | near 80–99% | reached ≥100% | exceeded <0% (neto negativo)
 *   reduction: on_track <80% | near 80–100% | reached =0% exact (spent=0) | exceeded >100%
 */
export function computeGoalProgress(
  goal: Goal,
  movements: MovementRow[],
  scope: GoalScope,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ref: Date = new Date()
): GoalProgress {
  const from = goal.start_date
  const to = goal.end_date

  const inScope = filterMovements(movements, {
    from,
    to,
    isGlobal: goal.is_global,
    scope,
  })

  switch (goal.type) {
    case "income": {
      const value = inScope
        .filter((m) => m.type === "income")
        .reduce((acc, m) => acc + effectiveAmount(m), 0)

      const target = goal.target_amount ?? 0
      const percent = target > 0 ? (value / target) * 100 : 0
      const status: GoalProgressStatus =
        percent >= 100 ? "reached" : percent >= 80 ? "near" : "on_track"

      return { value, target, percent, status }
    }

    case "saving": {
      // Net = income − expenses; percent may be negative if net < 0
      const incomeSum = inScope
        .filter((m) => m.type === "income")
        .reduce((acc, m) => acc + effectiveAmount(m), 0)
      const expenseSum = inScope
        .filter((m) => m.type === "expense")
        .reduce((acc, m) => acc + effectiveAmount(m), 0)
      const value = incomeSum - expenseSum

      const target = goal.target_amount ?? 0
      const percent = target > 0 ? (value / target) * 100 : 0

      // Negative net = exceeded in the "bad" direction
      const status: GoalProgressStatus =
        percent < 0
          ? "exceeded"
          : percent >= 100
          ? "reached"
          : percent >= 80
          ? "near"
          : "on_track"

      return { value, target, percent, status }
    }

    case "reduction": {
      const expenseSum = inScope
        .filter((m) => m.type === "expense")
        .reduce((acc, m) => acc + effectiveAmount(m), 0)
      const value = expenseSum

      // target = baseline × (1 − target_percent/100); or target_amount if directly stored
      const baseline = goal.baseline_amount ?? 0
      const targetPct = goal.target_percent ?? 0
      const target =
        goal.target_amount !== null
          ? goal.target_amount
          : baseline > 0
          ? baseline * (1 - targetPct / 100)
          : 0

      // percent = how much of the "budget" we've used (higher = worse)
      // 0% = perfect (spent nothing); 100% = exactly at target; >100% = exceeded limit
      const percent = target > 0 ? (value / target) * 100 : 0

      // near: ≥80% of the target; exceeded: >100%; reached: exactly 0 spend (or very close)
      const status: GoalProgressStatus =
        percent > 100
          ? "exceeded"
          : percent >= 80
          ? "near"
          : value === 0
          ? "reached"
          : "on_track"

      return { value, target, percent, status }
    }
  }
}

// ── Baseline suggestion (task 2.5) ────────────────────────────────────────────

/**
 * Suggest a baseline by averaging monthly EXPENSE over the last `lookback`
 * completed calendar months across ALL categoryIds in scope.
 *
 * Multi-category: sums all expense movements whose category_id is in categoryIds
 * for each month, then averages across months.
 *
 * Passing an empty categoryIds array (when is_global=true) sums ALL expenses.
 */
export function suggestBaseline(
  scope: { categoryIds: string[]; accountIds?: string[]; isGlobal?: boolean },
  movements: MovementRow[],
  ref: Date = new Date(),
  lookback = 3
): number {
  const months: number[] = []

  for (let i = 1; i <= lookback; i++) {
    const monthDate = subMonths(ref, i)
    const from = format(startOfMonth(monthDate), "yyyy-MM-dd")
    const to = format(endOfMonth(monthDate), "yyyy-MM-dd")

    const spend = movements.reduce((acc, m) => {
      if (m.type !== "expense") return acc
      if (m.is_future) return acc
      if (m.date < from || m.date > to) return acc

      // Category filter (skip if global or empty list)
      if (!scope.isGlobal && scope.categoryIds.length > 0) {
        if (!scope.categoryIds.includes(m.category_id ?? "")) return acc
      }
      // Account filter (optional)
      if (scope.accountIds && scope.accountIds.length > 0) {
        if (!scope.accountIds.includes(m.account_id)) return acc
      }

      return acc + effectiveAmount(m)
    }, 0)

    months.push(spend)
  }

  if (months.length === 0) return 0
  return Math.round(months.reduce((a, b) => a + b, 0) / months.length)
}

/**
 * Auto-calculate target_amount for a reduction goal:
 *   target = baseline × (1 − percent / 100)
 */
export function reductionTarget(baseline: number, percent: number): number {
  return Math.max(0, baseline * (1 - percent / 100))
}

// ── Lazy renewal (task 2.6) ───────────────────────────────────────────────────

export interface RenewalOp {
  /**
   * The snapshot row to upsert into goal_snapshots.
   * Idempotent: unique on (goal_id, period_start).
   */
  snapshot: Omit<TablesInsert<"goal_snapshots">, "id" | "created_at">
  /**
   * Fields to patch on the goals row to advance to the next period.
   */
  goalUpdate: Pick<Goal, "id" | "start_date" | "end_date">
}

/**
 * If the goal is recurring and its end_date has passed (relative to ref),
 * return the operations needed to:
 *   (a) archive the closed period as a snapshot, and
 *   (b) advance start_date/end_date to the next period.
 *
 * Returns null if renewal is not needed (non-recurring, or period still active).
 *
 * This is PURE / data-only. The caller (query layer / mutation) performs the
 * actual Supabase upsert + update.
 *
 * The snapshot insert is idempotent via the unique constraint on
 * (goal_id, period_start) — concurrent reads calling this are safe.
 *
 * For "custom" period: advances by the same duration (end - start days + 1).
 */
export function maybeRenewGoal(
  goal: Goal,
  progress: GoalProgress,
  ref: Date = new Date()
): RenewalOp | null {
  if (!goal.recurring) return null

  const refStr = format(ref, "yyyy-MM-dd")
  if (goal.end_date >= refStr) return null // period still active or exactly today

  // Compute next period window
  let nextStart: string
  let nextEnd: string

  if (goal.period === "custom") {
    // Advance by the same duration as the original window (end - start + 1 days)
    const endD = parseISO(goal.end_date)
    const startD = parseISO(goal.start_date)
    const durationDays =
      Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1
    nextStart = format(addDays(endD, 1), "yyyy-MM-dd")
    nextEnd = format(addDays(addDays(endD, 1), durationDays - 1), "yyyy-MM-dd")
  } else {
    nextStart = advancePeriod(goal.start_date, goal.period)
    nextEnd = periodEnd(nextStart, goal.period as Exclude<GoalPeriod, "custom">)
  }

  const snapshot: RenewalOp["snapshot"] = {
    goal_id: goal.id,
    user_id: goal.user_id,
    // month is kept as the period_start for compatibility with existing schema
    month: goal.start_date,
    period_start: goal.start_date,
    period_end: goal.end_date,
    amount: progress.value,
    target_amount: progress.target,
    percent: progress.percent,
    snap_status: progress.status,
  }

  const goalUpdate: RenewalOp["goalUpdate"] = {
    id: goal.id,
    start_date: nextStart,
    end_date: nextEnd,
  }

  return { snapshot, goalUpdate }
}

// ── Monthly series (preserved, updated for new schema) ────────────────────────

export interface MonthPoint {
  month: string   // "MMM" label (e.g. "ene")
  amount: number
}

/**
 * Returns an array of { month, amount } for trending:
 * - income/saving: per-month net relevant amount in scope
 * - reduction: per-month EXPENSE in scope
 *
 * Updated to use GoalScope instead of single category_id/account_id.
 */
export function monthlySeries(
  goal: Goal,
  scope: GoalScope,
  movements: MovementRow[],
  monthsBack = 6,
  ref: Date = new Date()
): MonthPoint[] {
  const result: MonthPoint[] = []

  const months: { from: string; to: string; label: string }[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = subMonths(ref, i)
    months.push({
      from: format(startOfMonth(d), "yyyy-MM-dd"),
      to: format(endOfMonth(d), "yyyy-MM-dd"),
      label: format(d, "MMM"),
    })
  }

  for (const { from, to, label } of months) {
    const inPeriod = filterMovements(movements, {
      from,
      to,
      isGlobal: goal.is_global,
      scope,
    })

    let amount: number
    if (goal.type === "income") {
      amount = inPeriod
        .filter((m) => m.type === "income")
        .reduce((acc, m) => acc + effectiveAmount(m), 0)
    } else if (goal.type === "saving") {
      const inc = inPeriod.filter((m) => m.type === "income").reduce((acc, m) => acc + effectiveAmount(m), 0)
      const exp = inPeriod.filter((m) => m.type === "expense").reduce((acc, m) => acc + effectiveAmount(m), 0)
      amount = inc - exp
    } else {
      // reduction: per-month expense
      amount = inPeriod
        .filter((m) => m.type === "expense")
        .reduce((acc, m) => acc + effectiveAmount(m), 0)
    }

    result.push({ month: label, amount })
  }

  return result
}

// ── Legacy wrappers (kept to avoid breaking goal-form/goals-list until rewrite) ─

/** @deprecated Use computeGoalProgress with type="saving" instead */
export interface SavingProgress {
  accumulated: number
  target: number
  percent: number
  reached: boolean
}

/** @deprecated Use computeGoalProgress with type="saving" instead */
export function computeSavingProgress(
  goal: Goal,
  movements: MovementRow[]
): SavingProgress {
  // Build a minimal scope from the new schema (is_global + empty lists = all)
  const scope: GoalScope = { accountIds: [], categoryIds: [] }
  const prog = computeGoalProgress(goal, movements, scope)
  return {
    accumulated: prog.value,
    target: prog.target,
    // old function clamped to [0, 100]; preserve that for callers not yet updated
    percent: Math.min(Math.max(prog.percent, 0), 100),
    reached: prog.percent >= 100,
  }
}

/** @deprecated Use computeGoalProgress with type="reduction" instead */
export interface ReductionProgress {
  currentMonthSpend: number
  baseline: number
  reductionPct: number
  targetPct: number
  met: boolean
}

/** @deprecated Use computeGoalProgress with type="reduction" instead */
export function computeReductionProgress(
  goal: Goal,
  movements: MovementRow[],
  ref: Date = new Date()
): ReductionProgress {
  const scope: GoalScope = { accountIds: [], categoryIds: [] }
  const prog = computeGoalProgress(goal, movements, scope, ref)

  const baseline = goal.baseline_amount ?? 0
  let targetPct = goal.target_percent ?? 0
  if (!targetPct && goal.target_amount !== null && baseline > 0) {
    targetPct = (1 - goal.target_amount / baseline) * 100
  }
  const reductionPct =
    baseline > 0 ? ((baseline - prog.value) / baseline) * 100 : 0

  return {
    currentMonthSpend: prog.value,
    baseline,
    reductionPct,
    targetPct,
    met: reductionPct >= targetPct,
  }
}
