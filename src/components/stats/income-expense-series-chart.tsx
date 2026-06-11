"use client"

import { BarChart3 } from "lucide-react"
import {
  EvilBarChart,
  Bar,
  XAxis,
  Grid,
  Tooltip,
  Legend,
} from "@/components/evilcharts/charts/bar-chart"
import { formatCurrency } from "@/lib/utils"
import type { PeriodPoint } from "@/lib/stats"

interface IncomeExpenseSeriesChartProps {
  data: PeriodPoint[]
  currency?: "ARS" | "USD"
}

const chartConfig = {
  income: {
    label: "Ingresos",
    colors: {
      light: ["oklch(0.748 0.219 131.7)"],
      dark: ["oklch(0.82 0.22 131.7)"],
    },
  },
  expense: {
    label: "Gastos",
    colors: {
      light: ["oklch(0.577 0.245 27.325)"],
      dark: ["oklch(0.704 0.191 22.216)"],
    },
  },
}

export function IncomeExpenseSeriesChart({ data, currency = "ARS" }: IncomeExpenseSeriesChartProps) {
  const hasData = data.some((d) => d.income > 0 || d.expense > 0)

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Evolución del balance</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30" aria-hidden />
          <p className="text-sm text-muted-foreground">Sin movimientos en el período.</p>
        </div>
      </div>
    )
  }

  // Transform data keys to match config
  const chartData = data.map((d) => ({
    mes: d.period,
    income: d.income,
    expense: d.expense,
  }))

  const current = data[data.length - 1]

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Evolución del balance</h3>
        <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
          por mes
        </span>
      </div>

      <EvilBarChart
        config={chartConfig}
        data={chartData}
        barRadius={4}
        barCategoryGap={12}
        animationType="left-to-right"
        className="h-52"
      >
        <Grid />
        <XAxis dataKey="mes" />
        <Bar dataKey="income" />
        <Bar dataKey="expense" />
        <Tooltip variant="default" />
        <Legend isClickable />
      </EvilBarChart>

      {current && (
        <div className="flex gap-2 sm:gap-3 pt-2 text-[11px] sm:text-xs border-t border-border/40">
          <div className="flex-1 min-w-0 text-center">
            <p className="text-muted-foreground mb-0.5">Ingresos</p>
            <p className="font-semibold tabular-nums text-success">
              +{formatCurrency(current.income, currency)}
            </p>
          </div>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-muted-foreground mb-0.5">Gastos</p>
            <p className="font-semibold tabular-nums text-destructive">
              -{formatCurrency(current.expense, currency)}
            </p>
          </div>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-muted-foreground mb-0.5">Balance</p>
            <p className={`font-semibold tabular-nums ${current.net >= 0 ? "text-success" : "text-destructive"}`}>
              {current.net >= 0 ? "+" : "-"}{formatCurrency(Math.abs(current.net), currency)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
