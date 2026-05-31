"use client"

import { CheckCircle2, AlertTriangle, XCircle, Wallet } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { computeBudgetProgress, type Budget, type BudgetProgressStatus } from "@/lib/budgets"
import type { Tables } from "@/lib/database.types"

type Movement = Tables<"movements">

interface BudgetComplianceStripProps {
  budgets: Budget[]
  movements: Movement[]
}

const STATUS_CONFIG: Record<BudgetProgressStatus, { icon: typeof CheckCircle2; label: string; color: string }> = {
  on_track: { icon: CheckCircle2, label: "Al día", color: "text-success" },
  near: { icon: AlertTriangle, label: "Cerca del límite", color: "text-accent" },
  exceeded: { icon: XCircle, label: "Excedido", color: "text-destructive" },
}

export function BudgetComplianceStrip({ budgets, movements }: BudgetComplianceStripProps) {
  const active = budgets.filter((b) => b.status === "active")

  if (active.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">Presupuestos</h3>
        <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
          <Wallet className="h-8 w-8 text-muted-foreground/30" aria-hidden />
          <p className="text-sm text-muted-foreground">Sin presupuestos activos.</p>
        </div>
      </div>
    )
  }

  const movRows = movements.map((m) => ({
    type: m.type,
    is_future: m.is_future,
    date: m.date,
    category_id: m.category_id,
    account_id: m.account_id,
    amount: m.amount,
    converted_amount: m.converted_amount,
    original_currency: m.original_currency,
  }))

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
      <h3 className="text-sm font-semibold">Cumplimiento de presupuestos</h3>
      <div className="space-y-3">
        {active.map((budget) => {
          const progress = computeBudgetProgress(budget, movRows)
          const cfg = STATUS_CONFIG[progress.status]
          const StatusIcon = cfg.icon
          const pct = Math.min(progress.percent, 100)

          return (
            <div key={budget.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <StatusIcon className={cn("h-3.5 w-3.5 flex-shrink-0", cfg.color)} aria-hidden />
                <span className="text-xs font-medium flex-1 truncate">{budget.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(progress.spent, budget.currency)} / {formatCurrency(progress.limit, budget.currency)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemax={100} aria-label={`${budget.name}: ${pct.toFixed(0)}%`}>
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300 motion-reduce:transition-none",
                    progress.status === "on_track" && "bg-success",
                    progress.status === "near" && "bg-accent",
                    progress.status === "exceeded" && "bg-destructive",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className={cn("text-[10px] font-medium", cfg.color)}>{cfg.label}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{pct.toFixed(0)}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
