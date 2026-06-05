"use client"

import { DateRangeFilter, type DateRangeValue } from "@/components/ui/date-range-filter"
import { MangoMultiSelect, type MangoMultiSelectOption } from "@/components/ui/mango-multi-select"
import { getPreset, lastN, type PresetKey, type LastNUnit } from "@/lib/date-ranges"
import type { StatsFilter } from "@/lib/stats"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChartFilters {
  date: DateRangeValue
  accountIds: string[]
  categoryIds: string[]
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function dateFromPreset(key: PresetKey): DateRangeValue {
  const r = getPreset(key)
  return { operator: "between", preset: key, from: r.from, to: r.to, label: r.label }
}

export function dateFromLastN(n: number, unit: LastNUnit): DateRangeValue {
  const r = lastN(n, unit)
  return { operator: "between", lastN: { n, unit }, from: r.from, to: r.to, label: r.label }
}

// ─── Filter conversion ────────────────────────────────────────────────────────

export function chartFiltersToStatsFilter(
  f: ChartFilters,
  type?: "all" | "income" | "expense",
): StatsFilter {
  return {
    dateFrom: f.date.from ?? undefined,
    dateTo: f.date.to ?? undefined,
    accountIds: f.accountIds.length > 0 ? f.accountIds : undefined,
    categoryIds: f.categoryIds.length > 0 ? f.categoryIds : undefined,
    type,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ChartFilterBarProps {
  filters: ChartFilters
  onChange: (f: ChartFilters) => void
  accountOptions: MangoMultiSelectOption[]
  categoryOptions: MangoMultiSelectOption[]
}

export function ChartFilterBar({
  filters,
  onChange,
  accountOptions,
  categoryOptions,
}: ChartFilterBarProps) {
  return (
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
      <div className="flex-1 min-w-0">
        <DateRangeFilter
          value={filters.date}
          onChange={(date) => onChange({ ...filters, date })}
          triggerClassName="w-full min-w-0"
        />
      </div>
      <div className="flex-1 min-w-0">
        <MangoMultiSelect
          values={filters.accountIds}
          onChange={(accountIds) => onChange({ ...filters, accountIds })}
          options={accountOptions}
          placeholder="Todas las cuentas"
          showSearch
        />
      </div>
      <div className="flex-1 min-w-0">
        <MangoMultiSelect
          values={filters.categoryIds}
          onChange={(categoryIds) => onChange({ ...filters, categoryIds })}
          options={categoryOptions}
          placeholder="Todas las categorías"
          showSearch
        />
      </div>
    </div>
  )
}
