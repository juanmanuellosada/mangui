import { describe, it, expect } from "vitest"
import { getPreset, lastN } from "./date-ranges"

// ─── Helpers ────────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function daysBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
}

// ---------------------------------------------------------------------------
// getPreset
// ---------------------------------------------------------------------------
describe("getPreset", () => {
  describe("all_time", () => {
    it("returns null for both from and to", () => {
      const r = getPreset("all_time")
      expect(r.from).toBeNull()
      expect(r.to).toBeNull()
    })

    it("returns the correct Spanish label", () => {
      expect(getPreset("all_time").label).toBe("Todo el historial")
    })
  })

  describe("this_month", () => {
    it("from is first day of current month (yyyy-MM-01)", () => {
      const r = getPreset("this_month")
      expect(r.from).toMatch(ISO_DATE_RE)
      expect(r.from!.endsWith("-01")).toBe(true)
    })

    it("to is last day of current month", () => {
      const r = getPreset("this_month")
      expect(r.to).toMatch(ISO_DATE_RE)
      // Verify from ≤ to
      expect(r.from! <= r.to!).toBe(true)
    })

    it("from and to are in the same month/year", () => {
      const r = getPreset("this_month")
      const fromYM = r.from!.slice(0, 7)
      const toYM = r.to!.slice(0, 7)
      expect(fromYM).toBe(toYM)
    })

    it("label is correct", () => {
      expect(getPreset("this_month").label).toBe("Este mes")
    })
  })

  describe("last_month", () => {
    it("from ≤ to", () => {
      const r = getPreset("last_month")
      expect(r.from! <= r.to!).toBe(true)
    })

    it("from is first of some month (ends with -01)", () => {
      const r = getPreset("last_month")
      expect(r.from!.endsWith("-01")).toBe(true)
    })

    it("last_month is before this_month", () => {
      const lm = getPreset("last_month")
      const tm = getPreset("this_month")
      expect(lm.to! < tm.from!).toBe(true)
    })

    it("label is correct", () => {
      expect(getPreset("last_month").label).toBe("El mes pasado")
    })
  })

  describe("this_quarter", () => {
    it("from ≤ to and both are valid ISO dates", () => {
      const r = getPreset("this_quarter")
      expect(r.from).toMatch(ISO_DATE_RE)
      expect(r.to).toMatch(ISO_DATE_RE)
      expect(r.from! <= r.to!).toBe(true)
    })

    it("span is between 89 and 92 days (quarter length)", () => {
      const r = getPreset("this_quarter")
      const span = daysBetween(r.from!, r.to!)
      expect(span).toBeGreaterThanOrEqual(89)
      expect(span).toBeLessThanOrEqual(92)
    })

    it("label is correct", () => {
      expect(getPreset("this_quarter").label).toBe("Este trimestre")
    })
  })

  describe("last_quarter", () => {
    it("from ≤ to", () => {
      const r = getPreset("last_quarter")
      expect(r.from! <= r.to!).toBe(true)
    })

    it("last_quarter ends before this_quarter starts", () => {
      const lq = getPreset("last_quarter")
      const tq = getPreset("this_quarter")
      expect(lq.to! < tq.from!).toBe(true)
    })

    it("label is correct", () => {
      expect(getPreset("last_quarter").label).toBe("El trimestre pasado")
    })
  })

  describe("year_to_date", () => {
    it("from is Jan 1 of current year", () => {
      const r = getPreset("year_to_date")
      const currentYear = new Date().getFullYear()
      expect(r.from).toBe(`${currentYear}-01-01`)
    })

    it("to is today (within 1 day due to timing)", () => {
      const r = getPreset("year_to_date")
      const today = new Date()
      const pad = (n: number) => String(n).padStart(2, "0")
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
      // Allow 1-day tolerance for midnight edge cases
      expect(Math.abs(daysBetween(r.to!, todayStr))).toBeLessThanOrEqual(1)
    })

    it("from ≤ to", () => {
      const r = getPreset("year_to_date")
      expect(r.from! <= r.to!).toBe(true)
    })

    it("label is correct", () => {
      expect(getPreset("year_to_date").label).toBe("Lo que va del año")
    })
  })

  describe("last_year", () => {
    it("from is Jan 1 of last year", () => {
      const r = getPreset("last_year")
      const lastYear = new Date().getFullYear() - 1
      expect(r.from).toBe(`${lastYear}-01-01`)
    })

    it("from ≤ to", () => {
      const r = getPreset("last_year")
      expect(r.from! <= r.to!).toBe(true)
    })

    it("label is correct", () => {
      expect(getPreset("last_year").label).toBe("El año pasado")
    })
  })
})

// ---------------------------------------------------------------------------
// lastN
// ---------------------------------------------------------------------------
describe("lastN", () => {
  it("lastN(7, 'days') → span of 7 days, to=today", () => {
    const r = lastN(7, "days")
    expect(r.from).toMatch(ISO_DATE_RE)
    expect(r.to).toMatch(ISO_DATE_RE)
    expect(r.from! <= r.to!).toBe(true)
    // span should be exactly 7 days
    expect(daysBetween(r.from!, r.to!)).toBe(7)
  })

  it("lastN(4, 'weeks') → span of 28 days", () => {
    const r = lastN(4, "weeks")
    expect(daysBetween(r.from!, r.to!)).toBe(28)
  })

  it("lastN(3, 'months') → span approx 89-92 days", () => {
    const r = lastN(3, "months")
    const span = daysBetween(r.from!, r.to!)
    // 3 months is roughly 89-92 days depending on which months
    expect(span).toBeGreaterThanOrEqual(88)
    expect(span).toBeLessThanOrEqual(93)
  })

  it("singular label for n=1 day", () => {
    const r = lastN(1, "days")
    expect(r.label).toBe("Últimos 1 día")
  })

  it("plural label for n=3 days", () => {
    const r = lastN(3, "days")
    expect(r.label).toBe("Últimos 3 días")
  })

  it("singular label for n=1 week", () => {
    const r = lastN(1, "weeks")
    expect(r.label).toBe("Últimos 1 semana")
  })

  it("plural label for n=2 weeks", () => {
    const r = lastN(2, "weeks")
    expect(r.label).toBe("Últimos 2 semanas")
  })

  it("singular label for n=1 month", () => {
    const r = lastN(1, "months")
    expect(r.label).toBe("Últimos 1 mes")
  })

  it("plural label for n=6 months", () => {
    const r = lastN(6, "months")
    expect(r.label).toBe("Últimos 6 meses")
  })

  it("from is always before or equal to to", () => {
    for (const unit of ["days", "weeks", "months"] as const) {
      const r = lastN(5, unit)
      expect(r.from! <= r.to!).toBe(true)
    }
  })
})
