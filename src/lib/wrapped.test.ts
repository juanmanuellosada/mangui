import { describe, it, expect } from "vitest"
import { buildWrappedData, type Movement, type Category } from "./wrapped"

function makeMovement(overrides: Partial<Movement>): Movement {
  return {
    id: "mov-1",
    user_id: "user-1",
    account_id: "acc-1",
    amount: 1000,
    category_id: null,
    converted_amount: null,
    created_at: "2026-06-01T00:00:00Z",
    date: "2026-06-01",
    dollar_type: null,
    import_statement_id: null,
    installment_number: null,
    installment_purchase_id: null,
    installment_total: null,
    is_future: false,
    note: null,
    original_currency: "ARS",
    recurring_id: null,
    type: "expense",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  } as Movement
}

function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: "cat-1",
    user_id: "user-1",
    name: "Comida",
    icon: "🍔",
    type: "expense",
    is_default: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Category
}

const CATEGORIES: Category[] = [
  makeCategory({ id: "cat-food", name: "Comida", icon: "🍔" }),
  makeCategory({ id: "cat-transport", name: "Transporte", icon: "🚌" }),
  makeCategory({ id: "cat-fun", name: "Diversión", icon: "🎉" }),
  makeCategory({ id: "cat-other", name: "Otros", icon: "📦" }),
]

describe("buildWrappedData", () => {
  it("computes totals for the given month, ignoring other months", () => {
    const movements: Movement[] = [
      makeMovement({ id: "1", date: "2026-06-05", type: "expense", amount: 1000, category_id: "cat-food" }),
      makeMovement({ id: "2", date: "2026-06-10", type: "income", amount: 5000 }),
      makeMovement({ id: "3", date: "2026-05-20", type: "expense", amount: 9999 }), // other month
    ]
    const result = buildWrappedData(movements, CATEGORIES, "2026-06")

    expect(result.monthRef).toBe("2026-06")
    expect(result.totalExpense).toBe(1000)
    expect(result.totalIncome).toBe(5000)
    expect(result.net).toBe(4000)
    expect(result.movementsCount).toBe(2)
    expect(result.hasData).toBe(true)
  })

  it("excludes is_future movements", () => {
    const movements: Movement[] = [
      makeMovement({ id: "1", date: "2026-06-05", type: "expense", amount: 1000 }),
      makeMovement({ id: "2", date: "2026-06-15", type: "expense", amount: 2000, is_future: true }),
    ]
    const result = buildWrappedData(movements, CATEGORIES, "2026-06")

    expect(result.totalExpense).toBe(1000)
    expect(result.movementsCount).toBe(1)
  })

  it("returns hasData false and zeroed totals for an empty month", () => {
    const result = buildWrappedData([], CATEGORIES, "2026-06")

    expect(result.hasData).toBe(false)
    expect(result.totalExpense).toBe(0)
    expect(result.totalIncome).toBe(0)
    expect(result.movementsCount).toBe(0)
    expect(result.topCategories).toEqual([])
    expect(result.topWeekday).toBeNull()
  })

  it("ranks top-3 expense categories by total with icon and percent", () => {
    const movements: Movement[] = [
      makeMovement({ id: "1", date: "2026-06-01", type: "expense", amount: 5000, category_id: "cat-food" }),
      makeMovement({ id: "2", date: "2026-06-02", type: "expense", amount: 3000, category_id: "cat-transport" }),
      makeMovement({ id: "3", date: "2026-06-03", type: "expense", amount: 1000, category_id: "cat-fun" }),
      makeMovement({ id: "4", date: "2026-06-04", type: "expense", amount: 500, category_id: "cat-other" }),
    ]
    const result = buildWrappedData(movements, CATEGORIES, "2026-06")

    expect(result.topCategories).toHaveLength(3)
    expect(result.topCategories[0]).toMatchObject({ name: "Comida", icon: "🍔", amount: 5000 })
    expect(result.topCategories[1]).toMatchObject({ name: "Transporte", amount: 3000 })
    expect(result.topCategories[2]).toMatchObject({ name: "Diversión", amount: 1000 })
    // percent is over total expense (9500)
    expect(result.topCategories[0].percent).toBeCloseTo((5000 / 9500) * 100, 5)
  })

  it("computes real (IPC-adjusted) vs nominal expense when ipc is provided", () => {
    const movements: Movement[] = [
      makeMovement({ id: "1", date: "2026-04-10", type: "expense", amount: 1000 }),
    ]
    const ipc = { "2025-04": 8585.6078, "2026-04": 11363.0904 }
    // Use monthRef = 2026-04 so refMonth (latest ipc month) equals same month -> factor 1
    const result = buildWrappedData(movements, CATEGORIES, "2026-04", { ipc })

    expect(result.realVsNominal.nominal).toBe(1000)
    expect(result.realVsNominal.adjusted).toBeCloseTo(1000, 0)
    expect(result.realVsNominal.deltaPct).toBeCloseTo(0, 0)
  })

  it("shows adjusted > nominal for a month prior to the latest ipc month", () => {
    const movements: Movement[] = [
      makeMovement({ id: "1", date: "2025-04-10", type: "expense", amount: 1000 }),
    ]
    const ipc = { "2025-04": 8585.6078, "2026-04": 11363.0904 }
    const result = buildWrappedData(movements, CATEGORIES, "2025-04", { ipc })

    expect(result.realVsNominal.nominal).toBe(1000)
    expect(result.realVsNominal.adjusted).toBeCloseTo(1323.5, 0)
    expect(result.realVsNominal.deltaPct).toBeGreaterThan(0)
  })

  it("returns null adjusted/deltaPct when ipc is not provided", () => {
    const movements: Movement[] = [makeMovement({ id: "1", date: "2026-06-01", amount: 1000 })]
    const result = buildWrappedData(movements, CATEGORIES, "2026-06")

    expect(result.realVsNominal.adjusted).toBeNull()
    expect(result.realVsNominal.deltaPct).toBeNull()
  })

  it("computes vsPreviousMonth delta when previousMonthMovements is provided", () => {
    const movements: Movement[] = [
      makeMovement({ id: "1", date: "2026-06-01", type: "expense", amount: 1500 }),
    ]
    const previousMonthMovements: Movement[] = [
      makeMovement({ id: "2", date: "2026-05-01", type: "expense", amount: 1000 }),
    ]
    const result = buildWrappedData(movements, CATEGORIES, "2026-06", { previousMonthMovements })

    expect(result.vsPreviousMonth).not.toBeNull()
    expect(result.vsPreviousMonth?.previousExpense).toBe(1000)
    expect(result.vsPreviousMonth?.deltaPct).toBeCloseTo(50, 5)
  })

  it("returns vsPreviousMonth null when not provided", () => {
    const result = buildWrappedData([makeMovement({ id: "1", date: "2026-06-01" })], CATEGORIES, "2026-06")
    expect(result.vsPreviousMonth).toBeNull()
  })

  it("finds the weekday with the highest expense total", () => {
    // 2026-06-06 is a Saturday
    const movements: Movement[] = [
      makeMovement({ id: "1", date: "2026-06-01", type: "expense", amount: 100 }), // Monday
      makeMovement({ id: "2", date: "2026-06-06", type: "expense", amount: 900 }), // Saturday
    ]
    const result = buildWrappedData(movements, CATEGORIES, "2026-06")

    expect(result.topWeekday).toEqual({ weekday: "sáb", total: 900 })
  })

  it("builds a human-readable monthLabel in Spanish", () => {
    const result = buildWrappedData([], CATEGORIES, "2026-06")
    expect(result.monthLabel).toBe("junio de 2026")
  })
})
