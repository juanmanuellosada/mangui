import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SmartDashboardMovement } from "@/lib/dashboard/smart-dashboard"
import { SmartDashboardWidget } from "./smart-dashboard-widget"

const query = vi.hoisted(() => ({
  data: [] as SmartDashboardMovement[],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}))
vi.mock("@tanstack/react-query", () => ({ useQuery: () => query }))
vi.mock("@/lib/hooks/use-categories", () => ({
  useCategories: () => ({ data: [{ id: "food", name: "Comida" }] }),
}))
vi.mock("@/lib/movements", () => ({ fetchAllMovements: vi.fn() }))
vi.mock("@/lib/date-utils", () => ({ todayAR: () => "2026-03-15" }))

function movement(overrides: Partial<SmartDashboardMovement>): SmartDashboardMovement {
  return {
    id: "expense",
    type: "expense",
    is_future: false,
    date: "2026-03-15",
    category_id: "food",
    amount: 10000,
    converted_amount: null,
    original_currency: "ARS",
    ...overrides,
  }
}

function render() {
  return renderToStaticMarkup(createElement(SmartDashboardWidget))
}

beforeEach(() => {
  query.data = []
  query.isLoading = false
  query.isError = false
})

describe("Radar presentation", () => {
  it("distinguishes review, projection and agenda without changing signal order or routes", () => {
    query.data = [
      ...Array.from({ length: 5 }, (_, index) => movement({
        id: `history-${index}`, date: `2026-02-0${index + 1}`, amount: 2000,
      })),
      movement({}),
      movement({ id: "next", is_future: true, date: "2026-03-16", amount: 3000 }),
    ]
    const html = render()
    expect(html).toContain("Para revisar")
    expect(html).toContain("Proyección")
    expect(html).toContain("Próximos 7 días")
    expect(html.indexOf("Gasto inusual")).toBeLessThan(html.indexOf("Cierre de mes estimado"))
    expect(html.indexOf("Cierre de mes estimado")).toBeLessThan(html.indexOf("1 movimiento previsto"))
    expect(html).toContain('href="/estadisticas"')
    expect(html.match(/href="\/movimientos"/g)).toHaveLength(2)
    expect(html).toContain("promedio reciente de esa categoría")
    expect(html).toContain("no un límite de gasto")
    expect(html).toContain("Montos en pesos (ARS)")
  })

  it("keeps action labels visible on mobile instead of hiding them behind chevrons", () => {
    query.data = [movement({})]
    const html = render()
    expect(html).toContain("Ver estadísticas")
    expect(html).not.toContain("hidden sm:inline")
    expect(html).toContain("min-h-11")
    expect(html).toContain("focus-visible:ring-2")
    expect(html).not.toContain("Para revisar")
  })

  it("uses a readable fallback category and Argentine decimal wording", () => {
    query.data = [
      ...Array.from({ length: 5 }, (_, index) => movement({
        id: `history-${index}`,
        category_id: "unknown-category",
        date: `2026-02-0${index + 1}`,
        amount: 2000,
      })),
      movement({ category_id: "unknown-category", amount: 10600 }),
    ]
    const html = render()
    expect(html).toContain("Esta categoría:")
    expect(html).toContain("5,3 veces")
    expect(html).not.toContain("unknown-category")
  })

  it("does not describe an income-only agenda as a bill or zero expense", () => {
    query.data = [movement({ type: "income", is_future: true, date: "2026-03-16" })]
    const html = render()
    expect(html).toContain("1 movimiento previsto")
    expect(html).not.toContain("de gastos previstos")
    expect(html).not.toContain("vencimientos")
  })

  it("uses plural agenda wording and includes only its expense total", () => {
    query.data = [
      movement({ id: "expense", is_future: true, date: "2026-03-16", amount: 3000 }),
      movement({ id: "income", type: "income", is_future: true, date: "2026-03-17", amount: 9000 }),
    ]
    const html = render()
    expect(html).toContain("2 movimientos previstos")
    expect(html).toContain("3.000,00 de gastos previstos")
    expect(html).not.toContain("12.000")
  })

  it("announces loading and suppresses stale signals", () => {
    query.data = [movement({})]
    query.isLoading = true
    const html = render()
    expect(html).toContain('role="status"')
    expect(html).toContain("Cargando señales")
    expect(html).not.toContain("Ver estadísticas")
  })

  it("announces a scoped retryable error without presenting stale signals as current", () => {
    query.data = [movement({})]
    query.isError = true
    const html = render()
    expect(html).toContain('role="alert"')
    expect(html).toContain("No pudimos cargar las señales del Radar")
    expect(html).toContain("Reintentar")
    expect(html).not.toContain("Ver estadísticas")
  })

  it("explains the first-use empty state and links to recorded movements", () => {
    const html = render()
    expect(html).toContain("Registrá tus primeros movimientos")
    expect(html).toContain('href="/movimientos"')
    expect(html).toContain("Ver movimientos")
  })

  it("does not tell an existing user to register their first movement or claim everything is healthy", () => {
    query.data = [movement({ type: "income" })]
    const html = render()
    expect(html).toContain("Sin señales para hoy")
    expect(html).not.toContain("Registrá tus primeros movimientos")
    expect(html).not.toContain("Todo en orden")
  })
})
