"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, AlertTriangle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import {
  BUDGETS_KEY,
  computeBudgetProgress,
  type Budget,
  type BudgetProgressStatus,
} from "@/lib/budgets"
import { fetchAllMovements } from "@/lib/movements"
import { formatCurrency, cn } from "@/lib/utils"

const MAX_VISIBLE = 5

async function fetchBudgets(): Promise<Budget[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

function progressBarColor(status: BudgetProgressStatus): string {
  if (status === "exceeded") return "bg-destructive"
  if (status === "near") return "bg-amber-500"
  return "bg-success"
}

function percentColor(status: BudgetProgressStatus): string {
  if (status === "exceeded") return "text-destructive"
  if (status === "near") return "text-amber-500"
  return "text-muted-foreground"
}

function BudgetRowSkeleton() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3.5 w-8" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
  )
}

export function BudgetsSummary() {
  const { data: budgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: BUDGETS_KEY,
    queryFn: fetchBudgets,
  })

  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ["movements", "stats-all"],
    queryFn: fetchAllMovements,
  })

  const isLoading = loadingBudgets || loadingMovements

  const activeBudgets = budgets
    .filter((b) => b.status === "active")
    .slice(0, MAX_VISIBLE)

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Presupuestos</h3>
        <Link
          href="/app/presupuestos"
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Ver todos
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-4">
          <BudgetRowSkeleton />
          <BudgetRowSkeleton />
          <BudgetRowSkeleton />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && activeBudgets.length === 0 && (
        <p className="text-sm text-muted-foreground py-1">
          No tenés presupuestos activos.{" "}
          <Link
            href="/app/presupuestos"
            className="text-primary hover:underline"
          >
            Crear uno
          </Link>
        </p>
      )}

      {/* Budget rows */}
      {!isLoading && activeBudgets.length > 0 && (
        <div className="space-y-4">
          {activeBudgets.map((budget) => {
            const p = computeBudgetProgress(budget, movements)
            const showAlert = p.status === "exceeded" || p.status === "near"

            return (
              <div key={budget.id} className="space-y-1.5">
                {/* Top row: name + percent */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 min-w-0">
                    {showAlert && (
                      <AlertTriangle
                        className={cn(
                          "h-3 w-3 shrink-0",
                          p.status === "exceeded"
                            ? "text-destructive"
                            : "text-amber-500"
                        )}
                        aria-hidden
                      />
                    )}
                    <span className="text-sm font-medium truncate">
                      {budget.name}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-xs tabular-nums shrink-0",
                      percentColor(p.status)
                    )}
                  >
                    {p.percent.toFixed(0)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  className="h-2 rounded-full bg-border overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(p.percent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      progressBarColor(p.status)
                    )}
                    style={{ width: `${Math.min(p.percent, 100)}%` }}
                  />
                </div>

                {/* Bottom row: spent/limit + remaining */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="tabular-nums">
                    {formatCurrency(p.spent, budget.currency)} /{" "}
                    {formatCurrency(p.limit, budget.currency)}
                  </span>
                  <span
                    className={cn(
                      "tabular-nums",
                      p.remaining < 0 && "text-destructive"
                    )}
                  >
                    {p.remaining < 0
                      ? `excedido ${formatCurrency(Math.abs(p.remaining), budget.currency)}`
                      : `${formatCurrency(p.remaining, budget.currency)} restante`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
