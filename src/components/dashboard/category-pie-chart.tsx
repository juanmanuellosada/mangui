"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { formatCurrency } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { PieChart } from "lucide-react"
import {
  EvilPieChart,
  Pie,
  Tooltip,
  Legend,
} from "@/components/evilcharts/charts/pie-chart"
import type { ChartConfig } from "@/components/evilcharts/ui/chart"
import { renderCategoryIcon } from "@/lib/categories"
import { filterMovements } from "@/lib/stats"
import { fetchAllMovements } from "@/lib/movements"
import { DateRangeFilter, type DateRangeValue } from "@/components/ui/date-range-filter"
import {
  chartFiltersToStatsFilter,
  dateFromPreset,
  type ChartFilters,
} from "./chart-filter-bar"
import { useDashboardFilters } from "./dashboard-filters"
import { useCategories } from "@/lib/hooks/use-categories"
import { QueryError } from "@/components/ui/query-error"

// Accessible palette that works in both light and dark modes
const CATEGORY_COLORS_LIGHT = [
  "oklch(0.748 0.219 131.7)",   // lime primary
  "oklch(0.714 0.213 47.6)",    // orange
  "oklch(0.60 0.15 185)",       // teal
  "oklch(0.75 0.18 95)",        // yellow-green
  "oklch(0.55 0.18 300)",       // purple
  "oklch(0.6 0.22 20)",         // red-orange
  "oklch(0.65 0.18 220)",       // blue
]

const CATEGORY_COLORS_DARK = [
  "oklch(0.82 0.22 131.7)",     // lime bright
  "oklch(0.78 0.21 47.6)",      // orange bright
  "oklch(0.72 0.16 185)",       // teal bright
  "oklch(0.84 0.19 95)",        // yellow-green bright
  "oklch(0.65 0.20 300)",       // purple bright
  "oklch(0.72 0.24 20)",        // red-orange bright
  "oklch(0.74 0.20 220)",       // blue bright
]

const TOP_N = 5

export function CategoryPieChart() {
  const [date, setDate] = useState<DateRangeValue>(() => dateFromPreset("this_month"))
  const { accountIds, categoryIds } = useDashboardFilters()

  const filters: ChartFilters = { date, accountIds, categoryIds }

  const {
    data: allMovements,
    isLoading: loadingMovements,
    isError: movementsError,
    refetch: refetchMovements,
  } = useQuery({
    queryKey: ["movements", "stats-all"],
    queryFn: fetchAllMovements,
  })

  const {
    data: categories,
    isLoading: loadingCategories,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useCategories({ orderBy: "none" })

  const isLoading = loadingMovements || loadingCategories
  const isError = movementsError || categoriesError
  const retry = () => {
    refetchMovements()
    refetchCategories()
  }

  const statsFilter = useMemo(
    () => chartFiltersToStatsFilter(filters, "expense"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, accountIds, categoryIds],
  )

  const filtered = useMemo(
    () => (allMovements ? filterMovements(allMovements, statsFilter) : []),
    [allMovements, statsFilter],
  )

  const { chartData, config, totalExpenses } = useMemo(() => {
    if (!filtered.length || !categories) return { chartData: [], config: {} as ChartConfig, totalExpenses: 0 }

    const catMap = new Map(categories.map((c) => [c.id, c]))

    // Sum by category
    const totals = new Map<string, number>()
    let total = 0
    for (const m of filtered) {
      const amount = m.converted_amount ?? m.amount
      total += amount
      const key = m.category_id ?? "__none__"
      totals.set(key, (totals.get(key) ?? 0) + amount)
    }

    // Sort desc, take top N + "Otros"
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, TOP_N)
    const rest = sorted.slice(TOP_N)

    const rows: { name: string; value: number }[] = []
    const cfg: ChartConfig = {}

    top.forEach(([key, value], idx) => {
      const cat = catMap.get(key)
      const name =
        key === "__none__"
          ? "Sin categoría"
          : (cat?.name ?? "Sin categoría")
      const emoji = key !== "__none__" ? (cat?.icon ?? null) : null
      rows.push({ name, value: Math.round(value * 100) / 100 })
      cfg[name] = {
        label: name,
        ...(emoji ? { icon: () => renderCategoryIcon(emoji, { size: "h-3.5 w-3.5", className: "text-sm" }) } : {}),
        colors: {
          light: [CATEGORY_COLORS_LIGHT[idx % CATEGORY_COLORS_LIGHT.length]],
          dark: [CATEGORY_COLORS_DARK[idx % CATEGORY_COLORS_DARK.length]],
        },
      }
    })

    if (rest.length > 0) {
      const othersValue = rest.reduce((s, [, v]) => s + v, 0)
      rows.push({ name: "Otros", value: Math.round(othersValue * 100) / 100 })
      cfg["Otros"] = {
        label: "Otros",
        colors: {
          light: [CATEGORY_COLORS_LIGHT[TOP_N % CATEGORY_COLORS_LIGHT.length]],
          dark: [CATEGORY_COLORS_DARK[TOP_N % CATEGORY_COLORS_DARK.length]],
        },
      }
    }

    return { chartData: rows, config: cfg, totalExpenses: total }
  }, [filtered, categories])

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Gastos por categoría</h3>
      </div>

      {/* Date filter */}
      <DateRangeFilter
        value={date}
        onChange={setDate}
        triggerClassName="w-full min-w-0"
      />

      {isLoading && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Skeleton className="h-36 w-36 rounded-full" />
          <div className="space-y-1.5 w-full">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
        </div>
      )}

      {!isLoading && isError && <QueryError onRetry={retry} />}

      {!isLoading && !isError && chartData.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
          <PieChart className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Sin gastos para el período y filtros seleccionados.
          </p>
        </div>
      )}

      {!isLoading && chartData.length > 0 && (
        <>
          {/* Center label inside donut */}
          <div className="relative">
            <EvilPieChart
              config={config}
              data={chartData}
              dataKey="value"
              nameKey="name"
              className="h-44 sm:h-52 md:h-56"
            >
              <Pie
                innerRadius="52%"
                outerRadius="78%"
                cornerRadius={4}
                paddingAngle={2}
                isClickable
              />
              <Tooltip />
              <Legend variant="rounded-square" />
            </EvilPieChart>
          </div>

          {/* Total below chart */}
          <div className="flex items-center justify-between border-t border-border/40 pt-3">
            <p className="text-xs text-muted-foreground">Total gastos</p>
            <p className="text-sm font-bold tabular-nums">
              {formatCurrency(totalExpenses, "ARS")}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
