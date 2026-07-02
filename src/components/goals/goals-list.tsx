"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  PlusCircle,
  Pencil,
  Target,
  TrendingDown,
  TrendingUp,
  ArrowUpRight,
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
import { MangoMultiSelect } from "@/components/ui/mango-multi-select"
import { CurrencySegmented } from "@/components/ui/currency-segmented"
import { GoalForm, goalToFormValues, saveGoal, type GoalFormValues } from "./goal-form"
import { GoalProgressBar } from "@/components/goals/goal-progress-bar"
import {
  GOALS_KEY,
  computeGoalProgress,
  maybeRenewGoal,
  type Goal,
  type GoalScope,
  type GoalType,
} from "@/lib/goals"
import { MOVEMENTS_KEY } from "@/lib/movements"
import { formatCurrency, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useIsDemo } from "@/lib/use-is-demo"
import { usePlan } from "@/lib/use-plan"
import Link from "next/link"
import { useAccounts } from "@/lib/hooks/use-accounts"
import { useCategories } from "@/lib/hooks/use-categories"
import { QueryError } from "@/components/ui/query-error"
import { renderCategoryIcon } from "@/lib/categories"
import { AccountIconChip } from "@/lib/accounts"
import { CategoryIconChip } from "@/lib/categories"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import type { Tables } from "@/lib/database.types"

type Movement = Tables<"movements">
type Category = Tables<"categories">
type Account = Tables<"accounts">

// ── Scope query keys ──────────────────────────────────────────────────────────

export const GOAL_ACCOUNTS_KEY = ["goal_accounts"] as const
export const GOAL_CATEGORIES_KEY = ["goal_categories"] as const

// ── Data fetchers ─────────────────────────────────────────────────────────────

export async function fetchGoals(): Promise<Goal[]> {
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

export async function fetchGoalAccounts(): Promise<{ goal_id: string; account_id: string }[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("goal_accounts").select("goal_id, account_id")
  if (error) throw error
  return data
}

export async function fetchGoalCategories(): Promise<{ goal_id: string; category_id: string }[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("goal_categories").select("goal_id, category_id")
  if (error) throw error
  return data
}

// ── Scope builder ─────────────────────────────────────────────────────────────

export function buildScopeMap(
  goalAccountRows: { goal_id: string; account_id: string }[],
  goalCategoryRows: { goal_id: string; category_id: string }[]
): Map<string, GoalScope> {
  const map = new Map<string, GoalScope>()
  for (const row of goalAccountRows) {
    const existing = map.get(row.goal_id) ?? { accountIds: [], categoryIds: [] }
    existing.accountIds.push(row.account_id)
    map.set(row.goal_id, existing)
  }
  for (const row of goalCategoryRows) {
    const existing = map.get(row.goal_id) ?? { accountIds: [], categoryIds: [] }
    existing.categoryIds.push(row.category_id)
    map.set(row.goal_id, existing)
  }
  return map
}

export function scopeFor(goalId: string, scopeMap: Map<string, GoalScope>): GoalScope {
  return scopeMap.get(goalId) ?? { accountIds: [], categoryIds: [] }
}

// ── Normalize for accent-insensitive search ───────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

// ── Filter types ──────────────────────────────────────────────────────────────

type TipoFilter = "todas" | GoalType
type EstadoFilter = "todas" | "activas" | "completadas"
type MonedaFilter = "todas" | "ARS" | "USD"
type SortKey = "recientes" | "nombre" | "progreso" | "fin"
type SortDir = "asc" | "desc"

interface GoalFilters {
  search: string
  tipo: TipoFilter
  estado: EstadoFilter
  moneda: MonedaFilter
  categoryIds: string[]
  accountIds: string[]
  sortKey: SortKey
  sortDir: SortDir
}

const DEFAULT_FILTERS: GoalFilters = {
  search: "",
  tipo: "todas",
  estado: "todas",
  moneda: "todas",
  categoryIds: [],
  accountIds: [],
  sortKey: "recientes",
  sortDir: "desc",
}

// ── Sort control ──────────────────────────────────────────────────────────────

const GOAL_SORT_PILLS: { key: SortKey; label: string }[] = [
  { key: "recientes", label: "Recientes" },
  { key: "nombre", label: "Nombre" },
  { key: "progreso", label: "Progreso" },
  { key: "fin", label: "Fecha fin" },
]

function GoalSortControl({
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
        key === "progreso" || key === "recientes" ? "desc" : "asc"
      onChange(key, defaultDir)
    }
  }

  return (
    <div role="group" aria-label="Ordenar por" className="flex items-center gap-1 flex-wrap shrink-0">
      {GOAL_SORT_PILLS.map(({ key, label }) => {
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

const TIPO_LABELS: Record<TipoFilter, string> = {
  todas: "Todas",
  income: "Ingreso",
  saving: "Ahorro",
  reduction: "Reducción",
}

function GoalFilterBar({
  filters,
  onChange,
  categories,
  accounts,
}: {
  filters: GoalFilters
  onChange: (f: GoalFilters) => void
  categories: Category[]
  accounts: Account[]
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false)

  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.tipo !== "todas" ||
    filters.estado !== "todas" ||
    filters.moneda !== "todas" ||
    filters.categoryIds.length > 0 ||
    filters.accountIds.length > 0 ||
    filters.sortKey !== "recientes"

  const activeChips: string[] = []
  if (filters.tipo !== "todas") activeChips.push(TIPO_LABELS[filters.tipo])
  if (filters.estado !== "todas") {
    activeChips.push(filters.estado === "activas" ? "Activas" : "Completadas")
  }
  if (filters.moneda !== "todas") activeChips.push(filters.moneda)
  if (filters.categoryIds.length > 0) {
    activeChips.push(`${filters.categoryIds.length} categoría${filters.categoryIds.length !== 1 ? "s" : ""}`)
  }
  if (filters.accountIds.length > 0) {
    activeChips.push(`${filters.accountIds.length} cuenta${filters.accountIds.length !== 1 ? "s" : ""}`)
  }
  if (filters.sortKey !== "recientes") {
    activeChips.push(`Orden: ${GOAL_SORT_PILLS.find((p) => p.key === filters.sortKey)?.label ?? ""}`)
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

  const pillClass = (isSelected: boolean) =>
    cn(
      "inline-flex items-center h-8 px-2.5 rounded-lg text-xs font-medium",
      "border transition-all duration-150 cursor-pointer select-none",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      isSelected
        ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
        : "bg-background border-input text-muted-foreground hover:border-ring/60 hover:text-foreground dark:bg-input/30"
    )

  const secondaryFilters = (
    <div className="space-y-4">
      {/* Estado + Tipo | Ordenar | Moneda — primera fila */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <div role="group" aria-label="Filtrar por estado" className="flex items-center gap-1">
              {(["todas", "activas", "completadas"] as const).map((v) => {
                const label = v === "todas" ? "Todas" : v === "activas" ? "Activas" : "Completadas"
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onChange({ ...filters, estado: v })}
                    aria-pressed={filters.estado === v}
                    className={pillClass(filters.estado === v)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <div role="group" aria-label="Filtrar por tipo" className="flex items-center gap-1">
              {(["todas", "income", "saving", "reduction"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange({ ...filters, tipo: v })}
                  aria-pressed={filters.tipo === v}
                  className={pillClass(filters.tipo === v)}
                >
                  {TIPO_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Ordenar</Label>
          <GoalSortControl
            sortKey={filters.sortKey}
            sortDir={filters.sortDir}
            onChange={(key, dir) => onChange({ ...filters, sortKey: key, sortDir: dir })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Moneda</Label>
          <CurrencySegmented
            value={filters.moneda === "todas" ? "all" : filters.moneda}
            onChange={(v) => onChange({ ...filters, moneda: v === "all" ? "todas" : v })}
          />
        </div>
      </div>

      {/* Categorías + Cuentas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      {/* Top row: search + mobile button + clear */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar meta…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className={cn(
              "w-full h-9 pl-9 pr-3 rounded-lg text-sm",
              "bg-background border border-input",
              "placeholder:text-muted-foreground/60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
              "transition-colors duration-150"
            )}
            aria-label="Buscar metas"
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

      {/* Desktop: always visible */}
      <div className="hidden lg:block">
        {secondaryFilters}
      </div>

      {/* Mobile: expanded */}
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

// ── Type icon helper ──────────────────────────────────────────────────────────

function typeIcon(type: GoalType, className = "h-4.5 w-4.5") {
  switch (type) {
    case "income":
      return <ArrowUpRight className={className} style={{ width: "1.125rem", height: "1.125rem" }} />
    case "saving":
      return <TrendingUp className={className} style={{ width: "1.125rem", height: "1.125rem" }} />
    case "reduction":
      return <TrendingDown className={className} style={{ width: "1.125rem", height: "1.125rem" }} />
  }
}

function typeColor(type: GoalType): string {
  switch (type) {
    case "income": return "bg-success/10 text-success"
    case "saving": return "bg-primary/10 text-primary"
    case "reduction": return "bg-amber-500/10 text-amber-600"
  }
}

function typeLabel(type: GoalType): string {
  switch (type) {
    case "income": return "Ingreso"
    case "saving": return "Ahorro"
    case "reduction": return "Reducción"
  }
}

// ── Goal card ─────────────────────────────────────────────────────────────────

function GoalCard({
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

// ── Create dialog ─────────────────────────────────────────────────────────────

function CreateGoalDialog({
  categories,
  accounts,
  movements,
  isDemo,
  atLimit,
}: {
  categories: Category[]
  accounts: Account[]
  movements: Movement[]
  isDemo?: boolean
  atLimit?: boolean
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const isDisabled = isDemo || atLimit

  const mutation = useMutation({
    mutationFn: async (values: GoalFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      if (atLimit) {
        throw new Error("Alcanzaste el límite del plan Free. Mejorá a Premium para crear más.")
      }
      return saveGoal(values, undefined, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY })
      queryClient.invalidateQueries({ queryKey: GOAL_ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: GOAL_CATEGORIES_KEY })
      toast.success("Meta creada")
      setOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear la meta", { description: err.message })
    },
  })

  return (
    <>
      {atLimit ? (
        <Link
          href="/ajustes#plan"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors duration-150 press-effect"
        >
          Mejorá a Premium
        </Link>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          size="sm"
          className="gap-1.5 press-effect cursor-pointer font-semibold shadow-sm shadow-primary/20"
          disabled={isDisabled}
          title={isDemo ? "No disponible en el modo demo" : undefined}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Nueva meta</span>
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva meta</DialogTitle>
            <DialogDescription>
              Definí un objetivo de ahorro, ingreso o reducción de gastos.
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

/**
 * Fetches scope for a single goal on dialog open.
 * Scoped to a per-goal query key so it doesn't conflict with the list-level scope.
 */
function useGoalScope(goalId: string, enabled: boolean) {
  const { data: accountRows = [], isPending: accountsPending } = useQuery({
    queryKey: ["goal_scope_accounts", goalId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("goal_accounts")
        .select("account_id")
        .eq("goal_id", goalId)
      if (error) throw error
      return data
    },
    enabled,
  })

  const { data: categoryRows = [], isPending: categoriesPending } = useQuery({
    queryKey: ["goal_scope_categories", goalId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("goal_categories")
        .select("category_id")
        .eq("goal_id", goalId)
      if (error) throw error
      return data
    },
    enabled,
  })

  const scope: GoalScope = {
    accountIds: accountRows.map((r) => r.account_id),
    categoryIds: categoryRows.map((r) => r.category_id),
  }

  const isPending = enabled && (accountsPending || categoriesPending)

  return { scope, isPending }
}

function EditGoalDialog({
  goal,
  categories,
  accounts,
  movements,
  open,
  onOpenChange,
  isDemo,
}: {
  goal: Goal
  categories: Category[]
  accounts: Account[]
  movements: Movement[]
  open: boolean
  onOpenChange: (v: boolean) => void
  isDemo?: boolean
}) {
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Load scope from goal_accounts / goal_categories while dialog is open
  const { scope, isPending: scopePending } = useGoalScope(goal.id, open)

  const updateMutation = useMutation({
    mutationFn: async (values: GoalFormValues) => {
      return saveGoal(values, goal.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY })
      queryClient.invalidateQueries({ queryKey: GOAL_ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: GOAL_CATEGORIES_KEY })
      queryClient.invalidateQueries({ queryKey: ["goal_scope_accounts", goal.id] })
      queryClient.invalidateQueries({ queryKey: ["goal_scope_categories", goal.id] })
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
      queryClient.invalidateQueries({ queryKey: GOAL_ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: GOAL_CATEGORIES_KEY })
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
        <DialogContent compact className="max-w-sm">
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
              disabled={deleteMutation.isPending || isDemo}
              title={isDemo ? "No disponible en el modo demo" : undefined}
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
        {scopePending ? (
          <div className="space-y-4 py-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <GoalForm
            categories={categories}
            accounts={accounts}
            movements={movements}
            defaultScope={scope}
            defaultValues={goalToFormValues(goal, scope)}
            onSubmit={async (v) => { await updateMutation.mutateAsync(v) }}
            onDelete={() => setConfirmDelete(true)}
            isLoading={updateMutation.isPending}
            submitLabel="Guardar cambios"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GoalsList() {
  const isDemo = useIsDemo()
  const { isPremium: userIsPremium, limits } = usePlan()
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [filters, setFilters] = useState<GoalFilters>(DEFAULT_FILTERS)
  const ms = useMultiSelect()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)

  const queryClient = useQueryClient()

  const {
    data: goals = [],
    isLoading: loadingGoals,
    isError: goalsError,
    refetch: refetchGoals,
  } = useQuery({
    queryKey: GOALS_KEY,
    queryFn: fetchGoals,
  })

  const { data: movements = [] } = useQuery({
    queryKey: MOVEMENTS_KEY,
    queryFn: fetchMovements,
  })

  const { data: categories = [] } = useCategories({ orderBy: "name" })

  const { data: accounts = [] } = useAccounts({ orderBy: "name" })

  const { data: goalAccountRows = [] } = useQuery({
    queryKey: GOAL_ACCOUNTS_KEY,
    queryFn: fetchGoalAccounts,
  })

  const { data: goalCategoryRows = [] } = useQuery({
    queryKey: GOAL_CATEGORIES_KEY,
    queryFn: fetchGoalCategories,
  })

  // Build scope map from relation rows
  const scopeMap = useMemo(
    () => buildScopeMap(goalAccountRows, goalCategoryRows),
    [goalAccountRows, goalCategoryRows]
  )

  // ── Lazy renewal ─────────────────────────────────────────────────────────────
  // After goals + movements are loaded, check for recurring goals whose period
  // has expired and renew them (snapshot + advance). Uses a ref to track which
  // goal IDs have already been processed this session to avoid re-running on
  // every re-render.
  //
  // Kept in a separate effect so it never blocks the render path. The Supabase
  // upsert (snapshot) has a unique constraint on (goal_id, period_start), so
  // concurrent calls are idempotent.
  const renewedIds = useRef(new Set<string>())

  useEffect(() => {
    if (loadingGoals || goals.length === 0 || movements.length === 0) return

    const supabase = createClient()
    const now = new Date()

    async function renewIfNeeded(goal: Goal) {
      if (renewedIds.current.has(goal.id)) return
      const scope = scopeFor(goal.id, scopeMap)
      const progress = computeGoalProgress(goal, movements, scope, now)
      const op = maybeRenewGoal(goal, progress, now)
      if (!op) return

      renewedIds.current.add(goal.id)

      try {
        // Upsert snapshot (idempotent via unique on goal_id + period_start)
        const { error: snapErr } = await supabase
          .from("goal_snapshots")
          .upsert(op.snapshot, { onConflict: "goal_id,period_start" })
        if (snapErr) throw snapErr

        // Advance goal period
        const { error: goalErr } = await supabase
          .from("goals")
          .update({
            start_date: op.goalUpdate.start_date,
            end_date: op.goalUpdate.end_date,
            updated_at: new Date().toISOString(),
          })
          .eq("id", op.goalUpdate.id)
        if (goalErr) throw goalErr

        // Refresh goals list to show the new period
        queryClient.invalidateQueries({ queryKey: GOALS_KEY })
      } catch (err) {
        // Non-blocking: log but don't surface to the user — renewal is best-effort
        console.warn("[GoalsList] lazy renewal failed for goal", goal.id, err)
        renewedIds.current.delete(goal.id) // allow retry on next load
      }
    }

    // Fire renewals in parallel, non-blocking
    for (const goal of goals) {
      if (goal.recurring && goal.status === "active") {
        void renewIfNeeded(goal)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, movements, loadingGoals])
  // scopeMap and queryClient are stable references; omitting them avoids
  // triggering the effect on every render. renewedIds is a ref (stable).

  // ── Client-side filtering + sorting ──────────────────────────────────────────

  const filteredGoals = useMemo(() => {
    const q = normalize(filters.search)
    return goals
      .filter((g) => {
        if (q && !normalize(g.name).includes(q)) return false
        if (filters.tipo !== "todas" && g.type !== filters.tipo) return false
        if (filters.estado === "activas" && g.status !== "active") return false
        if (filters.estado === "completadas" && g.status !== "completed") return false
        if (filters.moneda !== "todas" && g.currency !== filters.moneda) return false
        // Category filter: match if goal has any of the filter categories in its scope
        if (filters.categoryIds.length > 0) {
          const goalCats = scopeFor(g.id, scopeMap).categoryIds
          if (!g.is_global && goalCats.length > 0) {
            if (!filters.categoryIds.some((id) => goalCats.includes(id))) return false
          }
        }
        // Account filter: same logic
        if (filters.accountIds.length > 0) {
          const goalAccs = scopeFor(g.id, scopeMap).accountIds
          if (!g.is_global && goalAccs.length > 0) {
            if (!filters.accountIds.some((id) => goalAccs.includes(id))) return false
          }
        }
        return true
      })
      .sort((a, b) => {
        switch (filters.sortKey) {
          case "nombre": {
            const cmp = a.name.localeCompare(b.name, "es")
            return filters.sortDir === "asc" ? cmp : -cmp
          }
          case "progreso": {
            const pa = computeGoalProgress(a, movements, scopeFor(a.id, scopeMap)).percent
            const pb = computeGoalProgress(b, movements, scopeFor(b.id, scopeMap)).percent
            return filters.sortDir === "asc" ? pa - pb : pb - pa
          }
          case "fin": {
            const cmp = a.end_date.localeCompare(b.end_date)
            return filters.sortDir === "asc" ? cmp : -cmp
          }
          case "recientes":
          default: {
            const cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            return filters.sortDir === "asc" ? -cmp : cmp
          }
        }
      })
  }, [goals, filters, movements, scopeMap])

  const isFiltered =
    filters.search.trim() !== "" ||
    filters.tipo !== "todas" ||
    filters.estado !== "todas" ||
    filters.moneda !== "todas" ||
    filters.categoryIds.length > 0 ||
    filters.accountIds.length > 0 ||
    filters.sortKey !== "recientes"

  const displayGoals = isFiltered ? filteredGoals : goals
  const goalIds = displayGoals.map((g) => g.id)
  const atLimit = !userIsPremium && goals.length >= limits.goals

  async function handleBulkDelete() {
    setBulkPending(true)
    const ids = Array.from(ms.selectedIds)
    const result = await bulkDelete("goals", ids)
    setBulkPending(false)
    setConfirmOpen(false)
    ms.exit()
    queryClient.invalidateQueries({ queryKey: GOALS_KEY })
    queryClient.invalidateQueries({ queryKey: GOAL_ACCOUNTS_KEY })
    queryClient.invalidateQueries({ queryKey: GOAL_CATEGORIES_KEY })
    if (result.failed === 0) {
      toast.success(`Se eliminaron ${result.deleted} meta${result.deleted !== 1 ? "s" : ""}`)
    } else {
      toast.warning(`Se eliminaron ${result.deleted}. ${result.failed} no se pud${result.failed !== 1 ? "ieron" : "o"} eliminar.`)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
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
          {!ms.selectionMode && (
            <CreateGoalDialog categories={categories} accounts={accounts} movements={movements} isDemo={isDemo} atLimit={atLimit} />
          )}
        </div>
      </div>

      {/* Filter bar — only when there are goals */}
      {!loadingGoals && goals.length > 0 && (
        <GoalFilterBar
          filters={filters}
          onChange={setFilters}
          categories={categories}
          accounts={accounts}
        />
      )}

      {/* Skeleton */}
      {loadingGoals && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
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

      {/* Error state */}
      {!loadingGoals && goalsError && (
        <QueryError onRetry={() => refetchGoals()} />
      )}

      {/* Empty state */}
      {!loadingGoals && !goalsError && goals.length === 0 && (
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
              Definí un objetivo de ahorro, ingreso o reducción para hacer seguimiento de tu progreso.
            </p>
          </div>
          <CreateGoalDialog categories={categories} accounts={accounts} movements={movements} isDemo={isDemo} />
        </div>
      )}

      {/* Filtered empty state */}
      {!loadingGoals && goals.length > 0 && isFiltered && displayGoals.length === 0 && (
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Sin resultados</p>
            <p className="text-sm text-muted-foreground">
              No se encontraron metas con esos filtros.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Limpiar filtros
          </Button>
        </div>
      )}

      {/* Goal cards */}
      {!loadingGoals && displayGoals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {displayGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              scope={scopeFor(goal.id, scopeMap)}
              movements={movements}
              categories={categories}
              accounts={accounts}
              onEdit={setEditingGoal}
              selectionMode={ms.selectionMode}
              isSelected={ms.isSelected(goal.id)}
              onToggleSelect={ms.toggle}
              isDemo={isDemo}
            />
          ))}
        </div>
      )}

      {/* Edit dialog */}
      {editingGoal && (
        <EditGoalDialog
          goal={editingGoal}
          categories={categories}
          accounts={accounts}
          movements={movements}
          open={!!editingGoal}
          onOpenChange={(v) => { if (!v) setEditingGoal(null) }}
          isDemo={isDemo}
        />
      )}

      {/* Selection bar */}
      {ms.selectionMode && (
        <SelectionBar
          count={ms.count}
          total={goalIds.length}
          onSelectAll={() => ms.toggleAll(goalIds)}
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
        title="Eliminar metas"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={bulkPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkPending || isDemo}
              title={isDemo ? "No disponible en el modo demo" : undefined}
              className="press-effect"
            >
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
