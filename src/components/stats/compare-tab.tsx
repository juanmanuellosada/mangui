"use client"

import { useMemo } from "react"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Scale,
  ChevronRight,
} from "lucide-react"
import {
  EvilBarChart,
  Bar,
  XAxis,
  Grid,
  Tooltip,
  Legend,
} from "@/components/evilcharts/charts/bar-chart"
import { type DateRangeValue } from "@/components/ui/date-range-filter"
import { formatCurrency, cn } from "@/lib/utils"
import {
  filterMovements,
  periodComparison,
} from "@/lib/stats"
import { renderCategoryIcon } from "@/lib/categories"
import type { Tables } from "@/lib/database.types"
import Link from "next/link"

type Movement = Tables<"movements">
type Category = Tables<"categories">

// ── Shared filter shape passed from the page ──────────────────────────────────

export interface CompareSharedFilter {
  type: "all" | "income" | "expense"
  categoryIds: string[]
  accountIds: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    label: "Período 1",
    colors: {
      light: ["oklch(0.748 0.219 131.7)"],
      dark: ["oklch(0.82 0.22 131.7)"],
    },
  },
  periodoB: {
    label: "Período 2",
    colors: {
      light: ["oklch(0.714 0.213 47.6)"],
      dark: ["oklch(0.78 0.21 47.6)"],
    },
  },
} satisfies Record<keyof Omit<CompareChartRow, "label">, { label: string; colors: { light: string[]; dark: string[] } }>

// ── Props ─────────────────────────────────────────────────────────────────────

interface CompareTabProps {
  movements: Movement[]
  categories: Category[]
  currency?: "ARS" | "USD"
  period1: DateRangeValue
  period2: DateRangeValue
  sharedFilter: CompareSharedFilter
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CompareTab({ movements, categories, currency = "ARS", period1, period2, sharedFilter }: CompareTabProps) {
  // Build StatsFilter for each period, applying shared non-date filters
  const statsFilter1 = useMemo(() => ({
    dateFrom: period1.from ?? undefined,
    dateTo: period1.to ?? undefined,
    categoryIds: sharedFilter.categoryIds.length > 0 ? sharedFilter.categoryIds : undefined,
    accountIds: sharedFilter.accountIds.length > 0 ? sharedFilter.accountIds : undefined,
    type: "all" as const,
    currency: currency !== "ARS" ? (currency as "USD") : undefined,
  }), [period1, sharedFilter, currency])

  const statsFilter2 = useMemo(() => ({
    dateFrom: period2.from ?? undefined,
    dateTo: period2.to ?? undefined,
    categoryIds: sharedFilter.categoryIds.length > 0 ? sharedFilter.categoryIds : undefined,
    accountIds: sharedFilter.accountIds.length > 0 ? sharedFilter.accountIds : undefined,
    type: "all" as const,
    currency: currency !== "ARS" ? (currency as "USD") : undefined,
  }), [period2, sharedFilter, currency])

  const movsA = useMemo(
    () => filterMovements(movements, statsFilter1),
    [movements, statsFilter1]
  )
  const movsB = useMemo(
    () => filterMovements(movements, statsFilter2),
    [movements, statsFilter2]
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
      {/* Period label summary */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
        <span className="font-medium text-foreground">{period1.label}</span>
        <span>vs</span>
        <span>{period2.label}</span>
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
            per. 2: {formatCurrency(totalsB.income, currency)}
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
            per. 2: {formatCurrency(totalsB.expense, currency)}
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
            per. 2: {totalsB.net >= 0 ? "+" : "-"}{formatCurrency(Math.abs(totalsB.net), currency)}
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
              {period1.label}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent inline-block" aria-hidden />
              {period2.label}
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
          <p className="text-[10px] text-muted-foreground">Gastos por categoría — período 1 vs período 2</p>
          <div className="space-y-1">
            {comparison.categories.map((cat, idx) => (
              <Link
                key={`${cat.name}-${idx}`}
                href={`/app/movimientos?type=expense`}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {cat.icon ? renderCategoryIcon(cat.icon, { className: "text-sm flex-shrink-0" }) : null}
                  <p className="text-xs font-medium truncate">{cat.name}</p>
                </div>
                <div className="text-right min-w-0">
                  <p className="text-xs font-semibold tabular-nums">{formatCurrency(cat.a, currency)}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    per. 2: {formatCurrency(cat.b, currency)}
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
