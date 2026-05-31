"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
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
import type { Tables } from "@/lib/database.types"
import { startOfMonth, endOfMonth, format } from "date-fns"

type Movement = Tables<"movements">
type Category = Tables<"categories">

async function fetchCurrentMonthMovements(): Promise<Movement[]> {
  const supabase = createClient()
  const now = new Date()
  const from = format(startOfMonth(now), "yyyy-MM-dd")
  const to = format(endOfMonth(now), "yyyy-MM-dd")
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .eq("type", "expense")
    .gte("date", from)
    .lte("date", to)
  if (error) throw error
  return data
}

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
  if (error) throw error
  return data
}

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
  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: ["movements", "current-month-expenses"],
    queryFn: fetchCurrentMonthMovements,
  })

  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  })

  const isLoading = loadingMovements || loadingCategories

  const { chartData, config, totalExpenses } = useMemo(() => {
    if (!movements || !categories) return { chartData: [], config: {} as ChartConfig, totalExpenses: 0 }

    const catMap = new Map(categories.map((c) => [c.id, c]))

    // Sum by category
    const totals = new Map<string, number>()
    let total = 0
    for (const m of movements) {
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
      const name =
        key === "__none__"
          ? "Sin categoría"
          : (catMap.get(key)?.name ?? "Sin categoría")
      rows.push({ name, value: Math.round(value * 100) / 100 })
      cfg[name] = {
        label: name,
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
  }, [movements, categories])

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Gastos por categoría</h3>
        <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
          Este mes
        </span>
      </div>

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

      {!isLoading && chartData.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
          <PieChart className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Sin gastos este mes todavía.
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
              className="h-52"
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
