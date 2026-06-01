/**
 * date-ranges.ts — preset and "últimos N" range helpers for DateRangeFilter.
 *
 * Every helper returns { from: string | null, to: string | null, label: string }
 * where dates are ISO yyyy-MM-dd strings. Null means "unbounded" on that side.
 *
 * "Today" is always derived from `new Date()` — same pattern as date-utils.ts
 * (no Date.now() calls; just `new Date()` which is idiomatic in this project).
 */

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  subMonths,
  subQuarters,
  subYears,
  subDays,
  subWeeks,
} from "date-fns"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DateRange {
  from: string | null
  to: string | null
  label: string
}

export type PresetKey =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "year_to_date"
  | "last_year"
  | "all_time"

export type LastNUnit = "days" | "weeks" | "months"

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

// ─── Presets ──────────────────────────────────────────────────────────────────

function computePreset(key: PresetKey): DateRange {
  const now = new Date()

  switch (key) {
    case "this_month":
      return {
        from: toISO(startOfMonth(now)),
        to: toISO(endOfMonth(now)),
        label: "Este mes",
      }

    case "last_month": {
      const lm = subMonths(now, 1)
      return {
        from: toISO(startOfMonth(lm)),
        to: toISO(endOfMonth(lm)),
        label: "El mes pasado",
      }
    }

    case "this_quarter":
      return {
        from: toISO(startOfQuarter(now)),
        to: toISO(endOfQuarter(now)),
        label: "Este trimestre",
      }

    case "last_quarter": {
      const lq = subQuarters(now, 1)
      return {
        from: toISO(startOfQuarter(lq)),
        to: toISO(endOfQuarter(lq)),
        label: "El trimestre pasado",
      }
    }

    case "year_to_date":
      return {
        from: toISO(startOfYear(now)),
        to: toISO(now),
        label: "Lo que va del año",
      }

    case "last_year": {
      const ly = subYears(now, 1)
      return {
        from: toISO(startOfYear(ly)),
        to: toISO(startOfYear(now)),
        label: "El año pasado",
      }
    }

    case "all_time":
      return { from: null, to: null, label: "Todo el historial" }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Available presets in display order. */
export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this_month", label: "Este mes" },
  { key: "last_month", label: "El mes pasado" },
  { key: "this_quarter", label: "Este trimestre" },
  { key: "last_quarter", label: "El trimestre pasado" },
  { key: "year_to_date", label: "Lo que va del año" },
  { key: "last_year", label: "El año pasado" },
  { key: "all_time", label: "Todo el historial" },
]

/** Return the computed { from, to, label } for a preset key. */
export function getPreset(key: PresetKey): DateRange {
  return computePreset(key)
}

/**
 * Compute a "últimos N" range: from = (today − N unit), to = today.
 * Unit can be 'days', 'weeks', or 'months'.
 */
export function lastN(n: number, unit: LastNUnit): DateRange {
  const now = new Date()
  let from: Date
  switch (unit) {
    case "days":
      from = subDays(now, n)
      break
    case "weeks":
      from = subWeeks(now, n)
      break
    case "months":
      from = subMonths(now, n)
      break
  }

  const unitLabel: Record<LastNUnit, string> = {
    days: n === 1 ? "día" : "días",
    weeks: n === 1 ? "semana" : "semanas",
    months: n === 1 ? "mes" : "meses",
  }

  return {
    from: toISO(from),
    to: toISO(now),
    label: `Últimos ${n} ${unitLabel[unit]}`,
  }
}
