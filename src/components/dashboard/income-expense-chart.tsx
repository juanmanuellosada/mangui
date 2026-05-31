"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
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
import type { Tables } from "@/lib/database.types"
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns"
import { es } from "date-fns/locale"

type Movement = Tables<"movements">
type MovementSlim = Pick<Movement, "id" | "type" | "amount" | "converted_amount" | "date">

const MONTHS = 6

async function fetchMonthsMovements(): Promise<MovementSlim[]> {
  const supabase = createClient()
  const now = new Date()
  const from = format(startOfMonth(subMonths(now, MONTHS - 1)), "yyyy-MM-dd")
  const to = format(endOfMonth(now), "yyyy-MM-dd")
  const { data, error } = await supabase
    .from("movements")
    .select("id, type, amount, converted_amount, date")
    .gte("date", from)
    .lte("date", to)
  if (error) throw error
  return data as MovementSlim[]
}

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
  const { data: movements, isLoading } = useQuery<MovementSlim[]>({
    queryKey: ["movements", "last-6-months"],
    queryFn: fetchMonthsMovements,
  })

  const chartData: BarRow[] = useMemo(() => {
    if (!movements) return []

    const now = new Date()
    const rows: BarRow[] = []

    for (let i = MONTHS - 1; i >= 0; i--) {
      const d = subMonths(now, i)
      const from = format(startOfMonth(d), "yyyy-MM-dd")
      const to = format(endOfMonth(d), "yyyy-MM-dd")

      let ingresos = 0
      let gastos = 0
      for (const m of movements) {
        if (m.date < from || m.date > to) continue
        const amount = m.converted_amount ?? m.amount
        if (m.type === "income") ingresos += amount
        else gastos += amount
      }

      rows.push({
        mes: format(d, "MMM", { locale: es }),
        ingresos: Math.round(ingresos),
        gastos: Math.round(gastos),
      })
    }

    return rows
  }, [movements])

  const hasData = chartData.some((r) => r.ingresos > 0 || r.gastos > 0)

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold">Ingresos vs Gastos</h3>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
          Últimos 6 meses
        </span>
      </div>

      {isLoading && (
        <div className="space-y-2 py-2">
          <div className="flex items-end gap-2 h-32">
            {[...Array(6)].map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t-md"
                style={{ height: `${40 + Math.random() * 60}%` }}
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
            Sin movimientos en los últimos 6 meses.
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
          className="h-52"
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

      {/* Summary row */}
      {!isLoading && hasData && (() => {
        const currentMonth = chartData[chartData.length - 1]
        if (!currentMonth) return null
        const diff = currentMonth.ingresos - currentMonth.gastos
        return (
          <div className="flex gap-4 pt-1 text-xs border-t border-border/40">
            <div className="flex-1 text-center">
              <p className="text-muted-foreground">Ingresos (mes)</p>
              <p className="font-semibold tabular-nums text-success">
                {formatCurrency(currentMonth.ingresos, "ARS")}
              </p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-muted-foreground">Gastos (mes)</p>
              <p className="font-semibold tabular-nums text-destructive">
                {formatCurrency(currentMonth.gastos, "ARS")}
              </p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-muted-foreground">Balance</p>
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
