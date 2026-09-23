"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react"
import { Label } from "@/components/ui/label"
import { MangoMultiSelect } from "@/components/ui/mango-multi-select"
import { AccountIconChip } from "@/lib/accounts"
import { CategoryIconChip } from "@/lib/categories"
import type { Tables } from "@/lib/database.types"
import { DateRangeFilter, defaultDateRange } from "@/components/ui/date-range-filter"
import type { DateRangeValue } from "@/components/ui/date-range-filter"
import { CurrencySegmented } from "@/components/ui/currency-segmented"
import { cn } from "@/lib/utils"

type Category = Tables<"categories">
type Account = Tables<"accounts">

export function normalize(s: string) {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

export type EstadoFilter = "todos" | "activos" | "pausados"
export type MonedaFilter = "todas" | "ARS" | "USD"
export type SortKey = "recientes" | "nombre" | "porcentaje" | "limite"
export type SortDir = "asc" | "desc"

export interface BudgetFilters {
  search: string
  estado: EstadoFilter
  moneda: MonedaFilter
  dateRange: DateRangeValue
  categoryIds: string[]
  accountIds: string[]
  sortKey: SortKey
  sortDir: SortDir
}

export const DEFAULT_FILTERS: BudgetFilters = {
  search: "",
  estado: "todos",
  moneda: "todas",
  dateRange: defaultDateRange(),
  categoryIds: [],
  accountIds: [],
  sortKey: "recientes",
  sortDir: "desc",
}

export const BUDGET_SORT_PILLS: { key: SortKey; label: string }[] = [
  { key: "recientes", label: "Recientes" },
  { key: "nombre", label: "Nombre" },
  { key: "porcentaje", label: "% usado" },
  { key: "limite", label: "Límite" },
]

export function BudgetSortControl({
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

export function BudgetFilterBar({
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

  const dateRangeIsDefault = filters.dateRange.preset === "all_time"

  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.estado !== "todos" ||
    filters.moneda !== "todas" ||
    !dateRangeIsDefault ||
    filters.categoryIds.length > 0 ||
    filters.accountIds.length > 0 ||
    filters.sortKey !== "recientes"

  const activeChips: string[] = []
  if (filters.estado !== "todos") {
    activeChips.push(filters.estado === "activos" ? "Activos" : "Pausados")
  }
  if (filters.moneda !== "todas") activeChips.push(filters.moneda)
  if (!dateRangeIsDefault) activeChips.push(filters.dateRange.label)
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

  const secondaryFilters = (
    <div className="space-y-4">
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
          <CurrencySegmented
            value={filters.moneda === "todas" ? "all" : filters.moneda}
            onChange={(v) => onChange({ ...filters, moneda: v === "all" ? "todas" : v })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Período</Label>
          <DateRangeFilter
            value={filters.dateRange}
            onChange={(dateRange) => onChange({ ...filters, dateRange })}
            triggerClassName="w-full"
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
      <div className="flex items-center gap-2">
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

      <div className="hidden lg:block">
        {secondaryFilters}
      </div>

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
