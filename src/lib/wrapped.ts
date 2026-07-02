import { startOfMonth, endOfMonth, subMonths, format, parse } from "date-fns"
import { es } from "date-fns/locale"
import type { Tables } from "./database.types"
import {
  filterMovements,
  summaryTotals,
  categoryDistribution,
  weekdayPattern,
  type Currency,
} from "./stats"
import { adjustAmount, latestIpcMonth, type IpcMap } from "./inflation/adjust"

export type Movement = Tables<"movements">
export type Category = Tables<"categories">

function monthRange(monthRef: string): { from: string; to: string } {
  const d = parse(`${monthRef}-01`, "yyyy-MM-dd", new Date())
  return {
    from: format(startOfMonth(d), "yyyy-MM-dd"),
    to: format(endOfMonth(d), "yyyy-MM-dd"),
  }
}

export interface WrappedTopCategory {
  categoryId: string
  name: string
  icon: string | null
  amount: number
  percent: number
}

export interface WrappedRealVsNominal {
  nominal: number
  adjusted: number | null
  deltaPct: number | null
}

export interface WrappedVsPreviousMonth {
  previousExpense: number
  deltaPct: number | null
}

export interface WrappedTopWeekday {
  weekday: string
  total: number
}

export interface WrappedData {
  monthRef: string // "yyyy-MM"
  monthLabel: string // "julio de 2026"
  hasData: boolean
  totalExpense: number
  totalIncome: number
  net: number
  movementsCount: number
  topCategories: WrappedTopCategory[]
  realVsNominal: WrappedRealVsNominal
  vsPreviousMonth: WrappedVsPreviousMonth | null
  topWeekday: WrappedTopWeekday | null
}

export interface WrappedOptions {
  currency?: Currency
  /** Mapa "yyyy-MM" -> IPC. Si se provee, se calcula el gasto ajustado por inflación. */
  ipc?: IpcMap
  /** Movimientos (sin filtrar) que incluyen el mes anterior a `monthRef`, para calcular el Δ%. */
  previousMonthMovements?: Movement[]
}

/**
 * Computa las métricas del "wrapped" de un mes a partir de movimientos y categorías.
 * Función pura: no hace fetch ni depende de la fecha actual (salvo lo que el caller pase).
 * Filtra automáticamente a movimientos no-futuros dentro de `monthRef`.
 */
export function buildWrappedData(
  movements: Movement[],
  categories: Category[],
  monthRef: string,
  opts: WrappedOptions = {}
): WrappedData {
  const { currency, ipc, previousMonthMovements } = opts
  const { from, to } = monthRange(monthRef)
  const monthMovements = filterMovements(movements, { dateFrom: from, dateTo: to })

  const monthDate = parse(`${monthRef}-01`, "yyyy-MM-dd", new Date())
  const monthLabel = format(monthDate, "MMMM 'de' yyyy", { locale: es })

  const totals = summaryTotals(monthMovements, currency)
  const movementsCount = monthMovements.length
  const hasData = movementsCount > 0

  const topCategories: WrappedTopCategory[] = categoryDistribution(
    monthMovements,
    "expense",
    categories,
    currency
  )
    .slice(0, 3)
    .map((c) => ({
      categoryId: c.categoryId,
      name: c.name,
      icon: c.icon ?? null,
      amount: c.total,
      percent: c.percent,
    }))

  // Gasto real (ajustado por IPC al último mes disponible) vs nominal
  let adjusted: number | null = null
  let deltaPctReal: number | null = null
  if (ipc) {
    const refMonth = latestIpcMonth(ipc)
    if (refMonth) {
      const adjustedTotals = summaryTotals(monthMovements, currency, (amount, dateStr) =>
        adjustAmount(amount, dateStr, refMonth, ipc)
      )
      adjusted = adjustedTotals.expense
      deltaPctReal = totals.expense !== 0 ? ((adjusted - totals.expense) / totals.expense) * 100 : null
    }
  }

  // Δ% vs mes anterior
  let vsPreviousMonth: WrappedVsPreviousMonth | null = null
  if (previousMonthMovements) {
    const prevMonthDate = subMonths(monthDate, 1)
    const prevRef = format(prevMonthDate, "yyyy-MM")
    const { from: prevFrom, to: prevTo } = monthRange(prevRef)
    const prevMonthMovs = filterMovements(previousMonthMovements, { dateFrom: prevFrom, dateTo: prevTo })
    const prevTotals = summaryTotals(prevMonthMovs, currency)
    vsPreviousMonth = {
      previousExpense: prevTotals.expense,
      deltaPct: prevTotals.expense !== 0 ? ((totals.expense - prevTotals.expense) / prevTotals.expense) * 100 : null,
    }
  }

  // Día de la semana con mayor gasto
  const weekdays = weekdayPattern(monthMovements, currency)
  const topWeekdayCandidate = weekdays.reduce<WrappedTopWeekday | null>((max, w) => {
    if (!max || w.total > max.total) return w
    return max
  }, null)
  const topWeekday = topWeekdayCandidate && topWeekdayCandidate.total > 0 ? topWeekdayCandidate : null

  return {
    monthRef,
    monthLabel,
    hasData,
    totalExpense: totals.expense,
    totalIncome: totals.income,
    net: totals.net,
    movementsCount,
    topCategories,
    realVsNominal: { nominal: totals.expense, adjusted, deltaPct: deltaPctReal },
    vsPreviousMonth,
    topWeekday,
  }
}
