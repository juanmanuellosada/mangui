import type { SummaryTotals } from "@/lib/stats"

export interface FinancialHealthInput {
  totals: SummaryTotals
  movementDates: readonly string[]
  dateFrom: string | null
  dateTo: string | null
  currency: "ARS" | "USD"
  referenceDate: string
}

export interface FinancialHealth {
  savingRate: number | null
  dailyExpense: number
  analyzedDays: number
  currency: "ARS" | "USD"
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return days[month - 1] ?? 0
}

function calendarDayNumber(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null
  }

  const yearsBefore = year - 1
  let days = yearsBefore * 365 + Math.floor(yearsBefore / 4) - Math.floor(yearsBefore / 100) + Math.floor(yearsBefore / 400)
  for (let currentMonth = 1; currentMonth < month; currentMonth += 1) {
    days += daysInMonth(year, currentMonth)
  }

  return days + day
}

function validDateAtOrBefore(date: string, endDate: string): boolean {
  return calendarDayNumber(date) !== null && date <= endDate
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

/**
 * Builds deterministic metrics for the currently filtered statistics range.
 * Dates are compared as yyyy-MM-dd strings and capped by the supplied AR reference date.
 */
export function buildFinancialHealth({
  totals,
  movementDates,
  dateFrom,
  dateTo,
  currency,
  referenceDate,
}: FinancialHealthInput): FinancialHealth {
  const referenceDay = calendarDayNumber(referenceDate)
  if (referenceDay === null) {
    throw new Error("referenceDate must be a valid yyyy-MM-dd date")
  }

  const endDate = dateTo && validDateAtOrBefore(dateTo, referenceDate) ? dateTo : referenceDate
  const earliestMovementDate = movementDates
    .filter((date) => validDateAtOrBefore(date, endDate))
    .sort()[0]
  const requestedStart = dateFrom && calendarDayNumber(dateFrom) !== null ? dateFrom : earliestMovementDate
  const startDate = requestedStart && requestedStart <= endDate ? requestedStart : endDate
  const startDay = calendarDayNumber(startDate) ?? referenceDay
  const endDay = calendarDayNumber(endDate) ?? referenceDay
  const analyzedDays = Math.max(1, endDay - startDay + 1)

  const income = safeNumber(totals.income)
  const expense = safeNumber(totals.expense)

  return {
    savingRate: income > 0 ? (income - expense) / income : null,
    dailyExpense: expense / analyzedDays,
    analyzedDays,
    currency,
  }
}
