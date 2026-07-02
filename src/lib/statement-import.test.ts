import { describe, it, expect } from "vitest"
import { buildStatementPayload, type BuildStatementPayloadInput, type StatementReviewLine } from "./statement-import"

function makeLine(overrides: Partial<StatementReviewLine> = {}): StatementReviewLine {
  return {
    description: "Super Chino",
    date: "2026-06-15",
    amount: 5000,
    currency: "ARS",
    amount_ars: null,
    installment_number: null,
    installment_total: null,
    category_id: "cat-1",
    selected: true,
    ...overrides,
  }
}

function makeInput(overrides: Partial<BuildStatementPayloadInput> = {}): BuildStatementPayloadInput {
  return {
    account_id: "acc-1",
    account_currency: "ARS",
    close_date: "2026-06-20",
    due_date: "2026-06-30",
    total_amount: 5000,
    total_amount_usd: 0,
    stamp_tax: 100,
    lines: [makeLine()],
    ...overrides,
  }
}

describe("buildStatementPayload", () => {
  it("passes through header fields (totals) unchanged", () => {
    const payload = buildStatementPayload(
      makeInput({ total_amount: 12345, total_amount_usd: 67.5, stamp_tax: 200 })
    )
    expect(payload.account_id).toBe("acc-1")
    expect(payload.close_date).toBe("2026-06-20")
    expect(payload.due_date).toBe("2026-06-30")
    expect(payload.total_amount).toBe(12345)
    expect(payload.total_amount_usd).toBe(67.5)
    expect(payload.stamp_tax).toBe(200)
  })

  it("appends the installment tag to the note when installment fields are set", () => {
    const payload = buildStatementPayload(
      makeInput({ lines: [makeLine({ description: "Notebook", installment_number: 3, installment_total: 12 })] })
    )
    expect(payload.lines[0].note).toBe("Notebook (cuota 3/12)")
  })

  it("uses the plain description as note when there are no installments", () => {
    const payload = buildStatementPayload(makeInput({ lines: [makeLine({ description: "Super Chino" })] }))
    expect(payload.lines[0].note).toBe("Super Chino")
  })

  it("leaves converted_amount null and dollar_type null for a same-currency line", () => {
    const payload = buildStatementPayload(
      makeInput({ account_currency: "ARS", lines: [makeLine({ currency: "ARS" })] })
    )
    expect(payload.lines[0].original_currency).toBe("ARS")
    expect(payload.lines[0].converted_amount).toBeNull()
    expect(payload.lines[0].dollar_type).toBeNull()
  })

  it("uses amount_ars from the PDF as converted_amount for a USD line on an ARS card", () => {
    const payload = buildStatementPayload(
      makeInput({
        account_currency: "ARS",
        lines: [makeLine({ currency: "USD", amount: 10, amount_ars: 13500 })],
      })
    )
    expect(payload.lines[0].original_currency).toBe("USD")
    expect(payload.lines[0].converted_amount).toBe(13500)
    expect(payload.lines[0].dollar_type).toBe("tarjeta")
  })

  it("computes converted_amount from rate when amount_ars is missing", () => {
    const payload = buildStatementPayload(
      makeInput({
        account_currency: "ARS",
        rate: 1350,
        lines: [makeLine({ currency: "USD", amount: 10, amount_ars: null })],
      })
    )
    expect(payload.lines[0].converted_amount).toBe(13500)
    expect(payload.lines[0].dollar_type).toBe("tarjeta")
  })

  it("throws when a cross-currency line has neither amount_ars nor rate", () => {
    expect(() =>
      buildStatementPayload(
        makeInput({
          account_currency: "ARS",
          rate: null,
          lines: [makeLine({ currency: "USD", amount: 10, amount_ars: null })],
        })
      )
    ).toThrow()
  })

  it("excludes deselected lines from the payload", () => {
    const payload = buildStatementPayload(
      makeInput({
        lines: [makeLine({ description: "Incluida", selected: true }), makeLine({ description: "Excluida", selected: false })],
      })
    )
    expect(payload.lines).toHaveLength(1)
    expect(payload.lines[0].note).toBe("Incluida")
  })
})
