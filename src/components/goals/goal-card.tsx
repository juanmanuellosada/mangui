import { ArrowUpRight, Pencil, TrendingDown, TrendingUp } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { GoalProgressBar } from "@/components/goals/goal-progress-bar"
import { RowCheckbox, selectedItemCn } from "@/components/ui/selection-bar"
import { renderCategoryIcon } from "@/lib/categories"
import { computeGoalProgress, type Goal, type GoalScope, type GoalType } from "@/lib/goals"
import type { Tables } from "@/lib/database.types"
import { cn, formatCurrency } from "@/lib/utils"

type Movement = Tables<"movements">
type Category = Tables<"categories">
type Account = Tables<"accounts">

export function typeIcon(type: GoalType, className = "h-4.5 w-4.5") {
  switch (type) {
    case "income":
      return <ArrowUpRight className={className} style={{ width: "1.125rem", height: "1.125rem" }} />
    case "saving":
      return <TrendingUp className={className} style={{ width: "1.125rem", height: "1.125rem" }} />
    case "reduction":
      return <TrendingDown className={className} style={{ width: "1.125rem", height: "1.125rem" }} />
  }
}

export function typeColor(type: GoalType): string {
  switch (type) {
    case "income": return "bg-success/10 text-success"
    case "saving": return "bg-primary/10 text-primary"
    case "reduction": return "bg-amber-500/10 text-amber-600"
  }
}

export function typeLabel(type: GoalType): string {
  switch (type) {
    case "income": return "Ingreso"
    case "saving": return "Ahorro"
    case "reduction": return "Reducción"
  }
}

export function GoalCard({
  goal,
  scope,
  movements,
  categories,
  accounts,
  onEdit,
  selectionMode,
  isSelected,
  onToggleSelect,
  isDemo,
}: {
  goal: Goal
  scope: GoalScope
  movements: Movement[]
  categories: Category[]
  accounts: Account[]
  onEdit: (g: Goal) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
  isDemo?: boolean
}) {
  const progress = computeGoalProgress(goal, movements, scope)
  const isCompleted = goal.status === "completed"

  // Scope chips
  const catChips = scope.categoryIds
    .map((id) => categories.find((c) => c.id === id))
    .filter(Boolean) as Category[]
  const accChips = scope.accountIds
    .map((id) => accounts.find((a) => a.id === id))
    .filter(Boolean) as Account[]

  // Labels for value/target depending on type
  const valueLabel =
    goal.type === "reduction"
      ? `${goal.currency} ${formatCurrency(progress.value, goal.currency)} gastado`
      : `${goal.currency} ${formatCurrency(progress.value, goal.currency)}`

  const targetLabel =
    goal.type === "reduction"
      ? `/ ${formatCurrency(progress.target, goal.currency)} objetivo`
      : progress.target > 0
      ? `/ ${formatCurrency(progress.target, goal.currency)} objetivo`
      : null

  // Progress bar label
  const barLabel =
    goal.type === "reduction" ? "del límite usado" : "alcanzado"

  // Extra info for reduction: show target_percent if available
  const reductionInfo =
    goal.type === "reduction" && goal.target_percent
      ? `−${goal.target_percent.toFixed(0)}% objetivo`
      : null

  return (
    <div
      onClick={selectionMode ? () => onToggleSelect?.(goal.id) : undefined}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? isSelected : undefined}
      className={cn(
        "rounded-2xl border border-border/60 bg-card overflow-hidden",
        isCompleted && "opacity-75",
        selectionMode && "cursor-pointer",
        isSelected && selectedItemCn(true)
      )}
    >
      <div className="px-4 pt-4 pb-3 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-2">
          {selectionMode ? (
            <div className="mt-0.5 shrink-0">
              <RowCheckbox checked={!!isSelected} onChange={() => onToggleSelect?.(goal.id)} />
            </div>
          ) : (
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
              isCompleted ? "bg-success/10 text-success" : typeColor(goal.type)
            )}>
              {goal.icon ? (
                renderCategoryIcon(goal.icon, { size: "h-5 w-5", logoFill: true })
              ) : (
                typeIcon(goal.type)
              )}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{goal.name}</h3>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {typeLabel(goal.type)}
              </span>
              {isCompleted && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-success/10 text-success">
                  Completada
                </span>
              )}
              {!isCompleted && progress.status === "reached" && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-success/10 text-success animate-pulse">
                  Objetivo alcanzado
                </span>
              )}
            </div>

            {/* Scope / period info */}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {goal.is_global ? (
                <span className="text-[10px] text-muted-foreground">Global</span>
              ) : (
                <>
                  {catChips.map((c) => (
                    <span key={c.id} className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                      {c.name}
                    </span>
                  ))}
                  {accChips.map((a) => (
                    <span key={a.id} className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent font-medium">
                      {a.name}
                    </span>
                  ))}
                </>
              )}
              <span className="text-[10px] text-muted-foreground">
                {format(parseISO(goal.start_date), "d MMM", { locale: es })} –{" "}
                {format(parseISO(goal.end_date), "d MMM yyyy", { locale: es })}
              </span>
              {goal.recurring && (
                <span className="text-[10px] text-muted-foreground">· Recurrente</span>
              )}
            </div>
          </div>

          {/* Edit button */}
          {!selectionMode && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); onEdit(goal) }}
              title={isDemo ? "No disponible en el modo demo" : "Editar"}
              className="press-effect cursor-pointer flex-shrink-0"
              disabled={isDemo}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Amounts */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={cn(
            "text-lg font-bold tabular-nums",
            goal.type === "saving" && progress.percent < 0 && "text-destructive"
          )}>
            {valueLabel}
          </span>
          {targetLabel && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {targetLabel}
            </span>
          )}
          {reductionInfo && (
            <span className="text-[10px] text-muted-foreground ml-1">
              · {reductionInfo}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {progress.target > 0 && (
          <GoalProgressBar
            percent={progress.percent}
            status={progress.status}
            label={barLabel}
          />
        )}
      </div>
    </div>
  )
}
