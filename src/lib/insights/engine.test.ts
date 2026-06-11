import { describe, it, expect } from "vitest"
import type { BudgetProgress } from "@/lib/budgets"
import { generateInsights } from "./engine"
import type { InsightInput } from "./engine"

const ref = new Date("2026-06-15T12:00:00Z")

function makeBudgetProgress(overrides: Partial<BudgetProgress>): BudgetProgress {
  return {
    spent: 500,
    limit: 1000,
    percent: 50,
    remaining: 500,
    status: "on_track",
    ...overrides,
  } as BudgetProgress
}

const emptyInput: InsightInput = {
  cards: [],
  budgets: [],
  upcomingRecurring: { count: 0, total: 0 },
  spend: { thisWeek: 0, prevWeek: 0 },
}

// ──────────────────────────────────────────────────────────
// Card close insights
// ──────────────────────────────────────────────────────────
describe("card close insights", () => {
  it("produces a card insight for a card closing in 3 days with a delta vs previous statement", () => {
    const input: InsightInput = {
      ...emptyInput,
      cards: [
        {
          name: "Visa Galicia",
          currency: "ARS",
          closeDate: "2026-06-18", // 3 days after ref
          cycleAmount: 12000,
          prevStatementAmount: 10000,
        },
      ],
    }
    const results = generateInsights(input, ref)
    expect(results).toHaveLength(1)
    const insight = results[0]
    expect(insight.title).toBe("Resumen de Visa Galicia")
    expect(insight.body).toContain("% vs el resumen anterior")
    expect(insight.url).toBe("/tarjetas")
  })

  it("does NOT produce a card insight for a card closing more than 7 days out", () => {
    const input: InsightInput = {
      ...emptyInput,
      cards: [
        {
          name: "Mastercard",
          currency: "ARS",
          closeDate: "2026-07-10", // >7 days from ref
          cycleAmount: 5000,
          prevStatementAmount: 4000,
        },
      ],
    }
    const results = generateInsights(input, ref)
    expect(results).toHaveLength(0)
  })

  it("does NOT include delta when prevStatementAmount is null", () => {
    const input: InsightInput = {
      ...emptyInput,
      cards: [
        {
          name: "Visa",
          currency: "ARS",
          closeDate: "2026-06-17",
          cycleAmount: 8000,
          prevStatementAmount: null,
        },
      ],
    }
    const results = generateInsights(input, ref)
    expect(results).toHaveLength(1)
    expect(results[0].body).not.toContain("vs el resumen anterior")
  })
})

// ──────────────────────────────────────────────────────────
// Budget insights
// ──────────────────────────────────────────────────────────
describe("budget insights", () => {
  it("produces priority-100 insight for exceeded budget containing the rounded percent", () => {
    const input: InsightInput = {
      ...emptyInput,
      budgets: [
        {
          name: "Comidas",
          progress: makeBudgetProgress({ spent: 1500, limit: 1000, percent: 150, remaining: -500, status: "exceeded" }),
        },
      ],
    }
    const results = generateInsights(input, ref)
    expect(results).toHaveLength(1)
    expect(results[0].priority).toBe(100)
    expect(results[0].body).toContain("150%")
  })

  it("produces priority-70 insight for near budget", () => {
    const input: InsightInput = {
      ...emptyInput,
      budgets: [
        {
          name: "Transporte",
          progress: makeBudgetProgress({ spent: 850, limit: 1000, percent: 85, remaining: 150, status: "near" }),
        },
      ],
    }
    const results = generateInsights(input, ref)
    expect(results).toHaveLength(1)
    expect(results[0].priority).toBe(70)
    expect(results[0].body).toContain("85%")
  })

  it("does NOT produce an insight for on_track budget", () => {
    const input: InsightInput = {
      ...emptyInput,
      budgets: [
        {
          name: "Ocio",
          progress: makeBudgetProgress({ spent: 200, limit: 1000, percent: 20, remaining: 800, status: "on_track" }),
        },
      ],
    }
    const results = generateInsights(input, ref)
    expect(results).toHaveLength(0)
  })
})

// ──────────────────────────────────────────────────────────
// Recurring insights
// ──────────────────────────────────────────────────────────
describe("recurring insights", () => {
  it("does NOT produce a recurring insight when count is 0", () => {
    const input: InsightInput = {
      ...emptyInput,
      upcomingRecurring: { count: 0, total: 0 },
    }
    const results = generateInsights(input, ref)
    expect(results).toHaveLength(0)
  })

  it("produces a recurring insight whose body contains the count when count > 0", () => {
    const input: InsightInput = {
      ...emptyInput,
      upcomingRecurring: { count: 2, total: 5000 },
    }
    const results = generateInsights(input, ref)
    expect(results).toHaveLength(1)
    expect(results[0].body).toContain("2")
    expect(results[0].url).toBe("/recurrentes")
  })
})

// ──────────────────────────────────────────────────────────
// Spend trend insights
// ──────────────────────────────────────────────────────────
describe("spend trend insights", () => {
  it("produces a trend insight with '20% más' when thisWeek is 20% above prevWeek", () => {
    const input: InsightInput = {
      ...emptyInput,
      spend: { thisWeek: 12000, prevWeek: 10000 },
    }
    const results = generateInsights(input, ref)
    expect(results).toHaveLength(1)
    expect(results[0].body).toContain("20% más")
  })

  it("does NOT produce a trend insight when the difference is under 10%", () => {
    const input: InsightInput = {
      ...emptyInput,
      spend: { thisWeek: 10500, prevWeek: 10000 }, // 5% — below threshold
    }
    const results = generateInsights(input, ref)
    expect(results).toHaveLength(0)
  })
})

// ──────────────────────────────────────────────────────────
// Ordering and cap
// ──────────────────────────────────────────────────────────
describe("ordering and cap", () => {
  it("returns exactly max insights, sorted by priority descending", () => {
    const input: InsightInput = {
      // exceeded budget (priority 100) + card closing in 3 days (priority ~87) + recurring (priority 50)
      cards: [
        {
          name: "Visa",
          currency: "ARS",
          closeDate: "2026-06-18", // 3 days → priority 90-3=87
          cycleAmount: 5000,
          prevStatementAmount: null,
        },
      ],
      budgets: [
        {
          name: "Comidas",
          progress: makeBudgetProgress({ spent: 1500, limit: 1000, percent: 150, remaining: -500, status: "exceeded" }),
        },
      ],
      upcomingRecurring: { count: 1, total: 3000 },
      spend: { thisWeek: 0, prevWeek: 0 },
    }

    const results = generateInsights(input, ref, 2)
    expect(results).toHaveLength(2)
    expect(results[0].priority).toBe(100) // exceeded budget first
    expect(results[0].key).toContain("budget_exceeded")
    expect(results[1].priority).toBe(87) // card second
  })
})
