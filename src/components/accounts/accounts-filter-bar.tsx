"use client"

import { Search, X, ChevronUp, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { MangoSelect, type MangoSelectOption } from "@/components/ui/mango-select"
import { CurrencySegmented } from "@/components/ui/currency-segmented"
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_EMOJIS, type AccountType } from "@/lib/accounts"
import { cn } from "@/lib/utils"

// ── Filter helpers ────────────────────────────────────────────
export type TipoFilter = "todas" | AccountType
export type MonedaFilter = "todas" | "ARS" | "USD"
export type VisibilidadFilter = "todas" | "visibles" | "ocultas"
export type SortKey = "recientes" | "nombre" | "saldo"
export type SortDir = "asc" | "desc"

export interface AccountFilters {
  search: string
  tipo: TipoFilter
  moneda: MonedaFilter
  visibilidad: VisibilidadFilter
  sortKey: SortKey
  sortDir: SortDir
}

export const DEFAULT_FILTERS: AccountFilters = {
  search: "",
  tipo: "todas",
  moneda: "todas",
  visibilidad: "todas",
  sortKey: "recientes",
  sortDir: "desc",
}

export function normalize(s: string) {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

export function isFiltersActive(f: AccountFilters) {
  return (
    f.search.trim() !== "" ||
    f.tipo !== "todas" ||
    f.moneda !== "todas" ||
    f.visibilidad !== "todas" ||
    f.sortKey !== "recientes"
  )
}

// ── Accounts filter bar ───────────────────────────────────────
const TIPO_OPTIONS: MangoSelectOption[] = [
  { value: "todas", label: "Todos los tipos" },
  ...(Object.entries(ACCOUNT_TYPE_LABELS) as [AccountType, string][]).map(
    ([type, label]) => ({
      value: type,
      label: `${ACCOUNT_TYPE_EMOJIS[type]} ${label}`,
    })
  ),
]

const VISIBILIDAD_OPTIONS: MangoSelectOption[] = [
  { value: "todas", label: "Todas" },
  { value: "visibles", label: "Visibles" },
  { value: "ocultas", label: "Ocultas" },
]

interface AccountsFilterBarProps {
  filters: AccountFilters
  onChange: (f: AccountFilters) => void
  resultCount: number
  totalCount: number
}

// ── Sort segmented control ────────────────────────────────────
const SORT_PILLS: { key: SortKey; label: string }[] = [
  { key: "recientes", label: "Recientes" },
  { key: "nombre", label: "Nombre" },
  { key: "saldo", label: "Saldo" },
]

function SortControl({
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
      // Toggle direction on active pill
      onChange(key, sortDir === "asc" ? "desc" : "asc")
    } else {
      // Default direction per key
      const defaultDir: SortDir = key === "saldo" ? "desc" : key === "nombre" ? "asc" : "desc"
      onChange(key, defaultDir)
    }
  }

  return (
    <div
      role="group"
      aria-label="Ordenar por"
      className="flex items-center gap-1 w-full"
    >
      {SORT_PILLS.map(({ key, label }) => {
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
              "flex-1 inline-flex items-center justify-center gap-1 h-9 px-2 md:px-3 rounded-lg text-xs md:text-sm font-medium min-w-0",
              "border transition-all duration-150 cursor-pointer select-none motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                : "bg-background border-input text-muted-foreground hover:border-ring/60 hover:text-foreground dark:bg-input/30"
            )}
          >
            <span className="truncate">{label}</span>
            {showDir && <DirIcon className="h-3 w-3 shrink-0" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

export function AccountsFilterBar({ filters, onChange, resultCount, totalCount }: AccountsFilterBarProps) {
  const active = isFiltersActive(filters)

  return (
    <div className="space-y-2">
      {/* Single row on lg+: search grows, selects + sort stay compact */}
      <div className="flex flex-wrap lg:flex-nowrap gap-2 items-center">
        {/* Search input — grows to fill available space */}
        <div className="relative flex-1 min-w-[160px]">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Buscar..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-8 h-9 text-sm"
            aria-label="Buscar cuentas"
          />
        </div>

        {/* Tipo */}
        <div className="w-[160px] shrink-0">
          <MangoSelect
            value={filters.tipo}
            onChange={(v) => onChange({ ...filters, tipo: v as TipoFilter })}
            options={TIPO_OPTIONS}
            aria-label="Filtrar por tipo"
          />
        </div>

        {/* Moneda + Visibilidad — full row on mobile */}
        <div className="flex gap-2 w-full lg:contents">
          <div className="flex-1 lg:flex-none">
            <CurrencySegmented
              value={filters.moneda === "todas" ? "all" : filters.moneda}
              onChange={(v) => onChange({ ...filters, moneda: v === "all" ? "todas" : v })}
              className="flex w-full lg:inline-flex lg:w-auto"
            />
          </div>
          <div className="flex-1 lg:w-[110px] lg:flex-none">
            <MangoSelect
              value={filters.visibilidad}
              onChange={(v) => onChange({ ...filters, visibilidad: v as VisibilidadFilter })}
              options={VISIBILIDAD_OPTIONS}
              aria-label="Filtrar por visibilidad"
            />
          </div>
        </div>

        {/* Sort segmented control */}
        <SortControl
          sortKey={filters.sortKey}
          sortDir={filters.sortDir}
          onChange={(key, dir) => onChange({ ...filters, sortKey: key, sortDir: dir })}
        />
      </div>

      {/* Result count + clear */}
      {active && (
        <div className="flex items-center gap-3 px-0.5">
          <span className="text-xs text-muted-foreground">
            {resultCount === totalCount
              ? `${resultCount} ${resultCount === 1 ? "cuenta" : "cuentas"}`
              : `${resultCount} de ${totalCount} ${totalCount === 1 ? "cuenta" : "cuentas"}`}
          </span>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className={cn(
              "inline-flex items-center gap-1 text-xs text-muted-foreground",
              "hover:text-foreground transition-colors duration-150 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            )}
          >
            <X className="h-3 w-3" aria-hidden />
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  )
}
