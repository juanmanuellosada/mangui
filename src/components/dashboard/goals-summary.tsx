"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { GOALS_KEY, computeGoalProgress, type Goal, type GoalScope, type GoalProgressStatus, type GoalType } from "@/lib/goals"
import { fetchAllMovements } from "@/lib/movements"
import { formatCurrency, cn } from "@/lib/utils"
import {
  GOAL_ACCOUNTS_KEY,
  GOAL_CATEGORIES_KEY,
  fetchGoals,
  fetchGoalAccounts,
  fetchGoalCategories,
  buildScopeMap,
  scopeFor,
} from "@/components/goals/goals-list"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

const MAX_VISIBLE = 5

// ── Minimal type helpers (replicated from goals-list, not exported there) ─────

function goalTypeIcon(type: GoalType) {
  switch (type) {
    case "income":
      return <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
    case "saving":
      return <TrendingUp className="h-3.5 w-3.5" aria-hidden />
    case "reduction":
      return <TrendingDown className="h-3.5 w-3.5" aria-hidden />
  }
}

function goalTypeColor(type: GoalType): string {
  switch (type) {
    case "income":   return "bg-success/10 text-success"
    case "saving":   return "bg-primary/10 text-primary"
    case "reduction": return "bg-amber-500/10 text-amber-600"
  }
}

function percentColor(status: GoalProgressStatus): string {
  if (status === "exceeded") return "text-destructive"
  if (status === "near") return "text-amber-500"
  return "text-muted-foreground"
}

const BAR_COLOR: Record<GoalProgressStatus, string> = {
  on_track: "bg-primary",
  near: "bg-amber-500",
  reached: "bg-success",
  exceeded: "bg-destructive",
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function GoalRowSkeleton() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Skeleton className="h-5 w-5 rounded-md shrink-0" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <Skeleton className="h-3.5 w-8 shrink-0" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-2.5 w-32" />
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function GoalsSummary() {
  const { data: goals = [], isLoading: loadingGoals } = useQuery({
    queryKey: GOALS_KEY,
    queryFn: fetchGoals,
  })

  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ["movements", "stats-all"],
    queryFn: fetchAllMovements,
  })

  const { data: goalAccountRows = [], isLoading: loadingAccRows } = useQuery({
    queryKey: GOAL_ACCOUNTS_KEY,
    queryFn: fetchGoalAccounts,
  })

  const { data: goalCategoryRows = [], isLoading: loadingCatRows } = useQuery({
    queryKey: GOAL_CATEGORIES_KEY,
    queryFn: fetchGoalCategories,
  })

  const isLoading = loadingGoals || loadingMovements || loadingAccRows || loadingCatRows

  const scopeMap = useMemo(
    () => buildScopeMap(goalAccountRows, goalCategoryRows),
    [goalAccountRows, goalCategoryRows]
  )

  const activeGoals = useMemo(
    () => goals.filter((g: Goal) => g.status === "active").slice(0, MAX_VISIBLE),
    [goals]
  )

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Metas</h3>
        <Link
          href="/app/metas"
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Ver todas
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-4">
          <GoalRowSkeleton />
          <GoalRowSkeleton />
          <GoalRowSkeleton />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && activeGoals.length === 0 && (
        <p className="text-sm text-muted-foreground py-1">
          No tenés metas activas.{" "}
          <Link href="/app/metas" className="text-primary hover:underline">
            Crear una
          </Link>
        </p>
      )}

      {/* Goal rows */}
      {!isLoading && activeGoals.length > 0 && (
        <div className="space-y-4">
          {activeGoals.map((goal: Goal) => {
            const scope: GoalScope = scopeFor(goal.id, scopeMap)
            const p = computeGoalProgress(goal, movements, scope)

            return (
              <div key={goal.id} className="space-y-1.5">
                {/* Top row: icon + name + percent */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md shrink-0",
                        goalTypeColor(goal.type)
                      )}
                    >
                      {goalTypeIcon(goal.type)}
                    </span>
                    <span className="text-sm font-medium truncate">{goal.name}</span>
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
                  aria-valuenow={Math.round(Math.min(Math.max(p.percent, 0), 100))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      BAR_COLOR[p.status]
                    )}
                    style={{ width: `${Math.min(Math.max(p.percent, 0), 100)}%` }}
                  />
                </div>

                {/* Bottom row: value / target + optional deadline */}
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  <span>{formatCurrency(p.value, goal.currency ?? "ARS")}</span>
                  {" / "}
                  <span>{formatCurrency(p.target, goal.currency ?? "ARS")}</span>
                  {goal.end_date && (
                    <span className="ml-1 opacity-70">
                      · vence {format(parseISO(goal.end_date), "d/M", { locale: es })}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
