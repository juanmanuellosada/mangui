"use client"

import { useMemo, useState } from "react"
import { parseISO, format } from "date-fns"
import { es } from "date-fns/locale"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Scale,
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
import { useInflationIndex } from "@/lib/inflation/use-inflation-index"
import { buildIpcMap, latestIpcMonth, adjustAmount } from "@/lib/inflation/adjust"

type Movement = Tables<"movements">
type Category = Tables<"categories">

// ── Shared filter shape passed from the page ──────────────────────────────────

export interface CompareSharedFilter {
  type: "all" | "income" | "expense"
  categoryIds: string[]
  accountIds: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────


/**
 * Renders an inline variation line: arrow + abs delta + optional pct.
 * isGood: true = green, false = red.
 * crossedZero: suppresses pct and shows a short explanatory note instead.
 */
function DeltaLine({
  deltaAbs,
  pct,
  isGood,
  crossedZero = false,
  crossedZeroLabel,
  currency = "ARS",
}: {
  deltaAbs: number
  pct: number | null
  isGood: boolean
  crossedZero?: boolean
  crossedZeroLabel?: string
  currency?: "ARS" | "USD"
}) {
  if (deltaAbs === 0) {
    return <span className="text-xs text-muted-foreground">sin cambios</span>
  }

  const colorClass = isGood ? "text-success" : "text-destructive"
  const arrow = deltaAbs > 0 ? "↑" : "↓"
  const absFormatted = formatCurrency(Math.abs(deltaAbs), currency)

  if (crossedZero) {
    return (
      <span className={cn("text-xs font-medium tabular-nums", colorClass)}>
        {arrow} {absFormatted}{crossedZeroLabel ? <span className="font-normal"> · {crossedZeroLabel}</span> : null}
      </span>
    )
  }

  const sign = deltaAbs > 0 ? "+" : ""
  const pctStr = pct !== null ? ` (${Math.abs(pct).toFixed(0)}% ${deltaAbs > 0 ? "más" : "menos"})` : ""

  return (
    <span className={cn("text-xs font-medium tabular-nums", colorClass)}>
      {arrow} {sign}{absFormatted}{pctStr !== "" ? <span className="font-normal">{pctStr}</span> : null}
    </span>
  )
}

// ── Natural-language summary ──────────────────────────────────────────────────

function NaturalSummary({
  totalsA,
  totalsB,
  period2Label,
  currency = "ARS",
}: {
  totalsA: { income: number; expense: number; net: number }
  totalsB: { income: number; expense: number; net: number }
  period2Label: string
  currency?: "ARS" | "USD"
}) {
  const deltaExpense = totalsA.expense - totalsB.expense
  const deltaNet = totalsA.net - totalsB.net
  const deltaIncome = totalsA.income - totalsB.income

  // Build parts
  const parts: React.ReactNode[] = []

  // Income part
  if (totalsB.income === 0) {
    if (totalsA.income > 0) {
      parts.push(
        <span key="inc">
          Ingresaste{" "}
          <strong className="text-success">{formatCurrency(totalsA.income, currency)}</strong> (sin ingresos en {period2Label})
        </span>
      )
    }
  } else {
    const incPct = deltaIncome / Math.abs(totalsB.income)
    const incGood = deltaIncome > 0
    if (Math.abs(deltaIncome) > 0) {
      parts.push(
        <span key="inc">
          Ingresaste{" "}
          <strong className={incGood ? "text-success" : "text-destructive"}>
            {Math.abs(incPct * 100).toFixed(0)}% {incGood ? "más" : "menos"}
          </strong>
        </span>
      )
    }
  }

  // Expense part
  if (totalsB.expense === 0) {
    if (totalsA.expense > 0) {
      parts.push(
        <span key="exp">
          gastaste{" "}
          <strong className="text-destructive">{formatCurrency(totalsA.expense, currency)}</strong> (sin gastos en {period2Label})
        </span>
      )
    }
  } else if (Math.abs(deltaExpense) > 0) {
    const expPct = deltaExpense / Math.abs(totalsB.expense)
    // spending less = good
    const expGood = deltaExpense < 0
    parts.push(
      <span key="exp">
        gastaste{" "}
        <strong className={expGood ? "text-success" : "text-destructive"}>
          {Math.abs(expPct * 100).toFixed(0)}% {deltaExpense > 0 ? "más" : "menos"}
        </strong>
      </span>
    )
  }

  // Net part
  const netGood = deltaNet > 0
  if (deltaNet !== 0) {
    const absNet = formatCurrency(Math.abs(deltaNet), currency)
    parts.push(
      <span key="net">
        tu balance{" "}
        <strong className={netGood ? "text-success" : "text-destructive"}>
          {netGood ? "mejoró" : "empeoró"} {absNet}
        </strong>
      </span>
    )
  }

  if (parts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-1">
        Sin diferencias respecto de <span className="font-medium text-foreground">{period2Label}</span>.
      </p>
    )
  }

  // Join parts with comma/connector
  const joined: React.ReactNode[] = []
  parts.forEach((part, i) => {
    if (i === 0) {
      // Capitalize first word of first part — just render as-is, already capitalized
      joined.push(part)
    } else if (i === parts.length - 1) {
      joined.push(<span key={`sep-${i}`}> y </span>)
      joined.push(part)
    } else {
      joined.push(<span key={`sep-${i}`}>, </span>)
      joined.push(part)
    }
  })

  return (
    <p className="text-sm px-1">
      {joined}
      {" "}respecto de{" "}
      <span className="font-medium text-foreground">{period2Label}</span>.
    </p>
  )
}

// ── Category bar chart ────────────────────────────────────────────────────────

type CatChartRow = { name: string; p1: number; p2: number }

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
  const [realTerms, setRealTerms] = useState(false)

  const { data: inflationRows = [] } = useInflationIndex()
  const ipc = useMemo(() => buildIpcMap(inflationRows), [inflationRows])
  const refMonth = useMemo(() => latestIpcMonth(ipc), [ipc])

  const adjust = useMemo(
    () =>
      realTerms && refMonth
        ? (amount: number, dateStr: string) => adjustAmount(amount, dateStr, refMonth, ipc)
        : undefined,
    [realTerms, refMonth, ipc]
  )

  const refMonthLabel = useMemo(
    () =>
      refMonth
        ? format(parseISO(refMonth + "-01"), "MMMM yyyy", { locale: es })
        : "",
    [refMonth]
  )

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
    () => periodComparison(movsA, movsB, categories, currency, adjust),
    [movsA, movsB, categories, currency, adjust]
  )

  const { totalsA, totalsB } = comparison

  const hasData = movsA.length > 0 || movsB.length > 0

  // ── Per-category bar chart data (top 6 by combined total) ──
  const catChartConfig = useMemo(() => ({
    p1: {
      label: period1.label ?? "Período 1",
      colors: {
        light: ["oklch(0.748 0.219 131.7)"],
        dark: ["oklch(0.82 0.22 131.7)"],
      },
    },
    p2: {
      label: period2.label ?? "Período 2",
      colors: {
        light: ["oklch(0.65 0.08 250)"],
        dark: ["oklch(0.72 0.07 250)"],
      },
    },
  } satisfies Record<keyof Omit<CatChartRow, "name">, { label: string; colors: { light: string[]; dark: string[] } }>),
  [period1.label, period2.label])

  const catChartData: CatChartRow[] = useMemo(() => {
    return [...comparison.categories]
      .sort((a, b) => (b.a + b.b) - (a.a + a.b))
      .slice(0, 6)
      .map((cat) => ({
        name: cat.name.length > 10 ? cat.name.slice(0, 9) + "…" : cat.name,
        p1: cat.a,
        p2: cat.b,
      }))
  }, [comparison.categories])

  // ── Top increases / decreases ──
  const { topIncreases, topDecreases } = useMemo(() => {
    const sorted = [...comparison.categories].sort((a, b) => b.deltaAbs - a.deltaAbs)
    const topIncreases = sorted.filter((c) => c.deltaAbs > 0).slice(0, 5)
    const topDecreases = [...comparison.categories]
      .sort((a, b) => a.deltaAbs - b.deltaAbs)
      .filter((c) => c.deltaAbs < 0)
      .slice(0, 5)
    return { topIncreases, topDecreases }
  }, [comparison.categories])

  // ── Delta helpers per metric ──
  // For income: up = good
  const incDeltaAbs = totalsA.income - totalsB.income
  const incPct = totalsB.income !== 0 ? Math.abs(incDeltaAbs / Math.abs(totalsB.income)) * 100 : null
  const incGood = incDeltaAbs > 0

  // For expense: down = good (inverted)
  const expDeltaAbs = totalsA.expense - totalsB.expense
  const expPct = totalsB.expense !== 0 ? Math.abs(expDeltaAbs / Math.abs(totalsB.expense)) * 100 : null
  const expGood = expDeltaAbs < 0

  // For net: up = good; detect sign crossing
  const netDeltaAbs = totalsA.net - totalsB.net
  const netPct = totalsB.net !== 0 ? Math.abs(netDeltaAbs / Math.abs(totalsB.net)) * 100 : null
  const netGood = netDeltaAbs > 0
  const netCrossedZero = (totalsA.net >= 0) !== (totalsB.net >= 0)
  const netCrossedLabel = netCrossedZero
    ? totalsA.net >= 0
      ? "pasó de negativo a positivo"
      : "pasó a negativo"
    : undefined

  return (
    <div className="space-y-4">
      {/* Nominal | Real toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 p-0.5 gap-0">
          {(["nominal", "real"] as const).map((option) => {
            const isReal = option === "real"
            const active = isReal ? realTerms : !realTerms
            const disabled = isReal && refMonth === null
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => setRealTerms(isReal)}
                className={cn(
                  "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground",
                  disabled && "opacity-40 cursor-not-allowed pointer-events-none"
                )}
              >
                {isReal ? "Real" : "Nominal"}
              </button>
            )
          })}
        </div>
        {realTerms && refMonthLabel && (
          <span className="text-xs text-muted-foreground">
            En pesos de {refMonthLabel.charAt(0).toUpperCase() + refMonthLabel.slice(1)}
          </span>
        )}
      </div>

      {/* Natural-language summary */}
      {hasData && (
        <NaturalSummary
          totalsA={totalsA}
          totalsB={totalsB}
          period2Label={period2.label ?? "período anterior"}
          currency={currency}
        />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Ingresos */}
        <div className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-success" aria-hidden />
            <p className="text-xs font-semibold text-muted-foreground">Ingresos</p>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[11px] text-muted-foreground truncate mr-1">{period1.label ?? "Período 1"}</span>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {formatCurrency(totalsA.income, currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[11px] text-muted-foreground truncate mr-1">{period2.label ?? "Período 2"}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatCurrency(totalsB.income, currency)}
              </span>
            </div>
          </div>
          <DeltaLine
            deltaAbs={incDeltaAbs}
            pct={incPct}
            isGood={incGood}
            currency={currency}
          />
        </div>

        {/* Gastos */}
        <div className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-2">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" aria-hidden />
            <p className="text-xs font-semibold text-muted-foreground">Gastos</p>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[11px] text-muted-foreground truncate mr-1">{period1.label ?? "Período 1"}</span>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {formatCurrency(totalsA.expense, currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[11px] text-muted-foreground truncate mr-1">{period2.label ?? "Período 2"}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatCurrency(totalsB.expense, currency)}
              </span>
            </div>
          </div>
          <DeltaLine
            deltaAbs={expDeltaAbs}
            pct={expPct}
            isGood={expGood}
            currency={currency}
          />
        </div>

        {/* Balance */}
        <div className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-2">
          <div className="flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <p className="text-xs font-semibold text-muted-foreground">Balance</p>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[11px] text-muted-foreground truncate mr-1">{period1.label ?? "Período 1"}</span>
              <span className={cn("text-sm font-bold tabular-nums", totalsA.net >= 0 ? "text-success" : "text-destructive")}>
                {totalsA.net >= 0 ? "+" : "−"}{formatCurrency(Math.abs(totalsA.net), currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[11px] text-muted-foreground truncate mr-1">{period2.label ?? "Período 2"}</span>
              <span className={cn("text-xs tabular-nums text-muted-foreground")}>
                {totalsB.net >= 0 ? "+" : "−"}{formatCurrency(Math.abs(totalsB.net), currency)}
              </span>
            </div>
          </div>
          <DeltaLine
            deltaAbs={netDeltaAbs}
            pct={netCrossedZero ? null : netPct}
            isGood={netGood}
            crossedZero={netCrossedZero}
            crossedZeroLabel={netCrossedLabel}
            currency={currency}
          />
        </div>
      </div>

      {/* Category comparison bar chart */}
      {catChartData.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-semibold">Por categoría (comparación)</h3>
          <EvilBarChart
            config={catChartConfig}
            data={catChartData}
            barRadius={4}
            barCategoryGap={14}
            className="h-48 sm:h-56"
          >
            <Grid />
            <XAxis dataKey="name" />
            <Bar dataKey="p1" />
            <Bar dataKey="p2" />
            <Tooltip variant="default" />
            <Legend isClickable />
          </EvilBarChart>
        </div>
      )}

      {/* Top increases / decreases */}
      {(topIncreases.length > 0 || topDecreases.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Mayores aumentos */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mayores aumentos</h3>
            {topIncreases.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Sin aumentos</p>
            ) : (
              <div className="space-y-1">
                {topIncreases.map((cat, idx) => (
                  <div key={`inc-${cat.name}-${idx}`} className="flex items-center gap-2 py-1.5">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {cat.icon ? renderCategoryIcon(cat.icon, { className: "text-sm flex-shrink-0" }) : null}
                      <span className="text-xs text-foreground truncate">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {cat.deltaPct !== null && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">
                          +{Math.abs(cat.deltaPct).toFixed(0)}%
                        </span>
                      )}
                      <span className="text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        ↑ +{formatCurrency(cat.deltaAbs, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mayores reducciones */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mayores reducciones</h3>
            {topDecreases.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Sin reducciones</p>
            ) : (
              <div className="space-y-1">
                {topDecreases.map((cat, idx) => (
                  <div key={`dec-${cat.name}-${idx}`} className="flex items-center gap-2 py-1.5">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {cat.icon ? renderCategoryIcon(cat.icon, { className: "text-sm flex-shrink-0" }) : null}
                      <span className="text-xs text-foreground truncate">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {cat.deltaPct !== null && (
                        <span className="text-[10px] text-success">
                          -{Math.abs(cat.deltaPct).toFixed(0)}%
                        </span>
                      )}
                      <span className="text-xs font-semibold tabular-nums text-success">
                        ↓ {formatCurrency(cat.deltaAbs, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
