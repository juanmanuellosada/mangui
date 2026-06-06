"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { filterMovements } from "@/lib/stats"
import { fetchAllMovements } from "@/lib/movements"
import { DateRangeFilter, type DateRangeValue } from "@/components/ui/date-range-filter"
import {
  chartFiltersToStatsFilter,
  dateFromPreset,
  type ChartFilters,
} from "./chart-filter-bar"
import { useDashboardFilters } from "./dashboard-filters"
import { MoneyFlowSankeyChart } from "./money-flow-sankey-chart"
import type { Tables } from "@/lib/database.types"

type Category = Tables<"categories">

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("categories").select("*")
  if (error) throw error
  return data
}

// ─── Wrapper component ────────────────────────────────────────────────────────

export function MoneyFlowSankey() {
  const [date, setDate] = useState<DateRangeValue>(() => dateFromPreset("this_month"))
  const { accountIds, categoryIds } = useDashboardFilters()

  const filters: ChartFilters = { date, accountIds, categoryIds }

  const { data: allMovements, isLoading: loadingMovements } = useQuery({
    queryKey: ["movements", "stats-all"],
    queryFn: fetchAllMovements,
  })

  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  })

  const isLoading = loadingMovements || loadingCategories

  const statsFilter = useMemo(
    () => chartFiltersToStatsFilter(filters, "all"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, accountIds, categoryIds],
  )

  const filtered = useMemo(
    () => (allMovements ? filterMovements(allMovements, statsFilter) : []),
    [allMovements, statsFilter],
  )

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Flujo del mes</h3>
        <DateRangeFilter
          value={date}
          onChange={setDate}
          triggerClassName="min-w-0"
        />
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2 py-2">
          <div className="flex items-center gap-4 h-64">
            <div className="flex flex-col gap-2 w-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="w-2 rounded" style={{ height: `${20 + i * 10}%` }} />
              ))}
            </div>
            <Skeleton className="flex-1 h-full rounded-xl" />
            <div className="flex flex-col gap-2 w-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="w-2 rounded" style={{ height: `${15 + i * 8}%` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {!isLoading && (
        <MoneyFlowSankeyChart
          movements={filtered}
          categories={categories ?? []}
        />
      )}
    </div>
  )
}
