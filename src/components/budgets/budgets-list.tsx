"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  PlusCircle,
  Pencil,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Pause,
  Play,
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
import { Switch } from "@/components/ui/switch"
import { BudgetForm, budgetToFormValues, type BudgetFormValues } from "./budget-form"
import {
  BUDGETS_KEY,
  computeBudgetProgress,
  periodLabel,
  scopeLabel,
  windowLabel,
  type Budget,
  type BudgetProgressStatus,
} from "@/lib/budgets"
import { MOVEMENTS_KEY, ACCOUNTS_KEY, CATEGORIES_KEY } from "@/lib/movements"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/database.types"

type Movement = Tables<"movements">
type Category = Tables<"categories">
type Account = Tables<"accounts">

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchBudgets(): Promise<Budget[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("budgets")
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

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: BudgetProgressStatus }) {
  if (status === "exceeded")
    return <XCircle className="h-4 w-4 text-destructive flex-shrink-0" aria-label="Excedido" />
  if (status === "near")
    return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" aria-label="Cerca del límite" />
  return <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" aria-label="En curso" />
}

function statusLabel(status: BudgetProgressStatus, budgetStatus: Budget["status"]): string {
  if (budgetStatus === "paused") return "Pausado"
  if (status === "exceeded") return "Excedido"
  if (status === "near") return "Cerca del límite"
  return "En curso"
}

function progressBarColor(status: BudgetProgressStatus): string {
  if (status === "exceeded") return "bg-destructive"
  if (status === "near") return "bg-amber-500"
  return "bg-success"
}

// ── Budget card ───────────────────────────────────────────────────────────────

function BudgetCard({
  budget,
  movements,
  categories,
  accounts,
  onEdit,
  onToggleStatus,
  isTogglingStatus,
  selectionMode,
  isSelected,
  onToggleSelect,
}: {
  budget: Budget
  movements: Movement[]
  categories: Category[]
  accounts: Account[]
  onEdit: (b: Budget) => void
  onToggleStatus: (b: Budget) => void
  isTogglingStatus: boolean
  selectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}) {
  const progress = computeBudgetProgress(budget, movements)
  const scope = scopeLabel(budget, { categories, accounts })
  const catChips = budget.category_ids
    .map((id) => categories.find((c) => c.id === id)?.name)
    .filter(Boolean) as string[]
  const accChips = budget.account_ids
    .map((id) => accounts.find((a) => a.id === id)?.name)
    .filter(Boolean) as string[]

  const isPaused = budget.status === "paused"

  return (
    <div
      onClick={selectionMode ? () => onToggleSelect?.(budget.id) : undefined}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? isSelected : undefined}
      className={cn(
        "rounded-2xl border border-border/60 bg-card overflow-hidden",
        "transition-opacity duration-150",
        isPaused && "opacity-60",
        selectionMode && "cursor-pointer",
        isSelected && selectedItemCn(true)
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate">{budget.name}</h3>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {periodLabel(budget.period)}
            </span>
            {isPaused && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Pausado
              </span>
            )}
          </div>
          {/* Scope chips */}
          {(catChips.length > 0 || accChips.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {catChips.map((name) => (
                <span
                  key={name}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium"
                >
                  {name}
                </span>
              ))}
              {accChips.map((name) => (
                <span
                  key={name}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent font-medium"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions — hidden in selection mode */}
        {!selectionMode && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Switch
              checked={!isPaused}
              onCheckedChange={() => onToggleStatus(budget)}
              disabled={isTogglingStatus}
              aria-label={isPaused ? "Reanudar presupuesto" : "Pausar presupuesto"}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); onEdit(budget) }}
              title="Editar"
              className="press-effect cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {selectionMode && (
          <div className="flex items-center shrink-0">
            <RowCheckbox
              checked={!!isSelected}
              onChange={() => onToggleSelect?.(budget.id)}
            />
          </div>
        )}
      </div>

      {/* Progress */}
      {!isPaused && (
        <div className="px-4 pb-4 space-y-2">
          {/* Progress bar */}
          <div className="h-2 rounded-full bg-border overflow-hidden" role="progressbar"
            aria-valuenow={Math.round(progress.percent)}
            aria-valuemin={0}
            aria-valuemax={100}>
            <div
              className={cn("h-full rounded-full transition-all duration-500", progressBarColor(progress.status))}
              style={{ width: `${Math.min(progress.percent, 100)}%` }}
            />
          </div>

          {/* Amounts + status */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <StatusIcon status={progress.status} />
              <span className="text-xs text-muted-foreground">
                {statusLabel(progress.status, budget.status)}
              </span>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {progress.percent.toFixed(0)}%
              </span>
            </div>
            <div className="flex items-baseline gap-1 text-right">
              <span className="text-sm font-bold tabular-nums">
                {formatCurrency(progress.spent, budget.currency)}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                / {formatCurrency(progress.limit, budget.currency)}
              </span>
            </div>
          </div>

          {/* Window label */}
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {windowLabel(budget.period, budget.start_date)}
          </p>
        </div>
      )}

      {isPaused && (
        <div className="px-4 pb-4">
          <p className="text-xs text-muted-foreground">
            Límite: {formatCurrency(budget.limit_amount, budget.currency)}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Create dialog ─────────────────────────────────────────────────────────────

function CreateBudgetDialog({
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
    mutationFn: async (values: BudgetFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const { data, error } = await supabase
        .from("budgets")
        .insert({
          user_id: user.id,
          name: values.name,
          limit_amount: values.limit_amount,
          currency: values.currency,
          period: values.period,
          category_ids: values.category_ids,
          account_ids: values.account_ids,
          is_recurring: values.is_recurring,
          start_date: values.start_date,
          status: "active",
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_KEY })
      toast.success("Presupuesto creado")
      setOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear el presupuesto", { description: err.message })
    },
  })

  return (
    <>
      {/* Desktop button */}
      <Button
        onClick={() => setOpen(true)}
        className="hidden lg:inline-flex press-effect cursor-pointer font-semibold shadow-sm shadow-primary/20"
      >
        <PlusCircle className="h-4 w-4" />
        Nuevo presupuesto
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo presupuesto</DialogTitle>
            <DialogDescription>
              Configurá un límite de gasto por período.
            </DialogDescription>
          </DialogHeader>
          <BudgetForm
            categories={categories}
            accounts={accounts}
            movements={movements}
            onSubmit={async (v) => { await mutation.mutateAsync(v) }}
            isLoading={mutation.isPending}
            submitLabel="Guardar presupuesto"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

function EditBudgetDialog({
  budget,
  categories,
  accounts,
  movements,
  open,
  onOpenChange,
}: {
  budget: Budget
  categories: Category[]
  accounts: Account[]
  movements: Movement[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: async (values: BudgetFormValues) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("budgets")
        .update({
          name: values.name,
          limit_amount: values.limit_amount,
          currency: values.currency,
          period: values.period,
          category_ids: values.category_ids,
          account_ids: values.account_ids,
          is_recurring: values.is_recurring,
          start_date: values.start_date,
          updated_at: new Date().toISOString(),
        })
        .eq("id", budget.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_KEY })
      toast.success("Presupuesto actualizado")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al actualizar", { description: err.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase.from("budgets").delete().eq("id", budget.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_KEY })
      toast.success("Presupuesto eliminado")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al eliminar", { description: err.message })
    },
  })

  const [confirmDelete, setConfirmDelete] = useState(false)

  if (confirmDelete) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar presupuesto</DialogTitle>
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
          <DialogTitle>Editar presupuesto</DialogTitle>
          <DialogDescription>Modificá los datos del presupuesto.</DialogDescription>
        </DialogHeader>
        <BudgetForm
          categories={categories}
          accounts={accounts}
          movements={movements}
          defaultValues={budgetToFormValues(budget)}
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
    mutationFn: async (values: BudgetFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const { data, error } = await supabase
        .from("budgets")
        .insert({
          user_id: user.id,
          name: values.name,
          limit_amount: values.limit_amount,
          currency: values.currency,
          period: values.period,
          category_ids: values.category_ids,
          account_ids: values.account_ids,
          is_recurring: values.is_recurring,
          start_date: values.start_date,
          status: "active",
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_KEY })
      toast.success("Presupuesto creado")
      setOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear el presupuesto", { description: err.message })
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
        aria-label="Nuevo presupuesto"
      >
        <PlusCircle className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo presupuesto</DialogTitle>
            <DialogDescription>
              Configurá un límite de gasto por período.
            </DialogDescription>
          </DialogHeader>
          <BudgetForm
            categories={categories}
            accounts={accounts}
            movements={movements}
            onSubmit={async (v) => { await mutation.mutateAsync(v) }}
            isLoading={mutation.isPending}
            submitLabel="Guardar presupuesto"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ budgets, movements }: { budgets: Budget[]; movements: Movement[] }) {
  const active = budgets.filter((b) => b.status === "active")
  const exceeded = active.filter((b) => {
    const p = computeBudgetProgress(b, movements)
    return p.status === "exceeded"
  })

  if (active.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
      <span className="font-medium">{active.length} presupuesto{active.length !== 1 ? "s" : ""} activo{active.length !== 1 ? "s" : ""}</span>
      {exceeded.length > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
          <XCircle className="h-3 w-3" />
          {exceeded.length} excedido{exceeded.length !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BudgetsList() {
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const ms = useMultiSelect()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)

  const { data: budgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: BUDGETS_KEY,
    queryFn: fetchBudgets,
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

  const toggleStatusMutation = useMutation({
    mutationFn: async (budget: Budget) => {
      const supabase = createClient()
      const newStatus = budget.status === "active" ? "paused" : "active"
      const { error } = await supabase
        .from("budgets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", budget.id)
      if (error) throw error
      return newStatus
    },
    onMutate: async (budget) => {
      await queryClient.cancelQueries({ queryKey: BUDGETS_KEY })
      const previous = queryClient.getQueryData<Budget[]>(BUDGETS_KEY)
      queryClient.setQueryData<Budget[]>(BUDGETS_KEY, (old = []) =>
        old.map((b) =>
          b.id === budget.id
            ? { ...b, status: b.status === "active" ? "paused" : "active" }
            : b
        )
      )
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(BUDGETS_KEY, context.previous)
      toast.error("Error al cambiar estado", { description: err.message })
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_KEY })
      toast.success(newStatus === "paused" ? "Presupuesto pausado" : "Presupuesto reanudado")
    },
  })

  const budgetIds = budgets.map((b) => b.id)

  async function handleBulkDelete() {
    setBulkPending(true)
    const ids = Array.from(ms.selectedIds)
    const result = await bulkDelete("budgets", ids)
    setBulkPending(false)
    setConfirmOpen(false)
    ms.exit()
    queryClient.invalidateQueries({ queryKey: BUDGETS_KEY })
    if (result.failed === 0) {
      toast.success(`Se eliminaron ${result.deleted} presupuesto${result.deleted !== 1 ? "s" : ""}`)
    } else {
      toast.warning(`Se eliminaron ${result.deleted}. ${result.failed} no se pud${result.failed !== 1 ? "ieron" : "o"} eliminar.`)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1
            className="text-2xl md:text-3xl tracking-tight font-bold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Presupuestos
          </h1>
          {!loadingBudgets && budgets.length > 0 && (
            <div className="mt-1">
              <SummaryBar budgets={budgets} movements={movements} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!loadingBudgets && budgets.length > 0 && !ms.selectionMode && (
            <SelectButton onClick={ms.enter} />
          )}
          {!ms.selectionMode && <CreateBudgetDialog categories={categories} accounts={accounts} movements={movements} />}
        </div>
      </div>

      {/* Skeleton */}
      {loadingBudgets && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadingBudgets && budgets.length === 0 && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-10 text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-primary/15 flex items-center justify-center mx-auto">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2
              className="text-xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Sin presupuestos aún
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Creá un presupuesto para controlar cuánto gastás en cada categoría.
            </p>
          </div>
          <CreateBudgetDialog categories={categories} accounts={accounts} movements={movements} />
        </div>
      )}

      {/* Budget cards */}
      {!loadingBudgets && budgets.length > 0 && (
        <div className="space-y-3">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              movements={movements}
              categories={categories}
              accounts={accounts}
              onEdit={setEditingBudget}
              onToggleStatus={(b) => toggleStatusMutation.mutate(b)}
              isTogglingStatus={toggleStatusMutation.isPending}
              selectionMode={ms.selectionMode}
              isSelected={ms.isSelected(budget.id)}
              onToggleSelect={ms.toggle}
            />
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      <FABCreate categories={categories} accounts={accounts} movements={movements} />

      {/* Edit dialog */}
      {editingBudget && (
        <EditBudgetDialog
          budget={editingBudget}
          categories={categories}
          accounts={accounts}
          movements={movements}
          open={!!editingBudget}
          onOpenChange={(v) => { if (!v) setEditingBudget(null) }}
        />
      )}

      {/* Selection bar */}
      {ms.selectionMode && (
        <SelectionBar
          count={ms.count}
          total={budgetIds.length}
          onSelectAll={() => ms.toggleAll(budgetIds)}
          onDelete={() => setConfirmOpen(true)}
          onCancel={ms.exit}
          isPending={bulkPending}
        />
      )}

      {/* Bulk delete confirm */}
      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={(v) => { if (!v) setConfirmOpen(false) }}
        title="Eliminar presupuestos"
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
          ¿Eliminar {ms.count} presupuesto{ms.count !== 1 ? "s" : ""}? Esta acción no se puede deshacer.
        </p>
      </ConfirmSheet>
    </div>
  )
}
