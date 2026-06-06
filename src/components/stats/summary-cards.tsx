"use client"

import { TrendingUp, TrendingDown, Scale, Hash, Divide } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { SummaryTotals } from "@/lib/stats"
import type { Tables } from "@/lib/database.types"

type Movement = Tables<"movements">

interface SummaryCardsProps {
  totals: SummaryTotals
  currency?: "ARS" | "USD"
  period?: string
  type?: "all" | "income" | "expense"
  movements?: Movement[]
}

export function SummaryCards({ totals, currency = "ARS", period, type = "all", movements = [] }: SummaryCardsProps) {
  const { income, expense, net } = totals

  const incomeCount = movements.filter((m) => m.type === "income").length
  const expenseCount = movements.filter((m) => m.type === "expense").length
  const avgIncome = incomeCount > 0 ? income / incomeCount : 0
  const avgExpense = expenseCount > 0 ? expense / expenseCount : 0

  if (type === "income") {
    return (
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-success flex-shrink-0" aria-hidden />
            <p className="text-xs font-medium text-muted-foreground truncate">Total ingresos</p>
          </div>
          {period && <p className="text-[10px] text-muted-foreground/70 leading-none">{period}</p>}
          <p className="text-base font-bold tabular-nums text-success leading-tight">
            +{formatCurrency(income, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
            <p className="text-xs font-medium text-muted-foreground truncate">Cantidad</p>
          </div>
          {period && <p className="text-[10px] text-muted-foreground/70 leading-none">{period}</p>}
          <p className="text-base font-bold tabular-nums text-foreground leading-tight">{incomeCount}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Divide className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
            <p className="text-xs font-medium text-muted-foreground truncate">Promedio</p>
          </div>
          {period && <p className="text-[10px] text-muted-foreground/70 leading-none">{period}</p>}
          <p className="text-base font-bold tabular-nums text-foreground leading-tight">
            {formatCurrency(avgIncome, currency)}
          </p>
        </div>
      </div>
    )
  }

  if (type === "expense") {
    return (
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4 text-destructive flex-shrink-0" aria-hidden />
            <p className="text-xs font-medium text-muted-foreground truncate">Total gastos</p>
          </div>
          {period && <p className="text-[10px] text-muted-foreground/70 leading-none">{period}</p>}
          <p className="text-base font-bold tabular-nums text-destructive leading-tight">
            -{formatCurrency(expense, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
            <p className="text-xs font-medium text-muted-foreground truncate">Cantidad</p>
          </div>
          {period && <p className="text-[10px] text-muted-foreground/70 leading-none">{period}</p>}
          <p className="text-base font-bold tabular-nums text-foreground leading-tight">{expenseCount}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Divide className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
            <p className="text-xs font-medium text-muted-foreground truncate">Promedio</p>
          </div>
          {period && <p className="text-[10px] text-muted-foreground/70 leading-none">{period}</p>}
          <p className="text-base font-bold tabular-nums text-foreground leading-tight">
            {formatCurrency(avgExpense, currency)}
          </p>
        </div>
      </div>
    )
  }

  // type === "all"
  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Ingresos */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-success flex-shrink-0" aria-hidden />
          <p className="text-xs font-medium text-muted-foreground truncate">Ingresos</p>
        </div>
        {period && (
          <p className="text-[10px] text-muted-foreground/70 leading-none">{period}</p>
        )}
        <p className="text-base font-bold tabular-nums text-success leading-tight">
          +{formatCurrency(income, currency)}
        </p>
      </div>

      {/* Gastos */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-4 w-4 text-destructive flex-shrink-0" aria-hidden />
          <p className="text-xs font-medium text-muted-foreground truncate">Gastos</p>
        </div>
        {period && (
          <p className="text-[10px] text-muted-foreground/70 leading-none">{period}</p>
        )}
        <p className="text-base font-bold tabular-nums text-destructive leading-tight">
          -{formatCurrency(expense, currency)}
        </p>
      </div>

      {/* Balance neto */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Scale className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
          <p className="text-xs font-medium text-muted-foreground truncate">Balance</p>
        </div>
        {period && (
          <p className="text-[10px] text-muted-foreground/70 leading-none">{period}</p>
        )}
        <p
          className={`text-base font-bold tabular-nums leading-tight ${net >= 0 ? "text-success" : "text-destructive"}`}
        >
          {net >= 0 ? "+" : "-"}{formatCurrency(Math.abs(net), currency)}
        </p>
      </div>
    </div>
  )
}
