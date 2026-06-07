"use client"

import { useState, useMemo, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format, parseISO, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import {
  PlusCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  CreditCard,
  Repeat,
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useMultiSelect } from "@/hooks/use-multi-select"
import { SelectionBar, SelectButton, RowCheckbox, selectedItemCn } from "@/components/ui/selection-bar"
import { MangoSheet, MangoSheet as ConfirmSheet } from "@/components/ui/mango-sheet"
import { MangoMultiSelect } from "@/components/ui/mango-multi-select"
import { DateRangeFilter } from "@/components/ui/date-range-filter"
import type { DateRangeValue } from "@/components/ui/date-range-filter"
import { bulkDelete } from "@/lib/bulk-delete"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useIsDemo } from "@/lib/use-is-demo"
import type { Account } from "@/lib/accounts"
import { AccountIconChip } from "@/lib/accounts"
import { CategoryIconChip } from "@/lib/categories"
import type { Tables } from "@/lib/database.types"
import {
  RECURRING_KEY,
  OCCURRENCES_KEY,
  frequencyLabel,
  computeNextRun,
  defaultRecurringFilter,
  type RecurringTransaction,
  type RecurringFilter,
} from "@/lib/recurring"
import { ACCOUNTS_KEY, CATEGORIES_KEY } from "@/lib/movements"
import { PendingInbox, type OccurrenceWithRec } from "./pending-inbox"
import { RecurringForm, recurringToFormValues, type RecurringFormValues } from "./recurring-form"

type Category = Tables<"categories">

export type { OccurrenceWithRec }

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchRecurring(): Promise<RecurringTransaction[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

async function fetchPendingOccurrences(): Promise<OccurrenceWithRec[]> {
  const supabase = createClient()
  const today = new Date().toISOString().split("T")[0]
  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select("*, recurring:recurring_transactions(*)")
    .eq("status", "pending")
    .lte("scheduled_date", today)
    .order("scheduled_date", { ascending: true })
  if (error) throw error
  return (data ?? []) as OccurrenceWithRec[]
}

async function fetchAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at")
  if (error) throw error
  return data
}

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name")
  if (error) throw error
  return data
}

// ── Recurring row ─────────────────────────────────────────────────────────────

function RecurringRow({
  rec,
  accounts,
  onEdit,
  selectionMode,
  isSelected,
  onToggle,
  isDemo,
}: {
  rec: RecurringTransaction
  accounts: Account[]
  onEdit: (r: RecurringTransaction) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggle?: (id: string) => void
  isDemo?: boolean
}) {
  const queryClient = useQueryClient()

  const account = accounts.find((a) => a.id === rec.account_id)
  const nextRun = rec.next_run
    ? format(parseISO(rec.next_run), "d MMM yyyy", { locale: es })
    : "—"

  const statusMutation = useMutation({
    mutationFn: async (newStatus: "active" | "paused") => {
      const supabase = createClient()
      const { error } = await supabase
        .from("recurring_transactions")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", rec.id)
      if (error) throw error
    },
    onMutate: async (newStatus) => {
      await queryClient.cancelQueries({ queryKey: RECURRING_KEY })
      const prev = queryClient.getQueryData<RecurringTransaction[]>(RECURRING_KEY)
      queryClient.setQueryData<RecurringTransaction[]>(RECURRING_KEY, (old = []) =>
        old.map((r) => (r.id === rec.id ? { ...r, status: newStatus } : r))
      )
      return { prev }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(RECURRING_KEY, context.prev)
      toast.error("Error al actualizar", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEY })
    },
  })

  return (
    <div
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? isSelected : undefined}
      onClick={selectionMode ? () => onToggle?.(rec.id) : () => onEdit(rec)}
      className={cn(
        "flex items-center gap-3 py-3 px-4 w-full text-left hover:bg-muted/40 transition-colors duration-150 cursor-pointer group",
        isSelected && selectedItemCn(true)
      )}
    >
      {/* Checkbox (selection mode) or Icon */}
      {selectionMode ? (
        <RowCheckbox
          checked={!!isSelected}
          onChange={() => onToggle?.(rec.id)}
        />
      ) : (
        <div
          className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
            rec.kind === "income" ? "bg-success/10" :
            rec.kind === "expense" ? "bg-destructive/10" : "bg-muted"
          )}
        >
          {rec.kind === "income" ? (
            <ArrowUpCircle className="h-5 w-5 text-success" />
          ) : rec.kind === "expense" ? (
            <ArrowDownCircle className="h-5 w-5 text-destructive" />
          ) : (
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <p className="text-sm font-semibold truncate">
            {rec.note || (rec.kind === "income" ? "Ingreso" : rec.kind === "expense" ? "Gasto" : "Transferencia")}
          </p>
          {rec.is_card_recurring && (
            <CreditCard className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
          {rec.status === "paused" && (
            <span className="inline-flex items-center px-1.5 py-0 rounded-md text-[10px] font-bold bg-muted text-muted-foreground">
              Pausada
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {frequencyLabel(rec)} · Próx: {nextRun}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0 mr-2">
        <p
          className={cn(
            "text-sm font-bold tabular-nums",
            rec.kind === "income" ? "text-success" :
            rec.kind === "expense" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {rec.kind === "income" ? "+ " : rec.kind === "expense" ? "− " : ""}
          {formatCurrency(rec.amount, rec.currency)}
        </p>
      </div>

      {/* Status switch — hidden in selection mode */}
      {!selectionMode && (
        <div
          className="flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            if (isDemo) return
            const newStatus = rec.status === "active" ? "paused" : "active"
            statusMutation.mutate(newStatus)
          }}
        >
          <Switch
            checked={rec.status === "active"}
            disabled={statusMutation.isPending || isDemo}
            aria-label={rec.status === "active" ? "Pausar recurrente" : "Activar recurrente"}
          />
        </div>
      )}
    </div>
  )
}

// ── RecurringFilterBar ────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: RecurringFilter["type"]; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "expense", label: "Gastos" },
  { value: "income", label: "Ingresos" },
  { value: "transfer", label: "Transferencias" },
]

const STATUS_OPTIONS: { value: RecurringFilter["status"]; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Activas" },
  { value: "paused", label: "Pausadas" },
]

interface RecurringFilterBarProps {
  filter: RecurringFilter
  onChange: (f: RecurringFilter) => void
  accounts: Account[]
  categories: Category[]
}

function RecurringFilterBar({ filter, onChange, accounts, categories }: RecurringFilterBarProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    leading: <AccountIconChip icon={a.icon} />,
  }))

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
    leading: <CategoryIconChip icon={c.icon} />,
  }))

  const hasActiveFilters =
    filter.type !== "all" ||
    filter.date.preset !== "all_time" ||
    filter.date.from !== null ||
    filter.date.to !== null ||
    filter.accountIds.length > 0 ||
    filter.categoryIds.length > 0 ||
    filter.status !== "all" ||
    filter.cardOnly ||
    filter.search !== ""

  // Active chips for mobile compact summary row
  const activeChips: string[] = []
  if (filter.type !== "all") {
    activeChips.push(TYPE_OPTIONS.find((t) => t.value === filter.type)?.label ?? "")
  }
  if (filter.date.preset !== "all_time") {
    activeChips.push(filter.date.label)
  }
  if (filter.accountIds.length > 0) {
    activeChips.push(`${filter.accountIds.length} cuenta${filter.accountIds.length !== 1 ? "s" : ""}`)
  }
  if (filter.categoryIds.length > 0) {
    activeChips.push(`${filter.categoryIds.length} categoría${filter.categoryIds.length !== 1 ? "s" : ""}`)
  }
  if (filter.status !== "all") {
    activeChips.push(STATUS_OPTIONS.find((s) => s.value === filter.status)?.label ?? "")
  }
  if (filter.cardOnly) {
    activeChips.push("Tarjeta")
  }

  function clearAll() {
    onChange(defaultRecurringFilter())
  }

  // Secondary controls (shared between desktop always-visible and mobile expanded)
  const secondaryFilters = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Type pills */}
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...filter, type: value })}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 press-effect cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter.type === value
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Date range (applied to next_run) */}
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs">Próxima ejecución</Label>
        <DateRangeFilter
          value={filter.date}
          onChange={(date: DateRangeValue) => onChange({ ...filter, date })}
        />
      </div>

      {/* Accounts */}
      <div className="space-y-1.5">
        <Label className="text-xs">Cuentas</Label>
        <MangoMultiSelect
          values={filter.accountIds}
          onChange={(accountIds) => onChange({ ...filter, accountIds })}
          options={accountOptions}
          placeholder="Todas las cuentas"
          showSearch
          aria-label="Filtrar por cuenta"
        />
      </div>

      {/* Categories */}
      <div className="space-y-1.5">
        <Label className="text-xs">Categorías</Label>
        <MangoMultiSelect
          values={filter.categoryIds}
          onChange={(categoryIds) => onChange({ ...filter, categoryIds })}
          options={categoryOptions}
          placeholder={filter.type === "transfer" ? "No aplica" : "Todas las categorías"}
          showSearch
          disabled={filter.type === "transfer"}
          aria-label="Filtrar por categoría"
        />
      </div>

      {/* Status + Card row */}
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Status pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium mr-0.5">Estado:</span>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...filter, status: value })}
                className={cn(
                  "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 press-effect cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  filter.status === value
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Card toggle */}
          <button
            type="button"
            onClick={() => onChange({ ...filter, cardOnly: !filter.cardOnly })}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 press-effect cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filter.cardOnly
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <CreditCard className="h-3 w-3" />
            Solo tarjeta
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      {/* Top row: search + Filtros button + Limpiar */}
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar por nota, categoría o cuenta…"
            value={filter.search}
            onChange={(e) => onChange({ ...filter, search: e.target.value })}
            className={cn(
              "w-full h-9 pl-9 pr-3 rounded-lg text-sm",
              "bg-background border border-input",
              "placeholder:text-muted-foreground/60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
              "transition-colors duration-150"
            )}
          />
          {filter.search && (
            <button
              type="button"
              onClick={() => onChange({ ...filter, search: "" })}
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

        {/* Limpiar (desktop) */}
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

      {/* Mobile active chips (collapsed state) */}
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
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
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

// ── Edit/Create dialog ────────────────────────────────────────────────────────

function RecurringDialog({
  rec,
  accounts,
  categories,
  open,
  onOpenChange,
}: {
  rec: RecurringTransaction | null
  accounts: Account[]
  categories: Category[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async (values: RecurringFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      // Compute next_run
      const fakeRec = {
        ...values,
        account_id: values.account_id,
        id: "",
        created_at: "",
        updated_at: "",
        user_id: user.id,
        status: "active" as const,
        next_run: null,
        end_date: values.end_date,
      } as RecurringTransaction
      const from = startOfDay(parseISO(values.start_date))
      const nextRun = computeNextRun(fakeRec, from)
      const nextRunStr = nextRun.toISOString().split("T")[0]

      const { error } = await supabase.from("recurring_transactions").insert({
        user_id: user.id,
        kind: values.kind,
        amount: values.amount,
        currency: values.currency,
        account_id: values.account_id,
        to_account_id: values.kind === "transfer" ? values.to_account_id : null,
        to_amount: values.kind === "transfer" ? values.to_amount : null,
        category_id: values.category_id,
        note: values.note || null,
        frequency: values.frequency,
        day_of_week: values.day_of_week,
        day_of_month: values.day_of_month,
        month_of_year: values.month_of_year,
        interval_days: values.frequency === "custom" ? (values.interval_days ?? 1) : null,
        weekend_handling: values.weekend_handling,
        start_date: values.start_date,
        end_date: values.end_date || null,
        is_card_recurring: values.is_card_recurring,
        next_run: nextRunStr,
        status: "active",
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEY })
      toast.success("Recurrente creada")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear", { description: err.message })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: RecurringFormValues) => {
      if (!rec) return
      const supabase = createClient()

      const fakeRec = { ...rec, ...values } as RecurringTransaction
      const from = startOfDay(parseISO(values.start_date))
      const nextRun = computeNextRun(fakeRec, from)
      const nextRunStr = nextRun.toISOString().split("T")[0]

      const { error } = await supabase
        .from("recurring_transactions")
        .update({
          kind: values.kind,
          amount: values.amount,
          currency: values.currency,
          account_id: values.account_id,
          to_account_id: values.kind === "transfer" ? values.to_account_id : null,
          to_amount: values.kind === "transfer" ? values.to_amount : null,
          category_id: values.category_id,
          note: values.note || null,
          frequency: values.frequency,
          day_of_week: values.day_of_week,
          day_of_month: values.day_of_month,
          month_of_year: values.month_of_year,
          interval_days: values.frequency === "custom" ? (values.interval_days ?? 1) : null,
          weekend_handling: values.weekend_handling,
          start_date: values.start_date,
          end_date: values.end_date || null,
          is_card_recurring: values.is_card_recurring,
          next_run: nextRunStr,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rec.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEY })
      toast.success("Recurrente actualizada")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al actualizar", { description: err.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!rec) return
      const supabase = createClient()
      const { error } = await supabase
        .from("recurring_transactions")
        .delete()
        .eq("id", rec.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEY })
      queryClient.invalidateQueries({ queryKey: OCCURRENCES_KEY })
      toast.success("Recurrente eliminada")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al eliminar", { description: err.message })
    },
  })

  const isEditing = !!rec
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <MangoSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar recurrente" : "Nueva recurrente"}
      description={
        isEditing
          ? "Modificá los datos de la transacción recurrente."
          : "Configurá una transacción que se repite automáticamente."
      }
    >
      <RecurringForm
        accounts={accounts}
        categories={categories}
        defaultValues={rec ? recurringToFormValues(rec) : undefined}
        onSubmit={async (v) => {
          if (isEditing) await updateMutation.mutateAsync(v)
          else await createMutation.mutateAsync(v)
        }}
        onDelete={isEditing ? async () => deleteMutation.mutate() : undefined}
        isLoading={isPending}
        isDeleting={deleteMutation.isPending}
        submitLabel={isEditing ? "Guardar cambios" : "Guardar recurrente"}
      />
    </MangoSheet>
  )
}

// ── Normalize string for accent-insensitive search ────────────────────────────

function normalizeStr(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RecurringList() {
  const isDemo = useIsDemo()
  const [filter, setFilter] = useState<RecurringFilter>(defaultRecurringFilter)
  const [editingRec, setEditingRec] = useState<RecurringTransaction | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const ms = useMultiSelect()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)
  const queryClient = useQueryClient()

  const { data: recurring = [], isLoading: loadingRec } = useQuery({
    queryKey: RECURRING_KEY,
    queryFn: fetchRecurring,
  })

  const { data: occurrences = [] } = useQuery({
    queryKey: [...OCCURRENCES_KEY, "pending"],
    queryFn: fetchPendingOccurrences,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  })

  const { data: categories = [] } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: fetchCategories,
  })

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const filtered = useMemo(() => {
    const { search, type, date, accountIds, categoryIds, status, cardOnly } = filter
    const searchNorm = normalizeStr(search.trim())

    return recurring.filter((r) => {
      // type
      if (type !== "all" && r.kind !== type) return false

      // status (inactive items only appear when status='all')
      if (status === "active" && r.status !== "active") return false
      if (status === "paused" && r.status !== "paused") return false

      // cardOnly
      if (cardOnly && !r.is_card_recurring) return false

      // date: applied to next_run
      const hasDateBound = date.from !== null || date.to !== null
      if (hasDateBound) {
        if (!r.next_run) return false
        if (date.from && r.next_run < date.from) return false
        if (date.to && r.next_run > date.to) return false
      }

      // accountIds
      if (accountIds.length > 0) {
        const inFrom = r.account_id != null && accountIds.includes(r.account_id)
        const inTo = r.kind === "transfer" && r.to_account_id != null && accountIds.includes(r.to_account_id)
        if (!inFrom && !inTo) return false
      }

      // categoryIds (transfers excluded)
      if (categoryIds.length > 0) {
        if (r.kind === "transfer") return false
        if (!r.category_id || !categoryIds.includes(r.category_id)) return false
      }

      // search
      if (searchNorm) {
        const noteMatch = r.note ? normalizeStr(r.note).includes(searchNorm) : false
        const account = r.account_id != null ? accountMap.get(r.account_id) : undefined
        const accountMatch = account ? normalizeStr(account.name).includes(searchNorm) : false
        const toAccount = r.to_account_id ? accountMap.get(r.to_account_id) : undefined
        const toAccountMatch = toAccount ? normalizeStr(toAccount.name).includes(searchNorm) : false
        const cat = r.category_id ? categoryMap.get(r.category_id) : undefined
        const catMatch = cat ? normalizeStr(cat.name).includes(searchNorm) : false
        if (!noteMatch && !accountMatch && !toAccountMatch && !catMatch) return false
      }

      return true
    })
  }, [recurring, filter, accountMap, categoryMap])

  const filteredIds = filtered.map((r) => r.id)

  async function handleBulkDelete() {
    setBulkPending(true)
    const ids = Array.from(ms.selectedIds)
    const result = await bulkDelete("recurring_transactions", ids)
    setBulkPending(false)
    setConfirmOpen(false)
    ms.exit()
    queryClient.invalidateQueries({ queryKey: RECURRING_KEY })
    queryClient.invalidateQueries({ queryKey: OCCURRENCES_KEY })
    if (result.failed === 0) {
      toast.success(`Se eliminaron ${result.deleted} recurrente${result.deleted !== 1 ? "s" : ""}`)
    } else {
      toast.warning(`Se eliminaron ${result.deleted}. ${result.failed} no se pud${result.failed !== 1 ? "ieron" : "o"} eliminar.`)
    }
  }

  const openCreate = () => {
    if (isDemo) return
    setEditingRec(null)
    setDialogOpen(true)
  }

  const openEdit = (r: RecurringTransaction) => {
    if (ms.selectionMode || isDemo) return
    setEditingRec(r)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Recurrentes
        </h1>
        <div className="flex items-center gap-2">
          {!loadingRec && recurring.length > 0 && !ms.selectionMode && (
            <SelectButton onClick={ms.enter} />
          )}
          {!ms.selectionMode && (
            <Button
              onClick={openCreate}
              size="sm"
              className="gap-1.5 press-effect font-semibold shadow-sm shadow-primary/20"
              disabled={isDemo}
              title={isDemo ? "No disponible en el modo demo" : undefined}
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Nueva recurrente</span>
            </Button>
          )}
        </div>
      </div>

      {/* Pending inbox */}
      <PendingInbox
        occurrences={occurrences}
        accounts={accounts}
      />

      {/* Filter bar */}
      <RecurringFilterBar
        filter={filter}
        onChange={setFilter}
        accounts={accounts}
        categories={categories}
      />

      {/* Loading */}
      {loadingRec && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-2.5 w-28" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadingRec && filtered.length === 0 && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-10 text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-primary/15 flex items-center justify-center mx-auto">
            <Repeat className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              {recurring.length === 0 ? "Sin recurrentes" : "Sin resultados"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              {recurring.length === 0
                ? "Creá una transacción recurrente para automatizar pagos e ingresos."
                : "Probá con otro filtro."}
            </p>
          </div>
          {recurring.length === 0 && (
            <Button onClick={openCreate} className="press-effect gap-2" disabled={isDemo} title={isDemo ? "No disponible en el modo demo" : undefined}>
              <PlusCircle className="h-4 w-4" />
              Nueva recurrente
            </Button>
          )}
        </div>
      )}

      {/* List */}
      {!loadingRec && filtered.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
          {filtered.map((r) => (
            <RecurringRow
              key={r.id}
              rec={r}
              accounts={accounts}
              onEdit={openEdit}
              selectionMode={ms.selectionMode}
              isSelected={ms.isSelected(r.id)}
              onToggle={ms.toggle}
              isDemo={isDemo}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      <RecurringDialog
        rec={editingRec}
        accounts={accounts}
        categories={categories}
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v)
          if (!v) setEditingRec(null)
        }}
      />

      {/* Selection bar */}
      {ms.selectionMode && (
        <SelectionBar
          count={ms.count}
          total={filteredIds.length}
          onSelectAll={() => ms.toggleAll(filteredIds)}
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
        title="Eliminar recurrentes"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={bulkPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkPending || isDemo} title={isDemo ? "No disponible en el modo demo" : undefined} className="press-effect">
              {bulkPending ? "Eliminando…" : `Eliminar (${ms.count})`}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          ¿Eliminar {ms.count} recurrente{ms.count !== 1 ? "s" : ""}? Se eliminarán también sus ocurrencias. Esta acción no se puede deshacer.
        </p>
      </ConfirmSheet>
    </div>
  )
}
