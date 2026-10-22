import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, it, expect, vi } from "vitest"
import { BudgetComplianceStrip } from "@/components/stats/budget-compliance-strip"
import { budgetToFormValues } from "./budget-form"
import type { Budget } from "@/lib/budgets"
import type { Tables } from "@/lib/database.types"

const budget: Budget = {
  id: "budget", user_id: "user", name: "Comida", icon: null,
  limit_amount: 1000, currency: "ARS", period: "monthly",
  start_date: "2026-01-01", end_date: null, is_recurring: true,
  status: "active", category_ids: [], account_ids: [],
  rollover_enabled: false, alert_threshold: 80, created_at: "", updated_at: "",
}

function render(b: Budget, income?: number) {
  const movements = income === undefined ? [] : [{
    type: "income", amount: income, converted_amount: null, original_currency: "ARS",
    date: "2026-06-15", category_id: null, account_id: "acc", is_future: false,
  }] as Tables<"movements">[]
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-06-15T15:00:00Z"))
  try {
    return renderToStaticMarkup(createElement(BudgetComplianceStrip, { budgets: [b], movements }))
  } finally {
    vi.useRealTimers()
  }
}

describe("public budget presentation", () => {
  it("shows an explicit missing base without a healthy icon or progressbar", () => {
    const html = render({ ...budget, limit_mode: "percentage", income_percentage: 20 })
    expect(html).toContain("Sin ingresos registrados")
    expect(html).toContain("20% de ingresos")
    expect(html).not.toContain('role="progressbar"')
    expect(html).not.toContain("Al día")
  })

  it("keeps legacy fixed budgets calculable without income", () => {
    const html = render(budget)
    expect(html).toContain('role="progressbar"')
    expect(html).toContain("Al día")
    expect(html).not.toContain("Sin ingresos registrados")
  })

  it("updates the displayed effective limit when income changes", () => {
    const percentage = { ...budget, limit_mode: "percentage" as const, income_percentage: 20 }
    expect(render(percentage, 1000)).toContain("200")
    expect(render(percentage, 2000)).toContain("400")
  })

  it("loads stored percentage settings for editing and defaults legacy rows to fixed", () => {
    expect(budgetToFormValues({ ...budget, limit_mode: "percentage", income_percentage: 35 })).toMatchObject({ limit_mode: "percentage", income_percentage: 35, limit_amount: 1000 })
    expect(budgetToFormValues(budget)).toMatchObject({ limit_mode: "fixed", limit_amount: 1000 })
  })
})
