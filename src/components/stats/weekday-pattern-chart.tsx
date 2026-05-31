"use client"

import { BarChart3 } from "lucide-react"
import {
  EvilBarChart,
  Bar,
  XAxis,
  Grid,
  Tooltip,
} from "@/components/evilcharts/charts/bar-chart"
import { formatCurrency } from "@/lib/utils"
import type { WeekdayPoint } from "@/lib/stats"

interface WeekdayPatternChartProps {
  data: WeekdayPoint[]
  currency?: "ARS" | "USD"
}

const chartConfig = {
  total: {
    label: "Gastos",
    colors: {
      light: ["oklch(0.714 0.213 47.6)"],
      dark: ["oklch(0.78 0.21 47.6)"],
    },
  },
}

export function WeekdayPatternChart({ data, currency = "ARS" }: WeekdayPatternChartProps) {
  const hasData = data.some((d) => d.total > 0)
  const maxVal = Math.max(...data.map((d) => d.total))
  const maxDay = data.find((d) => d.total === maxVal)

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">Patrón por día de la semana</h3>
        <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30" aria-hidden />
          <p className="text-sm text-muted-foreground">Sin gastos en el período.</p>
        </div>
      </div>
    )
  }

  const chartData = data.map((d) => ({
    dia: d.weekday,
    total: d.total,
  }))

  const weekTotal = data.reduce((sum, d) => sum + d.total, 0)
  const maxDayPct = maxDay && weekTotal > 0 ? Math.round((maxDay.total / weekTotal) * 100) : 0

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Patrón por día de la semana</h3>
        {maxDay && (
          <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium capitalize">
            Más: {maxDay.weekday}
          </span>
        )}
      </div>

      <EvilBarChart
        config={chartConfig}
        data={chartData}
        barRadius={4}
        barCategoryGap={8}
        className="h-44"
      >
        <Grid />
        <XAxis dataKey="dia" />
        <Bar dataKey="total" />
        <Tooltip variant="default" />
      </EvilBarChart>

      {maxDay && (
        <p className="text-xs text-muted-foreground capitalize">
          {maxDay.weekday}{" "}
          <span className="lowercase">
            concentra el {maxDayPct}% de tu gasto semanal.
          </span>
        </p>
      )}
    </div>
  )
}

interface WeekdayPatternChartSimpleProps {
  data: WeekdayPoint[]
  currency?: "ARS" | "USD"
}

/**
 * Compact bar list version (no evilcharts dependency) for fallback or side-by-side.
 */
export function WeekdayPatternBars({ data, currency = "ARS" }: WeekdayPatternChartSimpleProps) {
  const maxVal = Math.max(...data.map((d) => d.total), 1)
  const hasData = data.some((d) => d.total > 0)

  if (!hasData) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm text-muted-foreground text-center py-4">Sin gastos en el período.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.weekday} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-8 capitalize flex-shrink-0">{d.weekday}</span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300 motion-reduce:transition-none"
              style={{ width: `${(d.total / maxVal) * 100}%` }}
              role="progressbar"
              aria-valuenow={d.total}
              aria-valuemax={maxVal}
              aria-label={`${d.weekday}: ${formatCurrency(d.total, currency)}`}
            />
          </div>
          <span className="text-xs tabular-nums text-right w-28 flex-shrink-0">
            {formatCurrency(d.total, currency)}
          </span>
        </div>
      ))}
    </div>
  )
}
