"use client"

import { useMemo, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Scale,
  ChevronRight,
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
import {
  EvilBarChart,
  Bar,
  XAxis,
  Grid,
  Tooltip,
  Legend,
} from "@/components/evilcharts/charts/bar-chart"
import { DateRangeFilter, type DateRangeValue } from "@/components/ui/date-range-filter"
import { formatCurrency, cn } from "@/lib/utils"
import {
  filterMovements,
  periodComparison,
} from "@/lib/stats"
import { getPreset } from "@/lib/date-ranges"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/database.types"
import Link from "next/link"

type Movement = Tables<"movements">
type Category = Tables<"categories">
type SavedView = Tables<"saved_views">

// ── Shared filter shape passed from the page ──────────────────────────────────

export interface CompareSharedFilter {
  type: "all" | "income" | "expense"
  categoryIds: string[]
  accountIds: string[]
}

// ── Saved view payload for stats_compare ─────────────────────────────────────

interface CompareSavedViewPayload {
  period1: DateRangeValue
  period2: DateRangeValue
  type: "all" | "income" | "expense"
  categoryIds: string[]
  accountIds: string[]
  currency: "ARS" | "USD" | "all"
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function fetchCompareSavedViews(): Promise<SavedView[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("saved_views")
    .select("*")
    .eq("scope", "stats_compare")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

async function createCompareSavedView(name: string, payload: CompareSavedViewPayload): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
  const { error } = await supabase
    .from("saved_views")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ name, filters: payload as any, user_id: user.id, scope: "stats_compare" })
  if (error) throw error
}

async function deleteCompareSavedView(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("saved_views").delete().eq("id", id)
  if (error) throw error
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDefaultPeriod1(): DateRangeValue {
  const r = getPreset("this_month")
  return { operator: "between", preset: "this_month", from: r.from, to: r.to, label: r.label }
}

function makeDefaultPeriod2(): DateRangeValue {
  const r = getPreset("last_month")
  return { operator: "between", preset: "last_month", from: r.from, to: r.to, label: r.label }
}

function DeltaBadge({ pct, inverted = false }: { pct: number | null; inverted?: boolean }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>
  const isGood = inverted ? pct < 0 : pct > 0
  const icon = pct > 0 ? "↑" : "↓"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-full",
        isGood ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
      )}
      aria-label={`${pct > 0 ? "Subió" : "Bajó"} ${Math.abs(pct).toFixed(1)}%`}
    >
      {icon} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

type CompareChartRow = { label: string; periodoA: number; periodoB: number }

const compareChartConfig = {
  periodoA: {
    label: "Período 1",
    colors: {
      light: ["oklch(0.748 0.219 131.7)"],
      dark: ["oklch(0.82 0.22 131.7)"],
    },
  },
  periodoB: {
    label: "Período 2",
    colors: {
      light: ["oklch(0.714 0.213 47.6)"],
      dark: ["oklch(0.78 0.21 47.6)"],
    },
  },
} satisfies Record<keyof Omit<CompareChartRow, "label">, { label: string; colors: { light: string[]; dark: string[] } }>

// ── Props ─────────────────────────────────────────────────────────────────────

interface CompareTabProps {
  movements: Movement[]
  categories: Category[]
  currency?: "ARS" | "USD"
  sharedFilter: CompareSharedFilter
  onRestoreSharedFilter?: (sf: {
    type: "all" | "income" | "expense"
    categoryIds: string[]
    accountIds: string[]
    currency: "ARS" | "USD" | "all"
  }) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CompareTab({ movements, categories, currency = "ARS", sharedFilter, onRestoreSharedFilter }: CompareTabProps) {
  const queryClient = useQueryClient()

  const [period1, setPeriod1] = useState<DateRangeValue>(makeDefaultPeriod1)
  const [period2, setPeriod2] = useState<DateRangeValue>(makeDefaultPeriod2)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState("")

  const { data: savedViews = [] } = useQuery({
    queryKey: ["saved_views", "stats_compare"],
    queryFn: fetchCompareSavedViews,
  })

  const createMutation = useMutation({
    mutationFn: ({ name, payload }: { name: string; payload: CompareSavedViewPayload }) =>
      createCompareSavedView(name, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved_views", "stats_compare"] })
      toast.success("Vista guardada")
      setSaveDialogOpen(false)
      setSaveName("")
    },
    onError: () => toast.error("No se pudo guardar la vista"),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCompareSavedView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved_views", "stats_compare"] })
      toast.success("Vista eliminada")
    },
    onError: () => toast.error("No se pudo eliminar"),
  })

  function loadView(view: SavedView) {
    const payload = view.filters as unknown as CompareSavedViewPayload
    if (payload.period1) setPeriod1(payload.period1)
    if (payload.period2) setPeriod2(payload.period2)
    onRestoreSharedFilter?.({
      type: payload.type ?? sharedFilter.type,
      categoryIds: payload.categoryIds ?? sharedFilter.categoryIds,
      accountIds: payload.accountIds ?? sharedFilter.accountIds,
      currency: payload.currency ?? (currency === "ARS" ? "ARS" : "USD"),
    })
  }

  function buildCurrentPayload(): CompareSavedViewPayload {
    return {
      period1,
      period2,
      type: sharedFilter.type,
      categoryIds: sharedFilter.categoryIds,
      accountIds: sharedFilter.accountIds,
      currency: currency === "ARS" ? "ARS" : "USD",
    }
  }

  // Build StatsFilter for each period, applying shared non-date filters
  const statsFilter1 = useMemo(() => ({
    dateFrom: period1.from ?? undefined,
    dateTo: period1.to ?? undefined,
    categoryIds: sharedFilter.categoryIds.length > 0 ? sharedFilter.categoryIds : undefined,
    accountIds: sharedFilter.accountIds.length > 0 ? sharedFilter.accountIds : undefined,
    type: sharedFilter.type,
    currency: currency !== "ARS" ? (currency as "USD") : undefined,
  }), [period1, sharedFilter, currency])

  const statsFilter2 = useMemo(() => ({
    dateFrom: period2.from ?? undefined,
    dateTo: period2.to ?? undefined,
    categoryIds: sharedFilter.categoryIds.length > 0 ? sharedFilter.categoryIds : undefined,
    accountIds: sharedFilter.accountIds.length > 0 ? sharedFilter.accountIds : undefined,
    type: sharedFilter.type,
    currency: currency !== "ARS" ? (currency as "USD") : undefined,
  }), [period2, sharedFilter, currency])

  const movsA = useMemo(
    () => filterMovements(movements, statsFilter1),
    [movements, statsFilter1]
  )
  const movsB = useMemo(
    () => filterMovements(movements, statsFilter2),
    [movements, statsFilter2]
  )

  const comparison = useMemo(
    () => periodComparison(movsA, movsB, categories, currency),
    [movsA, movsB, categories, currency]
  )

  const { totalsA, totalsB } = comparison

  const chartData: CompareChartRow[] = [
    { label: "Ingresos", periodoA: totalsA.income, periodoB: totalsB.income },
    { label: "Gastos", periodoA: totalsA.expense, periodoB: totalsB.expense },
    { label: "Balance", periodoA: Math.max(totalsA.net, 0), periodoB: Math.max(totalsB.net, 0) },
  ]

  const hasData = movsA.length > 0 || movsB.length > 0

  return (
    <div className="space-y-4">
      {/* Period pickers + saved views */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold">Períodos a comparar</h3>

          {/* Saved views for compare */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background">
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
                Guardar períodos actuales
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Período 1</Label>
            <DateRangeFilter value={period1} onChange={setPeriod1} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Período 2</Label>
            <DateRangeFilter value={period2} onChange={setPeriod2} />
          </div>
        </div>

        {/* Period label summary */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{period1.label}</span>
          <span>vs</span>
          <span>{period2.label}</span>
        </div>
      </div>

      {/* Summary cards with deltas */}
      <div className="grid grid-cols-3 gap-3">
        {/* Ingresos */}
        <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-1.5">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-success" aria-hidden />
            <p className="text-[11px] font-medium text-muted-foreground">Ingresos</p>
          </div>
          <p className="text-sm font-bold tabular-nums text-success">
            +{formatCurrency(totalsA.income, currency)}
          </p>
          <div className="flex items-center gap-1.5">
            <DeltaBadge pct={comparison.deltaPctIncome} />
          </div>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            per. 2: {formatCurrency(totalsB.income, currency)}
          </p>
        </div>

        {/* Gastos */}
        <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-1.5">
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" aria-hidden />
            <p className="text-[11px] font-medium text-muted-foreground">Gastos</p>
          </div>
          <p className="text-sm font-bold tabular-nums text-destructive">
            -{formatCurrency(totalsA.expense, currency)}
          </p>
          <div className="flex items-center gap-1.5">
            <DeltaBadge pct={comparison.deltaPctExpense} inverted />
          </div>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            per. 2: {formatCurrency(totalsB.expense, currency)}
          </p>
        </div>

        {/* Balance */}
        <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-1.5">
          <div className="flex items-center gap-1">
            <Scale className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <p className="text-[11px] font-medium text-muted-foreground">Balance</p>
          </div>
          <p className={cn("text-sm font-bold tabular-nums", totalsA.net >= 0 ? "text-success" : "text-destructive")}>
            {totalsA.net >= 0 ? "+" : "-"}{formatCurrency(Math.abs(totalsA.net), currency)}
          </p>
          <div className="flex items-center gap-1.5">
            <DeltaBadge pct={comparison.deltaPctNet} />
          </div>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            per. 2: {totalsB.net >= 0 ? "+" : "-"}{formatCurrency(Math.abs(totalsB.net), currency)}
          </p>
        </div>
      </div>

      {/* Grouped bar chart */}
      {hasData && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">Ingresos vs Gastos</h3>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary inline-block" aria-hidden />
              {period1.label}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent inline-block" aria-hidden />
              {period2.label}
            </span>
          </div>
          <EvilBarChart
            config={compareChartConfig}
            data={chartData}
            barRadius={4}
            barCategoryGap={16}
            className="h-48"
          >
            <Grid />
            <XAxis dataKey="label" />
            <Bar dataKey="periodoA" />
            <Bar dataKey="periodoB" />
            <Tooltip variant="default" />
            <Legend isClickable />
          </EvilBarChart>
        </div>
      )}

      {/* Per-category list */}
      {comparison.categories.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">Por categoría</h3>
          <p className="text-[10px] text-muted-foreground">Gastos por categoría — período 1 vs período 2</p>
          <div className="space-y-1">
            {comparison.categories.map((cat, idx) => (
              <Link
                key={`${cat.name}-${idx}`}
                href={`/app/movements?type=expense`}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{cat.name}</p>
                </div>
                <div className="text-right min-w-0">
                  <p className="text-xs font-semibold tabular-nums">{formatCurrency(cat.a, currency)}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    per. 2: {formatCurrency(cat.b, currency)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <DeltaBadge pct={cat.deltaPct} inverted />
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      )}

      {!hasData && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center rounded-2xl border border-border/60 bg-card">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30" aria-hidden />
          <p className="text-sm text-muted-foreground">Sin datos para comparar en estos períodos.</p>
        </div>
      )}

      {/* Save view dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar vista de comparación</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="compare-view-name">Nombre de la vista</Label>
              <Input
                id="compare-view-name"
                placeholder="Enero vs Diciembre..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && saveName.trim()) {
                    createMutation.mutate({ name: saveName.trim(), payload: buildCurrentPayload() })
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
              onClick={() => createMutation.mutate({ name: saveName.trim(), payload: buildCurrentPayload() })}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
