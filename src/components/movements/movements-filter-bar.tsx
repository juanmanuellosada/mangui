"use client"

import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowUpDown,
  Bookmark,
  Check,
  ChevronDown,
  LayoutList,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react"
import { AccountIconChip, type Account } from "@/lib/accounts"
import { CategoryIconChip } from "@/lib/categories"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MangoMultiSelect } from "@/components/ui/mango-multi-select"
import { MangoSelect } from "@/components/ui/mango-select"
import { DateRangeFilter, type DateRangeValue } from "@/components/ui/date-range-filter"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/database.types"
import { filterKey, type MovementsFilter, type MovementsFilterType } from "@/lib/movements"
import { cn } from "@/lib/utils"

type Category = Tables<"categories">
type SavedView = Tables<"saved_views">

export type GroupBy = "none" | "day" | "month" | "category" | "account"

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "Sin agrupar" },
  { value: "day", label: "Por día" },
  { value: "month", label: "Por mes" },
  { value: "category", label: "Por categoría" },
  { value: "account", label: "Por cuenta" },
]

export const TYPE_OPTIONS: { value: MovementsFilterType; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "expense", label: "Gastos" },
  { value: "income", label: "Ingresos" },
  { value: "transfer", label: "Transferencias" },
]

type SortOption = "date-desc" | "date-asc" | "amount-desc" | "amount-asc"

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "date-desc", label: "Fecha (más nueva primero)" },
  { value: "date-asc", label: "Fecha (más vieja primero)" },
  { value: "amount-desc", label: "Mayor monto primero" },
  { value: "amount-asc", label: "Menor monto primero" },
]

export const SAVED_VIEWS_KEY = ["saved_views", "movements"] as const

export async function fetchMovementsSavedViews(): Promise<SavedView[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("saved_views")
    .select("*")
    .eq("scope", "movements")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

export async function createMovementsSavedView(name: string, filters: MovementsFilter): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase
    .from("saved_views")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ name, filters: filters as any, user_id: user.id, scope: "movements" })
  if (error) throw error
}

export async function deleteMovementsSavedView(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("saved_views").delete().eq("id", id)
  if (error) throw error
}

export interface MovementsFilterBarProps {
  filter: MovementsFilter
  onChange: (f: MovementsFilter) => void
  accounts: Account[]
  categories: Category[]
  groupBy: GroupBy
  onGroupByChange: (g: GroupBy) => void
  defaultFilter: () => MovementsFilter
  isDemo?: boolean
}

export function MovementsFilterBar({
  filter,
  onChange,
  accounts,
  categories,
  groupBy,
  onGroupByChange,
  defaultFilter,
  isDemo,
}: MovementsFilterBarProps) {
  const queryClient = useQueryClient()
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { data: savedViews = [] } = useQuery({
    queryKey: SAVED_VIEWS_KEY,
    queryFn: fetchMovementsSavedViews,
  })

  const createMutation = useMutation({
    mutationFn: ({ name, f }: { name: string; f: MovementsFilter }) =>
      createMovementsSavedView(name, f),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SAVED_VIEWS_KEY })
      toast.success("Vista guardada")
      setSaveDialogOpen(false)
      setSaveName("")
    },
    onError: () => toast.error("No se pudo guardar la vista"),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMovementsSavedView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SAVED_VIEWS_KEY })
      toast.success("Vista eliminada")
    },
    onError: () => toast.error("No se pudo eliminar"),
  })

  function loadView(view: SavedView) {
    const f = view.filters as unknown as Partial<MovementsFilter>
    onChange({ ...defaultFilter(), ...f })
  }

  const currentKey = filterKey(filter)
  const defaultKey = filterKey(defaultFilter())
  const isDefault = currentKey === defaultKey
  const activeView = savedViews.find(
    (v) =>
      filterKey({ ...defaultFilter(), ...(v.filters as unknown as Partial<MovementsFilter>) }) === currentKey
  )

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

  const activeChips: string[] = []
  if (filter.type !== "all") {
    activeChips.push(TYPE_OPTIONS.find((t) => t.value === filter.type)?.label ?? "")
  }
  if (filter.date.preset !== "all_time") activeChips.push(filter.date.label)
  if (filter.accountIds.length > 0) {
    activeChips.push(`${filter.accountIds.length} cuenta${filter.accountIds.length !== 1 ? "s" : ""}`)
  }
  if (filter.categoryIds.length > 0) {
    activeChips.push(`${filter.categoryIds.length} categoría${filter.categoryIds.length !== 1 ? "s" : ""}`)
  }

  const hasActiveFilters =
    filter.type !== "all" ||
    filter.date.preset !== "all_time" ||
    filter.date.from !== null ||
    filter.date.to !== null ||
    filter.accountIds.length > 0 ||
    filter.categoryIds.length > 0 ||
    filter.search !== ""

  function clearAll() {
    onChange(defaultFilter())
  }

  const secondaryFilters = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end gap-3">
        <div className="space-y-1.5 w-full lg:flex-1 lg:min-w-0">
          <Label className="text-xs">Fecha</Label>
          <DateRangeFilter
            value={filter.date}
            onChange={(date: DateRangeValue) => onChange({ ...filter, date })}
          />
        </div>
        <div className="space-y-1.5 w-full lg:w-44 lg:shrink-0">
          <Label className="text-xs flex items-center gap-1">
            <LayoutList className="h-3 w-3" aria-hidden />
            Agrupar
          </Label>
          <MangoSelect
            value={groupBy}
            onChange={(v) => onGroupByChange(v as GroupBy)}
            options={GROUP_BY_OPTIONS}
            aria-label="Agrupar movimientos"
          />
        </div>
        <div className="space-y-1.5 w-full lg:w-52 lg:shrink-0">
          <Label className="text-xs flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3" aria-hidden />
            Ordenar
          </Label>
          <MangoSelect
            value={`${filter.sortField}-${filter.sortDir}`}
            onChange={(v) => {
              const [sortField, sortDir] = v.split("-") as [MovementsFilter["sortField"], MovementsFilter["sortDir"]]
              onChange({ ...filter, sortField, sortDir })
            }}
            options={SORT_OPTIONS}
            aria-label="Ordenar movimientos"
          />
        </div>
        <div className="space-y-1.5 w-full lg:w-44 lg:shrink-0">
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
        <div className="space-y-1.5 w-full lg:w-44 lg:shrink-0">
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
      </div>
    </div>
  )

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar por nota, tag, categoría o cuenta…"
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

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background">
            <Bookmark className="h-3.5 w-3.5" />
            {activeView ? (
              <span className="max-w-[8rem] truncate text-foreground">{activeView.name}</span>
            ) : (
              <>
                <span className="hidden sm:inline">Vistas</span>
                {savedViews.length > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">
                    {savedViews.length}
                  </span>
                )}
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-3 py-1.5 text-[11px] text-muted-foreground">
              {activeView ? `Vista actual: ${activeView.name}` : isDefault ? "Vista por defecto" : "Filtros sin guardar"}
            </div>
            {savedViews.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Sin vistas guardadas</div>
            )}
            {savedViews.map((view) => (
              <div key={view.id} className="flex items-center gap-1 px-1">
                <DropdownMenuItem
                  className={cn(
                    "flex-1 gap-1.5",
                    view.id === activeView?.id && "bg-primary/10 text-primary font-medium"
                  )}
                  onClick={() => loadView(view)}
                >
                  {view.id === activeView?.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{view.name}</span>
                </DropdownMenuItem>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isDemo) deleteMutation.mutate(view.id)
                  }}
                  disabled={isDemo}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
                  aria-label={`Eliminar vista ${view.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => !isDemo && setSaveDialogOpen(true)} disabled={isDemo} className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Guardar filtros actuales
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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

      <div className="hidden lg:block">{secondaryFilters}</div>

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

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent compact className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar vista</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="view-name-movements">Nombre de la vista</Label>
              <Input
                id="view-name-movements"
                placeholder="Gastos de enero…"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && saveName.trim()) {
                    createMutation.mutate({ name: saveName.trim(), f: filter })
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
              onClick={() => createMutation.mutate({ name: saveName.trim(), f: filter })}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
