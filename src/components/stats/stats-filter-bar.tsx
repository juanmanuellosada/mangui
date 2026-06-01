"use client"

import { useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Bookmark,
  Trash2,
  Plus,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MangoSelect } from "@/components/ui/mango-select"
import { MangoMultiSelect } from "@/components/ui/mango-multi-select"
import { CurrencyLogo } from "@/components/ui/currency-chip"
import { DateRangeFilter, type DateRangeValue } from "@/components/ui/date-range-filter"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { AccountIconChip } from "@/lib/accounts"
import { CategoryIconChip } from "@/lib/categories"
import { getPreset } from "@/lib/date-ranges"
import type { Tables } from "@/lib/database.types"
import type { StatsFilter } from "@/lib/stats"

type Category = Tables<"categories">
type Account = Tables<"accounts">
type SavedView = Tables<"saved_views">

export type { DateRangeValue }

export interface FilterState {
  date: DateRangeValue
  categoryIds: string[]
  accountIds: string[]
  currency: "ARS" | "USD" | "all"
  type: "all" | "income" | "expense"
}

export function defaultFilter(): FilterState {
  const r = getPreset("this_month")
  return {
    date: { operator: "between", preset: "this_month", from: r.from, to: r.to, label: r.label },
    categoryIds: [],
    accountIds: [],
    currency: "all",
    type: "all",
  }
}

export function filterToStatsFilter(f: FilterState): StatsFilter {
  return {
    dateFrom: f.date.from ?? undefined,
    dateTo: f.date.to ?? undefined,
    categoryIds: f.categoryIds.length > 0 ? f.categoryIds : undefined,
    accountIds: f.accountIds.length > 0 ? f.accountIds : undefined,
    currency: f.currency !== "all" ? f.currency : undefined,
    type: f.type,
  }
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function fetchSavedViews(): Promise<SavedView[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("saved_views")
    .select("*")
    .eq("scope", "stats")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

async function createSavedView(name: string, filters: FilterState): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase
    .from("saved_views")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ name, filters: filters as any, user_id: user.id, scope: "stats" })
  if (error) throw error
}

async function deleteSavedView(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("saved_views").delete().eq("id", id)
  if (error) throw error
}

// ── Component ─────────────────────────────────────────────────────────────────

interface StatsFilterBarProps {
  filter: FilterState
  categories: Category[]
  accounts: Account[]
  onChange: (f: FilterState) => void
}

export function StatsFilterBar({ filter, categories, accounts, onChange }: StatsFilterBarProps) {
  const queryClient = useQueryClient()
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState("")

  const { data: savedViews = [] } = useQuery({
    queryKey: ["saved_views", "stats"],
    queryFn: fetchSavedViews,
  })

  const createMutation = useMutation({
    mutationFn: ({ name, filters }: { name: string; filters: FilterState }) =>
      createSavedView(name, filters),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved_views", "stats"] })
      toast.success("Vista guardada")
      setSaveDialogOpen(false)
      setSaveName("")
    },
    onError: () => toast.error("No se pudo guardar la vista"),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSavedView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved_views", "stats"] })
      toast.success("Vista eliminada")
    },
    onError: () => toast.error("No se pudo eliminar"),
  })

  function loadView(view: SavedView) {
    const f = view.filters as unknown as FilterState
    onChange(f)
  }

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

  const activeFiltersCount =
    (filter.categoryIds.length > 0 ? 1 : 0) +
    (filter.accountIds.length > 0 ? 1 : 0) +
    (filter.currency !== "all" ? 1 : 0) +
    (filter.type !== "all" ? 1 : 0)

  const hasActiveFilters = activeFiltersCount > 0 || filter.date.preset !== "this_month"

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      {/* Top row: date + saved views */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <DateRangeFilter
            value={filter.date}
            onChange={(date) => onChange({ ...filter, date })}
          />
        </div>

        {/* Saved views */}
        <div className="ml-auto flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background">
              <Bookmark className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Vistas</span>
              {savedViews.length > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">
                  {savedViews.length}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {savedViews.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Sin vistas guardadas</div>
              )}
              {savedViews.map((view) => (
                <div key={view.id} className="flex items-center gap-1 px-1">
                  <DropdownMenuItem
                    className="flex-1"
                    onSelect={() => loadView(view)}
                  >
                    <span className="truncate">{view.name}</span>
                  </DropdownMenuItem>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteMutation.mutate(view.id)
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Eliminar vista ${view.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSaveDialogOpen(true)} className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                Guardar filtros actuales
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Secondary row: type pills + currency + accounts + categories */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Type pills */}
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { value: "all", label: "Todos" },
              { value: "income", label: "Ingresos" },
              { value: "expense", label: "Gastos" },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...filter, type: value })}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer",
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
            placeholder="Todas las categorías"
            showSearch
            aria-label="Filtrar por categoría"
          />
        </div>

        {/* Currency */}
        <div className="space-y-1.5">
          <Label className="text-xs">Moneda</Label>
          <MangoSelect
            value={filter.currency}
            onChange={(v) => onChange({ ...filter, currency: v as FilterState["currency"] })}
            options={[
              { value: "all", label: "Todas" },
              { value: "ARS", label: "ARS", leading: <CurrencyLogo currency="ARS" /> },
              { value: "USD", label: "USD", leading: <CurrencyLogo currency="USD" /> },
            ]}
            aria-label="Moneda"
            className="w-full"
          />
        </div>

        {/* Clear all */}
        {hasActiveFilters && (
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => onChange(defaultFilter())}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer h-9"
              aria-label="Limpiar filtros"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar
            </button>
          </div>
        )}
      </div>

      {/* Save view dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar vista</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="stats-view-name">Nombre de la vista</Label>
              <Input
                id="stats-view-name"
                placeholder="Gastos de enero..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && saveName.trim()) {
                    createMutation.mutate({ name: saveName.trim(), filters: filter })
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!saveName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: saveName.trim(), filters: filter })}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
