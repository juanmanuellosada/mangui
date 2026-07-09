import { describe, it, expect } from "vitest"
import { reconcileStatement, buildReconcileApplyPayload, type ReconcileMovement } from "./statement-reconcile"
import type { ParsedStatement, ParsedStatementLine } from "./ai/statement-schema"
import type { StatementReviewLine } from "./statement-import"

function makeLine(overrides: Partial<ParsedStatementLine> = {}): ParsedStatementLine {
  return {
    description: "Super Chino",
    date: "2026-06-15",
    amount: 5000,
    currency: "ARS",
    amount_ars: null,
    installment_number: null,
    installment_total: null,
    is_subscription: false,
    is_refund: false,
    category_hint: null,
    ...overrides,
  }
}

function makeParsed(lines: ParsedStatementLine[]): ParsedStatement {
  return {
    bank: null,
    account_hint: null,
    close_date: "2026-06-20",
    due_date: "2026-06-30",
    total_ars: null,
    total_usd: null,
    stamp_tax: null,
    lines,
    upcoming_installments: null,
  }
}

function makeMovement(overrides: Partial<ReconcileMovement> = {}): ReconcileMovement {
  return {
    id: "mov-1",
    description: "Super Chino",
    amount: 5000,
    currency: "ARS",
    type: "expense",
    installment_number: null,
    installment_total: null,
    ...overrides,
  }
}

describe("reconcileStatement", () => {
  it("no reporta nada cuando la línea del PDF y el movimiento cargado coinciden exacto", () => {
    const result = reconcileStatement(makeParsed([makeLine()]), [makeMovement()])
    expect(result.missing).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })

  it("caso falta: línea del PDF sin movimiento cargado equivalente", () => {
    const line = makeLine({ description: "Kiosco Don Pepe", amount: 1200 })
    const result = reconcileStatement(makeParsed([line]), [])
    expect(result.missing).toEqual([line])
    expect(result.extra).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })

  it("caso sobra: movimiento cargado sin línea equivalente en el PDF", () => {
    const movement = makeMovement({ description: "Farmacity", amount: 800 })
    const result = reconcileStatement(makeParsed([]), [movement])
    expect(result.extra).toEqual([movement])
    expect(result.missing).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })

  it("caso diferencia de monto: mismo comercio, importe distinto en el PDF vs cargado", () => {
    const line = makeLine({ description: "Super Chino", amount: 5500 })
    const movement = makeMovement({ description: "Super Chino", amount: 5000 })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.missing).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
    expect(result.mismatched).toEqual([{ line, movement }])
  })

  it("no marca diferencia de monto por ruido de precisión de floats (tolerancia de centavos)", () => {
    const line = makeLine({ amount: 0.1 + 0.2 }) // 0.30000000000000004
    const movement = makeMovement({ amount: 0.3 })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.mismatched).toHaveLength(0)
    expect(result.missing).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
  })

  it("matchea comercios con la MISMA normalización aunque la descripción varíe levemente", () => {
    // "Super Chino Once" -> normalizeNote quita mayúsculas/puntuación -> extractKeyword
    // toma la primera palabra >=3 chars ("super") por tener más de 2 palabras.
    const line = makeLine({ description: "SUPER CHINO ONCE" })
    const movement = makeMovement({ description: "Super Chino - Sucursal Once" })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.missing).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })

  it("documenta que descripciones muy distintas del MISMO comercio real no matchean (limitación conocida)", () => {
    // "ANTHROPIC* CLAUD" y "CLAUDE.AI SUBSCR" son el mismo comercio real, pero
    // normalizeNote/extractKeyword (rules.ts) las reduce a keywords distintas
    // ("anthropic claud" vs "claude subscr"): la normalización actual no tiene
    // sinónimos ni fuzzy-matching, así que el diff las trata como comercios
    // distintos. Queda documentado a propósito (ver design.md, Risks): el
    // humano revisa el diff y decide, no se auto-resuelve.
    const line = makeLine({ description: "ANTHROPIC* CLAUD", amount: 9900 })
    const movement = makeMovement({ description: "CLAUDE.AI SUBSCR", amount: 9900 })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.missing).toEqual([line])
    expect(result.extra).toEqual([movement])
    expect(result.mismatched).toHaveLength(0)
  })

  it("líneas en USD matchean por moneda: no confunde un ARS y un USD del mismo comercio/monto", () => {
    const lineUsd = makeLine({ description: "Netflix", amount: 15, currency: "USD" })
    const movementArs = makeMovement({ description: "Netflix", amount: 15, currency: "ARS" })
    const result = reconcileStatement(makeParsed([lineUsd]), [movementArs])
    expect(result.missing).toEqual([lineUsd])
    expect(result.extra).toEqual([movementArs])
    expect(result.mismatched).toHaveLength(0)

    const movementUsd = makeMovement({ description: "Netflix", amount: 15, currency: "USD" })
    const matched = reconcileStatement(makeParsed([lineUsd]), [movementUsd])
    expect(matched.missing).toHaveLength(0)
    expect(matched.extra).toHaveLength(0)
    expect(matched.mismatched).toHaveLength(0)
  })

  it("cuotas matchean por comercio + número de cuota, no por importe exacto en el mismatch", () => {
    const line = makeLine({
      description: "Notebook",
      amount: 10000,
      installment_number: 3,
      installment_total: 12,
    })
    const movement = makeMovement({
      description: "Notebook",
      amount: 10000,
      installment_number: 3,
      installment_total: 12,
    })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.missing).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })

  it("cuotas del mismo comercio pero distinto número de cuota NO matchean entre sí", () => {
    const line = makeLine({
      description: "Notebook",
      amount: 10000,
      installment_number: 4,
      installment_total: 12,
    })
    const movement = makeMovement({
      description: "Notebook",
      amount: 10000,
      installment_number: 3,
      installment_total: 12,
    })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.missing).toEqual([line])
    expect(result.extra).toEqual([movement])
    expect(result.mismatched).toHaveLength(0)
  })

  it("cuota con importe distinto en el PDF vs lo cargado queda como diferencia de monto", () => {
    const line = makeLine({
      description: "Notebook",
      amount: 10500,
      installment_number: 3,
      installment_total: 12,
    })
    const movement = makeMovement({
      description: "Notebook",
      amount: 10000,
      installment_number: 3,
      installment_total: 12,
    })
    const result = reconcileStatement(makeParsed([line]), [movement])
    expect(result.mismatched).toEqual([{ line, movement }])
    expect(result.missing).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
  })

  it("una devolución (is_refund) no matchea contra un gasto del mismo comercio/importe", () => {
    const refundLine = makeLine({ description: "Impuesto Pais", amount: 500, is_refund: true })
    const expenseMovement = makeMovement({ description: "Impuesto Pais", amount: 500, type: "expense" })
    const result = reconcileStatement(makeParsed([refundLine]), [expenseMovement])
    expect(result.missing).toEqual([refundLine])
    expect(result.extra).toEqual([expenseMovement])

    const incomeMovement = makeMovement({ description: "Impuesto Pais", amount: 500, type: "income" })
    const matched = reconcileStatement(makeParsed([refundLine]), [incomeMovement])
    expect(matched.missing).toHaveLength(0)
    expect(matched.extra).toHaveLength(0)
    expect(matched.mismatched).toHaveLength(0)
  })

  it("matchea de a uno cuando hay varias líneas/movimientos con la misma clave (multiset)", () => {
    const lineA = makeLine({ description: "Kiosco", amount: 100 })
    const lineB = makeLine({ description: "Kiosco", amount: 200 })
    const movementA = makeMovement({ id: "mov-a", description: "Kiosco", amount: 100 })
    const result = reconcileStatement(makeParsed([lineA, lineB]), [movementA])
    // lineA matchea exacto con movementA; lineB queda sin movimiento -> falta.
    expect(result.missing).toEqual([lineB])
    expect(result.extra).toHaveLength(0)
    expect(result.mismatched).toHaveLength(0)
  })
})

function makeReviewLine(overrides: Partial<StatementReviewLine> = {}): StatementReviewLine {
  return {
    description: "Kiosco Don Pepe",
    date: "2026-06-15",
    amount: 1200,
    currency: "ARS",
    amount_ars: null,
    installment_number: null,
    installment_total: null,
    is_subscription: false,
    category_id: "cat-1",
    selected: true,
    ...overrides,
  }
}

describe("buildReconcileApplyPayload", () => {
  const baseInput = {
    account_id: "acc-1",
    account_currency: "ARS" as const,
    close_date: "2026-06-20",
    due_date: "2026-06-30",
    total_amount: 1200,
    total_amount_usd: 0,
    stamp_tax: 0,
  }

  it("marca el payload como additive: true", () => {
    const payload = buildReconcileApplyPayload({ ...baseInput, linesToApply: [makeReviewLine()] })
    expect(payload.additive).toBe(true)
  })

  it("solo incluye las líneas tildadas (no agrega nada de más)", () => {
    const kiosco = makeReviewLine({ description: "Kiosco Don Pepe", amount: 1200 })
    const farmacity = makeReviewLine({ description: "Farmacity", amount: 800 })
    const payload = buildReconcileApplyPayload({ ...baseInput, linesToApply: [kiosco, farmacity] })
    expect(payload.lines).toHaveLength(2)
    expect(payload.lines.map((l) => l.note)).toEqual(["Kiosco Don Pepe", "Farmacity"])
  })

  it("una línea deseleccionada por el usuario no llega al payload", () => {
    const kiosco = makeReviewLine({ description: "Kiosco Don Pepe" })
    const noTildada = makeReviewLine({ description: "Farmacity", selected: false })
    const payload = buildReconcileApplyPayload({ ...baseInput, linesToApply: [kiosco, noTildada] })
    expect(payload.lines).toHaveLength(1)
    expect(payload.lines[0].note).toBe("Kiosco Don Pepe")
  })

  it("una cuota faltante tildada agrega también sus cuotas futuras (misma proyección que el import)", () => {
    const cuota = makeReviewLine({
      description: "Notebook",
      amount: 10000,
      installment_number: 3,
      installment_total: 5,
    })
    const payload = buildReconcileApplyPayload({ ...baseInput, linesToApply: [cuota] })
    expect(payload.lines).toHaveLength(0)
    expect(payload.installment_purchases).toHaveLength(1)
    // Cuotas 3, 4 y 5 (la leída + las futuras hasta el total).
    expect(payload.installment_purchases[0].installments.map((i) => i.installment_number)).toEqual([3, 4, 5])
  })

  it("no muta las líneas de entrada ni recalcula matching (delega toda la expansión a buildStatementPayload)", () => {
    const line = makeReviewLine()
    const payload = buildReconcileApplyPayload({ ...baseInput, linesToApply: [line] })
    expect(line.selected).toBe(true) // sigue intacta
    expect(payload.account_id).toBe("acc-1")
    expect(payload.close_date).toBe("2026-06-20")
  })
})
