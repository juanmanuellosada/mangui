"use client"

import { useMemo, useState } from "react"
import { BarChart3, TrendingUp, TrendingDown, Scale, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  EvilBarChart,
  Bar,
  XAxis,
  Grid,
  Tooltip,
  Legend,
} from "@/components/evilcharts/charts/bar-chart"
import { formatCurrency, cn } from "@/lib/utils"
import {
  filterMovements,
  periodComparison,
  summaryTotals,
} from "@/lib/stats"
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  format,
} from "date-fns"
import { es } from "date-fns/locale"
import type { Tables } from "@/lib/database.types"
import Link from "next/link"

type Movement = Tables<"movements">
type Category = Tables<"categories">

type ComparisonPeriodType = "mes" | "trimestre"

interface CompareTabProps {
  movements: Movement[]
  categories: Category[]
  currency?: "ARS" | "USD"
}

function getPeriodRange(periodType: ComparisonPeriodType, offset: number): { from: string; to: string; label: string } {
  const now = new Date()
  if (periodType === "mes") {
    const d = subMonths(now, offset)
    return {
      from: format(startOfMonth(d), "yyyy-MM-dd"),
      to: format(endOfMonth(d), "yyyy-MM-dd"),
      label: format(d, "MMMM yyyy", { locale: es }),
    }
  } else {
    const d = subQuarters(now, offset)
    const from = startOfQuarter(d)
    const to = endOfQuarter(d)
    return {
      from: format(from, "yyyy-MM-dd"),
      to: format(to, "yyyy-MM-dd"),
      label: `T${Math.ceil((from.getMonth() + 1) / 3)} ${from.getFullYear()}`,
    }
  }
}

function DeltaBadge({ pct, inverted = false }: { pct: number | null; inverted?: boolean }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>
  const isGood = inverted ? pct < 0 : pct > 0
  const icon = pct > 0 ? "↑" : "↓"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-full",
        isGood ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
      )}
      aria-label={`${pct > 0 ? "Subió" : "Bajó"} ${Math.abs(pct).toFixed(1)}%`}
    >
      {icon} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

type CompareChartRow = { label: string; periodoA: number; periodoB: number }

const compareChartConfig = {
  periodoA: {
    label: "Período A",
    colors: {
      light: ["oklch(0.748 0.219 131.7)"],
      dark: ["oklch(0.82 0.22 131.7)"],
    },
  },
  periodoB: {
    label: "Período B",
    colors: {
      light: ["oklch(0.714 0.213 47.6)"],
      dark: ["oklch(0.78 0.21 47.6)"],
    },
  },
} satisfies Record<keyof Omit<CompareChartRow, "label">, { label: string; colors: { light: string[]; dark: string[] } }>

export function CompareTab({ movements, categories, currency = "ARS" }: CompareTabProps) {
  const [periodType, setPeriodType] = useState<ComparisonPeriodType>("mes")

  const rangeA = useMemo(() => getPeriodRange(periodType, 0), [periodType])
  const rangeB = useMemo(() => getPeriodRange(periodType, 1), [periodType])

  const movsA = useMemo(
    () => filterMovements(movements, { dateFrom: rangeA.from, dateTo: rangeA.to }),
    [movements, rangeA]
  )
  const movsB = useMemo(
    () => filterMovements(movements, { dateFrom: rangeB.from, dateTo: rangeB.to }),
    [movements, rangeB]
  )

  const comparison = useMemo(
    () => periodComparison(movsA, movsB, categories, currency),
    [movsA, movsB, categories, currency]
  )

  const { totalsA, totalsB } = comparison

  const chartData: CompareChartRow[] = [
    { label: "Ingresos", periodoA: totalsA.income, periodoB: totalsB.income },
    { label: "Gastos", periodoA: totalsA.expense, periodoB: totalsB.expense },
    { label: "Balance", periodoA: Math.max(totalsA.net, 0), periodoB: Math.max(totalsB.net, 0) },
  ]

  const hasData = movsA.length > 0 || movsB.length > 0

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl border border-border bg-muted p-0.5 gap-0.5">
          {(["mes", "trimestre"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodType(p)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 capitalize cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                periodType === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p === "mes" ? "Mes" : "Trimestre"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-2 text-xs text-muted-foreground">
          <span className="font-medium capitalize text-foreground">{rangeA.label}</span>
          <span>vs</span>
          <span className="capitalize">{rangeB.label}</span>
        </div>
      </div>

      {/* Summary cards with deltas */}
      <div className="grid grid-cols-3 gap-3">
        {/* Ingresos */}
        <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-1.5">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-success" aria-hidden />
            <p className="text-[11px] font-medium text-muted-foreground">Ingresos</p>
          </div>
          <p className="text-sm font-bold tabular-nums text-success">
            +{formatCurrency(totalsA.income, currency)}
          </p>
          <div className="flex items-center gap-1.5">
            <DeltaBadge pct={comparison.deltaPctIncome} />
          </div>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            ant.: {formatCurrency(totalsB.income, currency)}
          </p>
        </div>

        {/* Gastos */}
        <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-1.5">
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" aria-hidden />
            <p className="text-[11px] font-medium text-muted-foreground">Gastos</p>
          </div>
          <p className="text-sm font-bold tabular-nums text-destructive">
            -{formatCurrency(totalsA.expense, currency)}
          </p>
          <div className="flex items-center gap-1.5">
            <DeltaBadge pct={comparison.deltaPctExpense} inverted />
          </div>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            ant.: {formatCurrency(totalsB.expense, currency)}
          </p>
        </div>

        {/* Balance */}
        <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-1.5">
          <div className="flex items-center gap-1">
            <Scale className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <p className="text-[11px] font-medium text-muted-foreground">Balance</p>
          </div>
          <p className={cn("text-sm font-bold tabular-nums", totalsA.net >= 0 ? "text-success" : "text-destructive")}>
            {totalsA.net >= 0 ? "+" : "-"}{formatCurrency(Math.abs(totalsA.net), currency)}
          </p>
          <div className="flex items-center gap-1.5">
            <DeltaBadge pct={comparison.deltaPctNet} />
          </div>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            ant.: {totalsB.net >= 0 ? "+" : "-"}{formatCurrency(Math.abs(totalsB.net), currency)}
          </p>
        </div>
      </div>

      {/* Grouped bar chart */}
      {hasData && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">Ingresos vs Gastos</h3>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary inline-block" aria-hidden />
              {rangeA.label}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent inline-block" aria-hidden />
              {rangeB.label}
            </span>
          </div>
          <EvilBarChart
            config={compareChartConfig}
            data={chartData}
            barRadius={4}
            barCategoryGap={16}
            className="h-48"
          >
            <Grid />
            <XAxis dataKey="label" />
            <Bar dataKey="periodoA" />
            <Bar dataKey="periodoB" />
            <Tooltip variant="default" />
            <Legend isClickable />
          </EvilBarChart>
        </div>
      )}

      {/* Per-category list */}
      {comparison.categories.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">Por categoría</h3>
          <p className="text-[10px] text-muted-foreground">Gastos por categoría para el período seleccionado</p>
          <div className="space-y-1">
            {comparison.categories.map((cat, idx) => (
              <Link
                key={`${cat.name}-${idx}`}
                href={`/app/movements?type=expense`}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{cat.name}</p>
                </div>
                <div className="text-right min-w-0">
                  <p className="text-xs font-semibold tabular-nums">{formatCurrency(cat.a, currency)}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    ant.: {formatCurrency(cat.b, currency)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <DeltaBadge pct={cat.deltaPct} inverted />
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      )}

      {!hasData && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center rounded-2xl border border-border/60 bg-card">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30" aria-hidden />
          <p className="text-sm text-muted-foreground">Sin datos para comparar en estos períodos.</p>
        </div>
      )}
    </div>
  )
}
