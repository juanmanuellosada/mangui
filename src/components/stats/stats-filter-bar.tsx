"use client"

import { useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"
import {
  CalendarDays,
  ChevronDown,
  Bookmark,
  Trash2,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
} from "date-fns"
import type { Tables } from "@/lib/database.types"
import type { StatsFilter } from "@/lib/stats"

type Category = Tables<"categories">
type Account = Tables<"accounts">
type SavedView = Tables<"saved_views">

export interface FilterState {
  preset: "this_month" | "last_month" | "last_3m" | "this_year" | "custom"
  dateFrom: string
  dateTo: string
  categoryIds: string[]
  accountIds: string[]
  currency: "ARS" | "USD" | "all"
  type: "all" | "income" | "expense"
}

function getPresetDates(preset: FilterState["preset"]): { from: string; to: string } {
  const now = new Date()
  switch (preset) {
    case "this_month":
      return {
        from: format(startOfMonth(now), "yyyy-MM-dd"),
        to: format(endOfMonth(now), "yyyy-MM-dd"),
      }
    case "last_month": {
      const lm = subMonths(now, 1)
      return {
        from: format(startOfMonth(lm), "yyyy-MM-dd"),
        to: format(endOfMonth(lm), "yyyy-MM-dd"),
      }
    }
    case "last_3m": {
      const from3 = subMonths(now, 3)
      return {
        from: format(startOfMonth(from3), "yyyy-MM-dd"),
        to: format(endOfMonth(now), "yyyy-MM-dd"),
      }
    }
    case "this_year":
      return {
        from: format(startOfYear(now), "yyyy-MM-dd"),
        to: format(endOfYear(now), "yyyy-MM-dd"),
      }
    case "custom":
    default:
      return {
        from: format(startOfMonth(now), "yyyy-MM-dd"),
        to: format(endOfMonth(now), "yyyy-MM-dd"),
      }
  }
}

export function defaultFilter(): FilterState {
  const dates = getPresetDates("this_month")
  return {
    preset: "this_month",
    dateFrom: dates.from,
    dateTo: dates.to,
    categoryIds: [],
    accountIds: [],
    currency: "all",
    type: "all",
  }
}

export function filterToStatsFilter(f: FilterState): StatsFilter {
  return {
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
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
    .insert({ name, filters: filters as any, user_id: user.id })
  if (error) throw error
}

async function deleteSavedView(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("saved_views").delete().eq("id", id)
  if (error) throw error
}

// ── Component ─────────────────────────────────────────────────────────────────

const PRESET_LABELS: Record<FilterState["preset"], string> = {
  this_month: "Este mes",
  last_month: "Mes pasado",
  last_3m: "Últimos 3m",
  this_year: "Año",
  custom: "Personalizado",
}

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
    queryKey: ["saved_views"],
    queryFn: fetchSavedViews,
  })

  const createMutation = useMutation({
    mutationFn: ({ name, filters }: { name: string; filters: FilterState }) =>
      createSavedView(name, filters),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved_views"] })
      toast.success("Vista guardada")
      setSaveDialogOpen(false)
      setSaveName("")
    },
    onError: () => toast.error("No se pudo guardar la vista"),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSavedView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved_views"] })
      toast.success("Vista eliminada")
    },
    onError: () => toast.error("No se pudo eliminar"),
  })

  function applyPreset(preset: FilterState["preset"]) {
    const dates = getPresetDates(preset)
    onChange({ ...filter, preset, dateFrom: dates.from, dateTo: dates.to })
  }

  function loadView(view: SavedView) {
    const f = view.filters as unknown as FilterState
    onChange(f)
  }

  function toggleCategory(id: string) {
    const ids = filter.categoryIds.includes(id)
      ? filter.categoryIds.filter((c) => c !== id)
      : [...filter.categoryIds, id]
    onChange({ ...filter, categoryIds: ids })
  }

  function toggleAccount(id: string) {
    const ids = filter.accountIds.includes(id)
      ? filter.accountIds.filter((a) => a !== id)
      : [...filter.accountIds, id]
    onChange({ ...filter, accountIds: ids })
  }

  const activeFiltersCount =
    (filter.categoryIds.length > 0 ? 1 : 0) +
    (filter.accountIds.length > 0 ? 1 : 0) +
    (filter.currency !== "all" ? 1 : 0) +
    (filter.type !== "all" ? 1 : 0)

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Date preset */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input bg-background text-xs font-medium shadow-sm hover:bg-accent/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <CalendarDays className="h-3.5 w-3.5" />
          {PRESET_LABELS[filter.preset]}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {(Object.keys(PRESET_LABELS) as FilterState["preset"][]).map((p) => (
            <DropdownMenuItem
              key={p}
              onSelect={() => applyPreset(p)}
              className={cn(filter.preset === p && "font-semibold text-primary")}
            >
              {PRESET_LABELS[p]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Type filter */}
      <DropdownMenu>
        <DropdownMenuTrigger className={cn("inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input bg-background text-xs font-medium shadow-sm hover:bg-accent/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", filter.type !== "all" && "border-primary text-primary")}>
          {filter.type === "all" ? "Todos" : filter.type === "income" ? "Ingresos" : "Gastos"}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(["all", "income", "expense"] as const).map((t) => (
            <DropdownMenuItem
              key={t}
              onSelect={() => onChange({ ...filter, type: t })}
              className={cn(filter.type === t && "font-semibold text-primary")}
            >
              {t === "all" ? "Todos" : t === "income" ? "Ingresos" : "Gastos"}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Currency */}
      <DropdownMenu>
        <DropdownMenuTrigger className={cn("inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input bg-background text-xs font-medium shadow-sm hover:bg-accent/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", filter.currency !== "all" && "border-primary text-primary")}>
          {filter.currency === "all" ? "Moneda" : filter.currency}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(["all", "ARS", "USD"] as const).map((c) => (
            <DropdownMenuItem
              key={c}
              onSelect={() => onChange({ ...filter, currency: c })}
              className={cn(filter.currency === c && "font-semibold text-primary")}
            >
              {c === "all" ? "Todas las monedas" : c}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Categories */}
      {categories.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className={cn("inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input bg-background text-xs font-medium shadow-sm hover:bg-accent/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", filter.categoryIds.length > 0 && "border-primary text-primary")}>
            Categorías
            {filter.categoryIds.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {filter.categoryIds.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto w-52">
            {categories.map((cat) => (
              <DropdownMenuItem
                key={cat.id}
                onSelect={(e) => { e.preventDefault(); toggleCategory(cat.id) }}
                className={cn(filter.categoryIds.includes(cat.id) && "font-semibold text-primary")}
              >
                <span className="flex-1">{cat.name}</span>
                {filter.categoryIds.includes(cat.id) && (
                  <span className="ml-auto text-primary">✓</span>
                )}
              </DropdownMenuItem>
            ))}
            {filter.categoryIds.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onChange({ ...filter, categoryIds: [] })} className="text-muted-foreground">
                  Limpiar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Accounts */}
      {accounts.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className={cn("inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input bg-background text-xs font-medium shadow-sm hover:bg-accent/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", filter.accountIds.length > 0 && "border-primary text-primary")}>
            Cuentas
            {filter.accountIds.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {filter.accountIds.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto w-52">
            {accounts.map((acc) => (
              <DropdownMenuItem
                key={acc.id}
                onSelect={(e) => { e.preventDefault(); toggleAccount(acc.id) }}
                className={cn(filter.accountIds.includes(acc.id) && "font-semibold text-primary")}
              >
                <span className="flex-1">{acc.name}</span>
                {filter.accountIds.includes(acc.id) && (
                  <span className="ml-auto text-primary">✓</span>
                )}
              </DropdownMenuItem>
            ))}
            {filter.accountIds.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onChange({ ...filter, accountIds: [] })} className="text-muted-foreground">
                  Limpiar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Active filters count badge */}
      {activeFiltersCount > 0 && (
        <Badge variant="secondary" className="h-6 text-[11px]">
          {activeFiltersCount} filtro{activeFiltersCount !== 1 ? "s" : ""}
        </Badge>
      )}

      {/* Saved views */}
      <div className="ml-auto flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Bookmark className="h-3.5 w-3.5" />
            Vistas guardadas
            {savedViews.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {savedViews.length}
              </Badge>
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

      {/* Save view dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar vista</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="view-name">Nombre de la vista</Label>
              <Input
                id="view-name"
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
