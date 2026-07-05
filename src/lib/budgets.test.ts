import { describe, it, expect } from "vitest"
import type { Budget } from "./budgets"
import {
  currentWindow,
  activeBudgetWindow,
  computeBudgetProgress,
} from "./budgets"

// ---------------------------------------------------------------------------
// Minimal Budget fixture factory
// ---------------------------------------------------------------------------
function makeBudget(overrides: Partial<Budget>): Budget {
  return {
    id: "test-id",
    user_id: "user-1",
    name: "Test Budget",
    limit_amount: 1000,
    currency: "ARS",
    period: "monthly",
    start_date: "2026-01-01",
    end_date: null,
    is_recurring: true,
    status: "active",
    category_ids: [],
    account_ids: [],
    icon: null,
    rollover_enabled: false,
    alert_threshold: 80,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Budget
}

// ---------------------------------------------------------------------------
// currentWindow
// ---------------------------------------------------------------------------
describe("currentWindow", () => {
  describe("monthly", () => {
    it("returns the full calendar month containing ref", () => {
      const ref = new Date(2026, 5, 15) // June 15 2026
      const w = currentWindow("monthly", "2026-01-01", ref)
      expect(w.from).toBe("2026-06-01")
      expect(w.to).toBe("2026-06-30")
    })

    it("works at month boundaries", () => {
      const ref = new Date(2026, 1, 28) // Feb 28 2026
      const w = currentWindow("monthly", "2026-01-01", ref)
      expect(w.from).toBe("2026-02-01")
      expect(w.to).toBe("2026-02-28")
    })
  })

  describe("annual", () => {
    it("returns Jan 1 – Dec 31 of ref's year", () => {
      const ref = new Date(2026, 5, 15)
      const w = currentWindow("annual", "2026-01-01", ref)
      expect(w.from).toBe("2026-01-01")
      expect(w.to).toBe("2026-12-31")
    })
  })

  describe("quarterly", () => {
    it("June ref → Q2 Apr 1 – Jun 30", () => {
      const ref = new Date(2026, 5, 15) // June
      const w = currentWindow("quarterly", "2026-01-01", ref)
      expect(w.from).toBe("2026-04-01")
      expect(w.to).toBe("2026-06-30")
    })

    it("January ref → Q1 Jan 1 – Mar 31", () => {
      const ref = new Date(2026, 0, 15)
      const w = currentWindow("quarterly", "2026-01-01", ref)
      expect(w.from).toBe("2026-01-01")
      expect(w.to).toBe("2026-03-31")
    })

    it("October ref → Q4 Oct 1 – Dec 31", () => {
      const ref = new Date(2026, 9, 10)
      const w = currentWindow("quarterly", "2026-01-01", ref)
      expect(w.from).toBe("2026-10-01")
      expect(w.to).toBe("2026-12-31")
    })
  })

  describe("weekly", () => {
    // Use a Monday anchor: 2026-06-08 is a Monday
    const anchorMonday = "2026-06-08"

    it("ref is the anchor Monday → window starts on that Monday, ends Sunday", () => {
      const ref = new Date(2026, 5, 8) // June 8 2026 (Monday)
      const w = currentWindow("weekly", anchorMonday, ref)
      expect(w.from).toBe("2026-06-08")
      expect(w.to).toBe("2026-06-14")
    })

    it("ref is Wednesday in the same week → window starts on Monday", () => {
      const ref = new Date(2026, 5, 10) // June 10 (Wednesday)
      const w = currentWindow("weekly", anchorMonday, ref)
      expect(w.from).toBe("2026-06-08")
      expect(w.to).toBe("2026-06-14")
    })

    it("ref is next week Monday → next window", () => {
      const ref = new Date(2026, 5, 15) // June 15 (Monday)
      const w = currentWindow("weekly", anchorMonday, ref)
      expect(w.from).toBe("2026-06-15")
      expect(w.to).toBe("2026-06-21")
    })
  })

  describe("biweekly", () => {
    // anchor = 2026-01-01 (Thursday)
    const anchor = "2026-01-01"

    it("ref = anchor → first window (block index 0)", () => {
      const ref = new Date(2026, 0, 1)
      const w = currentWindow("biweekly", anchor, ref)
      expect(w.from).toBe("2026-01-01")
      expect(w.to).toBe("2026-01-14")
    })

    it("ref = day 13 → still first window", () => {
      const ref = new Date(2026, 0, 13)
      const w = currentWindow("biweekly", anchor, ref)
      expect(w.from).toBe("2026-01-01")
      expect(w.to).toBe("2026-01-14")
    })

    it("ref = day 15 → second window starts on day 15", () => {
      const ref = new Date(2026, 0, 15)
      const w = currentWindow("biweekly", anchor, ref)
      expect(w.from).toBe("2026-01-15")
      expect(w.to).toBe("2026-01-28")
    })

    it("window is always exactly 14 days", () => {
      const ref = new Date(2026, 2, 5)
      const w = currentWindow("biweekly", anchor, ref)
      const from = new Date(w.from)
      const to = new Date(w.to)
      const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBe(13) // inclusive span: to - from = 13 days
    })
  })
})

// ---------------------------------------------------------------------------
// activeBudgetWindow
// ---------------------------------------------------------------------------
describe("activeBudgetWindow", () => {
  it("case 1: is_recurring=true + preset period → delegates to currentWindow (monthly)", () => {
    const budget = makeBudget({ is_recurring: true, period: "monthly", start_date: "2026-01-01" })
    const ref = new Date(2026, 5, 15)
    const w = activeBudgetWindow(budget, ref)
    expect(w.from).toBe("2026-06-01")
    expect(w.to).toBe("2026-06-30")
  })

  it("case 1: is_recurring=true + preset period → delegates to currentWindow (annual)", () => {
    const budget = makeBudget({ is_recurring: true, period: "annual", start_date: "2026-01-01" })
    const ref = new Date(2026, 5, 15)
    const w = activeBudgetWindow(budget, ref)
    expect(w.from).toBe("2026-01-01")
    expect(w.to).toBe("2026-12-31")
  })

  it("case 2: is_recurring=true + null period → rolling window containing ref", () => {
    // start=2026-01-01, end=2026-01-10 → duration=10 days
    // Block 0: Jan 1-10, Block 1: Jan 11-20, ...
    // ref = Jan 15 → block index 1 → Jan 11 – Jan 20
    const budget = makeBudget({
      is_recurring: true,
      period: null,
      start_date: "2026-01-01",
      end_date: "2026-01-10",
    })
    const ref = new Date(2026, 0, 15) // Jan 15
    const w = activeBudgetWindow(budget, ref)
    expect(w.from).toBe("2026-01-11")
    expect(w.to).toBe("2026-01-20")
  })

  it("case 2: is_recurring=true + null period → first window when ref = start date", () => {
    const budget = makeBudget({
      is_recurring: true,
      period: null,
      start_date: "2026-01-01",
      end_date: "2026-01-07",
    })
    const ref = new Date(2026, 0, 1)
    const w = activeBudgetWindow(budget, ref)
    expect(w.from).toBe("2026-01-01")
    expect(w.to).toBe("2026-01-07")
  })

  it("case 3: is_recurring=false → fixed [start_date, end_date]", () => {
    const budget = makeBudget({
      is_recurring: false,
      period: null,
      start_date: "2026-03-01",
      end_date: "2026-03-31",
    })
    const w = activeBudgetWindow(budget, new Date(2026, 5, 15))
    expect(w.from).toBe("2026-03-01")
    expect(w.to).toBe("2026-03-31")
  })

  it("case 3: is_recurring=false without end_date falls back to start_date", () => {
    const budget = makeBudget({
      is_recurring: false,
      period: null,
      start_date: "2026-06-01",
      end_date: null,
    })
    const w = activeBudgetWindow(budget, new Date(2026, 5, 15))
    expect(w.from).toBe("2026-06-01")
    expect(w.to).toBe("2026-06-01")
  })
})

// ---------------------------------------------------------------------------
// computeBudgetProgress
// ---------------------------------------------------------------------------

type MovementRow = {
  type: string
  is_future: boolean
  date: string
  category_id: string | null
  account_id: string
  amount: number
  converted_amount: number | null
  original_currency: string
}

function makeMovement(overrides: Partial<MovementRow>): MovementRow {
  return {
    type: "expense",
    is_future: false,
    date: "2026-06-15",
    category_id: "cat-1",
    account_id: "acc-1",
    amount: 100,
    converted_amount: null,
    original_currency: "ARS",
    ...overrides,
  }
}

describe("computeBudgetProgress", () => {
  const ref = new Date(2026, 5, 15) // June 15 2026

  // Monthly budget, no filters (global), limit=1000
  const globalBudget = makeBudget({
    is_recurring: true,
    period: "monthly",
    start_date: "2026-01-01",
    limit_amount: 1000,
    category_ids: [],
    account_ids: [],
  })

  it("counts expense movements in window", () => {
    const movements: MovementRow[] = [
      makeMovement({ amount: 200 }),
      makeMovement({ amount: 300 }),
    ]
    const p = computeBudgetProgress(globalBudget, movements as any, ref)
    expect(p.spent).toBe(500)
  })

  it("excludes future movements (is_future=true)", () => {
    const movements: MovementRow[] = [
      makeMovement({ amount: 200 }),
      makeMovement({ amount: 300, is_future: true }),
    ]
    const p = computeBudgetProgress(globalBudget, movements as any, ref)
    expect(p.spent).toBe(200)
  })

  it("excludes movements outside the window", () => {
    const movements: MovementRow[] = [
      makeMovement({ amount: 200, date: "2026-06-15" }),
      makeMovement({ amount: 300, date: "2026-05-15" }), // last month, outside window
    ]
    const p = computeBudgetProgress(globalBudget, movements as any, ref)
    expect(p.spent).toBe(200)
  })

  it("excludes non-expense movements (income/transfer)", () => {
    const movements: MovementRow[] = [
      makeMovement({ amount: 200 }),
      makeMovement({ amount: 500, type: "income" }),
      makeMovement({ amount: 100, type: "transfer" }),
    ]
    const p = computeBudgetProgress(globalBudget, movements as any, ref)
    expect(p.spent).toBe(200)
  })

  it("prefers converted_amount when present for a cross-currency movement", () => {
    const movements: MovementRow[] = [
      makeMovement({ amount: 100, converted_amount: 150, original_currency: "USD" }),
    ]
    const p = computeBudgetProgress(globalBudget, movements as any, ref)
    expect(p.spent).toBe(150)
  })

  it("uses raw amount when converted_amount is null (same currency as budget)", () => {
    const movements: MovementRow[] = [
      makeMovement({ amount: 250, converted_amount: null }),
    ]
    const p = computeBudgetProgress(globalBudget, movements as any, ref)
    expect(p.spent).toBe(250)
  })

  it("does not count a USD movement with no converted_amount ('USD puro') toward an ARS budget", () => {
    const movements: MovementRow[] = [
      makeMovement({ amount: 300, converted_amount: null, original_currency: "USD" }),
      makeMovement({ amount: 200 }), // ARS, counted normally
    ]
    const p = computeBudgetProgress(globalBudget, movements as any, ref)
    expect(p.spent).toBe(200)
  })

  it("filters by category_ids when non-empty", () => {
    const budget = makeBudget({
      is_recurring: true,
      period: "monthly",
      start_date: "2026-01-01",
      limit_amount: 1000,
      category_ids: ["cat-2"],
      account_ids: [],
    })
    const movements: MovementRow[] = [
      makeMovement({ amount: 100, category_id: "cat-1" }),
      makeMovement({ amount: 200, category_id: "cat-2" }),
    ]
    const p = computeBudgetProgress(budget, movements as any, ref)
    expect(p.spent).toBe(200)
  })

  it("filters by account_ids when non-empty", () => {
    const budget = makeBudget({
      is_recurring: true,
      period: "monthly",
      start_date: "2026-01-01",
      limit_amount: 1000,
      category_ids: [],
      account_ids: ["acc-2"],
    })
    const movements: MovementRow[] = [
      makeMovement({ amount: 100, account_id: "acc-1" }),
      makeMovement({ amount: 200, account_id: "acc-2" }),
    ]
    const p = computeBudgetProgress(budget, movements as any, ref)
    expect(p.spent).toBe(200)
  })

  it("empty movements → spent=0, status=on_track", () => {
    const p = computeBudgetProgress(globalBudget, [] as any, ref)
    expect(p.spent).toBe(0)
    expect(p.status).toBe("on_track")
    expect(p.remaining).toBe(1000)
  })

  describe("status thresholds", () => {
    it("< 80% → on_track", () => {
      const movements = [makeMovement({ amount: 700 })] // 70% of 1000
      const p = computeBudgetProgress(globalBudget, movements as any, ref)
      expect(p.status).toBe("on_track")
    })

    it("exactly 80% → near", () => {
      const movements = [makeMovement({ amount: 800 })]
      const p = computeBudgetProgress(globalBudget, movements as any, ref)
      expect(p.status).toBe("near")
    })

    it("> 80% and ≤ 100% → near", () => {
      const movements = [makeMovement({ amount: 900 })] // 90%
      const p = computeBudgetProgress(globalBudget, movements as any, ref)
      expect(p.status).toBe("near")
    })

    it("exactly 100% → near (not exceeded)", () => {
      const movements = [makeMovement({ amount: 1000 })]
      const p = computeBudgetProgress(globalBudget, movements as any, ref)
      // percent = 100, which is not > 100, so status = near
      expect(p.status).toBe("near")
    })

    it("> 100% → exceeded", () => {
      const movements = [makeMovement({ amount: 1500 })]
      const p = computeBudgetProgress(globalBudget, movements as any, ref)
      expect(p.status).toBe("exceeded")
    })
  })

  describe("alert_threshold (custom)", () => {
    it("custom threshold of 50 → near at 50%", () => {
      const budget = makeBudget({
        is_recurring: true,
        period: "monthly",
        start_date: "2026-01-01",
        limit_amount: 1000,
        alert_threshold: 50,
      })
      const movements = [makeMovement({ amount: 500 })] // 50%
      const p = computeBudgetProgress(budget, movements as any, ref)
      expect(p.status).toBe("near")
    })

    it("custom threshold of 50 → on_track just below it", () => {
      const budget = makeBudget({
        is_recurring: true,
        period: "monthly",
        start_date: "2026-01-01",
        limit_amount: 1000,
        alert_threshold: 50,
      })
      const movements = [makeMovement({ amount: 490 })] // 49%
      const p = computeBudgetProgress(budget, movements as any, ref)
      expect(p.status).toBe("on_track")
    })
  })

  describe("rollover", () => {
    it("carries positive leftover from the previous period into effectiveLimit", () => {
      const budget = makeBudget({
        is_recurring: true,
        period: "monthly",
        start_date: "2026-01-01",
        limit_amount: 1000,
        rollover_enabled: true,
      })
      // Previous window (May 2026): spent 600 of 1000 → leftover 400 carries in.
      const movements: MovementRow[] = [
        makeMovement({ amount: 600, date: "2026-05-15" }),
        makeMovement({ amount: 300, date: "2026-06-15" }),
      ]
      const p = computeBudgetProgress(budget, movements as any, ref)
      expect(p.baseLimit).toBe(1000)
      expect(p.carry).toBe(400)
      expect(p.effectiveLimit).toBe(1400)
      expect(p.limit).toBe(1400)
      expect(p.spent).toBe(300)
      expect(p.remaining).toBe(1100)
    })

    it("previous overspend does NOT carry as debt (carry floors at 0)", () => {
      const budget = makeBudget({
        is_recurring: true,
        period: "monthly",
        start_date: "2026-01-01",
        limit_amount: 1000,
        rollover_enabled: true,
      })
      const movements: MovementRow[] = [
        makeMovement({ amount: 1500, date: "2026-05-15" }), // overspent previous period
        makeMovement({ amount: 300, date: "2026-06-15" }),
      ]
      const p = computeBudgetProgress(budget, movements as any, ref)
      expect(p.carry).toBe(0)
      expect(p.effectiveLimit).toBe(1000)
    })

    it("first period (no previous window within budget lifetime) → carry=0", () => {
      const budget = makeBudget({
        is_recurring: true,
        period: "monthly",
        start_date: "2026-06-01", // June is the first period
        limit_amount: 1000,
        rollover_enabled: true,
      })
      const movements: MovementRow[] = [
        makeMovement({ amount: 100, date: "2026-06-10" }),
      ]
      const p = computeBudgetProgress(budget, movements as any, ref)
      expect(p.carry).toBe(0)
      expect(p.effectiveLimit).toBe(1000)
    })

    it("rollover disabled → carry=0 even with a leftover previous period", () => {
      const budget = makeBudget({
        is_recurring: true,
        period: "monthly",
        start_date: "2026-01-01",
        limit_amount: 1000,
        rollover_enabled: false,
      })
      const movements: MovementRow[] = [
        makeMovement({ amount: 200, date: "2026-05-15" }),
        makeMovement({ amount: 300, date: "2026-06-15" }),
      ]
      const p = computeBudgetProgress(budget, movements as any, ref)
      expect(p.carry).toBe(0)
      expect(p.limit).toBe(1000)
    })
  })
})
