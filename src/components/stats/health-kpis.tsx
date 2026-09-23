"use client"

import { formatCurrency } from "@/lib/utils"
import { buildFinancialHealth } from "@/lib/financial-health"
import type { SummaryTotals } from "@/lib/stats"
import type { Tables } from "@/lib/database.types"

type Movement = Tables<"movements">

interface HealthKpisProps {
  totals: SummaryTotals
  movements: Movement[]
  currency: "ARS" | "USD"
  dateFrom: string | null
  dateTo: string | null
  referenceDate: string
}

export function HealthKpis({
  totals,
  movements,
  currency,
  dateFrom,
  dateTo,
  referenceDate,
}: HealthKpisProps) {
  const health = buildFinancialHealth({
    totals,
    movementDates: movements.map((movement) => movement.date),
    dateFrom,
    dateTo,
    currency,
    referenceDate,
  })

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-4">
      <h3 className="text-sm font-semibold">Salud financiera</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1 min-w-0">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            Tasa de ahorro
          </p>
          <p
            className={`text-lg font-bold tabular-nums leading-tight ${
              health.savingRate === null
                ? "text-muted-foreground"
                : health.savingRate >= 0
                ? "text-success"
                : "text-destructive"
            }`}
          >
            {health.savingRate === null ? "—" : `${(health.savingRate * 100).toFixed(1)}%`}
          </p>
          <p className="text-[10px] text-muted-foreground">del ingreso</p>
        </div>

        <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1 min-w-0">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            Ritmo diario
          </p>
          <p className="text-lg font-bold tabular-nums leading-tight text-foreground">
            {formatCurrency(health.dailyExpense, health.currency)}
          </p>
          <p className="text-[10px] text-muted-foreground">de gasto por día</p>
        </div>

        <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1 min-w-0">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            Período analizado
          </p>
          <p className="text-lg font-bold tabular-nums leading-tight text-foreground">
            {health.analyzedDays} {health.analyzedDays === 1 ? "día" : "días"}
          </p>
          <p className="text-[10px] text-muted-foreground">rango efectivo</p>
        </div>
      </div>
    </div>
  )
}
