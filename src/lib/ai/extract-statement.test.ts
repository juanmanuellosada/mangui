import { describe, it, expect } from "vitest"
import { clampLineDatesToClose } from "./extract-statement"
import type { ParsedStatement, ParsedStatementLine } from "./statement-schema"

function line(overrides: Partial<ParsedStatementLine> = {}): ParsedStatementLine {
  return {
    description: "IMPUESTO DE SELLOS",
    date: "2026-08-27",
    amount: 2877.57,
    currency: "ARS",
    amount_ars: null,
    installment_number: null,
    installment_total: null,
    is_subscription: false,
    is_refund: false,
    settles_previous: false,
    category_hint: null,
    ...overrides,
  }
}

function parsed(lines: ParsedStatementLine[], close_date: string | null): ParsedStatement {
  return {
    bank: "Galicia",
    account_idx: null,
    account_hint: null,
    close_date,
    due_date: "2026-09-04",
    total_ars: 250396.77,
    total_usd: 17.2,
    stamp_tax: 2877.57,
    lines,
    upcoming_installments: null,
  }
}

describe("clampLineDatesToClose", () => {
  // Caso real (Mastercard, cierre 27-ago-26): los impuestos del bloque de
  // totales no traen fecha impresa y el modelo les pone la de VENCIMIENTO
  // (04-sep). Así caían en el ciclo siguiente y quedaban marcados como
  // futuros.
  it("trae al cierre una línea fechada después del cierre", () => {
    const out = clampLineDatesToClose(
      parsed([line({ date: "2026-09-04" }), line({ description: "PERCEP.AFIP", date: "2026-09-04" })], "2026-08-27")
    )
    expect(out.lines.map((l) => l.date)).toEqual(["2026-08-27", "2026-08-27"])
  })

  it("no toca las fechas anteriores o iguales al cierre", () => {
    const out = clampLineDatesToClose(
      parsed([line({ date: "2026-08-04" }), line({ date: "2026-08-27" })], "2026-08-27")
    )
    expect(out.lines.map((l) => l.date)).toEqual(["2026-08-04", "2026-08-27"])
  })

  it("si el PDF no trajo cierre, no inventa nada", () => {
    const out = clampLineDatesToClose(parsed([line({ date: "2026-09-04" })], null))
    expect(out.lines[0].date).toBe("2026-09-04")
  })
})
