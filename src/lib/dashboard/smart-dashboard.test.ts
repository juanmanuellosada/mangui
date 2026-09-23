import { describe, expect, it } from "vitest"
import { buildSmartDashboardSignals, type SmartDashboardMovement } from "./smart-dashboard"

function movement(overrides: Partial<SmartDashboardMovement>): SmartDashboardMovement {
  return {
    id: "movement",
    type: "expense",
    is_future: false,
    date: "2026-03-01",
    category_id: "food",
    amount: 1000,
    converted_amount: null,
    original_currency: "ARS",
    ...overrides,
  }
}

describe("buildSmartDashboardSignals", () => {
  it("prioritizes the largest recent unusual charge over other signals", () => {
    const movements = [
      ...Array.from({ length: 5 }, (_, index) =>
        movement({ id: `history-${index}`, date: `2026-02-${String(index + 1).padStart(2, "0")}`, amount: 2000 }),
      ),
      movement({ id: "unusual", date: "2026-03-14", amount: 10000 }),
      movement({ id: "upcoming", is_future: true, date: "2026-03-20", amount: 3000 }),
    ]

    const signals = buildSmartDashboardSignals(movements, "2026-03-15")

    expect(signals.map((signal) => signal.kind)).toEqual([
      "unusual_charge",
      "spending_pace",
      "upcoming_movements",
    ])
    expect(signals[0]).toMatchObject({
      movementId: "unusual",
      amount: 10000,
      ratio: 5,
    })
  })

  it("projects this month's recorded expenses through the end of the month", () => {
    const signals = buildSmartDashboardSignals(
      [movement({ id: "march-expense", date: "2026-03-15", amount: 15000 })],
      "2026-03-15",
    )

    expect(signals).toContainEqual({
      kind: "spending_pace",
      id: "spending-pace",
      priority: 200,
      href: "/estadisticas",
      spent: 15000,
      projected: 31000,
      daysRemaining: 16,
    })
  })

  it("includes only future movements scheduled in the next seven days", () => {
    const signals = buildSmartDashboardSignals(
      [
        movement({ id: "tomorrow", is_future: true, date: "2026-03-16", amount: 1200 }),
        movement({ id: "in-seven-days", is_future: true, date: "2026-03-22", amount: 2800 }),
        movement({ id: "later", is_future: true, date: "2026-03-23", amount: 9999 }),
      ],
      "2026-03-15",
    )

    expect(signals).toContainEqual({
      kind: "upcoming_movements",
      id: "upcoming-movements",
      priority: 100,
      href: "/movimientos",
      count: 2,
      expenseTotal: 4000,
    })
  })
})
