import { describe, it, expect, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "./database.types"
import { estadoPresupuestos } from "./ai/tools"
import { fetchBudgetMovements } from "./budget-income"

vi.mock("./budget-income", () => ({ fetchBudgetMovements: vi.fn() }))

const fixed: Tables<"budgets"> = {
  id: "budget", user_id: "user", name: "Comida", icon: null,
  limit_amount: 1000, currency: "ARS", period: "monthly",
  start_date: "2026-01-01", end_date: null, is_recurring: true,
  status: "active", category_ids: [], account_ids: [],
  rollover_enabled: false, alert_threshold: 80, created_at: "", updated_at: "",
}

function clientFor(budget: Tables<"budgets">) {
  return { from: () => ({ select: () => ({ eq: async () => ({ data: [budget], error: null }) }) }) } as unknown as SupabaseClient<Database>
}

async function query(budget: Tables<"budgets">, income?: number) {
  vi.mocked(fetchBudgetMovements).mockResolvedValue(income === undefined ? [] : [{
    type: "income", amount: income, converted_amount: null, original_currency: "ARS",
    date: "2026-06-15", category_id: "salary", account_id: "acc", is_future: false,
  }] as Tables<"movements">[])
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-06-15T15:00:00Z"))
  try {
    return await estadoPresupuestos(clientFor(budget))
  } finally {
    vi.useRealTimers()
  }
}

describe("AI budget consumer", () => {
  it("returns unavailable numbers instead of claiming healthy zero usage", async () => {
    const result = await query({ ...fixed, limit_mode: "percentage", income_percentage: 20 })
    expect(result.presupuestos[0]).toMatchObject({ limite: null, porcentaje: null, restante: null, estado: "missing_income" })
  })

  it("uses the same dynamic percentage limit as the UI", async () => {
    const result = await query({ ...fixed, limit_mode: "percentage", income_percentage: 20 }, 1_000_000)
    expect(result.presupuestos[0]).toMatchObject({ limite: 200_000, porcentaje: 0, restante: 200_000, estado: "on_track" })
  })

  it("preserves fixed-budget public output", async () => {
    const result = await query(fixed)
    expect(result.presupuestos[0]).toEqual({ nombre: "Comida", periodo: "monthly", gastado: 0, limite: 1000, porcentaje: 0, restante: 1000, estado: "on_track", ventana: { desde: "2026-06-01", hasta: "2026-06-30" } })
  })
})
