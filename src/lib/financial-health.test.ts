import { describe, expect, it } from "vitest"
import { buildFinancialHealth } from "./financial-health"

const referenceDate = "2025-03-15"

describe("buildFinancialHealth", () => {
  it("returns a null saving rate when income is zero", () => {
    const health = buildFinancialHealth({
      totals: { income: 0, expense: 300, net: -300 },
      movementDates: ["2025-03-10"],
      dateFrom: "2025-03-10",
      dateTo: "2025-03-15",
      currency: "ARS",
      referenceDate,
    })

    expect(health).toMatchObject({
      savingRate: null,
      dailyExpense: 50,
      analyzedDays: 6,
      currency: "ARS",
    })
  })

  it("uses the complete closed historical range", () => {
    const health = buildFinancialHealth({
      totals: { income: 1_000, expense: 250, net: 750 },
      movementDates: ["2024-01-05", "2024-01-31"],
      dateFrom: "2024-01-01",
      dateTo: "2024-01-31",
      currency: "ARS",
      referenceDate,
    })

    expect(health).toMatchObject({
      savingRate: 0.75,
      dailyExpense: 250 / 31,
      analyzedDays: 31,
    })
  })

  it("caps an open or future range at the injected reference date", () => {
    const health = buildFinancialHealth({
      totals: { income: 500, expense: 200, net: 300 },
      movementDates: ["2025-03-10", "2025-03-20"],
      dateFrom: "2025-03-10",
      dateTo: "2025-03-31",
      currency: "USD",
      referenceDate,
    })

    expect(health).toMatchObject({
      savingRate: 0.6,
      dailyExpense: 200 / 6,
      analyzedDays: 6,
      currency: "USD",
    })
  })

  it("uses the reference date as the end of an open range", () => {
    const health = buildFinancialHealth({
      totals: { income: 300, expense: 120, net: 180 },
      movementDates: ["2025-03-12"],
      dateFrom: "2025-03-12",
      dateTo: null,
      currency: "ARS",
      referenceDate,
    })

    expect(health).toMatchObject({
      savingRate: 0.6,
      dailyExpense: 30,
      analyzedDays: 4,
    })
  })

  it("returns stable finite pace and days when the range has no movements", () => {
    const health = buildFinancialHealth({
      totals: { income: 0, expense: 0, net: 0 },
      movementDates: [],
      dateFrom: null,
      dateTo: null,
      currency: "ARS",
      referenceDate,
    })

    expect(health.savingRate).toBeNull()
    expect(health.dailyExpense).toBe(0)
    expect(health.analyzedDays).toBe(1)
    expect(Number.isNaN(health.dailyExpense)).toBe(false)
    expect(Number.isNaN(health.analyzedDays)).toBe(false)
  })
})
