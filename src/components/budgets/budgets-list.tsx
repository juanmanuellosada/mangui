"use client"

import { useState, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  PlusCircle,
  Pencil,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import { MangoSelect, type MangoSelectOption } from "@/components/ui/mango-select"
import { MangoMultiSelect } from "@/components/ui/mango-multi-select"
import { BudgetForm, budgetToFormValues, type BudgetFormValues } from "./budget-form"
import {
  BUDGETS_KEY,
  computeBudgetProgress,
  periodLabel,
  scopeLabel,
  activeBudgetWindow,
  type Budget,
  type BudgetProgressStatus,
} from "@/lib/budgets"
import { MOVEMENTS_KEY, ACCOUNTS_KEY, CATEGORIES_KEY } from "@/lib/movements"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { renderCategoryIcon } from "@/lib/categories"
import { AccountIconChip } from "@/lib/accounts"
import { CategoryIconChip } from "@/lib/categories"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
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

// ── Normalize helper for accent-insensitive search ────────────────────────────

function normalize(s: string) {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

// ── Filter types ──────────────────────────────────────────────────────────────

type EstadoFilter = "todos" | "activos" | "pausados"
type MonedaFilter = "todas" | "ARS" | "USD"
type PeriodoFilter = "todos" | "weekly" | "biweekly" | "monthly" | "quarterly" | "annual" | "custom"
type SortKey = "recientes" | "nombre" | "porcentaje" | "limite"
type SortDir = "asc" | "desc"

interface BudgetFilters {
  search: string
  estado: EstadoFilter
  moneda: MonedaFilter
  periodo: PeriodoFilter
  categoryIds: string[]
  accountIds: string[]
  sortKey: SortKey
  sortDir: SortDir
}

const DEFAULT_FILTERS: BudgetFilters = {
  search: "",
  estado: "todos",
  moneda: "todas",
  periodo: "todos",
  categoryIds: [],
  accountIds: [],
  sortKey: "recientes",
  sortDir: "desc",
}

// ── Period options for MangoSelect ────────────────────────────────────────────

const PERIODO_OPTIONS: MangoSelectOption[] = [
  { value: "todos", label: "Todos los períodos" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
  { value: "quarterly", label: "Trimestral" },
  { value: "annual", label: "Anual" },
  { value: "custom", label: "Personalizado" },
]

// ── Sort pills ────────────────────────────────────────────────────────────────

const BUDGET_SORT_PILLS: { key: SortKey; label: string }[] = [
  { key: "recientes", label: "Recientes" },
  { key: "nombre", label: "Nombre" },
  { key: "porcentaje", label: "% usado" },
  { key: "limite", label: "Límite" },
]

function BudgetSortControl({
  sortKey,
  sortDir,
  onChange,
}: {
  sortKey: SortKey
  sortDir: SortDir
  onChange: (key: SortKey, dir: SortDir) => void
}) {
  function handleClick(key: SortKey) {
    if (key === sortKey) {
      onChange(key, sortDir === "asc" ? "desc" : "asc")
    } else {
      const defaultDir: SortDir =
        key === "porcentaje" || key === "limite" || key === "recientes" ? "desc" : "asc"
      onChange(key, defaultDir)
    }
  }

  return (
    <div role="group" aria-label="Ordenar por" className="flex items-center gap-1 flex-wrap shrink-0">
      {BUDGET_SORT_PILLS.map(({ key, label }) => {
        const isActive = sortKey === key
        const showDir = isActive && key !== "recientes"
        const DirIcon = sortDir === "asc" ? ChevronUp : ChevronDown
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleClick(key)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium",
              "border transition-all duration-150 cursor-pointer select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                : "bg-background border-input text-muted-foreground hover:border-ring/60 hover:text-foreground dark:bg-input/30"
            )}
          >
            <span>{label}</span>
            {showDir && <DirIcon className="h-3 w-3 shrink-0" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function BudgetFilterBar({
  filters,
  onChange,
  categories,
  accounts,
}: {
  filters: BudgetFilters
  onChange: (f: BudgetFilters) => void
  categories: Category[]
  accounts: Account[]
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false)

  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.estado !== "todos" ||
    filters.moneda !== "todas" ||
    filters.periodo !== "todos" ||
    filters.categoryIds.length > 0 ||
    filters.accountIds.length > 0 ||
    filters.sortKey !== "recientes"

  // Active chips for mobile compact row
  const activeChips: string[] = []
  if (filters.estado !== "todos") {
    activeChips.push(filters.estado === "activos" ? "Activos" : "Pausados")
  }
  if (filters.moneda !== "todas") activeChips.push(filters.moneda)
  if (filters.periodo !== "todos") {
    activeChips.push(PERIODO_OPTIONS.find((o) => o.value === filters.periodo)?.label ?? "")
  }
  if (filters.categoryIds.length > 0) {
    activeChips.push(`${filters.categoryIds.length} categoría${filters.categoryIds.length !== 1 ? "s" : ""}`)
  }
  if (filters.accountIds.length > 0) {
    activeChips.push(`${filters.accountIds.length} cuenta${filters.accountIds.length !== 1 ? "s" : ""}`)
  }
  if (filters.sortKey !== "recientes") {
    activeChips.push(`Orden: ${BUDGET_SORT_PILLS.find((p) => p.key === filters.sortKey)?.label ?? ""}`)
  }

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
    leading: <CategoryIconChip icon={c.icon} />,
  }))

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    leading: <AccountIconChip icon={a.icon} />,
  }))

  function clearAll() {
    onChange(DEFAULT_FILTERS)
  }

  // Secondary filters panel — shared between desktop (always visible) and mobile (expanded)
  const secondaryFilters = (
    <div className="space-y-4">
      {/* Estado | Ordenar | Moneda — primera fila */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1.5">
          <Label className="text-xs">Estado</Label>
          <div role="group" aria-label="Filtrar por estado" className="flex items-center gap-1">
            {(["todos", "activos", "pausados"] as const).map((v) => {
              const label = v === "todos" ? "Todos" : v === "activos" ? "Activos" : "Pausados"
              const isSelected = filters.estado === v
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange({ ...filters, estado: v })}
                  aria-pressed={isSelected}
                  className={cn(
                    "inline-flex items-center h-8 px-2.5 rounded-lg text-xs font-medium",
                    "border transition-all duration-150 cursor-pointer select-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                      : "bg-background border-input text-muted-foreground hover:border-ring/60 hover:text-foreground dark:bg-input/30"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Ordenar</Label>
          <BudgetSortControl
            sortKey={filters.sortKey}
            sortDir={filters.sortDir}
            onChange={(key, dir) => onChange({ ...filters, sortKey: key, sortDir: dir })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Moneda</Label>
          <div role="group" aria-label="Filtrar por moneda" className="flex items-center gap-1">
            {(["todas", "ARS", "USD"] as const).map((v) => {
              const label = v === "todas" ? "Todas" : v
              const isSelected = filters.moneda === v
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange({ ...filters, moneda: v })}
                  aria-pressed={isSelected}
                  className={cn(
                    "inline-flex items-center h-8 px-2.5 rounded-lg text-xs font-medium",
                    "border transition-all duration-150 cursor-pointer select-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                      : "bg-background border-input text-muted-foreground hover:border-ring/60 hover:text-foreground dark:bg-input/30"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Período + Categorías + Cuentas row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Período</Label>
          <MangoSelect
            value={filters.periodo}
            onChange={(v) => onChange({ ...filters, periodo: v as PeriodoFilter })}
            options={PERIODO_OPTIONS}
            aria-label="Filtrar por período"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Categorías</Label>
          <MangoMultiSelect
            values={filters.categoryIds}
            onChange={(categoryIds) => onChange({ ...filters, categoryIds })}
            options={categoryOptions}
            placeholder="Todas las categorías"
            showSearch
            aria-label="Filtrar por categoría"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Cuentas</Label>
          <MangoMultiSelect
            values={filters.accountIds}
            onChange={(accountIds) => onChange({ ...filters, accountIds })}
            options={accountOptions}
            placeholder="Todas las cuentas"
            showSearch
            aria-label="Filtrar por cuenta"
          />
        </div>
      </div>
    </div>
  )

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      {/* Top row: search + mobile filter button + clear */}
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar presupuesto…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className={cn(
              "w-full h-9 pl-9 pr-3 rounded-lg text-sm",
              "bg-background border border-input",
              "placeholder:text-muted-foreground/60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
              "transition-colors duration-150"
            )}
            aria-label="Buscar presupuestos"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, search: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Mobile: "Filtros" button */}
        <button
          type="button"
          onClick={() => setMobileExpanded((v) => !v)}
          className={cn(
            "lg:hidden inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium",
            "border transition-colors duration-150 press-effect cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            mobileExpanded || hasActiveFilters
              ? "bg-primary/10 border-primary/40 text-primary"
              : "border-input bg-background text-muted-foreground hover:text-foreground"
          )}
          aria-label="Filtros"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filtros</span>
          {activeChips.length > 0 && (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeChips.length}
            </span>
          )}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-150", mobileExpanded && "rotate-180")} />
        </button>

        {/* Clear all (desktop) */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            aria-label="Limpiar filtros"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* Mobile active chips (collapsed) */}
      {!mobileExpanded && activeChips.length > 0 && (
        <div className="lg:hidden flex flex-wrap gap-1.5">
          {activeChips.map((chip, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              {chip}
            </span>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:text-destructive text-xs transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        </div>
      )}

      {/* Desktop: always show secondary filters */}
      <div className="hidden lg:block">
        {secondaryFilters}
      </div>

      {/* Mobile: show secondary filters when expanded */}
      {mobileExpanded && (
        <div className="lg:hidden">
          {secondaryFilters}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar todos los filtros
            </button>
          )}
        </div>
      )}
    </div>
  )
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

// ── Active window label using activeBudgetWindow ──────────────────────────────

function windowLabelFromBudget(budget: Budget): string {
  const w = activeBudgetWindow(budget)
  const from = parseISO(w.from)
  const to = parseISO(w.to)

  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    const monthName = format(from, "MMM", { locale: es })
    return `${from.getDate()}–${to.getDate()} ${monthName}.`
  }
  return `${format(from, "d MMM", { locale: es })}. – ${format(to, "d MMM", { locale: es })}.`
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

  void scope

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
        {/* Budget icon */}
        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted/60 border border-border/40 overflow-hidden">
          {budget.icon ? (
            renderCategoryIcon(budget.icon, { size: "h-5 w-5", logoFill: true })
          ) : (
            <Wallet className="h-4.5 w-4.5 text-muted-foreground" style={{ width: "1.125rem", height: "1.125rem" }} />
          )}
        </div>

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

          {/* Window label using activeBudgetWindow */}
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {windowLabelFromBudget(budget)}
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
          icon: values.icon?.trim() || null,
          limit_amount: values.limit_amount,
          currency: values.currency,
          period: values.period,
          category_ids: values.category_ids,
          account_ids: values.account_ids,
          is_recurring: values.is_recurring,
          start_date: values.start_date,
          end_date: values.end_date || null,
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
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="gap-1.5 press-effect cursor-pointer font-semibold shadow-sm shadow-primary/20"
      >
        <PlusCircle className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Nuevo presupuesto</span>
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
          icon: values.icon?.trim() || null,
          limit_amount: values.limit_amount,
          currency: values.currency,
          period: values.period,
          category_ids: values.category_ids,
          account_ids: values.account_ids,
          is_recurring: values.is_recurring,
          start_date: values.start_date,
          end_date: values.end_date || null,
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
        <DialogContent compact className="max-w-sm">
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
  const [filters, setFilters] = useState<BudgetFilters>(DEFAULT_FILTERS)

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

  // Client-side filtering + sorting
  const filteredBudgets = useMemo(() => {
    const q = normalize(filters.search)
    return budgets
      .filter((b) => {
        // Search by name (accent-insensitive)
        if (q && !normalize(b.name).includes(q)) return false
        // Estado
        if (filters.estado === "activos" && b.status !== "active") return false
        if (filters.estado === "pausados" && b.status !== "paused") return false
        // Moneda
        if (filters.moneda !== "todas" && b.currency !== filters.moneda) return false
        // Período: "custom" means period === null
        if (filters.periodo !== "todos") {
          if (filters.periodo === "custom") {
            if (b.period !== null) return false
          } else {
            if (b.period !== filters.periodo) return false
          }
        }
        // Categorías: empty scope (category_ids = []) matches any filter (budget applies to all)
        if (filters.categoryIds.length > 0 && b.category_ids.length > 0) {
          if (!filters.categoryIds.some((id) => b.category_ids.includes(id))) return false
        }
        // Cuentas: empty scope (account_ids = []) matches any filter (budget applies to all)
        if (filters.accountIds.length > 0 && b.account_ids.length > 0) {
          if (!filters.accountIds.some((id) => b.account_ids.includes(id))) return false
        }
        return true
      })
      .sort((a, b) => {
        switch (filters.sortKey) {
          case "nombre": {
            const cmp = a.name.localeCompare(b.name, "es")
            return filters.sortDir === "asc" ? cmp : -cmp
          }
          case "porcentaje": {
            const pa = computeBudgetProgress(a, movements).percent
            const pb = computeBudgetProgress(b, movements).percent
            return filters.sortDir === "asc" ? pa - pb : pb - pa
          }
          case "limite": {
            const cmp = a.limit_amount - b.limit_amount
            return filters.sortDir === "asc" ? cmp : -cmp
          }
          case "recientes":
          default: {
            const cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            return filters.sortDir === "asc" ? -cmp : cmp
          }
        }
      })
  }, [budgets, filters, movements])

  const isFiltered =
    filters.search.trim() !== "" ||
    filters.estado !== "todos" ||
    filters.moneda !== "todas" ||
    filters.periodo !== "todos" ||
    filters.categoryIds.length > 0 ||
    filters.accountIds.length > 0 ||
    filters.sortKey !== "recientes"

  const displayBudgets = isFiltered ? filteredBudgets : budgets
  const budgetIds = displayBudgets.map((b) => b.id)

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
    <div className="space-y-5 animate-fade-in">
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

      {/* Filter bar — only when there are budgets */}
      {!loadingBudgets && budgets.length > 0 && (
        <BudgetFilterBar
          filters={filters}
          onChange={setFilters}
          categories={categories}
          accounts={accounts}
        />
      )}

      {/* Skeleton */}
      {loadingBudgets && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
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

      {/* Filtered empty state */}
      {!loadingBudgets && budgets.length > 0 && isFiltered && displayBudgets.length === 0 && (
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Sin resultados</p>
            <p className="text-sm text-muted-foreground">
              No se encontraron presupuestos con esos filtros.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Limpiar filtros
          </Button>
        </div>
      )}

      {/* Budget cards */}
      {!loadingBudgets && displayBudgets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {displayBudgets.map((budget) => (
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
        compact
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
