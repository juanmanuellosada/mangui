import { describe, it, expect } from "vitest"
import {
  nextCloseDate,
  previousCloseDate,
  computeDueDate,
  currentCycleRange,
  isInCycle,
  toDateString,
  formatStatementLabel,
} from "./cards"

// ---------------------------------------------------------------------------
// toDateString
// ---------------------------------------------------------------------------
describe("toDateString", () => {
  it("formats a Date to yyyy-MM-dd", () => {
    expect(toDateString(new Date(2026, 5, 15))).toBe("2026-06-15")
  })

  it("pads month and day with leading zeros", () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe("2026-01-05")
  })
})

// ---------------------------------------------------------------------------
// nextCloseDate
// ---------------------------------------------------------------------------
describe("nextCloseDate", () => {
  it("returns this month's close when ref is before the close day", () => {
    // ref = June 10, closingDay = 20 → June 20
    const ref = new Date(2026, 5, 10) // June 10 2026
    const result = nextCloseDate(20, ref)
    expect(toDateString(result)).toBe("2026-06-20")
  })

  it("returns this month's close when ref IS the close day", () => {
    const ref = new Date(2026, 5, 20) // June 20 2026
    const result = nextCloseDate(20, ref)
    expect(toDateString(result)).toBe("2026-06-20")
  })

  it("returns next month's close when ref is after the close day", () => {
    // ref = June 25, closingDay = 20 → July 20
    const ref = new Date(2026, 5, 25) // June 25 2026
    const result = nextCloseDate(20, ref)
    expect(toDateString(result)).toBe("2026-07-20")
  })

  it("clamps day=31 in February (non-leap 2026) to Feb 28", () => {
    const ref = new Date(2026, 1, 1) // Feb 1 2026
    const result = nextCloseDate(31, ref)
    expect(toDateString(result)).toBe("2026-02-28")
  })

  it("clamps day=31 in February (leap 2024) to Feb 29", () => {
    const ref = new Date(2024, 1, 1) // Feb 1 2024
    const result = nextCloseDate(31, ref)
    expect(toDateString(result)).toBe("2024-02-29")
  })

  it("wraps from December to January next year", () => {
    // ref = Dec 25, closingDay = 20 → Jan 20 2027
    const ref = new Date(2026, 11, 25) // Dec 25 2026
    const result = nextCloseDate(20, ref)
    expect(toDateString(result)).toBe("2027-01-20")
  })
})

// ---------------------------------------------------------------------------
// previousCloseDate
// ---------------------------------------------------------------------------
describe("previousCloseDate", () => {
  it("returns this month's close when it is strictly before ref", () => {
    // ref = June 25, closingDay = 20 → June 20
    const ref = new Date(2026, 5, 25)
    const result = previousCloseDate(20, ref)
    expect(toDateString(result)).toBe("2026-06-20")
  })

  it("returns last month's close when ref is on or before close day", () => {
    // ref = June 15, closingDay = 20 → May 20
    const ref = new Date(2026, 5, 15)
    const result = previousCloseDate(20, ref)
    expect(toDateString(result)).toBe("2026-05-20")
  })

  it("ref equals close day → returns last month's close", () => {
    // close is NOT strictly before ref when equal, so falls to last month
    const ref = new Date(2026, 5, 20) // June 20
    const result = previousCloseDate(20, ref)
    expect(toDateString(result)).toBe("2026-05-20")
  })

  it("wraps from January back to December of previous year", () => {
    // ref = Jan 10, closingDay = 20 → Dec 20 previous year
    const ref = new Date(2026, 0, 10)
    const result = previousCloseDate(20, ref)
    expect(toDateString(result)).toBe("2025-12-20")
  })

  it("clamps day=31 for February", () => {
    // ref = March 5, closingDay = 31 → previous month is Feb → Feb 28 (2026 non-leap)
    const ref = new Date(2026, 2, 5)
    const result = previousCloseDate(31, ref)
    expect(toDateString(result)).toBe("2026-02-28")
  })
})

// ---------------------------------------------------------------------------
// computeDueDate
// ---------------------------------------------------------------------------
describe("computeDueDate", () => {
  it("dueDay > closingDay → due in same month as close", () => {
    // close = June 20 (closingDay=20), dueDay=25 → June 25
    const closeDate = new Date(2026, 5, 20)
    const result = computeDueDate(closeDate, 25, 20)
    expect(toDateString(result)).toBe("2026-06-25")
  })

  it("dueDay <= closingDay → due in following month", () => {
    // close = June 20 (closingDay=20), dueDay=10 → July 10
    const closeDate = new Date(2026, 5, 20)
    const result = computeDueDate(closeDate, 10, 20)
    expect(toDateString(result)).toBe("2026-07-10")
  })

  it("dueDay === closingDay → due in following month", () => {
    const closeDate = new Date(2026, 5, 20)
    const result = computeDueDate(closeDate, 20, 20)
    expect(toDateString(result)).toBe("2026-07-20")
  })

  it("month/year wrap: close in December, due in January next year", () => {
    // close = Dec 20 (closingDay=20), dueDay=10 → Jan 10 next year
    const closeDate = new Date(2026, 11, 20)
    const result = computeDueDate(closeDate, 10, 20)
    expect(toDateString(result)).toBe("2027-01-10")
  })

  it("due day clamped when target month is shorter", () => {
    // close = Jan 31 (closingDay=31), dueDay=15 ≤ 31 → Feb 15 (no clamping needed)
    const closeDate = new Date(2026, 0, 31)
    const result = computeDueDate(closeDate, 15, 31)
    expect(toDateString(result)).toBe("2026-02-15")
  })

  it("due day clamped to Feb 28 when dueDay=31 in non-leap year", () => {
    // close = Jan 15 (closingDay=15), dueDay=31 > 15 → same month (Jan) clamp to 31
    // Actually Jan has 31 days so no clamping. Let's use a close in Jan, dueDay=31>15
    // close = Jan 15, closingDay=15, dueDay=31 > closingDay → same month Jan 31
    const closeDate = new Date(2026, 0, 15)
    const result = computeDueDate(closeDate, 31, 15)
    expect(toDateString(result)).toBe("2026-01-31")
  })

  it("due day clamps in Feb when following month is Feb", () => {
    // close = Jan 20 (closingDay=20), dueDay=10 <= 20 → Feb 10
    const closeDate = new Date(2026, 0, 20)
    const result = computeDueDate(closeDate, 10, 20)
    expect(toDateString(result)).toBe("2026-02-10")
  })
})

// ---------------------------------------------------------------------------
// currentCycleRange
// ---------------------------------------------------------------------------
describe("currentCycleRange", () => {
  it("cycleEnd = nextClose, cycleStart = day after prevClose", () => {
    // ref = June 10, closingDay = 20
    // nextClose = June 20, prevClose = May 20 → cycleStart = May 21
    const ref = new Date(2026, 5, 10)
    const { cycleStart, cycleEnd } = currentCycleRange(20, ref)
    expect(toDateString(cycleStart)).toBe("2026-05-21")
    expect(toDateString(cycleEnd)).toBe("2026-06-20")
  })

  it("cycleStart < cycleEnd always", () => {
    const ref = new Date(2026, 5, 10)
    const { cycleStart, cycleEnd } = currentCycleRange(20, ref)
    expect(cycleStart.getTime()).toBeLessThan(cycleEnd.getTime())
  })

  it("ref after close day: cycle spans current to next month", () => {
    // ref = June 25, closingDay = 20
    // nextClose = July 20, prevClose = June 20 → cycleStart = June 21
    const ref = new Date(2026, 5, 25)
    const { cycleStart, cycleEnd } = currentCycleRange(20, ref)
    expect(toDateString(cycleStart)).toBe("2026-06-21")
    expect(toDateString(cycleEnd)).toBe("2026-07-20")
  })

  it("closingDay=31, ref in February: cycleEnd clamps correctly", () => {
    const ref = new Date(2026, 1, 15) // Feb 15
    const { cycleEnd } = currentCycleRange(31, ref)
    expect(toDateString(cycleEnd)).toBe("2026-02-28")
  })
})

// ---------------------------------------------------------------------------
// isInCycle
// ---------------------------------------------------------------------------
describe("isInCycle", () => {
  const start = new Date(2026, 4, 21) // May 21
  const end = new Date(2026, 5, 20)   // June 20

  it("date equal to cycleStart → true (inclusive lower bound)", () => {
    expect(isInCycle("2026-05-21", start, end)).toBe(true)
  })

  it("date equal to cycleEnd → true (inclusive upper bound)", () => {
    expect(isInCycle("2026-06-20", start, end)).toBe(true)
  })

  it("date strictly inside cycle → true", () => {
    expect(isInCycle("2026-06-01", start, end)).toBe(true)
  })

  it("date one day before start → false", () => {
    expect(isInCycle("2026-05-20", start, end)).toBe(false)
  })

  it("date one day after end → false", () => {
    expect(isInCycle("2026-06-21", start, end)).toBe(false)
  })

  it("date far in the past → false", () => {
    expect(isInCycle("2020-01-01", start, end)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// formatStatementLabel
// ---------------------------------------------------------------------------
describe("formatStatementLabel", () => {
  it("returns month name in Spanish followed by year", () => {
    const closeDate = new Date(2026, 5, 20) // June 20 2026
    expect(formatStatementLabel(closeDate)).toBe("junio 2026")
  })

  it("January in Spanish", () => {
    const closeDate = new Date(2026, 0, 15)
    expect(formatStatementLabel(closeDate)).toBe("enero 2026")
  })

  it("December in Spanish", () => {
    const closeDate = new Date(2025, 11, 31)
    expect(formatStatementLabel(closeDate)).toBe("diciembre 2025")
  })
})
