import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  getDay,
} from "date-fns"
import { es } from "date-fns/locale"
import type { Tables, Enums } from "@/lib/database.types"
import type { RecurringTransaction } from "@/lib/recurring"

export type Movement = Tables<"movements">
export type Currency = Enums<"currency">

export interface StatsFilter {
  dateFrom?: string        // "yyyy-MM-dd"
  dateTo?: string          // "yyyy-MM-dd"
  categoryIds?: string[]
  accountIds?: string[]
  currency?: Currency
  type?: "income" | "expense" | "all"
}

/**
 * Filter an array of movements by the given filter criteria.
 * is_future movements are always excluded.
 */
export function filterMovements(movements: Movement[], filter: StatsFilter): Movement[] {
  return movements.filter((m) => {
    if (m.is_future) return false
    if (filter.dateFrom && m.date < filter.dateFrom) return false
    if (filter.dateTo && m.date > filter.dateTo) return false
    if (filter.categoryIds && filter.categoryIds.length > 0) {
      if (!filter.categoryIds.includes(m.category_id ?? "")) return false
    }
    if (filter.accountIds && filter.accountIds.length > 0) {
      if (!filter.accountIds.includes(m.account_id)) return false
    }
    if (filter.type && filter.type !== "all") {
      if (m.type !== filter.type) return false
    }
    return true
  })
}

function effectiveAmount(m: Movement, currency?: Currency): number {
  // When a currency is set, prefer converted_amount if available, else use amount
  if (currency && m.original_currency !== currency && m.converted_amount !== null) {
    return m.converted_amount
  }
  return m.amount
}

export interface SummaryTotals {
  income: number
  expense: number
  net: number
}

/**
 * Compute income, expense, and net totals from already-filtered movements.
 */
export function summaryTotals(movements: Movement[], currency?: Currency): SummaryTotals {
  let income = 0
  let expense = 0
  for (const m of movements) {
    const amt = effectiveAmount(m, currency)
    if (m.type === "income") income += amt
    else expense += amt
  }
  return { income, expense, net: income - expense }
}

export interface CategoryDistributionItem {
  categoryId: string
  name: string
  total: number
  percent: number
  icon?: string | null
}

/**
 * Return per-category distribution sorted descending by total.
 * Movements without a category appear as "Sin categoría".
 */
export function categoryDistribution(
  movements: Movement[],
  type: "income" | "expense",
  categories: { id: string; name: string; icon?: string | null }[],
  currency?: Currency
): CategoryDistributionItem[] {
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const totals = new Map<string, { id: string; name: string; icon?: string | null; total: number }>()

  let grandTotal = 0
  for (const m of movements) {
    if (m.type !== type) continue
    const amt = effectiveAmount(m, currency)
    grandTotal += amt
    const key = m.category_id ?? "__none__"
    const cat = m.category_id ? catMap.get(m.category_id) : undefined
    const name = cat?.name ?? "Sin categoría"
    const icon = cat?.icon ?? null
    const existing = totals.get(key)
    if (existing) {
      existing.total += amt
    } else {
      totals.set(key, { id: key === "__none__" ? "" : key, name, icon, total: amt })
    }
  }

  const items = [...totals.values()]
    .sort((a, b) => b.total - a.total)
    .map((item) => ({
      categoryId: item.id,
      name: item.name,
      icon: item.icon,
      total: item.total,
      percent: grandTotal > 0 ? (item.total / grandTotal) * 100 : 0,
    }))

  return items
}

export interface PeriodPoint {
  period: string   // e.g. "may.", "2025-05"
  income: number
  expense: number
  net: number
}

/**
 * Build an income/expense time series grouped by month (granularity='month').
 * Returns monthsBack periods ending at today.
 */
export function incomeExpenseSeries(
  movements: Movement[],
  granularity: "month" = "month",
  monthsBack = 6,
  currency?: Currency,
  ref: Date = new Date()
): PeriodPoint[] {
  // Only 'month' granularity for now
  void granularity
  const result: PeriodPoint[] = []

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = subMonths(ref, i)
    const from = format(startOfMonth(d), "yyyy-MM-dd")
    const to = format(endOfMonth(d), "yyyy-MM-dd")
    const label = format(d, "MMM", { locale: es })

    let income = 0
    let expense = 0
    for (const m of movements) {
      if (m.date < from || m.date > to) continue
      const amt = effectiveAmount(m, currency)
      if (m.type === "income") income += amt
      else expense += amt
    }

    result.push({ period: label, income: Math.round(income), expense: Math.round(expense), net: Math.round(income - expense) })
  }

  return result
}

const WEEKDAY_LABELS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]

export interface WeekdayPoint {
  weekday: string
  total: number
}

/**
 * Sum of expenses grouped by day of week (lun…dom).
 */
export function weekdayPattern(movements: Movement[], currency?: Currency): WeekdayPoint[] {
  const totals = new Array(7).fill(0)
  for (const m of movements) {
    if (m.type !== "expense") continue
    const dow = getDay(new Date(m.date + "T12:00:00"))
    totals[dow] += effectiveAmount(m, currency)
  }
  // Return mon..sun order (1..6, 0)
  const order = [1, 2, 3, 4, 5, 6, 0]
  return order.map((dow) => ({
    weekday: WEEKDAY_LABELS[dow],
    total: Math.round(totals[dow]),
  }))
}

export interface CategoryComparison {
  name: string
  icon?: string | null
  a: number
  b: number
  deltaAbs: number
  deltaPct: number | null   // null when a=0
}

export interface PeriodComparison {
  categories: CategoryComparison[]
  totalsA: SummaryTotals
  totalsB: SummaryTotals
  deltaPctIncome: number | null
  deltaPctExpense: number | null
  deltaPctNet: number | null
}

/**
 * Compare two movement sets per-category.
 * movsA = "este período", movsB = "anterior".
 */
export function periodComparison(
  movsA: Movement[],
  movsB: Movement[],
  categories: { id: string; name: string; icon?: string | null }[],
  currency?: Currency
): PeriodComparison {
  const catMap = new Map(categories.map((c) => [c.id, c]))

  function buildTotals(movs: Movement[]) {
    const map = new Map<string, number>()
    for (const m of movs) {
      if (m.type !== "expense") continue
      const key = m.category_id ?? "__none__"
      const amt = effectiveAmount(m, currency)
      map.set(key, (map.get(key) ?? 0) + amt)
    }
    return map
  }

  const totalsA = summaryTotals(movsA, currency)
  const totalsB = summaryTotals(movsB, currency)

  const mapA = buildTotals(movsA)
  const mapB = buildTotals(movsB)

  const allKeys = new Set([...mapA.keys(), ...mapB.keys()])
  const categories_list: CategoryComparison[] = []

  for (const key of allKeys) {
    const a = mapA.get(key) ?? 0
    const b = mapB.get(key) ?? 0
    const cat = key !== "__none__" ? catMap.get(key) : undefined
    const name = cat?.name ?? "Sin categoría"
    const icon = cat?.icon ?? null
    categories_list.push({
      name,
      icon,
      a,
      b,
      deltaAbs: a - b,
      deltaPct: b !== 0 ? ((a - b) / b) * 100 : null,
    })
  }

  categories_list.sort((x, y) => y.a - x.a)

  function deltaPct(a: number, b: number) {
    if (b === 0) return null
    return ((a - b) / b) * 100
  }

  return {
    categories: categories_list,
    totalsA,
    totalsB,
    deltaPctIncome: deltaPct(totalsA.income, totalsB.income),
    deltaPctExpense: deltaPct(totalsA.expense, totalsB.expense),
    deltaPctNet: deltaPct(totalsA.net, totalsB.net),
  }
}

export interface HistoricalVsAverage {
  thisMonth: number
  avg: number
  deltaPct: number | null
}

/**
 * Compare this month's spend in a category vs the average of the previous N months.
 */
export function vsHistoricalAverage(
  movements: Movement[],
  categoryId: string | null,
  monthsBack = 3,
  currency?: Currency,
  ref: Date = new Date()
): HistoricalVsAverage {
  const thisFrom = format(startOfMonth(ref), "yyyy-MM-dd")
  const thisTo = format(endOfMonth(ref), "yyyy-MM-dd")

  function monthSpend(from: string, to: string) {
    return movements.reduce((acc, m) => {
      if (m.type !== "expense") return acc
      if (m.date < from || m.date > to) return acc
      if (categoryId !== null && m.category_id !== categoryId) return acc
      return acc + effectiveAmount(m, currency)
    }, 0)
  }

  const thisMonth = monthSpend(thisFrom, thisTo)

  const prevMonths: number[] = []
  for (let i = 1; i <= monthsBack; i++) {
    const d = subMonths(ref, i)
    prevMonths.push(monthSpend(format(startOfMonth(d), "yyyy-MM-dd"), format(endOfMonth(d), "yyyy-MM-dd")))
  }

  const avg = prevMonths.length > 0 ? prevMonths.reduce((a, b) => a + b, 0) / prevMonths.length : 0
  const deltaPct = avg !== 0 ? ((thisMonth - avg) / avg) * 100 : null

  return { thisMonth, avg, deltaPct }
}

export interface RecurringProjection {
  monthlyIncome: number
  monthlyExpense: number
}

const FREQUENCY_MULTIPLIERS: Record<string, number> = {
  weekly: 4.33,
  biweekly: 2.17,
  monthly: 1,
  bimonthly: 0.5,
  annual: 1 / 12,
}

/**
 * Sum active recurring transactions normalized to monthly impact.
 */
export function recurringMonthlyProjection(recurring: RecurringTransaction[]): RecurringProjection {
  let monthlyIncome = 0
  let monthlyExpense = 0

  for (const r of recurring) {
    if (r.status !== "active") continue
    if (r.kind === "transfer") continue
    const multiplier = FREQUENCY_MULTIPLIERS[r.frequency] ?? 1
    const monthly = r.amount * multiplier

    if (r.kind === "income") monthlyIncome += monthly
    else monthlyExpense += monthly
  }

  return { monthlyIncome, monthlyExpense }
}
