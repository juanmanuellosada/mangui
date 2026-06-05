"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { formatCurrency } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart3 } from "lucide-react"
import {
  EvilBarChart,
  Bar,
  XAxis,
  Grid,
  Tooltip,
  Legend,
} from "@/components/evilcharts/charts/bar-chart"
import {
  startOfMonth,
  endOfMonth,
  format,
  eachMonthOfInterval,
  parseISO,
} from "date-fns"
import { es } from "date-fns/locale"
import { filterMovements } from "@/lib/stats"
import { fetchAllMovements } from "@/lib/movements"
import { DateRangeFilter, type DateRangeValue } from "@/components/ui/date-range-filter"
import {
  chartFiltersToStatsFilter,
  dateFromLastN,
  type ChartFilters,
} from "./chart-filter-bar"
import { useDashboardFilters } from "./dashboard-filters"


type BarRow = { mes: string; ingresos: number; gastos: number }

const barChartConfig = {
  ingresos: {
    label: "Ingresos",
    colors: {
      light: ["oklch(0.748 0.219 131.7)"],
      dark: ["oklch(0.78 0.22 131.7)"],
    },
  },
  gastos: {
    label: "Gastos",
    colors: {
      light: ["oklch(0.577 0.245 27.325)"],
      dark: ["oklch(0.704 0.191 22.216)"],
    },
  },
} satisfies Record<keyof Omit<BarRow, "mes">, { label: string; colors: { light: string[]; dark: string[] } }>

export function IncomeExpenseChart() {
  const [date, setDate] = useState<DateRangeValue>(() => dateFromLastN(6, "months"))
  const { accountIds, categoryIds } = useDashboardFilters()

  const filters: ChartFilters = { date, accountIds, categoryIds }

  const { data: allMovements, isLoading } = useQuery({
    queryKey: ["movements", "stats-all"],
    queryFn: fetchAllMovements,
  })

  const statsFilter = useMemo(
    () => chartFiltersToStatsFilter(filters, "all"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, accountIds, categoryIds],
  )

  const filtered = useMemo(
    () => (allMovements ? filterMovements(allMovements, statsFilter) : []),
    [allMovements, statsFilter],
  )

  const chartData: BarRow[] = useMemo(() => {
    if (!filtered.length) return []

    // Determine the month range to display
    let rangeStart: Date
    let rangeEnd: Date

    if (date.from && date.to) {
      rangeStart = startOfMonth(parseISO(date.from))
      rangeEnd = endOfMonth(parseISO(date.to))
    } else {
      // Fallback: derive range from the filtered movements themselves
      const dates = filtered.map((m) => m.date).sort()
      if (dates.length === 0) return []
      rangeStart = startOfMonth(parseISO(dates[0]))
      rangeEnd = endOfMonth(parseISO(dates[dates.length - 1]))
    }

    const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd })

    return months.map((monthDate) => {
      const from = format(startOfMonth(monthDate), "yyyy-MM-dd")
      const to = format(endOfMonth(monthDate), "yyyy-MM-dd")

      let ingresos = 0
      let gastos = 0
      for (const m of filtered) {
        if (m.date < from || m.date > to) continue
        const amount = m.converted_amount ?? m.amount
        if (m.type === "income") ingresos += amount
        else gastos += amount
      }

      return {
        mes: format(monthDate, "MMM", { locale: es }),
        ingresos: Math.round(ingresos),
        gastos: Math.round(gastos),
      }
    })
  }, [filtered, date])

  const hasData = chartData.some((r) => r.ingresos > 0 || r.gastos > 0)

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ingresos vs Gastos</h3>
        <DateRangeFilter
          value={date}
          onChange={setDate}
          triggerClassName="min-w-0"
        />
      </div>

      {isLoading && (
        <div className="space-y-2 py-2">
          <div className="flex items-end gap-2 h-32">
            {[...Array(6)].map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t-md"
                style={{ height: `${40 + (i * 10)}%` }}
              />
            ))}
          </div>
          <div className="flex gap-3 justify-center">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      )}

      {!isLoading && !hasData && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Sin movimientos para el período y filtros seleccionados.
          </p>
        </div>
      )}

      {!isLoading && hasData && (
        <EvilBarChart
          config={barChartConfig}
          data={chartData}
          barRadius={4}
          barCategoryGap={12}
          animationType="left-to-right"
          className="h-44 sm:h-52 md:h-56"
        >
          <Grid />
          <XAxis dataKey="mes" />
          <Bar dataKey="ingresos" />
          <Bar dataKey="gastos" />
          <Tooltip
            variant="default"
          />
          <Legend isClickable />
        </EvilBarChart>
      )}

      {/* Summary row — last month in range */}
      {!isLoading && hasData && (() => {
        const lastMonth = chartData[chartData.length - 1]
        if (!lastMonth) return null
        const diff = lastMonth.ingresos - lastMonth.gastos
        return (
          <div className="flex gap-4 pt-2 text-xs border-t border-border/40">
            <div className="flex-1 text-center">
              <p className="text-muted-foreground mb-0.5">Ingresos</p>
              <p className="font-semibold tabular-nums text-success">
                {formatCurrency(lastMonth.ingresos, "ARS")}
              </p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-muted-foreground mb-0.5">Gastos</p>
              <p className="font-semibold tabular-nums text-destructive">
                {formatCurrency(lastMonth.gastos, "ARS")}
              </p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-muted-foreground mb-0.5">Balance</p>
              <p
                className={`font-semibold tabular-nums ${diff >= 0 ? "text-success" : "text-destructive"}`}
              >
                {diff >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(diff), "ARS")}
              </p>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
