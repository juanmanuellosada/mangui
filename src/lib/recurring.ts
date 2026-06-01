import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  getDaysInMonth,
  getDay,
  parseISO,
  startOfDay,
  isBefore,
  isEqual,
  format,
} from "date-fns"
import { es } from "date-fns/locale"
import type { Tables, Enums } from "@/lib/database.types"
import { defaultDateRange, type DateRangeValue } from "@/components/ui/date-range-filter"

export type RecurringTransaction = Tables<"recurring_transactions">
export type RecurringOccurrence = Tables<"recurring_occurrences">
export type RecurringFrequency = Enums<"recurring_frequency">
export type WeekendHandling = Enums<"weekend_handling">

/** Query keys for TanStack Query cache invalidation */
export const RECURRING_KEY = ["recurring_transactions"] as const
export const OCCURRENCES_KEY = ["recurring_occurrences"] as const

// ── AR national holidays (fixed-date) ────────────────────────────────────────
//
// This set covers fixed-date national holidays for 2025–2027.
// Movable holidays (Carnaval, Semana Santa, puentes, etc.) are NOT included
// as they shift year to year — extend `AR_HOLIDAYS` with YYYY-MM-DD strings
// as needed when those dates are announced by government decree.
//
// Sources: Decreto 52/2017 and subsequent annual scheduling decrees.
// Format: "MM-DD" for year-agnostic matching.
//
export const AR_HOLIDAYS_MONTHDAY = new Set<string>([
  "01-01", // Año Nuevo
  "03-24", // Día de la Memoria por la Verdad y la Justicia
  "04-02", // Día del Veterano y de los Caídos en Malvinas
  "05-01", // Día del Trabajador
  "05-25", // Día de la Revolución de Mayo
  "06-20", // Paso a la Inmortalidad del Gral. Manuel Belgrano
  "07-09", // Día de la Independencia
  "12-08", // Inmaculada Concepción de María
  "12-25", // Navidad
])

// Year-specific observed holidays (movable or bridge days by decree).
// Key format: "YYYY-MM-DD". Extend each year.
export const AR_HOLIDAYS_SPECIFIC = new Set<string>([
  // 2026 observed/bridge holidays (these will be confirmed by decree; listed as placeholders)
  "2026-08-17", // Paso a la Inmortalidad del Gral. San Martín (observed)
  "2026-10-12", // Día del Respeto a la Diversidad Cultural (observed)
  "2026-11-20", // Día de la Soberanía Nacional (observed)
])

/**
 * Returns true when the given date is a weekend (Saturday=6, Sunday=0)
 * or a known AR national holiday.
 */
export function isBusinessDay(date: Date): boolean {
  const dow = getDay(date) // 0=Sun, 6=Sat
  if (dow === 0 || dow === 6) return false
  const md = format(date, "MM-dd")
  if (AR_HOLIDAYS_MONTHDAY.has(md)) return false
  const ymd = format(date, "yyyy-MM-dd")
  if (AR_HOLIDAYS_SPECIFIC.has(ymd)) return false
  return true
}

/**
 * Clamp day-of-month to actual days in that month.
 * E.g. day=31 for April → 30.
 */
function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, getDaysInMonth(new Date(year, month - 1, 1)))
}

/**
 * Apply weekend_handling to a candidate date:
 * - 'as_is': return as-is
 * - 'skip': if falls on weekend/holiday → move forward to next Monday
 *           (keeps moving until a business day is found)
 * - 'previous_business_day': if falls on weekend/holiday → move backward
 *           until a business day is found
 */
function applyWeekendHandling(date: Date, handling: WeekendHandling): Date {
  if (handling === "as_is") return date
  if (isBusinessDay(date)) return date

  if (handling === "skip") {
    let d = addDays(date, 1)
    while (!isBusinessDay(d)) d = addDays(d, 1)
    return d
  }

  // previous_business_day
  let d = addDays(date, -1)
  while (!isBusinessDay(d)) d = addDays(d, -1)
  return d
}

/**
 * Compute the raw candidate date based on frequency and day fields.
 * This is the "ideal" date before weekend adjustment.
 */
function rawCandidateDate(rec: RecurringTransaction, base: Date): Date {
  const y = base.getFullYear()
  const m = base.getMonth() + 1 // 1-based

  switch (rec.frequency) {
    case "weekly":
    case "biweekly": {
      // day_of_week 0=Sun…6=Sat (JS convention)
      // Already handled by advanceNextRun step logic; raw = base itself
      return base
    }
    case "monthly":
    case "bimonthly": {
      const dom = rec.day_of_month ?? 1
      const clamped = clampDay(y, m, dom)
      return startOfDay(new Date(y, m - 1, clamped))
    }
    case "annual": {
      const dom = rec.day_of_month ?? 1
      const moy = rec.month_of_year ?? 1
      const clamped = clampDay(y, moy, dom)
      return startOfDay(new Date(y, moy - 1, clamped))
    }
    case "custom":
      return base
  }
}

/**
 * Compute the next occurrence date ≥ `from` for the given recurring transaction,
 * then apply weekend_handling.
 *
 * Algorithm per frequency:
 * - weekly/biweekly: find the next date ≥ from with the right day_of_week,
 *   then advance in weekly/biweekly steps.
 * - monthly/bimonthly/annual: build the candidate date in the reference month/year,
 *   advance by period until ≥ from.
 */
export function computeNextRun(rec: RecurringTransaction, from: Date): Date {
  const fromDay = startOfDay(from)

  let candidate: Date

  switch (rec.frequency) {
    case "weekly":
    case "biweekly": {
      const targetDow = rec.day_of_week ?? 1 // 0=Sun, default Mon
      const step = rec.frequency === "weekly" ? 7 : 14

      // Find the first date ≥ fromDay with the right day_of_week
      let d = fromDay
      while (getDay(d) !== targetDow) {
        d = addDays(d, 1)
      }
      // d is now the first occurrence on the right weekday ≥ fromDay.
      // For biweekly, we need to align with the start_date cycle.
      if (rec.frequency === "biweekly" && rec.start_date) {
        const origin = startOfDay(parseISO(rec.start_date))
        // Find the first "on-cycle" occurrence ≥ fromDay
        let anchor = origin
        // Make sure anchor is on the right weekday (it should be if data is clean)
        while (!isEqual(d, anchor) && isBefore(anchor, d)) {
          anchor = addDays(anchor, step)
        }
        // anchor is now ≥ d. If anchor > d, we might need to check the previous one.
        // Use the smallest anchor ≥ fromDay:
        d = anchor
      }
      candidate = d
      break
    }
    case "monthly": {
      const dom = rec.day_of_month ?? 1
      // Start from fromDay's month
      let y = fromDay.getFullYear()
      let m = fromDay.getMonth() + 1
      let attempt = startOfDay(new Date(y, m - 1, clampDay(y, m, dom)))
      while (isBefore(attempt, fromDay)) {
        m += 1
        if (m > 12) { m = 1; y += 1 }
        attempt = startOfDay(new Date(y, m - 1, clampDay(y, m, dom)))
      }
      candidate = attempt
      break
    }
    case "bimonthly": {
      const dom = rec.day_of_month ?? 1
      let y = fromDay.getFullYear()
      let m = fromDay.getMonth() + 1
      let attempt = startOfDay(new Date(y, m - 1, clampDay(y, m, dom)))
      while (isBefore(attempt, fromDay)) {
        m += 2
        if (m > 12) { m = m - 12; y += 1 }
        attempt = startOfDay(new Date(y, m - 1, clampDay(y, m, dom)))
      }
      candidate = attempt
      break
    }
    case "annual": {
      const dom = rec.day_of_month ?? 1
      const moy = rec.month_of_year ?? 1
      let y = fromDay.getFullYear()
      let attempt = startOfDay(new Date(y, moy - 1, clampDay(y, moy, dom)))
      while (isBefore(attempt, fromDay)) {
        y += 1
        attempt = startOfDay(new Date(y, moy - 1, clampDay(y, moy, dom)))
      }
      candidate = attempt
      break
    }
    case "custom": {
      const days = rec.interval_days ?? 1
      const origin = rec.start_date
        ? startOfDay(parseISO(rec.start_date))
        : fromDay
      // Find smallest k >= 0 such that origin + k*days >= fromDay
      let k = 0
      if (isBefore(origin, fromDay)) {
        const diffMs = fromDay.getTime() - origin.getTime()
        const msPerDay = days * 86_400_000
        k = Math.ceil(diffMs / msPerDay)
      }
      candidate = addDays(origin, k * days)
      break
    }
  }

  return applyWeekendHandling(candidate, rec.weekend_handling)
}

/**
 * Advance the next_run by exactly one period after `current`,
 * then apply weekend_handling.
 */
export function advanceNextRun(rec: RecurringTransaction, current: Date): Date {
  let raw: Date

  switch (rec.frequency) {
    case "weekly":
      raw = addWeeks(current, 1)
      break
    case "biweekly":
      raw = addWeeks(current, 2)
      break
    case "monthly": {
      const dom = rec.day_of_month ?? 1
      const next = addMonths(current, 1)
      const y = next.getFullYear()
      const m = next.getMonth() + 1
      raw = startOfDay(new Date(y, m - 1, clampDay(y, m, dom)))
      break
    }
    case "bimonthly": {
      const dom = rec.day_of_month ?? 1
      const next = addMonths(current, 2)
      const y = next.getFullYear()
      const m = next.getMonth() + 1
      raw = startOfDay(new Date(y, m - 1, clampDay(y, m, dom)))
      break
    }
    case "annual": {
      const dom = rec.day_of_month ?? 1
      const moy = rec.month_of_year ?? 1
      const next = addYears(current, 1)
      const y = next.getFullYear()
      raw = startOfDay(new Date(y, moy - 1, clampDay(y, moy, dom)))
      break
    }
    case "custom": {
      const days = rec.interval_days ?? 1
      raw = addDays(current, days)
      break
    }
  }

  return applyWeekendHandling(raw, rec.weekend_handling)
}

// Day-of-week names in es-AR (0=Sun)
const DOW_LABELS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]

// Month names in es-AR (1-based)
const MONTH_LABELS = [
  "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

/**
 * Returns a human-readable frequency label in es-AR.
 *
 * Examples:
 *   monthly  day=10    → "Mensual · día 10"
 *   weekly   dow=1     → "Semanal · lunes"
 *   annual   moy=7 d=9 → "Anual · 9 de julio"
 *   biweekly           → "Quincenal"
 *   bimonthly day=5    → "Bimestral · día 5"
 */
export function frequencyLabel(rec: RecurringTransaction): string {
  switch (rec.frequency) {
    case "weekly": {
      const dow = rec.day_of_week ?? 1
      return `Semanal · ${DOW_LABELS[dow]}`
    }
    case "biweekly":
      return "Quincenal"
    case "monthly": {
      const dom = rec.day_of_month ?? 1
      return `Mensual · día ${dom}`
    }
    case "bimonthly": {
      const dom = rec.day_of_month ?? 1
      return `Bimestral · día ${dom}`
    }
    case "annual": {
      const dom = rec.day_of_month ?? 1
      const moy = rec.month_of_year ?? 1
      return `Anual · ${dom} de ${MONTH_LABELS[moy]}`
    }
    case "custom": {
      const days = rec.interval_days ?? 1
      return `Cada ${days} día${days === 1 ? "" : "s"}`
    }
  }
}

/** Labels for frequency select options */
export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  bimonthly: "Bimestral",
  annual: "Anual",
  custom: "Personalizado",
}

/** Labels for weekend_handling */
export const WEEKEND_HANDLING_LABELS: Record<WeekendHandling, string> = {
  as_is: "Tal cual",
  skip: "Saltar al lunes",
  previous_business_day: "Viernes hábil anterior",
}

// ── RecurringFilter ──────────────────────────────────────────────────────────

export interface RecurringFilter {
  search: string
  type: "all" | "income" | "expense" | "transfer"
  date: DateRangeValue
  accountIds: string[]
  categoryIds: string[]
  status: "all" | "active" | "paused"
  cardOnly: boolean
}

export function defaultRecurringFilter(): RecurringFilter {
  return {
    search: "",
    type: "all",
    date: defaultDateRange(),
    accountIds: [],
    categoryIds: [],
    status: "all",
    cardOnly: false,
  }
}

/** Labels for day of week (0=domingo) */
export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
}

/** Month labels (1-based) for annual selector */
export const MONTH_OF_YEAR_LABELS: Record<number, string> = {
  1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
  5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
  9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
}
