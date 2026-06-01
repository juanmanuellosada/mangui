"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  PlusCircle,
  Pencil,
  Target,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  CalendarDays,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMultiSelect } from "@/hooks/use-multi-select"
import { SelectionBar, SelectButton, RowCheckbox, selectedItemCn } from "@/components/ui/selection-bar"
import { MangoSheet as ConfirmSheet } from "@/components/ui/mango-sheet"
import { bulkDelete } from "@/lib/bulk-delete"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { GoalForm, goalToFormValues, type GoalFormValues } from "./goal-form"
import {
  GOALS_KEY,
  computeSavingProgress,
  computeReductionProgress,
  type Goal,
} from "@/lib/goals"
import { MOVEMENTS_KEY, ACCOUNTS_KEY, CATEGORIES_KEY } from "@/lib/movements"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import type { Tables } from "@/lib/database.types"

type Movement = Tables<"movements">
type Category = Tables<"categories">
type Account = Tables<"accounts">

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchGoals(): Promise<Goal[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

async function fetchMovements(): Promise<Movement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("movements")
    .select("*")
    .order("date", { ascending: false })
    .limit(500)
  if (error) throw error
  return data
}

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("categories").select("*").order("name")
  if (error) throw error
  return data
}

async function fetchAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("accounts").select("*").order("name")
  if (error) throw error
  return data
}

// ── Saving goal card ──────────────────────────────────────────────────────────

function SavingGoalCard({
  goal,
  movements,
  categories,
  accounts,
  onEdit,
  onMarkComplete,
  selectionMode,
  isSelected,
  onToggleSelect,
}: {
  goal: Goal
  movements: Movement[]
  categories: Category[]
  accounts: Account[]
  onEdit: (g: Goal) => void
  onMarkComplete: (g: Goal) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}) {
  const progress = computeSavingProgress(goal, movements)
  const category = goal.category_id ? categories.find((c) => c.id === goal.category_id) : null
  const account = goal.account_id ? accounts.find((a) => a.id === goal.account_id) : null
  const isCompleted = goal.status === "completed"
  const autoReached = progress.reached && !isCompleted

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
              isCompleted ? "bg-success/10" : "bg-primary/10"
            )}>
              {isCompleted
                ? <CheckCircle2 className="h-4.5 w-4.5 text-success" style={{ width: "1.125rem", height: "1.125rem" }} />
                : <TrendingUp className="h-4.5 w-4.5 text-primary" style={{ width: "1.125rem", height: "1.125rem" }} />
              }
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{goal.name}</h3>
              {isCompleted && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-success/10 text-success">
                  Completado
                </span>
              )}
              {autoReached && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-success/10 text-success animate-pulse">
                  Objetivo alcanzado
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {category && (
                <span className="text-[10px] text-muted-foreground">{category.name}</span>
              )}
              {account && (
                <span className="text-[10px] text-muted-foreground">{account.name}</span>
              )}
              {goal.deadline && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <CalendarDays className="h-3 w-3" />
                  {format(parseISO(goal.deadline), "d MMM yyyy", { locale: es })}
                </span>
              )}
            </div>
          </div>
          {!selectionMode && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {!isCompleted && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMarkComplete(goal) }}
                  title="Marcar como completada"
                  className="text-[10px] font-semibold text-muted-foreground hover:text-success transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-success/10"
                >
                  Completar
                </button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => { e.stopPropagation(); onEdit(goal) }}
                title="Editar"
                className="press-effect cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Amounts */}
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold tabular-nums">
            {goal.currency} {formatCurrency(progress.accumulated, goal.currency)}
          </span>
          {progress.target > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              / {formatCurrency(progress.target, goal.currency)} objetivo
            </span>
          )}
        </div>

        {/* Progress bar */}
        {progress.target > 0 && (
          <div className="space-y-1">
            <div
              className="h-2 rounded-full bg-border overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(progress.percent)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  progress.reached ? "bg-success" : "bg-primary"
                )}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {progress.percent.toFixed(0)}% alcanzado
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Reduction goal card ───────────────────────────────────────────────────────

function ReductionGoalCard({
  goal,
  movements,
  categories,
  accounts,
  onEdit,
  onMarkComplete,
  selectionMode,
  isSelected,
  onToggleSelect,
}: {
  goal: Goal
  movements: Movement[]
  categories: Category[]
  accounts: Account[]
  onEdit: (g: Goal) => void
  onMarkComplete: (g: Goal) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}) {
  const progress = computeReductionProgress(goal, movements)
  const category = goal.category_id ? categories.find((c) => c.id === goal.category_id) : null
  const account = goal.account_id ? accounts.find((a) => a.id === goal.account_id) : null
  const isCompleted = goal.status === "completed"
  const spendRatio = progress.baseline > 0
    ? Math.min((progress.currentMonthSpend / progress.baseline) * 100, 100)
    : 0

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
              isCompleted ? "bg-success/10" : "bg-accent/10"
            )}>
              {isCompleted
                ? <CheckCircle2 className="h-4.5 w-4.5 text-success" style={{ width: "1.125rem", height: "1.125rem" }} />
                : <TrendingDown className="h-4.5 w-4.5 text-accent" style={{ width: "1.125rem", height: "1.125rem" }} />
              }
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{goal.name}</h3>
              {isCompleted && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-success/10 text-success">
                  Completado
                </span>
              )}
              {progress.met && !isCompleted && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-success/10 text-success">
                  Objetivo cumplido
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {category && (
                <span className="text-[10px] text-muted-foreground">{category.name}</span>
              )}
              {account && (
                <span className="text-[10px] text-muted-foreground">{account.name}</span>
              )}
              {goal.deadline && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <CalendarDays className="h-3 w-3" />
                  {format(parseISO(goal.deadline), "d MMM yyyy", { locale: es })}
                </span>
              )}
            </div>
          </div>
          {!selectionMode && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {!isCompleted && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMarkComplete(goal) }}
                  title="Marcar como completada"
                  className="text-[10px] font-semibold text-muted-foreground hover:text-success transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-success/10"
                >
                  Completar
                </button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => { e.stopPropagation(); onEdit(goal) }}
                title="Editar"
                className="press-effect cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Reduction indicator */}
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              progress.reductionPct >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {progress.reductionPct >= 0 ? "−" : "+"}
            {Math.abs(progress.reductionPct).toFixed(0)}%
          </span>
          <span className="text-xs text-muted-foreground">vs base</span>
          {progress.targetPct > 0 && (
            <span className="text-[10px] text-muted-foreground ml-1">
              · objetivo: −{progress.targetPct.toFixed(0)}%
            </span>
          )}
        </div>

        {/* Amounts */}
        <div className="flex items-baseline gap-2 -mt-1">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(progress.currentMonthSpend, goal.currency)}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            este mes · base {formatCurrency(progress.baseline, goal.currency)}
          </span>
        </div>

        {/* Spend bar (showing current spend as % of baseline) */}
        <div className="space-y-1">
          <div
            className="h-2 rounded-full bg-border overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(spendRatio)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                spendRatio > 100 ? "bg-destructive" : progress.met ? "bg-success" : "bg-amber-500"
              )}
              style={{ width: `${spendRatio}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {spendRatio.toFixed(0)}% del gasto base · {format(new Date(), "MMM yyyy", { locale: es })}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Create dialog ─────────────────────────────────────────────────────────────

function CreateGoalDialog({
  categories,
  accounts,
  movements,
}: {
  categories: Category[]
  accounts: Account[]
  movements: Movement[]
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (values: GoalFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const { data, error } = await supabase
        .from("goals")
        .insert({
          user_id: user.id,
          name: values.name,
          type: values.type,
          target_amount: values.target_amount,
          currency: values.currency,
          category_id: values.category_id,
          account_id: values.account_id,
          deadline: values.deadline,
          baseline_amount: values.baseline_amount,
          target_percent: values.target_percent,
          status: "active",
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY })
      toast.success("Meta creada")
      setOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear la meta", { description: err.message })
    },
  })

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="hidden lg:inline-flex press-effect cursor-pointer font-semibold shadow-sm shadow-primary/20"
      >
        <PlusCircle className="h-4 w-4" />
        Nueva meta
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva meta</DialogTitle>
            <DialogDescription>
              Definí un objetivo de ahorro o reducción de gastos.
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            categories={categories}
            accounts={accounts}
            movements={movements}
            onSubmit={async (v) => { await mutation.mutateAsync(v) }}
            isLoading={mutation.isPending}
            submitLabel="Crear meta"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

function EditGoalDialog({
  goal,
  categories,
  accounts,
  movements,
  open,
  onOpenChange,
}: {
  goal: Goal
  categories: Category[]
  accounts: Account[]
  movements: Movement[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const updateMutation = useMutation({
    mutationFn: async (values: GoalFormValues) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("goals")
        .update({
          name: values.name,
          type: values.type,
          target_amount: values.target_amount,
          currency: values.currency,
          category_id: values.category_id,
          account_id: values.account_id,
          deadline: values.deadline,
          baseline_amount: values.baseline_amount,
          target_percent: values.target_percent,
          updated_at: new Date().toISOString(),
        })
        .eq("id", goal.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY })
      toast.success("Meta actualizada")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al actualizar", { description: err.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase.from("goals").delete().eq("id", goal.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY })
      toast.success("Meta eliminada")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al eliminar", { description: err.message })
    },
  })

  if (confirmDelete) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar meta</DialogTitle>
            <DialogDescription>
              ¿Estás seguro? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="press-effect cursor-pointer"
            >
              {deleteMutation.isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar meta</DialogTitle>
          <DialogDescription>Modificá los datos de la meta.</DialogDescription>
        </DialogHeader>
        <GoalForm
          categories={categories}
          accounts={accounts}
          movements={movements}
          defaultValues={goalToFormValues(goal)}
          onSubmit={async (v) => { await updateMutation.mutateAsync(v) }}
          onDelete={() => setConfirmDelete(true)}
          isLoading={updateMutation.isPending}
          submitLabel="Guardar cambios"
        />
      </DialogContent>
    </Dialog>
  )
}

// ── Mobile FAB ────────────────────────────────────────────────────────────────

function FABCreate({
  categories,
  accounts,
  movements,
}: {
  categories: Category[]
  accounts: Account[]
  movements: Movement[]
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (values: GoalFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const { data, error } = await supabase
        .from("goals")
        .insert({
          user_id: user.id,
          name: values.name,
          type: values.type,
          target_amount: values.target_amount,
          currency: values.currency,
          category_id: values.category_id,
          account_id: values.account_id,
          deadline: values.deadline,
          baseline_amount: values.baseline_amount,
          target_percent: values.target_percent,
          status: "active",
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY })
      toast.success("Meta creada")
      setOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear la meta", { description: err.message })
    },
  })

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "lg:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] right-4 z-30",
          "w-14 h-14 rounded-full bg-primary text-primary-foreground",
          "shadow-lg shadow-primary/35 press-effect",
          "flex items-center justify-center",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        aria-label="Nueva meta"
      >
        <PlusCircle className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva meta</DialogTitle>
            <DialogDescription>
              Definí un objetivo de ahorro o reducción de gastos.
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            categories={categories}
            accounts={accounts}
            movements={movements}
            onSubmit={async (v) => { await mutation.mutateAsync(v) }}
            isLoading={mutation.isPending}
            submitLabel="Crear meta"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Tab filter ────────────────────────────────────────────────────────────────

type GoalFilter = "all" | "saving" | "reduction" | "completed"

function GoalFilterTabs({
  active,
  onChange,
}: {
  active: GoalFilter
  onChange: (f: GoalFilter) => void
}) {
  const tabs: { value: GoalFilter; label: string }[] = [
    { value: "all", label: "Todas" },
    { value: "saving", label: "Ahorro" },
    { value: "reduction", label: "Reducción" },
    { value: "completed", label: "Completadas" },
  ]

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
      {tabs.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150 press-effect cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active === value
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GoalsList() {
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [filter, setFilter] = useState<GoalFilter>("all")
  const ms = useMultiSelect()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)

  const { data: goals = [], isLoading: loadingGoals } = useQuery({
    queryKey: GOALS_KEY,
    queryFn: fetchGoals,
  })

  const { data: movements = [] } = useQuery({
    queryKey: MOVEMENTS_KEY,
    queryFn: fetchMovements,
  })

  const { data: categories = [] } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: fetchCategories,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  })

  const queryClient = useQueryClient()

  const markCompleteMutation = useMutation({
    mutationFn: async (goal: Goal) => {
      const supabase = createClient()
      const { error } = await supabase
        .from("goals")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", goal.id)
      if (error) throw error
    },
    onMutate: async (goal) => {
      await queryClient.cancelQueries({ queryKey: GOALS_KEY })
      const previous = queryClient.getQueryData<Goal[]>(GOALS_KEY)
      queryClient.setQueryData<Goal[]>(GOALS_KEY, (old = []) =>
        old.map((g) => g.id === goal.id ? { ...g, status: "completed" } : g)
      )
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(GOALS_KEY, context.previous)
      toast.error("Error al marcar como completada", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY })
      toast.success("Meta marcada como completada")
    },
  })

  // Filtered goals
  const filteredGoals = goals.filter((g) => {
    if (filter === "completed") return g.status === "completed"
    if (filter === "saving") return g.type === "saving" && g.status === "active"
    if (filter === "reduction") return g.type === "reduction" && g.status === "active"
    return true // "all"
  })

  const filteredGoalIds = filteredGoals.map((g) => g.id)

  async function handleBulkDelete() {
    setBulkPending(true)
    const ids = Array.from(ms.selectedIds)
    const result = await bulkDelete("goals", ids)
    setBulkPending(false)
    setConfirmOpen(false)
    ms.exit()
    queryClient.invalidateQueries({ queryKey: GOALS_KEY })
    if (result.failed === 0) {
      toast.success(`Se eliminaron ${result.deleted} meta${result.deleted !== 1 ? "s" : ""}`)
    } else {
      toast.warning(`Se eliminaron ${result.deleted}. ${result.failed} no se pud${result.failed !== 1 ? "ieron" : "o"} eliminar.`)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Metas
        </h1>
        <div className="flex items-center gap-2">
          {!loadingGoals && goals.length > 0 && !ms.selectionMode && (
            <SelectButton onClick={ms.enter} />
          )}
          {!ms.selectionMode && <CreateGoalDialog categories={categories} accounts={accounts} movements={movements} />}
        </div>
      </div>

      {/* Filter tabs */}
      {!loadingGoals && goals.length > 0 && (
        <GoalFilterTabs active={filter} onChange={setFilter} />
      )}

      {/* Skeleton */}
      {loadingGoals && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadingGoals && goals.length === 0 && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-10 text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-primary/15 flex items-center justify-center mx-auto">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2
              className="text-xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Sin metas aún
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Definí un objetivo de ahorro o reducción para hacer seguimiento de tu progreso.
            </p>
          </div>
          <CreateGoalDialog categories={categories} accounts={accounts} movements={movements} />
        </div>
      )}

      {/* Filter empty */}
      {!loadingGoals && goals.length > 0 && filteredGoals.length === 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            No hay metas en esta categoría.
          </p>
        </div>
      )}

      {/* Goal cards */}
      {!loadingGoals && filteredGoals.length > 0 && (
        <div className="space-y-3">
          {filteredGoals.map((goal) =>
            goal.type === "saving" ? (
              <SavingGoalCard
                key={goal.id}
                goal={goal}
                movements={movements}
                categories={categories}
                accounts={accounts}
                onEdit={setEditingGoal}
                onMarkComplete={(g) => markCompleteMutation.mutate(g)}
                selectionMode={ms.selectionMode}
                isSelected={ms.isSelected(goal.id)}
                onToggleSelect={ms.toggle}
              />
            ) : (
              <ReductionGoalCard
                key={goal.id}
                goal={goal}
                movements={movements}
                categories={categories}
                accounts={accounts}
                onEdit={setEditingGoal}
                onMarkComplete={(g) => markCompleteMutation.mutate(g)}
                selectionMode={ms.selectionMode}
                isSelected={ms.isSelected(goal.id)}
                onToggleSelect={ms.toggle}
              />
            )
          )}
        </div>
      )}

      {/* Mobile FAB */}
      <FABCreate categories={categories} accounts={accounts} movements={movements} />

      {/* Edit dialog */}
      {editingGoal && (
        <EditGoalDialog
          goal={editingGoal}
          categories={categories}
          accounts={accounts}
          movements={movements}
          open={!!editingGoal}
          onOpenChange={(v) => { if (!v) setEditingGoal(null) }}
        />
      )}

      {/* Selection bar */}
      {ms.selectionMode && (
        <SelectionBar
          count={ms.count}
          total={filteredGoalIds.length}
          onSelectAll={() => ms.toggleAll(filteredGoalIds)}
          onDelete={() => setConfirmOpen(true)}
          onCancel={ms.exit}
          isPending={bulkPending}
        />
      )}

      {/* Bulk delete confirm */}
      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={(v) => { if (!v) setConfirmOpen(false) }}
        title="Eliminar metas"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={bulkPending}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkPending} className="press-effect">
              {bulkPending ? "Eliminando…" : `Eliminar (${ms.count})`}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          ¿Eliminar {ms.count} meta{ms.count !== 1 ? "s" : ""}? Esta acción no se puede deshacer.
        </p>
      </ConfirmSheet>
    </div>
  )
}
